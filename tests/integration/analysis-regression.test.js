import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDB } from 'idb';
import { openLedger } from '../../client/src/storage/ledger.js';
import { backupSchema, eventSchema } from '../../shared/schemas/index.js';

const draft = (date = '2026-11-22', amount = 40) => ({
  item: '豆漿',
  amount,
  category: '餐飲',
  expenseDate: date,
});
async function fixture(t, name = crypto.randomUUID()) {
  let now = new Date('2026-11-22T04:00:00Z');
  const ledger = await openLedger(name, () => now);
  await ledger.saveSettings({
    enabled: false,
    time: '21:00',
    timeZone: 'Asia/Taipei',
  });
  t.after(() => ledger.db.close());
  return {
    ledger,
    setNow: (value) => {
      now = new Date(value);
    },
  };
}
const add = (ledger, date, amount) =>
  ledger.confirm(ledger.preview([draft(date, amount)], 'manual').token);
const latest = async (ledger) =>
  (await ledger.outbox())
    .sort(
      (a, b) =>
        a.localDate.localeCompare(b.localDate) || a.revision - b.revision,
    )
    .at(-1);
const backup = (extras = {}) => ({
  schemaVersion: 2,
  exportedAt: '2026-11-22T04:00:00Z',
  expenses: [],
  zeroDays: [],
  productLinks: [],
  ...extras,
});

test('editing an old record onto today invalidates zero status and snapshots incomplete atomically', async (t) => {
  const { ledger, setNow } = await fixture(t);
  const [record] = await add(ledger, '2026-11-20');
  const createdAt = record.createdAt;
  setNow('2026-11-23T04:00:00Z');
  await ledger.confirmZeroSpend('2026-11-23');
  await ledger.update(record.id, draft('2026-11-23', 55));
  assert.deepEqual(await ledger.zeroDays(), []);
  assert.equal(await ledger.isCompleted(), false);
  assert.equal((await latest(ledger)).completed, false);
  assert.equal((await latest(ledger)).localDate, '2026-11-23');
  assert.equal(eventSchema.safeParse(await latest(ledger)).success, true);
  assert.equal((await ledger.list())[0].createdAt, createdAt);
});

test('import invalidates zero status and updates sync without creating completion activity', async (t) => {
  const { ledger } = await fixture(t);
  const source = await fixture(t);
  await add(source.ledger, '2026-11-22');
  await ledger.confirmZeroSpend();
  await ledger.confirmImport(
    (await ledger.previewImport(await source.ledger.exportJSON())).token,
  );
  assert.equal(await ledger.isCompleted(), false);
  assert.equal((await latest(ledger)).completed, false);
  assert.deepEqual(await ledger.db.getAll('activity'), []);
});

test('imported zero days never complete today after clock advance or timezone change', async (t) => {
  const { ledger, setNow } = await fixture(t);
  await ledger.confirmImport(
    (
      await ledger.previewImport(
        backup({ zeroDays: [{ date: '2026-11-23', confirmed: true }] }),
      )
    ).token,
  );
  setNow('2026-11-23T04:00:00Z');
  assert.equal(await ledger.isCompleted(), false);
  await ledger.confirmZeroSpend('2026-11-23');
  assert.equal(await ledger.isCompleted(), true);
  const exported = backupSchema.parse(await ledger.exportJSON());
  await ledger.clearZeroSpend('2026-11-23');
  await ledger.confirmImport((await ledger.previewImport(exported)).token);
  assert.equal(await ledger.isCompleted(), false);
});

test('renaming a linked item removes stale identity; amount/date edits keep explicit identity', async (t) => {
  const { ledger } = await fixture(t);
  const a = (await add(ledger, '2026-11-20'))[0],
    b = (await add(ledger, '2026-11-21'))[0];
  await ledger.linkProducts([a.id, b.id]);
  await ledger.update(b.id, draft('2026-11-21', 50));
  assert.ok((await ledger.productLinks())[b.id]);
  await ledger.update(b.id, { ...draft('2026-11-21'), item: '另一種容量豆漿' });
  assert.equal((await ledger.productLinks())[b.id], undefined);
});

