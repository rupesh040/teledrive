import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { computeCheck } from 'telegram/Password.js';
import type { LoginClient } from './loginFlow.js';
import { createStorageChannel } from './channel.js';

// Wrap the real TelegramClient to fit the LoginClient interface.
export function makeGramClient(apiId: number, apiHash: string): LoginClient {
  const tc = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });
  return {
    get connected() { return tc.connected ?? false; },
    set connected(_v: boolean) { /* managed by TelegramClient */ },
    connect: async () => { await tc.connect(); },
    disconnect: () => tc.disconnect(),
    async sendCode(creds: { apiId: number; apiHash: string }, phone: string) {
      const r = await tc.sendCode({ apiId: creds.apiId, apiHash: creds.apiHash }, phone);
      return { phoneCodeHash: r.phoneCodeHash };
    },
    async signIn(args: { phoneNumber: string; phoneCodeHash: string; phoneCode: string }) {
      await tc.invoke(new Api.auth.SignIn({
        phoneNumber: args.phoneNumber,
        phoneCodeHash: args.phoneCodeHash,
        phoneCode: args.phoneCode,
      }));
    },
    async signInPassword(args: { password: string }) {
      const pwd = await tc.invoke(new Api.account.GetPassword());
      const check = await computeCheck(pwd, args.password);
      await tc.invoke(new Api.auth.CheckPassword({ password: check }));
    },
    async getMe() {
      const me = (await tc.getMe()) as Api.User;
      return { firstName: me.firstName ?? undefined, phone: me.phone ?? undefined };
    },
    session: { save: () => String(tc.session.save()) },
    // Keep a reference to the real TelegramClient for createChannel.
    _tc: tc,
  } as unknown as LoginClient;
}

// createChannel used by loginFlow: grab the real TelegramClient from the adapter.
export async function createChannelFromLoginClient(client: LoginClient): Promise<string> {
  const tc = (client as unknown as { _tc: TelegramClient })._tc;
  return createStorageChannel(tc);
}
