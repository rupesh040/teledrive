import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Hash the PIN with scrypt + a random salt. No external dependency.
export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return { hash, salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(pin, salt, 32);
  const stored = Buffer.from(hash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
