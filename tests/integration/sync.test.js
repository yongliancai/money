import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openLedger } from '../../client/src/storage/ledger.js';
import { createSync } from '../../client/src/services/sync.js';
import { localDate } from '../../shared/dates.js';

async function setup(t) {
  const ledger = await openLedger(crypto.randomUUID());
  t.after(() => ledger.db.close());
  await ledger.saveSettings({
    enabled: false,
    time: '21:00',
    timeZone: 'Asia/Taipei',
  });
  await ledger.confirm(
    ledger.preview([
      { item: '咖啡', amount: 55, category: '飲品', expenseDate: localDate() },
    ]).token,
  );
  return ledger;
}
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
test('network failure preserves unacknowledged outbox; retry clears acknowledged records only', async (t) => {
  const ledger = await setup(t);
  let fail = true;
  const sent = [];
  const sync = createSync(ledger, async (path, options) => {
    if (path.endsWith('register'))
      return response({
        deviceId: crypto.randomUUID(),
        deviceToken: 'test-only',
      });
    const body = JSON.parse(options.body || '{}');
    if (path.endsWith('sync')) {
      sent.push(body);
      if (fail) throw new Error('offline');
      return response({ eventId: body.eventId, revision: body.revision });
    }
    return response(body);
  });
  await assert.rejects(sync.sync(), /offline/);
  const queued = await ledger.outbox();
  assert.ok(queued.length >= 2);
  fail = false;
  await sync.sync();
  assert.equal((await ledger.outbox()).length, 0);
  assert.ok(sent.some((e) => e.eventId === queued[0].eventId));
  assert.equal(await ledger.isCompleted(), true);
});
test('forged acknowledgement never removes the event', async (t) => {
  const ledger = await setup(t);
  const sync = createSync(ledger, async (path, options) =>
    path.endsWith('register')
      ? response({ deviceId: crypto.randomUUID(), deviceToken: 'test' })
      : path.endsWith('sync')
        ? response({ eventId: 'wrong', revision: 999 })
        : response(JSON.parse(options.body)),
  );
  await assert.rejects(sync.sync(), /確認版本/);
  assert.ok((await ledger.outbox()).length > 0);
});
test('settings changed during sync preserve new events and abort stale snapshot', async (t) => {
  const ledger = await setup(t);
  let changed = false;
  const sync = createSync(ledger, async (path, options) => {
    if (path.endsWith('register'))
      return response({ deviceId: crypto.randomUUID(), deviceToken: 'test' });
    const body = JSON.parse(options.body);
    if (path.endsWith('settings') && !changed) {
      changed = true;
      await ledger.saveSettings({
        enabled: true,
        time: '22:00',
        timeZone: 'Asia/Taipei',
      });
    }
    return response(body);
  });
  await assert.rejects(sync.sync(), /設定已更新/);
  const config = await ledger.settings();
  assert.ok(
    (await ledger.outbox()).some((e) => e.settingsRevision === config.revision),
  );
});
test('revocation persists across clients and requires explicit reactivation', async (t) => {
  const ledger = await setup(t);
  let registrations = 0;
  const fetcher = async (path, options) => {
    if (path.endsWith('register')) {
      registrations++;
      return response({ deviceId: crypto.randomUUID(), deviceToken: 'test' });
    }
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    const body = JSON.parse(options.body);
    return response(
      path.endsWith('sync')
        ? { eventId: body.eventId, revision: body.revision }
        : body,
    );
  };
  const sync = createSync(ledger, fetcher);
  await sync.sync();
  await sync.revoke();
  const fresh = createSync(ledger, fetcher);
  await assert.rejects(fresh.sync(), /撤銷/);
  assert.equal(registrations, 1);
  await fresh.reactivate();
  await fresh.sync();
  assert.equal(registrations, 2);
  assert.equal((await ledger.list()).length, 1);
});

test('concurrent authenticated requests share one anonymous registration', async (t) => {
  const ledger = await setup(t);
  let count = 0;
  const sync = createSync(ledger, async (path) => {
    if (path.endsWith('register')) {
      count++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response({ deviceId: crypto.randomUUID(), deviceToken: 'test' });
    }
    return response({ ok: true });
  });
  await Promise.all([
    sync.request('/api/example'),
    sync.request('/api/example'),
  ]);
  assert.equal(count, 1);
});

test('device credentials are isolated by configured backend without changing ledger data', async (t) => {
  const ledger = await setup(t);
  let token = 0;
  const calls = [];
  const fetcher = async (path, options) => {
    if (path.endsWith('register'))
      return response({
        deviceId: crypto.randomUUID(),
        deviceToken: `test-${++token}`,
      });
    calls.push(options.headers.Authorization);
    return response({ ok: true });
  };
  await createSync(ledger, fetcher, {
    identityScope: 'https://first.example/',
  }).request('/api/example');
  await createSync(ledger, fetcher, {
    identityScope: 'https://second.example/',
  }).request('/api/example');
  assert.deepEqual(calls, ['Bearer test-1', 'Bearer test-2']);
  assert.equal((await ledger.list()).length, 1);
});
