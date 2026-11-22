import { dateSchema } from '../../../../shared/schemas/index.js';
import { localDate, shiftDate } from '../../../../shared/dates.js';
import { classifyItem } from './classification-rules.js';

export function parseQuickEntry(
  text,
  { expenseDate = localDate(), rules } = {},
) {
  if (typeof text !== 'string' || !text.trim())
    throw new Error('請輸入至少一行消費');
  if (text.length > 4000) throw new Error('文字超過 4000 字，請分批處理');
  dateSchema.parse(expenseDate);
  const lines = text
    .split(/\r?\n/)
    .map((raw, index) => ({ raw: raw.trim(), lineNumber: index + 1 }))
    .filter((line) => line.raw);
  if (lines.length > 50) throw new Error('每次最多預覽 50 筆，請分批處理');
  return lines.map(({ raw, lineNumber }) => {
    let source = raw.normalize('NFKC');
    let date = expenseDate;
    const issues = [];
    const prefix = source.match(/^(\d{4}-\d{2}-\d{2}|今天|昨天|前天)\s*/);
    if (prefix) {
      source = source.slice(prefix[0].length);
      date = prefix[1].includes('-')
        ? prefix[1]
        : shiftDate(
            expenseDate,
            prefix[1] === '昨天' ? -1 : prefix[1] === '前天' ? -2 : 0,
          );
      if (!dateSchema.safeParse(date).success) {
        date = '';
        issues.push('日期不存在，請自行選擇');
      }
    } else if (
      /^(上週|上周|本週|下週|星期|週[一二三四五六日天]|周[一二三四五六日天]|明天)/.test(
        source,
      )
    ) {
      date = '';
      issues.push('相對日期不明確，請自行選擇');
    }
    const match = source.match(
      /^(.+?)\s*(?:(?:NT\$|TWD|新台幣|\$)\s*)?([+-]?\d[\d,]*(?:\.\d+)?)\s*(?:元|塊)?$/i,
    );
    let item = match?.[1].trim() || source;
    let amount = '';
    if (match && /[^\d\s,.$+-]/.test(item)) {
      const valid = /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)$/.test(match[2]);
      const number = Number(match[2].replaceAll(',', ''));
      if (valid && Number.isSafeInteger(number) && number > 0) amount = number;
      else issues.push('金額必須是安全範圍內的正整數 TWD');
      if (
        /(?:^|\s)[+-]?\d+(?:[,.]\d+)*(?=\s|元|塊|$)/.test(item) ||
        /[+*/=]\s*$/.test(item)
      ) {
        amount = '';
        issues.push('每行請只填一筆金額；請核對品項與金額');
      }
    } else {
      issues.push('未辨識完整品項與金額，請補填');
      item = source;
    }
    const classification = classifyItem(item, rules);
    if (classification.status === 'conflict')
      issues.push(
        `分類衝突：${classification.matches.map((match) => match.category).join('、')}；請自行選擇`,
      );
    if (classification.status === 'unmatched')
      issues.push('無法判定分類，請自行選擇（可選其他）');
    return {
      raw,
      lineNumber,
      draft: {
        item,
        amount,
        category: classification.category,
        expenseDate: date,
      },
      classification,
      issues,
    };
  });
}
