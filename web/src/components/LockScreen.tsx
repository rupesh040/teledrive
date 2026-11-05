import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client.js';
import { setToken } from '../api/auth.js';
import { useT } from '../i18n/lang.js';
import { AuthLayout, AuthSpinner, CloudMark } from './AuthLayout.js';
import { MaterialButton } from './material/MaterialButton.js';
import { LinearProgress } from './material/Progress.js';

type Step = 'phone' | 'code' | 'password' | 'pin';

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const { t, lang } = useT();
  const en = lang === 'en';
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendUntil, setResendUntil] = useState(0);
  const [telegramRetryUntil, setTelegramRetryUntil] = useState(0);
  const [pinRetryUntil, setPinRetryUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const loginId = useRef('');
  const generation = useRef(0);
  const mounted = useRef(true);
  const resendSeconds = Math.max(0, Math.ceil((resendUntil - now) / 1000));
  const retryUntil = step === 'pin' ? pinRetryUntil : telegramRetryUntil;
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const submitRetrySeconds = step === 'phone' ? Math.max(retrySeconds, resendSeconds) : retrySeconds;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      if (loginId.current) void api.telegramCancel(loginId.current).catch(() => {});
      loginId.current = '';
    };
  }, []);

  useEffect(() => {
    const until = Math.max(resendUntil, telegramRetryUntil, pinRetryUntil);
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendUntil, telegramRetryUntil, pinRetryUntil]);

  function discardChallenge() {
    const id = loginId.current;
    loginId.current = '';
    if (id) void api.telegramCancel(id).catch(() => {});
  }

  function changeStep(next: 'phone' | 'pin') {
    if (next === 'pin') {
      const normalized = normalizePhone();
      if (!normalized) return;
      setPhone(normalized);
    }
    generation.current++;
    discardChallenge();
    setStep(next); setCode(''); setPassword(''); setPin(''); setShowSecret(false); setError(null);
  }

  function normalizePhone() {
    const normalized = phone.trim().replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{5,14}$/.test(normalized)) {
      setError(en ? 'Include your country code, for example +1 555 123 4567.' : 'Sertakan kode negara, misalnya +62 812 3456 7890.');
      return null;
    }
    return normalized;
  }

  function showError(cause: unknown, method: 'pin' | 'telegram' = step === 'pin' ? 'pin' : 'telegram') {
    if (cause instanceof ApiError) {
      if (cause.retryAfter) {
        const until = Date.now() + cause.retryAfter * 1000;
        if (method === 'pin') setPinRetryUntil(until);
        else setTelegramRetryUntil(until);
      }
      const messages: Record<string, [string, string]> = {
        INVALID_PHONE: ['Enter a phone number with its country code, such as +1 555 123 4567.', 'Masukkan nomor dengan kode negara, misalnya +62 812 3456 7890.'],
        ACCOUNT_MISMATCH: ['Use the Telegram number connected to this drive.', 'Gunakan nomor Telegram yang terhubung ke drive ini.'],
        INVALID_CODE: ['That code is incorrect. Check Telegram and try again.', 'Kode salah. Periksa Telegram lalu coba lagi.'],
        INVALID_PASSWORD: ['Incorrect Telegram password. Please try again.', 'Kata sandi Telegram salah. Silakan coba lagi.'],
        INVALID_PIN: ['Incorrect phone number or PIN. Please try again.', 'Nomor atau PIN salah. Silakan coba lagi.'],
        LOGIN_EXPIRED: ['This code has expired. Enter your number to request a new one.', 'Kode kedaluwarsa. Masukkan nomor untuk meminta kode baru.'],
        INVALID_PHASE: ['Start again to request a new Telegram code.', 'Mulai lagi untuk meminta kode Telegram baru.'],
        TOO_MANY_ATTEMPTS: ['Too many attempts. Please wait before trying again.', 'Terlalu banyak percobaan. Tunggu sebelum mencoba lagi.'],
        FLOOD_WAIT: ['Telegram has asked you to wait. Try again when the countdown finishes.', 'Telegram meminta Anda menunggu. Coba lagi setelah hitung mundur selesai.'],
        TELEGRAM_UNAVAILABLE: ['Could not connect to Telegram. Please try again.', 'Tidak dapat terhubung ke Telegram. Silakan coba lagi.'],
        PHONE_UNAVAILABLE: ['Telegram could not send a code to this number. Check the number and try again.', 'Telegram tidak dapat mengirim kode ke nomor ini. Periksa nomor lalu coba lagi.'],
        NOT_CONFIGURED: ['Finish setting up this drive before signing in.', 'Selesaikan pengaturan drive sebelum masuk.'],
        LOGIN_BUSY: ['Verification is already in progress. Please try again shortly.', 'Verifikasi sedang berjalan. Silakan coba lagi sebentar.'],
      };
      setError(messages[cause.code ?? '']?.[en ? 0 : 1] ?? (en ? 'Unable to sign in. Please try again.' : 'Tidak dapat masuk. Silakan coba lagi.'));
      if (['LOGIN_EXPIRED', 'INVALID_PHASE', 'TOO_MANY_ATTEMPTS', 'FLOOD_WAIT', 'TELEGRAM_UNAVAILABLE', 'ACCOUNT_MISMATCH'].includes(cause.code ?? '') && method === 'telegram') {
        discardChallenge(); setStep('phone'); setCode(''); setPassword(''); setShowSecret(false);
      }
      if (cause.code === 'INVALID_CODE') setCode('');
      if (cause.code === 'INVALID_PASSWORD') setPassword('');
      if (cause.code === 'INVALID_PIN') setPin('');
    } else if (cause instanceof Error && /TimeoutError|AbortError/.test(cause.name)) {
      setError(en ? 'The server took too long to respond. Please try again.' : 'Server terlalu lama merespons. Silakan coba lagi.');
    } else {
      setError(en ? 'Unable to reach the server. Check your connection and try again.' : 'Tidak dapat menghubungi server. Periksa koneksi Anda dan coba lagi.');
    }
  }

  async function requestCode() {
    if (busy || telegramRetryUntil > Date.now() || resendUntil > Date.now()) return;
    const normalizedPhone = normalizePhone();
    if (!normalizedPhone) return;
    const requestGeneration = ++generation.current;
    const current = () => mounted.current && requestGeneration === generation.current;
    setBusy(true); setError(null);
    try {
      const oldId = loginId.current;
      loginId.current = '';
      if (oldId) await api.telegramCancel(oldId).catch(() => {});
      if (!current()) return;
      const result = await api.telegramStart(normalizedPhone, remember);
      if (!current()) { void api.telegramCancel(result.loginId).catch(() => {}); return; }
      loginId.current = result.loginId;
      setPhone(normalizedPhone); setCode(''); setPassword(''); setPin(''); setShowSecret(false); setStep('code');
      setResendUntil(Date.now() + Math.max(0, result.retryAfter) * 1000);
    } catch (cause) { if (current()) showError(cause, 'telegram'); }
    finally { if (current()) setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'phone') { await requestCode(); return; }
    if (busy || retrySeconds > 0) return;
    const requestGeneration = ++generation.current;
    const current = () => mounted.current && requestGeneration === generation.current;
    setBusy(true); setError(null);
    try {
      const result = step === 'pin'
        ? await api.login(phone, pin, remember)
        : step === 'password'
          ? await api.telegramPassword(loginId.current, password)
          : await api.telegramVerify(loginId.current, code);
      if (!current()) return;
      if ('token' in result) {
        loginId.current = '';
        setPassword(''); setPin(''); setCode('');
        setToken(result.token, remember);
        onUnlocked();
      } else {
        setCode(''); setPassword(''); setShowSecret(false); setStep('password');
      }
    } catch (cause) { if (current()) showError(cause); }
    finally { if (current()) setBusy(false); }
  }

  const title = step === 'code' ? (en ? 'Check your Telegram' : 'Periksa Telegram Anda') : step === 'password' ? (en ? 'Two-step verification' : 'Verifikasi dua langkah') : (en ? 'Sign in to TeleDrive' : 'Masuk ke TeleDrive');
  const description = step === 'phone'
    ? (en ? 'Use the same number you signed up with, then choose a Telegram code or your app PIN.' : 'Gunakan nomor saat mendaftar, lalu pilih kode Telegram atau PIN aplikasi Anda.')
    : step === 'code'
      ? (en ? `Enter the code Telegram sent to ${phone}. Check the Telegram app on your signed-in devices.` : `Masukkan kode yang dikirim Telegram ke ${phone}. Periksa aplikasi Telegram pada perangkat yang sudah masuk.`)
      : step === 'password'
        ? (en ? 'Your Telegram account has two-step verification. Enter your Telegram password to continue.' : 'Akun Telegram Anda menggunakan verifikasi dua langkah. Masukkan kata sandi Telegram untuk melanjutkan.')
        : (en ? `Enter the app PIN you created for ${phone}.` : `Masukkan PIN aplikasi yang Anda buat untuk ${phone}.`);
  const buttonLabel = step === 'phone' ? (en ? 'Send Telegram code' : 'Kirim kode Telegram') : (en ? 'Sign in' : 'Masuk');
  const cannotSubmit = busy || submitRetrySeconds > 0 || (step === 'phone' ? !phone.trim() : step === 'code' ? code.length < 4 : step === 'password' ? !password : pin.length < 4);

  return <AuthLayout compact>
    <div className="auth-lock-icon"><CloudMark size={36} /></div>
    <h1 className="auth-form-title auth-locked-title">{title}</h1>
    <p className="auth-form-description auth-locked-description">{description}</p>
    <form key={step} className="auth-form" onSubmit={submit} aria-busy={busy}>
      {busy && <LinearProgress className="auth-operation-progress" label={en ? 'Signing in' : 'Memproses masuk'} />}
      {step === 'phone' && <label className="auth-field" htmlFor="login-phone"><span>{t('phoneLabel')}</span><input id="login-phone" name="phone" type="tel" placeholder={en ? '+1 555 123 4567' : '+62 812 3456 7890'} value={phone} onChange={event => setPhone(event.target.value)} disabled={busy} autoFocus autoComplete="tel" required aria-describedby="login-phone-hint" /><small id="login-phone-hint">{en ? 'Include your country code.' : 'Sertakan kode negara Anda.'}</small></label>}
      {step === 'code' && <label className="auth-field" htmlFor="login-code"><span>{en ? 'Telegram verification code' : 'Kode verifikasi Telegram'}</span><input id="login-code" name="code" className="auth-pin-input" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="00000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))} disabled={busy} minLength={4} maxLength={8} required /></label>}
      {(step === 'password' || step === 'pin') && <div className="auth-secret-group"><label className="auth-field" htmlFor="login-secret"><span>{step === 'pin' ? t('enterPin') : t('passwordLabel')}</span><input id="login-secret" name={step === 'pin' ? 'pin' : 'telegramPassword'} className={step === 'pin' ? 'auth-pin-input' : undefined} type={showSecret ? 'text' : 'password'} inputMode={step === 'pin' ? 'numeric' : undefined} value={step === 'pin' ? pin : password} onChange={event => step === 'pin' ? setPin(event.target.value.replace(/\D/g, '')) : setPassword(event.target.value)} disabled={busy} autoFocus autoComplete="current-password" required minLength={step === 'pin' ? 4 : undefined} /></label><label className="auth-choice"><input type="checkbox" checked={showSecret} onChange={event => setShowSecret(event.target.checked)} disabled={busy} />{step === 'pin' ? (en ? 'Show PIN' : 'Tampilkan PIN') : (en ? 'Show password' : 'Tampilkan kata sandi')}</label></div>}
      {(step === 'phone' || step === 'pin') && <label className="auth-choice"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} disabled={busy} /><span>{en ? 'Remember me for 7 days' : 'Ingat saya selama 7 hari'}</span></label>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <MaterialButton type="submit" className="auth-submit" disabled={cannotSubmit} icon={busy ? <AuthSpinner /> : undefined}>{busy ? (step === 'phone' ? (en ? 'Sending code…' : 'Mengirim kode…') : (en ? 'Signing in…' : 'Memproses…')) : submitRetrySeconds > 0 ? (en ? `Try again in ${submitRetrySeconds}s` : `Coba lagi dalam ${submitRetrySeconds}d`) : buttonLabel}</MaterialButton>
      {step === 'code' && <div className="auth-login-actions"><MaterialButton type="button" variant="text" disabled={busy || resendSeconds > 0 || retrySeconds > 0} onClick={() => void requestCode()}>{resendSeconds > 0 ? (en ? `Resend code in ${resendSeconds}s` : `Kirim ulang dalam ${resendSeconds}d`) : (en ? 'Resend code' : 'Kirim ulang kode')}</MaterialButton><MaterialButton type="button" variant="text" disabled={busy} onClick={() => changeStep('phone')}>{en ? 'Edit number' : 'Ubah nomor'}</MaterialButton></div>}
      {step === 'password' && <MaterialButton type="button" variant="text" className="auth-back" disabled={busy} onClick={() => changeStep('phone')}>{en ? 'Start again' : 'Mulai lagi'}</MaterialButton>}
      {step === 'phone' && <MaterialButton type="button" variant="outlined" disabled={busy} onClick={() => changeStep('pin')}>{en ? 'Use app PIN' : 'Gunakan PIN aplikasi'}</MaterialButton>}
      {step === 'pin' && <div className="auth-login-actions"><MaterialButton type="button" variant="text" disabled={busy || telegramRetryUntil > now || resendSeconds > 0} onClick={() => void requestCode()}>{en ? 'Use a Telegram code' : 'Gunakan kode Telegram'}</MaterialButton><MaterialButton type="button" variant="text" disabled={busy} onClick={() => changeStep('phone')}>{en ? 'Edit number' : 'Ubah nomor'}</MaterialButton></div>}
    </form>
    <p className="auth-card-note">{en ? 'Your existing files and Telegram connection are kept when you sign out.' : 'File dan koneksi Telegram Anda tetap tersimpan saat Anda keluar.'}</p>
  </AuthLayout>;
}
