import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const directory = process.argv[2] || 'dist-pages';
const base = process.argv[3] || '/money/';
const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
const manifest = JSON.parse(
  readFileSync(resolve(directory, 'manifest.webmanifest'), 'utf8'),
);
assert.equal(
  manifest.start_url,
  base,
  'Manifest must launch inside the repository path',
);
assert.equal(
  manifest.scope,
  base,
  'Manifest scope must match the repository path',
);
assert.equal(manifest.id, base, 'PWA identity must match its scope');
for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g))
  assert.ok(match[1].startsWith(base), `Resource escaped base: ${match[1]}`);
for (const icon of manifest.icons) assert.ok(icon.src.startsWith(base));
const sw = readFileSync(resolve(directory, 'sw.js'), 'utf8');
assert.ok(
  sw.includes(JSON.stringify(base)) || sw.includes(`'${base}'`),
  'SW must carry its own application base',
);
console.log(`PASS: HTML, manifest, icons and service worker share ${base}`);
