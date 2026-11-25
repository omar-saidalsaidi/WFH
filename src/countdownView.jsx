// العد التنازلي للراتب القادم: أيام تقويمية بتوقيت مسقط، مستقل عن الشهر المالي المعروض.
// لا يضيف عمليات ولا يغيّر أي بيانات عند بلوغ الصفر.
import React, { useEffect, useState } from 'react';
import { salaryCountdown, todayIn, msUntilMidnight } from './schedule.js';

const dateFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const arDate = ({ y, m, d }) => dateFmt.format(new Date(Date.UTC(y, m - 1, d)));

// صيغ العدد بالعربية
export function daysText(n) {
  if (n === 1) return 'يوم واحد متبقٍ';
  if (n === 2) return 'يومان متبقيان';
  if (n >= 3 && n <= 10) return `${n} أيام متبقية`;
  return `${n} يوماً متبقياً`;
}

// تاريخ اليوم في مسقط، ويتحدّث عند منتصف الليل وعند فتح التطبيق أو العودة إليه
export function useMuscatToday() {
  const [today, setToday] = useState(() => todayIn(new Date()));
  useEffect(() => {
    let timer;
    const refresh = () => {
      const t = todayIn(new Date());
      setToday((prev) => (prev.y === t.y && prev.m === t.m && prev.d === t.d ? prev : t));
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilMidnight(new Date()));
    };
    refresh();
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); };
  }, []);
  return today;
}

// صندوق مضغوط في الترويسة: عدد الأيام المتبقية فقط (يعيد استخدام منطق schedule.js)
export function HeaderCountdown({ payDay }) {
  const today = useMuscatToday();
  const c = salaryCountdown(today, payDay);
  return (
    <div className="header-countdown flex h-11 min-w-[48px] shrink-0 flex-col items-center justify-center rounded-xl border border-hpb bg-hp1 px-1.5 text-hpink"
      role="status" aria-label={c.isToday ? 'اليوم موعد الراتب' : `${daysText(c.daysLeft)} حتى الراتب القادم في ${arDate(c.next)}`} title={`الراتب القادم: ${arDate(c.next)}`}>
      <span className="num text-lg font-extrabold leading-none">{c.daysLeft}</span>
      <span className="mt-0.5 whitespace-nowrap text-[9px] font-bold leading-none">{c.isToday ? 'اليوم' : 'يوم للراتب'}</span>
    </div>
  );
}
