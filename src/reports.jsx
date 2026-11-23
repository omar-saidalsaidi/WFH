// محتوى التقارير (يُعرض في النافذة ويُحوَّل إلى PDF ويُطبع)
// الرسوم مبنية بعناصر HTML بسيطة حتى تظهر بدقة في PDF
import React from 'react';
import { fmt, fmtShort, dateLabel, todayISO } from './data.js';
import { annualSeries, r3 } from './finance.js';

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}٪`);
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtShort(Math.abs(v))}`;

function Head({ kicker, title, right }) {
  return (
    <header className="flex items-end justify-between gap-3 border-b-2 border-hero pb-2">
      <div>
        <p className="text-xs font-bold text-muted">{kicker}</p>
        <h1 id="report-title" className="text-xl font-extrabold">{title}</h1>
      </div>
      <div className="text-left text-[11px] text-muted">{right}<p>{dateLabel(todayISO())}</p></div>
    </header>
  );
}
function Tiles({ items }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {items.map(([k, v, tone]) => (
        <div key={k} className={`pdf-avoid rounded-xl border border-line px-3 py-2 ${tone === 'good' ? 'bg-good/5' : tone === 'bad' ? 'bg-bad/5' : ''}`}>
          <p className="text-[11px] text-muted">{k}</p>
          <p className={`num text-lg font-extrabold ${tone === 'bad' ? 'text-bad' : ''}`}>{typeof v === 'string' ? v : fmt(v)} {typeof v !== 'string' && <span className="text-[10px] text-muted">ر.ع</span>}</p>
        </div>
      ))}
    </div>
  );
}
// أعمدة أفقية: المخطط مقابل المدفوع
function PlanBars({ rows, paidOnly }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.paid)));
  return (
    <div className="pdf-avoid flex flex-col gap-2.5">
      {!paidOnly && <div className="flex gap-4 text-[10px] font-bold text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-sky/40" />المخطط</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-accent" />المدفوع</span>
      </div>}
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-0.5 flex justify-between gap-2 text-[11px]">
            <span className="font-bold">{r.name}</span>
            {paidOnly ? <span className="text-muted"><b className="num text-ink">{fmtShort(r.paid)}</b> ر.ع</span> : (
              <span className="flex gap-1 text-muted">
                <span>مدفوع</span><b className="num text-ink">{fmtShort(r.paid)}</b><span>من</span><b className="num text-ink">{fmtShort(r.planned)}</b>
                {r.planned > 0 && <><span>·</span><b className="num">{Math.round((r.paid / r.planned) * 100)}</b><span>٪</span></>}
              </span>
            )}
          </div>
          {!paidOnly && <div className="h-2 rounded-sm bg-sky/30" style={{ width: `${(r.planned / max) * 100}%`, minWidth: r.planned ? 3 : 0 }} />}
          <div className={`mt-0.5 h-2 rounded-sm ${r.paid > r.planned ? 'bg-bad' : 'bg-accent'}`} style={{ width: `${(r.paid / max) * 100}%`, minWidth: r.paid ? 3 : 0 }} />
        </div>
      ))}
    </div>
  );
}

