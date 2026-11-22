import './style.css';
import { openLedger, monthStats, exportCSV } from './storage/ledger.js';
import { createSync } from './services/sync.js';
import { createApi } from './services/api.js';
import { aiResultSchema } from '../../shared/schemas/index.js';
import {
  pushCapabilities,
  subscribePush,
  unsubscribePush,
} from './services/push.js';
import { localDate } from '../../shared/dates.js';
import { CATEGORIES } from './features/quick-entry/classification-rules.js';
import { parseQuickEntry } from './features/quick-entry/parser.js';
import { createAnalysisUI } from './features/analysis/analysis-ui.js';

const $ = (id) => document.getElementById(id);
const money = (n) => n.toLocaleString('zh-TW');
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
let ledger;
let sync;
let editId = null;
let pending = null;
let deleteId = null;
let config = null;
let confirming = false;
let quickDateEdited = false;
let analysisUI;
const pagesV1 = import.meta.env.MODE === 'pages';
const api = createApi(
  pagesV1
    ? {
        basePath: import.meta.env.BASE_URL,
        apiBase: null,
        backendEnabled: false,
      }
    : undefined,
);
function backendState(reason, available = null) {
  config = available;
  $('ai-mode').textContent = reason;
  $('parse-button').disabled = !available || available.aiMode === 'disabled';
  $('subscribe-push').disabled = !available?.pushReady;
  $('unsubscribe-push').disabled = !available;
  for (const id of ['sync-now', 'revoke-device', 'reactivate-device'])
    $(id).disabled = !api.backendEnabled;
  const capabilities = pushCapabilities();
  $('push-status').textContent = !available
    ? reason
    : !available.pushReady
      ? '後端尚未啟用推播服務；提醒設定僅儲存在本機。'
      : !capabilities.push || !capabilities.secure
        ? '目前瀏覽器無法使用推播；iPhone 請使用 Safari 加入主畫面後開啟。'
        : '可點擊訂閱通知；iPhone 請先加入主畫面。實際送達仍需驗證。';
  document.querySelector('.environment').textContent = pagesV1
    ? '第一版 · 本機規則記帳'
    : available?.aiMode === 'demo'
      ? '展示解析 · 非真實 AI'
      : api.backendEnabled
        ? '本機帳本 · 後端選用'
        : '本機記帳版 · 尚未連接後端';
}
function message(text, error = false) {
  $('message').textContent = text;
  $('message').className = error ? 'error' : '';
  $('message').hidden = false;
}
function bind(id, event, fn) {
  $(id).addEventListener(event, async (e) => {
    try {
      await fn(e);
    } catch (error) {
      message(friendly(error), true);
    }
  });
}
function friendly(error) {
  return error.name === 'ZodError'
    ? '欄位格式有誤，請檢查正整數金額、日期與必填欄位。'
    : error.message || '操作失敗，請重試。';
}
function draftFromForm() {
  return {
    item: $('item').value,
    amount: Number($('amount').value),
    category: $('category').value,
    expenseDate: $('expense-date').value,
  };
}
async function syncNow() {
  if (!api.backendEnabled) {
    const reason =
      '此版本尚未連接後端；AI 與推播暫不可用，手動記帳與備份正常。';
    backendState(reason);
    $('connection').textContent = navigator.onLine
      ? '本機帳本 · 無後端模式'
      : '離線 · 帳本可用';
    $('sync-status').textContent =
      '提醒設定與待同步狀態保留在本機，接入後端後才會同步。';
    return;
  }
  $('connection').textContent = navigator.onLine
    ? '狀態同步中'
    : '離線 · 帳本可用';
  if (!navigator.onLine) {
    backendState('目前離線；AI 與推播暫不可用，手動記帳正常。');
    $('sync-status').textContent = '離線中，提醒狀態將在重新連線後同步。';
    return;
  }
  try {
    const remote = await api.configuration();
    backendState(
      remote.aiMode === 'demo'
        ? '展示解析 · 非真實 AI，結果須確認'
        : remote.aiMode === 'disabled'
          ? '後端尚未啟用 AI；請使用手動記帳。'
          : 'AI 解析結果須由你確認。',
      remote,
    );
    const result = await sync.sync();
    $('sync-status').textContent =
      `提醒狀態同步完成；待同步 ${result.pending} 筆。`;
    $('connection').textContent = '本機帳本 · 已連線';
  } catch (error) {
    backendState(friendly(error));
    $('connection').textContent = '本機帳本 · 同步待重試';
    $('sync-status').textContent = `${friendly(error)}。帳本仍可使用。`;
  }
}
function openExpense(record) {
  editId = record?.id || null;
  $('expense-dialog-title').textContent = editId ? '編輯記帳' : '新增記帳';
  $('item').value = record?.item || '';
  $('amount').value = record?.amount || '';
  $('category').value = record?.category || '其他';
  $('expense-date').value = record?.expenseDate || localDate();
  $('expense-dialog').showModal();
  $('item').focus();
}
async function render() {
  if (!quickDateEdited) $('quick-date').value = localDate();
  const all = await ledger.list();
  const month = $('month').value;
  const stats = monthStats(all, month);
  $('month-total').textContent = money(stats.total);
  $('month-count').textContent = `${stats.records.length} 筆記錄`;
  const isCompleted = await ledger.isCompleted();
  $('completion-title').textContent = isCompleted
    ? '今天已完成記帳'
    : '今天還沒記帳';
  $('settings-completion-title').textContent =
    $('completion-title').textContent;
  $('completion-detail').textContent = isCompleted
    ? '小小的紀錄，也是照顧自己的方式。'
    : '記下第一筆，替今天留個紀錄。';
  document
    .querySelector('.completion-card')
    .classList.toggle('completed', isCompleted);
  const categories = [...new Set(all.map((e) => e.category))].sort();
  const selected = $('category-filter').value;
  $('category-filter').replaceChildren(node('option', '全部分類'));
  $('category-filter').firstChild.value = '';
  for (const category of categories) {
    const option = node('option', category);
    option.value = category;
    $('category-filter').append(option);
  }
  $('category-filter').value = categories.includes(selected) ? selected : '';
  const filtered = stats.records
    .filter(
      (e) =>
        e.item.toLowerCase().includes($('search').value.toLowerCase()) &&
        (!$('category-filter').value ||
          e.category === $('category-filter').value),
    )
    .sort(
      (a, b) =>
        b.expenseDate.localeCompare(a.expenseDate) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  $('records-count').textContent = `${filtered.length} 筆`;
  $('records').replaceChildren();
  if (!filtered.length) {
    const empty = node('div', undefined, 'empty');
    empty.append(
      node('span', '▤', 'empty-symbol'),
      node(
        'p',
        all.length
          ? '這個月份或篩選條件沒有紀錄。'
          : '還沒有紀錄，從第一筆日常開始。',
      ),
    );
    $('records').append(empty);
  }
  for (const record of filtered) {
    const row = node('article', undefined, 'record');
    row.append(node('span', record.category.slice(0, 1), 'record-icon'));
    const main = node('div', undefined, 'record-main');
    main.append(
      node('strong', record.item),
      node('small', `${record.expenseDate} · ${record.category}`),
    );
    row.append(main, node('span', `$${money(record.amount)}`, 'record-amount'));
    const actions = node('div', undefined, 'record-actions');
    const edit = node('button', '編輯');
    edit.setAttribute('aria-label', `編輯 ${record.item}`);
    edit.onclick = () => openExpense(record);
    const remove = node('button', '刪除');
    remove.setAttribute('aria-label', `刪除 ${record.item}`);
    remove.onclick = () => {
      deleteId = record.id;
      $('delete-label').textContent =
        `${record.item} · NT$ ${money(record.amount)}`;
      $('delete-dialog').showModal();
    };
    actions.append(edit, remove);
    row.append(actions);
    $('records').append(row);
  }
  $('categories').replaceChildren();
  if (!stats.categories.length)
    $('categories').append(
      node('p', '開始記帳後，這裡會顯示分類統計。', 'empty'),
    );
  for (const [category, total] of stats.categories.sort((a, b) =>
    a[1] > b[1] ? -1 : 1,
  )) {
    const row = node('div', undefined, 'category-row');
    const title = node('div', undefined, 'category-title');
    title.append(node('span', category), node('strong', `$${money(total)}`));
    const track = node('div', undefined, 'bar-track');
    const progress = node('progress');
    progress.max = 100;
    progress.value = Number((total * 100n) / stats.total);
    progress.setAttribute('aria-label', `${category}占比`);
    track.append(progress);
    row.append(title, track);
    $('categories').append(row);
  }
  if (analysisUI) await analysisUI.render();
}
function clearPreview() {
  if (pending?.token) ledger.cancel(pending.token);
  pending = null;
  $('preview-dialog').close();
}
function draftField(label, key, value, type = 'text') {
  const field = node('label', label);
  const input = node('input');
  input.dataset.field = key;
  input.type = type;
  input.value = value;
  input.required = true;
  if (type === 'number') {
    input.min = '1';
    input.step = '1';
    input.max = String(Number.MAX_SAFE_INTEGER);
  }
  if (key === 'item') input.maxLength = 100;
  if (key === 'category') input.maxLength = 40;
  field.append(input);
  return field;
}
function showDrafts(preview, unparsed = []) {
  pending = { ...preview, type: 'ai' };
  $('preview-title').textContent = '確認解析結果';
  $('preview-note').textContent =
    `${config?.aiMode === 'demo' ? '展示模式（非真實 AI）。' : ''}請核對每筆金額與日期。${unparsed.length ? `未解析內容：${unparsed.join('；')}，請另用手動記帳。` : ''}`;
  $('preview-rows').replaceChildren();
  for (const draft of preview.drafts) {
    const row = node('div', undefined, 'preview-row');
    row.append(
      draftField('品項', 'item', draft.item),
      draftField('金額（TWD）', 'amount', draft.amount, 'number'),
      draftField('消費日期', 'expenseDate', draft.expenseDate, 'date'),
      draftField('分類', 'category', draft.category),
    );
    $('preview-rows').append(row);
  }
  $('confirm-preview').textContent = '確認儲存這些紀錄';
  $('preview-dialog').showModal();
}
function showQuickEntry(candidates) {
  pending = { type: 'quick' };
  $('preview-title').textContent = '確認快速記帳';
  $('preview-note').textContent =
    `共 ${candidates.length} 筆候選；尚未儲存。請核對品項、金額、日期與分類，所有必填欄位完成後才能確認。`;
  $('preview-rows').replaceChildren();
  for (const candidate of candidates) {
    const row = node('div', undefined, 'preview-row');
    row.append(
      node('p', `第 ${candidate.lineNumber} 行：${candidate.raw}`, 'muted'),
    );
    if (candidate.issues.length)
      row.append(node('p', candidate.issues.join('；'), 'preview-warning'));
    row.append(
      draftField('品項', 'item', candidate.draft.item),
      draftField('金額（TWD）', 'amount', candidate.draft.amount, 'number'),
      draftField(
        '消費日期',
        'expenseDate',
        candidate.draft.expenseDate,
        'date',
      ),
    );
    const label = node('label', '分類');
    const select = node('select');
    select.dataset.field = 'category';
    select.required = true;
    select.setAttribute('aria-label', `第 ${candidate.lineNumber} 筆分類`);
    const placeholder = node('option', '請自行選擇分類');
    placeholder.value = '';
    select.append(placeholder);
    for (const category of CATEGORIES) {
      const option = node('option', category);
      option.value = category;
      select.append(option);
    }
    select.value = candidate.draft.category;
    label.append(select);
    row.append(label);
    $('preview-rows').append(row);
  }
  $('confirm-preview').textContent = '確認儲存這些紀錄';
  $('preview-dialog').showModal();
}
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = node('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function init() {
  $('backend-ai').hidden = pagesV1;
  $('backend-settings').hidden = pagesV1;
  ledger = await openLedger(undefined, undefined, () =>
    message(
      '帳本升級正在等待其他舊版分頁關閉；請關閉其他日日記分頁，資料不會被刪除。',
      true,
    ),
  );
  analysisUI = createAnalysisUI(
    ledger,
    () => {
      message('消費分析資料已更新。');
      void render().catch((error) => message(friendly(error), true));
      void syncNow();
    },
    (text) => message(text, true),
  );
  analysisUI.mount();
  sync = createSync(ledger, api.fetch, {
    identityScope: api.apiBase === '/' ? '' : api.apiBase || 'disabled',
  });
  $('month').value = localDate().slice(0, 7);
  $('today-label').textContent = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  const settings = await ledger.settings();
  $('reactivate-device').hidden = !(await sync.isRevoked());
  $('reminder-enabled').checked = settings.enabled;
  $('reminder-time').value = settings.time;
  $('reminder-zone').value = settings.timeZone;
  for (const button of document.querySelectorAll('[data-view]'))
    button.addEventListener('click', () => {
      for (const section of document.querySelectorAll('.view'))
        section.hidden = section.id !== button.dataset.view;
      for (const nav of document.querySelectorAll('[data-view]')) {
        nav.classList.toggle('active', nav === button);
        if (nav === button) nav.setAttribute('aria-current', 'page');
        else nav.removeAttribute('aria-current');
      }
    });
  bind('add-manual', 'click', () => openExpense());
  bind('today-zero-button', 'click', async () => {
    if (!window.confirm('確認今天完全沒有消費嗎？若當天已有紀錄則無法確認。'))
      return;
    await ledger.confirmZeroSpend();
    message('已確認今天沒有消費，記帳完成狀態已更新。');
    await render();
    void syncNow();
  });
  bind('quick-date', 'input', () => {
    quickDateEdited = true;
  });
  bind('quick-form', 'submit', (event) => {
    event.preventDefault();
    showQuickEntry(
      parseQuickEntry($('quick-input').value, {
        expenseDate: $('quick-date').value,
      }),
    );
  });
  bind('close-expense', 'click', () => $('expense-dialog').close());
  bind('expense-form', 'submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      if (editId) await ledger.update(editId, draftFromForm());
      else {
        const preview = ledger.preview([draftFromForm()], 'manual');
        await ledger.confirm(preview.token);
      }
      $('expense-dialog').close();
      message('已儲存在本機帳本。');
      await render();
      void syncNow();
    } finally {
      button.disabled = false;
    }
  });
  bind('ai-form', 'submit', async (event) => {
    event.preventDefault();
    $('parse-button').disabled = true;
    try {
      const result = await sync.request('/api/ai/parse', 'POST', {
        text: $('ai-input').value,
        referenceDate: localDate(),
      });
      aiResultSchema.parse({
        drafts: result.drafts,
        unparsed: result.unparsed,
      });
      if (!result.drafts.length) {
        message(
          `無法解析：${result.unparsed.join('；')}。請使用手動記帳。`,
          true,
        );
        return;
      }
      showDrafts(ledger.preview(result.drafts), result.unparsed);
    } finally {
      $('parse-button').disabled = !config || config.aiMode === 'disabled';
    }
  });
  bind('close-preview', 'click', clearPreview);
  bind('cancel-preview', 'click', clearPreview);
  $('preview-dialog').addEventListener('cancel', clearPreview);
  bind('preview-form', 'submit', async (event) => {
    event.preventDefault();
    if (!pending || confirming) return;
    confirming = true;
    $('confirm-preview').disabled = true;
    try {
      if (pending.type === 'import') {
        const count = await ledger.confirmImport(pending.token);
        message(`已合併 ${count} 筆，匯入不計入今日完成。`);
      } else {
        const drafts = [...document.querySelectorAll('.preview-row')].map(
          (row) =>
            Object.fromEntries(
              [...row.querySelectorAll('[data-field]')].map((input) => [
                input.dataset.field,
                input.type === 'number' ? Number(input.value) : input.value,
              ]),
            ),
        );
        const token =
          pending.type === 'quick'
            ? ledger.preview(drafts, 'manual').token
            : pending.token;
        await ledger.confirm(token, drafts);
        message('已確認並儲存。');
      }
      pending = null;
      $('preview-dialog').close();
      await render();
      void syncNow();
    } finally {
      confirming = false;
      $('confirm-preview').disabled = false;
    }
  });
  bind('cancel-delete', 'click', () => $('delete-dialog').close());
  bind('confirm-delete', 'click', async () => {
    if (!deleteId) return;
    await ledger.remove(deleteId);
    deleteId = null;
    $('delete-dialog').close();
    message('已刪除紀錄。');
    await render();
    void syncNow();
  });
  for (const id of ['month', 'search', 'category-filter'])
    bind(id, id === 'search' ? 'input' : 'change', render);
  bind('export-json', 'click', async () =>
    download(
      `日日記-${localDate()}.json`,
      JSON.stringify(await ledger.exportJSON(), null, 2),
      'application/json',
    ),
  );
  bind('export-csv', 'click', async () =>
    download(
      `日日記-${localDate()}.csv`,
      exportCSV(await ledger.list()),
      'text/csv;charset=utf-8',
    ),
  );
  bind('import-file', 'change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('備份超過 10 MB');
      const preview = await ledger.previewImport(await file.text());
      pending = { ...preview, type: 'import' };
      $('preview-title').textContent = '預覽合併匯入';
      $('preview-note').textContent =
        `新增 ${preview.added.length} 筆；跳過重複 ${preview.duplicates} 筆；恢復曾刪除 ${preview.restored.length} 筆。零支出 ${preview.zeroDays.length} 日、商品對應 ${preview.productLinkCount} 筆候選；衝突及既有資料將保留本機版本。匯入不計入今日完成。`;
      $('preview-rows').replaceChildren();
      const restored = new Set(preview.restored.map((r) => r.id));
      for (const zero of preview.zeroDays)
        $('preview-rows').append(
          node(
            'p',
            `【零支出候選】${zero.date}（今天不匯入，有消費或既有確認時略過）`,
            'import-row',
          ),
        );
      for (const record of preview.added)
        $('preview-rows').append(
          node(
            'p',
            `${restored.has(record.id) ? '【恢復】 ' : ''}${record.expenseDate} · ${record.item} · $${money(record.amount)}`,
            'import-row',
          ),
        );
      $('confirm-preview').textContent = '確認合併匯入';
      $('preview-dialog').showModal();
    } finally {
      event.target.value = '';
    }
  });
  bind('settings-form', 'submit', async (event) => {
    event.preventDefault();
    await ledger.saveSettings({
      enabled: $('reminder-enabled').checked,
      time: $('reminder-time').value,
      timeZone: $('reminder-zone').value,
    });
    message('設定已儲存；正式提醒仍等待策略定案。');
    await render();
    await syncNow();
  });
  bind('subscribe-push', 'click', async () => {
    await subscribePush(sync, config, api.basePath);
    $('push-status').textContent = '已建立訂閱，正式提醒仍受策略與狀態限制。';
  });
  bind('unsubscribe-push', 'click', async () => {
    await unsubscribePush(sync, api.basePath);
    $('push-status').textContent = '已取消通知訂閱。';
  });
  bind('sync-now', 'click', syncNow);
  bind('revoke-device', 'click', async () => {
    await sync.revoke();
    $('reactivate-device').hidden = false;
    message('伺服器授權已撤銷；本機帳本保留。可隨時重新啟用匿名同步。');
    $('sync-status').textContent = '授權已撤銷，重新連線需重新設定。';
  });
  bind('reactivate-device', 'click', async () => {
    await sync.reactivate();
    await syncNow();
    $('reactivate-device').hidden = true;
    message('已重新啟用匿名同步。');
  });
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void render().catch((e) => message(friendly(e), true));
      void syncNow();
    }
  });
  setInterval(() => {
    if (!document.hidden) {
      void render().catch(() => {});
      void syncNow();
    }
  }, 60000);
  backendState('正在檢查後端；手動記帳與備份可隨時使用。');
  await render();
  if ('serviceWorker' in navigator && import.meta.env.PROD)
    navigator.serviceWorker
      .register(`${api.basePath}sw.js`, {
        scope: api.basePath,
        updateViaCache: 'none',
      })
      .catch(() => message('離線快取設定失敗；請備份帳本後重新載入。', true));
  void syncNow();
}
init().catch((error) =>
  message(`本機儲存無法啟動：${friendly(error)}。請檢查瀏覽器儲存權限。`, true),
);
