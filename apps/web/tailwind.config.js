/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        dark: { DEFAULT: '#08080D', card: '#0E0E16', hover: '#141420' },
        border: 'rgba(255,255,255,0.05)',
        'gray-muted': '#6B6B80',
        'gray-light': '#9999AD',
        white: '#EEEEF2',
        cyan: { DEFAULT: '#00D4FF', dim: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.18)' },
        orange: { DEFAULT: '#FF6B35', dim: 'rgba(255,107,53,0.08)', border: 'rgba(255,107,53,0.18)' },
        purple: { DEFAULT: '#A855F7', dim: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.18)' },
        green: { DEFAULT: '#00CC66', dim: 'rgba(0,204,102,0.08)' },
        red: { DEFAULT: '#FF4444', dim: 'rgba(255,68,68,0.08)' },
        gold: { DEFAULT: '#FFD700', dim: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.18)' },
        yellow: { DEFAULT: '#FACC15', dim: 'rgba(250,204,21,0.08)' },
      },
      fontFamily: {
        heading: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
