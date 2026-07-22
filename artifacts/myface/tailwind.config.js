/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './utils/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Helvetica'],
        serif: ['Inter', 'Helvetica'],
        display: ['Inter', 'Helvetica'],
      },
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          warm: 'var(--color-surface-warm)',
          card: 'var(--color-surface-card)',
          raised: 'var(--color-surface-raised)',
          border: 'var(--color-surface-border)',
        },
        landing: {
          mint: '#eef6f3',
          mintAlt: '#f0f7f7',
          divider: '#e8eeec',
          ink: '#04211d',
          body: '#3c3c3c',
          muted: 'rgba(60,60,60,0.60)',
          caption: '#818784',
          highlight: '#509180',
          track: '#00000014',
        },
        brand: {
          DEFAULT: '#5e9f8b',
          light: '#73bfa9',
          lighter: '#a8d9cb',
          dark: '#548f7d',
          50: 'var(--color-brand-50)',
          100: '#dbeee8',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          secondary: 'var(--color-ink-secondary)',
          muted: 'var(--color-ink-muted)',
          faint: 'var(--color-ink-faint)',
        },
        accent: {
          DEFAULT: '#5e9f8b',
          dim: '#548f7d',
          glow: '#73bfa9',
        },
        violet: {
          glow: '#7C3AED',
        },
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card': '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)',
        'elevated': '0 8px 24px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.04)',
        'modal': '0 20px 60px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.06)',
        'glow': '0 0 20px rgba(94,159,139,0.15)',
        'brand': '0 2px 8px rgba(94,159,139,0.25)',
        'dashboard-glass': '0px 4px 24px rgba(118,118,118,0.12), inset 0 1px 0 rgba(255,255,255,0.60), inset 1px 0 0 rgba(255,255,255,0.50)',
        'dashboard-card': '0px 2px 16px rgba(67,67,67,0.10)',
        'dashboard-navbar': '0px 2px 16px rgba(133,133,133,0.25)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'laser-sweep': 'laserSweep 2.4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'scan-line': 'scanLine 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        laserSweep: {
          '0%, 100%': { top: '8%', opacity: '0.6' },
          '50%': { top: '88%', opacity: '1' },
        },
        scanLine: {
          '0%, 100%': { top: '5%', opacity: '0.5' },
          '50%': { top: '90%', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.9' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
