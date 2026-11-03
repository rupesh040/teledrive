import { Router, type Request, type Response } from 'express';
import { bearerToken } from './requestToken.js';
import { tokenStore, type TokenStore } from './tokens.js';
import { TelegramLoginError, type ReturningLoginFlow } from '../telegram/returningLogin.js';

interface AccountIdentity { account_name: string | null; account_phone: string | null }
export interface LoginAccountRepo {
  isConfigured(): boolean;
  verifyPin(pin: string): boolean;
  get(): AccountIdentity | undefined;
}
interface AuthDependencies {
  repo: LoginAccountRepo;
  tokens?: TokenStore;
  now?: () => number;
  telegramLogin?: ReturningLoginFlow;
}
const MAX_FAILURES = 5;
const COOLDOWN_MS = 30_000;
const ATTEMPT_WINDOW_MS = 5 * 60_000;

export function createAuthRouter({ repo, tokens = tokenStore, now = Date.now, telegramLogin }: AuthDependencies) {
  const router = Router();
  const failures = new Map<string, { count: number; expiresAt: number; blockedUntil: number }>();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  router.get('/session', (req, res) => {
    const configured = repo.isConfigured();
    const authenticated = configured && tokens.isValidToken(bearerToken(req));
    const account = authenticated ? repo.get() : undefined;
    res.json({
      authenticated,
      configured,
      account: account ? { name: account.account_name, phone: account.account_phone } : null,
    });
  });

  const login = (req: Request, res: Response) => {
    if (!repo.isConfigured()) return res.status(400).json({ error: 'Create your account before signing in.', code: 'NOT_CONFIGURED' });
    const timestamp = now();
    for (const [key, attempt] of failures) {
      if (attempt.expiresAt <= timestamp || (attempt.blockedUntil > 0 && attempt.blockedUntil <= timestamp)) failures.delete(key);
    }
    // Express does not trust forwarded IP headers unless explicitly configured.
    const key = req.ip ?? req.socket.remoteAddress ?? 'local';
    const attempt = failures.get(key);
    const throttled = (blockedUntil: number) => {
      const retryAfter = Math.max(1, Math.ceil((blockedUntil - timestamp) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many incorrect PIN attempts. Please try again shortly.', code: 'TOO_MANY_ATTEMPTS', retryAfter });
    };
    if (attempt && attempt.blockedUntil > timestamp) return throttled(attempt.blockedUntil);
    const { pin, remember } = req.body ?? {};
    if (typeof pin !== 'string' || !/^\d{4,}$/.test(pin) || !repo.verifyPin(pin)) {
      const next = { count: (attempt?.count ?? 0) + 1, expiresAt: timestamp + ATTEMPT_WINDOW_MS, blockedUntil: 0 };
      if (next.count >= MAX_FAILURES) next.blockedUntil = timestamp + COOLDOWN_MS;
      failures.set(key, next);
      if (next.blockedUntil) return throttled(next.blockedUntil);
      return res.status(401).json({ error: 'Incorrect PIN.', code: 'INVALID_PIN' });
    }
    failures.delete(key);
    return res.json({ token: tokens.issueToken(remember === true) });
  };
  router.post('/login', login);
  router.post('/unlock', login);
  const telegramAction = (action: (body: Record<string, unknown>) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { return res.json(await action(req.body ?? {})); }
    catch (cause) {
      const error = cause instanceof TelegramLoginError ? cause
        : new TelegramLoginError('Unable to connect to Telegram. Please try again.', 'TELEGRAM_UNAVAILABLE', 503);
      if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
      return res.status(error.status).json({ error: error.message, code: error.code, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) });
    }
  };
  const flow = () => {
    if (!telegramLogin) throw new TelegramLoginError('Telegram login is unavailable. Please try again.', 'TELEGRAM_UNAVAILABLE', 503);
    return telegramLogin;
  };
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  router.post('/telegram/start', telegramAction(body => flow().start(text(body.phone), body.remember === true)));
  router.post('/telegram/verify', telegramAction(body => flow().verifyCode(text(body.loginId), text(body.code).trim())));
  router.post('/telegram/password', telegramAction(body => flow().verifyPassword(text(body.loginId), text(body.password))));
  router.post('/telegram/cancel', telegramAction(body => flow().cancel(text(body.loginId))));
  router.post('/logout', (req, res) => {
    const token = bearerToken(req);
    if (token) tokens.revokeToken(token);
    res.json({ ok: true });
  });
  return router;
}

interface AccountDependencies {
  repo: { clearAll(): void };
  disconnectClient: () => Promise<void>;
  tokens?: TokenStore;
}

export function createAccountRouter({ repo, disconnectClient, tokens = tokenStore }: AccountDependencies) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // Backward-compatible endpoint, now a normal, non-destructive sign-out.
  router.post('/logout', (req, res) => {
    const token = bearerToken(req);
    if (token) tokens.revokeToken(token);
    res.json({ ok: true });
  });
  // Disconnecting an account is distinct from ending a browser session.
  router.post('/disconnect', async (req, res) => {
    if (!tokens.isValidToken(bearerToken(req))) return res.status(401).json({ error: 'Sign in before disconnecting your account.', code: 'SESSION_EXPIRED' });
    try {
      await disconnectClient();
      repo.clearAll();
      tokens.revokeAll();
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Unable to disconnect the account. Please try again.', code: 'DISCONNECT_FAILED' });
    }
  });
  return router;
}
