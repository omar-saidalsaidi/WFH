// الميزات المالية: التوقع، التنبيهات، التحليل السنوي، الديون، الأهداف، السيناريوهات، النسخ الاحتياطي، التقارير
import React, { useMemo, useRef, useState } from 'react';
import {
  TrendingUp, TrendingDown, BellRing, CircleAlert, CalendarClock, HandCoins, Target, FlaskConical, DatabaseBackup,
  FileSpreadsheet, FileText, ChevronLeft, ArrowRight, Plus, Pencil, Trash2, Download, Upload, Check, RotateCcw,
  ShieldCheck, Copy, LoaderCircle, Lightbulb,
} from 'lucide-react';
import { fmt, fmtShort, dateLabel, todayISO, uid, listSnapshots, saveSnapshot } from './data.js';
import {
  r3, monthSummary, debtStatus, goalStatus, annualSeries, compareScenario, periodOf, addMonths,
} from './finance.js';
import { makeBackup, validateBackup } from './backup.js';
import { monthWorkbook, annualWorkbook, shareOrDownload } from './exporters.js';
import { Card, Money, Sheet, Field, PrimaryButton, Progress, pctText, useMeta, TONE } from './ui.jsx';
import { SpendingBehavior } from './insightsView.jsx';

const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtShort(Math.abs(v))}`;
const monthName = (label) => label.replace(/^راتب شهر /, '');

// ================= الرصيد المتوقع حتى نهاية الشهر =================
export function ForecastCard({ s }) {
  const [open, setOpen] = useState(false);
  const bad = s.forecast < 0;
  return (
    <Card className="p-4">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 text-right">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${bad ? 'bg-bad/10 text-bad' : 'bg-good/10 text-good'}`}>
          {bad ? <TrendingDown size={19} /> : <TrendingUp size={19} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-muted">{s.isPast ? 'رصيد نهاية الشهر' : 'الرصيد المتوقع نهاية الشهر'}</span>
          <span className={`block text-2xl font-extrabold ${bad ? 'text-bad' : ''}`}><Money v={s.forecast} /></span>
        </span>
        <span className="text-xs font-bold text-accent">{open ? 'إخفاء' : 'كيف حُسب؟'}</span>
      </button>
      {open && (
        <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          <Row k="الراتب" v={s.salary} />
          {s.carryIn !== 0 && <Row k="رصيد مرحّل من الشهر السابق" v={s.carryIn} signed />}
          <Row k="المدفوع فعلياً حتى الآن" v={-s.paid} signed />
          <Row k="= الرصيد الحالي" v={s.balance} strong />
          <Row k="مخصصات والتزامات لم تُدفع بعد" v={-s.unpaid} signed />
          {s.paceOver > 0 && <Row k="تجاوز متوقع بحسب وتيرة الصرف اليومي" v={-s.paceOver} signed />}
          <Row k="= المتوقع نهاية الشهر" v={s.forecast} strong />
          <p className="mt-1 text-xs leading-relaxed text-muted">
            يفترض التوقع أن كل بند سيُصرف مخصصه كاملاً. وإذا كانت وتيرة صرفك اليومية على بند تشغيلي أعلى من مخصصه، يُحسب على وتيرتك الفعلية حتى نهاية الشهر.
          </p>
        </dl>
      )}
    </Card>
  );
}
function Row({ k, v, strong, signed: sg }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'font-extrabold' : ''}`}>
      <dt className={strong ? '' : 'text-muted'}>{k}</dt>
      <dd className={`num ${v < 0 ? 'text-bad' : ''}`} dir="ltr">{sg ? signed(v) : fmt(v)}</dd>
    </div>
  );
}

// ================= التنبيهات =================
const ALERT_TEXT = {
  over: (a) => (a.pct != null ? `تجاوز «${a.name}» ميزانيته بـ ${fmtShort(a.amount)} ر.ع` : `صُرف ${fmtShort(a.amount)} ر.ع على «${a.name}» بلا مخصص`),
  near: (a) => `«${a.name}» بلغ ${pctText(a.pct)} من ميزانيته · متبقي ${fmtShort(a.amount)} ر.ع`,
  due: (a) => `${a.days === 0 ? 'يستحق اليوم' : `يستحق بعد ${a.days} ${a.days === 1 ? 'يوم' : 'أيام'}`}: «${a.name}» ${fmtShort(a.amount)} ر.ع`,
  overdue: (a) => `متأخر منذ ${dateLabel(a.date)}: «${a.name}» ${fmtShort(a.amount)} ر.ع`,
  debtDue: (a) => `قسط «${a.name}» ${a.days === 0 ? 'اليوم' : `بعد ${a.days} ${a.days === 1 ? 'يوم' : 'أيام'}`} · ${fmtShort(a.amount)} ر.ع`,
  debtOverdue: (a) => `قسط «${a.name}» متأخر منذ ${dateLabel(a.date)}`,
};
export function AlertsCard({ alerts, onOpenItem }) {
  const [all, setAll] = useState(false);
  if (!alerts.length) return null;
  const shown = all ? alerts : alerts.slice(0, 3);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <BellRing size={17} className="text-warn" />
        <h2 className="flex-1 text-[15px] font-extrabold">تنبيهات</h2>
        <span className="num rounded-full bg-surface2 px-2 py-0.5 text-xs font-bold text-muted">{alerts.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {shown.map((a, k) => (
          <li key={k}>
            <button onClick={() => a.itemId && onOpenItem(a.itemId)} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-right text-[13px]">
              <CircleAlert size={16} className={`mt-0.5 shrink-0 ${a.level === 'bad' ? 'text-bad' : 'text-warn'}`} />
              <span className="flex-1 leading-relaxed">{ALERT_TEXT[a.kind](a)}</span>
            </button>
          </li>
        ))}
      </ul>
      {alerts.length > 3 && (
        <button onClick={() => setAll(!all)} className="w-full border-t border-line py-2 text-xs font-bold text-accent">{all ? 'عرض أقل' : `عرض الكل (${alerts.length})`}</button>
      )}
    </Card>
  );
}

// ================= المخطط مقابل الفعلي (جدول) =================
export function PlanActualTable({ s, sections }) {
  return (
    <Card className="p-4">
      <h2 className="text-[15px] font-extrabold">المخطط مقابل الفعلي</h2>
      <p className="mt-0.5 text-xs text-muted">المخطط = المخصص · المدفوع = المسجل فعلياً · المتبقي = المخطط − المدفوع</p>
      <div className="-mx-4 mt-3 overflow-x-auto px-4">
        <table className="rtable">
          <thead><tr><th>البند</th><th>المخطط</th><th>المدفوع</th><th>المتبقي</th><th>التنفيذ</th></tr></thead>
          {sections.map((sec) => {
            const list = s.items.filter((i) => i.group === sec.id);
            if (!list.length) return null;
            return (
              <tbody key={sec.id}>
                <tr className="group-row"><td colSpan={5}>{sec.name}</td></tr>
                {list.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td className="num">{fmtShort(i.planned)}</td>
                    <td className="num">{fmtShort(i.paid)}</td>
                    <td className={`num font-bold ${i.remaining < 0 ? 'text-bad' : 'text-good'}`}>{i.remaining < 0 ? `عجز ${fmtShort(-i.remaining)}` : fmtShort(i.remaining)}</td>
                    <td className={`num font-bold ${TONE[i.status].text}`}>{pctText(i.exec)}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          <tfoot><tr><td>الإجمالي</td><td className="num">{fmtShort(s.planned)}</td><td className="num">{fmtShort(s.paid)}</td><td className="num">{fmtShort(r3(s.planned - s.paid))}</td><td className="num">{pctText(s.exec)}</td></tr></tfoot>
        </table>
      </div>
    </Card>
  );
}

// ================= التحليل السنوي =================
export function AnnualView({ store, endPeriod }) {
  const a = useMemo(() => annualSeries(store, endPeriod), [store, endPeriod]);
  const [sel, setSel] = useState(null);
  const max = Math.max(1, ...a.rows.map((r) => Math.max(r.salary, r.paid)));
  const H = 120;
  const short = (p) => new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'short' }).format(new Date(Number(p.slice(0, 4)), Number(p.slice(5)) - 1, 1));
  const cur = sel != null ? a.rows[sel] : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Stat k="إجمالي المدفوع" v={a.totals.paid} sub={`متوسط ${fmtShort(a.totals.avgPaid)} شهرياً`} />
        <Stat k="إجمالي الادخار" v={a.totals.saved} sub="المدفوع على بنود الادخار" tone="good" />
        <Stat k="الفائض / العجز" v={a.totals.surplus} sub="الراتب − المدفوع" tone={a.totals.surplus < 0 ? 'bad' : 'good'} />
        <Stat k="اتجاه الإنفاق" v={a.trend} sub={a.trend == null ? 'يحتاج 6 أشهر على الأقل' : 'آخر 3 أشهر مقابل الثلاثة قبلها'} tone={a.trend > 0 ? 'bad' : 'good'} signed />
      </div>

      <Card className="p-4">
        <h2 className="text-[15px] font-extrabold">مقارنة آخر 12 شهراً</h2>
        <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-sky/30" />الراتب</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-accent" />المدفوع</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-good" />الادخار</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-1" style={{ height: H + 22 }} role="img" aria-label="أعمدة الراتب والمدفوع لكل شهر">
          {a.rows.map((r, k) => (
            <button key={r.period} onClick={() => setSel(sel === k ? null : k)} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md ${sel === k ? 'bg-accent/10' : ''}`} aria-label={`${r.period}`}>
              <div className="relative flex w-full items-end justify-center" style={{ height: H }}>
                {!r.empty && <div className="absolute bottom-0 w-[80%] rounded-t-sm bg-sky/25" style={{ height: `${(r.salary / max) * 100}%` }} />}
                {!r.empty && <div className={`relative w-[46%] rounded-t-sm ${r.paid > r.salary ? 'bg-bad' : 'bg-accent'}`} style={{ height: `${(r.paid / max) * 100}%` }} />}
                {!r.empty && r.saved > 0 && <div className="absolute bottom-0 left-[10%] w-[18%] rounded-t-sm bg-good" style={{ height: `${(r.saved / max) * 100}%` }} />}
                {r.empty && <div className="h-0.5 w-[60%] rounded bg-line" />}
              </div>
              <span className="text-[9px] font-bold text-muted">{short(r.period)}</span>
            </button>
          ))}
        </div>
        {cur && (
          <div className="mt-3 rounded-xl bg-surface2 px-3 py-2 text-[13px]">
            {cur.empty ? <p className="text-muted">لا توجد بيانات لـ {cur.period}.</p> : (
              <>
                <p className="font-extrabold">{monthName(cur.label)}</p>
                <p className="num text-muted">الراتب {fmtShort(cur.salary)} · المخطط {fmtShort(cur.planned)} · المدفوع {fmtShort(cur.paid)} · الادخار {fmtShort(cur.saved)}</p>
                <p className={`num font-bold ${cur.surplus < 0 ? 'text-bad' : 'text-good'}`}>{cur.surplus < 0 ? 'عجز' : 'فائض'} {fmtShort(Math.abs(cur.surplus))} ر.ع</p>
              </>
            )}
          </div>
        )}
        {a.totals.months < 2 && <p className="mt-3 text-xs text-muted">ستكتمل المقارنة كلما بدأت أشهراً جديدة من قائمة الأشهر.</p>}
      </Card>

      <Card className="p-4">
        <h2 className="text-[15px] font-extrabold">أكثر البنود استهلاكاً</h2>
        {a.top.length === 0 ? <p className="mt-2 text-sm text-muted">لا توجد عمليات بعد.</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {a.top.map((t) => (
              <li key={t.id}>
                <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-bold">{t.name}</span><span className="num font-bold">{fmtShort(t.paid)} <span className="text-[10px] text-muted">ر.ع</span></span></div>
                <Progress value={t.paid / a.top[0].paid} tone="good" h="h-1.5" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
function Stat({ k, v, sub, tone, signed: sg }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-bold text-muted">{k}</p>
      <p className={`num mt-0.5 text-xl font-extrabold ${tone ? TONE[tone].text : ''}`} dir="ltr">{v == null ? '—' : sg ? signed(v) : fmtShort(v)}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </Card>
  );
}

// ================= تبويب الأدوات =================
const TOOLS = [
  { id: 'behavior', title: 'تحليل سلوك الإنفاق', sub: 'المخطط مقابل الفعلي واقتراحات توفير عملية', icon: Lightbulb },
  { id: 'debts', title: 'الديون والالتزامات', sub: 'الرصيد المتبقي والأقساط وتاريخ الانتهاء', icon: HandCoins },
  { id: 'goals', title: 'أهداف الادخار', sub: 'نسبة الإنجاز والمطلوب شهرياً', icon: Target },
  { id: 'scenario', title: 'محاكاة السيناريوهات', sub: 'جرّب تغييرات دون المساس ببياناتك', icon: FlaskConical },
  { id: 'reports', title: 'التقارير: PDF و Excel', sub: 'شهري وسنوي: المخطط والفعلي والرصيد', icon: FileSpreadsheet },
  { id: 'backup', title: 'النسخ الاحتياطي والاستعادة', sub: 'تصدير واستيراد كل الأشهر بصيغة JSON', icon: DatabaseBackup },
];

export function ToolsTab({ store, month, act, notify, openReport, view, setView }) {
  const tool = TOOLS.find((t) => t.id === view);
  if (!tool) {
    return (
      <div className="flex flex-col gap-4 fade-in">
        <div><h1 className="text-2xl font-extrabold">الأدوات</h1><p className="text-sm text-muted">تخطيط ومتابعة طويلة المدى</p></div>
        <Card>
          <ul className="divide-y divide-line">
            {TOOLS.map(({ id, title, sub, icon: Icon }) => (
              <li key={id}>
                <button onClick={() => setView(id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-right">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={19} /></span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-xs text-muted">{sub}</span></span>
                  <ChevronLeft size={18} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 fade-in">
      <div className="flex items-center gap-2">
        <button onClick={() => setView(null)} aria-label="رجوع للأدوات" className="grid h-10 w-10 place-items-center rounded-xl bg-surface2"><ArrowRight size={19} /></button>
        <h1 className="text-xl font-extrabold">{tool.title}</h1>
      </div>
      {view === 'behavior' && <SpendingBehavior store={store} />}
      {view === 'debts' && <Debts store={store} month={month} act={act} notify={notify} />}
      {view === 'goals' && <Goals store={store} month={month} act={act} notify={notify} />}
      {view === 'scenario' && <Scenario month={month} />}
      {view === 'reports' && <Reports store={store} month={month} openReport={openReport} notify={notify} />}
      {view === 'backup' && <Backup store={store} act={act} notify={notify} />}
    </div>
  );
}

// ---------- الديون ----------
function Debts({ store, month, act, notify }) {
  const [edit, setEdit] = useState(null);
  const [pay, setPay] = useState(null);
  const today = todayISO();
  const debts = store.debts;
  const total = r3(debts.reduce((a, d) => a + debtStatus(d, store, today).remaining, 0));
  return (
    <>
      {debts.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-bold text-muted">إجمالي الديون المتبقية</p>
          <p className="text-2xl font-extrabold"><Money v={total} /></p>
        </Card>
      )}
      {debts.map((d) => {
        const st = debtStatus(d, store, today);
        const linked = month.categories.find((c) => c.id === d.linkedCatId);
        return (
          <Card key={d.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{d.name}</p>
                <p className="text-xs text-muted">القسط {fmtShort(d.installment)} ر.ع{d.dueDay ? ` · يوم ${d.dueDay} من كل شهر` : ''}{linked ? ` · مرتبط ببند «${linked.name}»` : ''}</p>
              </div>
              <button onClick={() => setEdit(d)} aria-label={`تعديل ${d.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><Pencil size={15} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat k="المتبقي" v={fmtShort(st.remaining)} strong />
              <MiniStat k="المسدَّد" v={fmtShort(st.paidTotal)} />
              <MiniStat k="أقساط متبقية" v={st.installmentsLeft ?? '—'} />
            </div>
            <Progress value={st.pct} tone={st.remaining <= 0 ? 'done' : 'good'} />
            {st.remaining <= 0 ? <p className="text-sm font-bold text-good">سُدّد بالكامل</p> : (
              <div className="flex flex-col gap-1 text-[13px]">
                <p className="text-muted">الانتهاء المتوقع: <b className="text-ink">{st.endDate ? dateLabel(st.endDate) : 'حدّد قيمة القسط'}</b></p>
                {st.next.length > 0 && (
                  <p className="text-muted">الأقساط القادمة: {st.next.map((n) => `${dateLabel(n.date)} (${fmtShort(n.amount)})`).join('، ')}</p>
                )}
              </div>
            )}
            <button onClick={() => setPay(d)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-bold text-accent"><Plus size={15} />دفعة خارج التطبيق</button>
          </Card>
        );
      })}
      {debts.length === 0 && <Empty icon={HandCoins} title="لا توجد ديون مسجلة" text="أضف قرضاً أو التزاماً لمتابعة رصيده المتبقي وأقساطه القادمة وموعد انتهائه." />}
      <button onClick={() => setEdit({})} className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 font-bold text-accent"><Plus size={18} />إضافة دين أو التزام</button>
      <p className="text-xs leading-relaxed text-muted">عند ربط الدين ببند (مثل «الدين»)، تُخصم كل عملية تسجلها على هذا البند من رصيد الدين تلقائياً، بدءاً من تاريخ الرصيد الذي أدخلته.</p>

      {edit && (
        <DebtSheet debt={edit.id ? edit : null} items={month.categories} onClose={() => setEdit(null)}
          onDelete={(id) => { act.delDebt(id); setEdit(null); notify('تم حذف الدين'); }}
          onSave={(d) => { act.saveDebt(d); setEdit(null); notify('تم حفظ الدين'); }} />
      )}
      {pay && (
        <AmountSheet title={`دفعة على «${pay.name}»`} hint="لدفعة لم تسجلها كمصروف في التطبيق، مثل سداد مبكر. لا تغيّر رصيد الراتب."
          onClose={() => setPay(null)} onSave={(amount, date) => { act.saveDebt({ ...pay, payments: [...(pay.payments || []), { id: uid(), amount, date }] }); setPay(null); notify('سُجلت الدفعة'); }} />
      )}
    </>
  );
}
function MiniStat({ k, v, strong }) {
  return <div className="rounded-xl bg-surface2 px-2 py-2"><p className="text-[10px] font-bold text-muted">{k}</p><p className={`num ${strong ? 'text-lg font-extrabold' : 'font-bold'}`}>{v}</p></div>;
}
function Empty({ icon: Icon, title, text }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent"><Icon size={24} /></span>
      <p className="font-extrabold">{title}</p><p className="text-sm text-muted">{text}</p>
    </Card>
  );
}
function DebtSheet({ debt, items, onSave, onDelete, onClose }) {
  const [f, setF] = useState(() => ({
    name: debt?.name || '', opening: debt ? String(debt.opening) : '', asOf: debt?.asOf || todayISO(),
    installment: debt ? String(debt.installment || '') : '', dueDay: debt?.dueDay ? String(debt.dueDay) : '', linkedCatId: debt?.linkedCatId ?? (items.some((c) => c.id === 'debt') ? 'debt' : ''),
  }));
  const [err, setErr] = useState('');
  const [del, setDel] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const submit = () => {
    const opening = parseFloat(f.opening), inst = f.installment === '' ? 0 : parseFloat(f.installment), day = f.dueDay === '' ? null : parseInt(f.dueDay, 10);
    if (!f.name.trim()) return setErr('اكتب اسم الدين.');
    if (isNaN(opening) || opening < 0) return setErr('أدخل الرصيد المتبقي الحالي للدين.');
    if (isNaN(inst) || inst < 0) return setErr('قيمة القسط غير صحيحة.');
    if (day != null && (isNaN(day) || day < 1 || day > 31)) return setErr('يوم الاستحقاق بين 1 و31.');
    onSave({ ...(debt || { id: `d${uid()}`, payments: [] }), name: f.name.trim(), opening: r3(opening), asOf: f.asOf || todayISO(), installment: r3(inst), dueDay: day, linkedCatId: f.linkedCatId || null });
  };
  return (
    <Sheet title={debt ? 'تعديل الدين' : 'دين أو التزام جديد'} onClose={onClose} onSubmit={submit}
      footer={<>
        {err && <p className="text-sm font-bold text-bad">{err}</p>}
        <PrimaryButton type="submit"><Check size={20} />حفظ</PrimaryButton>
        {debt && (del
          ? <button type="button" onClick={() => onDelete(debt.id)} className="h-11 rounded-xl bg-bad font-bold text-white">تأكيد حذف الدين؟</button>
          : <button type="button" onClick={() => setDel(true)} className="flex h-10 items-center justify-center gap-1.5 text-sm font-bold text-bad"><Trash2 size={15} />حذف الدين</button>)}
      </>}>
      <Field label="الاسم" htmlFor="d-name"><input id="d-name" value={f.name} onChange={set('name')} className="input" placeholder="مثال: قرض السيارة" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الرصيد المتبقي (ر.ع)" htmlFor="d-open"><input id="d-open" type="number" inputMode="decimal" step="0.001" min="0" value={f.opening} onChange={set('opening')} className="input num" /></Field>
        <Field label="في تاريخ" htmlFor="d-asof"><input id="d-asof" type="date" value={f.asOf} onChange={set('asOf')} className="input num" /></Field>
        <Field label="القسط الشهري" htmlFor="d-inst"><input id="d-inst" type="number" inputMode="decimal" step="0.001" min="0" value={f.installment} onChange={set('installment')} className="input num" /></Field>
        <Field label="يوم الاستحقاق" htmlFor="d-day"><input id="d-day" type="number" inputMode="numeric" min="1" max="31" value={f.dueDay} onChange={set('dueDay')} className="input num" placeholder="1–31" /></Field>
      </div>
      <Field label="ربط ببند (اختياري)" htmlFor="d-link" hint="العمليات المسجلة على هذا البند بعد التاريخ أعلاه تُخصم من رصيد الدين.">
        <select id="d-link" value={f.linkedCatId} onChange={set('linkedCatId')} className="input">
          <option value="">بلا ربط</option>
          {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
    </Sheet>
  );
}
function AmountSheet({ title, hint, onSave, onClose }) {
  const [v, setV] = useState('');
  const [d, setD] = useState(todayISO());
  const [err, setErr] = useState('');
  return (
    <Sheet title={title} onClose={onClose} onSubmit={() => { const n = parseFloat(v); if (isNaN(n) || n <= 0) return setErr('أدخل مبلغاً أكبر من صفر.'); onSave(r3(n), d); }}
      footer={<>{err && <p className="text-sm font-bold text-bad">{err}</p>}<PrimaryButton type="submit"><Check size={20} />حفظ</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ (ر.ع)" htmlFor="amt-v"><input id="amt-v" type="number" inputMode="decimal" step="0.001" min="0" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} className="input num text-lg font-bold" autoFocus /></Field>
        <Field label="التاريخ" htmlFor="amt-d"><input id="amt-d" type="date" value={d} onChange={(e) => setD(e.target.value)} className="input num" /></Field>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Sheet>
  );
}

// ---------- أهداف الادخار ----------
function Goals({ store, month, act, notify }) {
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);
  const today = todayISO();
  return (
    <>
      {store.goals.map((g) => {
        const st = goalStatus(g, store, today);
        return (
          <Card key={g.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{g.name}</p>
                <p className="text-xs text-muted">الهدف {fmtShort(g.target)} ر.ع{g.deadline ? ` · بحلول ${g.deadline}` : ''}</p>
              </div>
              <button onClick={() => setEdit(g)} aria-label={`تعديل ${g.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><Pencil size={15} /></button>
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-2xl font-extrabold"><Money v={st.saved} /></p>
              <p className={`num text-lg font-extrabold ${st.done ? 'text-good' : 'text-accent'}`}>{pctText(st.pct)}</p>
            </div>
            <Progress value={st.pct} tone={st.done ? 'done' : 'good'} />
            {st.done ? <p className="text-sm font-bold text-good">تحقق الهدف</p> : (
              <p className="text-[13px] text-muted">
                متبقي <b className="num text-ink">{fmtShort(st.remaining)}</b> ر.ع
                {st.monthsLeft != null && (st.late
                  ? <> · <b className="text-bad">انتهى الموعد</b></>
                  : <> · المطلوب شهرياً <b className="num text-ink">{fmtShort(st.monthly)}</b> ر.ع لمدة <span className="num">{st.monthsLeft}</span> {st.monthsLeft === 1 ? 'شهر' : 'أشهر'}</>)}
              </p>
            )}
            <button onClick={() => setAdd(g)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-bold text-accent"><Plus size={15} />إضافة مبلغ للهدف</button>
          </Card>
        );
      })}
      {store.goals.length === 0 && <Empty icon={Target} title="لا توجد أهداف بعد" text="أنشئ هدفاً مثل صندوق الطوارئ أو بناء المنزل، وسيُحسب المبلغ المطلوب شهرياً للوصول إليه." />}
      <button onClick={() => setEdit({})} className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 font-bold text-accent"><Plus size={18} />هدف جديد</button>
      {edit && (
        <GoalSheet goal={edit.id ? edit : null} items={month.categories} onClose={() => setEdit(null)}
          onDelete={(id) => { act.delGoal(id); setEdit(null); notify('تم حذف الهدف'); }}
          onSave={(g) => { act.saveGoal(g); setEdit(null); notify('تم حفظ الهدف'); }} />
      )}
      {add && (
        <AmountSheet title={`إضافة إلى «${add.name}»`} hint="يُضاف للهدف فقط ولا يُخصم من الراتب. لتحويل يُخصم من الراتب، سجّله كمصروف على بند الادخار المرتبط."
          onClose={() => setAdd(null)} onSave={(amount, date) => { act.saveGoal({ ...add, contributions: [...(add.contributions || []), { id: uid(), amount, date }] }); setAdd(null); notify('أُضيف المبلغ'); }} />
      )}
    </>
  );
}
function GoalSheet({ goal, items, onSave, onDelete, onClose }) {
  const [f, setF] = useState(() => ({
    name: goal?.name || '', target: goal ? String(goal.target) : '', start: goal ? String(goal.start || 0) : '', deadline: goal?.deadline || '',
    linkedCatId: goal?.linkedCatId ?? '',
  }));
  const [err, setErr] = useState('');
  const [del, setDel] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const submit = () => {
    const target = parseFloat(f.target), start = f.start === '' ? 0 : parseFloat(f.start);
    if (!f.name.trim()) return setErr('اكتب اسم الهدف.');
    if (isNaN(target) || target <= 0) return setErr('أدخل مبلغ الهدف.');
    if (isNaN(start) || start < 0) return setErr('المبلغ المدّخر حالياً غير صحيح.');
    onSave({ ...(goal || { id: `g${uid()}`, contributions: [], createdAt: todayISO() }), name: f.name.trim(), target: r3(target), start: r3(start), deadline: f.deadline || null, linkedCatId: f.linkedCatId || null });
  };
  return (
    <Sheet title={goal ? 'تعديل الهدف' : 'هدف ادخار جديد'} onClose={onClose} onSubmit={submit}
      footer={<>
        {err && <p className="text-sm font-bold text-bad">{err}</p>}
        <PrimaryButton type="submit"><Check size={20} />حفظ</PrimaryButton>
        {goal && (del
          ? <button type="button" onClick={() => onDelete(goal.id)} className="h-11 rounded-xl bg-bad font-bold text-white">تأكيد حذف الهدف؟</button>
          : <button type="button" onClick={() => setDel(true)} className="flex h-10 items-center justify-center gap-1.5 text-sm font-bold text-bad"><Trash2 size={15} />حذف الهدف</button>)}
      </>}>
      <Field label="اسم الهدف" htmlFor="g-name"><input id="g-name" value={f.name} onChange={set('name')} className="input" placeholder="مثال: صندوق الطوارئ" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ المستهدف" htmlFor="g-target"><input id="g-target" type="number" inputMode="decimal" step="0.001" min="0" value={f.target} onChange={set('target')} className="input num" /></Field>
        <Field label="مدّخر حالياً" htmlFor="g-start"><input id="g-start" type="number" inputMode="decimal" step="0.001" min="0" value={f.start} onChange={set('start')} className="input num" placeholder="0" /></Field>
      </div>
      <Field label="الموعد المستهدف (اختياري)" htmlFor="g-dl"><input id="g-dl" type="month" value={f.deadline} onChange={set('deadline')} className="input num" /></Field>
      <Field label="ربط ببند ادخار (اختياري)" htmlFor="g-link" hint="العمليات المسجلة على هذا البند من اليوم تُحسب للهدف.">
        <select id="g-link" value={f.linkedCatId} onChange={set('linkedCatId')} className="input">
          <option value="">بلا ربط</option>
          {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
    </Sheet>
  );
}

// ---------- محاكاة السيناريوهات ----------
function Scenario({ month }) {
  const [salaryDelta, setSalaryDelta] = useState('');
  const [budgets, setBudgets] = useState({});
  const [pickItem, setPickItem] = useState('');
  const [extra, setExtra] = useState({ name: '', amount: '' });
  const adj = {
    salaryDelta: parseFloat(salaryDelta) || 0,
    budgets: Object.fromEntries(Object.entries(budgets).filter(([, v]) => v !== '' && !isNaN(parseFloat(v))).map(([k, v]) => [k, parseFloat(v)])),
    extras: parseFloat(extra.amount) > 0 ? [{ name: extra.name || 'قسط جديد', amount: parseFloat(extra.amount) }] : [],
  };
  const c = compareScenario(month, adj, todayISO());
  const changed = adj.salaryDelta || Object.keys(adj.budgets).length || adj.extras.length;
  const rows = [
    ['الراتب', 'salary'], ['المخطط (الموزع)', 'planned'], ['الفائض المخطط', 'plannedBalance'], ['الرصيد المتوقع نهاية الشهر', 'forecast'],
  ];
  return (
    <>
      <p className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-[13px] font-bold text-accent"><ShieldCheck size={16} />تجربة فقط: لا يتغير شيء في بياناتك الفعلية.</p>
      <Card className="flex flex-col gap-3.5 p-4">
        <Field label="تغيير الراتب (+ زيادة / − نقص)" htmlFor="sc-sal">
          <input id="sc-sal" type="number" inputMode="decimal" step="0.001" value={salaryDelta} onChange={(e) => setSalaryDelta(e.target.value)} className="input num" placeholder="مثال: 100" />
        </Field>
        <Field label="تعديل مخصص بند (مثل خفض الإيجار)" htmlFor="sc-item">
          <div className="flex gap-2">
            <select id="sc-item" value={pickItem} onChange={(e) => setPickItem(e.target.value)} className="input">
              <option value="">اختر بنداً…</option>
              {month.categories.filter((x) => !(x.id in budgets)).map((x) => <option key={x.id} value={x.id}>{x.name} ({fmtShort(x.budget)})</option>)}
            </select>
            <button type="button" disabled={!pickItem} onClick={() => { setBudgets({ ...budgets, [pickItem]: String(month.categories.find((x) => x.id === pickItem).budget) }); setPickItem(''); }} className="h-12 shrink-0 rounded-2xl bg-accent px-4 font-bold text-white disabled:opacity-40">إضافة</button>
          </div>
        </Field>
        {Object.entries(budgets).map(([id, v]) => {
          const it = month.categories.find((x) => x.id === id);
          return (
            <div key={id} className="flex items-center gap-2">
              <label htmlFor={`sc-b-${id}`} className="min-w-0 flex-1 truncate text-sm font-bold">{it?.name} <span className="font-normal text-muted">(الحالي {fmtShort(it?.budget || 0)})</span></label>
              <input id={`sc-b-${id}`} type="number" inputMode="decimal" step="0.001" min="0" value={v} onChange={(e) => setBudgets({ ...budgets, [id]: e.target.value })} className="input num w-28" />
              <button type="button" aria-label="إزالة" onClick={() => { const n = { ...budgets }; delete n[id]; setBudgets(n); }} className="grid h-10 w-10 place-items-center rounded-xl text-muted"><Trash2 size={16} /></button>
            </div>
          );
        })}
        <Field label="إضافة قسط أو التزام جديد" htmlFor="sc-ex-n">
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input id="sc-ex-n" value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} className="input" placeholder="الاسم" />
            <input aria-label="مبلغ القسط" type="number" inputMode="decimal" step="0.001" min="0" value={extra.amount} onChange={(e) => setExtra({ ...extra, amount: e.target.value })} className="input num" placeholder="المبلغ" />
          </div>
        </Field>
      </Card>
      <Card className="p-4">
        <h2 className="text-[15px] font-extrabold">النتيجة</h2>
        <div className="-mx-4 mt-2 overflow-x-auto px-4">
          <table className="rtable">
            <thead><tr><th /><th>الآن</th><th>بعد التغيير</th><th>الفرق</th></tr></thead>
            <tbody>
              {rows.map(([k, key]) => (
                <tr key={key}>
                  <td className="font-bold">{k}</td>
                  <td className={`num ${c.before[key] < 0 ? 'text-bad' : ''}`}>{fmtShort(c.before[key])}</td>
                  <td className={`num font-bold ${c.after[key] < 0 ? 'text-bad' : ''}`}>{fmtShort(c.after[key])}</td>
                  <td className={`num font-bold ${c.diff[key] > 0 ? (key === 'planned' ? 'text-bad' : 'text-good') : c.diff[key] < 0 ? (key === 'planned' ? 'text-good' : 'text-bad') : 'text-muted'}`} dir="ltr">{signed(c.diff[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!changed && <p className="mt-2 text-xs text-muted">أدخل تغييراً لترى أثره.</p>}
        {changed && (
          <p className={`mt-3 text-sm font-bold ${c.after.plannedBalance < 0 ? 'text-bad' : 'text-good'}`}>
            {c.after.plannedBalance < 0 ? `ستحتاج ${fmtShort(-c.after.plannedBalance)} ر.ع إضافية شهرياً لتغطية المخطط.` : `يبقى فائض مخطط ${fmtShort(c.after.plannedBalance)} ر.ع شهرياً.`}
          </p>
        )}
      </Card>
    </>
  );
}

// ---------- التقارير ----------
function Reports({ store, month, openReport, notify }) {
  const { cardName, sectionName } = useMeta();
  const [busy, setBusy] = useState('');
  const run = async (key, fn) => {
    setBusy(key);
    try { const r = await fn(); if (r === 'downloaded') notify('تم تنزيل الملف'); } catch (e) { notify('تعذّر إنشاء الملف'); } finally { setBusy(''); }
  };
  const end = month.period;
  const items = [
    { k: 'pdf-m', icon: FileText, t: 'تقرير PDF شهري', s: `${monthName(month.label)}: المخطط والفعلي والرصيد والرسوم`, on: () => openReport('month') },
    { k: 'pdf-y', icon: FileText, t: 'تقرير PDF سنوي', s: `آخر 12 شهراً حتى ${end}`, on: () => openReport('year') },
    { k: 'xl-m', icon: FileSpreadsheet, t: 'ملف Excel شهري', s: 'الملخص، المخطط والفعلي، العمليات', on: () => run('xl-m', () => shareOrDownload(monthWorkbook(month, cardName, sectionName, todayISO()), `salary-${month.period}.xlsx`, month.label)) },
    { k: 'xl-y', icon: FileSpreadsheet, t: 'ملف Excel سنوي', s: 'مقارنة 12 شهراً وأكثر البنود', on: () => run('xl-y', () => shareOrDownload(annualWorkbook(store, end), `salary-year-${end}.xlsx`, 'التقرير السنوي')) },
  ];
  return (
    <Card>
      <ul className="divide-y divide-line">
        {items.map(({ k, icon: Icon, t, s, on }) => (
          <li key={k}>
            <button onClick={on} disabled={!!busy} className="flex w-full items-center gap-3 px-4 py-3.5 text-right disabled:opacity-60">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">{busy === k ? <LoaderCircle size={19} className="animate-spin" /> : <Icon size={19} />}</span>
              <span className="min-w-0 flex-1"><span className="block font-bold">{t}</span><span className="block text-xs text-muted">{s}</span></span>
              <Download size={17} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- النسخ الاحتياطي والاستعادة ----------
function Backup({ store, act, notify }) {
  const fileRef = useRef(null);
  const [check, setCheck] = useState(null); // نتيجة التحقق من ملف الاستيراد
  const [text, setText] = useState('');
  const [paste, setPaste] = useState(false);
  const [copyBox, setCopyBox] = useState('');
  const [snaps, setSnaps] = useState(listSnapshots);
  const [ask, setAsk] = useState(null);
  const counts = { months: store.months.length, tx: store.months.reduce((a, m) => a + m.transactions.length, 0) };

  const doExport = async () => {
    const b = makeBackup(store);
    const json = JSON.stringify(b, null, 1);
    // تحقق ذاتي قبل التسليم: يجب أن تُقرأ النسخة كما كُتبت
    const self = validateBackup(json);
    if (!self.ok) { notify('تعذّر التحقق من النسخة، لم يتم التصدير'); return; }
    const name = `salary-backup-${todayISO()}.json`;
    try {
      const r = await shareOrDownload(new Blob([json], { type: 'application/json' }), name, 'نسخة احتياطية');
      if (r === 'downloaded') notify('تم تنزيل النسخة الاحتياطية');
    } catch (e) { setCopyBox(json); }
  };
  const copyJson = async () => {
    const json = JSON.stringify(makeBackup(store));
    try { await navigator.clipboard.writeText(json); notify('نُسخت النسخة الاحتياطية كنص'); } catch (e) { setCopyBox(json); }
  };
  const readFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setCheck(validateBackup(String(rd.result)));
    rd.onerror = () => setCheck({ ok: false, errors: ['تعذّرت قراءة الملف.'], warnings: [] });
    rd.readAsText(f);
  };
  const applyImport = () => {
    saveSnapshot(store, 'قبل الاستيراد');
    act.importStore(check.store);
    setSnaps(listSnapshots());
    setCheck(null); setText(''); setPaste(false);
    notify('تمت الاستعادة، وحُفظت نسخة تلقائية من بياناتك السابقة');
  };
  return (
    <>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-extrabold">تصدير نسخة احتياطية</h2>
        <p className="text-[13px] text-muted">ملف JSON واحد يضم كل الأشهر (<span className="num">{counts.months}</span>) والعمليات (<span className="num">{counts.tx}</span>) والديون والأهداف، مع بصمة للتحقق من سلامته عند الاستعادة.</p>
        <PrimaryButton onClick={doExport}><Download size={20} />تصدير / مشاركة النسخة</PrimaryButton>
        <button onClick={copyJson} className="flex h-10 items-center justify-center gap-1.5 text-sm font-bold text-accent"><Copy size={15} />نسخ كنص بدلاً من ملف</button>
        {copyBox && <textarea readOnly value={copyBox} rows={4} className="input h-auto py-2 text-[11px]" onFocus={(e) => e.target.select()} aria-label="النسخة الاحتياطية كنص" />}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-extrabold">استعادة من نسخة</h2>
        <p className="text-[13px] text-muted">يُفحص الملف أولاً، ولا يُستبدل شيء قبل تأكيدك. تُحفظ نسخة تلقائية من بياناتك الحالية قبل الاستبدال.</p>
        <input ref={fileRef} type="file" accept="application/json,.json,text/plain" onChange={readFile} className="hidden" id="restore-file" />
        <button onClick={() => fileRef.current && fileRef.current.click()} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 font-bold text-accent"><Upload size={18} />اختيار ملف النسخة</button>
        {paste ? (
          <div className="flex flex-col gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input h-auto py-2 text-[11px]" placeholder="الصق نص النسخة الاحتياطية هنا" aria-label="نص النسخة" />
            <button onClick={() => setCheck(validateBackup(text))} disabled={!text.trim()} className="h-11 rounded-xl bg-accent font-bold text-white disabled:opacity-40">فحص النص</button>
          </div>
        ) : <button onClick={() => setPaste(true)} className="text-sm font-bold text-accent">أو لصق النص يدوياً</button>}

        {check && (
          check.ok ? (
            <div className="flex flex-col gap-2 rounded-xl border border-good/30 bg-good/5 p-3 text-[13px]">
              <p className="flex items-center gap-1.5 font-extrabold text-good"><ShieldCheck size={16} />الملف سليم</p>
              <p className="text-muted"><span className="num">{check.stats.months}</span> أشهر · <span className="num">{check.stats.transactions}</span> عملية · <span className="num">{check.stats.debts}</span> ديون · <span className="num">{check.stats.goals}</span> أهداف{check.stats.exportedAt ? ` · صُدّرت ${dateLabel(check.stats.exportedAt.slice(0, 10))}` : ''}</p>
              {check.warnings.map((w, k) => <p key={k} className="text-warn">{w}</p>)}
              <p className="font-bold">سيحلّ محل كل بياناتك الحالية.</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={applyImport} className="h-11 rounded-xl bg-accent font-bold text-white">استعادة</button>
                <button onClick={() => setCheck(null)} className="h-11 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 rounded-xl border border-bad/30 bg-bad/5 p-3 text-[13px]">
              <p className="font-extrabold text-bad">لم تتم الاستعادة: الملف غير صالح</p>
              {check.errors.map((e, k) => <p key={k} className="text-bad">• {e}</p>)}
              {check.more > 0 && <p className="text-muted">و{check.more} أخطاء أخرى.</p>}
              <p className="text-muted">بياناتك الحالية لم تتغير.</p>
            </div>
          )
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-extrabold">النسخ التلقائية</h2>
        <p className="text-[13px] text-muted">تُحفظ تلقائياً على هذا الجهاز قبل المسح أو حذف شهر أو الاستيراد (آخر 5).</p>
        {snaps.length === 0 && <p className="text-sm text-muted">لا توجد نسخ تلقائية بعد.</p>}
        {snaps.map((sn, k) => (
          <div key={k} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-[13px]">
            <span className="min-w-0 flex-1"><b>{sn.reason}</b><span className="block text-[11px] text-muted">{new Date(sn.at).toLocaleString('ar-u-nu-latn')} · <span className="num">{sn.store?.months?.length || 0}</span> أشهر</span></span>
            {ask === k
              ? <button onClick={() => { const v = validateBackup(sn.store); if (!v.ok) { notify('النسخة التلقائية تالفة'); return; } saveSnapshot(store, 'قبل استعادة نسخة تلقائية'); act.importStore(v.store); setSnaps(listSnapshots()); setAsk(null); notify('تمت الاستعادة'); }} className="h-9 rounded-lg bg-accent px-3 text-xs font-bold text-white">تأكيد</button>
              : <button onClick={() => setAsk(k)} className="flex h-9 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-bold text-accent"><RotateCcw size={13} />استعادة</button>}
          </div>
        ))}
      </Card>
    </>
  );
}

export { periodOf, addMonths };
