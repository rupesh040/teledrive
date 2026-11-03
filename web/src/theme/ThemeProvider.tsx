import {
  createContext,
  useContext,
  useLayoutEffect,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

export type ThemePreference = "light" | "dark" | "system";
export type ColorMode = "light" | "dark";
interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ColorMode;
  setTheme: (theme: ThemePreference) => void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = "td-theme";
const valid = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";
function savedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey);
    return valid(value) ? value : "system";
  } catch {
    return "system";
  }
}
function applyMode(preference: ThemePreference, systemDark: boolean) {
  const mode =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.themePreference = preference;
  root.style.colorScheme = mode;
  const color = getComputedStyle(root)
    .getPropertyValue("--md-sys-color-surface")
    .trim();
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", color);
}
interface ViewTransition {
  finished: Promise<void>;
  skipTransition: () => void;
}
type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] =
    useState<ThemePreference>(savedPreference);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const transition = useRef<ViewTransition | null>(null);
  const intendedPreference = useRef(preference);
  const resolved =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;
  useLayoutEffect(() => {
    applyMode(preference, systemDark);
  }, [preference, systemDark]);
  useLayoutEffect(() => {
    intendedPreference.current = preference;
  }, [preference]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        transition.current?.skipTransition();
        const next = valid(event.newValue) ? event.newValue : "system";
        intendedPreference.current = next;
        setPreference(next);
      }
    };
    media.addEventListener("change", update);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", sync);
      transition.current?.skipTransition();
    };
  }, []);
  const setTheme = useCallback((next: ThemePreference) => {
    if (next === intendedPreference.current) return;
    intendedPreference.current = next;
    transition.current?.skipTransition();
    const update = () => {
      if (intendedPreference.current !== next) return;
      flushSync(() => setPreference(next));
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* The in-memory choice still works. */
      }
    };
    const page = document as TransitionDocument;
    if (
      page.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      document.visibilityState === "visible"
    ) {
      transition.current = page.startViewTransition(update);
      void transition.current.finished.catch(() => {});
    } else {
      update();
    }
  }, []);
  return (
    <ThemeContext.Provider value={{ preference, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
