const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), surface2: v('surface2'), ink: v('ink'), muted: v('muted'), line: v('line'),
        hero: v('hero'), hero2: v('hero2'), accent: v('accent'), sky: v('sky'), good: v('good'), warn: v('warn'), bad: v('bad'),
        hp1: v('hp1'), hp2: v('hp2'), hpink: v('hpink'),
      },
      fontFamily: { sans: ['Tajawal', 'Tahoma', 'system-ui', 'sans-serif'] },
      opacity: { 12: '0.12', 15: '0.15' },
    },
  },
  plugins: [],
};
