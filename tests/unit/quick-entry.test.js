import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickEntry } from '../../client/src/features/quick-entry/parser.js';
import {
  CATEGORIES,
  classifyItem,
} from '../../client/src/features/quick-entry/classification-rules.js';

const options = { expenseDate: '2026-11-22' };
test('four requested lines produce deterministic editable candidates with exactly the approved seven categories', () => {
  assert.deepEqual(CATEGORIES, [
    '餐飲',
    '交通',
    '購物',
    '娛樂',
    '學習',
    '生活',
    '其他',
  ]);
  const candidates = parseQuickEntry(
    '早餐蛋餅 45\n午餐便當 100\n捷運 30\n全聯買牛奶 65',
    options,
  );
  assert.deepEqual(
    candidates.map((c) => [c.draft.item, c.draft.amount, c.draft.category]),
    [
      ['早餐蛋餅', 45, '餐飲'],
      ['午餐便當', 100, '餐飲'],
      ['捷運', 30, '交通'],
      ['全聯買牛奶', 65, '購物'],
    ],
  );
  assert.ok(
    candidates.every(
      (c) => c.draft.expenseDate === '2026-11-22' && !c.issues.length,
    ),
  );
});
test('conflicting and unknown keywords never choose a category including other automatically', () => {
  assert.equal(classifyItem('全聯咖啡').status, 'conflict');
  assert.equal(classifyItem('全聯咖啡').category, '');
  assert.equal(classifyItem('神秘支出').category, '');
  assert.equal(classifyItem('神秘支出').status, 'unmatched');
  assert.equal(classifyItem('午餐便當').category, '餐飲');
  assert.equal(classifyItem('YouTuber 會員').status, 'unmatched');
  assert.equal(classifyItem('UBER 車資').category, '交通');
});
test('rules are centrally extensible and do not use first-match priority', () => {
  const rules = [
    { category: '學習', keywords: ['研究'] },
    { category: '生活', keywords: ['研究'] },
  ];
  assert.equal(classifyItem('研究', rules).status, 'conflict');
  assert.equal(
    parseQuickEntry('研究 100', { ...options, rules })[0].draft.category,
    '',
  );
});
test('invalid or missing amounts remain visible candidates for manual repair', () => {
  for (const line of [
    '午餐 -10',
    '午餐 0',
    '午餐 1.5',
    '午餐 1,00',
    '午餐 9007199254740992',
    '午餐',
    '45',
    '午餐 100 咖啡 55',
    '早餐 45/2',
  ]) {
    const [candidate] = parseQuickEntry(line, options);
    assert.equal(candidate.draft.amount, '', line);
    assert.ok(candidate.issues.length, line);
    assert.equal(candidate.raw, line);
  }
  assert.equal(
    parseQuickEntry('書籍 NT$1,200元', options)[0].draft.amount,
    1200,
  );
  assert.equal(parseQuickEntry('早餐蛋餅４５', options)[0].draft.amount, 45);
});
test('calendar dates, relative day boundaries and ambiguous dates require accurate review', () => {
  assert.equal(
    parseQuickEntry('昨天午餐 100', { expenseDate: '2026-03-01' })[0].draft
      .expenseDate,
    '2026-02-28',
  );
  assert.equal(
    parseQuickEntry('2024-02-29 早餐45', options)[0].draft.expenseDate,
    '2024-02-29',
  );
  assert.equal(
    parseQuickEntry('2026-02-30 早餐45', options)[0].draft.expenseDate,
    '',
  );
  assert.equal(parseQuickEntry('上週午餐45', options)[0].draft.expenseDate, '');
});
test('blank lines preserve original line numbers and bounds never silently truncate data', () => {
  const rows = parseQuickEntry('早餐45\r\n\r\n捷運30', options);
  assert.deepEqual(
    rows.map((r) => r.lineNumber),
    [1, 3],
  );
  assert.throws(() => parseQuickEntry(' ', options));
  assert.throws(() => parseQuickEntry('x'.repeat(4001), options));
  assert.throws(() =>
    parseQuickEntry(Array(51).fill('早餐45').join('\n'), options),
  );
});
