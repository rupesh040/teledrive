import { randomBytes } from 'node:crypto';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const REMEMBERED_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TokenStore {
  issueToken(remember?: boolean): string;
  isValidToken(token: string | undefined | null): boolean;
  revokeToken(token: string): void;
  revokeAll(): void;
}

// Tokens deliberately stay in memory: restarting the API requires login again.
export function createTokenStore(now: () => number = Date.now): TokenStore {
  const tokens = new Map<string, number>();
  return {
    issueToken(remember = false) {
      const timestamp = now();
      for (const [token, expiresAt] of tokens) {
        if (expiresAt <= timestamp) tokens.delete(token);
      }
      const token = randomBytes(32).toString('hex');
      tokens.set(token, timestamp + (remember ? REMEMBERED_SESSION_TTL_MS : SESSION_TTL_MS));
      return token;
    },
    isValidToken(token) {
      if (!token) return false;
      const expiresAt = tokens.get(token);
      if (expiresAt === undefined) return false;
      if (expiresAt <= now()) { tokens.delete(token); return false; }
      return true;
    },
    revokeToken(token) { tokens.delete(token); },
    revokeAll() { tokens.clear(); },
  };
}

export const tokenStore = createTokenStore();
export const issueToken = tokenStore.issueToken;
export const isValidToken = tokenStore.isValidToken;
export const revokeToken = tokenStore.revokeToken;
export const revokeAll = tokenStore.revokeAll;
