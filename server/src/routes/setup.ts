import { Router } from 'express';
import { appConfigRepo, loginFlow } from '../telegram/runtimeLogin.js';
import { issueToken } from '../auth/tokens.js';

export const setupRouter = Router();

// Status is used by the frontend to choose which screen to show. Always accessible.
setupRouter.get('/status', (_req, res) => {
  const configured = appConfigRepo.isConfigured();
  const row = appConfigRepo.get();
  res.json({
    configured,
    account: configured && row
      ? { name: row.account_name, phone: row.account_phone }
      : null,
  });
});

// Reject setup if already configured (prevents re-setup by someone else).
setupRouter.use((_req, res, next) => {
  if (appConfigRepo.isConfigured()) {
    res.status(403).json({ error: 'Already configured.' });
    return;
  }
  next();
});

setupRouter.post('/start', async (req, res) => {
  const { apiId, apiHash, phone } = req.body as { apiId: number; apiHash: string; phone: string };
  if (!apiId || !apiHash?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'API ID, API Hash, and phone number are required.' });
  }
  try {
    const r = await loginFlow.start(Number(apiId), apiHash.trim(), phone.trim());
    res.json(r);
  } catch (e) {
    res.status(400).json({ error: friendly(e) });
  }
});

setupRouter.post('/verify', async (req, res) => {
  const { loginId, code } = req.body as { loginId: string; code: string };
  try {
    res.json(await loginFlow.verifyCode(loginId, String(code).trim()));
  } catch (e) {
    res.status(400).json({ error: friendly(e) });
  }
});

setupRouter.post('/password', async (req, res) => {
  const { loginId, password } = req.body as { loginId: string; password: string };
  try {
    res.json(await loginFlow.verifyPassword(loginId, String(password)));
  } catch (e) {
    res.status(400).json({ error: friendly(e) });
  }
});

setupRouter.post('/pin', (req, res) => {
  const { pin } = req.body as { pin: string };
  if (!pin || String(pin).length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
  }
  // The PIN may only be set after the session+channel are stored (Telegram already logged in).
  const row = appConfigRepo.get();
  if (!row?.session || !row.channel_id) {
    return res.status(400).json({ error: 'Complete the Telegram login first.' });
  }
  appConfigRepo.setPin(String(pin));
  res.json({ token: issueToken() });
});

// Map Telegram errors to friendly Indonesian-language messages.
function friendly(e: unknown): string {
  const msg = (e as { errorMessage?: string; message?: string }).errorMessage
    ?? (e as Error).message ?? 'An error occurred.';
  const map: Record<string, string> = {
    PHONE_CODE_INVALID: 'Incorrect OTP code. Try again.',
    PHONE_CODE_EXPIRED: 'OTP code expired. Start over.',
    PASSWORD_HASH_INVALID: 'Incorrect 2FA password. Try again.',
    PHONE_NUMBER_INVALID: 'Invalid phone number.',
    API_ID_INVALID: 'Invalid API ID/Hash.',
  };
  return map[msg] ?? msg;
}
