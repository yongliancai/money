// Strict local static fixture. No application backend or SPA fallback.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { normalizeBase } from '../shared/site-config.js';

const directory = resolve(process.env.STATIC_DIR || 'dist-pages');
const base = normalizeBase(process.env.STATIC_BASE || '/money/');
let version = 0;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/__test__/worker-version' && req.method === 'POST') {
    version++;
    res.writeHead(204).end();
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method) || !url.pathname.startsWith(base)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const suffix =
      decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
    const path = resolve(directory, suffix);
    if (!path.startsWith(directory + '/') && !path.startsWith(directory + '\\'))
      throw new Error('outside fixture');
    if (!statSync(path).isFile()) throw new Error('not file');
    let content = readFileSync(path);
    if (suffix === 'sw.js' && version) {
      const info = JSON.parse(
        readFileSync(resolve(directory, 'build-info.json'), 'utf8'),
      );
      content = Buffer.from(
        content
          .toString()
          .replaceAll(info.buildId, `${info.buildId}-update-test-${version}`),
      );
    }
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(Number(process.env.PORT || 3201), '127.0.0.1', () =>
  console.log(
    `Static-only fixture http://127.0.0.1:${process.env.PORT || 3201}${base}`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
