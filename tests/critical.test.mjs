import test from 'node:test';
import assert from 'node:assert/strict';
import { criticalConditions, foodDay, fuelWeek, weekRange, normalizeCritical, resolveItem, criticalHistory, CRIT_DEFAULTS } from '../src/critical.js';
import { syncNotifications, emptyNotifState, markAllRead, deleteNotification, unreadCritical, displayOrder, hideBanner, bannerHidden, normalizeNotifState } from '../src/notifications.js';
import { normalizeSettings } from '../src/data.js';

const cats = (food = 80, fuel = 80) => [{ id: 'food', name: 'أكل', budget: food }, { id: 'fuel', name: 'بنزين', budget: fuel }, { id: 'rent', name: 'الإيجار', budget: 300 }];
let n = 0;
const tx = (catId, amount, date, id = `t${n++}`) => ({ id, catId, amount, date, created: n });
const month = (id, period, txs, c = cats()) => ({ id, period, categories: c, transactions: txs });
const st = (months, critical = {}) => ({ months, settings: { critical: normalizeCritical(critical) } });
const D = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const cfg = normalizeCritical({});
const keys = (c) => c.map((x) => x.key).sort();

test('الإعدادات الافتراضية والتوافق مع البيانات القديمة', () => {
  assert.deepEqual(normalizeCritical(undefined), { ...CRIT_DEFAULTS });
  assert.deepEqual(normalizeSettings({ payDay: 23 }).critical, { ...CRIT_DEFAULTS });
  const c = normalizeCritical({ foodPct: -1, fuelLimit: 'x', weekStart: 9, foodOn: 'yes', foodItem: 'c1' });
  assert.equal(c.foodPct, 3); assert.equal(c.fuelLimit, 15); assert.equal(c.weekStart, 0); assert.equal(c.foodOn, true); assert.equal(c.foodItem, 'c1');
});

test('الأكل بمخصص 80: 2.399 و2.400 لا تنبيه، 2.401 تنبيه حرج', () => {
  for (const [amt, over] of [[2.399, false], [2.4, false], [2.401, true]]) {
    const s = st([month('m', '2026-11', [tx('food', amt, '2026-11-10')])]);
    const d = foodDay(s, cfg, '2026-11-10');
    assert.equal(d.limit, 2.4); assert.equal(d.over, over, String(amt));
    assert.equal(criticalConditions(s, D('2026-11-10')).length, over ? 1 : 0);
  }
});

test('مثال المواصفات: 3.500 من 80 => 4.375٪ وتجاوز 1.100، وتجميع دفعات اليوم الواحد', () => {
  const s = st([month('m', '2026-11', [tx('food', 1.5, '2026-11-10'), tx('food', 2, '2026-11-10'), tx('food', 50, '2026-11-09'), tx('rent', 9, '2026-11-10')])]);
  const [c] = criticalConditions(s, D('2026-11-10'));
  assert.equal(c.title, 'تحذير حرج: تجاوز حد مصروف الأكل اليومي');
  assert.equal(c.spent, 3.5); assert.equal(c.limit, 2.4); assert.equal(c.excess, 1.1); assert.equal(c.pct, 4.375);
  assert.match(c.desc, /3\.500/); assert.match(c.desc, /2\.400/); assert.match(c.desc, /4\.375٪/); assert.match(c.desc, /1\.100/);
  assert.match(c.advice, /1\.300/); // 2.400 − 1.100
});

test('الأكل: تصفير عند منتصف الليل، وتغيير المخصص، والمخصص الصفري آمن', () => {
  const s = st([month('m', '2026-11', [tx('food', 3, '2026-11-10')])]);
  assert.equal(criticalConditions(s, D('2026-11-10')).length, 1);
  assert.equal(criticalConditions(s, D('2026-11-11')).length, 0);
  const big = st([month('m', '2026-11', [tx('food', 3, '2026-11-10')], cats(120))]); // الحد 3.600
  assert.equal(criticalConditions(big, D('2026-11-10')).length, 0);
  const zero = st([month('m', '2026-11', [tx('food', 3, '2026-11-10')], cats(0))]);
  const z = foodDay(zero, cfg, '2026-11-10');
  assert.equal(z.zeroBudget, true); assert.equal(z.over, false); assert.equal(z.pct, null);
  assert.equal(criticalConditions(zero, D('2026-11-10')).length, 0);
});

