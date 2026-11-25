import { normalizeCritical } from './critical.js';
// البنود الافتراضية ومساعدات الأرقام والتاريخ

export const SALARY = 760;
export const STORAGE_KEY = 'salary-tracker-omr-v3';

// الفئات والبطاقات قابلة لإعادة التسمية، والمعرّفات ثابتة فلا تتأثر البنود والعمليات بتغيير الأسماء
export const DEFAULT_SECTIONS = [
  { id: 'fixed', name: 'الالتزامات الثابتة' },
  { id: 'daily', name: 'المصاريف التشغيلية واليومية' },
  { id: 'temp', name: 'التزامات مؤقتة' },
  { id: 'emergency', name: 'بنود غير متوقعة / طارئة' },
];

export const DEFAULT_CARDS = [
  { id: 'salary', name: 'حساب الراتب' },
  { id: 'applepay', name: 'Apple Pay' },
  { id: 'card1', name: 'البطاقة 1' },
  { id: 'card2', name: 'البطاقة 2' },
];

export const DEFAULT_CATEGORIES = [
  { id: 'jamiya', name: 'الجمعية', group: 'fixed', budget: 150, account: 'salary' },
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' },
  { id: 'debt', name: 'الدين', group: 'fixed', budget: 100, account: 'salary' },
  { id: 'saving', name: 'الادخار', group: 'fixed', budget: 50, account: 'salary' },
  { id: 'net', name: 'النت', group: 'fixed', budget: 30, account: 'salary' },
  { id: 'elec', name: 'الكهرباء', group: 'fixed', budget: 25, account: 'salary' },
  { id: 'water', name: 'الماء', group: 'fixed', budget: 5, account: 'salary' },
  { id: 'fuel', name: 'بنزين', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'food', name: 'أكل', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'ration', name: 'راشن', group: 'daily', budget: 40, account: 'applepay' },
  { id: 'fun', name: 'ترفيه', group: 'daily', budget: 40, account: 'applepay' },
  { id: 'oil', name: 'تغيير آيل', group: 'daily', budget: 15, account: 'card1' },
  { id: 'laundry', name: 'الدوبي', group: 'daily', budget: 8, account: 'applepay' },
  { id: 'tailor', name: 'الخياط', group: 'temp', budget: 22, account: 'card2' },
  { id: 'laser', name: 'عيادة ليزر', group: 'temp', budget: 12, account: 'card1' },
  { id: 'emergency', name: 'طارئ', group: 'emergency', budget: 0, account: 'card1' },
];

// البنود المعروضة في مقارنة المخصص مقابل المصروف
export const COMPARE_IDS = ['fuel', 'food', 'ration', 'fun', 'emergency'];

export const defaultState = () => ({
  sections: DEFAULT_SECTIONS.map((x) => ({ ...x })),
  cards: DEFAULT_CARDS.map((x) => ({ ...x })),
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  transactions: [],
});

// ترحيل البيانات القديمة: إضافة قوائم الفئات والبطاقات إن لم تكن محفوظة، مع الإبقاء على البنود والعمليات كما هي
export function migrate(s) {
  const fill = (saved, defaults) => {
    const list = Array.isArray(saved) ? saved.filter((x) => x && x.id && typeof x.name === 'string') : [];
    for (const d of defaults) if (!list.some((x) => x.id === d.id)) list.push({ ...d });
    return defaults.map((d) => list.find((x) => x.id === d.id)).concat(list.filter((x) => !defaults.some((d) => d.id === x.id)));
  };
  return { ...s, sections: fill(s.sections, DEFAULT_SECTIONS), cards: fill(s.cards, DEFAULT_CARDS) };
}

export const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const numFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
export const fmt = (n) => numFmt.format(round3(n));
export const fmtShort = (n) => intFmt.format(round3(n));
const fmt3Fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const fmt3 = (n) => fmt3Fmt.format(round3(n));

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const yesterdayISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); };

const longFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const dateLabel = (s) => shortFmt.format(parse(s));
export const dayHeading = (s) => (s === todayISO() ? 'اليوم' : s === yesterdayISO() ? 'أمس' : longFmt.format(parse(s)));
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------- الأشهر ----------
// كل شهر يحمل نسخته الخاصة من الراتب والفئات والبطاقات والبنود والعمليات
export const STORE_KEY = 'salary-tracker-omr-v4';
const monthNameFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'long', year: 'numeric' });
export const periodNow = () => todayISO().slice(0, 7);
export const nextPeriod = (p) => { const [y, m] = p.split('-').map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const monthLabelFor = (p) => { const [y, m] = p.split('-').map(Number); return `راتب شهر ${monthNameFmt.format(new Date(y, m - 1, 1))}`; };

const newMonth = (period, base) => ({
  incomes: [],
  carryIn: 0,
  carryFromId: null,
  id: `m${uid()}`,
  period,
  label: monthLabelFor(period),
  salary: SALARY,
  ...(base || defaultState()),
});

// شهر جديد من قالب الشهر الحالي: نفس الراتب والفئات والبطاقات والبنود وألوانها، بلا عمليات.
// الدخل الإضافي لا يُنسخ، إلا المدخلات التي حدّدها المستخدم صراحةً كمتكررة.
export const monthFromTemplate = (tpl, period) => ({
  ...newMonth(period),
  salary: tpl.salary,
  sections: tpl.sections.map((x) => ({ ...x })),
  cards: tpl.cards.map((x) => ({ ...x })),
  categories: tpl.categories.map((c) => ({ ...c })),
  transactions: [],
  incomes: (tpl.incomes || []).filter((i) => i.recurring).map((i) => ({
    ...i, id: `inc${uid()}`, date: `${period}-${String(Math.min(Number((i.date || '').slice(8, 10)) || 1, 28)).padStart(2, '0')}`, copiedFrom: i.id,
  })),
});

export const SCHEMA_VERSION = 6;
export const backupKeyFor = (v) => `salary-tracker-omr-backup-schema${v}`;
export const SNAPSHOT_KEY = 'salary-tracker-omr-snapshots';

// تطبيع البيانات: يضيف الحقول الناقصة بقيم افتراضية فقط، ولا يغيّر أي مبلغ أو عملية مسجلة
export function normalizeStore(st) {
  const months = st.months.map((m) => ({
    ...migrate(m),
    salary: typeof m.salary === 'number' ? m.salary : SALARY,
    carryIn: Number.isFinite(m.carryIn) ? m.carryIn : 0,
    carryFromId: m.carryFromId || null,
    incomes: Array.isArray(m.incomes) ? m.incomes : [],
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    months,
    activeId: months.some((m) => m.id === st.activeId) ? st.activeId : months[months.length - 1].id,
    debts: Array.isArray(st.debts) ? st.debts : [],
    goals: Array.isArray(st.goals) ? st.goals : [],
    settings: normalizeSettings(st.settings),
  };
}

// إعدادات المظهر العامة (تسري على كل الأشهر): ألوان البطاقتين الرئيسيتين، يوم صرف الراتب، وترتيب البنود لكل فئة
export function normalizeSettings(x) {
  const s = x && typeof x === 'object' ? x : {};
  const cc = s.cardColors && typeof s.cardColors === 'object' ? s.cardColors : {};
  const day = Number(s.payDay);
  const lim = Number(s.spendLimit);
  return {
    cardColors: { salary: typeof cc.salary === 'string' ? cc.salary : null, balance: typeof cc.balance === 'string' ? cc.balance : null },
    payDay: Number.isInteger(day) && day >= 1 && day <= 31 ? day : 23,
    spendLimit: Number.isFinite(lim) && lim > 0 ? Math.round(lim * 1000) / 1000 : 650,
    sortModes: s.sortModes && typeof s.sortModes === 'object' ? { ...s.sortModes } : {},
    critical: normalizeCritical(s.critical),
  };
}

// تحميل البيانات: الصيغة الحالية، أو ترحيل بيانات الإصدار الأقدم إلى الشهر الحالي
export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const st = JSON.parse(raw);
    if (st && Array.isArray(st.months) && st.months.length) {
      // قبل ترقية بيانات من إصدار أقدم: نسخة احتياطية كاملة وثابتة من النص المحفوظ كما هو (مرة واحدة فقط)
      const v = st.schemaVersion || 4;
      if (v < SCHEMA_VERSION) {
        try { if (!localStorage.getItem(backupKeyFor(v))) localStorage.setItem(backupKeyFor(v), raw); } catch (e) { /* المساحة ممتلئة: نتابع دون حذف شيء */ }
      }
      return normalizeStore(st);
    }
  } catch (e) { /* ننتقل للترحيل */ }
  let base = null;
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (old && Array.isArray(old.categories) && Array.isArray(old.transactions)) base = migrate(old);
  } catch (e) { /* لا توجد بيانات سابقة */ }
  const m = newMonth(periodNow(), base ? { sections: base.sections, cards: base.cards, categories: base.categories, transactions: base.transactions } : null);
  return normalizeStore({ months: [m], activeId: m.id });
}

// لقطات تلقائية قبل العمليات الخطرة (مسح، حذف شهر، استيراد) — آخر 5 فقط
export function saveSnapshot(store, reason) {
  try {
    const list = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
    list.unshift({ at: new Date().toISOString(), reason, store });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list.slice(0, 5)));
    return true;
  } catch (e) { return false; }
}
export function listSnapshots() {
  try { const l = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
