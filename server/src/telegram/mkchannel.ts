import { getClient } from './client.js';
import { createStorageChannel } from './channel.js';
import { db } from '../db/index.js';
import { makeAppConfigRepo } from '../db/appConfig.js';

// Optional script: create the channel & save the id to the DB (the main flow goes through the web).
async function main() {
  const client = await getClient();
  const id = await createStorageChannel(client);
  makeAppConfigRepo(db).saveChannel(id);
  console.log(`Channel created, channel_id=${id} saved to DB.`);
  process.exit(0);
}

main();
