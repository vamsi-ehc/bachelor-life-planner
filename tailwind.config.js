/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F4F5F0',
        paperline: '#E3E6DC',
        card: '#FBFBF8',
        ink: '#15181A',
        muted: '#6B7268',
        line: '#DCDFD5',
        primary: {
          DEFAULT: '#7D4DFE',
          dim: '#EFEAFC',
          dark: '#6636E0',
        },
        ok: '#2E7A54',
        warn: '#A8842A',
        domain: {
          workout: '#C4502D',
          learning: '#2E6E9E',
          chores: '#A8842A',
          finances: '#2E7A54',
          meals: '#B4527E',
          health: '#2E8E88',
          goals: '#6C5DA0',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        breathe: {
          '0%, 100%': { boxShadow: '0 0 0 4px rgba(125,77,254,0.15)' },
          '50%': { boxShadow: '0 0 0 9px rgba(125,77,254,0.08)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.6s ease-out both',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        'pop-breathe':
          'pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both, breathe 2.4s ease-in-out 0.6s infinite',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
