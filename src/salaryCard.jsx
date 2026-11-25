// بطاقة الراتب الأساسي والدخل (صفحة الأدوات) — نفس التصميم واللون المختار سابقاً
import React from 'react';
import { Palette } from 'lucide-react';
import { fmtShort } from './data.js';
import { summaryVars } from './colors.js';
import { useIsDark } from './ui.jsx';

export function SalaryCard({ salary, extra, total, count, color, onColor }) {
  const dark = useIsDark();
  const style = summaryVars(color, dark)?.vars;
  return (
    <section className="salary-card rounded-3xl border border-hpb bg-gradient-to-bl from-hp1 via-hp1 to-hpsec p-3 text-hpink" style={style} aria-label="الراتب الأساسي والدخل">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[12px] font-bold text-hpink/75">الراتب والدخل</p>
        <button type="button" onClick={onColor} aria-label="لون بطاقة الراتب الأساسي" className="-me-1 grid h-8 w-9 place-items-center rounded-lg text-hpink/70"><Palette size={14} /></button>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-2xl bg-hp2/50 px-1 py-2">
          <dt className="text-[10px] font-bold text-hpink/75">الراتب الأساسي</dt>
          <dd className="num mt-0.5 text-[17px] font-extrabold">{fmtShort(salary)}</dd>
        </div>
        <div className="rounded-2xl border border-dashed border-hpb bg-hp1/70 px-1 py-2">
          <dt className="text-[10px] font-bold text-hpink/75">الدخل الإضافي</dt>
          <dd className="num mt-0.5 text-[17px] font-extrabold">{fmtShort(extra)}</dd>
          <dd className="text-[9px] text-hpink/60">{count ? `${count} مدخلات` : 'لا يوجد'}</dd>
        </div>
        <div className="rounded-2xl bg-hp2/50 px-1 py-2">
          <dt className="text-[10px] font-bold text-hpink/75">إجمالي الدخل</dt>
          <dd className="num mt-0.5 text-[17px] font-extrabold">{fmtShort(total)}</dd>
        </div>
      </dl>
    </section>
  );
}
