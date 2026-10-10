import type { Config } from 'tailwindcss';

// Colors point at CSS variables (src/index.css) so the dark theme only swaps the variables.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-bg-page)',
        card: 'var(--color-bg-card)',
        line: { DEFAULT: 'var(--color-border)', strong: 'var(--color-border-strong)' },
        ink: {
          DEFAULT: 'var(--color-text-primary)',
          soft: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
        },
        success: { DEFAULT: 'var(--color-success)', soft: 'var(--color-success-soft)' },
        warning: { DEFAULT: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
        danger: { DEFAULT: 'var(--color-danger)', soft: 'var(--color-danger-soft)' },
        info: { DEFAULT: 'var(--color-info)', soft: 'var(--color-info-soft)' },
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-12px) scale(0.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        'pop-in': { from: { opacity: '0', transform: 'translateY(8px) scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        'toast-progress': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
      },
      animation: {
        'toast-in': 'toast-in 220ms ease-out',
        'pop-in': 'pop-in 180ms ease-out',
        'toast-progress': 'toast-progress 5000ms linear forwards',
      },
      fontFamily: { sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'] },
    },
  },
} satisfies Config;
