import { aiResultSchema } from '../../../shared/schemas/index.js';
import { shiftDate } from '../../../shared/dates.js';

// A deterministic demonstration adapter. It is never presented as a real AI model.
export function demoParse(text, referenceDate) {
  const drafts = [];
  const unparsed = [];
  for (const part of text
    .split(/[、，,；;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const match = part.match(
      /^(?:(今天|昨天|前天)|(\d{4}-\d{2}-\d{2}))?\s*(.+?)\s*(\d+)\s*(?:元|塊)?$/,
    );
    if (!match) {
      unparsed.push(part);
      continue;
    }
    const [, relative, absolute, item, amount] = match;
    const expenseDate =
      absolute ||
      shiftDate(
        referenceDate,
        relative === '昨天' ? -1 : relative === '前天' ? -2 : 0,
      );
    const category = /餐|飯|麵|早餐/.test(item)
      ? '餐飲'
      : /咖啡|茶|飲/.test(item)
        ? '飲品'
        : /車|捷運|公車/.test(item)
          ? '交通'
          : '其他';
    drafts.push({
      item: item.trim(),
      amount: Number(amount),
      category,
      expenseDate,
    });
  }
  return aiResultSchema.parse({ drafts, unparsed });
}
export function createParser(mode) {
  if (mode === 'demo')
    return async ({ text, referenceDate }) => ({
      ...demoParse(text, referenceDate),
      mode: 'demo',
    });
  return async () => {
    const error = new Error(
      '真實 AI 服務尚未設定；可改用手動記帳。展示解析需在本機明確開啟。',
    );
    error.status = 503;
    throw error;
  };
}
