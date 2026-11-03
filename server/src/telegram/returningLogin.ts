import { randomBytes } from 'node:crypto';
import type { LoginClient } from './loginFlow.js';

interface ReturningAccount {
  api_id: number | null;
  api_hash: string | null;
  account_phone: string | null;
}
export interface ReturningLoginDependencies {
  repo: { isConfigured(): boolean; get(): ReturningAccount | undefined };
  makeClient(apiId: number, apiHash: string): LoginClient;
  issueToken(remember?: boolean): string;
  now?: () => number;
}
export class TelegramLoginError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400, public readonly retryAfter?: number) {
    super(message);
    this.name = 'TelegramLoginError';
  }
}

interface Pending {
  client: LoginClient;
  phone: string;
  phoneCodeHash: string;
  remember: boolean;
  phase: 'code' | 'password';
  attempts: number;
  expiresAt: number;
  busy: boolean;
  cancelled: boolean;
  authenticated: boolean;
  timer: ReturnType<typeof setTimeout>;
}
const TTL_MS = 5 * 60_000;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

/** Compare Telegram's digits-only identity with an international phone number. */
export function normalizeTelegramPhone(phone: string): string | null {
  const cleaned = phone.trim().replace(/[\s()-]/g, '');
  return /^\+?[1-9]\d{5,14}$/.test(cleaned) ? `+${cleaned.replace(/^\+/, '')}` : null;
}

function telegramError(error: unknown): TelegramLoginError {
  if (error instanceof TelegramLoginError) return error;
  const rpc = error as { errorMessage?: string; seconds?: number };
  const message = rpc?.errorMessage ?? '';
  if (/FLOOD_WAIT|FLOOD_PREMIUM_WAIT|PHONE_PASSWORD_FLOOD|PHONE_NUMBER_FLOOD/.test(message)) {
    const seconds = Number.isFinite(rpc.seconds) && Number(rpc.seconds) > 0
      ? Math.ceil(Number(rpc.seconds)) : Number(message.match(/_(\d+)$/)?.[1]) || 60;
    return new TelegramLoginError('Telegram is limiting login attempts. Please wait before trying again.', 'FLOOD_WAIT', 429, Math.min(seconds, 86400));
  }
  const errors: Record<string, [string, string]> = {
    PHONE_CODE_INVALID: ['Incorrect Telegram code. Please try again.', 'INVALID_CODE'],
    PHONE_CODE_EMPTY: ['Enter the code sent by Telegram.', 'INVALID_CODE'],
    PHONE_CODE_EXPIRED: ['This Telegram code expired. Request a new code.', 'LOGIN_EXPIRED'],
    PASSWORD_HASH_INVALID: ['Incorrect Telegram two-step password. Please try again.', 'INVALID_PASSWORD'],
    PHONE_NUMBER_INVALID: ['Enter a valid phone number with its country code.', 'INVALID_PHONE'],
    PHONE_NUMBER_BANNED: ['Telegram cannot sign in this phone number.', 'PHONE_UNAVAILABLE'],
    PHONE_NUMBER_UNOCCUPIED: ['This phone number does not have a Telegram account.', 'PHONE_UNAVAILABLE'],
  };
  const mapped = errors[message];
  return mapped ? new TelegramLoginError(...mapped)
    : new TelegramLoginError('Unable to connect to Telegram. Please try again.', 'TELEGRAM_UNAVAILABLE', 503);
}

