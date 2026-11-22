import { spawn } from 'node:child_process';
const children = [
  spawn(
    process.execPath,
    ['--env-file-if-exists=.env.local', '--watch', 'server/src/index.js'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        APP_ORIGIN: process.env.APP_ORIGIN || 'http://127.0.0.1:5173',
      },
    },
  ),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'],
    { stdio: 'inherit' },
  ),
];
function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', stop);
