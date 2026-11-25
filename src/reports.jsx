// محتوى التقارير (يُعرض في النافذة ويُحوَّل إلى PDF ويُطبع)
// الرسوم مبنية بعناصر HTML بسيطة حتى تظهر بدقة في PDF
import React from 'react';
import { fmt, fmtShort, dateLabel, todayISO } from './data.js';
import { annualSeries, r3, remainingInfo, sumOMR, pctLabel } from './finance.js';
import { analyzeSpending } from './insights.js';

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

// نص النسبة المتبقية للجداول (بلا قسمة على صفر)
const remText = (rem) => (rem.pct == null ? (rem.tone === 'unbudgeted' ? 'بلا مخصص' : '—') : pctLabel(rem.pct));
const remClass = (rem) => (rem.tone === 'good' ? 'text-good' : rem.tone === 'warn' ? 'text-warn' : rem.tone === 'none' || rem.tone === 'zero' ? 'text-muted' : 'text-bad');

export function MonthReport({ data, store, includeAnalysis }) {
  const s = data.summary;
  const sections = (data.meta.allSections || data.meta.sections).map((sec) => {
    const list = s.items.filter((i) => i.group === sec.id);
    const planned = sumOMR(list, (i) => i.planned), paid = sumOMR(list, (i) => i.paid);
    return { ...sec, list, planned, paid, rem: remainingInfo(planned, paid) };
  });
  return (
    <>
      <Head kicker="تقرير مصاريف الراتب الشهري" title={data.label} right={<p className="text-xs font-bold text-ink">إجمالي الدخل <span className="num">{fmt(s.totalIncome)}</span> ر.ع</p>} />
      <Tiles items={[
        ['الراتب الأساسي', s.salary],
        ['إجمالي الدخل الإضافي', s.extraIncome],
        ['إجمالي الدخل', s.totalIncome],
        ['الرصيد المرحّل', s.carryIn ? signed(s.carryIn) : '0'],
        ['المخصص (الموزع)', s.planned],
        ['المصروف الفعلي', s.paid],
        ['الرصيد الفعلي المتاح', s.balance, s.balance < 0 ? 'bad' : 'good'],
        ['المتبقي بعد المخصصات', s.afterAllocations, s.afterAllocations < 0 ? 'bad' : 'good'],
        [s.isPast ? 'رصيد نهاية الشهر' : 'المتوقع نهاية الشهر', s.forecast, s.forecast < 0 ? 'bad' : ''],
        ['الادخار (المدفوع لبنود الادخار)', s.saved, 'good'],
      ]} />
      {s.paid > s.available && <p className="mt-2 rounded-xl bg-bad/10 px-3 py-2 text-sm font-bold text-bad">عجز: تجاوز المصروف الفعلي إجمالي الدخل بـ <span className="num">{fmtShort(s.paid - s.available)}</span> ر.ع</p>}

      <h2 className="mt-5 mb-2 text-sm font-extrabold">الدخل الإضافي (<span className="num">{s.incomes.length}</span>)</h2>
      <div className="overflow-x-auto">
        <table className="rtable">
          <thead><tr><th>التاريخ</th><th>الاسم</th><th>ملاحظة</th><th>المبلغ</th></tr></thead>
          <tbody>
            {[...s.incomes].sort((x, y) => (x.date < y.date ? -1 : 1)).map((i) => (
              <tr key={i.id}><td className="num whitespace-nowrap">{dateLabel(i.date)}</td><td>{i.name}{i.recurring ? ' ↻' : ''}</td><td className="text-muted">{i.note}</td><td className="num font-bold">{fmt(i.amount)}</td></tr>
            ))}
            {s.incomes.length === 0 && <tr><td colSpan={4} className="text-center text-muted">لا يوجد دخل إضافي لهذا الشهر</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={3}>إجمالي الدخل الإضافي</td><td className="num">{fmt(s.extraIncome)}</td></tr></tfoot>
        </table>
      </div>

      <h2 className="mt-5 mb-2 text-sm font-extrabold">المخصص مقابل المصروف حسب الفئة</h2>
      <PlanBars rows={sections.filter((x) => x.planned || x.paid).map((x) => ({ name: x.name, planned: x.planned, paid: x.paid }))} />

      <h2 className="mt-5 mb-2 text-sm font-extrabold">البنود: المخصص والمصروف والمتبقي والنسبة المتبقية</h2>
      <div className="overflow-x-auto">
        <table className="rtable">
          <thead><tr><th>البند</th><th>المخصص</th><th>المصروف</th><th>المتبقي</th><th>النسبة المتبقية</th></tr></thead>
          {sections.map((g) => g.list.length > 0 && (
            <tbody key={g.id}>
              <tr className="group-row">
                <td>{g.name}{g.archived ? ' (مؤرشفة)' : ''}</td><td className="num">{fmtShort(g.planned)}</td><td className="num">{fmtShort(g.paid)}</td>
                <td className="num" dir="ltr" style={{ textAlign: 'right' }}>{fmtShort(g.rem.remaining)}</td><td className={`num ${remClass(g.rem)}`} dir="ltr" style={{ textAlign: 'right' }}>{remText(g.rem)}</td>
              </tr>
              {g.list.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}{i.archived ? ' (مؤرشف)' : ''}<span className="block text-[10px] text-muted">{data.meta.cardName(i.account)}</span></td>
                  <td className="num">{fmtShort(i.planned)}</td><td className="num">{fmtShort(i.paid)}</td>
                  <td className={`num whitespace-nowrap font-bold ${i.rem.remaining < 0 ? 'text-bad' : ''}`} dir="ltr" style={{ textAlign: 'right' }}>{fmtShort(i.rem.remaining)}</td>
                  <td className={`num whitespace-nowrap font-bold ${remClass(i.rem)}`} dir="ltr" style={{ textAlign: 'right' }}>{remText(i.rem)}{i.rem.tone === 'over' ? ` (تجاوز ${fmtShort(i.rem.over)})` : ''}</td>
                </tr>
              ))}
            </tbody>
          ))}
          {s.orphanPaid > 0 && <tbody><tr className="group-row"><td colSpan={2}>مصروفات بنود محذوفة</td><td className="num">{fmtShort(s.orphanPaid)}</td><td colSpan={2} /></tr></tbody>}
          <tfoot><tr><td>الإجمالي</td><td className="num">{fmtShort(s.planned)}</td><td className="num">{fmtShort(s.paid)}</td><td className="num" dir="ltr" style={{ textAlign: 'right' }}>{fmtShort(s.rem.remaining)}</td><td className="num" dir="ltr" style={{ textAlign: 'right' }}>{remText(s.rem)}</td></tr></tfoot>
        </table>
      </div>

      {includeAnalysis && store && <AnalysisSection store={store} period={data.period} />}

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
      <p className="pdf-avoid mt-4 pb-2 text-center text-[10px] text-muted">جميع المبالغ بالريال العماني · المتبقي = المخصص − المصروف · النسبة المتبقية = المتبقي ÷ المخصص × 100 · ↻ دخل متكرر</p>
    </>
  );
}

