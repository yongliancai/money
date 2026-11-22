import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draftSchema,
  aiResultSchema,
  backupSchema,
} from '../../shared/schemas/index.js';
import { localDate, localTime, shiftDate } from '../../shared/dates.js';
import { monthStats, exportCSV } from '../../client/src/storage/ledger.js';
import { demoParse, createParser } from '../../server/src/services/ai.js';
import { eligibility } from '../../server/src/jobs/scheduler.js';

test('date and money contracts reject calendar rollover, floats, negative and unsafe values', () => {
  const good = {
    item: '午餐',
    amount: 120,
    category: '餐飲',
    expenseDate: '2026-11-22',
  };
  assert.deepEqual(draftSchema.parse(good), good);
  for (const amount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(draftSchema.safeParse({ ...good, amount }).success, false);
  for (const expenseDate of [
    '2026-02-29',
    '2026-11-31',
    '2026-13-01',
    'yesterday',
  ])
    assert.equal(
      draftSchema.safeParse({ ...good, expenseDate }).success,
      false,
    );
  assert.equal(
    draftSchema.safeParse({ ...good, expenseDate: '2024-02-29' }).success,
    true,
  );
});
test('monthly totals use expenseDate and remain exact above JS safe sum', () => {
  const stats = monthStats(
    [
      {
        expenseDate: '2026-10-31',
        createdAt: '2026-11-22',
        amount: 999,
        category: 'A',
      },
      {
        expenseDate: '2026-11-01',
        createdAt: '2026-10-31',
        amount: Number.MAX_SAFE_INTEGER,
        category: 'A',
      },
      { expenseDate: '2026-11-22', amount: 3, category: 'B' },
    ],
    '2026-11',
  );
  assert.equal(stats.total, BigInt(Number.MAX_SAFE_INTEGER) + 3n);
  assert.equal(stats.records.length, 2);
});
test('IANA dates, midnight, DST, travel and relative month boundary', () => {
  const now = new Date('2026-11-22T16:01:00Z');
  assert.equal(localDate(now, 'Asia/Taipei'), '2026-11-23');
  assert.equal(localDate(now, 'America/Los_Angeles'), '2026-11-22');
  assert.equal(localTime(now, 'Asia/Taipei'), '00:01');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(
    localTime(new Date('2026-03-08T10:01:00Z'), 'America/Los_Angeles'),
    '03:01',
  );
});
test('CSV escapes quotes, delimiters, line breaks and spreadsheet formula injection', () => {
  const csv = exportCSV([
    { item: '=HYPERLINK("bad")', amount: 120, category: 'a,b\nc' },
  ]);
  assert.ok(csv.includes(`"'=HYPERLINK(""bad"")"`));
  assert.ok(csv.includes('"a,b\nc"'));
  assert.ok(csv.startsWith('\uFEFF'));
});
test('demonstration parser fixed evaluation: multiple entries, yesterday, partial and invalid outputs', async () => {
  assert.deepEqual(demoParse('昨天午餐 120、今天咖啡 55', '2026-11-01'), {
    drafts: [
      {
        item: '午餐',
        amount: 120,
        category: '餐飲',
        expenseDate: '2026-10-31',
      },
      { item: '咖啡', amount: 55, category: '飲品', expenseDate: '2026-11-01' },
    ],
    unparsed: [],
  });
  assert.deepEqual(demoParse('午餐120、不知道多少', '2026-11-22').unparsed, [
    '不知道多少',
  ]);
  assert.throws(() => demoParse('午餐0', '2026-11-22'));
  assert.equal(
    aiResultSchema.safeParse({ drafts: [], unparsed: [], save: true }).success,
    false,
  );
  assert.equal(
    backupSchema.safeParse({ schemaVersion: 2, expenses: [] }).success,
    false,
  );
  await assert.rejects(
    createParser('disabled')({ text: '午餐120', referenceDate: '2026-11-22' }),
    /手動/,
  );
});
const base = () => ({
  settings: {
    enabled: true,
    time: '21:00',
    timeZone: 'Asia/Taipei',
    revision: 1,
  },
  status: {
    localDate: '2026-11-22',
    timeZone: 'Asia/Taipei',
    settingsRevision: 1,
    completed: false,
    occurredAt: '2026-11-22T13:01:00Z',
  },
  subscription: {},
  now: new Date('2026-11-22T13:02:00Z'),
  policy: { maxAgeSeconds: 300, debounceSeconds: 10 },
});
test('conservative reminders: no app, offline uncertainty, deletion, stale, cross day, zone change, policy pending', () => {
  assert.equal(eligibility(base()), 'eligible');
  assert.equal(eligibility({ ...base(), status: null }), 'unknown');
  assert.equal(eligibility({ ...base(), policy: null }), 'policy_pending');
  assert.equal(
    eligibility({ ...base(), status: { ...base().status, completed: true } }),
    'completed',
  );
  assert.equal(
    eligibility({ ...base(), now: new Date('2026-11-22T14:00:00Z') }),
    'stale',
  );
  assert.equal(
    eligibility({ ...base(), now: new Date('2026-11-23T13:02:00Z') }),
    'unknown',
  );
  assert.equal(
    eligibility({
      ...base(),
      settings: {
        ...base().settings,
        timeZone: 'America/New_York',
        revision: 2,
      },
    }),
    'unknown',
  );
  assert.equal(
    eligibility({ ...base(), now: new Date('2026-11-22T13:01:05Z') }),
    'not_due',
  );
});