export function MonthReport({ data }) {
  const s = data.summary;
  const sections = data.meta.sections.map((sec) => {
    const list = s.items.filter((i) => i.group === sec.id);
    return { ...sec, list, planned: r3(list.reduce((a, i) => a + i.planned, 0)), paid: r3(list.reduce((a, i) => a + i.paid, 0)) };
  });
  return (
    <>
      <Head kicker="تقرير مصاريف الراتب الشهري" title={data.label} right={<p className="text-xs font-bold text-ink">الراتب <span className="num">{fmt(data.salary)}</span> ر.ع</p>} />
      <Tiles items={[
        ['الراتب', s.salary],
        ['الرصيد المرحّل', s.carryIn ? signed(s.carryIn) : '0'],
        ['المخطط (الموزع)', s.planned],
        ['المدفوع فعلياً', s.paid],
        ['الرصيد الحالي', s.balance, s.balance < 0 ? 'bad' : 'good'],
        [s.isPast ? 'رصيد نهاية الشهر' : 'المتوقع نهاية الشهر', s.forecast, s.forecast < 0 ? 'bad' : 'good'],
        ['غير المدفوع من المخطط', s.unpaid],
        ['نسبة التنفيذ', pct(s.exec)],
      ]} />
      {s.paid > s.available && <p className="mt-2 rounded-xl bg-bad/10 px-3 py-2 text-sm font-bold text-bad">عجز: تجاوز المدفوع المتاح بـ <span className="num">{fmtShort(s.paid - s.available)}</span> ر.ع</p>}

      <h2 className="mt-5 mb-2 text-sm font-extrabold">المخطط مقابل المدفوع حسب الفئة</h2>
      <PlanBars rows={sections.filter((x) => x.planned || x.paid).map((x) => ({ name: x.name, planned: x.planned, paid: x.paid }))} />

      <h2 className="mt-5 mb-2 text-sm font-extrabold">البنود: المخطط والمدفوع والمتبقي</h2>
      <div className="overflow-x-auto">
        <table className="rtable">
          <thead><tr><th>البند</th><th>البطاقة</th><th>المخطط</th><th>المدفوع</th><th>المتبقي</th><th>التنفيذ</th></tr></thead>
          {sections.map((g) => g.list.length > 0 && (
            <tbody key={g.id}>
              <tr className="group-row"><td colSpan={2}>{g.name}</td><td className="num">{fmtShort(g.planned)}</td><td className="num">{fmtShort(g.paid)}</td><td className="num">{fmtShort(r3(g.planned - g.paid))}</td><td className="num">{pct(g.planned ? g.paid / g.planned : null)}</td></tr>
              {g.list.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td><td className="whitespace-nowrap text-muted">{data.meta.cardName(i.account)}</td>
                  <td className="num">{fmtShort(i.planned)}</td><td className="num">{fmtShort(i.paid)}</td>
                  <td className={`num whitespace-nowrap font-bold ${i.remaining < 0 ? 'text-bad' : 'text-good'}`}>{i.remaining < 0 ? `عجز ${fmtShort(-i.remaining)}` : fmtShort(i.remaining)}</td>
                  <td className="num">{pct(i.exec)}</td>
                </tr>
              ))}
            </tbody>
          ))}
          {s.orphanPaid > 0 && <tbody><tr className="group-row"><td colSpan={3}>مصروفات بنود محذوفة</td><td className="num">{fmtShort(s.orphanPaid)}</td><td colSpan={2} /></tr></tbody>}
          <tfoot><tr><td colSpan={2}>الإجمالي</td><td className="num">{fmtShort(s.planned)}</td><td className="num">{fmtShort(s.paid)}</td><td className="num">{fmtShort(r3(s.planned - s.paid))}</td><td className="num">{pct(s.exec)}</td></tr></tfoot>
        </table>
      </div>

      <h2 className="mt-5 mb-2 text-sm font-extrabold">العمليات المسجلة (<span className="num">{data.history.length}</span>)</h2>
      <div className="overflow-x-auto">
        <table className="rtable">
          <thead><tr><th>التاريخ</th><th>البند</th><th>ملاحظة</th><th>المبلغ</th></tr></thead>
          <tbody>
            {data.history.map((t) => (
              <tr key={t.id}><td className="num whitespace-nowrap">{dateLabel(t.date)}</td><td>{data.catMap[t.catId]?.name || 'بند محذوف'}</td><td className="text-muted">{t.note}</td><td className="num font-bold">{fmt(t.amount)}</td></tr>
            ))}
            {data.history.length === 0 && <tr><td colSpan={4} className="text-center text-muted">لا توجد عمليات</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-[10px] text-muted">جميع المبالغ بالريال العماني · المخطط = المخصص، المدفوع = المسجل فعلياً، المتبقي = المخطط − المدفوع</p>
    </>
  );
}

