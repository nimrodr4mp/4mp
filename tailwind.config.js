/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FBF0F8',
          100: '#F5D9EE',
          200: '#EBB3DC',
          300: '#DD86C6',
          400: '#C954AA',
          500: '#B14499',
          600: '#9F2986',
          700: '#7A256F',
          800: '#5E1B54',
          900: '#421239',
        },
      },
    },
  },
  plugins: [],
}
