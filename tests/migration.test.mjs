import test from 'node:test';
import assert from 'node:assert/strict';

// localStorage وهمي لاختبار ترحيل البيانات القديمة
const mem = {};
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { loadStore, STORE_KEY, STORAGE_KEY } = await import('../src/data.js');

test('ترحيل بيانات الإصدار 3 إلى شهر واحد دون تغيير العمليات', () => {
  for (const k of Object.keys(mem)) delete mem[k];
  const txs = [{ id: 'a', catId: 'rent', account: 'salary', amount: 120, date: '2026-11-02', created: 1 }];
  mem[STORAGE_KEY] = JSON.stringify({ categories: [{ id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' }], transactions: txs });
  const st = loadStore();
  assert.equal(st.months.length, 1);
  assert.deepEqual(st.months[0].transactions, txs);
  assert.equal(st.months[0].carryIn, 0);
});

test('ترحيل بيانات الإصدار 4 (أشهر بلا ديون أو أهداف أو رصيد مرحّل)', () => {
  for (const k of Object.keys(mem)) delete mem[k];
  const v4 = { months: [
    { id: 'm1', period: '2026-11', label: 'نوفمبر', salary: 850, sections: [], cards: [], categories: [], transactions: [{ id: 't', catId: 'x', amount: 5, date: '2026-11-01' }] },
    { id: 'm2', period: '2026-12', label: 'ديسمبر', salary: 850, sections: [], cards: [], categories: [], transactions: [] },
  ], activeId: 'm1' };
  mem[STORE_KEY] = JSON.stringify(v4);
  const st = loadStore();
  assert.equal(st.activeId, 'm1');
  assert.equal(st.months[0].salary, 850);
  assert.deepEqual(st.months[0].transactions, v4.months[0].transactions);
  assert.deepEqual(st.debts, []);
  assert.equal(st.months[1].carryIn, 0);
});

test('ترقية الإصدار 5 إلى 6: نسخة احتياطية ثابتة، دخل إضافي فارغ، وترحيل متكرر بلا تغيير', async () => {
  const { normalizeStore, backupKeyFor, monthFromTemplate } = await import('../src/data.js');
  for (const k of Object.keys(mem)) delete mem[k];
  const v5 = { schemaVersion: 5, debts: [{ id: 'd', name: 'قرض', opening: 500 }], goals: [], activeId: 'm1', months: [
    { id: 'm1', period: '2026-11', label: 'نوفمبر', salary: 760, carryIn: 12, sections: [{ id: 'fixed', name: 'ثابتة', color: 'mint' }], cards: [], categories: [{ id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' }],
      transactions: [{ id: 't1', catId: 'rent', amount: 120, date: '2026-11-01' }, { id: 't2', catId: 'rent', amount: 0.5, date: '2026-11-02' }] },
  ] };
  const raw = JSON.stringify(v5);
  mem[STORE_KEY] = raw;
  const st = loadStore();
  assert.equal(st.schemaVersion, 6);
  assert.equal(mem[backupKeyFor(5)], raw, 'النسخة الاحتياطية هي النص الأصلي حرفياً');
  assert.deepEqual(st.months[0].incomes, []);
  assert.deepEqual(st.months[0].transactions, v5.months[0].transactions, 'لا عمليات مكررة أو معدلة');
  assert.equal(st.months[0].carryIn, 12);
  assert.equal(st.months[0].sections[0].color, 'mint', 'الألوان السابقة محفوظة');
  assert.deepEqual(st.debts, v5.debts);
  // ترحيل متكرر (idempotent)
  assert.deepEqual(normalizeStore(st), st);
  mem[STORE_KEY] = JSON.stringify(st);
  const again = loadStore();
  assert.deepEqual(again, st);
  assert.equal(mem[backupKeyFor(5)], raw, 'لم تُستبدل النسخة الاحتياطية');
  // شهر جديد: لا يُنسخ إلا الدخل المتكرر، ولا يتغير الشهر السابق
  const m = { ...st.months[0], incomes: [
    { id: 'i1', name: 'مكافأة', amount: 100, date: '2026-11-15', recurring: false },
    { id: 'i2', name: 'إيجار ملحق', amount: 60, date: '2026-11-05', recurring: true },
  ] };
  const next = monthFromTemplate(m, '2026-12');
  assert.equal(next.incomes.length, 1);
  assert.equal(next.incomes[0].name, 'إيجار ملحق');
  assert.equal(next.incomes[0].date, '2026-12-05');
  assert.notEqual(next.incomes[0].id, 'i2');
  assert.equal(next.sections[0].color, 'mint', 'الألوان تُنقل للشهر الجديد');
  assert.equal(m.incomes.length, 2, 'الشهر السابق لم يتغير');
});
