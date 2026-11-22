import test from 'node:test';
import assert from 'node:assert/strict';
import {
  historicalComparison,
  comparePeriods,
  monthToDateComparison,
  sevenDayComparison,
  validateMockOffers,
  dateAt,
} from '../../client/src/features/analysis/analysis.js';
const record = (id, date, amount = 40, category = '餐飲') => ({
  id,
  expenseDate: date,
  amount,
  category,
  createdAt: '2026-11-22T04:00:00Z',
});

test('history excludes self, same-day, future, unlinked and invalid samples and is sorted by expense date', () => {
  const expenses = [
    record('target', '2026-11-22', 100),
    record('day', '2026-11-22'),
    record('future', '2026-11-23'),
    record('past', '2026-11-20'),
    record('older', '2026-11-19'),
    record('zero', '2026-11-18', 0),
    record('negative', '2026-11-18', -1),
    record('nan', '2026-11-18', NaN),
    record('other', '2026-11-17'),
  ];
  const links = Object.fromEntries(
    expenses.filter((e) => e.id !== 'other').map((e) => [e.id, 'confirmed']),
  );
  const r = historicalComparison(expenses, links, 'target');
  assert.equal(r.count, 2);
  assert.equal(r.reference, 40);
  assert.equal(r.rating, null);
  assert.deepEqual(
    r.historical.map((e) => e.id),
    ['older', 'past'],
  );
});

test('history recalculates median and five-sample threshold after edits and removals', () => {
  const records = Array.from({ length: 6 }, (_, i) =>
    record(String(i), dateAt('2026-11-10', i), i === 5 ? 60 : 40),
  );
  const links = Object.fromEntries(records.map((e) => [e.id, 'group']));
  assert.equal(historicalComparison(records, links, '5').rating, '相對偏高');
  assert.equal(historicalComparison(records.slice(1), links, '5').rating, null);
  records[0].amount = 10;
  records[1].amount = 20;
  records[2].amount = 30;
  assert.equal(historicalComparison(records, links, '5').reference, 30);
});

test('analysis preserves safe-integer ledger totals and arbitrary category names', () => {
  const e = [
    record('a', '2026-11-22', Number.MAX_SAFE_INTEGER, '__proto__'),
    record('b', '2026-11-22', Number.MAX_SAFE_INTEGER, '__proto__'),
    record('c', '2026-11-21', 1, 'constructor'),
  ];
  const r = comparePeriods(
    e,
    [],
    '2026-11-22',
    '2026-11-22',
    '2026-11-21',
    '2026-11-21',
  );
  assert.equal(r.current.total, 18014398509481982n);
  assert.equal(r.difference, 18014398509481981n);
  assert.equal(r.current.categories.__proto__, 18014398509481982n);
});

test('coverage boundaries require both periods, do not fill unknown days, zero baseline has no percent', () => {
  const current = Array.from({ length: 10 }, (_, i) => dateAt('2026-11-01', i));
  const previous = Array.from({ length: 10 }, (_, i) =>
    dateAt('2026-10-01', i),
  );
  const compare = (a, b) =>
    comparePeriods(
      [],
      [...current.slice(0, a), ...previous.slice(0, b)],
      '2026-11-01',
      '2026-11-10',
      '2026-10-01',
      '2026-10-10',
    );
  assert.equal(compare(9, 9).status, 'eligible');
  assert.equal(compare(9, 7).status, 'preliminary');
  assert.equal(compare(7, 7).status, 'preliminary');
  assert.equal(compare(10, 6).status, 'insufficient');
  assert.equal(compare(0, 0).current.coverage, 0);
  assert.equal(compare(10, 10).percent, null);
});

test('calendar periods handle leap February, nonleap, year rollover, and exclude unmatched month tail explicitly', () => {
  for (const [today, currentEnd, prevEnd] of [
    ['2024-03-31', '2024-03-29', '2024-02-29'],
    ['2025-03-31', '2025-03-28', '2025-02-28'],
    ['2026-01-31', '2026-01-31', '2025-12-31'],
    ['2024-02-29', '2024-02-29', '2024-01-29'],
  ]) {
    const r = monthToDateComparison(
      [record('unmatched', today, 99)],
      [],
      today,
    );
    assert.equal(r.current.end, currentEnd);
    assert.equal(r.previous.end, prevEnd);
    assert.equal(r.current.days, r.previous.days);
  }
  const week = sevenDayComparison(
    [record('a', '2025-12-31', 100), record('b', '2025-12-25', 50)],
    [],
    '2026-01-02',
  );
  assert.equal(week.current.total, 100n);
  assert.equal(week.previous.total, 50n);
  assert.equal(week.percent, 100);
});

test('mock excludes invalid prices, unmatched offers and invalid/duplicate merchant identities', () => {
  const offers = [
    { merchant: ' SHOP A ', price: 100, match: 'exact' },
    { merchant: 'shop a', price: 999, match: 'exact' },
    { merchant: 'SHOP B', price: 200, match: 'exact' },
    { merchant: '', price: 5, match: 'exact' },
    { price: 5, match: 'exact' },
    null,
    { merchant: 'C', price: 0, match: 'exact' },
    { merchant: 'D', price: -1, match: 'exact' },
    { merchant: 'E', price: NaN, match: 'exact' },
    { merchant: 'F', price: 300, match: 'similar' },
  ];
  const r = validateMockOffers(offers, 250);
  assert.equal(r.sampleSize, 2);
  assert.equal(r.qualified, false);
  assert.equal(r.reference, 150);
  assert.equal(r.difference, 100);
  assert.equal(r.simulated, true);
  assert.equal(validateMockOffers([], 250).reference, null);
});
