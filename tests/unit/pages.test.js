import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSiteBase,
  frontendConfig,
  normalizeBase,
} from '../../shared/site-config.js';
import { createApi } from '../../client/src/services/api.js';
import { spawnSync } from 'node:child_process';
import { assertPublicEnv } from '../../shared/site-config.js';

test('actual Pages repository, user site, explicit custom-domain root and invalid bases', () => {
  assert.equal(
    resolveSiteBase({ mode: 'pages', repository: 'yongliancai/money' }),
    '/money/',
  );
  assert.equal(
    resolveSiteBase({ mode: 'pages', repository: 'Alice/Alice.github.io' }),
    '/',
  );
  assert.equal(
    resolveSiteBase({ mode: 'pages', repository: 'a/b', basePath: '/' }),
    '/',
  );
  assert.equal(resolveSiteBase({ mode: 'development' }), '/');
  for (const base of [
    '//evil/',
    'money',
    '/money',
    '/../',
    '/a/./',
    'https://evil/',
    '/a?x/',
  ])
    assert.throws(() => normalizeBase(base));
  assert.throws(() => resolveSiteBase({ mode: 'pages' }));
});
test('Pages disables API by default, permits explicit HTTPS backend and rejects secret-bearing or insecure URLs', () => {
  assert.deepEqual(frontendConfig({ MODE: 'pages', BASE_URL: '/money/' }), {
    basePath: '/money/',
    apiBase: null,
    backendEnabled: false,
  });
  assert.equal(frontendConfig({ MODE: 'production' }).apiBase, '/');
  assert.equal(
    frontendConfig({
      MODE: 'pages',
      VITE_API_BASE_URL: 'https://api.example.test/gateway/',
    }).apiBase,
    'https://api.example.test/gateway/',
  );
  assert.equal(
    frontendConfig({
      MODE: 'pages',
      VITE_API_BASE_URL: 'http://127.0.0.1:3301',
    }).backendEnabled,
    true,
  );
  for (const url of [
    'http://api.example.test',
    'https://user:secret@api.example.test',
    'https://api.example.test?token=secret',
    'javascript:alert(1)',
  ])
    assert.throws(() => frontendConfig({ VITE_API_BASE_URL: url }));
});
test('disabled API never sends network requests; external API uses explicit prefix, omitted cookies and no redirect', async () => {
  let calls = 0;
  const disabled = createApi(frontendConfig({ MODE: 'pages' }), () => {
    calls++;
  });
  await assert.rejects(disabled.fetch('/api/config'), /尚未連接/);
  assert.equal(calls, 0);
  const api = createApi(
    frontendConfig({ VITE_API_BASE_URL: 'https://api.example.test/v1' }),
    async (url, options) => {
      assert.equal(url, 'https://api.example.test/v1/api/config');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      return Response.json({
        aiMode: 'disabled',
        pushReady: false,
        pushPublicKey: '',
        reminderPolicyPending: true,
      });
    },
  );
  assert.equal((await api.configuration()).aiMode, 'disabled');
  await assert.rejects(api.fetch('https://evil.test/api/config'), /路徑無效/);
});
test('bad backend response, unavailable backend and connection timeout never simulate AI success', async () => {
  const config = frontendConfig({ MODE: 'production' });
  await assert.rejects(
    createApi(
      config,
      async () => new Response('<html>404</html>'),
    ).configuration(),
    /格式無效/,
  );
  await assert.rejects(
    createApi(
      config,
      async () => new Response('', { status: 503 }),
    ).configuration(),
    /暫時不可用/,
  );
  await assert.rejects(
    createApi(
      config,
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        ),
      5,
    ).configuration(),
    /逾時/,
  );
});

test('real build fails closed on unknown VITE variables before a secret could enter assets', () => {
  assert.doesNotThrow(() =>
    assertPublicEnv({ VITE_API_BASE_URL: 'https://api.example.test' }),
  );
  assert.throws(() => assertPublicEnv({ VITE_MODEL_KEY: 'synthetic' }));
  const result = spawnSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--mode', 'pages'],
    {
      encoding: 'utf8',
      env: { ...process.env, VITE_MODEL_KEY: 'synthetic-test-value' },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /禁止未列入白名單/);
  assert.ok(!result.stderr.includes('synthetic-test-value'));
});
