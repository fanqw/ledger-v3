import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3B82F6', foreground: '#FFFFFF' },
        background: '#FFFFFF',
        foreground: '#0F172A',
        muted: { DEFAULT: '#F8FAFC', foreground: '#94A3B8' },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#3B82F6',
        accent: { DEFAULT: '#F1F5F9', foreground: '#0F172A' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FFFFFF' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { lg: '16px', md: '8px', sm: '6px' },
      boxShadow: {
        'btn': '0px 4px 12px 0px #3B82F640',
        'card': '0px 2px 8px 0px rgba(2, 20, 40, 0.06)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(-147.381deg, #0F172A 14.645%, #1E293B 85.355%)',
        'logo-gradient': 'linear-gradient(-135deg, #3B82F6 14.645%, #1D4ED8 85.355%)',
      },
    },
  },
  plugins: [],
};

export default config;
