import { Router, type Request, type Response } from 'express';
import { tokenStore, type TokenStore } from './tokens.js';
import { TelegramLoginError } from '../telegram/returningLogin.js';

export interface SetupCredentials { apiId: number; apiHash: string }
export interface SetupDependencies {
  repo: { isConfigured(): boolean };
  credentials: () => SetupCredentials | null;
  tokens?: TokenStore;
  loginFlow: {
    start(apiId: number, apiHash: string, phone: string): Promise<{ loginId: string; needs: 'code'; retryAfter?: number }>;
    verifyCode(loginId: string, code: string): Promise<{ needs: 'pin' | 'password' }>;
    verifyPassword(loginId: string, password: string): Promise<{ needs: 'pin' }>;
    complete(loginId: string, pin: string): Promise<{ ok: true }>;
    cancel(loginId: string): Promise<{ ok: true }>;
  };
}

export function createSetupRouter({ repo, loginFlow, credentials, tokens = tokenStore }: SetupDependencies) {
  const router = Router();
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/status', (_req, res) => {
    // Screen selection never exposes a signed-out account's name or number.
    res.json({ configured: repo.isConfigured(), account: null, phoneSignupAvailable: credentials() !== null });
  });
  router.use((_req, res, next) => {
    if (repo.isConfigured()) { res.status(403).json({ error: 'Your account already exists. Sign in instead.', code: 'ALREADY_CONFIGURED' }); return; }
    next();
  });
  const action = (operation: (body: Record<string, unknown>) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { return res.json(await operation(req.body ?? {})); }
    catch (cause) {
      const error = cause instanceof TelegramLoginError ? cause
        : new TelegramLoginError('Unable to complete signup. Please try again.', 'SIGNUP_FAILED', 503);
      if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
      return res.status(error.status).json({ error: error.message, code: error.code, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) });
    }
  };
  router.post('/start', action(async body => {
    const app = credentials();
    if (!app) throw new TelegramLoginError('Phone signup is unavailable. The server owner needs to configure the Telegram app first.', 'SIGNUP_UNAVAILABLE', 503);
    // User-supplied API ID/hash are deliberately ignored. Phone login always uses
    // the server's Telegram application credentials.
    return loginFlow.start(app.apiId, app.apiHash, text(body.phone).trim());
  }));
  router.post('/verify', action(body => loginFlow.verifyCode(text(body.loginId), text(body.code).trim())));
  router.post('/password', action(body => loginFlow.verifyPassword(text(body.loginId), text(body.password))));
  router.post('/cancel', action(body => loginFlow.cancel(text(body.loginId))));
  router.post('/pin', action(async body => {
    await loginFlow.complete(text(body.loginId), text(body.pin));
    return { ok: true, token: tokens.issueToken(body.remember === true) };
  }));
  return router;
}
