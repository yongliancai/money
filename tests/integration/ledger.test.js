import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openLedger, monthStats } from '../../client/src/storage/ledger.js';

const draft = {
  item: '午餐',
  amount: 120,
  category: '餐飲',
  expenseDate: '2026-10-31',
};
async function fixture(t) {
  let now = new Date('2026-11-22T04:00:00Z');
  const ledger = await openLedger(crypto.randomUUID(), () => now);
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
test('AI preview and cancel cannot save; confirmation commits only once under concurrent clicks', async (t) => {
  const { ledger } = await fixture(t);
  const cancelled = ledger.preview([draft]);
  assert.equal((await ledger.list()).length, 0);
  ledger.cancel(cancelled.token);
  await assert.rejects(ledger.confirm(cancelled.token));
  const preview = ledger.preview([draft]);
  const result = await Promise.allSettled([
    ledger.confirm(preview.token),
    ledger.confirm(preview.token),
  ]);
  assert.equal(result.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await ledger.list()).length, 1);
  assert.equal(await ledger.isCompleted(), true);
  assert.equal(
    (await ledger.outbox()).sort((a, b) => a.revision - b.revision).at(-1)
      .completed,
    true,
  );
});
test('today creation counts past expenseDate; createdAt immutable; editing older record never completes today', async (t) => {
  const { ledger, setNow } = await fixture(t);
  const [record] = await ledger.confirm(
    ledger.preview([draft], 'manual').token,
  );
  assert.equal(await ledger.isCompleted(), true);
  assert.equal(monthStats(await ledger.list(), '2026-11').total, 0n);
  setNow('2026-11-23T04:00:00Z');
  assert.equal(await ledger.isCompleted(), false);
  await ledger.update(record.id, { ...draft, amount: 200 });
  assert.equal((await ledger.list())[0].createdAt, record.createdAt);
  assert.equal(await ledger.isCompleted(), false);
});
test('deleting all today-created records returns incomplete atomically with an outbox snapshot', async (t) => {
  const { ledger } = await fixture(t);
  const records = await ledger.confirm(
    ledger.preview([draft, { ...draft, item: '茶' }]).token,
  );
  await ledger.remove(records[0].id);
  assert.equal(await ledger.isCompleted(), true);
  await ledger.remove(records[1].id);
  assert.equal(await ledger.isCompleted(), false);
  const events = (await ledger.outbox()).sort(
    (a, b) => a.revision - b.revision,
  );
  assert.equal(events.at(-1).completed, false);
  assert.equal(events.at(-1).revision, 4);
});
test('backup preview, cancellation, restore disclosure, merge and dedup never mark today completed', async (t) => {
  const { ledger } = await fixture(t);
  const [record] = await ledger.confirm(ledger.preview([draft]).token);
  const backup = await ledger.exportJSON();
  await ledger.remove(record.id);
  assert.equal(await ledger.isCompleted(), false);
  const preview = await ledger.previewImport(backup);
  assert.equal(preview.restored.length, 1);
  assert.equal((await ledger.list()).length, 0);
  ledger.cancel(preview.token);
  await assert.rejects(ledger.confirmImport(preview.token));
  const importPreview = await ledger.previewImport({
    ...backup,
    expenses: [...backup.expenses, ...backup.expenses],
  });
  assert.equal(importPreview.duplicates, 1);
  assert.equal(await ledger.confirmImport(importPreview.token), 1);
  assert.equal(await ledger.isCompleted(), false);
  assert.equal((await ledger.list())[0].origin, 'import');
  assert.equal((await ledger.list())[0].createdAt, record.createdAt);
  const duplicate = await ledger.previewImport({
    ...backup,
    expenses: [{ ...record, amount: 999 }],
  });
  assert.equal(duplicate.added.length, 0);
  await ledger.confirmImport(duplicate.token);
  assert.equal((await ledger.list())[0].amount, 120);
});
test('invalid batch aborts without partial records or outbox; import version and dates fail', async (t) => {
  const { ledger } = await fixture(t);
  const before = await ledger.outbox();
  const preview = ledger.preview([draft]);
  await assert.rejects(
    ledger.confirm(preview.token, [draft, { ...draft, amount: -1 }]),
  );
  assert.equal((await ledger.list()).length, 0);
  assert.deepEqual(await ledger.outbox(), before);
  await assert.rejects(ledger.previewImport('{bad'));
  await assert.rejects(
    ledger.previewImport({ schemaVersion: 99, expenses: [] }),
  );
});
test('backup restoration into a new database is lossless except import provenance, including Unicode', async (t) => {
  const { ledger } = await fixture(t);
  await ledger.confirm(
    ledger.preview([{ ...draft, item: '咖啡☕, "大杯"' }]).token,
  );
  const backup = await ledger.exportJSON();
  const fresh = await openLedger(crypto.randomUUID());
  t.after(() => fresh.db.close());
  await fresh.confirmImport(
    (await fresh.previewImport(JSON.stringify(backup))).token,
  );
  const restored = await fresh.list();
  assert.deepEqual(
    restored,
    backup.expenses.map((e) => ({ ...e, origin: 'import' })),
  );
  assert.equal(await fresh.isCompleted(), false);
});
test('shared IDB multi-connection writes serialize revisions; timezone recomputes active creation dates', async (t) => {
  const name = crypto.randomUUID();
  const now = () => new Date('2026-11-22T16:30:00Z');
  const a = await openLedger(name, now);
  const b = await openLedger(name, now);
  t.after(() => {
    a.db.close();
    b.db.close();
  });
  await a.saveSettings({
    enabled: false,
    time: '21:00',
    timeZone: 'Asia/Taipei',
  });
  await Promise.all([
    a.confirm(a.preview([draft]).token),
    b.confirm(b.preview([draft]).token),
  ]);
  const revisions = (await a.outbox()).map((e) => e.revision);
  assert.equal(new Set(revisions).size, revisions.length);
  await b.saveSettings({
    enabled: false,
    time: '21:00',
    timeZone: 'America/Los_Angeles',
  });
  assert.equal(await a.isCompleted(), true);
  const events = await a.outbox();
  assert.ok(
    events.some(
      (e) =>
        e.localDate === '2026-11-22' && e.timeZone === 'America/Los_Angeles',
    ),
  );
});

test('storage failure after expense insert rolls back expense, activity, revision and outbox together', async (t) => {
  const { ledger } = await fixture(t);
  const before = await ledger.outbox();
  const preview = ledger.preview([draft]);
  const original = IDBObjectStore.prototype.put;
  t.mock.method(IDBObjectStore.prototype, 'put', function (value, key) {
    if (this.name === 'outbox')
      throw new DOMException('test quota', 'QuotaExceededError');
    return original.call(this, value, key);
  });
  await assert.rejects(ledger.confirm(preview.token), /test quota/);
  assert.equal((await ledger.list()).length, 0);
  assert.equal(await ledger.isCompleted(), false);
  assert.deepEqual(await ledger.outbox(), before);
});
