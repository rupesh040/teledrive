import { useEffect, useState } from 'react';
import type { SetupStatus } from '../types.js';
import { api } from '../api/client.js';
import { clearToken } from '../api/auth.js';
import { useT } from '../i18n/lang.js';

export function AccountMenu({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const { t } = useT();
  const [account, setAccount] = useState<SetupStatus['account']>(null);

  useEffect(() => { api.setupStatus().then((s) => setAccount(s.account)).catch(() => {}); }, []);

  async function logout() {
    if (!confirm(t('confirmLogout'))) return;
    try { await api.logout(); } catch { /* tetap lanjut bersihkan lokal */ }
    clearToken();
    onLoggedOut?.();
  }

  return (
    <div className="rounded-2xl border border-line bg-panel/60 p-4 flex flex-col gap-2">
      {account && (
        <div className="leading-tight">
          <div className="text-sm text-content font-medium truncate">{account.name}</div>
          <div className="text-[11px] text-faint truncate">{account.phone}</div>
        </div>
      )}
      <button
        onClick={logout}
        className="text-left text-xs text-muted hover:text-[#e0584c] transition"
      >{t('logout')}</button>
    </div>
  );
}
