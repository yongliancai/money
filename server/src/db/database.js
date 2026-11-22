import { DatabaseSync } from 'node:sqlite';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const hash = (token) => createHash('sha256').update(token).digest('hex');
export function openDatabase(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS subscriptions(device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS statuses(device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, local_date TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY(device_id,local_date));
    CREATE TABLE IF NOT EXISTS events(device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, id TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY(device_id,id));
    CREATE TABLE IF NOT EXISTS claims(device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, local_date TEXT NOT NULL, attempted_at TEXT NOT NULL, outcome TEXT NOT NULL, PRIMARY KEY(device_id,local_date));
    PRAGMA user_version=1;`);
  return {
    db,
    register(now) {
      const deviceId = randomUUID();
      const deviceToken = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO devices VALUES(?,?,?)').run(
        deviceId,
        hash(deviceToken),
        now.toISOString(),
      );
      return { deviceId, deviceToken };
    },
    authorize(id, token) {
      const row = db
        .prepare('SELECT token_hash FROM devices WHERE id=?')
        .get(id);
      if (!row || typeof token !== 'string') return false;
      return timingSafeEqual(
        Buffer.from(row.token_hash),
        Buffer.from(hash(token)),
      );
    },
    get(table, deviceId) {
      if (!['settings', 'subscriptions'].includes(table))
        throw new Error('Invalid table');
      const row = db
        .prepare(`SELECT payload FROM ${table} WHERE device_id=?`)
        .get(deviceId);
      return row ? JSON.parse(row.payload) : null;
    },
    set(table, deviceId, payload) {
      if (!['settings', 'subscriptions'].includes(table))
        throw new Error('Invalid table');
      db.prepare(
        `INSERT INTO ${table} VALUES(?,?) ON CONFLICT(device_id) DO UPDATE SET payload=excluded.payload`,
      ).run(deviceId, JSON.stringify(payload));
    },
    sync(deviceId, event, now) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const duplicate = db
          .prepare('SELECT 1 FROM events WHERE device_id=? AND id=?')
          .get(deviceId, event.eventId);
        const current = db
          .prepare(
            'SELECT revision FROM statuses WHERE device_id=? AND local_date=?',
          )
          .get(deviceId, event.localDate);
        let accepted = false;
        if (!duplicate) {
          db.prepare('INSERT INTO events VALUES(?,?,?)').run(
            deviceId,
            event.eventId,
            now.toISOString(),
          );
          if (!current || event.revision > current.revision) {
            db.prepare(
              'INSERT INTO statuses VALUES(?,?,?,?,?) ON CONFLICT(device_id,local_date) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,received_at=excluded.received_at',
            ).run(
              deviceId,
              event.localDate,
              event.revision,
              JSON.stringify(event),
              now.toISOString(),
            );
            accepted = true;
          }
        }
        db.exec('COMMIT');
        return {
          eventId: event.eventId,
          accepted,
          revision: Math.max(
            current?.revision || 0,
            accepted ? event.revision : 0,
          ),
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    status(id, date) {
      const row = db
        .prepare(
          'SELECT payload,received_at FROM statuses WHERE device_id=? AND local_date=?',
        )
        .get(id, date);
      return row
        ? { ...JSON.parse(row.payload), receivedAt: row.received_at }
        : null;
    },
    claim(id, date, now) {
      return (
        db
          .prepare("INSERT OR IGNORE INTO claims VALUES(?,?,?,'claimed')")
          .run(id, date, now.toISOString()).changes === 1
      );
    },
    outcome(id, date, outcome) {
      db.prepare(
        'UPDATE claims SET outcome=? WHERE device_id=? AND local_date=?',
      ).run(outcome, id, date);
    },
    unsubscribe(id) {
      db.prepare('DELETE FROM subscriptions WHERE device_id=?').run(id);
    },
    revoke(id) {
      db.prepare('DELETE FROM devices WHERE id=?').run(id);
    },
    prune(now) {
      const before = new Date(now.valueOf() - 35 * 86400000).toISOString();
      db.prepare('DELETE FROM events WHERE received_at < ?').run(before);
      db.prepare('DELETE FROM statuses WHERE received_at < ?').run(before);
      // Claims are retained for the device lifetime; revisiting dates must not resend.
    },
    close() {
      db.close();
    },
  };
}
