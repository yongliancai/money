import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../server/src/db/database.js';
import { runScheduler } from '../../server/src/jobs/scheduler.js';

const now = new Date('2026-11-22T13:02:00Z');
const policy = { maxAgeSeconds: 300, debounceSeconds: 10 };
const event = (revision, completed = false) => ({
  eventId: crypto.randomUUID(),
  localDate: '2026-11-22',
  timeZone: 'Asia/Taipei',
  revision,
  completed,
  occurredAt: '2026-11-22T13:01:00Z',
  settingsRevision: 1,
});
function setup(t, path) {
  const store = openDatabase(path);
  t.after(() => store.close());
  const { deviceId: id } = store.register(now);
  store.set('settings', id, {
    enabled: true,
    time: '21:00',
    timeZone: 'Asia/Taipei',
    revision: 1,
  });
  store.set('subscriptions', id, { endpoint: 'fake' });
  return { store, id };
}
test('event duplicates and out-of-order revisions cannot overwrite latest completion (200 randomized sequences)', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          revision: fc.integer({ min: 1, max: 1000 }),
          completed: fc.boolean(),
        }),
        { minLength: 1, maxLength: 60 },
      ),
      (values) => {
        const store = openDatabase();
        try {
          const { deviceId: id } = store.register(now);
          let expected;
          for (const value of values) {
            const e = event(value.revision, value.completed);
            store.sync(id, e, now);
            store.sync(id, e, now);
            if (!expected || value.revision > expected.revision)
              expected = value;
          }
          const actual = store.status(id, '2026-11-22');
          assert.equal(actual.revision, expected.revision);
          assert.equal(actual.completed, expected.completed);
        } finally {
          store.close();
        }
      },
    ),
    { numRuns: 200, seed: 20261122 },
  );
});
test('two scheduler connections compete for a persistent unique daily claim; one attempt only', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bookkeeping-'));
  const path = join(directory, 'test.sqlite');
  const { store, id } = setup(t, path);
  const other = openDatabase(path);
  t.after(() => {
    other.close();
    rmSync(directory, { recursive: true, force: true });
  });
  store.sync(id, event(1), now);
  let attempts = 0;
  const send = async () => {
    attempts++;
    await Promise.resolve();
  };
  await Promise.all([
    runScheduler({ store, now, policy, send }),
    runScheduler({ store: other, now, policy, send }),
  ]);
  await runScheduler({ store, now, policy, send });
  assert.equal(attempts, 1);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM claims').get().n, 1);
});
test('uncertain delivery is never retried; expired push subscriptions are removed', async (t) => {
  const { store, id } = setup(t);
  store.sync(id, event(1), now);
  let calls = 0;
  const send = async () => {
    calls++;
    throw Object.assign(new Error('gone'), { statusCode: 410 });
  };
  assert.equal(
    (await runScheduler({ store, now, policy, send })).failed_or_unknown,
    1,
  );
  await runScheduler({ store, now, policy, send });
  assert.equal(calls, 1);
  assert.equal(store.get('subscriptions', id), null);
});
test('unknown, stale, completed, timezone-revised and yesterday states never trigger a formal attempt', async (t) => {
  const { store, id } = setup(t);
  let calls = 0;
  const send = async () => {
    calls++;
  };
  await runScheduler({ store, now, policy, send });
  store.sync(id, event(1, true), now);
  await runScheduler({ store, now, policy, send });
  store.sync(id, event(2, false), now);
  await runScheduler({
    store,
    now: new Date('2026-11-23T13:02:00Z'),
    policy,
    send,
  });
  await runScheduler({ store, now, policy: null, send });
  store.set('settings', id, {
    enabled: true,
    time: '01:00',
    timeZone: 'America/Los_Angeles',
    revision: 2,
  });
  await runScheduler({ store, now, policy, send });
  assert.equal(calls, 0);
});
test('offline queued stale event uses occurrence time, never receipt time, for freshness', async (t) => {
  const { store, id } = setup(t);
  store.sync(id, { ...event(1), occurredAt: '2026-11-22T01:00:00Z' }, now);
  const result = await runScheduler({
    store,
    now,
    policy,
    send: async () => assert.fail('stale must not send'),
  });
  assert.equal(result.stale, 1);
});
