import { Api, TelegramClient } from 'telegram';
import bigInt from 'big-integer';
import { getClient } from './client.js';
import { db } from '../db/index.js';
import { makeAppConfigRepo } from '../db/appConfig.js';

const appConfig = makeAppConfigRepo(db);
const CHANNEL_TITLE = 'TeleDrive Storage';

// Create a private storage channel using an already logged-in client.
// Returns the channel id (string). Used when completing login.
export async function createStorageChannel(c: TelegramClient): Promise<string> {
  const result = await c.invoke(
    new Api.channels.CreateChannel({
      title: CHANNEL_TITLE,
      about: 'TeleDrive Storage (do not delete)',
      megagroup: false,
    })
  );
  const channel = (result as Api.Updates).chats[0] as Api.Channel;
  return String(channel.id);
}

// Resolve the channel entity from the id stored in app_config.
export async function getChannelEntity() {
  const cfg = appConfig.get();
  if (!cfg?.channel_id) {
    throw new Error('Storage channel not created yet — finish logging in from the app.');
  }
  const client = await getClient();
  return client.getEntity(new Api.PeerChannel({ channelId: bigInt(cfg.channel_id) }));
}
