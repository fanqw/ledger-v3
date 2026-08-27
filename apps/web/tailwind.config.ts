import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0F766E', foreground: '#FFFFFF' },
        background: '#FFFFFF',
        foreground: '#0F172A',
        muted: { DEFAULT: '#F8FAFC', foreground: '#94A3B8' },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#0F766E',
        accent: { DEFAULT: '#F1F5F9', foreground: '#0F172A' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FFFFFF' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { lg: '8px', md: '6px', sm: '4px' },
      boxShadow: {
        'btn': '0px 4px 12px 0px #0F766E40',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(-147.381deg, #0F172A 14.645%, #1E293B 85.355%)',
        'logo-gradient': 'linear-gradient(-135deg, #0F766E 14.645%, #115E59 85.355%)',
      },
    },
  },
  plugins: [],
};

export default config;
