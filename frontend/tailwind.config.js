/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          black: '#050505',
          dark: '#0a0a0a',
          gray: '#1a1a1a',
          blue: '#00f2ff',
          pink: '#ff00ff',
          green: '#00ff41',
          yellow: '#f3e600',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'neon-blue': '0 0 5px #00f2ff, 0 0 20px #00f2ff44',
        'neon-pink': '0 0 5px #ff00ff, 0 0 20px #ff00ff44',
        'neon-green': '0 0 5px #00ff41, 0 0 20px #00ff4144',
      }
    },
  },
  plugins: [],
}
