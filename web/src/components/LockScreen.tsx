import { useState } from 'react';
import { api } from '../api/client.js';
import { setToken } from '../api/auth.js';
import { useT } from '../i18n/lang.js';
import { LangToggle } from './LangToggle.js';

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const { t } = useT();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock() {
    setBusy(true); setError(null);
    try {
      const r = await api.unlock(pin);
      setToken(r.token);
      onUnlocked();
    } catch {
      setError(t('wrongPin'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen grid place-items-center bg-ink px-4 relative">
      <div className="absolute top-5 right-5"><LangToggle /></div>
      <div className="pop-in w-full max-w-xs bg-panel border border-line rounded-2xl p-6 flex flex-col gap-4 shadow-lift text-center">
        <h1 className="font-display text-2xl text-content">{t('lockTitle')}</h1>
        <input
          className="w-full px-4 py-2.5 rounded-xl bg-panel/70 border border-line text-content text-center ring-accent"
          type="password" inputMode="numeric" placeholder={t('enterPin')}
          value={pin} onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
        />
        <button
          className="w-full py-2.5 rounded-xl font-semibold text-ink bg-gradient-to-b from-accent-2 to-accent shadow-glow disabled:opacity-60"
          disabled={busy} onClick={unlock}
        >{t('unlockBtn')}</button>
        {error && <p className="text-sm text-[#e0584c]">{error}</p>}
      </div>
    </div>
  );
}