test('imported group identifier collision cannot silently join unrelated existing product', async (t) => {
  const { ledger } = await fixture(t);
  const a = (await add(ledger, '2026-11-19'))[0],
    b = (await add(ledger, '2026-11-20'))[0];
  const group = await ledger.linkProducts([a.id, b.id]);
  const c = { ...a, id: crypto.randomUUID(), item: '不相關商品' },
    d = { ...b, id: crypto.randomUUID(), item: '不相關商品' };
  await ledger.confirmImport(
    (
      await ledger.previewImport(
        backup({
          expenses: [c, d],
          productLinks: [
            { expenseId: c.id, productId: group },
            { expenseId: d.id, productId: group },
          ],
        }),
      )
    ).token,
  );
  const links = await ledger.productLinks();
  assert.equal(links[a.id], group);
  assert.equal(links[c.id], links[d.id]);
  assert.notEqual(links[c.id], group);
});

test('ambiguous or orphan backup relationships fail validation before any write', async (t) => {
  const { ledger } = await fixture(t);
  const [a] = await add(ledger);
  const group = crypto.randomUUID();
  await assert.rejects(
    ledger.previewImport(
      backup({
        expenses: [a],
        productLinks: [
          { expenseId: a.id, productId: group },
          { expenseId: a.id, productId: crypto.randomUUID() },
        ],
      }),
    ),
  );
  await assert.rejects(
    ledger.previewImport(
      backup({
        productLinks: [{ expenseId: crypto.randomUUID(), productId: group }],
      }),
    ),
  );
  assert.deepEqual(await ledger.productLinks(), {});
});

test('same-day concurrent zero confirmation versus expense insert never leaves a conflict', async (t) => {
  const name = crypto.randomUUID();
  const { ledger: a } = await fixture(t, name),
    { ledger: b } = await fixture(t, name);
  await Promise.allSettled([a.confirmZeroSpend(), add(b, '2026-11-22')]);
  assert.equal((await a.list()).length, 1);
  assert.deepEqual(await a.zeroDays(), []);
});

test('import failure rolls back expenses, zero status, product links, revisions and outbox; token can retry', async (t) => {
  const { ledger } = await fixture(t);
  await ledger.confirmZeroSpend();
  const existing = await ledger.exportJSON(),
    events = await ledger.outbox();
  const expense = {
    ...draft(),
    id: crypto.randomUUID(),
    createdAt: '2026-11-22T04:00:00Z',
    updatedAt: '2026-11-22T04:00:00Z',
    origin: 'manual',
    schemaVersion: 1,
  };
  const preview = await ledger.previewImport(
    backup({
      expenses: [expense],
      productLinks: [{ expenseId: expense.id, productId: crypto.randomUUID() }],
    }),
  );
  const original = IDBObjectStore.prototype.put;
  const mock = t.mock.method(
    IDBObjectStore.prototype,
    'put',
    function (value, key) {
      if (this.name === 'productLinks')
        throw new DOMException('simulated quota', 'QuotaExceededError');
      return original.call(this, value, key);
    },
  );
  await assert.rejects(ledger.confirmImport(preview.token), /simulated quota/);
  assert.deepEqual(await ledger.exportJSON(), existing);
  assert.deepEqual(await ledger.outbox(), events);
  mock.mock.restore();
  assert.equal(await ledger.confirmImport(preview.token), 1);
  assert.equal(await ledger.isCompleted(), false);
});

test('v1 upgrade retains real records and activity and permits CRUD and v1/v2 round trips', async (t) => {
  const name = crypto.randomUUID();
  const first = await openDB(name, 1, {
    upgrade(db) {
      for (const store of [
        'expenses',
        'settings',
        'activity',
        'outbox',
        'meta',
        'tombstones',
      ])
        db.createObjectStore(store);
    },
  });
  const old = {
    ...draft(),
    id: crypto.randomUUID(),
    createdAt: '2026-11-21T04:00:00Z',
    updatedAt: '2026-11-21T04:00:00Z',
    origin: 'manual',
    schemaVersion: 1,
  };
  await first.put('expenses', old, old.id);
  await first.put('activity', { createdAt: old.createdAt }, old.id);
  first.close();
  const { ledger } = await fixture(t, name);
  assert.deepEqual(await ledger.list(), [old]);
  assert.equal(await ledger.isCompleted(), false);
  await ledger.update(old.id, draft('2026-11-22', 60));
  assert.equal((await ledger.list())[0].createdAt, old.createdAt);
  const v2 = backupSchema.parse(await ledger.exportJSON());
  await ledger.remove(old.id);
  assert.equal(await ledger.isCompleted(), false);
  const v1 = {
    schemaVersion: 1,
    exportedAt: v2.exportedAt,
    expenses: v2.expenses,
  };
  await ledger.confirmImport((await ledger.previewImport(v1)).token);
  assert.equal((await ledger.list())[0].amount, 60);
  assert.equal(await ledger.isCompleted(), false);
});

