import { randomBytes } from 'node:crypto';
import type { NewAccount } from '../db/appConfig.js';
import { normalizeTelegramPhone, TelegramLoginError } from './returningLogin.js';

// Minimal client surface used by the flow (works with GramJS & mock clients).
export interface LoginClient {
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  logOut?(): Promise<void>;
  sendCode(creds: { apiId: number; apiHash: string }, phone: string): Promise<{ phoneCodeHash: string }>;
  signIn(args: { phoneNumber: string; phoneCodeHash: string; phoneCode: string }): Promise<void>;
  signInPassword(args: { password: string }): Promise<void>;
  getMe(): Promise<{ firstName?: string; phone?: string }>;
  session: { save(): string };
}

interface Deps {
  repo: { isConfigured(): boolean; completeSetup(account: NewAccount): void };
  makeClient: (apiId: number, apiHash: string) => LoginClient;
  createChannel: (client: LoginClient) => Promise<string>;
  now?: () => number;
}
interface Pending {
  client: LoginClient;
  apiId: number;
  apiHash: string;
  phone: string;
  phoneCodeHash: string;
  expiresAt: number;
  phase: 'code' | 'password' | 'pin';
  name?: string;
  busy: boolean;
  cancelled: boolean;
  authenticated: boolean;
  attempts: number;
  timer: ReturnType<typeof setTimeout>;
}
const TTL_MS = 5 * 60_000;
const COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

function signupError(cause: unknown): TelegramLoginError {
  if (cause instanceof TelegramLoginError) return cause;
  const rpc = cause as { errorMessage?: string; seconds?: number };
  const message = rpc?.errorMessage ?? '';
  if (/FLOOD_WAIT|FLOOD_PREMIUM_WAIT|PHONE_PASSWORD_FLOOD|PHONE_NUMBER_FLOOD/.test(message)) {
    const seconds = Number.isFinite(rpc.seconds) && Number(rpc.seconds) > 0
      ? Math.ceil(Number(rpc.seconds)) : Number(message.match(/_(\d+)$/)?.[1]) || 60;
    return new TelegramLoginError('Telegram is limiting login attempts. Please wait before trying again.', 'FLOOD_WAIT', 429, Math.min(seconds, 86400));
  }
  const messages: Record<string, [string, string]> = {
    PHONE_CODE_INVALID: ['Incorrect Telegram code. Please try again.', 'INVALID_CODE'],
    PHONE_CODE_EMPTY: ['Enter the code sent by Telegram.', 'INVALID_CODE'],
    PHONE_CODE_EXPIRED: ['This Telegram code expired. Request a new code.', 'LOGIN_EXPIRED'],
    PASSWORD_HASH_INVALID: ['Incorrect Telegram two-step password. Please try again.', 'INVALID_PASSWORD'],
    PHONE_NUMBER_INVALID: ['Include a valid phone number and international country code.', 'INVALID_PHONE'],
    PHONE_NUMBER_BANNED: ['Telegram cannot sign in this phone number.', 'PHONE_UNAVAILABLE'],
    PHONE_NUMBER_UNOCCUPIED: ['Create a Telegram account for this number first.', 'PHONE_UNAVAILABLE'],
    API_ID_INVALID: ['Phone signup is unavailable. Ask the server owner to check the Telegram app configuration.', 'SIGNUP_UNAVAILABLE'],
  };
  const mapped = messages[message];
  return mapped ? new TelegramLoginError(...mapped)
    : new TelegramLoginError('Unable to connect to Telegram. Please try again.', 'TELEGRAM_UNAVAILABLE', 503);
}

/** Signup proof stays in memory until its owner sets a PIN. No drive data is
 * written before then, and completed signup can never replace an existing drive. */
