// البيانات الافتراضية للميزانية ومساعدات التاريخ والأرقام

export const SALARY = 760;
export const STORAGE_KEY = 'salary-tracker-omr-v1';

export const GROUPS = {
  fixed: { label: 'إلزامي', sub: 'الالتزامات الثابتة والادخار' },
  variable: { label: 'شبه إلزامي', sub: 'المصاريف اليومية والمتغيرة' },
  oneoff: { label: 'غير إلزامي / مؤقت', sub: 'التزامات مؤقتة تنتهي قريباً' },
};
export const GROUP_ORDER = ['fixed', 'variable', 'oneoff'];

export const ACCOUNTS = {
  salary: { label: 'حساب الراتب', short: 'حساب الراتب', partition: 'salary' },
  applepay: { label: 'بطاقة Apple Pay', short: 'Apple Pay', partition: 'applepay' },
  card1: { label: 'البطاقة الفعلية 1', short: 'بطاقة 1', partition: 'other' },
  card2: { label: 'البطاقة الفعلية 2', short: 'بطاقة 2', partition: 'other' },
};
export const ACCOUNT_ORDER = ['salary', 'applepay', 'card1', 'card2'];

export const PARTITIONS = [
  { id: 'salary', title: 'حساب الراتب الأساسي', sub: 'الالتزامات والادخار' },
  { id: 'applepay', title: 'بطاقة آبل باي', sub: 'المصاريف اليومية' },
  { id: 'other', title: 'البطاقات الأخرى', sub: 'المتفرقة والعيادة والخياط' },
];

// adj: قيم الموازنة الفورية حسب طريقة الموازنة المختارة
export const DEFAULT_CATEGORIES = [
  { id: 'jamiya', name: 'الجمعية', group: 'fixed', budget: 150, account: 'salary', icon: 'users' },
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary', icon: 'building' },
  { id: 'debt', name: 'الدين', group: 'fixed', budget: 100, account: 'salary', icon: 'coins' },
  { id: 'saving', name: 'الادخار', group: 'fixed', budget: 50, account: 'salary', icon: 'piggy', adj: { saving: 33 } },
  { id: 'net', name: 'النت', group: 'fixed', budget: 30, account: 'salary', icon: 'wifi' },
  { id: 'elec', name: 'الكهرباء', group: 'fixed', budget: 25, account: 'salary', icon: 'zap' },
  { id: 'water', name: 'الماء', group: 'fixed', budget: 5, account: 'salary', icon: 'drop' },
  { id: 'fuel', name: 'بنزين', group: 'variable', budget: 80, account: 'applepay', icon: 'fuel' },
  { id: 'ration', name: 'راشن + ترفيه', group: 'variable', budget: 80, account: 'applepay', icon: 'cart', adj: { daily: 73 } },
  { id: 'food', name: 'أكل', group: 'variable', budget: 80, account: 'applepay', icon: 'food', adj: { daily: 70 } },
  { id: 'oil', name: 'تغيير آيل', group: 'variable', budget: 15, account: 'card1', icon: 'wrench' },
  { id: 'laundry', name: 'الدوبي', group: 'variable', budget: 8, account: 'applepay', icon: 'laundry' },
  { id: 'tailor', name: 'الخياط (متبقي)', group: 'oneoff', budget: 22, account: 'card2', icon: 'scissors' },
  { id: 'laser', name: 'عيادة ليزر', group: 'oneoff', budget: 12, account: 'card1', icon: 'clinic' },
];

export const BALANCE_MODES = {
  daily: {
    label: 'تخفيض المصاريف اليومية',
    desc: 'راشن + ترفيه من 80 إلى 73 · أكل من 80 إلى 70',
  },
  saving: {
    label: 'تخفيض الادخار مؤقتاً',
    desc: 'الادخار من 50 إلى 33 لهذا الشهر فقط',
  },
};

export const effBudget = (cat, mode) =>
  mode && mode !== 'off' && cat.adj && cat.adj[mode] != null ? cat.adj[mode] : cat.budget;

// ---------- التاريخ ----------
export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const monthOf = (iso) => iso.slice(0, 7);
export const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const monthFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short' });
export const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return monthFmt.format(new Date(y, m - 1, 1));
};
export const dayLabel = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return dayFmt.format(new Date(y, m - 1, d));
};

// ---------- الأرقام ----------
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3, minimumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const fmt = (n) => numFmt.format(Math.round((n + Number.EPSILON) * 1000) / 1000);
export const fmt2 = (n) => num2.format(n);
export const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

// ---------- عمليات تجريبية للشهر الحالي ----------
let seq = 0;
export const uid = () => `t${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function seedTransactions(now = new Date()) {
  const ym = toISO(now).slice(0, 7);
  const today = now.getDate();
  const rows = [
    [1, 'jamiya', 'salary', 150, 'قسط الجمعية الشهري', true],
    [1, 'rent', 'salary', 120, 'إيجار الشقة', true],
    [1, 'debt', 'salary', 100, 'قسط الدين', true],
    [1, 'saving', 'salary', 50, 'تحويل لحساب الادخار', true],
    [1, 'tailor', 'card2', 11, 'دفعة الخياط الأولى', false],
    [1, 'food', 'applepay', 4.5, 'فطور', false],
    [2, 'fuel', 'applepay', 10, 'محطة شل', false],
    [3, 'net', 'salary', 30, 'فاتورة الإنترنت', true],
    [3, 'food', 'applepay', 6.2, 'غداء مع الزملاء', false],
    [4, 'ration', 'applepay', 18.5, 'لولو هايبرماركت', false],
    [5, 'water', 'salary', 5, 'فاتورة الماء', true],
    [5, 'food', 'applepay', 3.8, 'قهوة وسناك', false],
    [6, 'fuel', 'applepay', 10, 'محطة المها', false],
    [7, 'laundry', 'applepay', 4, 'كي ثياب', false],
    [8, 'food', 'applepay', 7.5, 'عشاء', false],
    [9, 'ration', 'applepay', 12, 'سينما', false],
    [10, 'oil', 'card1', 15, 'تغيير زيت المحرك', false],
    [10, 'food', 'applepay', 5, 'غداء', false],
    [11, 'fuel', 'applepay', 10, 'محطة شل', false],
    [12, 'laser', 'card1', 12, 'جلسة ليزر', false],
    [12, 'food', 'applepay', 9.3, 'مطعم', false],
    [13, 'ration', 'applepay', 22.75, 'مقاضي البيت', false],
    [14, 'food', 'applepay', 4.2, 'فطور', false],
    [15, 'laundry', 'applepay', 4, 'غسيل دشاديش', false],
    [16, 'fuel', 'applepay', 10, 'محطة نفط عمان', false],
    [17, 'food', 'applepay', 6.8, 'غداء', false],
    [18, 'ration', 'applepay', 9.5, 'خضار وفواكه', false],
    [19, 'food', 'applepay', 5.5, 'عشاء خفيف', false],
    [20, 'fuel', 'applepay', 10, 'محطة شل', false],
    [21, 'food', 'applepay', 3.9, 'قهوة', false],
  ];
  return rows
    .filter(([d]) => d <= today)
    .map(([d, catId, account, amount, note, recurring]) => ({
      id: uid(),
      date: `${ym}-${pad(d)}`,
      catId,
      account,
      amount,
      note,
      recurring,
      sample: true,
    }));
}

export const defaultState = () => ({
  salary: SALARY,
  balanceMode: 'off',
  lastBalanceMode: 'daily',
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, adj: c.adj ? { ...c.adj } : undefined })),
  transactions: seedTransactions(),
});
