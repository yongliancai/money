import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

// Every test gets a fresh disposable context. Never use the owner's Chrome profile,
// clear site data, delete databases, or access any user ledger.
const audits = new WeakMap();
const nav = (page, name) =>
  page
    .getByRole('navigation', { name: '主要選單' })
    .getByRole('button', { name });
const dateAt = (date, offset) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const expense = (date, amount, item = '合成豆漿') => ({
  id: crypto.randomUUID(),
  item,
  amount,
  category: '餐飲',
  expenseDate: date,
  createdAt: '2026-01-01T04:00:00Z',
  updatedAt: '2026-01-01T04:00:00Z',
  origin: 'manual',
  schemaVersion: 1,
});
async function load(page, fixedDate) {
  if (fixedDate)
    await page.clock.install({ time: new Date(`${fixedDate}T04:00:00Z`) });
  expect((await page.goto('./')).status()).toBe(200);
  await expect(page.locator('#connection')).toContainText('無後端模式');
  await expect(page.locator('#quick-date')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(nav(page, '消費分析')).toBeVisible();
}
async function importBackup(page, expenses, zeroDates = []) {
  await page.getByRole('button', { name: '資料備份' }).click();
  await page.locator('#import-file').setInputFiles({
    name: 'isolated-synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: '2026-11-22T04:00:00Z',
        expenses,
        zeroDays: zeroDates.map((date) => ({ date, confirmed: true })),
        productLinks: [],
      }),
    ),
  });
  await expect(page.locator('#preview-dialog')).toBeVisible();
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await expect(page.locator('#preview-dialog')).not.toBeVisible();
}
test.beforeEach(async ({ page }) => {
  const audit = { errors: [], failed: [], unexpected: [] };
  audits.set(page, audit);
  page.on('pageerror', (error) => audit.errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400)
      audit.failed.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== 'https://yongliancai.github.io' ||
      !url.pathname.startsWith('/money/') ||
      url.pathname.includes('/api/')
    )
      audit.unexpected.push(request.url());
  });
});
test.afterEach(async ({ page }, info) => {
  const audit = audits.get(page);
  await info.attach('network-and-javascript-audit', {
    body: JSON.stringify(audit),
    contentType: 'application/json',
  });
  expect(audit.errors).toEqual([]);
  expect(audit.failed).toEqual([]);
  expect(audit.unexpected).toEqual([]);
});

test('published quick entry, CRUD, search, JSON restore/dedup, reload and offline entry', async ({
  page,
  context,
}) => {
  await load(page);
  await page
    .locator('#quick-input')
    .fill('早餐蛋餅 45\n午餐便當 100\n捷運 30\n全聯買牛奶 65');
  await page.getByRole('button', { name: '預覽快速記帳' }).click();
  await expect(page.locator('.preview-row')).toHaveCount(4);
  await expect(page.locator('#month-total')).toHaveText('0');
  await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
  await expect(page.locator('#month-total')).toHaveText('240');
  await nav(page, '消費紀錄').click();
  await page
    .getByRole('button', { name: '編輯 全聯買牛奶', exact: true })
    .click();
  await page.locator('#amount').fill('75');
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  await page.getByRole('button', { name: '刪除 捷運', exact: true }).click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await expect(page.locator('#month-total')).toHaveText('220');
  await page.getByLabel('搜尋品項', { exact: true }).fill('牛奶');
  await expect(page.locator('#records .record')).toHaveCount(1);
  await page.getByLabel('搜尋品項', { exact: true }).fill('');
  await expect(page.locator('#records .record')).toHaveCount(3);
  await page.getByRole('button', { name: '資料備份' }).click();
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '下載 JSON 備份', exact: true })
    .click();
  const file = await downloaded;
  const data = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(data.schemaVersion).toBe(2);
  expect(data.expenses).toHaveLength(3);
  await nav(page, '消費紀錄').click();
  for (const record of data.expenses) {
    await page
      .getByRole('button', { name: `刪除 ${record.item}`, exact: true })
      .click();
    await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  }
  await expect(page.locator('#month-total')).toHaveText('0');
  await page.getByRole('button', { name: '資料備份' }).click();
  await page.locator('#import-file').setInputFiles(await file.path());
  await expect(page.locator('#preview-note')).toContainText('恢復曾刪除 3 筆');
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await page.locator('#import-file').setInputFiles(await file.path());
  await expect(page.locator('#preview-note')).toContainText('跳過重複 3 筆');
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await nav(page, '快速記帳').click();
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
  await expect(page.locator('#month-total')).toHaveText('220');
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  expect(scope).toBe('https://yongliancai.github.io/money/');
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('220');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('220');
  await page.locator('#quick-input').fill('捷運 30');
  await page.getByRole('button', { name: '預覽快速記帳' }).click();
  await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
  await expect(page.locator('#month-total')).toHaveText('250');
});

