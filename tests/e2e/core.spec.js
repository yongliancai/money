import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function load(page) {
  await page.goto('/');
  await expect(page.locator('#connection')).toContainText('已連線');
}
async function manual(page, item = '午餐', amount = '120') {
  await page.getByRole('button', { name: '＋ 手動記帳' }).click();
  await page.getByLabel('品項', { exact: true }).fill(item);
  await page.getByLabel('金額（TWD）', { exact: true }).fill(amount);
  await page.locator('#category').fill('餐飲');
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
}
test('manual CRUD, monthly total and today completion regression', async ({
  page,
}) => {
  await load(page);
  await manual(page);
  await expect(page.locator('#month-total')).toHaveText('120');
  await expect(page.locator('#completion-title')).toHaveText('今天已完成記帳');
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page.getByRole('button', { name: '編輯 午餐', exact: true }).click();
  await page.locator('#amount').fill('150');
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await expect(page.locator('#month-total')).toHaveText('150');
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page.getByRole('button', { name: '刪除 午餐', exact: true }).click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await expect(page.locator('#month-total')).toHaveText('0');
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
});
test('AI preview cancellation, editable fields, double confirmation and no pre-confirm writes', async ({
  page,
}) => {
  await load(page);
  await page.getByLabel('花費描述').fill('今天午餐120、今天咖啡55');
  await page.getByRole('button', { name: '解析並預覽' }).click();
  await expect(page.locator('#preview-dialog')).toBeVisible();
  await expect(page.locator('#month-total')).toHaveText('0');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#month-total')).toHaveText('0');
  await page.getByRole('button', { name: '解析並預覽' }).click();
  await page
    .locator('.preview-row input[data-field=amount]')
    .first()
    .fill('130');
  await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
  await expect(page.locator('#month-total')).toHaveText('185');
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await expect(page.locator('#records .record')).toHaveCount(2);
});
test('JSON backup, deletion, restore warning, cancellation, dedup and import exclusion', async ({
  page,
}) => {
  await load(page);
  await manual(page);
  await page.getByRole('button', { name: '資料備份' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page.getByRole('button', { name: '刪除 午餐', exact: true }).click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await page.getByRole('button', { name: '資料備份' }).click();
  await page.locator('#import-file').setInputFiles(backupPath);
  await expect(page.locator('#preview-note')).toContainText('恢復曾刪除 1 筆');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.locator('#import-file').setInputFiles(backupPath);
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await expect(page.locator('#month-total')).toHaveText('120');
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
  await page.getByRole('button', { name: '資料備份' }).click();
  await page.locator('#import-file').setInputFiles(backupPath);
  await expect(page.locator('#preview-note')).toContainText('跳過重複 1 筆');
  await page.getByRole('button', { name: '確認合併匯入' }).click();
});
test('installed service worker serves shell after offline reload; local CRUD survives reconnect', async ({
  page,
  context,
}) => {
  await load(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator('#connection')).toContainText('已連線');
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '把日常，慢慢記下來。' }),
  ).toBeVisible();
  await manual(page, '離線午餐', '88');
  await expect(page.locator('#month-total')).toHaveText('88');
  await context.setOffline(false);
  await page.getByRole('button', { name: '提醒設定' }).click();
  await page.getByRole('button', { name: '立即同步狀態' }).click();
  await expect(page.locator('#sync-status')).toContainText('同步完成');
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('88');
});
test.describe('isolated network-error interception', () => {
  test.use({ serviceWorkers: 'block' });
  test('mobile viewport, text injection safety, invalid import and AI network failure fallback', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await load(page);
    await manual(page, '<img src=x onerror=alert(1)>', '50');
    await expect(page.locator('#records img')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.route('**/api/ai/parse', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI 暫時不可用，請改用手動記帳' }),
      }),
    );
    await page.getByLabel('花費描述').fill('午餐120');
    await page.getByRole('button', { name: '解析並預覽' }).click();
    await expect(page.locator('#message')).toContainText('手動記帳');
    await page.getByRole('button', { name: '資料備份' }).click();
    await page.locator('#import-file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{bad'),
    });
    await expect(page.locator('#message')).toHaveClass('error');
    await expect(page.locator('#preview-dialog')).not.toBeVisible();
  });
});

test('desktop and mobile visual evidence, manifest and revocation recovery', async ({
  page,
}) => {
  await load(page);
  await manual(page, '午餐便當', '120');
  await manual(page, '咖啡', '55');
  await expect(page.locator('#month-total')).toHaveText('175');
  mkdirSync('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/evidence/mobile.png', fullPage: true });
  const manifest = await (
    await page.request.get('/manifest.webmanifest')
  ).json();
  expect(manifest.display).toBe('standalone');
  await page.getByRole('button', { name: '提醒設定' }).click();
  await page.getByRole('button', { name: '撤銷此裝置的伺服器授權' }).click();
  await expect(page.locator('#message')).toContainText('伺服器授權已撤銷');
  await page.reload();
  await page.getByRole('button', { name: '提醒設定' }).click();
  await expect(
    page.getByRole('button', { name: '重新啟用匿名同步' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '重新啟用匿名同步' }).click();
  await expect(page.locator('#sync-status')).toContainText('同步完成');
});