test('البنزين: 14.999 و15.000 لا تنبيه، 15.001 تنبيه، وتجميع دفعات الأسبوع', () => {
  for (const [parts, over] of [[[14.999], false], [[15], false], [[15.001], true], [[5, 5, 5.001], true]]) {
    const txs = parts.map((a, i) => tx('fuel', a, `2026-11-${String(8 + i).padStart(2, '0')}`)); // الأحد 8 نوفمبر
    const s = st([month('m', '2026-11', txs)]);
    assert.equal(fuelWeek(s, cfg, '2026-11-12').over, over, parts.join('+'));
  }
  const s = st([month('m', '2026-11', [tx('fuel', 10, '2026-11-08'), tx('fuel', 8, '2026-11-11')])]);
  const [c] = criticalConditions(s, D('2026-11-12'));
  assert.equal(c.title, 'تحذير حرج: تجاوز حد مصروف البنزين الأسبوعي');
  assert.equal(c.spent, 18); assert.equal(c.excess, 3); assert.equal(c.key, 'fuel:fuel:2026-11-08');
});

test('الأسبوع: الأحد إلى السبت افتراضياً، قابل للتغيير، ويتصفر مع الأسبوع الجديد', () => {
  assert.deepEqual(weekRange('2026-11-12', 0), { start: '2026-11-08', end: '2026-11-14' });
  assert.deepEqual(weekRange('2026-11-08', 0), { start: '2026-11-08', end: '2026-11-14' });
  assert.deepEqual(weekRange('2026-11-14', 0), { start: '2026-11-08', end: '2026-11-14' });
  assert.deepEqual(weekRange('2026-11-12', 1), { start: '2026-11-09', end: '2026-11-15' });
  assert.deepEqual(weekRange('2026-11-12', 6), { start: '2026-11-07', end: '2026-11-13' });
  const s = st([month('m', '2026-11', [tx('fuel', 16, '2026-11-14')])]);
  assert.equal(criticalConditions(s, D('2026-11-14')).length, 1);
  assert.equal(criticalConditions(s, D('2026-11-15')).length, 0); // الأحد: أسبوع جديد
  // بداية الاثنين: السبت 14 والأحد 15 في الأسبوع نفسه
  const s2 = st([month('m', '2026-11', [tx('fuel', 8, '2026-11-14'), tx('fuel', 8, '2026-11-15')])], { weekStart: 1 });
  assert.equal(criticalConditions(s2, D('2026-11-15')).length, 1);
  assert.equal(criticalConditions({ ...s2, settings: { critical: cfg } }, D('2026-11-15')).length, 0);
});

test('أسبوع يعبر شهرين ماليين ونهاية السنة، بلا تكرار للعمليات، ولا يتأثر بالشهر المعروض', () => {
  // الأحد 27 ديسمبر 2026 – السبت 2 يناير 2027
  const dec = month('dec', '2026-12', [tx('fuel', 9, '2026-12-28', 'a')]);
  const jan = month('jan', '2027-01', [tx('fuel', 7, '2027-01-01', 'b'), tx('fuel', 9, '2026-12-28', 'a')]); // 'a' منسوخة: تُحسب مرة واحدة
  const s = st([dec, jan]);
  const w = fuelWeek(s, cfg, '2027-01-02');
  assert.deepEqual([w.start, w.end, w.spent, w.count], ['2026-12-27', '2027-01-02', 16, 2]);
  assert.equal(w.over, true); assert.equal(w.monthId, 'jan');
  assert.equal(criticalConditions({ ...s, activeId: 'dec' }, D('2027-01-02')).length, 1);
  assert.equal(criticalConditions(s, D('2027-01-03')).length, 0);
});

test('البنود بالمعرّف الثابت: إعادة التسمية لا تكسر المراقبة، والتعطيل يوقف التنبيه', () => {
  const renamed = [{ id: 'food', name: 'مطاعم', budget: 80 }, { id: 'fuel', name: 'سيارة', budget: 80 }];
  const s = st([month('m', '2026-11', [tx('food', 3, '2026-11-10')], renamed)]);
  assert.equal(criticalConditions(s, D('2026-11-10')).length, 1);
  const custom = [{ id: 'c9', name: 'أكل', budget: 100 }];
  assert.equal(resolveItem(st([month('m', '2026-11', [], custom)]), 'food', null), 'c9');
  const s2 = st([month('m', '2026-11', [tx('c7', 4, '2026-11-10'), tx('food', 9, '2026-11-10')], [...cats(), { id: 'c7', name: 'وجبات', budget: 100 }])], { foodItem: 'c7' });
  const [c] = criticalConditions(s2, D('2026-11-10'));
  assert.equal(c.itemId, 'c7'); assert.equal(c.spent, 4);
  assert.equal(criticalConditions(st(s2.months, { foodItem: 'c7', foodOn: false }), D('2026-11-10')).length, 0);
  assert.equal(criticalConditions(st(s2.months, { foodItem: 'c7', foodPct: 5 }), D('2026-11-10')).length, 0); // الحد 5.000
});

