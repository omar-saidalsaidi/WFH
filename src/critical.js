// التنبيهات الحرجة للأكل (يومياً) والبنزين (أسبوعياً) — منطق صافٍ بلا واجهة، مغطى في tests/critical.test.mjs
//
// - البنود تُحدَّد بمعرّفها الثابت (لا بالاسم)، فإعادة تسمية البند لا تكسر المراقبة.
// - العمليات تُجمع من كل الأشهر المالية حسب تاريخها التقويمي، مع إزالة التكرار بمعرّف العملية،
//   فالأسبوع الذي يمتد على شهرين أو سجلّين ماليين يُحسب كاملاً، وتغيير الشهر المعروض لا يصفّر الحساب.
// - كل المبالغ بالبيسة (أعداد صحيحة) لتفادي أخطاء الكسور: 2.400 لا تُعد تجاوزاً و2.401 تُعد.
import { toBaisa } from './finance.js';

export const CRIT_DEFAULTS = Object.freeze({ foodOn: true, foodPct: 3, foodItem: null, fuelOn: true, fuelLimit: 15, fuelItem: null, weekStart: 0, alertFx: false });
export const WEEK_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AUTO = { food: { id: 'food', names: ['أكل', 'الأكل', 'طعام'] }, fuel: { id: 'fuel', names: ['بنزين', 'البنزين', 'وقود'] } };

const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 1000) / 1000 : d; };
export function normalizeCritical(x) {
  const s = x && typeof x === 'object' ? x : {};
  const D = CRIT_DEFAULTS;
  const ws = Number(s.weekStart);
  return {
    foodOn: typeof s.foodOn === 'boolean' ? s.foodOn : D.foodOn,
    foodPct: num(s.foodPct, D.foodPct, 0.001, 100),
    foodItem: typeof s.foodItem === 'string' && s.foodItem ? s.foodItem : null,
    fuelOn: typeof s.fuelOn === 'boolean' ? s.fuelOn : D.fuelOn,
    fuelLimit: num(s.fuelLimit, D.fuelLimit, 0.001, 100000),
    fuelItem: typeof s.fuelItem === 'string' && s.fuelItem ? s.fuelItem : null,
    weekStart: Number.isInteger(ws) && ws >= 0 && ws <= 6 ? ws : D.weekStart,
    alertFx: s.alertFx === true,
  };
}

