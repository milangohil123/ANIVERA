/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pr: {
          primary: '#135D43',
          primaryDark: '#0F4C37',
          primaryLight: '#E8F5EE',
          secondary: '#0284C7',
          secondaryLight: '#E0F2FE',
          canvas: '#F1F5FC',
          card: '#FFFFFF',
          section: '#E8EEFC',
          border: '#E2E8F0',
          textPrimary: '#172033',
          textSecondary: '#64748B',
          subtle: '#F8FAFC',
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', '"Noto Sans Gujarati"', '"Noto Sans Devanagari"', 'sans-serif'],
        body: ['Inter', '"Noto Sans Gujarati"', '"Noto Sans Devanagari"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
