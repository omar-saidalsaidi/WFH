// ترتيب عرض البنود داخل الفئة — يغيّر العرض فقط ولا يمس البيانات أو الترتيب اليدوي المحفوظ
import { toBaisa } from './finance.js';

export const SORT_MODES = [
  { id: 'smart', label: 'ترتيب ذكي' },
  { id: 'budget', label: 'المخصص: الأعلى أولاً' },
  { id: 'remaining', label: 'المتبقي: الأعلى أولاً' },
  { id: 'manual', label: 'الترتيب اليدوي' },
];
export const DEFAULT_SORT = 'smart';

// حالة البند للترتيب الذكي: outstanding (متبقٍ > 0) · over (تجاوز) · done (مكتمل)
export const itemState = (planned, paid) => {
  const r = toBaisa(planned) - toBaisa(paid);
  return r > 0 ? 'outstanding' : r < 0 ? 'over' : 'done';
};

// ترتيب مستقر: عند التساوي يبقى الترتيب اليدوي الأصلي
const stable = (list, cmp) => list.map((x, i) => [x, i]).sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]).map((p) => p[0]);
const byBudget = (a, b) => toBaisa(b.planned) - toBaisa(a.planned);

export function sortItems(items, mode = DEFAULT_SORT) {
  if (mode === 'manual') return items.slice();
  if (mode === 'budget') return stable(items, byBudget);
  if (mode === 'remaining') return stable(items, (a, b) => (toBaisa(b.planned) - toBaisa(b.paid)) - (toBaisa(a.planned) - toBaisa(a.paid)));
  // ذكي: المستحقة أولاً (الأعلى مخصصاً)، ثم المتجاوزة (تحذير)، ثم المكتملة — كل مجموعة بالمخصص تنازلياً
  const rank = { outstanding: 0, over: 1, done: 2 };
  return stable(items, (a, b) => rank[itemState(a.planned, a.paid)] - rank[itemState(b.planned, b.paid)] || byBudget(a, b));
}
