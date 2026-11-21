// البنود الافتراضية ومساعدات الأرقام والتاريخ

export const SALARY = 760;
export const STORAGE_KEY = 'salary-tracker-omr-v2';

export const GROUPS = [
  { id: 'fixed', label: 'الالتزامات الثابتة' },
  { id: 'daily', label: 'المصاريف التشغيلية واليومية' },
  { id: 'temp', label: 'التزامات مؤقتة' },
  { id: 'emergency', label: 'بنود غير متوقعة / طارئة' },
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
  { id: 'ration', name: 'راشن + ترفيه', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'food', name: 'أكل', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'oil', name: 'تغيير آيل', group: 'daily', budget: 15, account: 'card1' },
  { id: 'laundry', name: 'الدوبي', group: 'daily', budget: 8, account: 'applepay' },
  { id: 'tailor', name: 'الخياط', group: 'temp', budget: 22, account: 'card2' },
  { id: 'laser', name: 'عيادة ليزر', group: 'temp', budget: 12, account: 'card1' },
  { id: 'emergency', name: 'بنود غير متوقعة / طارئة', group: 'emergency', budget: 0, account: 'card1' },
];

export const defaultState = () => ({
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  transactions: [],
});

export const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
export const fmt = (n) => numFmt.format(round3(n));

const pad = (n) => String(n).padStart(2, '0');
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dateFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
export const dateLabel = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
};
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
