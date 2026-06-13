import { useState } from 'react';
import { api } from '../../api/client.js';
import { setToken } from '../../api/auth.js';
import { useT } from '../../i18n/lang.js';
import { LangToggle } from '../LangToggle.js';

type Step = 'creds' | 'code' | 'password' | 'pin';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [step, setStep] = useState<Step>('creds');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const start = () => run(async () => {
    const r = await api.setupStart(Number(apiId), apiHash.trim(), phone.trim());
    setLoginId(r.loginId); setStep('code');
  });
  const verify = () => run(async () => {
    const r = await api.setupVerify(loginId, code.trim());
    setStep(r.needs === 'password' ? 'password' : 'pin');
  });
  const verifyPw = () => run(async () => {
    await api.setupPassword(loginId, password);
    setStep('pin');
  });
  const submitPin = () => run(async () => {
    if (pin.length < 4) { setError(t('setPinHint')); return; }
    if (pin !== pin2) { setError(t('pinMismatch')); return; }
    const r = await api.setupPin(pin);
    setToken(r.token);
    onDone();
  });

  const field = 'w-full px-4 py-2.5 rounded-xl bg-panel/70 border border-line text-content ring-accent';
  const primary = 'w-full py-2.5 rounded-xl font-semibold text-ink bg-gradient-to-b from-accent-2 to-accent shadow-glow disabled:opacity-60';
  // Press Enter in an input → run the active step's action (unless busy).
  const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); if (!busy) fn(); }
  };

  return (
    <div className="h-screen grid place-items-center bg-ink px-4 relative">
      <div className="absolute top-5 right-5"><LangToggle /></div>
      <div className="pop-in w-full max-w-sm bg-panel border border-line rounded-2xl p-6 flex flex-col gap-4 shadow-lift">
        <div>
          <h1 className="font-display text-2xl text-content">{t('welcomeTitle')}</h1>
          <p className="text-sm text-muted mt-1">{t('welcomeSubtitle')}</p>
        </div>

        {step === 'creds' && (
          <>
            <input className={field} placeholder={t('apiIdLabel')} value={apiId} onChange={(e) => setApiId(e.target.value)} onKeyDown={onEnter(start)} />
            <input className={field} placeholder={t('apiHashLabel')} value={apiHash} onChange={(e) => setApiHash(e.target.value)} onKeyDown={onEnter(start)} />
            <input className={field} placeholder={t('phoneLabel')} value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={onEnter(start)} />
            <a className="text-xs text-accent hover:underline" href="https://my.telegram.org" target="_blank" rel="noreferrer">{t('getApiHint')}</a>
            <button className={primary} disabled={busy} onClick={start}>{t('sendCode')}</button>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="text-sm text-muted">{t('otpHint')}</p>
            <input className={field} placeholder={t('otpLabel')} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onEnter(verify)} />
            <button className={primary} disabled={busy} onClick={verify}>{t('verify')}</button>
          </>
        )}

        {step === 'password' && (
          <>
            <input className={field} type="password" placeholder={t('passwordLabel')} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter(verifyPw)} />
            <button className={primary} disabled={busy} onClick={verifyPw}>{t('continueBtn')}</button>
          </>
        )}

        {step === 'pin' && (
          <>
            <h2 className="font-medium text-content">{t('setPinTitle')}</h2>
            <p className="text-sm text-muted">{t('setPinHint')}</p>
            <input className={field} type="password" inputMode="numeric" placeholder={t('enterPin')} value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={onEnter(submitPin)} />
            <input className={field} type="password" inputMode="numeric" placeholder={t('confirmPinLabel')} value={pin2} onChange={(e) => setPin2(e.target.value)} onKeyDown={onEnter(submitPin)} />
            <button className={primary} disabled={busy} onClick={submitPin}>{t('finish')}</button>
          </>
        )}

        {error && <p className="text-sm text-[#e0584c]">{error}</p>}
      </div>
    </div>
  );
}
