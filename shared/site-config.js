export function normalizeBase(value) {
  if (
    typeof value !== 'string' ||
    !/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(value) ||
    value.split('/').some((p) => p === '.' || p === '..')
  )
    throw new Error('網站 base 必須為 / 或 /repository/ 格式');
  return value;
}

export function assertPublicEnv(env) {
  for (const key of Object.keys(env))
    if (key.startsWith('VITE_') && key !== 'VITE_API_BASE_URL')
      throw new Error(`禁止未列入白名單的前端設定，避免洩漏秘密：${key}`);
}

export function resolveSiteBase({
  mode = 'production',
  repository,
  basePath,
} = {}) {
  if (basePath) return normalizeBase(basePath);
  if (mode !== 'pages') return '/';
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository || ''))
    throw new Error('Pages 建置必須指定 owner/repository');
  const [owner, name] = repository.split('/');
  return name.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? '/'
    : normalizeBase(`/${name}/`);
}

export function frontendConfig(env = {}) {
  const raw = env.VITE_API_BASE_URL?.trim();
  const apiBase = raw || (env.MODE === 'pages' ? null : '/');
  if (apiBase && apiBase !== '/') {
    const url = new URL(apiBase);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        ))
    )
      throw new Error(
        'API Base URL 必須為無憑證的 HTTPS 網址（本機 loopback 可用 HTTP）',
      );
  }
  return {
    basePath: normalizeBase(env.BASE_URL || '/'),
    apiBase:
      apiBase && apiBase !== '/' ? `${apiBase.replace(/\/+$/, '')}/` : apiBase,
    backendEnabled: !!apiBase,
  };
}
