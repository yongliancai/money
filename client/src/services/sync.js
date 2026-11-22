import { localDate } from '../../../shared/dates.js';

export function createSync(
  ledger,
  fetcher = fetch,
  { identityScope = '' } = {},
) {
  const identityKey = identityScope ? `identity:${identityScope}` : 'identity';
  const revokedKey = identityScope
    ? `serverRevoked:${identityScope}`
    : 'serverRevoked';
  let active;
  let registering;
  async function loadIdentity() {
    if (await ledger.db.get('settings', revokedKey))
      throw new Error('匿名同步已撤銷，請先重新啟用');
    let value = await ledger.db.get('settings', identityKey);
    if (!value) {
      const response = await fetcher('/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('無法建立匿名裝置');
      value = await response.json();
      await ledger.db.put('settings', value, identityKey);
    }
    return value;
  }
  function identity() {
    if (registering) return registering;
    const execute = () => loadIdentity();
    registering = (
      globalThis.navigator?.locks
        ? navigator.locks.request('bookkeeping-identity', execute)
        : execute()
    ).finally(() => {
      registering = null;
    });
    return registering;
  }
  async function request(path, method = 'GET', body) {
    const auth = await identity();
    const response = await fetcher(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': auth.deviceId,
        Authorization: `Bearer ${auth.deviceToken}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok)
      throw Object.assign(new Error(result.error || '同步失敗'), {
        status: response.status,
      });
    return result;
  }
  async function perform() {
    const config = await ledger.settings();
    await request('/api/reminders/settings', 'PUT', config);
    await ledger.heartbeat(config.revision);
    const events = (await ledger.outbox()).sort(
      (a, b) => a.revision - b.revision,
    );
    for (const event of events) {
      if (event.settingsRevision > config.revision)
        throw new Error('設定已更新，稍後重試同步');
      if (
        event.settingsRevision !== config.revision ||
        event.localDate !== localDate(new Date(), config.timeZone)
      ) {
        await ledger.acknowledge(event.eventId);
        continue;
      }
      const ack = await request('/api/daily-status/sync', 'POST', event);
      if (ack.eventId !== event.eventId || ack.revision < event.revision)
        throw new Error('同步確認版本不符');
      await ledger.acknowledge(event.eventId);
    }
    return { pending: (await ledger.outbox()).length };
  }
  return {
    request,
    isRevoked: () => ledger.db.get('settings', revokedKey),
    async revoke() {
      await request('/api/devices/current', 'DELETE');
      await ledger.db.put('settings', true, revokedKey);
    },
    async reactivate() {
      await ledger.db.delete('settings', identityKey);
      await ledger.db.delete('settings', revokedKey);
    },
    sync() {
      if (active) return active;
      const execute = () => perform();
      active = (
        globalThis.navigator?.locks
          ? navigator.locks.request('bookkeeping-sync', execute)
          : execute()
      ).finally(() => {
        active = null;
      });
      return active;
    },
  };
}
