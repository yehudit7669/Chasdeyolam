/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0A192F',
        'primary-light': '#0B3C5D',
        'accent-gold': '#D4B483',
        'accent-gold-dark': '#B08D57',
        'natural-green': '#626D58',
        'natural-beige': '#F7F5F0',
        'natural-cream': '#F9F8F4',
        'natural-dark': '#33332D',
        'natural-border': '#E5E1D8',
        'dark-slate': '#2D3E40',
        secondary: '#F7F5F0',
        success: '#626D58',
        error: '#C62828',
        warning: '#D4B483',
      },
      fontFamily: {
        heebo: ['Heebo', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '3rem',
      },
      boxShadow: {
        natural: '0 4px 24px 0 rgba(98, 109, 88, 0.08), 0 1.5px 6px 0 rgba(51, 51, 45, 0.06)',
        'natural-lg': '0 8px 40px 0 rgba(98, 109, 88, 0.12), 0 2px 10px 0 rgba(51, 51, 45, 0.08)',
      },
    },
  },
  plugins: [],
};
