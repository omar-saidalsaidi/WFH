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
