import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthSummary, itemStatus, monthAlerts, debtStatus, goalStatus, annualSeries, compareScenario, closingBalance, addMonths,
} from '../src/finance.js';

const cat = (id, budget, extra = {}) => ({ id, name: id, group: 'fixed', budget, account: 'salary', ...extra });
const tx = (catId, amount, date, id = `${catId}-${date}-${amount}`) => ({ id, catId, amount, date, account: 'salary' });
const month = (o = {}) => ({
  id: 'm1', period: '2026-11', label: 'نوفمبر', salary: 760, carryIn: 0, sections: [], cards: [],
  categories: [cat('rent', 120), cat('fuel', 80, { group: 'daily' }), cat('saving', 50), cat('emergency', 0, { group: 'emergency' })],
  transactions: [], ...o,
});

test('حالة البند: حدود 80٪ و100٪', () => {
  assert.equal(itemStatus(0, 0), 'idle');
  assert.equal(itemStatus(5, 0), 'bad');
  assert.equal(itemStatus(79, 100), 'good');
  assert.equal(itemStatus(80, 100), 'warn');
  assert.equal(itemStatus(100, 100), 'done');
  assert.equal(itemStatus(101, 100), 'bad');
});

test('ملخص الشهر: المخطط والمدفوع والمتبقي ونسبة التنفيذ', () => {
  const m = month({ transactions: [tx('rent', 120, '2026-11-01'), tx('fuel', 20, '2026-11-02'), tx('fuel', 10.5, '2026-11-03')] });
  const s = monthSummary(m, '2026-12-05'); // شهر منتهٍ
  assert.equal(s.planned, 250);
  assert.equal(s.paid, 150.5);
  assert.equal(s.balance, 609.5);
  assert.equal(s.plannedBalance, 510);
  const fuel = s.items.find((i) => i.id === 'fuel');
  assert.equal(fuel.planned, 80); assert.equal(fuel.paid, 30.5); assert.equal(fuel.remaining, 49.5);
  assert.ok(Math.abs(fuel.exec - 30.5 / 80) < 1e-9);
  assert.equal(s.toSpend, 0, 'الشهر المنتهي لا يتوقع مصروفات قادمة');
  assert.equal(s.forecast, s.balance);
});

test('التوقع: الالتزامات غير المدفوعة تُطرح من الرصيد', () => {
  const m = month({ transactions: [tx('rent', 120, '2026-11-01')] });
  const s = monthSummary(m, '2026-11-02'); // اليوم الثاني: لا إسقاط بالوتيرة بعد
  // غير مدفوع: بنزين 80 + ادخار 50 = 130
  assert.equal(s.unpaid, 130);
  assert.equal(s.balance, 640);
  assert.equal(s.forecast, 510);
});

test('التوقع: إسقاط المصاريف اليومية بحسب وتيرة الصرف', () => {
  // 30 يوماً في نوفمبر، اليوم العاشر، صُرف 40 على البنزين => الوتيرة 120 للشهر
  const m = month({ transactions: [tx('fuel', 40, '2026-11-05')] });
  const s = monthSummary(m, '2026-11-10');
  const fuel = s.items.find((i) => i.id === 'fuel');
  assert.equal(fuel.projected, 120);
  assert.equal(fuel.toSpend, 80);
  assert.equal(fuel.paceOver, 40);
  // الرصيد 720 − (إيجار 120 + بنزين 80 + ادخار 50) = 470
  assert.equal(s.forecast, 470);
});

test('الرصيد المرحّل يدخل في المتاح ويبقى الراتب مستقلاً', () => {
  const m = month({ carryIn: -17.5, transactions: [tx('rent', 120, '2026-11-01')] });
  const s = monthSummary(m, '2026-12-01');
  assert.equal(s.salary, 760);
  assert.equal(s.available, 742.5);
  assert.equal(s.balance, 622.5);
  assert.equal(closingBalance(m), 622.5);
});

test('العمليات على بنود محذوفة تبقى في المدفوع', () => {
  const m = month({ transactions: [tx('gone', 15, '2026-11-01')] });
  const s = monthSummary(m, '2026-12-01');
  assert.equal(s.paid, 15); assert.equal(s.orphanPaid, 15);
});

