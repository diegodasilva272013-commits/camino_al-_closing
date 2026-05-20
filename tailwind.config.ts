import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        brand: {
          black: '#050505',
          surface: '#111111',
          surfaceSoft: '#181818',
          gold: '#D4AF37',
          goldSoft: '#B8892D',
          text: '#F5F5F5',
          muted: '#A3A3A3',
          border: 'rgba(212, 175, 55, 0.25)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212, 175, 55, 0.25), 0 8px 24px -12px rgba(212, 175, 55, 0.35)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #B8892D 100%)',
        'surface-gradient': 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
