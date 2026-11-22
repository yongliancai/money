import { test, expect } from '@playwright/test';

test('zero-spend confirmation, analysis tabs and simulated market offer never call an API', async ({
  page,
}) => {
  const apiCalls = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url());
  });
  await page.goto('./');
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '今天沒有消費' }).click();
  await expect(page.locator('#completion-title')).toHaveText('今天已完成記帳');

  await page.getByRole('button', { name: '消費分析' }).click();
  await expect(page.getByRole('heading', { name: '期間與分類消費趨勢' })).toBeVisible();
  await expect(page.locator('#analysis-period-summary')).toContainText('日期覆蓋率');
  await expect(page.locator('#analysis-market-result')).toBeEmpty();
  await page.getByRole('button', { name: '取消零支出確認' }).click();
  await page.getByRole('button', { name: '快速記帳' }).click();
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');

  await page.getByRole('button', { name: '＋ 手動記帳' }).click();
  await page.locator('#item').fill('藍牙耳機');
  await page.locator('#amount').fill('890');
  await page.locator('#category').fill('購物');
  await page.locator('#expense-form').getByRole('button', { name: '確認儲存' }).click();
  await page.getByRole('button', { name: '消費分析' }).click();
  const choices = page.locator('#analysis-market-product option');
  await expect(choices).toHaveCount(2);
  await page.locator('#analysis-market-product').selectOption({ index: 1 });
  await page.getByRole('button', { name: '執行模擬市場比價' }).click();
  await expect(page.locator('#analysis-market-result')).toContainText('模擬資料');
  await expect(page.locator('#analysis-market-result')).toContainText('NT$760');
  expect(apiCalls).toEqual([]);
});

test('same-product confirmation requires user consent and never rates fewer than 5 earlier records', async ({ page }) => {
  await page.goto('./');
  const today = await page.locator('#quick-date').inputValue();
  const priorDate = await page.evaluate((value) => {
    const d = new Date(value + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, today);
  for (const [item, amount, date] of [['無糖豆漿','35',priorDate], ['豆漿','40',today]]) {
    await page.getByRole('button', { name: '＋ 手動記帳' }).click();
    await page.locator('#item').fill(item);
    await page.locator('#amount').fill(amount);
    await page.locator('#expense-date').fill(date);
    await page.locator('#expense-form').getByRole('button', { name: '確認儲存' }).click();
  }
  await page.getByRole('button', { name: '消費分析' }).click();
  const current = page.locator('#analysis-product-current');
  const previous = page.locator('#analysis-product-previous');
  await current.selectOption({ index: 2 });
  await previous.selectOption({ index: 1 });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '確認兩筆為同商品' }).click();
  await expect(page.locator('#analysis-history-result')).toContainText('1 筆');
  await expect(page.locator('#analysis-history-result')).toContainText('歷史不足 5 筆');
});
