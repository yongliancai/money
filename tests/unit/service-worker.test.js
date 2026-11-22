import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('service worker ignores previous-day and invalid push; shows only current local-date payload', async () => {
  const handlers = {};
  const notifications = [];
  let time = '2026-11-22T16:01:00Z';
  class Clock extends Date {
    constructor(...args) {
      super(...(args.length ? args : [time]));
    }
  }
  const sandbox = {
    Date: Clock,
    Intl,
    URL,
    Response,
    self: {
      addEventListener: (name, fn) => {
        handlers[name] = fn;
      },
      registration: {
        showNotification: async (title, options) =>
          notifications.push({ title, options }),
      },
      location: { origin: 'https://isolated.test' },
    },
  };
  vm.runInNewContext(
    readFileSync('client/public/sw.js', 'utf8').replace(
      "'__APP_BASE__'",
      "'/'",
    ),
    sandbox,
  );
  const deliver = async (payload) => {
    let pending;
    handlers.push({
      data: { json: () => payload },
      waitUntil: (promise) => {
        pending = promise;
      },
    });
    await pending;
  };
  await deliver({ localDate: '2026-11-22', timeZone: 'Asia/Taipei' });
  assert.equal(notifications.length, 0);
  await deliver({
    localDate: '2026-11-23',
    timeZone: 'Asia/Taipei',
    url: 'https://evil.test',
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].options.data.url, '/');
  await deliver({ localDate: '2026-11-23', timeZone: 'invalid' });
  assert.equal(notifications.length, 1);
  time = '2026-11-23T16:01:00Z';
  await deliver({ localDate: '2026-11-23', timeZone: 'Asia/Taipei' });
  assert.equal(notifications.length, 1);
});

test('subpath notification click never focuses another repository or returns to origin root', async () => {
  const handlers = {};
  const opened = [];
  const source = readFileSync('client/public/sw.js', 'utf8').replace(
    "'__APP_BASE__'",
    "'/money/'",
  );
  const sandbox = {
    URL,
    Intl,
    Response,
    Date,
    self: {
      addEventListener: (name, fn) => {
        handlers[name] = fn;
      },
      location: { origin: 'https://owner.github.io' },
      clients: {
        matchAll: async () => [
          {
            url: 'https://owner.github.io/other/',
            focus: () => assert.fail('other app focused'),
          },
        ],
        openWindow: async (url) => opened.push(url),
      },
    },
  };
  vm.runInNewContext(source, sandbox);
  let pending;
  handlers.notificationclick({
    notification: { close() {} },
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.deepEqual(opened, ['/money/']);
});
