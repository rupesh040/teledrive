import { useT } from '../i18n/lang.js';
import type { Lang } from '../i18n/strings.js';
import { Ripple } from './material/Ripple.js';
import './auth.css';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'id', label: 'ID' },
];

// UI language picker (ID / EN). Used in Sidebar, Onboarding, LockScreen.
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <div role="group" aria-label={lang === 'en' ? 'Language' : 'Bahasa'} className={`language-segments ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          aria-label={l.code === 'en' ? 'English' : 'Bahasa Indonesia'}
          aria-pressed={lang === l.code}
          className="md-state-layer"
          onClick={() => setLang(l.code)}
        >
          <Ripple />
          {lang === l.code && <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {l.label}
        </button>
      ))}
    </div>
  );
}
