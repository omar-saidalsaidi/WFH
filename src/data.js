// البنود الافتراضية ومساعدات الأرقام والتاريخ

export const SALARY = 760;
export const STORAGE_KEY = 'salary-tracker-omr-v3';

export const GROUPS = [
  { id: 'fixed', label: 'الالتزامات الثابتة', short: 'ثابتة', color: 'var(--c-indigo)' },
  { id: 'daily', label: 'المصاريف التشغيلية واليومية', short: 'تشغيلية', color: 'var(--c-mint)' },
  { id: 'temp', label: 'التزامات مؤقتة', short: 'مؤقتة', color: 'var(--c-amber)' },
  { id: 'emergency', label: 'بنود غير متوقعة / طارئة', short: 'طارئة', color: 'var(--c-coral)' },
];

export const ACCOUNTS = {
  salary: 'حساب الراتب',
  applepay: 'Apple Pay',
  card1: 'البطاقة 1',
  card2: 'البطاقة 2',
};

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
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  transactions: [],
});

export const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const numFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
export const fmt = (n) => numFmt.format(round3(n));
export const fmtShort = (n) => intFmt.format(round3(n));

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
