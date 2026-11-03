import { randomBytes } from 'node:crypto';
import type { AppConfigRow } from '../db/appConfig.js';

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

interface AppConfigRepoLike {
  saveCredentials(apiId: number, apiHash: string): void;
  saveSession(session: string): void;
  saveChannel(channelId: string): void;
  saveAccount(name: string, phone: string): void;
  get(): AppConfigRow | undefined;
}

interface Deps {
  repo: AppConfigRepoLike;
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
  createdAt: number;
}

const TTL_MS = 5 * 60 * 1000;

export function makeLoginFlow(deps: Deps) {
  const now = deps.now ?? (() => Date.now());
  const pending = new Map<string, Pending>();

  function take(loginId: string): Pending {
    const p = pending.get(loginId);
    if (!p) throw new Error('Login session not found or expired. Start over.');
    if (now() - p.createdAt > TTL_MS) {
      pending.delete(loginId);
      throw new Error('Login session expired. Start over.');
    }
    return p;
  }

  // After successful auth: save the session, create the channel, save the account, clear pending.
  async function finish(loginId: string, p: Pending): Promise<{ needs: 'pin' }> {
    const session = p.client.session.save();
    deps.repo.saveSession(session);
    const me = await p.client.getMe();
    deps.repo.saveAccount(me.firstName ?? 'Account', me.phone ?? p.phone);
    const channelId = await deps.createChannel(p.client);
    deps.repo.saveChannel(channelId);
    try { await p.client.disconnect(); } catch { /* ignore */ }
    pending.delete(loginId);
    return { needs: 'pin' };
  }

  return {
    async start(apiId: number, apiHash: string, phone: string): Promise<{ loginId: string; needs: 'code' }> {
      deps.repo.saveCredentials(apiId, apiHash);
      const client = deps.makeClient(apiId, apiHash);
      await client.connect();
      const { phoneCodeHash } = await client.sendCode({ apiId, apiHash }, phone);
      const loginId = randomBytes(16).toString('hex');
      pending.set(loginId, { client, apiId, apiHash, phone, phoneCodeHash, createdAt: now() });
      return { loginId, needs: 'code' };
    },

    async verifyCode(loginId: string, code: string): Promise<{ needs: 'pin' | 'password' }> {
      const p = take(loginId);
      try {
        await p.client.signIn({ phoneNumber: p.phone, phoneCodeHash: p.phoneCodeHash, phoneCode: code });
      } catch (e) {
        if ((e as { errorMessage?: string }).errorMessage === 'SESSION_PASSWORD_NEEDED') {
          return { needs: 'password' };
        }
        throw e;
      }
      return finish(loginId, p);
    },

    async verifyPassword(loginId: string, password: string): Promise<{ needs: 'pin' }> {
      const p = take(loginId);
      await p.client.signInPassword({ password });
      return finish(loginId, p);
    },
  };
}