test('التنبيه الحرج: بلا تكرار، الحذف لا يعيد إنشاءه، والتصاعد بعد القراءة يُنشئ تنبيهاً جديداً', () => {
  const at = (a) => st([month('m', '2026-11', a.map((x, i) => tx('food', x, '2026-11-10', `f${i}`)))]);
  const today = D('2026-11-10');
  let s = syncNotifications(emptyNotifState(), criticalConditions(at([3]), today), 'T1');
  assert.equal(s.items.length, 1); assert.equal(unreadCritical(s), true);
  assert.equal(syncNotifications(s, criticalConditions(at([3]), today), 'T2'), s); // نفس الحالة
  // زيادة قبل القراءة: يُحدَّث التنبيه نفسه
  s = syncNotifications(s, criticalConditions(at([3, 1]), today), 'T3');
  assert.equal(s.items.length, 1); assert.match(s.items[0].desc, /1\.600/);
  s = markAllRead(s); assert.equal(unreadCritical(s), false);
  // زيادة بعد القراءة: تنبيه جديد
  s = syncNotifications(s, criticalConditions(at([3, 1, 0.5]), today), 'T4');
  assert.equal(s.items.length, 2); assert.equal(s.items[0].read, false); assert.match(s.items[0].desc, /2\.100/);
  // نقص التجاوز (تصحيح جزئي) لا يُنشئ شيئاً
  s = markAllRead(s);
  const s5 = syncNotifications(s, criticalConditions(at([3, 1]), today), 'T5');
  assert.equal(s5.items.length, 2); assert.equal(unreadCritical(s5), false);
  // الحذف لا يعيد الإنشاء لنفس الحالة
  const s6 = deleteNotification(s5, s5.items[0].id);
  assert.equal(syncNotifications(s6, criticalConditions(at([3, 1]), today), 'T6').items.length, 1);
  // التصحيح إلى ما دون الحد يزيل الحالة، وعودتها تنشئ تنبيهاً جديداً
  const s7 = syncNotifications(s6, criticalConditions(at([2]), today), 'T7');
  assert.deepEqual(Object.keys(s7.active), []);
  const s8 = syncNotifications(s7, criticalConditions(at([2, 1]), today), 'T8');
  assert.equal(s8.items.length, 2); assert.equal(unreadCritical(s8), true);
});

test('ترتيب العرض: الحرج القائم أولاً، وإخفاء الشريط حتى يزيد التجاوز', () => {
  let s = syncNotifications(emptyNotifState(), [{ key: 'spend:2026-11', kind: 'spend', level: 'bad', title: 'a', desc: '' }], 'T1');
  const fuel = (x) => [{ key: 'fuel:fuel:2026-11-08', kind: 'fuel', level: 'critical', escalate: x, title: 'b', desc: '', itemId: 'fuel' }];
  s = syncNotifications(s, [{ key: 'spend:2026-11', level: 'bad' }, ...fuel(1000)], 'T2');
  s = syncNotifications(s, [{ key: 'spend:2026-11', level: 'bad' }, { key: 'near:x', kind: 'near', level: 'warn', title: 'c', desc: '' }, ...fuel(1000)], 'T3');
  assert.deepEqual(displayOrder(s).map((i) => i.title), ['b', 'c', 'a']);
  s = hideBanner(s, 'fuel:fuel:2026-11-08');
  assert.equal(bannerHidden(s, fuel(1000)[0]), true);
  s = syncNotifications(s, [{ key: 'spend:2026-11', level: 'bad' }, ...fuel(2000)], 'T4');
  assert.equal(bannerHidden(s, fuel(2000)[0]), false);
  // حالة قديمة بلا peak/hidden تُقرأ بأمان
  assert.deepEqual(normalizeNotifState({ v: 1, items: [], active: {}, seq: 3 }).peak, {});
});

test('سجل الالتزام: مرات التجاوز وإجمالي التجاوز ومتوسط الفترات المكتملة', () => {
  const s = st([month('m', '2026-11', [
    tx('food', 3, '2026-11-08'), tx('food', 1, '2026-11-09'), tx('food', 5, '2026-11-10'),
    tx('fuel', 20, '2026-11-02'), tx('fuel', 10, '2026-11-09'),
  ])]);
  const h = criticalHistory(s, D('2026-11-10'));
  assert.equal(h.food.violations, 2); assert.equal(h.food.excess, 0.6 + 2.6);
  assert.equal(h.food.completed, 2); assert.equal(h.food.avg, 2); // (3 + 1) / 2 — اليوم الحالي غير مكتمل
  assert.equal(h.fuel.violations, 1); assert.equal(h.fuel.excess, 5); assert.equal(h.fuel.avg, 20);
  assert.equal(h.food.trend.length, 14); assert.equal(h.fuel.trend.length, 8);
  assert.ok(h.tips.some((t) => /ليس توفيراً مضموناً/.test(t)));
});
