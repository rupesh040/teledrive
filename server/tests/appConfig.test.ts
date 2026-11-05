import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { makeAppConfigRepo } from '../src/db/appConfig.js';

function setup() {
  return makeAppConfigRepo(createDb(':memory:'));
}

describe('app_config repo', () => {
  let repo: ReturnType<typeof makeAppConfigRepo>;
  beforeEach(() => { repo = setup(); });

  it('awalnya belum configured', () => {
    expect(repo.isConfigured()).toBe(false);
    expect(repo.get()).toBeUndefined();
  });

  it('menyimpan kredensial lalu session, channel, account', () => {
    repo.saveCredentials(123, 'hash');
    repo.saveSession('sess');
    repo.saveChannel('999');
    repo.saveAccount('Budi', '+628');
    const row = repo.get()!;
    expect(row.api_id).toBe(123);
    expect(row.session).toBe('sess');
    expect(row.channel_id).toBe('999');
    expect(row.account_name).toBe('Budi');
  });

  it('configured hanya saat session + channel + pin ada', () => {
    repo.saveCredentials(123, 'hash');
    repo.saveSession('sess');
    repo.saveChannel('999');
    expect(repo.isConfigured()).toBe(false);
    repo.setPin('1234');
    expect(repo.isConfigured()).toBe(true);
  });

  it('verifikasi PIN', () => {
    repo.saveCredentials(1, 'h');
    repo.setPin('1234');
    expect(repo.verifyPin('1234')).toBe(true);
    expect(repo.verifyPin('9999')).toBe(false);
  });

  it('clearAll mengosongkan config', () => {
    repo.saveCredentials(1, 'h');
    repo.setPin('1234');
    repo.clearAll();
    expect(repo.get()).toBeUndefined();
    expect(repo.isConfigured()).toBe(false);
  });

  it('commits verified signup with its PIN and never replaces a completed account', () => {
    const account = { apiId: 123, apiHash: 'hash', session: 'verified-session', channelId: '999', name: 'Test', phone: '+15551234567', pin: '1234' };
    repo.completeSetup(account);
    const original = repo.get();
    expect(repo.isConfigured()).toBe(true);
    expect(repo.verifyPin('1234')).toBe(true);
    expect(() => repo.completeSetup({ ...account, phone: '+15559999999', pin: '9999' })).toThrow();
    expect(repo.get()).toEqual(original);
    expect(repo.verifyPin('9999')).toBe(false);
  });

  it('can complete an old partial configuration with empty session or channel fields', () => {
    repo.saveCredentials(12, 'old');
    repo.saveSession('');
    repo.saveChannel('');
    repo.setPin('9999');
    expect(repo.isConfigured()).toBe(false);
    repo.completeSetup({ apiId: 123, apiHash: 'hash', session: 'verified-session', channelId: '999', name: 'Test', phone: '+15551234567', pin: '1234' });
    expect(repo.isConfigured()).toBe(true);
    expect(repo.verifyPin('1234')).toBe(true);
  });
});
