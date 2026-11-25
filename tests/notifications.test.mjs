import test from 'node:test';
import assert from 'node:assert/strict';
import { computeConditions, syncNotifications, emptyNotifState, unreadCount, markAllRead, deleteNotification, clearNotifications, normalizeNotifState, MAX_ITEMS } from '../src/notifications.js';

const today = { y: 2026, m: 11, d: 10 };
const cat = (id, budget, extra = {}) => ({ id, name: id, group: 'daily', budget, account: 'x', ...extra });
const mk = (txs, extra = {}) => ({ id: 'cur', period: '2026-11', label: 'نوفمبر', salary: 760, carryIn: 0, incomes: [], sections: [{ id: 'daily', name: 'يومية' }], cards: [],
  categories: [cat('food', 400), cat('fun', 100), cat('rent', 300)], transactions: txs, ...extra });
const tx = (catId, amount, id = `${catId}${amount}`) => ({ id, catId, amount, date: '2026-11-02' });
const store = (txs, extra = {}) => ({ months: [mk(txs), { ...mk([tx('food', 999)]), id: 'old', period: '2026-10' }], debts: [], goals: [], settings: { spendLimit: 650, payDay: 23 }, ...extra });
const keys = (c) => c.map((x) => x.key).sort();

test('الحالات للشهر الجاري فقط (الشهر السابق لا يولّد تنبيهات)', () => {
  const c = computeConditions(store([tx('food', 100)]), today);
  assert.deepEqual(keys(c), []);
});

test('حد الإنفاق والعجز والتجاوز والاقتراب من النفاد', () => {
  const c = computeConditions(store([tx('food', 420), tx('fun', 85), tx('rent', 300)]), today);
  assert.deepEqual(keys(c), ['deficit:2026-11', 'near:2026-11:fun', 'over:2026-11:food', 'spend:2026-11']);
  const sp = c.find((x) => x.kind === 'spend');
  assert.match(sp.desc, /805\.000/); assert.match(sp.desc, /155\.000/);
});

test('موعد الراتب خلال 3 أيام أو اليوم فقط', () => {
  assert.equal(computeConditions(store([]), { y: 2026, m: 11, d: 19 }).length, 0);
  const c = computeConditions(store([]), { y: 2026, m: 11, d: 20 });
  assert.deepEqual(keys(c), ['salary:2026-11-23']);
  assert.equal(computeConditions(store([]), { y: 2026, m: 11, d: 23 })[0].title, 'اليوم موعد الراتب المجدول');
  assert.match(computeConditions(store([]), { y: 2026, m: 11, d: 23 })[0].desc, /ليس تأكيداً للإيداع/);
});

test('لا تكرار: نفس الحالة لا تُنشئ تنبيهاً جديداً عند كل مزامنة', () => {
  const conds = computeConditions(store([tx('food', 700)]), today);
  let s = syncNotifications(emptyNotifState(), conds, '2026-11-10T08:00:00Z');
  assert.equal(s.items.length, 2); assert.equal(unreadCount(s), 2);
  const again = syncNotifications(s, conds, '2026-11-10T09:00:00Z');
  assert.equal(again, s, 'نفس المرجع: لا تغيير ولا كتابة');
  s = markAllRead(s);
  assert.equal(unreadCount(s), 0);
  assert.equal(syncNotifications(s, conds, 'x'), s, 'القراءة لا تُعيد الإنشاء');
});

test('المحذوف لا يعود لنفس الحالة، والحالة المحلولة ثم المتكررة تُنشئ تنبيهاً جديداً', () => {
  const over = computeConditions(store([tx('food', 700)]), today);
  let s = syncNotifications(emptyNotifState(), over, 't1');
  const spendId = s.items.find((i) => i.kind === 'spend').id;
  s = deleteNotification(s, spendId);
  assert.equal(s.items.some((i) => i.kind === 'spend'), false);
  s = syncNotifications(s, over, 't2');
  assert.equal(s.items.some((i) => i.kind === 'spend'), false, 'لا يعود ما دامت الحالة قائمة');
  // الحالة تزول (حُذفت دفعة) ثم تعود
  s = syncNotifications(s, computeConditions(store([tx('food', 300)]), today), 't3');
  assert.equal(s.active['spend:2026-11'], undefined);
  s = syncNotifications(s, over, 't4');
  const back = s.items.find((i) => i.kind === 'spend');
  assert.ok(back && back.read === false && back.id !== spendId, 'تنبيه جديد بمعرّف جديد');
  assert.equal(s.items[0].at, 't4', 'الأحدث أولاً');
});

test('المسح لا يعيد الإنشاء، والسجل محدود، والتطبيع آمن', () => {
  const conds = computeConditions(store([tx('food', 700)]), today);
  let s = clearNotifications(syncNotifications(emptyNotifState(), conds, 't'));
  assert.equal(s.items.length, 0);
  assert.equal(syncNotifications(s, conds, 't2'), s);
  let big = emptyNotifState();
  for (let k = 0; k < MAX_ITEMS + 20; k++) big = syncNotifications(big, [{ key: `k${k}`, kind: 'x', level: 'info', title: 't', desc: 'd' }], `t${k}`);
  assert.equal(big.items.length, MAX_ITEMS);
  assert.deepEqual(normalizeNotifState(null), emptyNotifState());
  assert.deepEqual(normalizeNotifState(s), s, 'التطبيع متكرر بلا أثر');
});
