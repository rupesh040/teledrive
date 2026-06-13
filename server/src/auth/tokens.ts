import { randomBytes } from 'node:crypto';

// Session tokens are kept in memory. Lost on server restart (this is the
// desired behavior: the user enters the PIN again after the server restarts).
const tokens = new Set<string>();

export function issueToken(): string {
  const token = randomBytes(32).toString('hex');
  tokens.add(token);
  return token;
}

export function isValidToken(token: string | undefined | null): boolean {
  return !!token && tokens.has(token);
}

export function revokeToken(token: string): void {
  tokens.delete(token);
}

export function revokeAll(): void {
  tokens.clear();
}
