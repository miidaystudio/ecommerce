import type { Config } from 'tailwindcss';

// Design tokens sourced from design.md, which is itself sourced from the
// miiday-storefront-designs.html / miiday-admin-designs.html reference files.
// Never hardcode colors/fonts in components — update design.md first, then propagate here.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4A4238',
          hover: '#35302A',
          foreground: '#F5F2EA',
        },
        accent: {
          DEFAULT: '#C9A876',
          soft: '#D6B370',
          foreground: '#FAF9F6',
        },
        // WCAG AA (2026-09-13): success/danger/text-secondary darkened to pass 4.5:1;
        // `strong` is for text on a success/danger tint (badges, alert panels),
        // where the base shade alone falls just under 4.5:1. See design.md.
        success: {
          DEFAULT: '#5D7264',
          strong: '#536559',
        },
        danger: {
          DEFAULT: '#985E51',
          strong: '#875448',
        },
        warning: {
          DEFAULT: '#D6B370',
          foreground: '#35302A',
        },
        background: '#FAF9F6',
        surface: '#F3F1EA',
        border: '#E8E4DA',
        'muted-border': '#C0BAB0',
        text: {
          primary: '#2E2A24',
          secondary: '#716D64',
          strong: '#35302A',
        },
      },
      fontFamily: {
        sans: ['"Neue Haas Grotesk"', '"Neue Haas Grotesk Text Pro"', '"Neue Haas Grotesk Display Pro"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'var(--font-manrope)', 'var(--font-inter)', 'sans-serif'],
        mono: ['"Neue Haas Grotesk"', 'var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.5' }],
        md: ['16px', { lineHeight: '1.6' }],
        lg: ['20px', { lineHeight: '1.3' }],
        xl: ['24px', { lineHeight: '1.2' }],
        '2xl': ['32px', { lineHeight: '1.15' }],
        hero: ['56px', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        DEFAULT: '10px',
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '24px',
      },
      boxShadow: {
        card: '0 10px 40px -8px rgba(74,66,56,0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
