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
