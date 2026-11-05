import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client.js';
import { setToken } from '../../api/auth.js';
import { useT } from '../../i18n/lang.js';
import { AuthLayout, AuthSpinner } from '../AuthLayout.js';
import { MaterialButton } from '../material/MaterialButton.js';
import { LinearProgress } from '../material/Progress.js';

type Step = 'phone' | 'code' | 'password' | 'pin';

export function Onboarding({ onDone, available = true, onRetry }: {
  onDone: () => void;
  available?: boolean;
  onRetry: () => void;
}) {
  const { t, lang } = useT();
  const en = lang === 'en';
  const [step, setStep] = useState<Step>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [remember, setRemember] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const loginId = useRef('');
  const generation = useRef(0);
  const mounted = useRef(true);
  const resendSeconds = Math.max(0, Math.ceil((resendUntil - now) / 1000));
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      if (loginId.current) void api.setupCancel(loginId.current).catch(() => {});
      loginId.current = '';
    };
  }, []);

  useEffect(() => {
    const until = Math.max(resendUntil, retryUntil);
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendUntil, retryUntil]);

  function discardChallenge() {
    const id = loginId.current;
    loginId.current = '';
    if (id) void api.setupCancel(id).catch(() => {});
  }

  function startAgain() {
    generation.current++;
    discardChallenge();
    setStep('phone'); setCode(''); setPassword(''); setPin(''); setPin2(''); setError(null);
  }

  function showError(cause: unknown) {
    if (cause instanceof ApiError) {
      if (cause.retryAfter) setRetryUntil(Date.now() + cause.retryAfter * 1000);
      if (cause.code === 'ALREADY_CONFIGURED') { onDone(); return; }
      const messages: Record<string, [string, string]> = {
        INVALID_PHONE: ['Enter your Telegram phone number with its country code.', 'Masukkan nomor Telegram Anda dengan kode negara.'],
        INVALID_CODE: ['That code is incorrect. Check Telegram and try again.', 'Kode salah. Periksa Telegram lalu coba lagi.'],
        INVALID_PASSWORD: ['Incorrect Telegram password. Please try again.', 'Kata sandi Telegram salah. Silakan coba lagi.'],
        INVALID_PIN: ['Choose a PIN with 4 to 12 digits.', 'Pilih PIN dengan 4 hingga 12 angka.'],
        LOGIN_EXPIRED: ['This verification expired. Enter your number to start again.', 'Verifikasi kedaluwarsa. Masukkan nomor untuk mulai lagi.'],
        SETUP_EXPIRED: ['This verification expired. Enter your number to start again.', 'Verifikasi kedaluwarsa. Masukkan nomor untuk mulai lagi.'],
        TOO_MANY_ATTEMPTS: ['Too many attempts. Please wait before trying again.', 'Terlalu banyak percobaan. Tunggu sebelum mencoba lagi.'],
        FLOOD_WAIT: ['Telegram has asked you to wait. Try again when the countdown finishes.', 'Telegram meminta Anda menunggu. Coba lagi setelah hitung mundur selesai.'],
        SIGNUP_UNAVAILABLE: ['Phone sign-up is not ready yet. Ask the drive owner to finish setup, then try again.', 'Pendaftaran nomor belum tersedia. Minta pemilik drive menyelesaikan pengaturan lalu coba lagi.'],
        TELEGRAM_UNAVAILABLE: ['Could not connect to Telegram. Please try again.', 'Tidak dapat terhubung ke Telegram. Silakan coba lagi.'],
      };
      setError(messages[cause.code ?? '']?.[en ? 0 : 1] ?? cause.message);
      if (['LOGIN_EXPIRED', 'SETUP_EXPIRED', 'INVALID_PHASE', 'TELEGRAM_UNAVAILABLE', 'TOO_MANY_ATTEMPTS', 'FLOOD_WAIT', 'ACCOUNT_MISMATCH', 'SIGNUP_UNAVAILABLE'].includes(cause.code ?? '')) {
        discardChallenge(); setStep('phone'); setCode(''); setPassword(''); setPin(''); setPin2('');
      }
      if (cause.code === 'INVALID_CODE') setCode('');
      if (cause.code === 'INVALID_PASSWORD') setPassword('');
    } else if (cause instanceof Error && /TimeoutError|AbortError/.test(cause.name)) {
      setError(en ? 'The server took too long to respond. Please try again.' : 'Server terlalu lama merespons. Silakan coba lagi.');
    } else {
      setError(en ? 'Unable to reach the server. Check your connection and try again.' : 'Tidak dapat menghubungi server. Periksa koneksi Anda dan coba lagi.');
    }
  }

  async function requestCode() {
    if (busy || !available || retryUntil > Date.now() || resendUntil > Date.now()) return;
    const normalized = phone.trim().replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{5,14}$/.test(normalized)) {
      setError(en ? 'Include your country code, for example +1 555 123 4567.' : 'Sertakan kode negara, misalnya +62 812 3456 7890.');
      return;
    }
    const requestGeneration = ++generation.current;
    const current = () => mounted.current && requestGeneration === generation.current;
    setBusy(true); setError(null);
    try {
      const oldId = loginId.current;
      loginId.current = '';
      if (oldId) await api.setupCancel(oldId).catch(() => {});
      if (!current()) return;
      const result = await api.setupStart(normalized, remember);
      if (!current()) { void api.setupCancel(result.loginId).catch(() => {}); return; }
      loginId.current = result.loginId;
      setPhone(normalized); setCode(''); setPassword(''); setStep('code');
      setResendUntil(Date.now() + Math.max(0, result.retryAfter) * 1000);
    } catch (cause) { if (current()) showError(cause); }
    finally { if (current()) setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'phone') { await requestCode(); return; }
    if (busy || retrySeconds > 0) return;
    if (step === 'pin') {
      if (!/^\d{4,12}$/.test(pin)) { setError(en ? 'Choose a PIN with 4 to 12 digits.' : 'Pilih PIN dengan 4 hingga 12 angka.'); return; }
      if (pin !== pin2) { setError(t('pinMismatch')); return; }
    }
    const requestGeneration = ++generation.current;
    const current = () => mounted.current && requestGeneration === generation.current;
    setBusy(true); setError(null);
    try {
      if (step === 'code') {
        const result = await api.setupVerify(loginId.current, code.trim());
        if (!current()) return;
        setCode(''); setStep(result.needs === 'password' ? 'password' : 'pin');
      } else if (step === 'password') {
        await api.setupPassword(loginId.current, password);
        if (!current()) return;
        setPassword(''); setStep('pin');
      } else {
        const result = await api.setupPin(loginId.current, pin, remember);
        if (!current()) return;
        loginId.current = '';
        setPin(''); setPin2('');
        setToken(result.token, remember);
        onDone();
      }
    } catch (cause) { if (current()) showError(cause); }
    finally { if (current()) setBusy(false); }
  }

  const index = step === 'phone' ? 0 : step === 'pin' ? 2 : 1;
  const title = step === 'phone' ? (en ? 'Create your account' : 'Buat akun Anda') : step === 'code' ? (en ? 'Enter your Telegram code' : 'Masukkan kode Telegram') : step === 'password' ? (en ? 'Two-step verification' : 'Verifikasi dua langkah') : t('setPinTitle');
  const description = step === 'phone'
    ? (en ? 'Sign up once with your Telegram number. Next time, use the same number with a Telegram code or your app PIN.' : 'Daftar sekali dengan nomor Telegram. Berikutnya, gunakan nomor yang sama dengan kode Telegram atau PIN aplikasi Anda.')
    : step === 'code'
      ? (en ? `Enter the code Telegram sent to ${phone}. Check the Telegram app on a device where you are signed in.` : `Masukkan kode yang dikirim Telegram ke ${phone}. Periksa aplikasi Telegram pada perangkat yang sudah masuk.`)
      : step === 'password'
        ? (en ? 'Enter your Telegram two-step verification password to continue.' : 'Masukkan kata sandi verifikasi dua langkah Telegram untuk melanjutkan.')
        : (en ? 'Create an app PIN with 4 to 12 digits. You can use this PIN with your phone number next time.' : 'Buat PIN aplikasi dengan 4 hingga 12 angka. Gunakan PIN ini dengan nomor Anda saat masuk berikutnya.');
  const sendingSeconds = step === 'phone' ? Math.max(retrySeconds, resendSeconds) : retrySeconds;
  const buttonLabel = step === 'phone' ? (en ? 'Send Telegram code' : 'Kirim kode Telegram') : step === 'pin' ? (en ? 'Create account' : 'Buat akun') : t('verify');
  const waitingLabel = step === 'phone' ? (en ? 'Sending code…' : 'Mengirim kode…') : step === 'pin' ? (en ? 'Creating account…' : 'Membuat akun…') : (en ? 'Verifying…' : 'Memverifikasi…');
  const cannotSubmit = busy || sendingSeconds > 0 || !available || (step === 'phone' ? !phone.trim() : step === 'code' ? code.length < 4 : step === 'password' ? !password : pin.length < 4 || pin2.length < 4);

  return <AuthLayout>
    <ol className="auth-stepper" aria-label={en ? 'Sign-up progress' : 'Progres pendaftaran'}>
      {(en ? ['Phone', 'Verify', 'PIN'] : ['Nomor', 'Verifikasi', 'PIN']).map((label, i) => <li key={label} data-active={i === index} data-done={i < index} aria-current={i === index ? 'step' : undefined}><span>{i < index ? '✓' : i + 1}</span>{label}</li>)}
    </ol>
    <h2 className="auth-form-title">{title}</h2>
    <p className="auth-form-description">{description}</p>
    <form key={step} className="auth-form" onSubmit={submit} aria-busy={busy}>
      {busy && <LinearProgress className="auth-operation-progress" label={waitingLabel} />}
      {step === 'phone' && <label className="auth-field" htmlFor="signup-phone"><span>{t('phoneLabel')}</span><input id="signup-phone" name="phone" type="tel" placeholder={en ? '+1 555 123 4567' : '+62 812 3456 7890'} value={phone} onChange={event => setPhone(event.target.value)} disabled={busy || !available} autoComplete="tel" autoFocus required /><small>{en ? 'Use the phone number linked to your Telegram account.' : 'Gunakan nomor yang terhubung ke akun Telegram Anda.'}</small></label>}
      {step === 'code' && <label className="auth-field" htmlFor="signup-code"><span>{t('otpLabel')}</span><input id="signup-code" name="code" className="auth-pin-input" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="00000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))} disabled={busy} minLength={4} maxLength={8} required /></label>}
      {step === 'password' && <label className="auth-field" htmlFor="signup-password"><span>{t('passwordLabel')}</span><input id="signup-password" name="telegramPassword" type="password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required autoFocus autoComplete="current-password" /></label>}
      {step === 'pin' && <>
        <label className="auth-field" htmlFor="signup-pin"><span>{t('enterPin')}</span><input id="signup-pin" name="pin" type="password" inputMode="numeric" className="auth-pin-input" placeholder="••••" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))} disabled={busy} minLength={4} maxLength={12} required autoFocus autoComplete="new-password" /></label>
        <label className="auth-field" htmlFor="signup-pin-confirm"><span>{t('confirmPinLabel')}</span><input id="signup-pin-confirm" name="pinConfirmation" type="password" inputMode="numeric" className="auth-pin-input" placeholder="••••" value={pin2} onChange={event => setPin2(event.target.value.replace(/\D/g, '').slice(0, 12))} disabled={busy} minLength={4} maxLength={12} required autoComplete="new-password" /></label>
        <label className="auth-choice"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} disabled={busy} /><span>{en ? 'Remember me for 7 days' : 'Ingat saya selama 7 hari'}</span></label>
      </>}
      {!available && <p className="auth-error" role="status">{en ? 'Phone sign-up is not ready yet. Ask the drive owner to finish server setup, then try again.' : 'Pendaftaran nomor belum tersedia. Minta pemilik drive menyelesaikan pengaturan server lalu coba lagi.'}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <MaterialButton type="submit" className="auth-submit" disabled={cannotSubmit} icon={busy ? <AuthSpinner /> : undefined}>{busy ? waitingLabel : sendingSeconds > 0 ? (en ? `Try again in ${sendingSeconds}s` : `Coba lagi dalam ${sendingSeconds}d`) : buttonLabel}</MaterialButton>
      {!available && <MaterialButton type="button" variant="text" onClick={onRetry}>{en ? 'Try again' : 'Coba lagi'}</MaterialButton>}
      {step === 'code' && <div className="auth-login-actions"><MaterialButton type="button" variant="text" disabled={busy || resendSeconds > 0 || retrySeconds > 0} onClick={() => void requestCode()}>{resendSeconds > 0 ? (en ? `Resend in ${resendSeconds}s` : `Kirim ulang dalam ${resendSeconds}d`) : (en ? 'Resend code' : 'Kirim ulang kode')}</MaterialButton><MaterialButton type="button" variant="text" disabled={busy} onClick={startAgain}>{en ? 'Edit number' : 'Ubah nomor'}</MaterialButton></div>}
      {(step === 'password' || step === 'pin') && <MaterialButton type="button" variant="text" className="auth-back" disabled={busy} onClick={startAgain}>{en ? 'Start again' : 'Mulai lagi'}</MaterialButton>}
    </form>
    <p className="auth-card-note">{en ? 'Your account stays connected when you sign out. Files are stored in your Telegram account.' : 'Akun tetap terhubung saat Anda keluar. File tersimpan di akun Telegram Anda.'}</p>
  </AuthLayout>;
}
