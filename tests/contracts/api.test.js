import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp, allowedEndpoint } from '../../server/src/app.js';
import { openDatabase } from '../../server/src/db/database.js';

const now = new Date('2026-11-22T13:00:00Z');
const settings = {
  enabled: true,
  time: '21:00',
  timeZone: 'Asia/Taipei',
  revision: 1,
};
const event = {
  eventId: 'e16eb869-3fa1-4b1b-9a09-15f06acc8458',
  localDate: '2026-11-22',
  timeZone: 'Asia/Taipei',
  revision: 1,
  completed: true,
  occurredAt: now.toISOString(),
  settingsRevision: 1,
};
async function setup(t, options = {}) {
  const store = openDatabase();
  t.after(() => store.close());
  const app = createApp({
    store,
    clock: () => now,
    aiMode: 'demo',
    limits: false,
    ...options,
  });
  const identity = (
    await request(app).post('/api/devices/register').send({}).expect(201)
  ).body;
  const auth = {
    'x-device-id': identity.deviceId,
    Authorization: `Bearer ${identity.deviceToken}`,
  };
  return { app, store, auth, identity };
}
test('health, anonymous registration, hashed tokens, auth required and cross-device isolation', async (t) => {
  const { app, store, auth, identity } = await setup(t);
  await request(app).get('/api/health').expect(200);
  assert.notEqual(
    store.db.prepare('SELECT token_hash FROM devices').get().token_hash,
    identity.deviceToken,
  );
  await request(app).put('/api/reminders/settings').send(settings).expect(401);
  const other = (
    await request(app).post('/api/devices/register').send({}).expect(201)
  ).body;
  await request(app)
    .put('/api/reminders/settings')
    .set({ ...auth, 'x-device-id': other.deviceId })
    .send(settings)
    .expect(401);
  await request(app)
    .put('/api/reminders/settings')
    .set(auth)
    .send(settings)
    .expect(200);
  await request(app).delete('/api/devices/current').set(auth).expect(204);
  await request(app)
    .put('/api/reminders/settings')
    .set(auth)
    .send(settings)
    .expect(401);
});
test('API schema rejects expense payload, future timestamps, impossible dates and stale settings', async (t) => {
  const { app, auth } = await setup(t);
  await request(app)
    .put('/api/reminders/settings')
    .set(auth)
    .send(settings)
    .expect(200);
  await request(app)
    .post('/api/daily-status/sync')
    .set(auth)
    .send({ ...event, expenses: [] })
    .expect(422);
  await request(app)
    .post('/api/daily-status/sync')
    .set(auth)
    .send({
      ...event,
      occurredAt: '2026-11-23T13:00:00Z',
      localDate: '2026-11-23',
    })
    .expect(422);
  await request(app)
    .post('/api/daily-status/sync')
    .set(auth)
    .send({ ...event, localDate: '2026-02-30' })
    .expect(422);
  await request(app)
    .put('/api/reminders/settings')
    .set(auth)
    .send({ ...settings, revision: 2, timeZone: 'America/Los_Angeles' })
    .expect(200);
  await request(app)
    .post('/api/daily-status/sync')
    .set(auth)
    .send(event)
    .expect(409);
  await request(app)
    .put('/api/reminders/settings')
    .set(auth)
    .send(settings)
    .expect(409);
});
test('sync acknowledgements are idempotent and keep max revision', async (t) => {
  const { app, auth, store, identity } = await setup(t);
  await request(app)
    .put('/api/reminders/settings')
    .set(auth)
    .send(settings)
    .expect(200);
  const send = (payload) =>
    request(app)
      .post('/api/daily-status/sync')
      .set(auth)
      .send(payload)
      .expect(200);
  assert.equal((await send({ ...event, revision: 3 })).body.accepted, true);
  assert.equal((await send({ ...event, revision: 3 })).body.accepted, false);
  const ack = await send({
    ...event,
    eventId: crypto.randomUUID(),
    revision: 2,
    completed: false,
  });
  assert.equal(ack.body.revision, 3);
  assert.equal(
    store.status(identity.deviceId, event.localDate).completed,
    true,
  );
});
test('AI route validates request and output; disabled provider fails with usable fallback', async (t) => {
  const { app, auth } = await setup(t);
  const result = await request(app)
    .post('/api/ai/parse')
    .set(auth)
    .send({ text: '昨天午餐120、今天咖啡55', referenceDate: '2026-11-22' })
    .expect(200);
  assert.equal(result.body.drafts.length, 2);
  assert.equal(result.body.mode, 'demo');
  await request(app)
    .post('/api/ai/parse')
    .set(auth)
    .send({ text: '', referenceDate: '2026-11-22' })
    .expect(422);
  const bad = await setup(t, {
    parse: async () => ({ drafts: [{ item: 'x', amount: -1 }], unparsed: [] }),
  });
  await request(bad.app)
    .post('/api/ai/parse')
    .set(bad.auth)
    .send({ text: 'x', referenceDate: '2026-11-22' })
    .expect(422);
  const disabled = await setup(t, { aiMode: 'disabled' });
  const error = await request(disabled.app)
    .post('/api/ai/parse')
    .set(disabled.auth)
    .send({ text: 'x', referenceDate: '2026-11-22' })
    .expect(503);
  assert.match(error.body.error, /手動/);
});
test('SSRF push endpoint guard, malformed JSON, body size, origin and security headers', async (t) => {
  const { app, auth } = await setup(t);
  for (const url of [
    'https://127.0.0.1/private',
    'http://web.push.apple.com/x',
    'https://web.push.apple.com.evil.test/x',
    'https://user@web.push.apple.com/x',
    'https://fcm.googleapis.com:444/x',
  ])
    assert.equal(allowedEndpoint(url), false);
  for (const url of [
    'https://fcm.googleapis.com/fcm/send/x',
    'https://web.push.apple.com/Q',
    'https://updates.push.services.mozilla.com/wpush/v2/test',
  ])
    assert.equal(allowedEndpoint(url), true);
  const payload = {
    endpoint: 'https://127.0.0.1/internal',
    keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
  };
  await request(app)
    .post('/api/push/subscribe')
    .set(auth)
    .send(payload)
    .expect(422);
  await request(app)
    .post('/api/push/subscribe')
    .set(auth)
    .send({ ...payload, endpoint: 'https://fcm.googleapis.com/fcm/send/x' })
    .expect(503);
  await request(app)
    .post('/api/devices/register')
    .set('Origin', 'https://evil.test')
    .send({})
    .expect(403);
  await request(app)
    .post('/api/ai/parse')
    .set(auth)
    .send({ text: 'x'.repeat(30000) })
    .expect(413);
  await request(app)
    .post('/api/ai/parse')
    .set(auth)
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
  const health = await request(app).get('/api/health');
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.ok(health.headers['content-security-policy']);
});
test('registration rate limiter is enforced', async (t) => {
  const store = openDatabase();
  t.after(() => store.close());
  const app = createApp({ store });
  for (let i = 0; i < 10; i++)
    await request(app).post('/api/devices/register').send({}).expect(201);
  await request(app).post('/api/devices/register').send({}).expect(429);
});

