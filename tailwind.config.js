const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), surface2: v('surface2'), ink: v('ink'), muted: v('muted'), line: v('line'),
        navy: v('navy'), navy2: v('navy2'), indigo: v('indigo'), mint: v('mint'), amber: v('amber'), coral: v('coral'),
      },
      fontFamily: {
        sans: ['Tajawal', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      opacity: { 12: '0.12', 15: '0.15' },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        hero: '0 20px 40px -16px rgb(15 23 42 / 0.55)',
        fab: '0 12px 28px -8px rgb(99 102 241 / 0.65)',
      },
    },
  },
  plugins: [],
};
