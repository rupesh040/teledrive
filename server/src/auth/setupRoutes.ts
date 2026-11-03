import { Router } from 'express';

interface SetupAccount {
  session: string | null;
  channel_id: string | null;
  account_name: string | null;
  account_phone: string | null;
}
export interface SetupDependencies {
  repo: {
    isConfigured(): boolean;
    get(): SetupAccount | undefined;
    setPin(pin: string): void;
  };
  loginFlow: {
    start(apiId: number, apiHash: string, phone: string): Promise<{ loginId: string; needs: 'code' }>;
    verifyCode(loginId: string, code: string): Promise<{ needs: 'pin' | 'password' }>;
    verifyPassword(loginId: string, password: string): Promise<{ needs: 'pin' }>;
  };
}

export function createSetupRouter({ repo, loginFlow }: SetupDependencies) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/status', (_req, res) => {
    const configured = repo.isConfigured();
    // Screen selection does not expose a signed-out account's name or phone.
    res.json({ configured, account: null });
  });
  router.use((_req, res, next) => {
    if (repo.isConfigured()) { res.status(403).json({ error: 'Already configured.', code: 'ALREADY_CONFIGURED' }); return; }
    next();
  });
  router.post('/start', async (req, res) => {
    const { apiId, apiHash, phone } = req.body ?? {};
    if (!Number.isSafeInteger(Number(apiId)) || Number(apiId) <= 0 || typeof apiHash !== 'string' || !apiHash.trim() || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ error: 'API ID, API Hash, and phone number are required.' });
    }
    try { return res.json(await loginFlow.start(Number(apiId), apiHash.trim(), phone.trim())); }
    catch (error) { return res.status(400).json({ error: friendly(error) }); }
  });
  router.post('/verify', async (req, res) => {
    const { loginId, code } = req.body ?? {};
    try { return res.json(await loginFlow.verifyCode(String(loginId ?? ''), String(code ?? '').trim())); }
    catch (error) { return res.status(400).json({ error: friendly(error) }); }
  });
  router.post('/password', async (req, res) => {
    const { loginId, password } = req.body ?? {};
    try { return res.json(await loginFlow.verifyPassword(String(loginId ?? ''), String(password ?? ''))); }
    catch (error) { return res.status(400).json({ error: friendly(error) }); }
  });
  router.post('/pin', (req, res) => {
    const { pin } = req.body ?? {};
    if (typeof pin !== 'string' || !/^\d{4,}$/.test(pin)) return res.status(400).json({ error: 'PIN must contain at least 4 digits.', code: 'INVALID_PIN' });
    const row = repo.get();
    if (!row?.session || !row.channel_id) return res.status(400).json({ error: 'Complete the Telegram login first.', code: 'TELEGRAM_LOGIN_REQUIRED' });
    repo.setPin(pin);
    // Account creation is complete; a separate PIN login starts the browser session.
    return res.json({ ok: true });
  });
  return router;
}

function friendly(error: unknown): string {
  const message = (error as { errorMessage?: string; message?: string })?.errorMessage
    ?? (error as Error)?.message ?? 'An error occurred.';
  const messages: Record<string, string> = {
    PHONE_CODE_INVALID: 'Incorrect OTP code. Try again.',
    PHONE_CODE_EXPIRED: 'OTP code expired. Start over.',
    PASSWORD_HASH_INVALID: 'Incorrect 2FA password. Try again.',
    PHONE_NUMBER_INVALID: 'Invalid phone number.',
    API_ID_INVALID: 'Invalid API ID/Hash.',
  };
  return messages[message] ?? message;
}
