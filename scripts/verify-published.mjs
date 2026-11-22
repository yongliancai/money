import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const url = 'https://yongliancai.github.io/money/';
const evidence = 'docs/evidence/release';
mkdirSync(evidence, { recursive: true });
const results = [];
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Taipei',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const failed = [],
    errors = [],
    api = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.includes('/api/')) api.push(r.url());
  });
  try {
    const response = await page.goto(url);
    expect(response.status()).toBe(200);
    await expect(page.locator('#connection')).toContainText('無後端模式');
    const manifestResponse = await context.request.get(
      new URL('manifest.webmanifest', url).href,
    );
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.scope).toBe('/money/');
    expect(manifest.start_url).toBe('/money/');
    for (const icon of manifest.icons)
      expect(
        (await context.request.get(new URL(icon.src, url).href)).status(),
      ).toBe(200);
    const scope = await page.evaluate(
      async () => (await navigator.serviceWorker.ready).scope,
    );
    expect(scope).toBe(url);
    await page
      .locator('#quick-input')
      .fill('早餐蛋餅 45\n午餐便當 100\n捷運 30\n全聯買牛奶 65');
    await page.getByRole('button', { name: '預覽快速記帳' }).click();
    await expect(page.locator('.preview-row')).toHaveCount(4);
    await expect(page.locator('#month-total')).toHaveText('0');
    await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
    await expect(page.locator('#month-total')).toHaveText('240');
    await expect(page.locator('#records .record')).toHaveCount(4);
    await page
      .getByRole('button', { name: '編輯 早餐蛋餅', exact: true })
      .click();
    await page.locator('#amount').fill('50');
    await page
      .locator('#expense-form')
      .getByRole('button', { name: '確認儲存', exact: true })
      .click();
    await expect(page.locator('#month-total')).toHaveText('245');
    await page.getByRole('button', { name: '刪除 捷運', exact: true }).click();
    await page.getByRole('button', { name: '確認刪除', exact: true }).click();
    await expect(page.locator('#month-total')).toHaveText('215');
    await page.getByRole('button', { name: '資料備份' }).click();
    const downloaded = page.waitForEvent('download');
    await page
      .getByRole('button', { name: '下載 JSON 備份', exact: true })
      .click();
    const backup = await downloaded;
    await backup.saveAs(`${evidence}/${name}-synthetic-backup.json`);
    await page.locator('#import-file').setInputFiles(await backup.path());
    await expect(page.locator('#preview-note')).toContainText('跳過重複 3 筆');
    await page.getByRole('button', { name: '確認合併匯入' }).click();
    await page.getByRole('button', { name: '記帳總覽' }).click();
    await page.reload();
    await expect(page.locator('#month-total')).toHaveText('215');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#month-total')).toHaveText('215');
    await page.locator('#quick-input').fill('捷運 30');
    await page.getByRole('button', { name: '預覽快速記帳' }).click();
    await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
    await expect(page.locator('#month-total')).toHaveText('245');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
    expect(api).toEqual([]);
    await page.screenshot({
      path: `${evidence}/${name}-published-offline.png`,
      fullPage: true,
    });
    results.push({
      browser: name,
      status: 'PASS',
      url,
      scope,
      checks: [
        'HTTPS 200',
        'manifest/icons',
        'no backend API',
        'explicit confirmation',
        'CRUD',
        'monthly total',
        'JSON export/import dedup',
        'reload persistence',
        'offline reload and entry',
        'mobile layout',
      ],
      failed,
      errors,
      api,
    });
  } finally {
    await browser.close();
  }
}
const report = {
  time: new Date().toISOString(),
  url,
  sourceCommit: process.env.RELEASE_SHA,
  results,
  limitations: [
    'Desktop WebKit is not a real iPhone installation test.',
    'Only synthetic data in fresh disposable browser contexts.',
  ],
};
writeFileSync(
  `${evidence}/published-smoke.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
