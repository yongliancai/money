import { spawn } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  createWriteStream,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
const npmCli = resolve(process.execPath, '../node_modules/npm/bin/npm-cli.js');
const evidenceDirectory = process.argv[2] || 'docs/evidence';
mkdirSync(evidenceDirectory, { recursive: true });
const commands = [
  ['clean-install', ['ci']],
  ['quality-and-e2e', ['run', 'verify']],
  ['regression-proof', null],
  ['dependency-audit', ['audit', '--audit-level=high']],
];
const report = {
  recordedAt: new Date().toISOString(),
  platform: process.platform,
  node: process.version,
  npm: JSON.parse(
    readFileSync(
      resolve(process.execPath, '../node_modules/npm/package.json'),
      'utf8',
    ),
  ).version,
  results: [],
};
for (const [name, args] of commands) {
  const argv = args ? [npmCli, ...args] : ['scripts/regression-proof.mjs'];
  const file = `${evidenceDirectory}/${name}.txt`;
  const stream = createWriteStream(file);
  const started = new Date();
  console.log(`Running ${name}...`);
  const exitCode = await new Promise((done) => {
    const child = spawn(process.execPath, argv, {
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    child.stdout.pipe(stream, { end: false });
    child.stderr.pipe(stream, { end: false });
    child.on('error', (error) => {
      stream.write(error.message);
      done(-1);
    });
    child.on('close', done);
  });
  stream.end();
  report.results.push({
    name,
    command: args
      ? `npm ${args.join(' ')}`
      : 'node scripts/regression-proof.mjs',
    startedAt: started.toISOString(),
    durationMs: Date.now() - started.valueOf(),
    exitCode,
    status: exitCode === 0 ? 'PASS' : 'FAIL',
    log: file,
  });
  writeFileSync(
    `${evidenceDirectory}/summary.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(`${name}: exit ${exitCode}`);
  if (exitCode !== 0) {
    process.exitCode = 1;
    break;
  }
}
