import { describe, it, expect, beforeEach } from 'vitest';
import { issueToken, isValidToken, revokeToken, revokeAll, createTokenStore, SESSION_TTL_MS, REMEMBERED_SESSION_TTL_MS } from '../src/auth/tokens.js';

describe('token store', () => {
  beforeEach(() => revokeAll());

  it('token terbit valid', () => {
    const t = issueToken();
    expect(isValidToken(t)).toBe(true);
  });

  it('token acak ditolak', () => {
    issueToken();
    expect(isValidToken('bukan-token')).toBe(false);
  });

  it('revokeToken mencabut satu token', () => {
    const t = issueToken();
    revokeToken(t);
    expect(isValidToken(t)).toBe(false);
  });

  it('revokeAll mencabut semua', () => {
    const a = issueToken();
    const b = issueToken();
    revokeAll();
    expect(isValidToken(a)).toBe(false);
    expect(isValidToken(b)).toBe(false);
  });

  it('expires a normal session at twelve hours while a remembered session lasts seven days', () => {
    let time = 1000;
    const store = createTokenStore(() => time);
    const normal = store.issueToken();
    const remembered = store.issueToken(true);
    time += SESSION_TTL_MS - 1;
    expect(store.isValidToken(normal)).toBe(true);
    time += 1;
    expect(store.isValidToken(normal)).toBe(false);
    expect(store.isValidToken(remembered)).toBe(true);
    time = 1000 + REMEMBERED_SESSION_TTL_MS;
    expect(store.isValidToken(remembered)).toBe(false);
  });

  it('does not accept a prior API process token in a new token store', () => {
    const previousProcess = createTokenStore();
    const token = previousProcess.issueToken(true);
    expect(createTokenStore().isValidToken(token)).toBe(false);
    previousProcess.revokeAll();
    expect(previousProcess.isValidToken(token)).toBe(false);
  });
});
