import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { resolve } from 'node:path';
import {
  aiResultSchema,
  parseRequestSchema,
  settingsSchema,
  eventSchema,
  subscriptionSchema,
} from '../../shared/schemas/index.js';
import { localDate } from '../../shared/dates.js';
import { createParser } from './services/ai.js';

export function allowedEndpoint(endpoint) {
  const url = new URL(endpoint);
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    (url.hostname === 'fcm.googleapis.com' ||
      url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname === 'web.push.apple.com' ||
      url.hostname.endsWith('.push.apple.com'))
  );
}

export function createApp({
  store,
  clock = () => new Date(),
  aiMode = 'disabled',
  parse = createParser(aiMode),
  origin = 'http://127.0.0.1:5173',
  pushPublicKey = '',
  pushReady = false,
  policy = null,
  limits = true,
  parseTimeoutMs = 15000,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const requestOrigin = req.get('origin');
    if (requestOrigin && requestOrigin !== origin)
      return res.status(403).json({ error: '來源不允許' });
    if (requestOrigin === origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!requestOrigin) return res.sendStatus(400);
      const headers = (req.get('access-control-request-headers') || '')
        .toLowerCase()
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      if (
        headers.some(
          (h) => !['authorization', 'content-type', 'x-device-id'].includes(h),
        )
      )
        return res.sendStatus(403);
      res.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      res.set(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Device-Id',
      );
      return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: '24kb' }));
  if (limits)
    app.use(
      '/api',
      rateLimit({
        windowMs: 60000,
        limit: 180,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      }),
    );
  const registerLimit = limits
    ? rateLimit({
        windowMs: 3600000,
        limit: 10,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      })
    : (_req, _res, next) => next();
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', environment: 'isolated', schemaVersion: 1 }),
  );
  app.get('/api/config', (_req, res) =>
    res.json({
      aiMode,
      pushReady,
      pushPublicKey,
      reminderPolicyPending: !policy,
    }),
  );
  app.post('/api/devices/register', registerLimit, (req, res) => {
    z.object({}).strict().parse(req.body);
    res.status(201).json(store.register(clock()));
  });
  app.use('/api', (req, res, next) => {
    const deviceId = req.get('x-device-id');
    const bearer = req.get('authorization') || '';
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
    if (!deviceId || !store.authorize(deviceId, token))
      return res.status(401).json({ error: '裝置授權失效' });
    req.deviceId = deviceId;
    next();
  });
  const aiLimit = limits
    ? rateLimit({
        windowMs: 60000,
        limit: 10,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      })
    : (_req, _res, next) => next();
  app.post('/api/ai/parse', aiLimit, async (req, res) => {
    const input = parseRequestSchema.parse(req.body);
    let timer;
    const output = await Promise.race([
      Promise.resolve().then(() => parse(input)),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error('解析逾時，請改用手動記帳'), {
                status: 504,
              }),
            ),
          parseTimeoutMs,
        );
        timer.unref();
      }),
    ]).finally(() => clearTimeout(timer));
    const result = aiResultSchema.parse({
      drafts: output.drafts,
      unparsed: output.unparsed,
    });
    res.json({ ...result, mode: aiMode });
  });
  app.put('/api/reminders/settings', (req, res) => {
    const input = settingsSchema.parse(req.body);
    const current = store.get('settings', req.deviceId);
    if (current && input.revision < current.revision)
      return res
        .status(409)
        .json({ error: '設定版本過期', revision: current.revision });
    if (
      current &&
      input.revision === current.revision &&
      JSON.stringify(input) !== JSON.stringify(current)
    )
      return res.status(409).json({ error: '同版本設定衝突' });
    store.set('settings', req.deviceId, input);
    res.json(input);
  });
  app.post('/api/daily-status/sync', (req, res) => {
    const event = eventSchema.parse(req.body);
    const now = clock();
    const settings = store.get('settings', req.deviceId);
    if (
      !settings ||
      settings.revision !== event.settingsRevision ||
      settings.timeZone !== event.timeZone
    )
      return res.status(409).json({ error: '設定版本不一致' });
    if (
      new Date(event.occurredAt).valueOf() > now.valueOf() + 30000 ||
      localDate(new Date(event.occurredAt), event.timeZone) !==
        event.localDate ||
      event.localDate > localDate(now, event.timeZone)
    )
      return res.status(422).json({ error: '事件日期或裝置時鐘無效' });
    res.json(store.sync(req.deviceId, event, now));
  });
  app.post('/api/push/subscribe', (req, res) => {
    const subscription = subscriptionSchema.parse(req.body);
    if (!allowedEndpoint(subscription.endpoint))
      return res.status(422).json({ error: '推播端點不允許' });
    if (!pushReady)
      return res.status(503).json({ error: '本機推播服務未設定' });
    store.set('subscriptions', req.deviceId, subscription);
    res.status(201).json({ subscribed: true });
  });
  app.delete('/api/push/subscribe', (req, res) => {
    store.unsubscribe(req.deviceId);
    res.json({ subscribed: false });
  });
  app.delete('/api/devices/current', (req, res) => {
    store.revoke(req.deviceId);
    res.status(204).end();
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API 不存在' }));
  app.get('/sw.js', (_req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
  });
  app.use(express.static(resolve('dist')));
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(422).json({
        error: '資料格式無效',
        fields: error.issues.map((x) => ({
          path: x.path.join('.'),
          message: x.message,
        })),
      });
    const status = error.status || 500;
    res.status(status).json({
      error:
        status < 500 || [503, 504].includes(status)
          ? error.message
          : '服務暫時無法使用，請稍後重試',
    });
  });
  return app;
}
