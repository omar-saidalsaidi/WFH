import test from 'node:test';
import assert from 'node:assert/strict';
import { monthSummary, remainingInfo, pctLabel, closingBalance, sumOMR, annualSeries } from '../src/finance.js';

const cat = (id, budget, group = 'daily') => ({ id, name: id, group, budget, account: 'applepay' });
const tx = (catId, amount, date = '2026-11-03', id = `${catId}-${amount}-${Math.random()}`) => ({ id, catId, amount, date });
const inc = (name, amount, extra = {}) => ({ id: `i-${name}`, name, amount, date: '2026-11-10', note: '', recurring: false, ...extra });
const month = (o = {}) => ({ id: 'm', period: '2026-11', label: 'نوفمبر', salary: 760, carryIn: 0, incomes: [], sections: [], cards: [], categories: [cat('fuel', 80), cat('food', 570)], transactions: [], ...o });

test('مثال الطلب: 760 + 150 = 910، مصروف 650 => رصيد 260', () => {
  const m = month({ incomes: [inc('مكافأة', 100), inc('دخل آخر', 50)], transactions: [tx('fuel', 80), tx('food', 570)] });
  const s = monthSummary(m, '2026-12-01');
  assert.equal(s.salary, 760, 'الراتب الأساسي لم يتغير');
  assert.equal(s.extraIncome, 150);
  assert.equal(s.totalIncome, 910);
  assert.equal(s.paid, 650);
  assert.equal(s.balance, 260);
  assert.equal(closingBalance(m), 260);
});

test('المتبقي بعد المخصصات منفصل عن الرصيد الفعلي ولا يخصم مرتين', () => {
  // مخطط 650، مدفوع 100 فقط على البنزين (ضمن مخصصه 80؟ لا: 100 > 80)
  const m = month({ transactions: [tx('fuel', 100)] });
  const s = monthSummary(m, '2026-11-05');
  assert.equal(s.balance, 660, 'الفعلي: 760 − 100');
  // الملتزم به: بنزين max(80,100)=100 + أكل max(570,0)=570 = 670 => 760 − 670 = 90
  assert.equal(s.afterAllocations, 90);
  // عملية لبند محذوف تُحتسب مرة واحدة
  const s2 = monthSummary(month({ transactions: [tx('gone', 10)] }), '2026-11-05');
  assert.equal(s2.afterAllocations, 760 - 650 - 10);
});

test('النسبة المتبقية: 100، 75، 50، 20، 0، وسالبة', () => {
  const cases = [[0, 100, 'good'], [20, 75, 'good'], [40, 50, 'warn'], [64, 20, 'low'], [80, 0, 'zero'], [100, -25, 'over']];
  for (const [paid, pct, tone] of cases) {
    const r = remainingInfo(80, paid);
    assert.equal(Math.round(r.pct * 1000) / 1000, pct, `مصروف ${paid}`);
    assert.equal(r.tone, tone, `حالة ${paid}`);
    assert.ok(r.bar >= 0 && r.bar <= 100, 'عرض الشريط ضمن 0..100');
  }
  const ex = remainingInfo(80, 20); // مثال بنزين السيارة
  assert.equal(ex.remaining, 60); assert.equal(ex.pct, 75); assert.equal(ex.bar, 75);
  const over = remainingInfo(80, 100);
  assert.equal(over.bar, 0, 'لا عرض سالب للشريط'); assert.equal(over.over, 20);
  assert.equal(remainingInfo(80, 50.4).tone, 'warn'); // 37٪
  assert.equal(remainingInfo(80, 39.2).tone, 'good'); // 51٪
  assert.equal(pctLabel(37.5), '37.5٪'); assert.equal(pctLabel(-25), '-25٪');
});

test('بند بلا مخصص: لا قسمة على صفر', () => {
  const a = remainingInfo(0, 0); assert.equal(a.pct, null); assert.equal(a.tone, 'none');
  const b = remainingInfo(0, 12.5); assert.equal(b.pct, null); assert.equal(b.tone, 'unbudgeted'); assert.equal(b.over, 12.5);
  assert.equal(pctLabel(null), null);
});

test('دقة ثلاث منازل عشرية دون أخطاء الفاصلة العائمة', () => {
  assert.equal(sumOMR([0.1, 0.2]), 0.3);
  assert.equal(sumOMR([1.005, 2.335, 0.001]), 3.341);
  const m = month({ salary: 760.125, incomes: [inc('بدل', 0.1), inc('عائد', 0.2)], transactions: [tx('fuel', 0.7), tx('fuel', 0.1), tx('food', 33.333)] });
  const s = monthSummary(m, '2026-12-01');
  assert.equal(s.extraIncome, 0.3);
  assert.equal(s.paid, 34.133);
  assert.equal(s.balance, 726.292);
  assert.equal(s.items.find((i) => i.id === 'fuel').paid, 0.8);
});

test('الدخل الإضافي مستقل لكل شهر ويدخل في التحليل السنوي', () => {
  const a = month({ id: 'a', period: '2026-10', incomes: [inc('مكافأة', 100)], transactions: [tx('fuel', 50, '2026-10-02')] });
  const b = month({ id: 'b', period: '2026-11', transactions: [tx('fuel', 50)] });
  const r = annualSeries({ months: [a, b] }, '2026-11');
  const oct = r.rows.find((x) => x.period === '2026-10');
  const nov = r.rows.find((x) => x.period === '2026-11');
  assert.equal(oct.extra, 100); assert.equal(oct.income, 860); assert.equal(oct.surplus, 810);
  assert.equal(nov.extra, 0); assert.equal(nov.surplus, 710);
  assert.equal(r.totals.extra, 100);
});
