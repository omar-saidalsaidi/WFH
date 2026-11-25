// «حدود الإنفاق والتنبيهات الحرجة» (الأدوات) + بطاقة الالتزام بالحدود في تحليل سلوك الإنفاق
import React, { useMemo, useState } from 'react';
import { Siren, Utensils, Fuel, RotateCcw, ShieldCheck, Lightbulb } from 'lucide-react';
import { Card, Field } from './ui.jsx';
import { CRIT_DEFAULTS, WEEK_DAYS, normalizeCritical, resolveItem, criticalHistory, foodDay, fuelWeek, isoOf } from './critical.js';
import { fxSupport, alertOnce } from './notifyView.jsx';
import { todayIn } from './schedule.js';

const f3 = (n) => (n == null ? '—' : n.toFixed(3));

function Toggle({ id, label, checked, onChange, hint }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span>{hint && <span className="block text-[11px] text-muted">{hint}</span>}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-6 w-11 shrink-0 accent-[rgb(var(--accent))]" />
    </label>
  );
}

export function CriticalSettings({ store, month, act, notify }) {
  const cfg = normalizeCritical(store.settings.critical);
  const save = (patch, msg) => { act.setSettings({ critical: normalizeCritical({ ...cfg, ...patch }) }); if (msg) notify(msg); };
  const [pct, setPct] = useState(String(cfg.foodPct));
  const [lim, setLim] = useState(String(cfg.fuelLimit));
  const [err, setErr] = useState({});
  const items = month.categories.filter((c) => !c.archived);
  const foodId = resolveItem(store, 'food', cfg.foodItem);
  const fuelId = resolveItem(store, 'fuel', cfg.fuelItem);
  const today = isoOf(todayIn(new Date()));
  const fd = foodDay(store, cfg, today);
  const fw = fuelWeek(store, cfg, today);
  const fx = fxSupport();

  const savePct = () => {
    const n = parseFloat(pct);
    if (!(n > 0 && n <= 100)) return setErr({ pct: 'أدخل نسبة أكبر من 0 وحتى 100.' });
    setErr({}); save({ foodPct: Math.round(n * 1000) / 1000 }, `حد الأكل اليومي: ${n}٪ من المخصص الشهري`);
  };
  const saveLim = () => {
    const n = parseFloat(lim);
    if (!(n > 0)) return setErr({ lim: 'أدخل مبلغاً أكبر من صفر.' });
    setErr({}); save({ fuelLimit: Math.round(n * 1000) / 1000 }, `حد البنزين الأسبوعي: ${n.toFixed(3)} ر.ع`);
  };
  const reset = () => { save({ ...CRIT_DEFAULTS }, 'استُعيدت الإعدادات الافتراضية (3٪ يومياً، 15 ر.ع أسبوعياً، الأحد)'); setPct(String(CRIT_DEFAULTS.foodPct)); setLim(String(CRIT_DEFAULTS.fuelLimit)); setErr({}); };
  const itemSelect = (id, value, onChange) => (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className="input text-sm font-bold">
      {!items.some((c) => c.id === value) && <option value={value || ''}>{value ? 'بند غير موجود في هذا الشهر' : 'لم يُحدَّد بند'}</option>}
      {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );

  return (
    <>
      <p className="-mt-2 flex items-start gap-2 text-sm text-muted"><Siren size={16} className="mt-0.5 shrink-0 text-bad" />تحذيرات حرجة فورية عند تجاوز حدود الأكل اليومية والبنزين الأسبوعية. لا تمنع تسجيل أي مصروف، ولا تغيّر بياناتك المالية.</p>
      <Card className="flex flex-col gap-3 p-4">
        <p className="flex items-center gap-2 font-extrabold"><Utensils size={17} className="text-accent" />الأكل: حد يومي</p>
        <Toggle id="crit-food-on" label="تفعيل تنبيه الأكل اليومي" checked={cfg.foodOn} onChange={(v) => save({ foodOn: v }, v ? 'فُعّل تنبيه الأكل اليومي' : 'أُوقف تنبيه الأكل اليومي')} />
        <Field label="بند الأكل" htmlFor="crit-food-item">{itemSelect('crit-food-item', foodId, (v) => save({ foodItem: v }, 'تم تحديد بند الأكل'))}</Field>
        <Field label="النسبة اليومية من مخصص الأكل الشهري" htmlFor="crit-food-pct" hint="الافتراضي 3٪. التنبيه عند تجاوز النسبة فقط (المساوي لها لا يُعد تجاوزاً). اليوم يبدأ عند منتصف الليل بتوقيت مسقط.">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input id="crit-food-pct" type="number" inputMode="decimal" min="0" max="100" step="0.1" value={pct} onChange={(e) => { setPct(e.target.value); setErr({}); }} className="input num pe-4 ps-10 text-lg font-bold" />
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">٪</span>
            </div>
            <button type="button" onClick={savePct} className="h-12 shrink-0 rounded-2xl bg-accent px-5 font-bold text-white">حفظ</button>
          </div>
        </Field>
        {err.pct && <p className="text-sm font-bold text-bad" role="alert">{err.pct}</p>}
        <p className="crit-food-now num rounded-xl bg-surface2 px-3 py-2 text-xs leading-relaxed">
          {fd.zeroBudget ? 'مخصص الأكل لهذا الشهر صفر، فلا يمكن حساب الحد اليومي ولن يظهر تنبيه.' : <>المخصص الشهري {f3(fd.budget)} ر.ع ← الحد اليومي <b>{f3(fd.limit)}</b> ر.ع. صُرف اليوم <b className={fd.over ? 'text-bad' : ''}>{f3(fd.spent)}</b> ر.ع.</>}
        </p>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <p className="flex items-center gap-2 font-extrabold"><Fuel size={17} className="text-accent" />البنزين: حد أسبوعي</p>
        <Toggle id="crit-fuel-on" label="تفعيل تنبيه البنزين الأسبوعي" checked={cfg.fuelOn} onChange={(v) => save({ fuelOn: v }, v ? 'فُعّل تنبيه البنزين الأسبوعي' : 'أُوقف تنبيه البنزين الأسبوعي')} />
        <Field label="بند البنزين" htmlFor="crit-fuel-item">{itemSelect('crit-fuel-item', fuelId, (v) => save({ fuelItem: v }, 'تم تحديد بند البنزين'))}</Field>
        <Field label="الحد الأسبوعي" htmlFor="crit-fuel-limit" hint="الافتراضي 15 ر.ع. يُجمع كل ما سُجّل على البند خلال الأسبوع التقويمي، حتى لو امتد الأسبوع على شهرين ماليين.">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input id="crit-fuel-limit" type="number" inputMode="decimal" min="0" step="0.001" value={lim} onChange={(e) => { setLim(e.target.value); setErr({}); }} className="input num pe-4 ps-12 text-lg font-bold" />
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">ر.ع</span>
            </div>
            <button type="button" onClick={saveLim} className="h-12 shrink-0 rounded-2xl bg-accent px-5 font-bold text-white">حفظ</button>
          </div>
        </Field>
        {err.lim && <p className="text-sm font-bold text-bad" role="alert">{err.lim}</p>}
        <Field label="أول يوم في الأسبوع" htmlFor="crit-week-start">
          <select id="crit-week-start" value={cfg.weekStart} onChange={(e) => save({ weekStart: Number(e.target.value) }, `يبدأ الأسبوع يوم ${WEEK_DAYS[Number(e.target.value)]}`)} className="input text-sm font-bold">
            {WEEK_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </Field>
        <p className="crit-fuel-now num rounded-xl bg-surface2 px-3 py-2 text-xs leading-relaxed">
          الأسبوع الحالي {fw.start} – {fw.end}: صُرف <b className={fw.over ? 'text-bad' : ''}>{f3(fw.spent)}</b> ر.ع من {f3(fw.limit)} ر.ع.
        </p>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <Toggle id="crit-fx" label="اهتزاز قصير أو نغمة واحدة عند تحذير حرج جديد" checked={cfg.alertFx}
          hint={fx.vibrate || fx.sound ? `مرة واحدة فقط لكل تحذير جديد. ${fx.vibrate ? '' : 'الاهتزاز غير مدعوم على هذا الجهاز (مثل آيفون)؛ ستُستخدم نغمة قصيرة.'}` : 'غير مدعوم على هذا الجهاز.'}
          onChange={(v) => { save({ alertFx: v }, v ? 'فُعّل التنبيه بالاهتزاز أو النغمة' : 'أُوقف التنبيه بالاهتزاز أو النغمة'); if (v) alertOnce(); }} />
      </Card>
      <button type="button" onClick={reset} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-bold text-accent"><RotateCcw size={15} />استعادة الإعدادات الافتراضية</button>
    </>
  );
}

// أعمدة اتجاه بسيطة: سلسلة واحدة مع خط الحد؛ ما فوق الحد بلون التحذير مع علامة ⚠ (لا يعتمد على اللون وحده)
function TrendBars({ rows, unit, caption }) {
  const max = Math.max(...rows.map((r) => Math.max(r.spent, r.limit)), 0.001);
  const limitY = rows.length ? (rows[rows.length - 1].limit / max) * 100 : 0;
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-xs font-bold text-muted">{caption}</figcaption>
      <div className="relative h-28" role="img" aria-label={`${caption}: ${rows.filter((r) => r.over).length} فترة فوق الحد`}>
        <div className="absolute inset-x-0 border-t-2 border-dashed border-muted/70" style={{ bottom: `${limitY}%` }} aria-hidden="true">
          <span className="num absolute -top-4 left-0 bg-surface px-1 text-[10px] font-bold text-muted">الحد {f3(rows[rows.length - 1]?.limit || 0)}</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {rows.map((r) => (
            <div key={r.key} className="group relative flex h-full flex-1 items-end" title={`${r.key}: ${f3(r.spent)} ${unit}${r.over ? ' — فوق الحد' : ''}`}>
              <div className={`w-full rounded-t-[4px] ${r.over ? 'bg-bad' : r.current ? 'bg-accent' : 'bg-accent/45'}`} style={{ height: `${Math.max(r.spent > 0 ? 2 : 0, (r.spent / max) * 100)}%` }} />
              {r.over && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-bad" aria-hidden="true">⚠</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="num flex justify-between text-[9px] text-muted" aria-hidden="true"><span>{rows[0]?.label}</span><span>{rows[rows.length - 1]?.label}</span></div>
      <details className="text-[11px]">
        <summary className="cursor-pointer font-bold text-accent">عرض كجدول</summary>
        <table className="num mt-1 w-full text-right">
          <thead><tr className="text-muted"><th className="font-bold">الفترة</th><th className="font-bold">المصروف</th><th className="font-bold">الحد</th><th className="font-bold">الحالة</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><td>{r.key}</td><td>{f3(r.spent)}</td><td>{f3(r.limit)}</td><td className={r.over ? 'font-bold text-bad' : ''}>{r.over ? '⚠ فوق الحد' : 'ضمن الحد'}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

// يُحسب فقط عند فتح صفحة التحليل
export function CriticalInsights({ store }) {
  const h = useMemo(() => criticalHistory(store, todayIn(new Date())), [store]);
  const stat = (label, v, cls = '') => <div className="rounded-xl bg-surface2 px-2 py-1.5"><dt className="text-[10px] text-muted">{label}</dt><dd className={`num text-sm font-extrabold ${cls}`}>{v}</dd></div>;
  return (
    <Card className="critical-insights flex flex-col gap-4 p-4">
      <div>
        <p className="flex items-center gap-2 font-extrabold"><Siren size={17} className="text-bad" />الالتزام بحدود الأكل والبنزين</p>
        <p className="text-[11px] text-muted">من العمليات المسجلة فعلاً، آخر {h.span} يوماً كحد أقصى. المتوسط للفترات المكتملة فقط.</p>
      </div>
      <section className="flex flex-col gap-2" aria-label="الأكل اليومي">
        <p className="flex items-center gap-1.5 text-sm font-bold"><Utensils size={15} />«{h.food.name || 'الأكل'}» يومياً {h.food.on ? '' : <span className="text-[11px] text-muted">(التنبيه متوقف)</span>}</p>
        <TrendBars rows={h.food.trend} unit="ر.ع" caption="آخر 14 يوماً مقابل الحد اليومي" />
        <dl className="grid grid-cols-3 gap-1.5 text-center">
          {stat('مرات التجاوز', h.food.violations, h.food.violations ? 'text-bad' : '')}
          {stat('إجمالي التجاوز', f3(h.food.excess), h.food.excess ? 'text-bad' : '')}
          {stat('متوسط اليوم المكتمل', f3(h.food.avg))}
        </dl>
      </section>
      <section className="flex flex-col gap-2" aria-label="البنزين الأسبوعي">
        <p className="flex items-center gap-1.5 text-sm font-bold"><Fuel size={15} />«{h.fuel.name || 'البنزين'}» أسبوعياً {h.fuel.on ? '' : <span className="text-[11px] text-muted">(التنبيه متوقف)</span>}</p>
        <TrendBars rows={h.fuel.trend} unit="ر.ع" caption="آخر 8 أسابيع مقابل الحد الأسبوعي" />
        <dl className="grid grid-cols-3 gap-1.5 text-center">
          {stat('مرات التجاوز', h.fuel.violations, h.fuel.violations ? 'text-bad' : '')}
          {stat('إجمالي التجاوز', f3(h.fuel.excess), h.fuel.excess ? 'text-bad' : '')}
          {stat('متوسط الأسبوع المكتمل', f3(h.fuel.avg))}
        </dl>
      </section>
      {h.tips.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {h.tips.map((t) => <li key={t} className="flex items-start gap-2 text-[12px] leading-relaxed"><Lightbulb size={14} className="mt-0.5 shrink-0 text-warn" />{t}</li>)}
        </ul>
      )}
      <p className="flex items-start gap-2 text-[11px] text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-good" />تقليل المصروف لا يعني توفيراً مضموناً؛ المبالغ أعلاه تقدير لما تجاوز الحدود فقط.</p>
    </Card>
  );
}
