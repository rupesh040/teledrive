import { useTheme, type ThemePreference } from "./ThemeProvider.js";
import { useT } from "../i18n/lang.js";
import { Ripple } from "../components/material/Ripple.js";

function ThemeIcon({ name }: { name: ThemePreference }) {
  const path =
    name === "light" ? (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ) : name === "dark" ? (
      <path d="M20.7 13.2A8.8 8.8 0 0 1 10.8 3.3a8.8 8.8 0 1 0 9.9 9.9Z" />
    ) : (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    );
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export function ThemeToggle({
  showLabels = false,
  compact = false,
}: {
  showLabels?: boolean;
  compact?: boolean;
}) {
  const { preference, resolved, setTheme } = useTheme();
  const { lang } = useT();
  const en = lang === "en";
  if (compact) {
    const next = resolved === "light" ? "dark" : "light";
    const label = en
      ? `Switch to ${next} theme`
      : `Ganti ke tema ${next === "dark" ? "gelap" : "terang"}`;
    return (
      <button
        type="button"
        className="icon-button theme-quick-toggle md-state-layer"
        aria-label={label}
        title={label}
        onClick={() => setTheme(next)}
      >
        <Ripple />
        <span className="theme-mode-icon" key={resolved}>
          <ThemeIcon name={resolved} />
        </span>
      </button>
    );
  }
  const labels = en
    ? { light: "Light", dark: "Dark", system: "System" }
    : { light: "Terang", dark: "Gelap", system: "Sistem" };
  return (
    <div
      className={`theme-toggle ${showLabels ? "theme-toggle--labeled" : ""}`}
      role="group"
      aria-label={en ? "Color theme" : "Tema warna"}
    >
      {(["light", "dark", "system"] as const).map((mode) => (
        <button
          type="button"
          key={mode}
          className={`md-state-layer ${preference === mode ? "is-selected" : ""}`}
          onClick={() => setTheme(mode)}
          aria-label={
            en ? `${labels[mode]} theme` : `Tema ${labels[mode].toLowerCase()}`
          }
          aria-pressed={preference === mode}
          title={labels[mode]}
        >
          <Ripple />
          <ThemeIcon name={mode} />
          {showLabels && <span>{labels[mode]}</span>}
        </button>
      ))}
    </div>
  );
}
