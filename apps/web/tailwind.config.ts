import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#FBF7F0', // warm cream page background
        ink: '#211D18', // near-black warm brown text
        clay: {
          50: '#FBF2EC',
          100: '#F5E1D5',
          200: '#E7BFA8',
          300: '#DB9C7A',
          400: '#CE7A4F',
          500: '#C25E33', // primary terracotta accent
          600: '#A54A26',
          700: '#83391F',
        },
        sage: '#5E6B54', // muted secondary green
      },
      boxShadow: {
        soft: '0 1px 2px rgba(33,29,24,0.04), 0 8px 24px -12px rgba(33,29,24,0.18)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