test('التنبيهات: 80٪ و100٪ والاستحقاق', () => {
  const m = month({
    categories: [cat('rent', 120, { dueDay: 25 }), cat('net', 30, { dueDay: 20 }), cat('fuel', 80, { group: 'daily' }), cat('fun', 40), cat('emergency', 0)],
    transactions: [tx('fuel', 66, '2026-11-02'), tx('fun', 45, '2026-11-03'), tx('emergency', 5, '2026-11-04')],
  });
  const a = monthAlerts(m, { months: [m], debts: [] }, '2026-11-23');
  const kinds = a.map((x) => `${x.kind}:${x.itemId}`);
  assert.ok(kinds.includes('near:fuel'));
  assert.ok(kinds.includes('over:fun'));
  assert.ok(kinds.includes('over:emergency'));
  assert.ok(kinds.includes('due:rent'), 'الإيجار مستحق بعد يومين');
  assert.ok(kinds.includes('overdue:net'), 'النت تأخر');
  assert.equal(a[0].level, 'bad', 'الأخطر أولاً');
});

test('الديون: الرصيد المتبقي والجدول وتاريخ الانتهاء', () => {
  const m1 = month({ id: 'a', period: '2026-10', transactions: [tx('debt', 100, '2026-10-01')] });
  const m2 = month({ id: 'b', period: '2026-11', transactions: [tx('debt', 100, '2026-11-01'), tx('debt', 50, '2026-09-30')] });
  const store = { months: [m1, m2] };
  const d = { id: 'd', name: 'قرض', opening: 1000, asOf: '2026-10-01', installment: 100, dueDay: 1, linkedCatId: 'debt' };
  const st = debtStatus(d, store, '2026-11-23');
  assert.equal(st.paidTotal, 200, 'دفعة 30 سبتمبر قبل تاريخ الرصيد فلا تُحسب');
  assert.equal(st.remaining, 800);
  assert.equal(st.installmentsLeft, 8);
  assert.equal(st.paidThisMonth, 100);
  assert.equal(st.next[0].date, '2026-12-01', 'قسط هذا الشهر مدفوع فيبدأ الجدول من الشهر القادم');
  assert.equal(st.endDate, '2027-07-01');
  // دفعة يدوية وقسط أخير جزئي
  const st2 = debtStatus({ ...d, payments: [{ date: '2026-11-10', amount: 750 }] }, store, '2026-11-23');
  assert.equal(st2.remaining, 50);
  assert.equal(st2.installmentsLeft, 1);
  assert.equal(st2.next[0].amount, 50);
});

test('أهداف الادخار: المحقق والمطلوب شهرياً', () => {
  const m = month({ transactions: [tx('saving', 50, '2026-11-01')] });
  const g = { id: 'g', name: 'طوارئ', target: 1000, start: 200, deadline: '2027-04', createdAt: '2026-11-01', linkedCatId: 'saving', contributions: [{ date: '2026-11-05', amount: 50 }] };
  const s = goalStatus(g, { months: [m] }, '2026-11-23');
  assert.equal(s.saved, 300);
  assert.equal(s.remaining, 700);
  assert.equal(s.monthsLeft, 6); // نوفمبر حتى أبريل
  assert.equal(s.monthly, 116.667);
  assert.equal(goalStatus({ ...g, target: 250 }, { months: [m] }, '2026-11-23').done, true);
});

test('التحليل السنوي: 12 شهراً والاتجاه وأكثر البنود', () => {
  const months = [];
  for (let k = 0; k < 7; k++) {
    const p = addMonths('2026-05', k);
    months.push(month({ id: `m${k}`, period: p, transactions: [tx('rent', 120, `${p}-01`), tx('fuel', 10 * (k + 1), `${p}-02`), tx('saving', 50, `${p}-03`)] }));
  }
  const r = annualSeries({ months }, '2026-11');
  assert.equal(r.rows.length, 12);
  assert.equal(r.rows.filter((x) => !x.empty).length, 7);
  assert.equal(r.rows[11].period, '2026-11');
  assert.equal(r.rows[11].paid, 240);
  assert.equal(r.rows[11].saved, 50);
  assert.equal(r.rows[11].surplus, 520);
  assert.equal(r.totals.saved, 350);
  assert.equal(r.trend, 30, 'متوسط آخر 3 أشهر أعلى بـ 30 من الثلاثة السابقة');
  assert.equal(r.top[0].id, 'rent');
});

test('السيناريو لا يغيّر البيانات ويحسب الفرق', () => {
  const m = month({ transactions: [tx('rent', 120, '2026-11-01')] });
  const before = JSON.stringify(m);
  const c = compareScenario(m, { salaryDelta: 100, budgets: { rent: 100 }, extras: [{ name: 'قسط سيارة', amount: 50 }] }, '2026-12-01');
  assert.equal(JSON.stringify(m), before, 'البيانات الأصلية لم تتغير');
  assert.equal(c.diff.salary, 100);
  assert.equal(c.diff.planned, 30);
  assert.equal(c.diff.plannedBalance, 70);
});
