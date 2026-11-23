import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSpending, suggestCut, ruleEngine } from '../src/insights.js';

const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'يومية' }];
const cats = [
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' },
  { id: 'saving', name: 'الادخار', group: 'fixed', budget: 50, account: 'salary' },
  { id: 'food', name: 'الأكل والمطاعم', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'fuel', name: 'بنزين', group: 'daily', budget: 80, account: 'applepay' },
];
let n = 0;
const tx = (catId, amount, date, note = '') => ({ id: `t${n++}`, catId, amount, date, note, account: 'x' });
const month = (period, txs, extra = {}) => ({ id: period, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, sections, cards: [], categories: cats, transactions: txs, ...extra });

test('لا مصروفات: حالة فارغة بلا استنتاجات', () => {
  const r = analyzeSpending({ months: [month('2026-11', [])] }, { today: '2026-11-23' });
  assert.equal(r.status, 'empty');
  assert.match(r.message, /لا توجد مصروفات/);
  assert.equal(r.items, undefined);
});

test('مثال الطلب: ميزانية 80 ومصروف 110 => تجاوز 30 (37.5٪) وخفض 20 و240 سنوياً', () => {
  const r = analyzeSpending({ months: [month('2026-10', [tx('food', 60, '2026-10-02'), tx('food', 50, '2026-10-20')])] }, { today: '2026-11-05' });
  const f = r.items.find((x) => x.id === 'food');
  assert.equal(f.planned, 80); assert.equal(f.paid, 110); assert.equal(f.excess, 30);
  assert.equal(Math.round(f.excessPct * 1000) / 10, 37.5);
  assert.equal(f.cut, 20); assert.equal(f.annual, 240);
  assert.match(f.tips[0], /بنسبة 37.5٪/);
  assert.match(f.tips[0], /20 ر.ع شهرياً/);
  assert.match(f.tips[0], /240 ر.ع سنوياً/);
  assert.equal(r.summary.monthlySaving, 20);
  assert.equal(r.status, 'limited', 'شهر مكتمل واحد فقط');
  assert.match(r.notes[0], /شهر مكتمل واحد/);
});

test('بيانات غير كافية: الشهر الحالي فقط لا يولّد اتجاهات', () => {
  const r = analyzeSpending({ months: [month('2026-11', [tx('fuel', 30, '2026-11-03')])] }, { today: '2026-11-10' });
  assert.equal(r.status, 'limited');
  assert.equal(r.completedMonths, 0);
  assert.match(r.notes[0], /لا يوجد شهر مكتمل/);
  assert.ok(r.items.every((x) => x.trend === null));
});

test('الالتزامات الثابتة والادخار لا يُقترح تخفيضها', () => {
  const r = analyzeSpending({ months: [month('2026-10', [tx('rent', 135, '2026-10-01'), tx('saving', 50, '2026-10-01')])] }, { today: '2026-11-05' });
  const rent = r.items.find((x) => x.id === 'rent');
  assert.equal(rent.kind, 'fixed'); assert.equal(rent.cut, 0); assert.equal(rent.status, 'warn');
  assert.match(rent.tips[0], /الالتزام الثابت/);
  const sv = r.items.find((x) => x.id === 'saving');
  assert.equal(sv.kind, 'saving'); assert.equal(sv.cut, 0);
  assert.equal(r.summary.monthlySaving, 0);
});

test('عدة أشهر: تكرار التجاوز والزيادة غير المعتادة والملاحظات المتكررة', () => {
  const months = [
    month('2026-08', [tx('food', 90, '2026-08-05'), tx('fuel', 40, '2026-08-05')]),
    month('2026-09', [tx('food', 95, '2026-09-05'), tx('fuel', 40, '2026-09-05')]),
    month('2026-10', [tx('food', 70, '2026-10-05'), tx('fuel', 60, '2026-10-05', 'قهوة'), tx('fuel', 2, '2026-10-06', 'قهوة'), tx('fuel', 2, '2026-10-07', 'قهوة')]),
  ];
  const r = analyzeSpending({ months }, { today: '2026-11-02' });
  assert.equal(r.status, 'ok');
  const food = r.items.find((x) => x.id === 'food');
  assert.equal(food.overMonths, 2);
  assert.ok(food.tips.some((t) => /تكرر في 2 من 3/.test(t)));
  const fuel = r.items.find((x) => x.id === 'fuel');
  assert.equal(fuel.status, 'trend');
  assert.equal(fuel.trend.change, 24); // 64 مقابل متوسط 40
  assert.equal(fuel.cut, 10); // نصف الزيادة 12 => أقرب 5 للأسفل
  assert.ok(fuel.recurring.length === 1 && fuel.recurring[0].note === 'قهوة' && fuel.recurring[0].count === 3);
  assert.equal(r.summary.month, 'راتب شهر 2026-10');
});

