import type { ReactNode } from 'react';
import { useT } from '../i18n/lang.js';
import { LangToggle } from './LangToggle.js';
import { ThemeToggle } from '../theme/ThemeToggle.js';
import { InstallApp } from '../pwa/InstallApp.js';
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
        <div className="auth-header-actions"><ThemeToggle /><LangToggle /></div>
      </header>
      <main className="auth-main">
        {!compact && <section className="auth-story" aria-labelledby="auth-story-title">
          <span className="auth-eyebrow"><span />{en ? 'A PERSONAL SPACE FOR YOUR FILES' : 'RUANG PRIBADI UNTUK FILE ANDA'}</span>
          <h1 id="auth-story-title">{en ? 'Your files,' : 'Semua file Anda,'}<br /><span>{en ? 'beautifully at home.' : 'di tempat terbaik.'}</span></h1>
          <p className="auth-story-copy">{en ? 'A calm, simple place for everything you want to keep. Powered by your own Telegram cloud.' : 'Tempat yang tenang dan sederhana untuk semua yang ingin Anda simpan. Didukung cloud Telegram Anda sendiri.'}</p>
          <div className="auth-cloud-art" aria-hidden="true">
            <div className="auth-art-shape" />
            <div className="auth-art-cloud"><CloudMark size={102} /></div>
            <div className="auth-art-card auth-art-card--photo"><span className="auth-art-photo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="m4 18 5-6 4 4 3-3 4 5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" /></svg></span><div><strong>{en ? 'A little inspiration' : 'Sedikit inspirasi'}</strong><small>{en ? 'Room for every idea' : 'Ruang untuk setiap ide'}</small></div></div>
            <div className="auth-art-card auth-art-card--folder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" /></svg><div><strong>{en ? 'Everything, together' : 'Semuanya, bersama'}</strong><small>{en ? 'Organized your way' : 'Tertata sesuai keinginan'}</small></div></div>
            <span className="auth-art-spark auth-art-spark--one">✦</span><span className="auth-art-spark auth-art-spark--two">✦</span>
          </div>
          <div className="auth-story-note"><svg width="17" height="19" viewBox="0 0 20 22" fill="none" aria-hidden="true"><path d="m10 2 7 3v5c0 5-7 9-7 9s-7-4-7-9V5l7-3Z" stroke="currentColor" strokeWidth="1.5" /><path d="m7 10 2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>{en ? 'Your account. Your files. Your space.' : 'Akun Anda. File Anda. Ruang Anda.'}</div>
        </section>}
        <section className="auth-form-card">{children}</section>
      </main>
      <footer className="auth-footer"><span>© {new Date().getFullYear()} TeleDrive</span><span>{en ? 'Made for a little more peace of mind.' : 'Dibuat untuk sedikit lebih tenang.'}</span></footer>
    </div>
  );
}

export function AuthSpinner() {
  return <svg className="auth-spinner" width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" opacity=".25" /><path d="M10 3a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
