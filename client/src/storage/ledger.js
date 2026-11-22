import { openDB } from 'idb';
import {
  draftSchema,
  expenseSchema,
  backupSchema,
  settingsSchema,
} from '../../../shared/schemas/index.js';
import { localDate } from '../../../shared/dates.js';

const stores = [
  'expenses',
  'settings',
  'activity',
  'outbox',
  'meta',
  'tombstones',
  'dailyStatus',
  'productLinks',
];
export async function openLedger(
  name = 'bookkeeping-v1',
  clock = () => new Date(),
) {
  const db = await openDB(name, 2, {
    upgrade(db) {
      for (const store of stores) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    },
  });
  const previews = new Map();
  const defaults = {
    enabled: false,
    time: '21:00',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    revision: 1,
  };
  async function settings() {
    return (await db.get('settings', 'reminder')) || defaults;
  }
  async function completed(tx, now, zone) {
    const currentDate = localDate(now, zone);
    const zero = await tx.objectStore('dailyStatus').get(currentDate);
    if (zero?.confirmed) return true;
    const activity = await tx.objectStore('activity').getAll();
    return activity.some(
      (a) => localDate(new Date(a.createdAt), zone) === localDate(now, zone),
    );
  }
  async function snapshot(tx, now) {
    const config =
      (await tx.objectStore('settings').get('reminder')) || defaults;
    const date = localDate(now, config.timeZone);
    const revision =
      ((await tx.objectStore('meta').get(`revision:${date}`)) || 0) + 1;
    await tx.objectStore('meta').put(revision, `revision:${date}`);
    const event = {
      eventId: crypto.randomUUID(),
      localDate: date,
      timeZone: config.timeZone,
      revision,
      completed: await completed(tx, now, config.timeZone),
      occurredAt: now.toISOString(),
      settingsRevision: config.revision,
    };
    await tx.objectStore('outbox').put(event, event.eventId);
    return event;
  }
  async function mutate(fn) {
    const tx = db.transaction(stores, 'readwrite');
    try {
      const result = await fn(tx, clock());
      await tx.done;
      return result;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => {});
      throw error;
    }
  }
  return {
    db,
    list: () => db.getAll('expenses'),
    settings,
    async zeroDays() {
      return (await db.getAll('dailyStatus')).filter((x) => x.confirmed).map((x) => x.date);
    },
    async productLinks() {
      const ids = await db.getAllKeys('productLinks');
      const products = await db.getAll('productLinks');
      return Object.fromEntries(ids.map((id, i) => [id, products[i]]));
    },
    async linkProducts(expenseIds) {
      if (!Array.isArray(expenseIds) || expenseIds.length < 2 || new Set(expenseIds).size !== expenseIds.length) throw new Error('請選擇至少兩筆不同紀錄');
      return mutate(async (tx) => {
        const entries = await Promise.all(expenseIds.map(async (id) => ({ id, expense: await tx.objectStore('expenses').get(id), link: await tx.objectStore('productLinks').get(id) })));
        if (entries.some((e) => !e.expense)) throw new Error('部分紀錄已不存在');
        const existing = [...new Set(entries.map((e) => e.link).filter(Boolean))];
        if (existing.length > 1) throw new Error('已屬於不同商品群組，請先解除錯誤對應');
        const productId = existing[0] || crypto.randomUUID();
        for (const e of entries) await tx.objectStore('productLinks').put(productId, e.id);
        return productId;
      });
    },
    async unlinkProduct(expenseId) {
      await db.delete('productLinks', expenseId);
    },
    async confirmZeroSpend(date) {
      if (!date) date = localDate(clock(), (await settings()).timeZone);
      return mutate(async (tx, now) => {
        const config = (await tx.objectStore('settings').get('reminder')) || defaults;
        const today = localDate(now, config.timeZone);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T12:00:00Z').valueOf()) || date > today) throw new Error('只能確認今天或過去的有效日期');
        const records = await tx.objectStore('expenses').getAll();
        if (records.some((e) => e.expenseDate === date)) throw new Error('這一天已有消費紀錄，不能標示零支出');
        await tx.objectStore('dailyStatus').put({date, confirmed:true, confirmedAt:now.toISOString()}, date);
        if (date === today) await snapshot(tx, now);
      });
    },
    async clearZeroSpend(date) {
      return mutate(async (tx, now) => {
        const config = (await tx.objectStore('settings').get('reminder')) || defaults;
        await tx.objectStore('dailyStatus').delete(date);
        if (date === localDate(now, config.timeZone)) await snapshot(tx, now);
      });
    },
    async isCompleted() {
      const zone = (await settings()).timeZone;
      const tx = db.transaction(['activity', 'dailyStatus']);
      return completed(tx, clock(), zone);
    },
    async saveSettings(input) {
      return mutate(async (tx, now) => {
        const previous =
          (await tx.objectStore('settings').get('reminder')) || defaults;
        const config = settingsSchema.parse({
          ...input,
          revision: previous.revision + 1,
        });
        await tx.objectStore('settings').put(config, 'reminder');
        await snapshot(tx, now);
        return config;
      });
    },
    preview(drafts, origin = 'ai_confirmed') {
      if (!['manual', 'ai_confirmed'].includes(origin))
        throw new Error('無效新增來源');
      const parsed = drafts.map((d) => draftSchema.parse(d));
      if (!parsed.length || parsed.length > 50)
        throw new Error('請提供 1–50 筆記帳');
      const token = crypto.randomUUID();
      previews.set(token, { drafts: parsed, origin });
      return { token, drafts: structuredClone(parsed) };
    },
    cancel(token) {
      previews.delete(token);
    },
    async confirm(token, editedDrafts) {
      const preview = previews.get(token);
      if (!preview) throw new Error('預覽已失效或已儲存');
      // Consume synchronously before any await: double clicks cannot commit twice.
      previews.delete(token);
      try {
        const drafts = (editedDrafts || preview.drafts).map((d) =>
          draftSchema.parse(d),
        );
        if (!drafts.length || drafts.length > 50)
          throw new Error('請提供 1–50 筆記帳');
        return await mutate(async (tx, now) => {
          const records = drafts.map((draft) =>
            expenseSchema.parse({
              ...draft,
              id: crypto.randomUUID(),
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
              origin: preview.origin,
              schemaVersion: 1,
            }),
          );
          for (const record of records) {
            await tx.objectStore('dailyStatus').delete(record.expenseDate);
            await tx.objectStore('expenses').add(record, record.id);
            await tx
              .objectStore('activity')
              .add({ createdAt: record.createdAt }, record.id);
          }
          await snapshot(tx, now);
          return records;
        });
      } catch (error) {
        previews.set(token, preview);
        throw error;
      }
    },
    async update(id, input) {
      const draft = draftSchema.parse(input);
      return mutate(async (tx, now) => {
        const previous = await tx.objectStore('expenses').get(id);
        if (!previous) throw new Error('找不到紀錄');
        await tx.objectStore('dailyStatus').delete(draft.expenseDate);
        await tx
          .objectStore('expenses')
          .put({ ...previous, ...draft, updatedAt: now.toISOString() }, id);
      });
    },
    async remove(id) {
      return mutate(async (tx, now) => {
        await tx.objectStore('expenses').delete(id);
        await tx.objectStore('productLinks').delete(id);
        await tx.objectStore('activity').delete(id);
        await tx
          .objectStore('tombstones')
          .put({ deletedAt: now.toISOString() }, id);
        await snapshot(tx, now);
      });
    },
    async heartbeat(expectedRevision) {
      return mutate(async (tx, now) => {
        const config =
          (await tx.objectStore('settings').get('reminder')) || defaults;
        if (
          expectedRevision !== undefined &&
          config.revision !== expectedRevision
        )
          throw new Error('設定已更新，稍後重試同步');
        return snapshot(tx, now);
      });
    },
    outbox: () => db.getAll('outbox'),
    async acknowledge(id) {
      await db.delete('outbox', id);
    },
    async exportJSON() {
      return {
        schemaVersion: 2,
        exportedAt: clock().toISOString(),
        expenses: await db.getAll('expenses'),
        zeroDays: (await db.getAll('dailyStatus')).filter((v) => v.confirmed).map((v) => ({date:v.date, confirmed:true})),
        productLinks: (await Promise.all((await db.getAllKeys('productLinks')).map(async (expenseId) => ({ expenseId, productId: await db.get('productLinks',expenseId) })))),
      };
    },
    async previewImport(raw) {
      if (typeof raw === 'string' && raw.length > 10 * 1024 * 1024)
        throw new Error('備份超過 10 MB');
      const backup = backupSchema.parse(
        typeof raw === 'string' ? JSON.parse(raw) : raw,
      );
      const existing = new Set(await db.getAllKeys('expenses'));
      const tombstones = new Set(await db.getAllKeys('tombstones'));
      const seen = new Set(existing);
      const added = [];
      const restored = [];
      let duplicates = 0;
      for (const record of backup.expenses) {
        if (seen.has(record.id)) {
          duplicates++;
          continue;
        }
        seen.add(record.id);
        added.push(record);
        if (tombstones.has(record.id)) restored.push(record);
      }
      const token = crypto.randomUUID();
      previews.set(token, { import: added, zeroDays: backup.schemaVersion === 2 ? backup.zeroDays : [], productLinks: backup.schemaVersion === 2 ? backup.productLinks : [] });
      return { token, added, restored, duplicates };
    },
    async confirmImport(token) {
      const preview = previews.get(token);
      if (!preview?.import) throw new Error('匯入預覽已失效');
      previews.delete(token);
      try {
        return await mutate(async (tx) => {
          let count = 0;
          const restoredIds = new Set();
          for (const record of preview.import) {
            if (await tx.objectStore('expenses').get(record.id)) continue;
            await tx.objectStore('dailyStatus').delete(record.expenseDate);
            await tx
              .objectStore('expenses')
              .add({ ...record, origin: 'import' }, record.id);
            restoredIds.add(record.id);
            await tx.objectStore('tombstones').delete(record.id);
            count++;
          }
          for (const link of preview.productLinks || []) {
            if (restoredIds.has(link.expenseId)) await tx.objectStore('productLinks').put(link.productId, link.expenseId);
          }
          const config = (await tx.objectStore('settings').get('reminder')) || defaults;
          const today = localDate(clock(), config.timeZone);
          const current = await tx.objectStore('expenses').getAll();
          for (const zero of preview.zeroDays || []) {
            if (zero.date === today || current.some((e) => e.expenseDate === zero.date)) continue;
            if (!await tx.objectStore('dailyStatus').get(zero.date)) await tx.objectStore('dailyStatus').put({date:zero.date, confirmed:true, confirmedAt:null}, zero.date);
          }
          // Imported records and zero confirmations never create today's completion.
          return count;
        });
      } catch (error) {
        previews.set(token, preview);
        throw error;
      }
    },
  };
}

export function monthStats(expenses, month) {
  const records = expenses.filter((e) => e.expenseDate.startsWith(`${month}-`));
  const total = records.reduce((n, e) => n + BigInt(e.amount), 0n);
  const categories = new Map();
  for (const record of records)
    categories.set(
      record.category,
      (categories.get(record.category) || 0n) + BigInt(record.amount),
    );
  return { records, total, categories: [...categories] };
}
export function exportCSV(expenses) {
  const cell = (value) => {
    let text = String(value);
    if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const keys = [
    'id',
    'item',
    'amount',
    'category',
    'expenseDate',
    'createdAt',
    'updatedAt',
    'origin',
  ];
  return (
    '\uFEFF' +
    [
      keys.join(','),
      ...expenses.map((e) => keys.map((k) => cell(e[k])).join(',')),
    ].join('\r\n')
  );
}