/** A separate proof-of-identity flow. It never changes the saved drive or Telegram session. */
export function makeReturningLoginFlow(deps: ReturningLoginDependencies) {
  const now = deps.now ?? Date.now;
  const pending = new Map<string, Pending>();
  let sendBlockedUntil = 0;

  async function close(loginId: string, p: Pending) {
    if (pending.get(loginId) === p) pending.delete(loginId);
    p.cancelled = true;
    clearTimeout(p.timer);
    // A successful proof need not leave an unused Telegram authorization behind.
    if (p.authenticated) {
      try { await p.client.logOut?.(); } catch { /* disconnect still releases the local client */ }
    }
    try { await p.client.disconnect(); } catch { /* best-effort cleanup */ }
  }
  async function prune() {
    await Promise.all([...pending].filter(([, p]) => p.expiresAt <= now()).map(([id, p]) => close(id, p)));
  }
  function take(loginId: string, phase: Pending['phase']): Pending {
    const p = pending.get(loginId);
    if (!p || p.cancelled || p.expiresAt <= now()) throw new TelegramLoginError('Login expired. Request a new Telegram code.', 'LOGIN_EXPIRED');
    if (p.phase !== phase) throw new TelegramLoginError('Complete the current verification step first.', 'INVALID_PHASE');
    if (p.busy) throw new TelegramLoginError('Verification is already in progress.', 'LOGIN_BUSY', 409);
    p.busy = true;
    return p;
  }
  function checkLive(loginId: string, p: Pending) {
    if (p.cancelled || pending.get(loginId) !== p || p.expiresAt <= now()) throw new TelegramLoginError('Login expired. Request a new Telegram code.', 'LOGIN_EXPIRED');
  }
  async function finish(loginId: string, p: Pending): Promise<{ token: string }> {
    p.authenticated = true;
    checkLive(loginId, p);
    const me = await p.client.getMe();
    checkLive(loginId, p);
    const configured = deps.repo.get();
    if (!deps.repo.isConfigured() || !me.phone || normalizeTelegramPhone(me.phone) !== p.phone || normalizeTelegramPhone(configured?.account_phone ?? '') !== p.phone) {
      await close(loginId, p);
      throw new TelegramLoginError('Sign in with the Telegram account connected to this drive.', 'ACCOUNT_MISMATCH');
    }
    // Consume before issuing the token, so concurrent requests cannot replay a proof.
    pending.delete(loginId);
    const token = deps.issueToken(p.remember);
    await close(loginId, p);
    return { token };
  }
  async function fail(loginId: string, p: Pending, cause: unknown): Promise<never> {
    const error = telegramError(cause);
    if (error.code === 'INVALID_CODE' || error.code === 'INVALID_PASSWORD') p.attempts += 1;
    if (p.attempts >= MAX_ATTEMPTS) {
      sendBlockedUntil = Math.max(sendBlockedUntil, now() + RESEND_SECONDS * 1000);
      await close(loginId, p);
      throw new TelegramLoginError('Too many incorrect attempts. Request a new code shortly.', 'TOO_MANY_ATTEMPTS', 429, RESEND_SECONDS);
    }
    if (error.retryAfter) sendBlockedUntil = Math.max(sendBlockedUntil, now() + error.retryAfter * 1000);
    if (['LOGIN_EXPIRED', 'ACCOUNT_MISMATCH', 'FLOOD_WAIT', 'TELEGRAM_UNAVAILABLE'].includes(error.code)) await close(loginId, p);
    throw error;
  }

  return {
    async start(phone: string, remember = false): Promise<{ loginId: string; needs: 'code'; retryAfter: number }> {
      await prune();
      const account = deps.repo.get();
      if (!deps.repo.isConfigured() || !account?.api_id || !account.api_hash) throw new TelegramLoginError('Create your account before signing in.', 'NOT_CONFIGURED');
      const normalized = normalizeTelegramPhone(phone);
      if (!normalized || !phone.trim().startsWith('+')) throw new TelegramLoginError('Include a valid international country code, for example +1 555 123 4567.', 'INVALID_PHONE');
      if (normalized !== normalizeTelegramPhone(account.account_phone ?? '')) throw new TelegramLoginError('Use the phone number connected to this drive.', 'ACCOUNT_MISMATCH');
      if (sendBlockedUntil > now()) throw new TelegramLoginError('Please wait before requesting another Telegram code.', 'TOO_MANY_ATTEMPTS', 429, Math.ceil((sendBlockedUntil - now()) / 1000));
      // Reserve the cooldown before network I/O; concurrent starts cannot send multiple codes.
      sendBlockedUntil = now() + RESEND_SECONDS * 1000;
      if (pending.size >= 3) {
        const oldest = pending.entries().next().value;
        if (oldest) await close(...oldest);
      }
      const client = deps.makeClient(account.api_id, account.api_hash);
      try {
        await client.connect();
        const { phoneCodeHash } = await client.sendCode({ apiId: account.api_id, apiHash: account.api_hash }, normalized);
        const loginId = randomBytes(24).toString('hex');
        const p: Pending = {
          client, phone: normalized, phoneCodeHash, remember, phase: 'code', attempts: 0,
          expiresAt: now() + TTL_MS, busy: false, cancelled: false, authenticated: false,
          timer: setTimeout(() => { void close(loginId, p); }, TTL_MS),
        };
        p.timer.unref();
        pending.set(loginId, p);
        return { loginId, needs: 'code', retryAfter: RESEND_SECONDS };
      } catch (cause) {
        try { await client.disconnect(); } catch { /* best-effort cleanup */ }
        const error = telegramError(cause);
        if (error.retryAfter) sendBlockedUntil = Math.max(sendBlockedUntil, now() + error.retryAfter * 1000);
        throw error;
      }
    },
    async verifyCode(loginId: string, code: string): Promise<{ needs: 'password' } | { token: string }> {
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
        return await finish(loginId, p);
      } catch (cause) { return fail(loginId, p, cause); }
      finally { p.busy = false; }
    },
    async verifyPassword(loginId: string, password: string): Promise<{ token: string }> {
      await prune();
      const p = take(loginId, 'password');
      try {
        if (!password || password.length > 1024) throw new TelegramLoginError('Enter your Telegram two-step password.', 'INVALID_PASSWORD');
        await p.client.signInPassword({ password });
        return await finish(loginId, p);
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

export type ReturningLoginFlow = ReturnType<typeof makeReturningLoginFlow>;
