import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetupStatus } from '../types.js';
import { api } from '../api/client.js';
import { getToken, clearToken, onLocked } from '../api/auth.js';
import { useT } from '../i18n/lang.js';
import { App } from '../App.js';
import { Onboarding } from './onboarding/Onboarding.js';
import { LockScreen } from './LockScreen.js';
import { AuthLayout, CloudMark } from './AuthLayout.js';
import { WavyProgress } from './material/WavyProgress.js';
import { MaterialButton } from './material/MaterialButton.js';
import { setEphemeralStorage } from './HostingNotice.js';

export function Gate() {
  const { t, lang } = useT();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    const token = getToken();
    setChecking(true);
    setError(false);
    try {
      const session = await api.authSession();
      // A sign-out, new login, or completed setup supersedes older responses.
      if (requestGeneration !== generation.current || token !== getToken()) return;
      setEphemeralStorage(session.ephemeralStorage === true);
      setStatus({ configured: session.configured, account: session.account });
      setAuthenticated(session.authenticated);
      setChecking(false);
      if (!session.authenticated && token) clearToken(token);
    } catch {
      if (requestGeneration !== generation.current || token !== getToken()) return;
      setError(true);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onLocked(() => {
      generation.current++;
      setAuthenticated(false);
      setChecking(false);
      setStatus(previous => previous ? { ...previous, account: null } : previous);
    });
    void refresh();
    return () => { generation.current++; unsubscribe(); };
  }, [refresh]);

  if (checking || !status || error) {
    return <AuthLayout compact><div className="auth-status"><span className="auth-brand-mark"><CloudMark size={35} /></span>{error ? <><h1 className="auth-form-title">{lang === 'en' ? 'A little connection trouble.' : 'Ada kendala koneksi.'}</h1><p>{lang === 'en' ? 'Start the TeleDrive server, then try again.' : 'Jalankan server TeleDrive, lalu coba lagi.'}</p><MaterialButton className="auth-submit" onClick={refresh}>{lang === 'en' ? 'Try again' : 'Coba lagi'}</MaterialButton></> : <><WavyProgress className="auth-boot-progress" label={t('loadingApp')} /><span role="status">{t('loadingApp')}</span></>}</div></AuthLayout>;
  }
  if (!status.configured) {
    return <Onboarding onDone={() => {
      generation.current++;
      setAuthenticated(false);
      setStatus({ configured: true, account: null });
      setAccountReady(true);
      setError(false);
    }} />;
  }
  if (!authenticated) {
    return <LockScreen accountReady={accountReady} onUnlocked={() => { setAccountReady(false); void refresh(); }} />;
  }
  return <App onLoggedOut={() => {
    generation.current++;
    setAuthenticated(false);
    setChecking(false);
    setStatus({ configured: true, account: null });
    setAccountReady(false);
  }} />;
}
