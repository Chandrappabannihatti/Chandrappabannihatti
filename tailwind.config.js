/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#081728',
        coral: '#f07e5e',
        cream: '#f7f5ef',
        mint: '#bce7d7',
        sky: '#cce7f4',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 55px rgba(8, 23, 40, 0.10)',
        card: '0 8px 30px rgba(8, 23, 40, 0.06)',
      },
    },
  },
  plugins: [],
}
