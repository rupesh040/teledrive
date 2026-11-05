import type { DB } from './index.js';
import { hashPin, verifyPin as verifyPinHash } from '../auth/pin.js';

export interface AppConfigRow {
  id: number;
  api_id: number | null;
  api_hash: string | null;
  session: string | null;
  channel_id: string | null;
  pin_hash: string | null;
  pin_salt: string | null;
  account_name: string | null;
  account_phone: string | null;
  created_at: string | null;
}

export interface NewAccount {
  apiId: number;
  apiHash: string;
  session: string;
  channelId: string;
  name: string;
  phone: string;
  pin: string;
}

export function makeAppConfigRepo(db: DB) {
  // Pastikan baris tunggal id=1 selalu ada sebelum UPDATE.
  function ensureRow(): void {
    db.prepare('INSERT OR IGNORE INTO app_config (id, created_at) VALUES (1, ?)')
      .run(new Date().toISOString());
  }

  const repo = {
    get(): AppConfigRow | undefined {
      return db.prepare('SELECT * FROM app_config WHERE id = 1').get() as
        | AppConfigRow
        | undefined;
    },
    saveCredentials(apiId: number, apiHash: string): void {
      ensureRow();
      db.prepare('UPDATE app_config SET api_id = ?, api_hash = ? WHERE id = 1').run(apiId, apiHash);
    },
    saveSession(session: string): void {
      ensureRow();
      db.prepare('UPDATE app_config SET session = ? WHERE id = 1').run(session);
    },
    saveChannel(channelId: string): void {
      ensureRow();
      db.prepare('UPDATE app_config SET channel_id = ? WHERE id = 1').run(channelId);
    },
    saveAccount(name: string, phone: string): void {
      ensureRow();
      db.prepare('UPDATE app_config SET account_name = ?, account_phone = ? WHERE id = 1')
        .run(name, phone);
    },
    completeSetup(account: NewAccount): void {
      const { hash, salt } = hashPin(account.pin);
      // A single statement commits the verified identity and PIN together. A late
      // signup challenge cannot replace an account that has already been created.
      const result = db.prepare(`INSERT INTO app_config
        (id, api_id, api_hash, session, channel_id, account_name, account_phone, pin_hash, pin_salt, created_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET api_id = excluded.api_id, api_hash = excluded.api_hash,
          session = excluded.session, channel_id = excluded.channel_id,
          account_name = excluded.account_name, account_phone = excluded.account_phone,
          pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt, created_at = excluded.created_at
        WHERE coalesce(length(app_config.session), 0) = 0
          OR coalesce(length(app_config.channel_id), 0) = 0
          OR coalesce(length(app_config.pin_hash), 0) = 0`)
        .run(account.apiId, account.apiHash, account.session, account.channelId,
          account.name, account.phone, hash, salt, new Date().toISOString());
      if (Number(result.changes) !== 1) throw new Error('Account already created. Sign in instead.');
    },
    setPin(pin: string): void {
      ensureRow();
      const { hash, salt } = hashPin(pin);
      db.prepare('UPDATE app_config SET pin_hash = ?, pin_salt = ? WHERE id = 1').run(hash, salt);
    },
    verifyPin(pin: string): boolean {
      const row = repo.get();
      if (!row?.pin_hash || !row.pin_salt) return false;
      return verifyPinHash(pin, row.pin_hash, row.pin_salt);
    },
    isConfigured(): boolean {
      const row = repo.get();
      return !!(row?.session && row.channel_id && row.pin_hash);
    },
    clearAll(): void {
      db.prepare('DELETE FROM app_config WHERE id = 1').run();
    },
  };
  return repo;
}
