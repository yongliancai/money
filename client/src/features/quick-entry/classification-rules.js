// One category match suggests a value; multiple categories never use priority guessing.
export const CATEGORIES = Object.freeze([
  '餐飲',
  '交通',
  '購物',
  '娛樂',
  '學習',
  '生活',
  '其他',
]);
export const CATEGORY_RULES = Object.freeze(
  [
    {
      category: '餐飲',
      keywords: [
        '早餐',
        '午餐',
        '晚餐',
        '宵夜',
        '蛋餅',
        '便當',
        '餐廳',
        '咖啡',
        '奶茶',
        '飲料',
        '飯',
        '麵',
        '小吃',
      ],
    },
    {
      category: '交通',
      keywords: [
        '捷運',
        '公車',
        '計程車',
        '高鐵',
        '火車',
        '車票',
        '停車',
        '加油',
        'uber',
        'ubike',
        'youbike',
      ],
    },
    {
      category: '購物',
      keywords: [
        '全聯',
        '超市',
        '超商',
        '百貨',
        '購物',
        '網購',
        '衣服',
        '鞋子',
        '蝦皮',
      ],
    },
    {
      category: '娛樂',
      keywords: ['電影', '遊戲', '演唱會', '展覽', 'netflix', 'spotify', 'ktv'],
    },
    {
      category: '學習',
      keywords: ['書', '課本', '文具', '課程', '學費', '補習', '學習', '讀書'],
    },
    {
      category: '生活',
      keywords: [
        '房租',
        '水電',
        '電費',
        '水費',
        '電話費',
        '網路費',
        '洗衣',
        '日用品',
        '衛生紙',
      ],
    },
  ].map((rule) =>
    Object.freeze({ ...rule, keywords: Object.freeze(rule.keywords) }),
  ),
);

export function classifyItem(item, rules = CATEGORY_RULES) {
  const normalized = item.normalize('NFKC').toLowerCase();
  const matches = rules
    .map((rule) => ({
      category: rule.category,
      keywords: rule.keywords.filter((word) => {
        const keyword = word.normalize('NFKC').toLowerCase();
        if (/^[a-z0-9]+$/.test(keyword))
          return new RegExp(`(^|[^a-z0-9])${keyword}($|[^a-z0-9])`).test(
            normalized,
          );
        return normalized.includes(keyword);
      }),
    }))
    .filter((match) => match.keywords.length);
  const categories = [...new Set(matches.map((match) => match.category))];
  return {
    category: categories.length === 1 ? categories[0] : '',
    status:
      categories.length === 1
        ? 'matched'
        : categories.length
          ? 'conflict'
          : 'unmatched',
    matches,
  };
}
