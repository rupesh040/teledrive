import { db } from '../db/index.js';
import { makeAppConfigRepo } from '../db/appConfig.js';
import { makeLoginFlow } from './loginFlow.js';
import { makeGramClient, createChannelFromLoginClient } from './gramjsLogin.js';
import { config } from '../config.js';

export const appConfigRepo = makeAppConfigRepo(db);

export const loginFlow = makeLoginFlow({
  repo: appConfigRepo,
  makeClient: (apiId, apiHash) => makeGramClient(apiId, apiHash, { floodSleepThreshold: 0 }),
  createChannel: createChannelFromLoginClient,
});

/** App credentials belong to the server, never to the public signup form. */
export function phoneSignupCredentials(): { apiId: number; apiHash: string } | null {
  const saved = appConfigRepo.get();
  // Use one complete source. A partial environment override must not be paired
  // with a different saved Telegram application's secret.
  const environmentConfigured = config.apiId !== 0 || config.apiHash !== '';
  const apiId = environmentConfigured ? config.apiId : saved?.api_id ?? 0;
  const apiHash = environmentConfigured ? config.apiHash : saved?.api_hash ?? '';
  return Number.isSafeInteger(apiId) && apiId > 0 && /^[a-f\d]{32}$/i.test(apiHash)
    ? { apiId, apiHash } : null;
}
