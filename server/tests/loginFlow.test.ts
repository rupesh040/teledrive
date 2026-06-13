import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { makeAppConfigRepo } from '../src/db/appConfig.js';
import { makeLoginFlow } from '../src/telegram/loginFlow.js';

// Mock client that mimics the GramJS surface used by loginFlow.
function fakeClientFactory(opts: { needPassword?: boolean } = {}) {
  return () => ({
    connected: false,
    async connect() { this.connected = true; },
    async disconnect() { this.connected = false; },
    async sendCode() { return { phoneCodeHash: 'HASH' }; },
    async signIn(args: { phoneCode: string }) {
      if (args.phoneCode !== '11111') {
        const e: any = new Error('PHONE_CODE_INVALID');
        e.errorMessage = 'PHONE_CODE_INVALID';
        throw e;
      }
      if (opts.needPassword) {
        const e: any = new Error('SESSION_PASSWORD_NEEDED');
        e.errorMessage = 'SESSION_PASSWORD_NEEDED';
        throw e;
      }
    },
    async signInPassword(args: { password: string }) {
      if (args.password !== 'rahasia') {
        const e: any = new Error('PASSWORD_HASH_INVALID');
        e.errorMessage = 'PASSWORD_HASH_INVALID';
        throw e;
      }
    },
    async getMe() { return { firstName: 'Budi', phone: '628' }; },
    session: { save: () => 'SESSION_STRING' },
    async createChannel() { return '999'; },
  });
}

function setup(opts = {}) {
  const repo = makeAppConfigRepo(createDb(':memory:'));
  const flow = makeLoginFlow({
    repo,
    makeClient: fakeClientFactory(opts) as any,
    createChannel: async () => '999',
    now: () => 1000,
  });
  return { repo, flow };
}

describe('login flow', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => { ctx = setup(); });

  it('jalur tanpa 2FA: start → verifyCode → pin', async () => {
    const { loginId, needs } = await ctx.flow.start(1, 'h', '+628');
    expect(needs).toBe('code');
    const r = await ctx.flow.verifyCode(loginId, '11111');
    expect(r.needs).toBe('pin');
    const row = ctx.repo.get()!;
    expect(row.session).toBe('SESSION_STRING');
    expect(row.channel_id).toBe('999');
    expect(row.account_name).toBe('Budi');
  });

  it('kode salah → error PHONE_CODE_INVALID', async () => {
    const { loginId } = await ctx.flow.start(1, 'h', '+628');
    await expect(ctx.flow.verifyCode(loginId, '00000')).rejects.toThrow('PHONE_CODE_INVALID');
  });

  it('jalur 2FA: verifyCode → needs password → verifyPassword → pin', async () => {
    const c = setup({ needPassword: true });
    const { loginId } = await c.flow.start(1, 'h', '+628');
    const r = await c.flow.verifyCode(loginId, '11111');
    expect(r.needs).toBe('password');
    const r2 = await c.flow.verifyPassword(loginId, 'rahasia');
    expect(r2.needs).toBe('pin');
    expect(c.repo.get()!.session).toBe('SESSION_STRING');
  });

  it('loginId tak dikenal ditolak', async () => {
    await expect(ctx.flow.verifyCode('ngawur', '11111')).rejects.toThrow();
  });
});
