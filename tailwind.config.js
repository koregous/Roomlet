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
        // 3-colour system: (1) neutral ink surfaces, (2) white text, (3) one accent.
        ink: {
          DEFAULT: '#000000', // page
          raised: '#0f0f0f',  // cards / panels
          field: '#181818',   // inputs (lighter than the card so they read as "fillable")
          line: '#2a2a2a',    // borders
          'line-strong': '#3d3d3d',
        },
        accent: {
          DEFAULT: '#7c9cff', // focus rings, active states, saving indicator
          soft: 'rgba(124,156,255,0.14)',
        },
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
