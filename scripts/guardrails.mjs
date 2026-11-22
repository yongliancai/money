import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as espree from 'espree';

const normalize = (name) => name.replaceAll('\\', '/');
export function inspectSource(name, source, root = process.cwd()) {
  const errors = [];
  const file = normalize(name);
  if (
    /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(source) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)
  )
    errors.push('疑似機密內容');
  if (!/\.[cm]?js$/.test(file)) return errors;
  let ast;
  try {
    ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch {
    errors.push('JavaScript 語法無效');
    return errors;
  }
  const imports = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(value.type) &&
      value.source
    ) {
      if (typeof value.source.value !== 'string')
        errors.push('動態依賴必須使用字面路徑');
      else imports.push(value.source.value);
    }
    if (value.type === 'CallExpression' && value.callee?.name === 'require') {
      if (typeof value.arguments[0]?.value !== 'string')
        errors.push('動態 require 不允許');
      else imports.push(value.arguments[0].value);
    }
    for (const entry of Object.values(value)) {
      if (Array.isArray(entry)) entry.forEach(visit);
      else if (entry && typeof entry === 'object') visit(entry);
    }
  }
  visit(ast);
  for (const specifier of imports) {
    const target = specifier.startsWith('.')
      ? normalize(relative(root, resolve(root, dirname(file), specifier)))
      : specifier;
    if (
      file.startsWith('client/') &&
      (/^server\//.test(target) ||
        /^(node:|openai(?:\/|$)|web-push(?:\/|$))/.test(target) ||
        target.startsWith('../'))
    )
      errors.push(`前端不可引用 ${specifier}`);
    if (file.startsWith('server/') && target.startsWith('client/'))
      errors.push(`後端不可引用 ${specifier}`);
    if (file.startsWith('shared/') && /^(client|server)\//.test(target))
      errors.push(`共用層不可引用 ${specifier}`);
    if (
      file.startsWith('client/src/storage/') &&
      /client\/src\/(?:main|services|components)/.test(target)
    )
      errors.push('storage 不可引用上層 UI 或網路服務');
  }
  return errors;
}
export function checkProject(root = process.cwd()) {
  const errors = [];
  const excluded = new Set([
    '.git',
    'node_modules',
    'dist',
    'dist-pages',
    'data',
    'test-results',
    'playwright-report',
    '.tmp',
  ]);
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const name = normalize(relative(root, absolute));
      if (
        entry.isSymbolicLink() ||
        excluded.has(entry.name) ||
        name.startsWith('docs/sources/') ||
        name.startsWith('docs/evidence/') ||
        (entry.name.startsWith('.env') && entry.name !== '.env.example') ||
        entry.name.endsWith('.log')
      )
        continue;
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(?:js|mjs|json|md|yml|yaml|html|css)$/.test(name))
        for (const error of inspectSource(
          name,
          readFileSync(absolute, 'utf8'),
          root,
        ))
          errors.push(`${name}: ${error}`);
    }
  }
  walk(root);
  try {
    const files = execFileSync('git', ['ls-files', '--cached'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n');
    for (const name of files)
      if (
        /(?:^|\/)\.env(?!\.example$)/.test(name) ||
        /\.(?:sqlite|pem|key)(?:$|-)/.test(name)
      )
        errors.push(`${name}: 禁止版本控制機密或執行期資料`);
  } catch {
    /* Source archives may not include .git. */
  }
  return errors;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const errors = checkProject();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      'PASS: architecture boundaries, source secret scan and tracked file policy',
    );
}
