import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('conflicts, unknown categories and missing amounts require editable review without losing a line', async ({
  page,
}) => {
  await page.goto('./');
  await page.locator('#quick-input').fill('全聯咖啡 65\n神秘支出 20\n午餐');
  await page.getByRole('button', { name: '預覽快速記帳' }).click();
  await expect(page.locator('.preview-row')).toHaveCount(3);
  await expect(page.locator('.preview-warning').first()).toContainText(
    '分類衝突',
  );
  const select = page.locator('.preview-row select[data-field=category]');
  await expect(select.nth(0)).toHaveValue('');
  await expect(select.nth(1)).toHaveValue('');
  await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
  await expect(page.locator('#preview-dialog')).toBeVisible();
  await expect(page.locator('#month-total')).toHaveText('0');
  await select.nth(0).selectOption('購物');
  await select.nth(1).selectOption('其他');
  await page
    .locator('.preview-row input[data-field=amount]')
    .nth(2)
    .fill('100');
  await page
    .locator('.preview-row input[data-field=item]')
    .nth(1)
    .fill('自行確認的支出');
  await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
  await expect(page.locator('#month-total')).toHaveText('185');
  await expect(page.locator('#records .record')).toHaveCount(3);
});

test('offline quick entry confirms exactly once, survives reload and reports today without background notification controls', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.locator('#quick-input').fill('捷運 30\n早餐蛋餅 45');
  await page.getByRole('button', { name: '預覽快速記帳' }).click();
  await page.evaluate(() => {
    const form = document.getElementById('preview-form');
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  await expect(page.locator('#month-total')).toHaveText('75');
  await expect(page.locator('#records .record')).toHaveCount(2);
  await expect(page.locator('#completion-title')).toHaveText('今天已完成記帳');
  await page.reload();
  await expect(page.locator('#month-total')).toHaveText('75');
  await page.getByRole('button', { name: '提醒設定' }).click();
  await expect(page.locator('#settings-completion-title')).toHaveText(
    '今天已完成記帳',
  );
  await expect(page.locator('#local-settings')).toContainText(
    '不提供關閉網站後的背景定時提醒',
  );
  await expect(page.locator('#backend-ai')).toBeHidden();
  await expect(page.locator('#backend-settings')).toBeHidden();
  await page.getByRole('button', { name: '記帳總覽' }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  mkdirSync('docs/evidence/v1', { recursive: true });
  await page.screenshot({
    path: `docs/evidence/v1/${testInfo.project.name}-offline.png`,
    fullPage: true,
  });
});

test('local quick entry parses four examples without writing before explicit confirmation', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('/api/'))
      requests.push(request.url());
  });
  await page.goto('./');
  await page
    .locator('#quick-input')
    .fill('早餐蛋餅 45\n午餐便當 100\n捷運 30\n全聯買牛奶 65');
  await page.getByRole('button', { name: '預覽快速記帳' }).click();
  await expect(page.locator('.preview-row')).toHaveCount(4);
  await expect(page.locator('#month-total')).toHaveText('0');
  const categories = await page
    .locator('.preview-row select[data-field=category]')
    .evaluateAll((nodes) => nodes.map((node) => node.value));
  expect(categories).toEqual(['餐飲', '餐飲', '交通', '購物']);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#month-total')).toHaveText('0');
  await page.getByRole('button', { name: '預覽快速記帳' }).click();
  await page.getByRole('button', { name: '確認儲存這些紀錄' }).click();
  await expect(page.locator('#month-total')).toHaveText('240');
  await expect(page.locator('#records .record')).toHaveCount(4);
  expect(requests).toEqual([]);
});
