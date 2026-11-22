import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openLedger } from '../../client/src/storage/ledger.js';

const entry = (date = '2026-11-22') => ({
  item: '無糖豆漿',
  amount: 35,
  category: '餐飲',
  expenseDate: date,
});
async function fixture(t) {
  let now = new Date('2026-11-22T04:00:00Z');
  const ledger = await openLedger(crypto.randomUUID(), () => now);
  t.after(() => ledger.db.close());
  return {
    ledger,
    setNow: (v) => {
      now = new Date(v);
    },
  };
}
test('zero-spend confirmation counts today, cancellation removes completion, and rejects a dated expense', async (t) => {
  const { ledger } = await fixture(t);
  assert.equal(await ledger.isCompleted(), false);
  await ledger.confirmZeroSpend();
  assert.equal(await ledger.isCompleted(), true);
  assert.deepEqual(await ledger.zeroDays(), ['2026-11-22']);
  await ledger.clearZeroSpend('2026-11-22');
  assert.equal(await ledger.isCompleted(), false);
  await ledger.confirm(ledger.preview([entry()], 'manual').token);
  await assert.rejects(ledger.confirmZeroSpend(), /已有消費/);
});
test('new expense invalidates zero-day confirmation, imported record cannot count today completed', async (t) => {
  const { ledger } = await fixture(t);
  await ledger.confirmZeroSpend();
  const [old] = await ledger.confirm(ledger.preview([entry()], 'manual').token);
  assert.deepEqual(await ledger.zeroDays(), []);
  await ledger.remove(old.id);
  assert.equal(await ledger.isCompleted(), false);
  const backup = {
    schemaVersion: 1,
    exportedAt: '2026-11-22T04:00:00Z',
    expenses: [old],
  };
  await ledger.confirmImport((await ledger.previewImport(backup)).token);
  assert.equal(await ledger.isCompleted(), false);
});
test('confirmed product links survive v2 backup, v1 remains importable', async (t) => {
  const { ledger } = await fixture(t);
  const records = await ledger.confirm(
    ledger.preview([entry('2026-11-20'), entry('2026-11-21')], 'manual').token,
  );
  const group = await ledger.linkProducts(records.map((x) => x.id));
  const links = await ledger.productLinks();
  assert.equal(links[records[0].id], group);
  assert.equal(links[records[1].id], group);
  await ledger.confirmZeroSpend('2026-11-19');
  const backup = await ledger.exportJSON();
  assert.equal(backup.schemaVersion, 2);
  const fresh = await openLedger(crypto.randomUUID());
  t.after(() => fresh.db.close());
  await fresh.confirmImport((await fresh.previewImport(backup)).token);
  assert.equal((await fresh.zeroDays()).includes('2026-11-19'), true);
  assert.equal((await fresh.productLinks())[records[1].id], group);
  assert.equal(await fresh.isCompleted(), false);
  await assert.rejects(ledger.linkProducts([records[0].id, records[0].id]));
});
test('database v1 upgrades in place without losing the expenses', async (t) => {
  const name = crypto.randomUUID();
  const { openDB } = await import('idb');
  const first = await openDB(name, 1, {
    upgrade(db) {
      for (const name of [
        'expenses',
        'settings',
        'activity',
        'outbox',
        'meta',
        'tombstones',
      ])
        db.createObjectStore(name);
    },
  });
  first.close();
  const ledger = await openLedger(name);
  t.after(() => ledger.db.close());
  assert.ok(ledger.db.objectStoreNames.contains('dailyStatus'));
  assert.ok(ledger.db.objectStoreNames.contains('productLinks'));
});
