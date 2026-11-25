import test from 'node:test';
import assert from 'node:assert/strict';
import { sortItems, itemState } from '../src/sorting.js';
import { normalizeSettings } from '../src/data.js';

const it = (id, planned, paid) => ({ id, planned, paid });
const ids = (l) => l.map((x) => x.id).join(',');

test('مثال الطلب: المستحقة بالمخصص تنازلياً ثم المكتملة', () => {
  const items = [it('internet', 25, 25), it('fuel', 80, 20), it('rent', 150, 150), it('land', 300, 150), it('groceries', 100, 40)];
  assert.equal(ids(sortItems(items, 'smart')), 'land,groceries,fuel,rent,internet');
  assert.equal(ids(items), 'internet,fuel,rent,land,groceries', 'لا يغيّر القائمة الأصلية');
});

test('المتجاوزة بعد المستحقة وقبل المكتملة، والترتيب مستقر عند التساوي', () => {
  const items = [it('a', 50, 50), it('b', 50, 10), it('c', 50, 60), it('d', 50, 20), it('e', 100, 120), it('f', 0, 0), it('g', 0, 5)];
  assert.equal(ids(sortItems(items, 'smart')), 'b,d,e,c,g,a,f');
  assert.equal(itemState(80, 80.0001), 'done', 'دقة البيسة');
  assert.equal(itemState(80, 80.001), 'over');
});

test('أنماط الترتيب الأخرى واليدوي', () => {
  const items = [it('x', 10, 0), it('y', 80, 70), it('z', 80, 0)];
  assert.equal(ids(sortItems(items, 'budget')), 'y,z,x');
  assert.equal(ids(sortItems(items, 'remaining')), 'z,x,y');
  assert.equal(ids(sortItems(items, 'manual')), 'x,y,z');
});

test('إعدادات افتراضية متوافقة مع البيانات القديمة', () => {
  assert.deepEqual(normalizeSettings(undefined), { cardColors: { salary: null, balance: null }, payDay: 23, sortModes: {} });
  assert.equal(normalizeSettings({ payDay: 40 }).payDay, 23);
  assert.equal(normalizeSettings({ payDay: 5, cardColors: { salary: '#245B91' } }).cardColors.salary, '#245B91');
  const s = normalizeSettings({ payDay: 5, sortModes: { daily: 'manual' } });
  assert.deepEqual(normalizeSettings(s), s, 'تكرار التطبيع لا يغيّر شيئاً');
});
