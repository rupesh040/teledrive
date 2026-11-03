import { appConfigRepo } from '../telegram/runtimeLogin.js';
import { createAuthRouter } from '../auth/routes.js';
import { makeReturningLoginFlow } from '../telegram/returningLogin.js';
import { makeGramClient } from '../telegram/gramjsLogin.js';
import { tokenStore } from '../auth/tokens.js';

const telegramLogin = makeReturningLoginFlow({
  repo: appConfigRepo,
  makeClient: (apiId, apiHash) => makeGramClient(apiId, apiHash, { floodSleepThreshold: 0 }),
  issueToken: tokenStore.issueToken,
});

export const authRouter = createAuthRouter({ repo: appConfigRepo, telegramLogin });