const pad = (n) => String(n).padStart(2, '0');
const serial = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const fromSerial = (n) => { const t = new Date(n * 86400000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
export const isoOf = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
export const addDays = (iso, k) => fromSerial(serial(iso) + k);

// الأسبوع التقويمي الذي يقع فيه التاريخ (يبدأ بيوم weekStart: 0 = الأحد)
export function weekRange(iso, weekStart = 0) {
  const s = serial(iso);
  const dow = new Date(s * 86400000).getUTCDay();
  const back = (dow - weekStart + 7) % 7;
  return { start: fromSerial(s - back), end: fromSerial(s - back + 6) };
}

// معرّف البند المراقَب: المختار صراحة، أو تلقائياً البند الافتراضي ثم أول بند يطابق الاسم
export function resolveItem(store, kind, chosen) {
  if (chosen) return chosen;
  const a = AUTO[kind];
  const has = (id) => store.months.some((m) => m.categories.some((c) => c.id === id));
  if (has(a.id)) return a.id;
  for (let i = store.months.length - 1; i >= 0; i--) {
    const c = store.months[i].categories.find((x) => a.names.includes(String(x.name).trim()));
    if (c) return c.id;
  }
  return null;
}

export function itemName(store, id) {
  for (let i = store.months.length - 1; i >= 0; i--) {
    const c = store.months[i].categories.find((x) => x.id === id);
    if (c) return c.name;
  }
  return id || '';
}

// عمليات البند من كل الأشهر، بلا تكرار (عملية واحدة = معرّف واحد)، مع الشهر المالي الذي سُجلت فيه
export function itemTransactions(store, itemId) {
  const seen = new Map();
  if (!itemId) return [];
  for (const m of store.months) {
    for (const t of m.transactions) {
      if (t.catId === itemId && typeof t.date === 'string' && !seen.has(t.id)) seen.set(t.id, { t, month: m });
    }
  }
  return [...seen.values()];
}

// مخصص الأكل الشهري المعتمد ليوم معين: من الشهر المالي الذي سُجلت فيه عمليات ذلك اليوم،
// وإلا الشهر الذي يطابق التاريخ التقويمي
function foodBudgetFor(store, itemId, iso, dayTx) {
  const month = (dayTx.length ? dayTx[dayTx.length - 1].month : null) || store.months.find((m) => m.period === iso.slice(0, 7)) || null;
  const c = month ? month.categories.find((x) => x.id === itemId) : null;
  return { month, budgetB: c ? Math.max(0, toBaisa(c.budget)) : 0 };
}

// حالة الأكل ليوم واحد
export function foodDay(store, cfg, iso, txs) {
  const itemId = resolveItem(store, 'food', cfg.foodItem);
  const all = txs || itemTransactions(store, itemId);
  const dayTx = all.filter((x) => x.t.date === iso);
  const spentB = dayTx.reduce((a, x) => a + toBaisa(x.t.amount), 0);
  const { month, budgetB } = foodBudgetFor(store, itemId, iso, dayTx);
  const limitB = Math.round((budgetB * cfg.foodPct) / 100);
  const over = budgetB > 0 && spentB > limitB; // المخصص صفر: لا يمكن حساب النسبة، فلا تنبيه
  return {
    kind: 'food', itemId, date: iso, count: dayTx.length, monthId: month ? month.id : null,
    spent: spentB / 1000, budget: budgetB / 1000, limit: limitB / 1000, pctLimit: cfg.foodPct,
    pct: budgetB > 0 ? (spentB / budgetB) * 100 : null, excess: over ? (spentB - limitB) / 1000 : 0, over, zeroBudget: budgetB === 0,
  };
}

// حالة البنزين لأسبوع واحد
export function fuelWeek(store, cfg, iso, txs) {
  const itemId = resolveItem(store, 'fuel', cfg.fuelItem);
  const all = txs || itemTransactions(store, itemId);
  const { start, end } = weekRange(iso, cfg.weekStart);
  const wk = all.filter((x) => x.t.date >= start && x.t.date <= end);
  const spentB = wk.reduce((a, x) => a + toBaisa(x.t.amount), 0);
  const limitB = toBaisa(cfg.fuelLimit);
  const over = spentB > limitB;
  const last = wk.reduce((a, x) => (!a || x.t.date >= a.t.date ? x : a), null);
  const month = (last && last.month) || store.months.find((m) => m.period === iso.slice(0, 7)) || null;
  return { kind: 'fuel', itemId, start, end, count: wk.length, monthId: month ? month.id : null, spent: spentB / 1000, limit: limitB / 1000, excess: over ? (spentB - limitB) / 1000 : 0, over };
}

const f3 = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
const fp = (n) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n)}٪`;

export function foodAdvice(s) {
  const tomorrow = Math.max(0, s.limit - s.excess);
  return `توقّف عن مشتريات الأكل غير الضرورية اليوم، ولتعويض التجاوز اجعل مصروف الأكل غداً في حدود ${f3(tomorrow)} ر.ع بدل ${f3(s.limit)}.`;
}
export function fuelAdvice(s, today) {
  const left = Math.max(0, serial(s.end) - serial(today));
  const next = Math.max(0, s.limit - s.excess);
  return `${left ? `ما زال في الأسبوع ${left} ${left === 1 ? 'يوم' : left === 2 ? 'يومان' : 'أيام'}: اجمع المشاوير المتقاربة في رحلة واحدة وتجنّب التنقل غير الضروري. ` : ''}لتعويض التجاوز اجعل بنزين الأسبوع القادم في حدود ${f3(next)} ر.ع.`;
}

// الحالات الحرجة القائمة الآن (لليوم والأسبوع الحاليين بتوقيت مسقط)
export function criticalConditions(store, today) {
  const cfg = normalizeCritical(store.settings?.critical);
  const iso = isoOf(today);
  const out = [];
  if (cfg.foodOn) {
    const s = foodDay(store, cfg, iso);
    if (s.over) {
      const name = itemName(store, s.itemId);
      out.push({
        key: `food:${s.itemId}:${iso}`, kind: 'food', level: 'critical', escalate: toBaisa(s.excess), itemId: s.itemId, monthId: s.monthId, name,
        title: 'تحذير حرج: تجاوز حد مصروف الأكل اليومي',
        desc: `صُرف اليوم ${f3(s.spent)} ر.ع على «${name}» والحد اليومي ${f3(s.limit)} ر.ع (${fp(s.pctLimit)} من مخصص ${f3(s.budget)} ر.ع). نسبة الصرف اليوم ${fp(Math.round(s.pct * 1000) / 1000)} من المخصص، والتجاوز ${f3(s.excess)} ر.ع.`,
        advice: foodAdvice(s), spent: s.spent, limit: s.limit, excess: s.excess, pct: s.pct,
      });
    }
  }
  if (cfg.fuelOn) {
    const s = fuelWeek(store, cfg, iso);
    if (s.over) {
      const name = itemName(store, s.itemId);
      out.push({
        key: `fuel:${s.itemId}:${s.start}`, kind: 'fuel', level: 'critical', escalate: toBaisa(s.excess), itemId: s.itemId, monthId: s.monthId, name,
        title: 'تحذير حرج: تجاوز حد مصروف البنزين الأسبوعي',
        desc: `صُرف هذا الأسبوع (${s.start} – ${s.end}) ${f3(s.spent)} ر.ع على «${name}» والحد الأسبوعي ${f3(s.limit)} ر.ع، والتجاوز ${f3(s.excess)} ر.ع.`,
        advice: fuelAdvice(s, iso), spent: s.spent, limit: s.limit, excess: s.excess,
      });
    }
  }
  return out;
}

// سجل الالتزام بالحدود — يُحسب فقط عند فتح صفحة التحليل (لا عند تشغيل التطبيق)
export function criticalHistory(store, today, { days = 14, weeks = 8, span = 90 } = {}) {
  const cfg = normalizeCritical(store.settings?.critical);
  const iso = isoOf(today);
  const from = addDays(iso, -(span - 1));
  const foodId = resolveItem(store, 'food', cfg.foodItem);
  const fuelId = resolveItem(store, 'fuel', cfg.fuelItem);
  const ftx = itemTransactions(store, foodId).filter((x) => x.t.date >= from && x.t.date <= iso);
  const vtx = itemTransactions(store, fuelId).filter((x) => x.t.date >= from && x.t.date <= iso);

  // الأكل: كل يوم من أول عملية مسجلة (ضمن النطاق) حتى اليوم
  const firstF = ftx.reduce((a, x) => (!a || x.t.date < a ? x.t.date : a), null);
  const food = { itemId: foodId, name: itemName(store, foodId), on: cfg.foodOn, pct: cfg.foodPct, trend: [], violations: 0, excess: 0, avg: null, completed: 0 };
  if (firstF) {
    let totalB = 0, excessB = 0;
    for (let d = firstF; d <= iso; d = addDays(d, 1)) {
      const s = foodDay(store, cfg, d, ftx);
      if (s.over) { food.violations++; excessB += toBaisa(s.excess); }
      if (d < iso) { food.completed++; totalB += toBaisa(s.spent); }
    }
    food.excess = excessB / 1000;
    food.avg = food.completed ? Math.round(totalB / food.completed) / 1000 : null;
  }
  for (let k = days - 1; k >= 0; k--) {
    const d = addDays(iso, -k);
    const s = foodDay(store, cfg, d, ftx);
    food.trend.push({ key: d, label: d.slice(8), spent: s.spent, limit: s.limit, over: s.over, current: d === iso });
  }

  // البنزين: كل أسبوع من أسبوع أول عملية حتى الأسبوع الحالي
  const firstV = vtx.reduce((a, x) => (!a || x.t.date < a ? x.t.date : a), null);
  const curWeek = weekRange(iso, cfg.weekStart).start;
  const fuel = { itemId: fuelId, name: itemName(store, fuelId), on: cfg.fuelOn, limit: cfg.fuelLimit, trend: [], violations: 0, excess: 0, avg: null, completed: 0 };
  if (firstV) {
    let totalB = 0, excessB = 0;
    for (let w = weekRange(firstV, cfg.weekStart).start; w <= curWeek; w = addDays(w, 7)) {
      const s = fuelWeek(store, cfg, w, vtx);
      if (s.over) { fuel.violations++; excessB += toBaisa(s.excess); }
      if (w < curWeek) { fuel.completed++; totalB += toBaisa(s.spent); }
    }
    fuel.excess = excessB / 1000;
    fuel.avg = fuel.completed ? Math.round(totalB / fuel.completed) / 1000 : null;
  }
  for (let k = weeks - 1; k >= 0; k--) {
    const w = addDays(curWeek, -7 * k);
    const s = fuelWeek(store, cfg, w, vtx);
    fuel.trend.push({ key: w, label: `${w.slice(8)}/${w.slice(5, 7)}`, spent: s.spent, limit: s.limit, over: s.over, current: w === curWeek });
  }

  const tips = [];
  if (food.violations) tips.push(`تجاوزت حد الأكل اليومي ${food.violations} ${food.violations === 1 ? 'مرة' : 'مرات'} بمجموع ${f3(food.excess)} ر.ع. خطّط لوجبات الأسبوع مسبقاً وقلّل الطلبات الخارجية في الأيام التي تتكرر فيها التجاوزات.`);
  if (fuel.violations) tips.push(`تجاوزت حد البنزين الأسبوعي ${fuel.violations} ${fuel.violations === 1 ? 'مرة' : 'مرات'} بمجموع ${f3(fuel.excess)} ر.ع. اجمع المشاوير المتقاربة وراجع التنقلات غير الضرورية.`);
  if (food.violations || fuel.violations) tips.push(`لو بقي الصرف ضمن الحدود لكان أقل بنحو ${f3(food.excess + fuel.excess)} ر.ع. هذا تقدير لما تجاوز الحد، وليس توفيراً مضموناً.`);
  if (!food.violations && !fuel.violations && (firstF || firstV)) tips.push('لم يُسجَّل أي تجاوز للحدود في الفترة المعروضة. استمر على النمط نفسه.');
  return { food, fuel, tips, span, from };
}
