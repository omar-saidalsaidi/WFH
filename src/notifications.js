// مركز التنبيهات — منطق صافٍ (بلا واجهة)، مغطى باختبارات في tests/notifications.test.mjs
//
// كل تنبيه ينشأ من «حالة مالية» لها مفتاح ثابت (مثل spend:2026-11 أو over:2026-11:food).
// - ما دامت الحالة قائمة لا يُنشأ لها تنبيه جديد (حتى لو أُعيد فتح التطبيق أو تغيّر الشهر أو حُذف التنبيه).
// - إذا زالت الحالة ثم عادت، يُنشأ تنبيه جديد بمعرّف جديد.
// - قراءة التنبيه أو حذفه لا يمسان البيانات المالية ولا التحذيرات الظاهرة في اللوحة.
// يُحفظ في مفتاح مستقل عن البيانات المالية، وبحد أقصى للسجل.
import { monthAlerts, monthSummary, spendWarning } from './finance.js';
import { salaryCountdown } from './schedule.js';

export const NOTIF_KEY = 'salary-tracker-omr-notifications';
export const MAX_ITEMS = 60;
export const SALARY_SOON_DAYS = 3;

export const emptyNotifState = () => ({ v: 1, items: [], active: {}, seq: 0 });

export function normalizeNotifState(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.items)) return emptyNotifState();
  return {
    v: 1,
    items: x.items.filter((i) => i && typeof i.id === 'string' && typeof i.key === 'string').slice(0, MAX_ITEMS),
    active: x.active && typeof x.active === 'object' ? { ...x.active } : {},
    seq: Number.isInteger(x.seq) && x.seq >= 0 ? x.seq : 0,
  };
}

const f3 = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
const f = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n);
const arDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))); };
const pad = (n) => String(n).padStart(2, '0');

// الحالات المالية الحالية — للشهر الفعلي الجاري فقط (لا تُعالَج الأشهر السابقة)
// today: { y, m, d } بتوقيت مسقط
export function computeConditions(store, today) {
  const out = [];
  const iso = `${today.y}-${pad(today.m)}-${pad(today.d)}`;
  const period = iso.slice(0, 7);
  const month = store.months.find((m) => m.period === period);
  if (month) {
    const s = monthSummary(month, iso);
    const limit = store.settings?.spendLimit ?? 650;
    const sw = spendWarning(s.paid, limit);
    if (sw.over) out.push({ key: `spend:${period}`, kind: 'spend', level: 'bad', title: 'تجاوز حد الإنفاق', desc: `المصروف الفعلي ${f3(s.paid)} ر.ع تجاوز الحد ${f3(limit)} بمقدار ${f3(sw.excess)} ر.ع.` });
    if (s.balance < 0) out.push({ key: `deficit:${period}`, kind: 'deficit', level: 'bad', title: 'عجز في الرصيد', desc: `المصروف الفعلي تجاوز إجمالي الدخل بمقدار ${f(-s.balance)} ر.ع.` });
    for (const a of monthAlerts(month, store, iso)) {
      if (a.kind === 'over') out.push({ key: `over:${period}:${a.itemId}`, kind: 'over', level: 'bad', title: `«${a.name}» تجاوز ميزانيته`, desc: a.pct != null ? `تجاوز المخصص بمقدار ${f(a.amount)} ر.ع.` : `صُرف ${f(a.amount)} ر.ع دون مخصص.` });
      else if (a.kind === 'near') out.push({ key: `near:${period}:${a.itemId}`, kind: 'near', level: 'warn', title: `«${a.name}» قارب على النفاد`, desc: `صُرف ${Math.round(a.pct * 100)}٪ من المخصص، والمتبقي ${f(a.amount)} ر.ع.` });
      else if (a.kind === 'due') out.push({ key: `due:${a.itemId}:${a.date}`, kind: 'due', level: 'warn', title: 'موعد دفع قريب', desc: `«${a.name}» ${f(a.amount)} ر.ع يستحق ${a.days === 0 ? 'اليوم' : `في ${arDate(a.date)}`}.` });
      else if (a.kind === 'overdue') out.push({ key: `overdue:${a.itemId}:${a.date}`, kind: 'overdue', level: 'bad', title: 'دفعة متأخرة', desc: `«${a.name}» ${f(a.amount)} ر.ع كان مستحقاً في ${arDate(a.date)}.` });
      else if (a.kind === 'debtDue') out.push({ key: `debtDue:${a.debtId}:${a.date}`, kind: 'due', level: 'warn', title: 'قسط قريب', desc: `قسط «${a.name}» ${f(a.amount)} ر.ع في ${arDate(a.date)}.` });
      else if (a.kind === 'debtOverdue') out.push({ key: `debtOverdue:${a.debtId}:${a.date}`, kind: 'overdue', level: 'bad', title: 'قسط متأخر', desc: `قسط «${a.name}» كان مستحقاً في ${arDate(a.date)}.` });
    }
  }
  // موعد الراتب المجدول (ليس تأكيداً للإيداع)
  const c = salaryCountdown(today, store.settings?.payDay ?? 23);
  if (c.daysLeft <= SALARY_SOON_DAYS) {
    const next = `${c.next.y}-${pad(c.next.m)}-${pad(c.next.d)}`;
    out.push({ key: `salary:${next}`, kind: 'salary', level: 'info', title: c.isToday ? 'اليوم موعد الراتب المجدول' : 'موعد الراتب قريب',
      desc: c.isToday ? `موعد الراتب المجدول اليوم (${arDate(next)}). هذا موعد مجدول وليس تأكيداً للإيداع.` : `الراتب المجدول بعد ${c.daysLeft} ${c.daysLeft === 1 ? 'يوم' : c.daysLeft === 2 ? 'يومين' : 'أيام'} (${arDate(next)}).` });
  }
  return out;
}

