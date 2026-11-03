/** @type {import('tailwindcss').Config} */
const role = (name) => `rgb(var(--md-sys-color-${name}-rgb) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", "sans-serif"],
        display: ["Roboto", "sans-serif"],
      },
      colors: {
        ink: role("surface"),
        "ink-2": role("surface-container-low"),
        panel: role("surface-container-lowest"),
        "panel-hi": role("surface-container-high"),
        line: role("outline-variant"),
        "line-hi": role("primary"),
        content: role("on-surface"),
        muted: role("on-surface-variant"),
        faint: role("on-surface-variant"),
        accent: role("primary"),
        "accent-2": role("primary"),
        "accent-deep": role("primary"),
        "accent-soft": role("secondary-container"),
      },
      boxShadow: {
        card: "var(--md-sys-elevation-level1)",
        lift: "var(--md-sys-elevation-level3)",
        glow: "none",
      },
    },
  },
  plugins: [],
};