// قسم اختياري: توصيات تحليل سلوك الإنفاق
function AnalysisSection({ store, period }) {
  const today = todayISO();
  const r = analyzeSpending(store, { today, refPeriod: period < today.slice(0, 7) ? period : null });
  return (
    <section className="pdf-avoid">
      <h2 className="mt-5 mb-2 text-sm font-extrabold">تحليل سلوك الإنفاق</h2>
      {r.status === 'empty' ? <p className="text-xs text-muted">{r.message}</p> : (
        <>
          <p className="text-xs text-muted">مبني على {monthWordR(r.summary.month)} · فرص التوفير الشهرية <b className="num text-ink">{fmtShort(r.summary.monthlySaving)}</b> ر.ع، والسنوية <b className="num text-ink">{fmtShort(r.summary.annualSaving)}</b> ر.ع (تقديرية). تحليل بقواعد حسابية على الجهاز، وليس ذكاءً اصطناعياً.</p>
          {r.notes.map((n, k) => <p key={k} className="mt-1 text-[11px] text-warn">{n}</p>)}
          <table className="rtable mt-2">
            <thead><tr><th>البند</th><th>الأولوية</th><th>الملاحظة والتوصية</th><th>توفير شهري</th></tr></thead>
            <tbody>
              {r.items.filter((x) => x.priority !== 'none').map((x) => (
                <tr key={x.id}>
                  <td className="font-bold">{x.name}<span className="block text-[10px] font-normal text-muted">{x.kindLabel}</span></td>
                  <td className="whitespace-nowrap">{{ high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }[x.priority]}</td>
                  <td className="text-[11px]">{x.observation} {x.recommendation}</td>
                  <td className="num font-bold">{x.cut ? fmtShort(x.cut) : '—'}</td>
                </tr>
              ))}
              {!r.items.some((x) => x.priority !== 'none') && <tr><td colSpan={4} className="text-center text-muted">لا توجد بنود تحتاج انتباهاً.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
const monthWordR = (l) => (l || '').replace(/^راتب شهر /, '');

export function AnnualReport({ store, endPeriod, title }) {
  const a = annualSeries(store, endPeriod);
  const max = Math.max(1, ...a.rows.map((r) => Math.max(r.salary, r.paid)));
  const mon = (p) => new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'short' }).format(new Date(Number(p.slice(0, 4)), Number(p.slice(5)) - 1, 1));
  return (
    <>
      <Head kicker="التقرير السنوي (آخر 12 شهراً)" title={title} right={<p className="text-xs font-bold text-ink">{a.rows[0].period} → {endPeriod}</p>} />
      <Tiles items={[
        ['إجمالي الرواتب الأساسية', a.totals.salary],
        ['إجمالي الدخل الإضافي', a.totals.extra],
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
          <thead><tr><th>الشهر</th><th>الراتب</th><th>دخل إضافي</th><th>المخطط</th><th>المدفوع</th><th>الفائض</th><th>الادخار</th></tr></thead>
          <tbody>
            {a.rows.map((r) => (
              <tr key={r.period}>
                <td className="whitespace-nowrap">{r.empty ? <span className="text-muted">{r.period}</span> : r.label.replace(/^راتب شهر /, '')}</td>
                <td className="num">{r.empty ? '—' : fmtShort(r.salary)}</td><td className="num">{r.empty ? '—' : fmtShort(r.extra)}</td><td className="num">{r.empty ? '—' : fmtShort(r.planned)}</td>
                <td className="num">{r.empty ? '—' : fmtShort(r.paid)}</td>
                <td className={`num font-bold ${r.surplus < 0 ? 'text-bad' : 'text-good'}`}>{r.empty ? '—' : fmtShort(r.surplus)}</td>
                <td className="num">{r.empty ? '—' : fmtShort(r.saved)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>الإجمالي</td><td className="num">{fmtShort(a.totals.salary)}</td><td className="num">{fmtShort(a.totals.extra)}</td><td className="num">{fmtShort(a.totals.planned)}</td><td className="num">{fmtShort(a.totals.paid)}</td><td className="num">{fmtShort(a.totals.surplus)}</td><td className="num">{fmtShort(a.totals.saved)}</td></tr></tfoot>
        </table>
      </div>
      <h2 className="mt-5 mb-2 text-sm font-extrabold">أكثر البنود استهلاكاً</h2>
      <PlanBars paidOnly rows={a.top.map((t) => ({ name: t.name, planned: 0, paid: t.paid }))} />
      <p className="mt-4 text-center text-[10px] text-muted">جميع المبالغ بالريال العماني · الفائض = الراتب + الدخل الإضافي − المدفوع · الادخار = المدفوع على بنود الادخار</p>
    </>
  );
}

export function annualText(store, endPeriod) {
  const a = annualSeries(store, endPeriod);
  const L = [`التقرير السنوي — آخر 12 شهراً حتى ${endPeriod}`, ''];
  L.push(`إجمالي الرواتب الأساسية: ${fmt(a.totals.salary)} ر.ع`, `إجمالي الدخل الإضافي: ${fmt(a.totals.extra)} ر.ع`, `إجمالي المدفوع: ${fmt(a.totals.paid)} ر.ع`, `إجمالي الادخار: ${fmt(a.totals.saved)} ر.ع`, `الفائض/العجز: ${fmt(a.totals.surplus)} ر.ع`, '');
  for (const r of a.rows.filter((x) => !x.empty)) L.push(`${r.label}: راتب ${fmtShort(r.salary)} · مدفوع ${fmtShort(r.paid)} · فائض ${fmtShort(r.surplus)}`);
  if (a.top.length) { L.push('', 'أكثر البنود استهلاكاً:'); for (const t of a.top) L.push(`- ${t.name}: ${fmtShort(t.paid)} ر.ع`); }
  return L.join('\n');
}