// مزامنة السجل مع الحالات الحالية. يعيد الحالة نفسها (نفس المرجع) إذا لم يتغير شيء.
export function syncNotifications(state, conditions, nowIso) {
  const live = new Set(conditions.map((c) => c.key));
  let changed = false;
  const active = { ...state.active };
  let seq = state.seq;
  const added = [];
  for (const c of conditions) {
    if (active[c.key]) continue; // قائمة مسبقاً: لا تكرار
    seq += 1;
    active[c.key] = seq;
    added.push({ id: `${c.key}#${seq}`, key: c.key, kind: c.kind, level: c.level, title: c.title, desc: c.desc, at: nowIso, read: false });
    changed = true;
  }
  for (const k of Object.keys(active)) {
    if (!live.has(k)) { delete active[k]; changed = true; } // زالت الحالة: يمكن أن تُنشئ تنبيهاً جديداً إذا عادت
  }
  if (!changed) return state;
  // الأحدث أولاً، والسجل محدود الحجم (يُحذف الأقدم أولاً)
  const items = [...added.reverse(), ...state.items].slice(0, MAX_ITEMS);
  return { ...state, items, active, seq };
}

export const unreadCount = (state) => state.items.reduce((a, i) => a + (i.read ? 0 : 1), 0);
export const markAllRead = (state) => (unreadCount(state) ? { ...state, items: state.items.map((i) => (i.read ? i : { ...i, read: true })) } : state);
// الحذف يزيل التنبيه من السجل فقط؛ يبقى مفتاح الحالة نشطاً فلا يُعاد إنشاؤه ما دامت الحالة قائمة
export const deleteNotification = (state, id) => ({ ...state, items: state.items.filter((i) => i.id !== id) });
export const clearNotifications = (state) => ({ ...state, items: [] });

export function loadNotifState() {
  try { return normalizeNotifState(JSON.parse(localStorage.getItem(NOTIF_KEY))); } catch (e) { return emptyNotifState(); }
}
export function saveNotifState(state) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
}
