/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      // Nilai hex/solid (bukan var()) agar modifier opacity Tailwind (/70 dst.) berfungsi.
      colors: {
        ink: '#100c08',
        'ink-2': '#16110b',
        panel: '#1c1610',
        'panel-hi': '#241d14',
        line: '#2a2017',
        'line-hi': '#e9a23b',
        content: '#f3ead9',
        muted: '#ab9d86',
        faint: '#6f6353',
        accent: '#e9a23b',
        'accent-2': '#f2bd66',
        'accent-deep': '#b9781a',
        'accent-soft': 'rgba(233,162,59,0.13)',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.02) inset, 0 12px 30px -18px rgba(0,0,0,0.8)',
        lift: '0 18px 40px -16px rgba(0,0,0,0.85), 0 0 0 1px rgba(233,162,59,0.30)',
        glow: '0 8px 30px -8px rgba(233,162,59,0.45)',
      },
    },
  },
  plugins: [],
};
