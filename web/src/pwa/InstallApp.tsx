import { useId, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/lang.js';
import { MaterialButton } from '../components/material/MaterialButton.js';
import { useSupportDialog } from '../components/support-dialog.js';
import { getInstallState, installPlatform, requestAppInstall, subscribeToInstall } from './install.js';
import '../components/support-flows.css';
import './install.css';

function InstallIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M5 15v5h14v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function InstallHelp({ failed, onClose }: { failed: boolean; onClose: () => void }) {
  const { lang } = useT();
  const en = lang === 'en';
  const titleId = useId();
  const descriptionId = useId();
  const panel = useSupportDialog<HTMLDivElement>(true, onClose);
  const platform = installPlatform();
  const steps = platform === 'ios'
    ? (en ? ['Open this page in Safari.', 'Tap Share, then Add to Home Screen.', 'Turn on Open as Web App if shown, then tap Add.'] : ['Buka halaman ini di Safari.', 'Ketuk Bagikan, lalu Tambah ke Layar Utama.', 'Aktifkan Buka sebagai App Web jika tersedia, lalu ketuk Tambah.'])
    : platform === 'android'
      ? (en ? ['Open this page in Chrome or Edge.', 'Open the browser menu and choose Install app or Add to Home screen.', 'Confirm to add TeleDrive to your home screen.'] : ['Buka halaman ini di Chrome atau Edge.', 'Buka menu browser dan pilih Instal aplikasi atau Tambahkan ke layar utama.', 'Konfirmasi untuk menambahkan TeleDrive ke layar utama.'])
      : platform === 'mac-safari'
        ? (en ? ['Open the File menu in Safari.', 'Choose Add to Dock, then confirm Add.', 'Open TeleDrive from your Dock. If this option is missing, try Chrome or Edge.'] : ['Buka menu File di Safari.', 'Pilih Tambahkan ke Dock, lalu konfirmasi Tambah.', 'Buka TeleDrive dari Dock. Jika opsi tidak tersedia, coba Chrome atau Edge.'])
        : (en ? ['Open this page in Chrome or Edge.', 'Use the install icon in the address bar, or open the browser menu and look for Install TeleDrive or Apps.', 'Choose Install to open TeleDrive in its own app window.'] : ['Buka halaman ini di Chrome atau Edge.', 'Gunakan ikon instal di bilah alamat, atau buka menu browser dan cari Instal TeleDrive atau Aplikasi.', 'Pilih Instal untuk membuka TeleDrive dalam jendela aplikasi tersendiri.']);

  return createPortal(<div className="support-backdrop pwa-install-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div ref={panel} className="support-dialog pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
      <div className="pwa-install-content">
        <span className="pwa-install-symbol"><InstallIcon size={28} /></span>
        <h2 id={titleId}>{en ? 'Install TeleDrive' : 'Instal TeleDrive'}</h2>
        <p id={descriptionId}>{en ? 'Keep your personal cloud a tap away. Add TeleDrive to your home screen or desktop and open it in its own window.' : 'Akses cloud pribadi dengan satu ketukan. Tambahkan TeleDrive ke layar utama atau desktop dan buka dalam jendela tersendiri.'}</p>
        {failed && <p className="pwa-install-notice" role="status">{en ? 'The install prompt could not open. You can use your browser menu instead.' : 'Dialog instalasi tidak dapat dibuka. Gunakan menu browser Anda.'}</p>}
        <ol className="pwa-install-steps">{steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}</ol>
        <p className="pwa-install-note">{en ? 'If your browser has no install option, you can keep using this tab. Telegram and file transfers need an internet connection.' : 'Jika browser tidak memiliki opsi instal, Anda tetap dapat menggunakan tab ini. Telegram dan transfer file memerlukan koneksi internet.'}</p>
      </div>
      <div className="support-dialog-footer"><MaterialButton onClick={onClose}>{en ? 'Got it' : 'Mengerti'}</MaterialButton></div>
    </div>
  </div>, document.body);
}

export function InstallApp({ className = '', sidebar = false }: { className?: string; sidebar?: boolean }) {
  const { lang } = useT();
  const en = lang === 'en';
  const state = useSyncExternalStore(subscribeToInstall, getInstallState, getInstallState);
  const [help, setHelp] = useState<'instructions' | 'failed' | null>(null);
  if (state.installed) return null;

  async function install() {
    const outcome = await requestAppInstall();
    if (outcome === 'unavailable' || outcome === 'failed') setHelp(outcome === 'failed' ? 'failed' : 'instructions');
  }

  return <>
    <MaterialButton variant={sidebar ? 'outlined' : 'tonal'} className={`pwa-install-trigger ${sidebar ? 'pwa-install-trigger--sidebar' : ''} ${className}`.trim()} icon={<InstallIcon size={18} />} disabled={state.prompting} onClick={() => void install()} aria-haspopup="dialog">
      {state.prompting ? (en ? 'Installing…' : 'Menginstal…') : (en ? 'Install app' : 'Instal aplikasi')}
    </MaterialButton>
    {help && <InstallHelp failed={help === 'failed'} onClose={() => setHelp(null)} />}
  </>;
}
