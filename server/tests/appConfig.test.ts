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
});
