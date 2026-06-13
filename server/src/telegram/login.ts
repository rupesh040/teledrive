import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { db } from '../db/index.js';
import { makeAppConfigRepo } from '../db/appConfig.js';

// Optional script: CLI login, then save the session to the DB (the main flow goes through the web).
async function main() {
  const repo = makeAppConfigRepo(db);
  const cfg = repo.get();
  if (!cfg?.api_id || !cfg.api_hash) {
    throw new Error('api_id/api_hash not in DB yet. Use login via the web app.');
  }
  const rl = readline.createInterface({ input, output });
  const client = new TelegramClient(new StringSession(''), cfg.api_id, cfg.api_hash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => (await rl.question('Phone number: ')).trim(),
    password: async () => (await rl.question('2FA password (press Enter if none): ')).trim(),
    phoneCode: async () => (await rl.question('OTP code: ')).trim(),
    onError: (err) => console.error(err),
  });
  repo.saveSession(String(client.session.save()));
  console.log('Login successful, session saved to DB.');
  await client.disconnect();
  await rl.close();
  process.exit(0);
}

main();
