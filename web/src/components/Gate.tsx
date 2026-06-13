import { useCallback, useEffect, useState } from 'react';
import type { SetupStatus } from '../types.js';
import { api } from '../api/client.js';
import { getToken, clearToken, onLocked } from '../api/auth.js';
import { useT } from '../i18n/lang.js';
import { App } from '../App.js';
import { Onboarding } from './onboarding/Onboarding.js';
import { LockScreen } from './LockScreen.js';

type Screen = 'loading' | 'onboarding' | 'locked' | 'app';

export function Gate() {
  const { t } = useT();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(!!getToken());

  const refresh = useCallback(async () => {
    const s = await api.setupStatus();
    setStatus(s);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  // Saat 401 global → buang token → tampilkan LockScreen.
  useEffect(() => onLocked(() => setHasToken(false)), []);

  let screen: Screen = 'loading';
  if (status) {
    if (!status.configured) screen = 'onboarding';
    else screen = hasToken ? 'app' : 'locked';
  }

  if (screen === 'loading') {
    return <div className="h-screen grid place-items-center text-muted">{t('loadingApp')}</div>;
  }
  if (screen === 'onboarding') {
    return <Onboarding onDone={() => { setHasToken(true); refresh(); }} />;
  }
  if (screen === 'locked') {
    return <LockScreen onUnlocked={() => setHasToken(true)} />;
  }
  return <App onLoggedOut={() => { clearToken(); setHasToken(false); refresh(); }} />;
}