test('published same-product consent, five-sample median threshold, recalculation and mock market', async ({
  page,
}, info) => {
  await load(page, '2026-11-20');
  const expenses = [30, 35, 40, 45, 50, 60].map((amount, i) =>
    expense(dateAt('2026-11-15', i), amount, `合成豆漿${i}`),
  );
  await importBackup(page, expenses);
  await nav(page, '消費分析').click();
  await page.locator('#analysis-product-current').selectOption(expenses[5].id);
  await expect(page.locator('#analysis-history-result')).toContainText('0 筆');
  const confirm = page.getByRole('button', {
    name: '確認兩筆為同商品',
    exact: true,
  });
  await page.locator('#analysis-product-previous').selectOption(expenses[0].id);
  page.once('dialog', (dialog) => dialog.dismiss());
  await confirm.click();
  await expect(confirm).toBeEnabled();
  await expect(page.locator('#analysis-history-result')).toContainText('0 筆');
  for (let i = 0; i < 5; i++) {
    await page
      .locator('#analysis-product-previous')
      .selectOption(expenses[i].id);
    page.once('dialog', (dialog) => dialog.accept());
    await confirm.click();
    await expect(confirm).toBeEnabled();
    await expect(page.locator('#analysis-history-result')).toContainText(
      `${i + 1} 筆`,
    );
    if (i < 4)
      await expect(page.locator('#analysis-history-result')).toContainText(
        '歷史不足 5 筆',
      );
  }
  await expect(page.locator('#analysis-history-result')).toContainText('NT$40');
  await expect(page.locator('#analysis-history-result')).toContainText(
    '相對偏高',
  );
  await nav(page, '消費紀錄').click();
  await page
    .getByRole('button', { name: '編輯 合成豆漿5', exact: true })
    .click();
  await page.locator('#amount').fill('40');
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  await nav(page, '消費分析').click();
  await expect(page.locator('#analysis-history-result')).toContainText(
    '接近歷史價格',
  );
  await nav(page, '消費紀錄').click();
  await page
    .getByRole('button', { name: '刪除 合成豆漿0', exact: true })
    .click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await nav(page, '消費分析').click();
  await expect(page.locator('#analysis-history-result')).toContainText(
    '歷史不足 5 筆',
  );
  await page.locator('#analysis-market-product').selectOption(expenses[5].id);
  await page.getByRole('button', { name: '執行模擬市場比價' }).click();
  await expect(page.locator('#analysis-market-result')).toContainText(
    '示範資料',
  );
  await expect(page.locator('#analysis-market-result')).toContainText(
    '示範商家 A',
  );
  await expect(page.locator('#analysis-market-result')).toContainText('NT$760');
  await expect(page.locator('#analysis-market-result')).toContainText(
    '不提供真實市場評級',
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const boxes = await page
      .getByRole('navigation', { name: '主要選單' })
      .getByRole('button')
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
      );
    expect(boxes).toHaveLength(3);
    for (let i = 1; i < boxes.length; i++)
      expect(
        boxes[i].left >= boxes[i - 1].right ||
          boxes[i].top >= boxes[i - 1].bottom,
      ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#analysis-market-result').scrollIntoViewIfNeeded();
  mkdirSync('docs/evidence/batch1-release', { recursive: true });
  await page.screenshot({
    path: `docs/evidence/batch1-release/${info.project.name}-published-market.png`,
    scale: 'css',
  });
});

test('published seven-day dates and totals plus today zero-spend confirmation and cancellation', async ({
  page,
}) => {
  await load(page, '2026-11-20');
  await importBackup(
    page,
    [expense('2026-11-19', 200), expense('2026-11-12', 100)],
    Array.from({ length: 14 }, (_, i) => dateAt('2026-11-07', i)),
  );
  await nav(page, '快速記帳').click();
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '今天沒有消費', exact: true }).click();
  await expect(page.locator('#completion-title')).toHaveText('今天已完成記帳');
  await nav(page, '消費分析').click();
  const panel = page.locator('#analysis-period-summary');
  await expect(panel).toContainText('2026-11-14 ～ 2026-11-20');
  await expect(panel).toContainText('2026-11-07 ～ 2026-11-13');
  await expect(panel).toContainText('NT$200');
  await expect(panel).toContainText('NT$100');
  await expect(panel).toContainText('+100.0%');
  await expect(panel).toContainText('兩期覆蓋率均達 90%');
  await page
    .getByRole('button', { name: '取消零支出確認', exact: true })
    .click();
  await expect(panel).toContainText('僅顯示初步變化');
  await nav(page, '快速記帳').click();
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
});

