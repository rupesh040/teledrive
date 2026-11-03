import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { STRINGS, type Lang, type StringKey } from './strings.js';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: StringKey) => string;
}

const Ctx = createContext<LangCtx | null>(null);
const STORAGE_KEY = 'td-lang';

// Preserve the user's choice; otherwise follow the browser language.
// Wrapped in try/catch because localStorage can throw when storage is blocked
// (strict privacy mode / certain WebViews) — the app still runs with the default.
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'id' ? saved : navigator.language.startsWith('id') ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // storage unavailable: the choice isn't saved, but it doesn't crash.
    }
  }, []);

  const t = useCallback((k: StringKey) => STRINGS[lang][k], [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

// Main hook: { lang, setLang, t }. Must be used inside <LangProvider>.
export function useT(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useT harus dipakai di dalam <LangProvider>');
  return ctx;
}
