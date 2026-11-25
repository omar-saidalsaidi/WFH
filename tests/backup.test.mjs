import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, validateBackup, checksum } from '../src/backup.js';
import { normalizeStore, defaultState } from '../src/data.js';

const sampleStore = () => normalizeStore({
  months: [{
    id: 'm1', period: '2026-11', label: 'راتب شهر نوفمبر 2026', salary: 760, ...defaultState(),
    transactions: [{ id: 't1', catId: 'fuel', account: 'applepay', amount: 12.5, date: '2026-11-03', note: 'شل', created: 1 }],
  }],
  activeId: 'm1',
  debts: [{ id: 'd1', name: 'قرض', opening: 1000, installment: 100, dueDay: 1, asOf: '2026-11-01' }],
  goals: [{ id: 'g1', name: 'طوارئ', target: 500, start: 0, contributions: [] }],
});

test('النسخ والاستعادة: الرحلة الكاملة تحفظ البيانات كما هي', () => {
  const store = sampleStore();
  const b = makeBackup(store);
  const r = validateBackup(JSON.stringify(b));
  assert.equal(r.ok, true, r.errors.join(' | '));
  assert.deepEqual(r.store, store);
  assert.deepEqual(r.stats, { months: 1, transactions: 1, debts: 1, goals: 1, exportedAt: b.exportedAt });
});

test('اكتشاف التعديل أو التلف عبر البصمة', () => {
  const b = makeBackup(sampleStore());
  b.data.months[0].transactions[0].amount = 99;
  const r = validateBackup(b);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /بصمة/);
});

test('رفض الملفات غير الصالحة', () => {
  assert.equal(validateBackup('not json').ok, false);
  assert.equal(validateBackup({ months: [] }).ok, false);
  const s = sampleStore();
  s.months[0].transactions.push({ id: 't2', catId: 'food', amount: -3, date: '2026-11-04' });
  const r = validateBackup(s);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /العملية 2/);
  const dup = sampleStore(); dup.months.push({ ...dup.months[0] });
  assert.match(validateBackup(dup).errors.join(' '), /مكرر/);
});

test('قبول بيانات بلا غلاف مع تحذير', () => {
  const r = validateBackup(sampleStore());
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
});

test('التطبيع يضيف الحقول الناقصة دون تغيير العمليات', () => {
  const old = { months: [{ id: 'x', period: '2026-11', label: 'نوفمبر', salary: 760, categories: [{ id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' }], transactions: [{ id: 't', catId: 'rent', amount: 120, date: '2026-11-01', account: 'salary' }] }], activeId: 'x' };
  const before = JSON.stringify(old.months[0].transactions);
  const n = normalizeStore(old);
  assert.equal(JSON.stringify(n.months[0].transactions), before);
  assert.equal(n.months[0].carryIn, 0);
  assert.equal(n.months[0].sections.length, 4);
  assert.equal(n.months[0].cards.length, 4);
  assert.deepEqual(n.debts, []); assert.deepEqual(n.goals, []);
  assert.equal(n.schemaVersion, 6);
  assert.deepEqual(n.months[0].incomes, []);
});

test('البصمة ثابتة', () => {
  assert.equal(checksum('abc'), checksum('abc'));
  assert.notEqual(checksum('abc'), checksum('abd'));
});
