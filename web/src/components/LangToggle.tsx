import { useT } from '../i18n/lang.js';
import type { Lang } from '../i18n/strings.js';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'id', label: 'ID' },
  { code: 'en', label: 'EN' },
];

// UI language picker (ID / EN). Used in Sidebar, Onboarding, LockScreen.
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <div className={`flex items-center rounded-xl border border-line bg-panel/60 p-1 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wide transition ${
            lang === l.code ? 'bg-accent-soft text-accent' : 'text-muted hover:text-content'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
