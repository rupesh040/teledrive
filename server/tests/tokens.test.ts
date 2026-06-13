import { describe, it, expect, beforeEach } from 'vitest';
import { issueToken, isValidToken, revokeToken, revokeAll } from '../src/auth/tokens.js';

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
});