test('مخصص غير مستغل يُقترح خفضه دون احتسابه توفيراً من الصرف', () => {
  const months = [
    month('2026-09', [tx('fuel', 20, '2026-09-05')]),
    month('2026-10', [tx('fuel', 24, '2026-10-05')]),
  ];
  const fuel = analyzeSpending({ months }, { today: '2026-11-02' }).items.find((x) => x.id === 'fuel');
  assert.equal(fuel.status, 'underused');
  assert.equal(fuel.cut, 0);
  assert.equal(fuel.freed, 55); // 80 − 25 (أعلى صرف 24 مقرباً لأعلى 5)
});

test('الخفض المقترح لا يتجاوز ربع متوسط الصرف', () => {
  assert.equal(suggestCut(30, 110), 20);
  assert.equal(suggestCut(100, 100), 25);
  assert.equal(suggestCut(3, 40), 2);
  assert.equal(suggestCut(0, 50), 0);
});

test('المحرك يعمل محلياً ولا يغيّر البيانات', () => {
  const s = { months: [month('2026-10', [tx('food', 100, '2026-10-02')])] };
  const before = JSON.stringify(s);
  analyzeSpending(s, { today: '2026-11-05' });
  assert.equal(JSON.stringify(s), before);
  assert.equal(ruleEngine.local, true);
});

test('الشهر الجاري الناقص لا يخفي تجاوز الشهر المكتمل، والتجاوز الجاري المؤكد يُعرض', () => {
  const months = [
    month('2026-10', [tx('food', 110, '2026-10-02')]),
    month('2026-11', [tx('fuel', 10, '2026-11-02'), tx('food', 5, '2026-11-03')]),
  ];
  const r = analyzeSpending({ months }, { today: '2026-11-05' });
  const food = r.items.find((x) => x.id === 'food');
  assert.equal(food.month, 'راتب شهر 2026-10', 'المرجع آخر شهر مكتمل');
  assert.equal(food.excess, 30);
  const months2 = [months[0], month('2026-11', [tx('food', 95, '2026-11-03')])];
  const food2 = analyzeSpending({ months: months2 }, { today: '2026-11-05' }).items.find((x) => x.id === 'food');
  assert.equal(food2.month, 'راتب شهر 2026-11'); assert.equal(food2.current, true); assert.equal(food2.excess, 15);
  assert.match(food2.tips[0], /حتى الآن/);
});

test('الملخص يستخدم آخر شهر مكتمل عند وجود شهر جارٍ', () => {
  const months = [
    month('2026-09', [tx('food', 90, '2026-09-02'), tx('rent', 120, '2026-09-01')]),
    month('2026-10', [tx('food', 110, '2026-10-02'), tx('rent', 120, '2026-10-01')]),
    month('2026-11', [tx('food', 10, '2026-11-02')]),
  ];
  const r = analyzeSpending({ months }, { today: '2026-11-05' });
  assert.equal(r.summary.month, 'راتب شهر 2026-10');
  assert.equal(r.summary.current, false);
  assert.equal(r.summary.overCount, 1);
  assert.equal(r.summary.overTotal, 30);
  assert.equal(r.summary.flexiblePaid, 110);
  assert.equal(r.summary.fixedPaid, 120);
  assert.equal(r.summary.paid, 230);
  assert.ok(r.notes.some((n) => /آخر شهر مكتمل/.test(n)));
});