test('AI provider timeout returns 504 without writing any ledger data', async (t) => {
  const { app, auth, store } = await setup(t, {
    parse: () => new Promise(() => {}),
    parseTimeoutMs: 10,
  });
  const result = await request(app)
    .post('/api/ai/parse')
    .set(auth)
    .send({ text: '午餐120', referenceDate: '2026-11-22' })
    .expect(504);
  assert.match(result.body.error, /手動/);
  assert.equal(
    store.db.prepare('SELECT count(*) AS n FROM statuses').get().n,
    0,
  );
});

test('independent HTTPS frontend CORS preflight is scoped to one approved origin and explicit headers', async (t) => {
  const { app } = await setup(t, { origin: 'https://yongliancai.github.io' });
  const result = await request(app)
    .options('/api/daily-status/sync')
    .set('Origin', 'https://yongliancai.github.io')
    .set('Access-Control-Request-Method', 'POST')
    .set(
      'Access-Control-Request-Headers',
      'authorization,content-type,x-device-id',
    )
    .expect(204);
  assert.equal(
    result.headers['access-control-allow-origin'],
    'https://yongliancai.github.io',
  );
  assert.ok(result.headers.vary.includes('Origin'));
  assert.equal(result.headers['access-control-allow-credentials'], undefined);
  await request(app)
    .options('/api/daily-status/sync')
    .set('Origin', 'https://evil.test')
    .expect(403);
  await request(app)
    .options('/api/daily-status/sync')
    .set('Origin', 'https://yongliancai.github.io')
    .set('Access-Control-Request-Headers', 'x-unapproved')
    .expect(403);
  await request(app)
    .post('/api/daily-status/sync')
    .set('Origin', 'https://yongliancai.github.io')
    .send({})
    .expect(401);
});
