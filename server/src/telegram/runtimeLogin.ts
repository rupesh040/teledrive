import { db } from '../db/index.js';
import { makeAppConfigRepo } from '../db/appConfig.js';
import { makeLoginFlow } from './loginFlow.js';
import { makeGramClient, createChannelFromLoginClient } from './gramjsLogin.js';

export const appConfigRepo = makeAppConfigRepo(db);

export const loginFlow = makeLoginFlow({
  repo: appConfigRepo,
  makeClient: makeGramClient,
  createChannel: createChannelFromLoginClient,
});
