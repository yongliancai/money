// Local-only analysis. Never labels mock offers as real market data.
const day = (s) => new Date(s + 'T12:00:00Z');
export const dateAt = (date, offset) => {
  const d = day(date);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
export const normaliseItem = (name) =>
  String(name || '').normalize('NFKC').toLowerCase().replace(/[\\s，,。、()（）·・_-]/g, '');
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}
export function historicalComparison(expenses, links, expenseId) {
  const target = expenses.find((e) => e.id === expenseId);
  if (!target) return null;
  const productId = links[expenseId];
  const historical = productId
    ? expenses.filter((e) => e.id !== expenseId && links[e.id] === productId && e.expenseDate < target.expenseDate)
    : [];
  // Existing records do not contain a verified quantity/unit. Compare transaction totals only.
  // A future unit-price score must require confirmed identical pack size and quantity.
  const prices = historical.map((e) => e.amount).filter(Number.isFinite);
  const reference = median(prices);
  const delta = reference === null ? null : target.amount - reference;
  return {
    target, count: prices.length, reference, delta,
    percent: reference ? (delta / reference) * 100 : null,
    rating: prices.length >= 5
      ? (Math.abs(delta / reference) <= .1 ? '接近歷史價格' : delta > 0 ? '相對偏高' : '相對便宜')
      : null,
    historical,
    warning: '目前帳本未記錄數量及容量，僅能比較整筆交易金額；請確認數量與規格一致。',
  };
}
const inclusiveDays = (start, end) => {
  const list = [];
  for (let d = start; d <= end; d = dateAt(d, 1)) list.push(d);
  return list;
};
export function periodSummary(expenses, zeroDates, start, end) {
  const records = expenses.filter((e) => e.expenseDate >= start && e.expenseDate <= end);
  const included = new Set(records.map((e) => e.expenseDate));
  for (const date of zeroDates) if (date >= start && date <= end) included.add(date);
  const days = inclusiveDays(start, end);
  const categories = {};
  for (const e of records) categories[e.category] = (categories[e.category] || 0) + e.amount;
  return {
    start, end, total: records.reduce((n, e) => n + e.amount, 0),
    count: records.length, covered: days.filter((d) => included.has(d)).length,
    days: days.length, coverage: days.length ? included.size / days.length : 0,
    categories,
  };
}
export function comparePeriods(expenses, zeroDates, currentStart, currentEnd, previousStart, previousEnd) {
  const current = periodSummary(expenses, zeroDates, currentStart, currentEnd);
  const previous = periodSummary(expenses, zeroDates, previousStart, previousEnd);
  const min = Math.min(current.coverage, previous.coverage);
  const status = min >= .9 ? 'eligible' : min >= .7 ? 'preliminary' : 'insufficient';
  return {
    current, previous, status, difference: current.total - previous.total,
    percent: previous.total > 0 ? ((current.total - previous.total) / previous.total) * 100 : null,
    categories: [...new Set([...Object.keys(current.categories), ...Object.keys(previous.categories)])]
      .map((name) => ({ name, current: current.categories[name] || 0, previous: previous.categories[name] || 0 })),
  };
}
export function sevenDayComparison(expenses, zeroDates, today) {
  return comparePeriods(expenses, zeroDates, dateAt(today, -6), today, dateAt(today, -13), dateAt(today, -7));
}
export function monthToDateComparison(expenses, zeroDates, today) {
  const dayNumber = Number(today.slice(8, 10));
  const previousMonthLast = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0));
  const previousEndDay = Math.min(dayNumber, previousMonthLast.getUTCDate());
  const prevMonth = previousMonthLast.toISOString().slice(0, 7);
  const previousEnd = prevMonth + '-' + String(previousEndDay).padStart(2, '0');
  const currentStart = today.slice(0, 7) + '-01';
  const previousStart = prevMonth + '-01';
  const currentEnd = dateAt(currentStart, previousEndDay - 1);
  // Match same day count where possible, while making truncated comparison explicit in the UI.
  return comparePeriods(expenses, zeroDates, currentStart, currentEnd, previousStart, previousEnd);
}
export function validateMockOffers(offers, ownPrice) {
  const valid = offers.filter((o) => Number.isSafeInteger(o.price) && o.price > 0 && o.match === 'exact');
  const merchants = new Map();
  for (const offer of valid) if (!merchants.has(offer.merchant)) merchants.set(offer.merchant, offer.price);
  const values = [...merchants.values()];
  const reference = median(values);
  return { sampleSize: values.length, reference, qualified: values.length >= 3,
    difference: reference === null ? null : ownPrice - reference,
    simulated: true };
}
export const MOCK_OFFERS = [
  { merchant: '示範商家 A', title: '規格一致的示範商品', price: 680, match: 'exact' },
  { merchant: '示範商家 B', title: '規格一致的示範商品', price: 760, match: 'exact' },
  { merchant: '示範商家 C', title: '規格一致的示範商品', price: 820, match: 'exact' },
];
