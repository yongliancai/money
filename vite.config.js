import { defineConfig, loadEnv } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  resolveSiteBase,
  frontendConfig,
  assertPublicEnv,
} from './shared/site-config.js';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const site = JSON.parse(readFileSync('config/site.json', 'utf8'));
  const base = resolveSiteBase({
    mode,
    repository: env.GITHUB_REPOSITORY || site.repository,
    basePath: env.PAGES_BASE_PATH,
  });
  frontendConfig({
    MODE: mode,
    BASE_URL: base,
    VITE_API_BASE_URL: env.VITE_API_BASE_URL,
  });
  assertPublicEnv(env);
  let output;
  return {
    root: 'client',
    envDir: process.cwd(),
    base,
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:3001' },
    },
    build: {
      outDir: mode === 'pages' ? '../dist-pages' : '../dist',
      emptyOutDir: true,
      target: 'es2022',
    },
    plugins: [
      {
        name: 'scoped-pwa',
        configResolved(config) {
          output = resolve(config.root, config.build.outDir);
        },
        closeBundle() {
          const manifest = JSON.parse(
            readFileSync('client/public/manifest.webmanifest', 'utf8'),
          );
          Object.assign(manifest, { id: base, start_url: base, scope: base });
          manifest.icons = manifest.icons.map((icon) => ({
            ...icon,
            src: base + icon.src.replace(/^\//, ''),
          }));
          writeFileSync(
            resolve(output, 'manifest.webmanifest'),
            JSON.stringify(manifest, null, 2) + '\n',
          );
          writeFileSync(resolve(output, '.nojekyll'), '');
          const assets = readdirSync(resolve(output, 'assets')).map(
            (file) => `${base}assets/${file}`,
          );
          const shell = [
            '',
            'index.html',
            'manifest.webmanifest',
            'icon.svg',
            'icon-192.png',
            'icon-512.png',
          ].map((file) => base + file);
          const source = readFileSync('client/public/sw.js', 'utf8');
          const buildId = createHash('sha256')
            .update(source)
            .update(JSON.stringify(manifest))
            .update(readFileSync(resolve(output, 'index.html')))
            .digest('hex')
            .slice(0, 12);
          writeFileSync(
            resolve(output, 'build-info.json'),
            JSON.stringify({ base, buildId, mode }) + '\n',
          );
          writeFileSync(
            resolve(output, 'sw.js'),
            source
              .replace("'__APP_BASE__'", JSON.stringify(base))
              .replace('__BUILD_ID__', buildId)
              .replace("'__PRECACHE__'", JSON.stringify([...shell, ...assets])),
          );
        },
      },
    ],
  };
});
