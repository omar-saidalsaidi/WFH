// نظام الألوان الزخرفية للفئات والبنود — منفصل تماماً عن ألوان الحالة المالية (أخضر/كهرماني/أحمر)
// القيم المحفوظة: نص HEX (#RRGGBB)، أو مفتاح قديم من الإصدار السابق (lavender, mint...) يُترجم تلقائياً.

export const PALETTE = [
  { group: 'فاتحة وباستيل', colors: [
    ['لافندر', '#EDE4FF'], ['أزرق سماوي', '#E3F2FD'], ['أخضر نعناعي', '#E3F5EA'], ['خوخي', '#FFEBDD'],
    ['أصفر باهت', '#FFF5D6'], ['وردي فاتح', '#FCE7F0'], ['فيروزي فاتح', '#DFF4F1'], ['رمادي فاتح', '#F1F3F5'],
    ['نيلي فاتح', '#E0E7FF'], ['بيج', '#F5E6D3'], ['وردي', '#FADADD'], ['زيتي فاتح', '#EAF4D3'],
  ] },
  { group: 'متوسطة', colors: [
    ['بنفسجي', '#B8A1E3'], ['أزرق', '#90CAF9'], ['أخضر', '#81C784'], ['مرجاني', '#FFAB91'],
    ['ذهبي', '#FFD54F'], ['زهري', '#F48FB1'], ['فيروزي', '#80CBC4'], ['رمادي', '#B0BEC5'],
    ['نيلي', '#9FA8DA'], ['بني فاتح', '#BCAAA4'], ['أحمر', '#E57373'], ['ليموني', '#C5E1A5'],
  ] },
  { group: 'داكنة', colors: [
    ['بنفسجي داكن', '#593D91'], ['أزرق داكن', '#245B91'], ['أخضر غابات', '#286B49'], ['برتقالي محروق', '#A34D28'],
    ['ذهبي داكن', '#917016'], ['زهري داكن', '#963B68'], ['فيروزي داكن', '#176B70'], ['فحمي', '#374151'],
    ['نيلي داكن', '#373D80'], ['بني', '#795548'], ['عنابي', '#9B3030'], ['زيتي داكن', '#526B30'],
  ] },
];
export const PALETTE_FLAT = PALETTE.flatMap((g) => g.colors.map(([name, hex]) => ({ name, hex, group: g.group })));

// مفاتيح الإصدار السابق
const LEGACY = { lavender: '#EDE4FF', blue: '#E3F2FD', mint: '#E3F5EA', peach: '#FFEBDD', yellow: '#FFF5D6', pink: '#FCE7F0', teal: '#DFF4F1', gray: '#F1F3F5' };

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
export function normalizeHex(v) {
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return isHex(s) ? s.toUpperCase() : null;
}
export const resolveColor = (v) => (v == null || v === '' ? null : LEGACY[v] || normalizeHex(v));
export const colorName = (v) => { const h = resolveColor(v); return h ? (PALETTE_FLAT.find((c) => c.hex === h)?.name || h) : null; };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (a) => `#${a.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
// الإضاءة النسبية وفق WCAG
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };

const INK_DARK = '#1E293B', INK_LIGHT = '#F8FAFC';
const DARK_SURFACE = '#1A232F';

// يحوّل لون المستخدم إلى خلفية مناسبة للوضع الحالي مع لون نص بتباين كافٍ.
// في الوضع الداكن تُخفَّف الألوان الفاتحة بمزجها مع سطح داكن حتى لا تكون مبهرة، وتبقى هويتها واضحة.
export function surfaceFor(value, dark) {
  const hex = resolveColor(value);
  if (!hex) return null;
  let bg = dark && luminance(hex) > 0.35 ? mix(DARK_SURFACE, hex, 0.28) : hex;
  const onDark = contrast(bg, INK_LIGHT) >= contrast(bg, INK_DARK);
  const ink = onDark ? INK_LIGHT : INK_DARK;
  // ألوان متوسطة الإضاءة (مثل الذهبي الداكن) قد لا تبلغ 4.5:1 مع أي لون نص: نعدّلها خطوات صغيرة حتى تبلغه
  for (let k = 0; k < 12 && contrast(bg, ink) < 4.5; k++) bg = mix(bg, onDark ? '#000000' : '#FFFFFF', 0.06);
  const edge = onDark ? mix(bg, '#FFFFFF', 0.18) : mix(bg, '#000000', 0.12);
  const trip = (h) => rgb(h).join(' ');
  return {
    bg, ink, edge, onDark, ratio: contrast(bg, ink),
    chip: trip(onDark ? mix(bg, '#000000', 0.28) : mix(bg, '#FFFFFF', 0.55)),
    // متغيرات تُمرَّر للعناصر الداخلية فيتكيف نصها وأيقوناتها تلقائياً
    vars: onDark
      ? { '--ink': '248 250 252', '--muted': '214 220 230', '--line': '118 128 145', '--surface2': trip(mix(bg, '#000000', 0.28)) }
      : { '--ink': '30 41 59', '--muted': '71 85 105', '--line': '203 210 222', '--surface2': trip(mix(bg, '#FFFFFF', 0.55)) },
  };
}

// لون التمييز (فقاعة الأيقونة والنقطة): يُستخدم كما هو مع لون أيقونة متباين
export function accentFor(value, dark) {
  const hex = resolveColor(value);
  if (!hex) return null;
  const bg = dark && luminance(hex) > 0.6 ? mix(DARK_SURFACE, hex, 0.55) : hex;
  return { bg, ink: contrast(bg, INK_LIGHT) >= contrast(bg, INK_DARK) ? INK_LIGHT : INK_DARK };
}

// ألوان المظهر الأصلية: تُعاد على شارات الحالة المالية داخل البطاقات الملونة حتى تبقى ألوان التحذير واضحة ومتميزة
export const themeVars = (dark) => (dark
  ? { '--ink': '226 232 240', '--muted': '148 163 184', '--surface': '26 35 47', '--surface2': '35 46 61', '--line': '45 58 76' }
  : { '--ink': '30 41 59', '--muted': '100 116 139', '--surface': '255 255 255', '--surface2': '241 244 248', '--line': '226 232 240' });
