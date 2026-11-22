import webPush from 'web-push';
import { openDatabase } from './db/database.js';
import { createApp } from './app.js';
import { runScheduler } from './jobs/scheduler.js';

const store = openDatabase(process.env.DB_PATH || 'data/reminders.sqlite');
const pushReady =
  process.env.PUSH_MODE === 'live' &&
  !!process.env.VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_SUBJECT;
if (pushReady)
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
const maxAgeSeconds = Number(process.env.REMINDER_MAX_AGE_SECONDS);
const debounceSeconds = Number(process.env.REMINDER_DEBOUNCE_SECONDS);
const policy =
  process.env.REMINDER_MAX_AGE_SECONDS &&
  process.env.REMINDER_DEBOUNCE_SECONDS &&
  Number.isFinite(maxAgeSeconds) &&
  maxAgeSeconds > 0 &&
  Number.isFinite(debounceSeconds) &&
  debounceSeconds >= 0
    ? { maxAgeSeconds, debounceSeconds }
    : null;
const app = createApp({
  store,
  aiMode: process.env.AI_MODE || 'disabled',
  origin:
    process.env.APP_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`,
  pushPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  pushReady,
  policy,
});
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || '127.0.0.1',
  () =>
    console.log(
      `Isolated API: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`,
    ),
);
let running = false;
const timer = setInterval(async () => {
  if (!pushReady || running) return;
  running = true;
  try {
    const counts = await runScheduler({
      store,
      policy,
      send: (subscription, payload) =>
        webPush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 60,
          timeout: 10000,
        }),
    });
    console.log(JSON.stringify({ scheduler: counts }));
  } catch {
    console.error('Scheduler failed; inspect local configuration.');
  } finally {
    running = false;
  }
}, 15000);
function stop() {
  clearInterval(timer);
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
