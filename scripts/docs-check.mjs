import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { checkWorkflowFiles } from './workflow-policy.mjs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const errors = [];
errors.push(...checkWorkflowFiles());
const files = ['README.md', 'AGENTS.md'];
function walk(path) {
  for (const file of readdirSync(path, { withFileTypes: true })) {
    if (['sources', 'evidence'].includes(file.name)) continue;
    const name = `${path}/${file.name}`;
    if (file.isDirectory()) walk(name);
    else if (name.endsWith('.md')) files.push(name);
  }
}
walk('docs');
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(https?:|#)/.test(link)) continue;
    if (!existsSync(resolve(dirname(file), link.split('#')[0])))
      errors.push(`${file}: broken local link ${link}`);
  }
  for (const match of text.matchAll(/npm run ([\w:-]+)/g))
    if (!pkg.scripts[match[1]])
      errors.push(`${file}: unknown npm script ${match[1]}`);
}
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
if (/run:.*(?:\bdeploy\b|gh pr merge)/i.test(ci))
  errors.push('CI contains publication or merge command');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'PASS: engineering documentation links, commands and no-deploy CI policy',
  );
