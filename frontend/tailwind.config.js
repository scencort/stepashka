/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#dc2626",
      },
      fontSize: {
        'xs': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'sm': ['1rem', { lineHeight: '1.5rem' }],        // 16px
        'base': ['1.125rem', { lineHeight: '1.625rem' }], // 18px
      },
    },
  },
  plugins: [],
}