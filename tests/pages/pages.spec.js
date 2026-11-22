import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

async function load(page) {
  await page.goto('./');
  await expect(page.locator('#connection')).toContainText('無後端模式');
}
async function manual(page, item = '午餐', amount = '120', date) {
  await page.getByRole('button', { name: '＋ 手動記帳' }).click();
  await page.locator('#item').fill(item);
  await page.locator('#amount').fill(amount);
  if (date) await page.locator('#expense-date').fill(date);
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  await expect(page.locator('#expense-dialog')).not.toBeVisible();
}
async function download(page, name) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return readFileSync(await (await pending).path(), 'utf8');
}
async function workerReady(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        }),
      );
  });
}

test('strict Pages subpath assets, manifest and installation metadata work without backend requests', async ({
  page,
}) => {
  const requests = [];
  const failed = [];
  const errors = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page);
  await workerReady(page);
  const manifest = await (
    await page.request.get('/money/manifest.webmanifest')
  ).json();
  expect(manifest.start_url).toBe('/money/');
  expect(manifest.scope).toBe('/money/');
  expect(manifest.id).toBe('/money/');
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    expect(icon.src).toMatch(/^\/money\//);
    expect((await page.request.get(icon.src)).status()).toBe(200);
  }
  expect(
    await page.locator('link[rel=apple-touch-icon]').getAttribute('href'),
  ).toBe('/money/icon-192.png');
  expect(
    await page
      .locator('meta[name=apple-mobile-web-app-capable]')
      .getAttribute('content'),
  ).toBe('yes');
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.ready).scope,
    ),
  ).toBe('http://127.0.0.1:3201/money/');
  await manual(page);
  await page.getByRole('button', { name: '提醒設定' }).click();
  await expect(page.locator('#push-status')).toContainText('尚未連接後端');
  await expect(page.locator('#subscribe-push')).toBeDisabled();
  expect(
    requests.some((url) => new URL(url).pathname.startsWith('/api/')),
  ).toBe(false);
  expect(
    requests.every((url) => new URL(url).pathname.startsWith('/money/')),
  ).toBe(true);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
  expect((await page.request.get('/assets/unknown.js')).status()).toBe(404);
  expect((await page.request.get('/api/config')).status()).toBe(404);
});
test('manual CRUD persists after reload and monthly totals follow expense date under /money/', async ({
  page,
}) => {
  await load(page);
  await manual(page);
  await expect(page.locator('#month-total')).toHaveText('120');
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page.getByRole('button', { name: '編輯 午餐', exact: true }).click();
  await page.locator('#amount').fill('150');
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await expect(page.locator('#month-total')).toHaveText('150');
  const month = await page.locator('#month').inputValue();
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCDate(0);
  const previous = date.toISOString().slice(0, 10);
  await manual(page, '上月消費', '999', previous);
  await expect(page.locator('#month-total')).toHaveText('150');
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('150');
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page.getByRole('button', { name: '刪除 午餐', exact: true }).click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await expect(page.locator('#month-total')).toHaveText('0');
  await page.locator('#month').fill(previous.slice(0, 7));
  await expect(page.locator('#month-total')).toHaveText('999');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('JSON and CSV exports, preview/cancel, restore and merge dedup work without a backend', async ({
  page,
}) => {
  await load(page);
  await manual(page, '備份午餐', '55');
  await page.getByRole('button', { name: '資料備份' }).click();
  const json = await download(page, '下載 JSON 備份');
  expect(JSON.parse(json).expenses).toHaveLength(1);
  const csv = await download(page, '下載 CSV');
  expect(csv).toContain('備份午餐');
  expect(csv).toContain('expenseDate');
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page
    .getByRole('button', { name: '刪除 備份午餐', exact: true })
    .click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await page.getByRole('button', { name: '資料備份' }).click();
  const file = {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  };
  await page.locator('#import-file').setInputFiles(file);
  await expect(page.locator('#preview-note')).toContainText('恢復曾刪除 1 筆');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.locator('#import-file').setInputFiles(file);
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await page.locator('#import-file').setInputFiles(file);
  await expect(page.locator('#preview-note')).toContainText('跳過重複 1 筆');
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await expect(page.locator('#month-total')).toHaveText('55');
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
});
test('offline reload and worker replacement retain IndexedDB and neighboring application caches', async ({
  page,
  context,
}, testInfo) => {
  await load(page);
  await workerReady(page);
  await manual(page, '保留帳本', '88');
  await page.evaluate(() => caches.open('bookkeeping:%2Fneighbor%2F:keep'));
  const old = await page.evaluate(() => caches.keys());
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('88');
  await manual(page, '離線記帳', '12');
  await expect(page.locator('#month-total')).toHaveText('100');
  await context.setOffline(false);
  await page.request.post('/__test__/worker-version');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const controlled = new Promise((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', resolve, {
        once: true,
      }),
    );
    await registration.update();
    await controlled;
  });
  await expect
    .poll(async () => {
      const keys = await page.evaluate(() => caches.keys());
      return {
        count: keys.filter((k) => k.startsWith('bookkeeping:%2Fmoney%2F:'))
          .length,
        updated: keys.some((k) => k.includes('update-test')),
      };
    })
    .toEqual({ count: 1, updated: true });
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toContain('bookkeeping:%2Fneighbor%2F:keep');
  expect(
    keys.filter((k) => k.startsWith('bookkeeping:%2Fmoney%2F:')),
  ).toHaveLength(1);
  expect(keys.some((k) => k.includes('update-test'))).toBe(true);
  expect(keys).not.toEqual(old);
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('100');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('100');
  mkdirSync('docs/evidence/pages', { recursive: true });
  await page.screenshot({
    path: `docs/evidence/pages/${testInfo.project.name}-offline.png`,
    fullPage: true,
  });
});
test('explicit independent backend passes real CORS and AI preview gate, then degrades on backend failure', async ({
  page,
}) => {
  await page.request.post('http://127.0.0.1:3301/__test__/connect');
  await page.goto('http://127.0.0.1:3202/money/');
  await expect(page.locator('#connection')).toContainText('已連線');
  await page.getByLabel('花費描述').fill('今天午餐120');
  await page.getByRole('button', { name: '解析並預覽' }).click();
  await expect(page.locator('#preview-dialog')).toBeVisible();
  await expect(page.locator('#month-total')).toHaveText('0');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.request.post('http://127.0.0.1:3301/__test__/disconnect');
  await page.getByRole('button', { name: '提醒設定' }).click();
  await page.getByRole('button', { name: '立即同步狀態' }).click();
  await expect(page.locator('#ai-mode')).toContainText('無法連接後端');
  await expect(page.locator('#subscribe-push')).toBeDisabled();
  await expect(page.locator('#parse-button')).toBeDisabled();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await manual(page, '後端失聯仍可記帳', '66');
  await expect(page.locator('#month-total')).toHaveText('66');
});
