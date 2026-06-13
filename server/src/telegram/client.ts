import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { db } from '../db/index.js';
import { makeAppConfigRepo } from '../db/appConfig.js';

const appConfig = makeAppConfigRepo(db);
let client: TelegramClient | null = null;

// Active client based on the credentials in app_config.
export async function getClient(): Promise<TelegramClient> {
  if (client && client.connected) return client;
  const cfg = appConfig.get();
  if (!cfg?.api_id || !cfg.api_hash) {
    throw new Error('Not configured yet — finish logging in from the app.');
  }
  if (!cfg.session) throw new Error('Telegram session is empty — log in first.');
  client = new TelegramClient(new StringSession(cfg.session), cfg.api_id, cfg.api_hash, {
    connectionRetries: 5,
  });
  await client.connect();
  return client;
}

// Release the active client (called on logout / account switch).
export async function resetClient(): Promise<void> {
  if (client) {
    try { await client.disconnect(); } catch { /* ignore */ }
    client = null;
  }
}
