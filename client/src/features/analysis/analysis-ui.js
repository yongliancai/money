import {
  sevenDayComparison,
  monthToDateComparison,
  historicalComparison,
  MOCK_OFFERS,
  validateMockOffers,
} from './analysis.js';
import { localDate } from '../../../../shared/dates.js';

const fmt = (n) =>
  Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const addText = (parent, tag, text, className) =>
  parent.append(el(tag, text, className));
function row(label, value) {
  const r = el('div', undefined, 'analysis-row');
  addText(r, 'span', label);
  addText(r, 'strong', value);
  return r;
}
const labelFor = (e) => `${e.expenseDate} · ${e.item} · NT$${fmt(e.amount)}`;

export function createAnalysisUI(ledger, onSuccess, onFailure) {
  const $ = (id) => document.getElementById(id);
  const state = { mode: 'week', marketId: '', marketShown: false };
  const fail = (error) => onFailure(error.message || '分析操作失敗');
  function option(select, value, text) {
    const item = el('option', text);
    item.value = value;
    select.append(item);
  }
  function setOptions(id, expenses, old) {
    const input = $(id);
    input.replaceChildren();
    option(input, '', '請選擇一筆紀錄');
    for (const e of expenses) option(input, e.id, labelFor(e));
    input.value = expenses.some((e) => e.id === old) ? old : '';
  }
  async function render() {
    const expenses = (await ledger.list()).sort(
      (a, b) =>
        a.expenseDate.localeCompare(b.expenseDate) ||
        a.createdAt.localeCompare(b.createdAt),
    );
    const zeroDates = await ledger.zeroDays();
    const links = await ledger.productLinks();
    const today = localDate();
    const result =
      state.mode === 'week'
        ? sevenDayComparison(expenses, zeroDates, today)
        : monthToDateComparison(expenses, zeroDates, today);
    const info = $('analysis-period-summary');
    info.replaceChildren();
    const p = result.previous;
    const c = result.current;
    info.append(row('本期已記錄支出', 'NT$' + fmt(c.total)));
    info.append(row('前期已記錄支出', 'NT$' + fmt(p.total)));
    info.append(
      row(
        '支出差額',
        (result.difference > 0 ? '+' : '') + 'NT$' + fmt(result.difference),
      ),
    );
    info.append(
      row(
        '本期確認日期覆蓋率',
        `${c.covered}/${c.days} 天（${Math.round(c.coverage * 100)}%）`,
      ),
    );
    info.append(
      row(
        '前期確認日期覆蓋率',
        `${p.covered}/${p.days} 天（${Math.round(p.coverage * 100)}%）`,
      ),
    );
    const note =
      result.status === 'eligible'
        ? '兩期覆蓋率均達 90%，可以觀察已記錄支出趨勢；這不等於實際儲蓄增加。'
        : result.status === 'preliminary'
          ? '至少一期未達 90%，僅顯示初步變化，不評級。'
          : '至少一期覆蓋率低於 70%，資料不足，不提供趨勢評級。';
    addText(info, 'p', note, 'analysis-note');
    const cats = $('analysis-categories');
    cats.replaceChildren();
    for (const e of result.categories)
      cats.append(
        row(e.name, `本期 NT$${fmt(e.current)} ／ 前期 NT$${fmt(e.previous)}`),
      );
    if (!result.categories.length)
      addText(cats, 'p', '這個期間沒有分類資料。', 'analysis-note');
    // Render two independently selected history records. No automatic fuzzy merge.
    const current = $('analysis-product-current').value;
    const previous = $('analysis-product-previous').value;
    setOptions('analysis-product-current', expenses, current);
    setOptions('analysis-product-previous', expenses, previous);
    const currentRecord = expenses.find(
      (e) => e.id === $('analysis-product-current').value,
    );
    const linked = currentRecord
      ? historicalComparison(expenses, links, currentRecord.id)
      : null;
    const history = $('analysis-history-result');
    history.replaceChildren();
    if (linked) {
      history.append(row('已確認的歷史紀錄', linked.count + ' 筆'));
      if (linked.reference !== null) {
        history.append(
          row('歷史交易金額中位數', 'NT$' + fmt(linked.reference)),
        );
        history.append(
          row(
            '本次交易差額',
            (linked.delta > 0 ? '+' : '') + 'NT$' + fmt(linked.delta),
          ),
        );
      }
      addText(
        history,
        'p',
        linked.rating
          ? `交易金額比較：${linked.rating}（${linked.percent.toFixed(1)}%）。`
          : '歷史不足 5 筆，不顯示評級。',
        'analysis-note',
      );
      addText(history, 'p', linked.warning, 'analysis-note');
    } else {
      addText(
        history,
        'p',
        '請選擇本次消費，再確認另一筆相同商品與相同規格的歷史紀錄；不會自動把相似文字當成同商品。',
        'analysis-note',
      );
    }
    const marketSelected = $('analysis-market-product').value;
    setOptions('analysis-market-product', expenses, marketSelected);
    if (state.marketShown && expenses.some((e) => e.id === state.marketId))
      showMock(expenses.find((e) => e.id === state.marketId));
    else $('analysis-market-result').replaceChildren();
    $('analysis-zero-date').max = today;
    if (!$('analysis-zero-date').value) $('analysis-zero-date').value = today;
    $('analysis-zero-list').textContent = zeroDates.length
      ? '已確認零支出日期：' + zeroDates.sort().join('、')
      : '尚未確認零支出日期。';
  }
  function showMock(record) {
    const panel = $('analysis-market-result');
    panel.replaceChildren();
    const mock = validateMockOffers(MOCK_OFFERS, record.amount);
    addText(panel, 'strong', '【模擬資料，非 Google 即時價格】');
    addText(
      panel,
      'p',
      '使用固定測試報價展示介面與算法。未連接任何付費價格 API。',
      'analysis-note',
    );
    for (const x of MOCK_OFFERS)
      panel.append(row(x.merchant, 'NT$' + fmt(x.price)));
    panel.append(row('示範報價中位數', 'NT$' + fmt(mock.reference)));
    panel.append(
      row(
        '與此筆消費差額',
        (mock.difference > 0 ? '+' : '') + 'NT$' + fmt(mock.difference),
      ),
    );
    addText(
      panel,
      'p',
      '僅為 UI 測試，商品規格未核對，不提供真實市場評級。',
      'analysis-note',
    );
  }
  async function action(operation) {
    try {
      await operation();
      await render();
      onSuccess();
    } catch (error) {
      fail(error);
    }
  }
  function mount() {
    $('analysis-period-mode').addEventListener('change', async (e) => {
      state.mode = e.target.value;
      await render();
    });
    $('analysis-product-current').addEventListener(
      'change',
      () => void render().catch(fail),
    );
    $('analysis-product-previous').addEventListener(
      'change',
      () => void render().catch(fail),
    );
    $('analysis-confirm-match').addEventListener('click', () =>
      action(async () => {
        const currentId = $('analysis-product-current').value;
        const previousId = $('analysis-product-previous').value;
        if (!currentId || !previousId || currentId === previousId)
          throw new Error('請選擇兩筆不同紀錄');
        const records = await ledger.list();
        const current = records.find((e) => e.id === currentId);
        const previous = records.find((e) => e.id === previousId);
        if (!current || !previous) throw new Error('紀錄不存在');
        if (previous.expenseDate >= current.expenseDate)
          throw new Error('比較紀錄必須早於本次消費日期');
        if (
          !window.confirm(
            '你確認這兩筆是完全相同商品、相同容量、數量與購買規格嗎？目前僅比較整筆交易金額。',
          )
        )
          return;
        await ledger.linkProducts([currentId, previousId]);
      }),
    );
    $('analysis-unlink').addEventListener('click', () =>
      action(async () => {
        const id = $('analysis-product-current').value;
        if (!id) throw new Error('請先選擇紀錄');
        await ledger.unlinkProduct(id);
      }),
    );
    $('analysis-confirm-zero').addEventListener('click', () =>
      action(async () => {
        const date = $('analysis-zero-date').value;
        if (!date || !window.confirm(`確認 ${date} 當天沒有任何消費嗎？`))
          return;
        await ledger.confirmZeroSpend(date);
      }),
    );
    $('analysis-cancel-zero').addEventListener('click', () =>
      action(async () => {
        const date = $('analysis-zero-date').value;
        if (!date) throw new Error('請選擇日期');
        await ledger.clearZeroSpend(date);
      }),
    );
    $('analysis-market-run').addEventListener('click', () => {
      const id = $('analysis-market-product').value;
      if (!id) {
        onFailure('請先選擇記帳紀錄');
        return;
      }
      state.marketShown = true;
      state.marketId = id;
      void render().catch(fail);
    });
  }
  return { mount, render };
}
