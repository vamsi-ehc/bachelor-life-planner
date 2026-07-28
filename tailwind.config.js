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
          DEFAULT: '#3947C4',
          dim: '#EDEEFA',
          dark: '#2E38A6',
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
    },
  },
  plugins: [],
};
