import { spawnSync } from 'node:child_process';
const fixture = [
  {
    expenseDate: '2026-10-31',
    createdAt: '2026-11-22',
    amount: 120,
    category: '餐飲',
  },
];
const common = `import assert from 'node:assert/strict'; const records=${JSON.stringify(fixture)};`;
const red = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `${common} const total=records.filter(e=>e.createdAt.startsWith('2026-11')).reduce((n,e)=>n+e.amount,0); assert.equal(total,0);`,
  ],
  { encoding: 'utf8' },
);
if (red.status !== 1 || !red.stderr.includes('AssertionError'))
  throw new Error('Negative fixture was not rejected');
console.log(
  'EXPECTED FAIL (red), exit 1: createdAt-based monthly total fails the assertion',
);
const moduleUrl = new URL('../client/src/storage/ledger.js', import.meta.url)
  .href;
const green = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `${common} import {monthStats} from ${JSON.stringify(moduleUrl)}; assert.equal(monthStats(records,'2026-11').total,0n);`,
  ],
  { encoding: 'utf8' },
);
if (green.status !== 0) throw new Error(green.stderr);
console.log(
  'PASS (green), exit 0: expenseDate-based implementation passes the same assertion',
);