export function makeLoginFlow(deps: Deps) {
  const now = deps.now ?? Date.now;
  const pending = new Map<string, Pending>();
  let sendBlockedUntil = 0;

  async function close(loginId: string, p: Pending, preserveAuthorization = false) {
    if (pending.get(loginId) === p) pending.delete(loginId);
    p.cancelled = true;
    clearTimeout(p.timer);
    if (p.authenticated && !preserveAuthorization) {
      try { await p.client.logOut?.(); } catch { /* best-effort Telegram cleanup */ }
    }
    try { await p.client.disconnect(); } catch { /* release local resources */ }
  }
  function requireUnconfigured() {
    if (deps.repo.isConfigured()) throw new TelegramLoginError('Your account already exists. Sign in instead.', 'ALREADY_CONFIGURED', 403);
  }
  function checkLive(loginId: string, p: Pending) {
    requireUnconfigured();
    if (p.cancelled || pending.get(loginId) !== p || p.expiresAt <= now()) {
      throw new TelegramLoginError('Signup expired. Request a new Telegram code.', 'LOGIN_EXPIRED');
    }
  }
  async function prune() {
    await Promise.all([...pending].filter(([, p]) => p.expiresAt <= now()).map(([id, p]) => close(id, p)));
  }
  function take(loginId: string, phase: Pending['phase']) {
    const p = pending.get(loginId);
    if (!p) throw new TelegramLoginError('Signup expired. Request a new Telegram code.', 'LOGIN_EXPIRED');
    checkLive(loginId, p);
    if (p.busy) throw new TelegramLoginError('Verification is already in progress.', 'LOGIN_BUSY', 409);
    if (p.phase !== phase) throw new TelegramLoginError('Complete the current verification step first.', 'INVALID_PHASE');
    p.busy = true;
    return p;
  }
  async function verified(loginId: string, p: Pending): Promise<{ needs: 'pin' }> {
    p.authenticated = true;
    checkLive(loginId, p);
    const me = await p.client.getMe();
    checkLive(loginId, p);
    if (!me.phone || normalizeTelegramPhone(me.phone) !== p.phone) {
      throw new TelegramLoginError('The verified Telegram account does not match this phone number.', 'ACCOUNT_MISMATCH');
    }
    p.name = me.firstName ?? 'Account';
    p.phase = 'pin';
    return { needs: 'pin' };
  }
  async function fail(loginId: string, p: Pending, cause: unknown): Promise<never> {
    const error = signupError(cause);
    if (error.code === 'INVALID_CODE' || error.code === 'INVALID_PASSWORD') p.attempts++;
    if (p.attempts >= MAX_ATTEMPTS) {
      sendBlockedUntil = Math.max(sendBlockedUntil, now() + COOLDOWN_MS);
      await close(loginId, p);
      throw new TelegramLoginError('Too many incorrect attempts. Request a new code shortly.', 'TOO_MANY_ATTEMPTS', 429, 60);
    }
    if (error.retryAfter) sendBlockedUntil = Math.max(sendBlockedUntil, now() + error.retryAfter * 1000);
    if (!['INVALID_CODE', 'INVALID_PASSWORD', 'INVALID_PIN'].includes(error.code)) await close(loginId, p);
    throw error;
  }

  return {
    async start(apiId: number, apiHash: string, phone: string): Promise<{ loginId: string; needs: 'code'; retryAfter: number }> {
      await prune();
      requireUnconfigured();
      const normalized = normalizeTelegramPhone(phone);
      if (!normalized || !phone.trim().startsWith('+')) throw new TelegramLoginError('Include your international country code, for example +1 555 123 4567.', 'INVALID_PHONE');
      if (sendBlockedUntil > now()) throw new TelegramLoginError('Please wait before requesting another Telegram code.', 'TOO_MANY_ATTEMPTS', 429, Math.ceil((sendBlockedUntil - now()) / 1000));
      // Reserve before network I/O, so concurrent requests cannot send extra codes.
      sendBlockedUntil = now() + COOLDOWN_MS;
      if (pending.size >= 3) {
        const oldest = pending.entries().next().value;
        if (oldest) await close(...oldest);
      }
      const client = deps.makeClient(apiId, apiHash);
      try {
        await client.connect();
        requireUnconfigured();
        const { phoneCodeHash } = await client.sendCode({ apiId, apiHash }, normalized);
        requireUnconfigured();
        const loginId = randomBytes(24).toString('hex');
        const p: Pending = {
          client, apiId, apiHash, phone: normalized, phoneCodeHash,
          expiresAt: now() + TTL_MS, phase: 'code', busy: false,
          cancelled: false, authenticated: false, attempts: 0,
          timer: setTimeout(() => { void close(loginId, p); }, TTL_MS),
        };
        p.timer.unref();
        pending.set(loginId, p);
        return { loginId, needs: 'code', retryAfter: 60 };
      } catch (cause) {
        try { await client.disconnect(); } catch { /* best-effort cleanup */ }
        const error = signupError(cause);
        if (error.retryAfter) sendBlockedUntil = Math.max(sendBlockedUntil, now() + error.retryAfter * 1000);
        throw error;
      }
    },
    async verifyCode(loginId: string, code: string): Promise<{ needs: 'pin' | 'password' }> {
      await prune();
      const p = take(loginId, 'code');
      try {
        if (!/^\d{4,8}$/.test(code)) throw new TelegramLoginError('Enter the numeric code sent by Telegram.', 'INVALID_CODE');
        try { await p.client.signIn({ phoneNumber: p.phone, phoneCodeHash: p.phoneCodeHash, phoneCode: code }); }
        catch (cause) {
          if ((cause as { errorMessage?: string })?.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            checkLive(loginId, p);
            p.phase = 'password';
            return { needs: 'password' };
          }
          throw cause;
        }
        return await verified(loginId, p);
      } catch (cause) { return fail(loginId, p, cause); }
      finally { p.busy = false; }
    },
    async verifyPassword(loginId: string, password: string): Promise<{ needs: 'pin' }> {
      await prune();
      const p = take(loginId, 'password');
      try {
        if (!password || password.length > 1024) throw new TelegramLoginError('Enter your Telegram two-step password.', 'INVALID_PASSWORD');
        await p.client.signInPassword({ password });
        return await verified(loginId, p);
      } catch (cause) { return fail(loginId, p, cause); }
      finally { p.busy = false; }
    },
    async complete(loginId: string, pin: string): Promise<{ ok: true }> {
      await prune();
      const p = take(loginId, 'pin');
      try {
        if (!/^\d{4,12}$/.test(pin)) throw new TelegramLoginError('PIN must contain 4 to 12 digits.', 'INVALID_PIN');
        const channelId = await deps.createChannel(p.client);
        checkLive(loginId, p);
        deps.repo.completeSetup({ apiId: p.apiId, apiHash: p.apiHash, session: p.client.session.save(),
          channelId, name: p.name ?? 'Account', phone: p.phone, pin });
        // Preserve the authorization now owned by the saved drive.
        await close(loginId, p, true);
        await Promise.all([...pending].map(([id, other]) => close(id, other)));
        return { ok: true };
      } catch (cause) { return fail(loginId, p, cause); }
      finally { p.busy = false; }
    },
    async cancel(loginId: string): Promise<{ ok: true }> {
      const p = pending.get(loginId);
      if (p) await close(loginId, p);
      return { ok: true };
    },
    async dispose() { await Promise.all([...pending].map(([id, p]) => close(id, p))); },
  };
}
