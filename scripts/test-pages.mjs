import { spawn } from 'node:child_process';
async function run(args, env = {}) {
  const code = await new Promise((done) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', done);
    child.on('error', () => done(1));
  });
  if (code !== 0) process.exit(code || 1);
}
await run(['node_modules/vite/bin/vite.js', 'build', '--mode', 'pages'], {
  PAGES_BASE_PATH: '/money/',
  // V1 must remain local even when an old backend setting exists.
  VITE_API_BASE_URL: 'http://127.0.0.1:3301/',
});
await run(['scripts/check-pages-build.mjs', 'dist-pages', '/money/']);
await run(
  [
    'node_modules/vite/bin/vite.js',
    'build',
    '--mode',
    'integration',
    '--outDir',
    '../.tmp/pages-connected',
  ],
  { PAGES_BASE_PATH: '/money/', VITE_API_BASE_URL: 'http://127.0.0.1:3301/' },
);
await run([
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  'playwright.pages.config.js',
  ...process.argv.slice(2),
]);