for (const [covered, expected] of [
  [18, '兩期覆蓋率均達 90%'],
  [14, '僅顯示初步變化'],
  [13, '資料不足'],
]) {
  test(`published month-to-date ${covered}/20 date coverage enforces 70/90 policy`, async ({
    page,
  }) => {
    await load(page, '2026-11-20');
    const dates = ['2026-11-01', '2026-10-01'].flatMap((start) =>
      Array.from({ length: covered }, (_, i) => dateAt(start, i)),
    );
    await importBackup(
      page,
      [expense('2026-11-01', 200), expense('2026-10-01', 100)],
      dates,
    );
    await nav(page, '消費分析').click();
    await page
      .getByRole('combobox', { name: '比較期間', exact: true })
      .selectOption('month');
    const panel = page.locator('#analysis-period-summary');
    await expect(panel).toContainText('2026-11-01 ～ 2026-11-20');
    await expect(panel).toContainText('2026-10-01 ～ 2026-10-20');
    await expect(panel).toContainText(`${covered}/20 天（${covered * 5}%）`);
    await expect(panel).toContainText(expected);
    await expect(panel).toContainText('本期 1 筆 ／ 前期 1 筆');
    await expect(panel).toContainText('+100.0%');
    if (covered < 18) await expect(panel).not.toContainText('已記錄支出趨勢：');
  });
}

test('published static PWA metadata and a seeded v1 database upgrade without deleting records', async ({
  page,
}) => {
  await page.goto('icon.svg');
  const old = expense('2026-11-20', 35, '合成升級前紀錄');
  await page.evaluate(async (old) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('bookkeeping-v1', 1);
      request.onupgradeneeded = () => {
        for (const name of [
          'expenses',
          'settings',
          'activity',
          'outbox',
          'meta',
          'tombstones',
        ])
          request.result.createObjectStore(name);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('expenses', 'readwrite');
        tx.objectStore('expenses').put(old, old.id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, old);
  await load(page, '2026-11-20');
  await nav(page, '消費紀錄').click();
  await expect(
    page.getByRole('button', { name: '編輯 合成升級前紀錄', exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const request = indexedDB.open('bookkeeping-v1');
        request.onsuccess = () => {
          const db = request.result;
          const get = db
            .transaction('expenses')
            .objectStore('expenses')
            .get(id);
          get.onsuccess = () => {
            resolve({ version: db.version, record: get.result });
            db.close();
          };
        };
      }),
    old.id,
  );
  expect(saved.version).toBe(2);
  expect(saved.record).toEqual(old);
  const manifestResponse = await page.request.get('manifest.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest.scope).toBe('/money/');
  expect(manifest.start_url).toBe('/money/');
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons)
    expect(
      (await page.request.get(new URL(icon.src, page.url()).href)).status(),
    ).toBe(200);
  expect((await page.request.get('sw.js')).status()).toBe(200);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.ready).scope,
    ),
  ).toBe('https://yongliancai.github.io/money/');
});
