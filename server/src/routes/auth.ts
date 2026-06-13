import { Router } from 'express';
import { appConfigRepo } from '../telegram/runtimeLogin.js';
import { issueToken } from '../auth/tokens.js';

export const authRouter = Router();

// Unlock with PIN → issue a token. Only when already configured.
authRouter.post('/unlock', (req, res) => {
  if (!appConfigRepo.isConfigured()) {
    return res.status(400).json({ error: 'Not configured yet.' });
  }
  const { pin } = req.body as { pin: string };
  if (!appConfigRepo.verifyPin(String(pin ?? ''))) {
    return res.status(401).json({ error: 'Incorrect PIN.' });
  }
  res.json({ token: issueToken() });
});
