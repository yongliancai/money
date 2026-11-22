import { frontendConfig } from '../../../shared/site-config.js';
import { backendConfigSchema } from '../../../shared/schemas/index.js';

export function createApi(
  config = frontendConfig(import.meta.env),
  fetcher = fetch,
  timeoutMs = 8000,
) {
  async function apiFetch(path, options = {}) {
    if (!config.backendEnabled)
      throw new Error('此版本尚未連接後端；手動記帳與備份可正常使用');
    if (
      !/^\/api\//.test(path) ||
      path.includes('..') ||
      path.includes('?') ||
      path.includes('#')
    )
      throw new Error('API 路徑無效');
    const url = config.apiBase === '/' ? path : config.apiBase + path.slice(1);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetcher(url, {
        ...options,
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new Error(
        controller.signal.aborted
          ? '後端連線逾時；請稍後重試或使用手動記帳'
          : '無法連接後端；請檢查網路或稍後重試，帳本仍可使用',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ...config,
    fetch: apiFetch,
    async configuration() {
      const response = await apiFetch('/api/config');
      if (!response.ok)
        throw new Error('後端暫時不可用；手動記帳與備份不受影響');
      try {
        return backendConfigSchema.parse(await response.json());
      } catch {
        throw new Error('後端回應格式無效；無法啟用 AI 或推播');
      }
    },
  };
}
