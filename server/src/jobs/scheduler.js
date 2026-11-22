import { localDate, localTime } from '../../../shared/dates.js';

export function eligibility({ settings, status, subscription, now, policy }) {
  if (!settings?.enabled || !subscription) return 'disabled';
  if (!policy || !(policy.maxAgeSeconds > 0) || !(policy.debounceSeconds >= 0))
    return 'policy_pending';
  const today = localDate(now, settings.timeZone);
  if (
    !status ||
    status.localDate !== today ||
    status.timeZone !== settings.timeZone ||
    status.settingsRevision !== settings.revision
  )
    return 'unknown';
  if (localDate(new Date(status.occurredAt), settings.timeZone) !== today)
    return 'unknown';
  if (status.completed) return 'completed';
  const age = (now.valueOf() - new Date(status.occurredAt).valueOf()) / 1000;
  if (age < 0 || age > policy.maxAgeSeconds) return 'stale';
  if (
    age < policy.debounceSeconds ||
    localTime(now, settings.timeZone) < settings.time
  )
    return 'not_due';
  return 'eligible';
}

export async function runScheduler({ store, now = new Date(), policy, send }) {
  const counts = {};
  const count = (reason) => {
    counts[reason] = (counts[reason] || 0) + 1;
  };
  const devices = store.db.prepare('SELECT id FROM devices').all();
  for (const { id } of devices) {
    let settings;
    let date;
    let subscription;
    let reason;
    store.db.exec('BEGIN IMMEDIATE');
    try {
      settings = store.get('settings', id);
      date = settings ? localDate(now, settings.timeZone) : '';
      const status = date ? store.status(id, date) : null;
      subscription = store.get('subscriptions', id);
      reason = eligibility({ settings, status, subscription, now, policy });
      if (reason === 'eligible' && !store.claim(id, date, now))
        reason = 'already_claimed';
      store.db.exec('COMMIT');
    } catch (error) {
      store.db.exec('ROLLBACK');
      throw error;
    }
    if (reason !== 'eligible') {
      count(reason);
      continue;
    }
    try {
      await send(subscription, {
        title: '今天記帳了嗎？',
        body: '花一分鐘，記下今天的生活。',
        localDate: date,
        timeZone: settings.timeZone,
      });
      store.outcome(id, date, 'accepted');
      count('accepted');
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) store.unsubscribe(id);
      store.outcome(id, date, 'failed_or_unknown');
      count('failed_or_unknown');
      // At-most-one attempt: never retry a delivery with an uncertain outcome.
    }
  }
  store.prune(now);
  return counts;
}
