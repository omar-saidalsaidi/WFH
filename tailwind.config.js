const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), surface2: v('surface2'), ink: v('ink'), muted: v('muted'),
        line: v('line'), brand: v('brand'), accent: v('accent'), ocean: v('ocean'),
        hero1: v('hero1'), hero2: v('hero2'), good: v('good'), warn: v('warn'), bad: v('bad'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Tahoma', 'system-ui', 'sans-serif'],
        display: ['"Readex Pro"', '"IBM Plex Sans Arabic"', 'Tahoma', 'sans-serif'],
      },
      opacity: { 12: '0.12' },
    },
  },
  plugins: [],
};
