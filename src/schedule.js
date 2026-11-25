// العد التنازلي للراتب القادم — حساب بالأيام التقويمية بتوقيت مسقط (Asia/Muscat)
// الموعد مجدول فقط: لا يعني إيداع الراتب، ولا يضيف أي عملية أو يغيّر أي بيانات.

export const TZ = 'Asia/Muscat';
export const DEFAULT_PAY_DAY = 23;

const pad = (n) => String(n).padStart(2, '0');
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
// يوم الصرف في شهر معين؛ إن لم يوجد (مثل 31 في نوفمبر) فآخر يوم في الشهر
export const payDateIn = (y, m, day) => ({ y, m, d: Math.min(Math.max(1, day), daysInMonth(y, m)) });
const shift = (y, m, k) => { const t = y * 12 + (m - 1) + k; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };
const serial = ({ y, m, d }) => Date.UTC(y, m - 1, d) / 86400000; // رقم اليوم: فرق تقويمي دقيق
export const iso = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

// تاريخ اليوم في مسقط لأي لحظة زمنية
export function todayIn(now = new Date(), tz = TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return { y: parts.year, m: parts.month, d: parts.day };
}

// الملّي ثانية حتى منتصف الليل القادم في مسقط (لتحديث العد عند تغيّر اليوم)
export function msUntilMidnight(now = new Date(), tz = TZ) {
  const t = todayIn(now, tz);
  for (let h = 0; h < 30; h++) {
    const probe = new Date(now.getTime() + h * 3600000);
    const p = todayIn(probe, tz);
    if (p.d !== t.d || p.m !== t.m || p.y !== t.y) {
      // ابحث بدقة الدقيقة داخل الساعة التي تغيّر فيها اليوم
      let lo = now.getTime() + (h - 1) * 3600000, hi = probe.getTime();
      while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); const q = todayIn(new Date(mid), tz); if (q.d === t.d && q.m === t.m && q.y === t.y) lo = mid; else hi = mid; }
      return Math.max(1000, hi - now.getTime() + 500);
    }
  }
  return 3600000;
}

export function salaryCountdown(today, payDay = DEFAULT_PAY_DAY) {
  const day = Number.isInteger(payDay) && payDay >= 1 && payDay <= 31 ? payDay : DEFAULT_PAY_DAY;
  const thisPay = payDateIn(today.y, today.m, day);
  let next, prev;
  if (today.d < thisPay.d) {
    next = thisPay;
    const p = shift(today.y, today.m, -1); prev = payDateIn(p.y, p.m, day);
  } else if (today.d === thisPay.d) {
    next = thisPay;
    const p = shift(today.y, today.m, -1); prev = payDateIn(p.y, p.m, day);
  } else {
    const n = shift(today.y, today.m, 1); next = payDateIn(n.y, n.m, day);
    prev = thisPay;
  }
  const daysLeft = serial(next) - serial(today);
  const cycle = serial(next) - serial(prev);
  const elapsed = serial(today) - serial(prev);
  return { today, next, prev, daysLeft, isToday: daysLeft === 0, cycle, progress: cycle > 0 ? Math.min(1, elapsed / cycle) : 1, payDay: day };
}
