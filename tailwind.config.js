/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './styles/**/*.css',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        handwriting: ['var(--font-caveat)', 'cursive'],
      },
      colors: {
        dark: {
          bg: '#000000',
          surface: '#0a0a0a',
          border: '#1a1a1a',
          text: '#ffffff',
          'text-muted': '#a0a0a0',
        },
      },
    },
  },
  plugins: [],
}
