import test from 'node:test';
import assert from 'node:assert/strict';
import { applySectionOp, applyToMonth, countItems, countPayments, sectionKind } from '../src/sections.js';
import { monthSummary } from '../src/finance.js';

const secs = () => [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'يومية' }, { id: 'temp', name: 'مؤقتة' }];
const cats = () => [
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' },
  { id: 'food', name: 'أكل', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'fuel', name: 'بنزين', group: 'daily', budget: 80, account: 'applepay' },
];
const month = (id, period, tx = []) => ({ id, period, label: id, salary: 760, carryIn: 0, sections: secs(), cards: [], categories: cats(), transactions: tx });
const store = () => ({
  months: [
    month('oct', '2026-10', [{ id: 'o1', catId: 'food', amount: 50, date: '2026-10-03' }]),
    month('nov', '2026-11', [{ id: 'n1', catId: 'food', amount: 30, date: '2026-11-03' }, { id: 'n2', catId: 'fuel', amount: 20, date: '2026-11-04' }]),
    month('dec', '2026-12'),
  ],
  activeId: 'nov', debts: [], goals: [],
});

test('عدد البنود والعمليات لكل فئة', () => {
  const m = store().months[1];
  assert.equal(countItems(m, 'daily'), 2);
  assert.equal(countPayments(m, 'daily'), 2);
  assert.equal(countItems(m, 'temp'), 0);
});

test('الإضافة والتسمية والتلوين: الشهر الحالي فقط لا يمس غيره', () => {
  let s = store();
  s = applySectionOp(s, { type: 'add', section: { id: 'sec_x', name: 'هدايا' } }, 'current').store;
  s = applySectionOp(s, { type: 'rename', id: 'daily', name: 'المصاريف اليومية' }, 'current').store;
  s = applySectionOp(s, { type: 'recolor', id: 'daily', color: 'mint' }, 'current').store;
  const [oct, nov, dec] = s.months;
  assert.equal(nov.sections.length, 4);
  assert.equal(nov.sections.find((x) => x.id === 'daily').name, 'المصاريف اليومية');
  assert.equal(nov.sections.find((x) => x.id === 'daily').color, 'mint');
  assert.equal(dec.sections.length, 3, 'الشهر اللاحق لم يتغير');
  assert.equal(oct.sections.find((x) => x.id === 'daily').name, 'يومية', 'الشهر السابق لم يتغير');
});

test('النطاق forward يطبّق على اللاحق ولا يمس السابق أبداً', () => {
  const r = applySectionOp(store(), { type: 'rename', id: 'daily', name: 'يومي' }, 'forward');
  const [oct, nov, dec] = r.store.months;
  assert.equal(nov.sections[1].name, 'يومي');
  assert.equal(dec.sections[1].name, 'يومي');
  assert.equal(oct.sections[1].name, 'يومية');
  assert.deepEqual(r.applied, ['nov', 'dec']);
});

test('إعادة الترتيب', () => {
  const r = applySectionOp(store(), { type: 'reorder', order: ['temp', 'fixed', 'daily'] }, 'current');
  assert.deepEqual(r.store.months[1].sections.map((x) => x.id), ['temp', 'fixed', 'daily']);
});

test('حذف فئة فيها بنود يتطلب نقلها، والعمليات تبقى مرتبطة', () => {
  const s = store();
  const before = monthSummary(s.months[1], '2026-12-01');
  const blocked = applySectionOp(s, { type: 'delete', id: 'daily' }, 'current');
  assert.equal(blocked.applied.length, 0);
  assert.match(blocked.skipped[0].note, /نقل/);
  assert.equal(blocked.store.months[1].sections.length, 3, 'لم يُحذف شيء');

  const r = applySectionOp(s, { type: 'delete', id: 'daily', moveTo: 'temp' }, 'current');
  const nov = r.store.months[1];
  assert.equal(nov.sections.some((x) => x.id === 'daily'), false);
  assert.deepEqual(nov.categories.filter((c) => c.group === 'temp').map((c) => c.id), ['food', 'fuel']);
  assert.deepEqual(nov.transactions, s.months[1].transactions, 'العمليات لم تتغير');
  const after = monthSummary(nov, '2026-12-01');
  assert.equal(after.paid, before.paid); assert.equal(after.planned, before.planned); assert.equal(after.orphanPaid, 0, 'لا عمليات يتيمة');
});

