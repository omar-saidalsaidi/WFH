import test from 'node:test';
import assert from 'node:assert/strict';
import { salaryCountdown, todayIn, msUntilMidnight, iso } from '../src/schedule.js';

const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return { y, m, d: dd }; };
const cd = (s, day) => salaryCountdown(d(s), day);

test('قبل يوم الصرف: حتى 23 من الشهر نفسه', () => {
  const c = cd('2026-11-05');
  assert.equal(c.daysLeft, 18); assert.equal(iso(c.next), '2026-11-23'); assert.equal(iso(c.prev), '2026-10-23'); assert.equal(c.isToday, false);
});

test('يوم الصرف: صفر أيام و«اليوم»', () => {
  const c = cd('2026-11-23');
  assert.equal(c.daysLeft, 0); assert.equal(c.isToday, true); assert.equal(iso(c.prev), '2026-10-23'); assert.equal(c.progress, 1);
});

test('بعد يوم الصرف: حتى 23 من الشهر القادم (مثال الطلب)', () => {
  const c = cd('2026-11-25');
  assert.equal(c.daysLeft, 28); assert.equal(iso(c.next), '2026-12-23'); assert.equal(iso(c.prev), '2026-11-23');
});

test('الانتقال من ديسمبر إلى يناير', () => {
  const c = cd('2026-12-24');
  assert.equal(iso(c.next), '2027-01-23'); assert.equal(c.daysLeft, 30);
  const j = cd('2027-01-02');
  assert.equal(iso(j.prev), '2026-12-23'); assert.equal(j.daysLeft, 21);
});

test('فبراير والسنوات الكبيسة ويوم صرف غير موجود في الشهر', () => {
  assert.equal(iso(cd('2027-02-10', 30).next), '2027-02-28', '2027 ليست كبيسة');
  assert.equal(iso(cd('2028-02-10', 30).next), '2028-02-29', '2028 كبيسة');
  assert.equal(cd('2028-02-29', 30).isToday, true);
  const after = cd('2028-03-01', 30);
  assert.equal(iso(after.next), '2028-03-30'); assert.equal(iso(after.prev), '2028-02-29');
  assert.equal(iso(cd('2026-11-15', 31).next), '2026-11-30', 'نوفمبر 30 يوماً');
  assert.equal(cd('2028-01-31', 31).daysLeft, 0);
  assert.equal(iso(cd('2028-02-01', 31).next), '2028-02-29');
  assert.equal(cd('2028-02-28', 23).daysLeft, 24); // 28 فبراير ← 23 مارس في سنة كبيسة
  assert.equal(cd('2027-02-28', 23).daysLeft, 23);
});

test('يوم صرف مخصص', () => {
  assert.equal(cd('2026-11-25', 1).daysLeft, 6);
  assert.equal(iso(cd('2026-11-25', 1).next), '2026-12-01');
  assert.equal(cd('2026-11-25', 99).payDay, 23, 'قيمة غير صالحة => الافتراضي');
});

test('فرق أيام تقويمي دقيق عبر أشهر مختلفة الطول', () => {
  for (const [s, n] of [['2026-01-24', 30], ['2026-02-24', 27], ['2026-03-24', 30], ['2026-04-24', 29]]) assert.equal(cd(s).daysLeft, n, s);
});

test('توقيت مسقط (UTC+4): التاريخ يتغير عند منتصف الليل في مسقط لا في UTC', () => {
  assert.deepEqual(todayIn(new Date('2026-11-22T19:59:59Z')), { y: 2026, m: 11, d: 22 });
  assert.deepEqual(todayIn(new Date('2026-11-22T20:00:00Z')), { y: 2026, m: 11, d: 23 });
  assert.deepEqual(todayIn(new Date('2026-12-31T20:30:00Z')), { y: 2027, m: 1, d: 1 });
  const ms = msUntilMidnight(new Date('2026-11-22T19:00:00Z'));
  assert.ok(ms > 3599000 && ms < 3602000, `ساعة حتى منتصف الليل في مسقط: ${ms}`);
});
