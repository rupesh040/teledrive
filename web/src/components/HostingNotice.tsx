import { useSyncExternalStore } from 'react';
import { useT } from '../i18n/lang.js';

let ephemeral = false;
const listeners = new Set<() => void>();
export function setEphemeralStorage(value: boolean) {
  if (ephemeral === value) return;
  ephemeral = value;
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function HostingNotice() {
  const visible = useSyncExternalStore(subscribe, () => ephemeral, () => false);
  const { lang } = useT();
  if (!visible) return null;
  return <aside className="hosting-notice" aria-label={lang === 'en' ? 'Free hosting storage' : 'Penyimpanan hosting gratis'}>
    <strong>{lang === 'en' ? 'Free preview' : 'Pratinjau gratis'}</strong>
    <span>{lang === 'en'
      ? 'Account setup and the file index reset when this server restarts. Files already in Telegram stay there.'
      : 'Pengaturan akun dan indeks file direset saat server dimulai ulang. File yang sudah ada di Telegram tetap tersimpan.'}</span>
  </aside>;
}
