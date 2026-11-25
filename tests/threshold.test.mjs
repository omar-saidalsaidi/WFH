import test from 'node:test';
import assert from 'node:assert/strict';
import { spendWarning, monthSummary } from '../src/finance.js';
import { normalizeSettings, fmt3 } from '../src/data.js';

test('حد التنبيه: 649.999 و650 عاديان، 650.001 و670 تحذير', () => {
  assert.deepEqual(spendWarning(649.999, 650), { over: false, excess: 0, limit: 650 });
  assert.deepEqual(spendWarning(650, 650), { over: false, excess: 0, limit: 650 });
  assert.deepEqual(spendWarning(650.001, 650), { over: true, excess: 0.001, limit: 650 });
  assert.deepEqual(spendWarning(670, 650), { over: true, excess: 20, limit: 650 });
  assert.equal(fmt3(20), '20.000'); assert.equal(fmt3(670), '670.000');
});

test('مبني على المصروف الفعلي فقط ومستقل عن الدخل الإضافي', () => {
  const m = { id: 'm', period: '2026-11', salary: 760, carryIn: 0, sections: [], cards: [], categories: [{ id: 'a', name: 'a', group: 'x', budget: 900, account: 'x' }],
    transactions: [{ id: 't1', catId: 'a', amount: 400.0005, date: '2026-11-01' }, { id: 't2', catId: 'a', amount: 250, date: '2026-11-02' }] };
  const base = monthSummary(m, '2026-12-01');
  const withIncome = monthSummary({ ...m, incomes: [{ id: 'i', name: 'مكافأة', amount: 500, date: '2026-11-03' }] }, '2026-12-01');
  assert.equal(spendWarning(base.paid).over, true, 'المخصصات الكبيرة لا تؤثر: المعتبر المدفوع فعلاً');
  assert.deepEqual(spendWarning(withIncome.paid), spendWarning(base.paid), 'الدخل الإضافي لا يرفع الحد');
});

test('إعداد الحد: افتراضي 650، قيم غير صالحة تُرفض، وثلاث منازل', () => {
  assert.equal(normalizeSettings({}).spendLimit, 650);
  assert.equal(normalizeSettings({ spendLimit: 700.1234 }).spendLimit, 700.123);
  assert.equal(normalizeSettings({ spendLimit: -5 }).spendLimit, 650);
  assert.equal(normalizeSettings({ spendLimit: 'abc' }).spendLimit, 650);
});
