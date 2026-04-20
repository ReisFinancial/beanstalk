/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eefcf4',
          100: '#d6f7e2',
          200: '#afeec9',
          300: '#79dfa7',
          400: '#43c881',
          500: '#1fae66',
          600: '#148c52',
          700: '#116f43',
          800: '#115837',
          900: '#0f492f',
        },
        grape: {
          50:  '#f6f3ff',
          100: '#ece6ff',
          200: '#d8ccff',
          300: '#bca7ff',
          400: '#9b7dff',
          500: '#7f58ff',
          600: '#6b3ef2',
          700: '#5a2fd6',
          800: '#4a28ad',
          900: '#3d248a',
        },
        peach: {
          400: '#ff9a76',
          500: '#ff7a50',
          600: '#e85f33',
        },
        ink: {
          900: '#0d1b2a',
          700: '#1b263b',
          500: '#415a77',
          300: '#778da9',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(13, 27, 42, 0.15)',
        glow: '0 10px 40px -12px rgba(127, 88, 255, 0.45)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #7f58ff 0%, #1fae66 60%, #ff9a76 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(127,88,255,0.12) 0%, rgba(31,174,102,0.12) 100%)',
      },
    },
  },
  plugins: [],
}
