import type { ReactNode } from 'react';
import { useT } from '../i18n/lang.js';
import { LangToggle } from './LangToggle.js';
import { ThemeToggle } from '../theme/ThemeToggle.js';
import { InstallApp } from '../pwa/InstallApp.js';
import { HostingNotice } from './HostingNotice.js';
import { WavySpinner } from './material/WavyProgress.js';
import './auth.css';

export function CloudMark({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 24a7 7 0 0 1-1.2-13.9A9 9 0 0 1 25 9.5 7.3 7.3 0 0 1 24 24H9Z" fill="currentColor" /><path d="m11.5 16.2 9-3.7-3.5 8-1.8-3-3.7-1.3Z" fill="var(--auth-cloud-cutout, var(--md-sys-color-surface))" stroke="var(--auth-cloud-cutout, var(--md-sys-color-surface))" strokeLinejoin="round" /></svg>;
}

export function AuthLayout({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const { lang } = useT();
  const en = lang === 'en';
  return (
    <div className={`auth-page${compact ? ' auth-page--compact' : ''}`}>
      <header className="auth-header">
        <a href="/" className="auth-brand" aria-label="TeleDrive home"><span className="auth-brand-mark"><CloudMark /></span><span>TeleDrive<span className="auth-brand-dot">.</span></span></a>
        <InstallApp className="auth-install-button" />
      </header>
      <details className="auth-preferences">
        <summary><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--md-sys-color-surface-container-lowest)" /><circle cx="15" cy="17" r="3" fill="var(--md-sys-color-surface-container-lowest)" /></svg>{en ? 'Appearance & language' : 'Tampilan & bahasa'}</summary>
        <div className="auth-header-actions">
          <div className="auth-preference-row"><span>{en ? 'Appearance' : 'Tampilan'}</span><ThemeToggle /></div>
          <div className="auth-preference-row"><span>{en ? 'Language' : 'Bahasa'}</span><LangToggle /></div>
        </div>
      </details>
      <HostingNotice />
      <main className="auth-main">
        {!compact && <h1 className="sr-only">{en ? 'Connect your Telegram account' : 'Hubungkan akun Telegram Anda'}</h1>}
        <section className="auth-form-card">
          {!compact && <div className="auth-card-context"><CloudMark size={19} /><span>{en ? 'Telegram connection' : 'Koneksi Telegram'}</span></div>}
          {children}
        </section>
      </main>
    </div>
  );
}

export function AuthSpinner() {
  return <WavySpinner />;
}
