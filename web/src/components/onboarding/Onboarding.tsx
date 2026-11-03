import { useState, type FormEvent } from 'react';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/lang.js';
import { AuthLayout, AuthSpinner } from '../AuthLayout.js';
import { MaterialButton } from '../material/MaterialButton.js';

type Step = 'creds' | 'code' | 'password' | 'pin';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t, lang } = useT();
  const en = lang === 'en';
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (step === 'creds') {
        if (!/^\d+$/.test(apiId) || Number(apiId) <= 0 || !Number.isSafeInteger(Number(apiId))) throw new Error(en ? 'Enter a valid numeric API ID.' : 'Masukkan API ID numerik yang valid.');
        if (!/^[a-f\d]{32}$/i.test(apiHash.trim())) throw new Error(en ? 'Your API Hash should contain 32 letters and numbers.' : 'API Hash harus berisi 32 huruf dan angka.');
        const normalizedPhone = phone.replace(/[\s()-]/g, '');
        if (!/^\+\d{6,15}$/.test(normalizedPhone)) throw new Error(en ? 'Include your country code, for example +1 555 123 4567.' : 'Sertakan kode negara, misalnya +62 812 3456 7890.');
        const result = await api.setupStart(Number(apiId), apiHash.trim(), normalizedPhone);
        setLoginId(result.loginId); setStep('code');
      } else if (step === 'code') {
        const result = await api.setupVerify(loginId, code.trim());
        setStep(result.needs === 'password' ? 'password' : 'pin');
      } else if (step === 'password') {
        await api.setupPassword(loginId, password); setPassword(''); setStep('pin');
      } else {
        if (!/^\d{4,}$/.test(pin)) throw new Error(t('setPinHint'));
        if (pin !== pin2) throw new Error(t('pinMismatch'));
        await api.setupPin(pin);
        setPin(''); setPin2(''); onDone();
      }
    } catch (cause) {
      if (cause instanceof Error && /TimeoutError|AbortError/.test(cause.name)) {
        setError(en ? 'The server took too long to respond. Please try again.' : 'Server terlalu lama merespons. Silakan coba lagi.');
      } else if (cause instanceof TypeError) {
        setError(en ? 'Unable to reach the server. Check your connection and try again.' : 'Tidak dapat menghubungi server. Periksa koneksi Anda dan coba lagi.');
      } else {
        setError(cause instanceof Error ? cause.message : en ? 'Something went wrong. Please try again.' : 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally { setBusy(false); }
  }

  const index = step === 'creds' ? 0 : step === 'pin' ? 2 : 1;
  const title = step === 'creds' ? (en ? 'Make yourself at home.' : 'Selamat datang di rumah.') : step === 'code' ? (en ? 'Check your Telegram.' : 'Periksa Telegram Anda.') : step === 'password' ? (en ? 'One more little step.' : 'Satu langkah lagi.') : t('setPinTitle');
  const description = step === 'creds' ? (en ? 'Connect your Telegram account to create your personal cloud. It only takes a moment.' : 'Hubungkan akun Telegram untuk membuat cloud pribadi Anda. Hanya perlu beberapa saat.') : step === 'code' ? `${t('otpHint')} ${phone}` : step === 'password' ? (en ? 'Your account uses two-step verification. Enter your Telegram password to continue.' : 'Akun Anda menggunakan verifikasi dua langkah. Masukkan kata sandi Telegram untuk melanjutkan.') : t('setPinHint');
  const buttonLabel = step === 'creds' ? (en ? 'Connect Telegram' : 'Hubungkan Telegram') : step === 'code' ? t('verify') : step === 'password' ? t('continueBtn') : (en ? 'Create account' : 'Buat akun');
  const waitingLabel = step === 'creds' ? (en ? 'Connecting…' : 'Menghubungkan…') : step === 'pin' ? (en ? 'Creating your space…' : 'Menyiapkan ruang Anda…') : (en ? 'Verifying…' : 'Memverifikasi…');

  return (
    <AuthLayout>
      <ol className="auth-stepper" aria-label={en ? 'Setup progress' : 'Progres pengaturan'}>
        {(en ? ['Connect', 'Verify', 'Protect'] : ['Hubungkan', 'Verifikasi', 'Lindungi']).map((label, i) => <li key={label} data-active={i === index} data-done={i < index} aria-current={i === index ? 'step' : undefined}><span>{i < index ? '✓' : i + 1}</span>{label}</li>)}
      </ol>
      <h2 className="auth-form-title">{title}</h2>
      <p className="auth-form-description">{description}</p>
      <form key={step} className="auth-form" onSubmit={submit} aria-busy={busy}>
        {step === 'creds' && <>
          <div className="auth-credentials-row">
            <label className="auth-field" htmlFor="api-id"><span>{t('apiIdLabel')}</span><input id="api-id" name="apiId" inputMode="numeric" placeholder="12345678" value={apiId} onChange={e => setApiId(e.target.value)} disabled={busy} required autoComplete="off" /></label>
            <label className="auth-field" htmlFor="api-hash"><span>{t('apiHashLabel')}</span><input id="api-hash" name="apiHash" type="password" placeholder={en ? 'Your API hash' : 'API Hash Anda'} value={apiHash} onChange={e => setApiHash(e.target.value)} disabled={busy} required autoComplete="off" spellCheck={false} /></label>
          </div>
          <a className="auth-help-link" href="https://my.telegram.org/apps" target="_blank" rel="noreferrer">{en ? 'Where do I find these?' : 'Di mana saya menemukannya?'}<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 3h5v5M9 3 3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
          <label className="auth-field" htmlFor="phone"><span>{t('phoneLabel')}</span><input id="phone" name="phone" type="tel" placeholder={en ? '+1 555 123 4567' : '+62 812 3456 7890'} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} autoComplete="tel" required /><small>{en ? 'Use the phone number linked to your Telegram account.' : 'Gunakan nomor yang terhubung ke akun Telegram Anda.'}</small></label>
        </>}
        {step === 'code' && <label className="auth-field" htmlFor="otp"><span>{t('otpLabel')}</span><input key="otp" id="otp" name="otp" className="auth-pin-input" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="00000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy} required /></label>}
        {step === 'password' && <label className="auth-field" htmlFor="telegram-password"><span>{t('passwordLabel')}</span><input key="password" id="telegram-password" name="telegramPassword" type="password" placeholder={t('passwordLabel')} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} required autoFocus autoComplete="current-password" /></label>}
        {step === 'pin' && <>
          <label className="auth-field" htmlFor="new-pin"><span>{t('enterPin')}</span><input key="pin" id="new-pin" name="pin" type="password" inputMode="numeric" placeholder="••••" autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} disabled={busy} required minLength={4} autoFocus /></label>
          <label className="auth-field" htmlFor="confirm-pin"><span>{t('confirmPinLabel')}</span><input id="confirm-pin" name="confirmPin" type="password" inputMode="numeric" placeholder="••••" autoComplete="new-password" value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} disabled={busy} required minLength={4} /></label>
        </>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <MaterialButton type="submit" className="auth-submit" disabled={busy} icon={busy ? <AuthSpinner /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}>{busy ? waitingLabel : buttonLabel}</MaterialButton>
        {(step === 'code' || step === 'password') && <MaterialButton type="button" variant="text" className="auth-back" disabled={busy} onClick={() => { setStep('creds'); setCode(''); setPassword(''); setError(null); }}>{en ? 'Use a different number or start again' : 'Gunakan nomor lain atau mulai lagi'}</MaterialButton>}
      </form>
      <p className="auth-card-note"><svg width="11" height="13" viewBox="0 0 12 14" fill="none" aria-hidden="true"><rect x="2" y="6" width="8" height="6" rx="1.5" stroke="currentColor" /><path d="M4 6V4a2 2 0 0 1 4 0v2" stroke="currentColor" strokeLinecap="round" /></svg>{en ? 'Connection settings are saved for this drive. Files are stored in your own Telegram account.' : 'Pengaturan koneksi disimpan untuk drive ini. File disimpan di akun Telegram Anda sendiri.'}</p>
    </AuthLayout>
  );
}
