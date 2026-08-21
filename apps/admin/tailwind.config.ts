import type { Config } from 'tailwindcss';

// Design tokens sourced from design.md. Admin extends the shared palette with its own
// dark sidebar tokens to stay visually distinct from the storefront.
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
          DEFAULT: '#1E40AF',
          hover: '#1E3A8A',
        },
        secondary: '#F59E0B',
        accent: '#10B981',
        danger: '#DC2626',
        warning: '#D97706',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        border: '#E2E8F0',
        text: {
          primary: '#0F172A',
          secondary: '#64748B',
          disabled: '#CBD5E1',
        },
        admin: {
          'sidebar-bg': '#0F172A',
          'sidebar-text': '#E2E8F0',
          accent: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.5' }],
        lg: ['18px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.2' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['30px', { lineHeight: '1.2' }],
        '4xl': ['36px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        md: '6px',
      },
    },
  },
  plugins: [],
};

export default config;
