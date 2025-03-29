/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
      },
      backdropBlur: {
        xl: '24px',
      },
      boxShadow: {
        'video': '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      },
      colors: {
        'deep-navy': '#0f172a',
        'dark-slate': '#1e293b',
        'accent-teal': '#14b8a6',
        'accent-purple': '#8b5cf6'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}