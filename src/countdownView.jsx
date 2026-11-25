// بطاقة «الراتب القادم»: عد تنازلي بالأيام التقويمية بتوقيت مسقط، مستقل عن الشهر المالي المعروض.
// لا يضيف عمليات ولا يغيّر أي بيانات عند بلوغ الصفر.
import React, { useEffect, useState } from 'react';
import { CalendarClock, Settings2, Check } from 'lucide-react';
import { Card, Sheet, Field, PrimaryButton } from './ui.jsx';
import { salaryCountdown, todayIn, msUntilMidnight, DEFAULT_PAY_DAY } from './schedule.js';

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

export function SalaryCountdown({ payDay, onSettings }) {
  const today = useMuscatToday();
  const c = salaryCountdown(today, payDay);
  return (
    <Card className="countdown-card p-3.5" aria-label="الراتب القادم">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${c.isToday ? 'bg-good/15 text-good' : 'bg-hp1 text-hpink'}`}><CalendarClock size={21} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-muted">الراتب القادم</p>
          <p className={`text-xl font-extrabold leading-tight ${c.isToday ? 'text-good' : 'text-ink'}`}>
            {c.isToday ? 'اليوم موعد الراتب' : c.daysLeft <= 2 ? daysText(c.daysLeft) : <><span className="num">{c.daysLeft}</span> {daysText(c.daysLeft).replace(/^\d+ /, '')}</>}
          </p>
        </div>
        <button onClick={onSettings} aria-label="يوم صرف الراتب" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted"><Settings2 size={16} /></button>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c.progress * 100)} aria-label="التقدم في دورة الراتب الحالية">
        <div className="h-2 rounded-full bg-hpink/70" style={{ width: `${c.progress * 100}%` }} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div><dt className="text-muted">موعد الراتب القادم</dt><dd className="num font-bold text-ink">{arDate(c.next)}</dd></div>
        <div><dt className="text-muted">آخر موعد راتب مجدول</dt><dd className="num font-bold text-ink">{arDate(c.prev)}</dd></div>
      </dl>
      <p className="mt-1.5 text-[10px] text-muted">موعد مجدول (يوم {c.payDay} بتوقيت مسقط)، وليس تأكيداً لإيداع الراتب.</p>
    </Card>
  );
}

export function PayDaySheet({ value, onSave, onClose }) {
  const [v, setV] = useState(String(value || DEFAULT_PAY_DAY));
  const [err, setErr] = useState('');
  return (
    <Sheet title="يوم صرف الراتب" onClose={onClose}
      onSubmit={() => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 31) return setErr('أدخل يوماً بين 1 و31.'); onSave(n); }}
      footer={<>{err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}<PrimaryButton type="submit"><Check size={20} />حفظ</PrimaryButton></>}>
      <Field label="يوم صرف الراتب" htmlFor="pay-day" hint="إن لم يوجد هذا اليوم في شهر ما (مثل 31 في نوفمبر)، يُستخدم آخر يوم في ذلك الشهر. الافتراضي 23.">
        <input id="pay-day" type="number" inputMode="numeric" min="1" max="31" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} className="input num text-lg font-bold" />
      </Field>
      <p className="text-xs text-muted">يُستخدم للعد التنازلي فقط، ولا يضيف أي عملية أو يغيّر البيانات المالية.</p>
    </Sheet>
  );
}
