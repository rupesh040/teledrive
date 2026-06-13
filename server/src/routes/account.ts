import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { revokeAll } from '../auth/tokens.js';
import { appConfigRepo } from '../telegram/runtimeLogin.js';
import { resetClient } from '../telegram/client.js';

export const accountRouter = Router();

// Logout / switch account: delete all config, revoke tokens, disconnect the client.
accountRouter.post('/logout', requireAuth, async (_req, res) => {
  await resetClient();
  appConfigRepo.clearAll();
  revokeAll();
  res.json({ ok: true });
});