export function AnnualReport({ store, endPeriod, title }) {
  const a = annualSeries(store, endPeriod);
  const max = Math.max(1, ...a.rows.map((r) => Math.max(r.salary, r.paid)));
  const mon = (p) => new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'short' }).format(new Date(Number(p.slice(0, 4)), Number(p.slice(5)) - 1, 1));
  return (
    <>
      <Head kicker="التقرير السنوي (آخر 12 شهراً)" title={title} right={<p className="text-xs font-bold text-ink">{a.rows[0].period} → {endPeriod}</p>} />
      <Tiles items={[
        ['إجمالي الرواتب', a.totals.salary],
        ['إجمالي المدفوع', a.totals.paid],
        ['إجمالي الادخار', a.totals.saved, 'good'],
        ['الفائض / العجز', a.totals.surplus, a.totals.surplus < 0 ? 'bad' : 'good'],
        ['متوسط المدفوع شهرياً', a.totals.avgPaid],
        ['اتجاه الإنفاق (3 أشهر)', a.trend == null ? '—' : signed(a.trend)],
      ]} />
      <h2 className="mt-5 mb-2 text-sm font-extrabold">الراتب مقابل المدفوع شهرياً</h2>
      <div className="pdf-avoid flex items-end justify-between gap-1" style={{ height: 140 }}>
        {a.rows.map((r) => (
          <div key={r.period} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="relative flex w-full items-end justify-center" style={{ height: 118 }}>
              {!r.empty && <div className="absolute bottom-0 w-[80%] rounded-t-sm bg-sky/25" style={{ height: `${(r.salary / max) * 100}%` }} />}
              {!r.empty && <div className={`relative w-[46%] rounded-t-sm ${r.paid > r.salary ? 'bg-bad' : 'bg-accent'}`} style={{ height: `${(r.paid / max) * 100}%` }} />}
            </div>
            <span className="text-[9px] text-muted">{mon(r.period)}</span>
          </div>
        ))}
      </div>
      <h2 className="mt-5 mb-2 text-sm font-extrabold">المقارنة الشهرية</h2>
      <div className="overflow-x-auto">
        <table className="rtable">
          <thead><tr><th>الشهر</th><th>الراتب</th><th>المخطط</th><th>المدفوع</th><th>الفائض</th><th>الادخار</th></tr></thead>
          <tbody>
            {a.rows.map((r) => (
              <tr key={r.period}>
                <td className="whitespace-nowrap">{r.empty ? <span className="text-muted">{r.period}</span> : r.label.replace(/^راتب شهر /, '')}</td>
                <td className="num">{r.empty ? '—' : fmtShort(r.salary)}</td><td className="num">{r.empty ? '—' : fmtShort(r.planned)}</td>
                <td className="num">{r.empty ? '—' : fmtShort(r.paid)}</td>
                <td className={`num font-bold ${r.surplus < 0 ? 'text-bad' : 'text-good'}`}>{r.empty ? '—' : fmtShort(r.surplus)}</td>
                <td className="num">{r.empty ? '—' : fmtShort(r.saved)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>الإجمالي</td><td className="num">{fmtShort(a.totals.salary)}</td><td className="num">{fmtShort(a.totals.planned)}</td><td className="num">{fmtShort(a.totals.paid)}</td><td className="num">{fmtShort(a.totals.surplus)}</td><td className="num">{fmtShort(a.totals.saved)}</td></tr></tfoot>
        </table>
      </div>
      <h2 className="mt-5 mb-2 text-sm font-extrabold">أكثر البنود استهلاكاً</h2>
      <PlanBars paidOnly rows={a.top.map((t) => ({ name: t.name, planned: 0, paid: t.paid }))} />
      <p className="mt-4 text-center text-[10px] text-muted">جميع المبالغ بالريال العماني · الفائض = الراتب − المدفوع · الادخار = المدفوع على بنود الادخار</p>
    </>
  );
}

export function annualText(store, endPeriod) {
  const a = annualSeries(store, endPeriod);
  const L = [`التقرير السنوي — آخر 12 شهراً حتى ${endPeriod}`, ''];
  L.push(`إجمالي الرواتب: ${fmt(a.totals.salary)} ر.ع`, `إجمالي المدفوع: ${fmt(a.totals.paid)} ر.ع`, `إجمالي الادخار: ${fmt(a.totals.saved)} ر.ع`, `الفائض/العجز: ${fmt(a.totals.surplus)} ر.ع`, '');
  for (const r of a.rows.filter((x) => !x.empty)) L.push(`${r.label}: راتب ${fmtShort(r.salary)} · مدفوع ${fmtShort(r.paid)} · فائض ${fmtShort(r.surplus)}`);
  if (a.top.length) { L.push('', 'أكثر البنود استهلاكاً:'); for (const t of a.top) L.push(`- ${t.name}: ${fmtShort(t.paid)} ر.ع`); }
  return L.join('\n');
}
