import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const enter = async (page, item, amount, date) => {
  await page
    .getByRole('navigation', { name: '主要選單' })
    .getByRole('button', { name: '快速記帳' })
    .click();
  await page.getByRole('button', { name: '＋ 手動記帳' }).click();
  await page.getByLabel('品項', { exact: true }).fill(item);
  await page.getByLabel('金額（TWD）', { exact: true }).fill(String(amount));
  if (date) await page.locator('#expense-date').fill(date);
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  await expect(page.locator('#expense-dialog')).not.toBeVisible();
};

test('real browser v1 upgrade retains data, createdAt and v2 backup and CRUD', async ({
  page,
}) => {
  await page.goto('icon.svg');
  const old = await page.evaluate(async () => {
    const date = new Date().toISOString().slice(0, 10);
    const old = {
      id: crypto.randomUUID(),
      item: '升級前豆漿',
      amount: 35,
      category: '餐飲',
      expenseDate: date,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      origin: 'manual',
      schemaVersion: 1,
    };
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
        const tx = db.transaction(['expenses', 'activity'], 'readwrite');
        tx.objectStore('expenses').put(old, old.id);
        tx.objectStore('activity').put({ createdAt: old.createdAt }, old.id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
    return old;
  });
  await page.goto('./');
  await expect(page.locator('#month-total')).toHaveText('35');
  await expect(page.locator('#completion-title')).toHaveText('今天還沒記帳');
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page
    .getByRole('button', { name: '編輯 升級前豆漿', exact: true })
    .click();
  await page.locator('#amount').fill('45');
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  const saved = await page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const r = indexedDB.open('bookkeeping-v1');
        r.onsuccess = () => {
          const db = r.result;
          const q = db.transaction('expenses').objectStore('expenses').get(id);
          q.onsuccess = () => {
            resolve({ version: db.version, record: q.result });
            db.close();
          };
        };
      }),
    old.id,
  );
  expect(saved.version).toBe(2);
  expect(saved.record.createdAt).toBe(old.createdAt);
  expect(saved.record.amount).toBe(45);
  await page.getByRole('button', { name: '資料備份' }).click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '下載 JSON 備份', exact: true })
    .click();
  const backup = await download;
  await page.locator('#import-file').setInputFiles(await backup.path());
  await expect(page.locator('#preview-note')).toContainText('跳過重複 1 筆');
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page
    .getByRole('button', { name: '刪除 升級前豆漿', exact: true })
    .click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await expect(page.locator('#records .record')).toHaveCount(0);
});

test('five-sample rating recalculates after edit and deletion and market selection clears stale demonstration', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('#quick-date')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  const today = await page.locator('#quick-date').inputValue();
  const backup = await page.evaluate((today) => {
    const group = crypto.randomUUID();
    const records = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 5 + i);
      return {
        id: crypto.randomUUID(),
        item: `豆漿第${i}筆`,
        amount: i === 5 ? 60 : 40,
        category: '餐飲',
        expenseDate: d.toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        origin: 'manual',
        schemaVersion: 1,
      };
    });
    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      expenses: records,
      zeroDays: [],
      productLinks: records.map((e) => ({ expenseId: e.id, productId: group })),
    };
  }, today);
  await page.getByRole('button', { name: '資料備份' }).click();
  await page.locator('#import-file').setInputFiles({
    name: 'confirmed-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: '確認合併匯入' }).click();
  await page.getByRole('button', { name: '消費分析' }).click();
  await page
    .locator('#analysis-product-current')
    .selectOption(backup.expenses[5].id);
  await expect(page.locator('#analysis-history-result')).toContainText('5 筆');
  await expect(page.locator('#analysis-history-result')).toContainText(
    '相對偏高',
  );
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page
    .getByRole('button', { name: '編輯 豆漿第5筆', exact: true })
    .click();
  await page.locator('#amount').fill('40');
  await page
    .locator('#expense-form')
    .getByRole('button', { name: '確認儲存', exact: true })
    .click();
  await page.getByRole('button', { name: '消費分析' }).click();
  await expect(page.locator('#analysis-history-result')).toContainText(
    '接近歷史價格',
  );
  await page
    .locator('#analysis-market-product')
    .selectOption(backup.expenses[5].id);
  await page.getByRole('button', { name: '執行模擬市場比價' }).click();
  await expect(page.locator('#analysis-market-result')).toContainText(
    '示範資料',
  );
  await page
    .locator('#analysis-market-product')
    .selectOption(backup.expenses[0].id);
  await expect(page.locator('#analysis-market-result')).toBeEmpty();
  await page.getByRole('button', { name: '消費紀錄' }).click();
  await page
    .getByRole('button', { name: '刪除 豆漿第0筆', exact: true })
    .click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await page.getByRole('button', { name: '消費分析' }).click();
  await expect(page.locator('#analysis-history-result')).toContainText(
    '歷史不足 5 筆',
  );
});

test('mobile three-tab navigation, keyboard labels, explicit equal-month dates and offline analysis', async ({
  page,
  context,
}, testInfo) => {
  await page.clock.install({ time: new Date('2026-03-31T04:00:00Z') });
  const calls = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.includes('/api/')) calls.push(r.url());
  });
  await page.goto('./');
  await expect(
    page.getByRole('navigation', { name: '主要選單' }).getByRole('button'),
  ).toHaveCount(3);
  await enter(page, 'x'.repeat(100), 55);
  const analysis = page.getByRole('button', { name: '消費分析' });
  await analysis.focus();
  await page.keyboard.press('Enter');
  await expect(analysis).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('combobox', { name: '本次消費', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: '比較期間', exact: true })
    .selectOption('month');
  await expect(page.locator('#analysis-period-summary')).toContainText(
    '2026-03-01 ～ 2026-03-28',
  );
  await expect(page.locator('#analysis-period-summary')).toContainText(
    '2026-02-01 ～ 2026-02-28',
  );
  await expect(page.locator('#analysis-period-summary')).toContainText(
    '2026-03-29 ～ 2026-03-31 不納入',
  );
  await expect(page.locator('#analysis-period-summary')).toContainText(
    '消費筆數差異',
  );
  await expect(page.locator('#analysis-period-summary')).toContainText(
    '百分比無法計算',
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: '消費分析' }).click();
  await expect(page.locator('#analysis-period-summary')).toContainText(
    '資料不足',
  );
  await page.locator('#analysis-zero-date').fill('2026-03-30');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '確認該日零支出' }).click();
  await expect(page.locator('#analysis-zero-list')).toContainText('2026-03-30');
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
    for (let i = 1; i < boxes.length; i++)
      expect(
        boxes[i].left >= boxes[i - 1].right ||
          boxes[i].top >= boxes[i - 1].bottom,
      ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  mkdirSync('docs/evidence/batch1', { recursive: true });
  await page.screenshot({
    path: `docs/evidence/batch1/${testInfo.project.name}-analysis-mobile.png`,
    fullPage: true,
  });
  expect(calls).toEqual([]);
});
