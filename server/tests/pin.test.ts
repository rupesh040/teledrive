import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '../src/auth/pin.js';

describe('pin hashing', () => {
  it('verifikasi benar untuk PIN yang sama', () => {
    const { hash, salt } = hashPin('1234');
    expect(verifyPin('1234', hash, salt)).toBe(true);
  });

  it('verifikasi gagal untuk PIN salah', () => {
    const { hash, salt } = hashPin('1234');
    expect(verifyPin('0000', hash, salt)).toBe(false);
  });

  it('salt berbeda menghasilkan hash berbeda untuk PIN sama', () => {
    const a = hashPin('1234');
    const b = hashPin('1234');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