test('backup and analysis snapshots cannot mix expenses and links across concurrent deletion', async (t) => {
  const { ledger } = await fixture(t);
  const [a] = await add(ledger, '2026-11-20');
  const [b] = await add(ledger, '2026-11-21');
  await ledger.linkProducts([a.id, b.id]);
  const exporting = ledger.exportJSON();
  const removing = ledger.remove(b.id);
  const exported = await exporting;
  await removing;
  assert.ok(exported.expenses.some((e) => e.id === b.id));
  assert.ok(exported.productLinks.some((e) => e.expenseId === b.id));
  const after = await ledger.analysisSnapshot();
  assert.equal(
    after.expenses.some((e) => e.id === b.id),
    false,
  );
  assert.equal(after.links[b.id], undefined);
});

test('existing product groups never silently merge and failed linking does not partially change them', async (t) => {
  const { ledger } = await fixture(t);
  const records = await ledger.confirm(
    ledger.preview(
      Array.from({ length: 4 }, (_, i) => draft(`2026-11-${10 + i}`)),
      'manual',
    ).token,
  );
  const a = await ledger.linkProducts(records.slice(0, 2).map((e) => e.id));
  const b = await ledger.linkProducts(records.slice(2).map((e) => e.id));
  await assert.rejects(
    ledger.linkProducts([records[0].id, records[2].id]),
    /不同商品群組/,
  );
  const links = await ledger.productLinks();
  assert.equal(links[records[0].id], a);
  assert.equal(links[records[2].id], b);
  await ledger.unlinkProduct(records[2].id);
  await ledger.linkProducts([records[0].id, records[2].id]);
  assert.equal((await ledger.productLinks())[records[2].id], a);
  assert.equal((await ledger.productLinks())[records[3].id], b);
});

test('an ID inserted by a second tab after import preview retains its local data and relationship', async (t) => {
  const { ledger } = await fixture(t);
  const [a] = await add(ledger, '2026-11-20'),
    [b] = await add(ledger, '2026-11-21');
  const group = await ledger.linkProducts([a.id, b.id]);
  const changed = { ...a, id: crypto.randomUUID(), amount: 999 };
  const preview = await ledger.previewImport(
    backup({
      expenses: [changed],
      productLinks: [{ expenseId: changed.id, productId: crypto.randomUUID() }],
    }),
  );
  const other = await openLedger(ledger.db.name);
  t.after(() => other.db.close());
  await other.db.put('expenses', { ...changed, amount: 40 }, changed.id);
  await other.linkProducts([a.id, changed.id]);
  await ledger.confirmImport(preview.token);
  assert.equal(
    (await ledger.list()).find((e) => e.id === changed.id).amount,
    40,
  );
  assert.equal((await ledger.productLinks())[changed.id], group);
});

test('blocked v1 upgrade reports the other open tab and completes without discarding records', async (t) => {
  const name = crypto.randomUUID();
  const old = await openDB(name, 1, {
    upgrade(db) {
      for (const store of [
        'expenses',
        'settings',
        'activity',
        'outbox',
        'meta',
        'tombstones',
      ])
        db.createObjectStore(store);
    },
  });
  let calls = 0;
  const upgrading = openLedger(name, undefined, () => {
    calls++;
    old.close();
  });
  const ledger = await upgrading;
  t.after(() => ledger.db.close());
  assert.equal(calls, 1);
  assert.equal(ledger.db.version, 2);
});
