import 'dotenv/config';

// Note: config does NOT throw on import so that DB tests (which don't
// need Telegram) can run without a .env. Telegram credentials are
// validated in telegram/client.ts & login.ts when they're actually used.

export const config = {
  apiId: Number(process.env.TG_API_ID ?? 0),
  apiHash: process.env.TG_API_HASH ?? '',
  session: process.env.TG_SESSION ?? '',
  channelId: process.env.TG_CHANNEL_ID ?? '',
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? './teledrive.db',
};

export function assertTelegramConfig(): void {
  if (!config.apiId || !config.apiHash) {
    throw new Error(
      'TG_API_ID / TG_API_HASH not set in .env (get them from https://my.telegram.org)'
    );
  }
}
