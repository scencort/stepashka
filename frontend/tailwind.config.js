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
        primary: {
          DEFAULT: "#DC2626",
          50:  "#FFF5F5",
          100: "#FFE4E4",
          200: "#FFCECE",
          300: "#FFA3A3",
          400: "#FF6B6B",
          500: "#F83B3B",
          600: "#DC2626",
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
        },
        burgundy: {
          DEFAULT: "#7C1D1D",
          50:  "#FFF0F0",
          100: "#FFD6D6",
          200: "#FFAAAA",
          300: "#FF7777",
          400: "#E84444",
          500: "#C42020",
          600: "#A01515",
          700: "#7C1D1D",
          800: "#5F1010",
          900: "#3D0808",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      fontSize: {
        'xs':   ['0.8125rem', { lineHeight: '1.125rem' }],
        'sm':   ['0.9375rem', { lineHeight: '1.375rem' }],
        'base': ['1.0625rem', { lineHeight: '1.625rem' }],
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'card-md': '0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.05)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.10), 0 16px 48px rgba(0,0,0,0.06)',
        'red':     '0 4px 24px rgba(220,38,38,0.25)',
        'red-lg':  '0 8px 40px rgba(220,38,38,0.30)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
}