test('حذف فئة فارغة، ومنع حذف آخر فئة', () => {
  const r = applySectionOp(store(), { type: 'delete', id: 'temp' }, 'current');
  assert.equal(r.store.months[1].sections.length, 2);
  const one = { ...month('x', '2026-11'), sections: [{ id: 'only', name: 'وحيدة' }], categories: [] };
  assert.equal(applyToMonth(one, { type: 'delete', id: 'only' }).applied, false);
});

test('حذف في الأشهر اللاحقة: تتخطى الشهر الذي لا توجد فيه الفئة الهدف', () => {
  let s = store();
  s = applySectionOp(s, { type: 'add', section: { id: 'sec_new', name: 'جديدة' } }, 'current').store; // نوفمبر فقط
  const r = applySectionOp(s, { type: 'delete', id: 'daily', moveTo: 'sec_new' }, 'forward');
  assert.deepEqual(r.applied, ['nov']);
  assert.equal(r.skipped[0].label, 'dec');
  assert.equal(r.store.months[2].sections.some((x) => x.id === 'daily'), true, 'ديسمبر لم يفقد بنوده');
});

test('نوع الفئة الافتراضي', () => {
  assert.equal(sectionKind({ id: 'fixed' }), 'fixed');
  assert.equal(sectionKind({ id: 'temp' }), 'fixed');
  assert.equal(sectionKind({ id: 'daily' }), 'flexible');
  assert.equal(sectionKind({ id: 'sec_1', kind: 'fixed' }), 'fixed');
});

test('البنود: إضافة وتسمية وترتيب ضمن الفئة', () => {
  let s = store();
  s = applySectionOp(s, { type: 'addItem', item: { id: 'c_x', name: 'قهوة', group: 'daily', budget: 15, account: 'applepay' } }, 'current').store;
  s = applySectionOp(s, { type: 'updateItem', id: 'food', patch: { name: 'الأكل والمطاعم' } }, 'forward').store;
  s = applySectionOp(s, { type: 'reorderItems', group: 'daily', order: ['c_x', 'fuel', 'food'] }, 'current').store;
  const nov = s.months[1];
  assert.deepEqual(nov.categories.map((c) => c.id), ['rent', 'c_x', 'fuel', 'food'], 'بنود الفئات الأخرى في مكانها');
  assert.equal(nov.categories.find((c) => c.id === 'food').name, 'الأكل والمطاعم');
  assert.equal(s.months[2].categories.find((c) => c.id === 'food').name, 'الأكل والمطاعم', 'الشهر اللاحق');
  assert.equal(s.months[0].categories.find((c) => c.id === 'food').name, 'أكل', 'الشهر السابق لم يتغير');
  assert.equal(s.months[2].categories.some((c) => c.id === 'c_x'), false, 'الإضافة للشهر الحالي فقط');
});

test('حذف بند له عمليات يتحول إلى أرشفة، والبند بلا عمليات يُحذف', () => {
  const s = store();
  const r = applySectionOp(s, { type: 'deleteItem', id: 'food' }, 'current');
  const nov = r.store.months[1];
  assert.equal(r.archived, 1);
  assert.equal(nov.categories.find((c) => c.id === 'food').archived, true);
  assert.deepEqual(nov.transactions, s.months[1].transactions);
  const sum = monthSummary(nov, '2026-11-10');
  assert.equal(sum.paid, 50); assert.equal(sum.orphanPaid, 0, 'لا عمليات يتيمة');
  const food = sum.items.find((i) => i.id === 'food');
  assert.equal(food.planned, 30, 'المؤرشف لا يحجز باقي مخصصه');
  const r2 = applySectionOp(s, { type: 'deleteItem', id: 'rent' }, 'current');
  assert.equal(r2.store.months[1].categories.some((c) => c.id === 'rent'), false);
  const back = applySectionOp(r.store, { type: 'archiveItem', id: 'food', archived: false }, 'current');
  assert.equal(monthSummary(back.store.months[1], '2026-11-10').items.find((i) => i.id === 'food').planned, 80, 'الاستعادة تعيد المخصص');
});

test('أرشفة فئة فيها عمليات بدل حذفها', () => {
  const s = store();
  const r = applySectionOp(s, { type: 'archiveSection', id: 'daily', archived: true }, 'current');
  const nov = r.store.months[1];
  assert.equal(nov.sections.find((x) => x.id === 'daily').archived, true);
  assert.equal(nov.categories.length, 3);
  const sum = monthSummary(nov, '2026-11-10');
  assert.equal(sum.paid, 50);
  assert.equal(sum.planned, 120 + 30 + 20, 'باقي مخصصات الفئة المؤرشفة غير محجوز');
});
