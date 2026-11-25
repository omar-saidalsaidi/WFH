// واجهة «تحليل سلوك الإنفاق»
import React, { useMemo, useState } from 'react';
import { RefreshCw, Info, ShieldCheck, Lightbulb, PiggyBank, ChevronDown, Calculator, Check } from 'lucide-react';
import { Card } from './ui.jsx';
import { fmtShort, todayISO } from './data.js';
import { analyzeSpending, simulateSavings, KINDS, KIND_ORDER } from './insights.js';

const STATUS = {
  over: { t: 'تجاوز الميزانية', c: 'bg-bad/10 text-bad' },
  trend: { t: 'زيادة غير معتادة', c: 'bg-warn/12 text-warn' },
  warn: { t: 'التزام تجاوز مخصصه', c: 'bg-warn/12 text-warn' },
  underused: { t: 'مخصص غير مستغل', c: 'bg-accent/10 text-accent' },
  info: { t: 'ملاحظة', c: 'bg-surface2 text-muted' },
  ok: { t: 'ضمن الميزانية', c: 'bg-good/10 text-good' },
};
const PRIORITY = { high: { t: 'أولوية عالية', c: 'bg-bad text-white' }, medium: { t: 'أولوية متوسطة', c: 'bg-warn text-white' }, low: { t: 'أولوية منخفضة', c: 'bg-surface2 text-muted' } };
const pct1 = (x) => `${Math.round(x * 1000) / 10}٪`;
const monthWord = (l) => (l || '').replace(/^راتب شهر /, '');

export function SpendingBehavior({ store, act, notify }) {
  const [nonce, setNonce] = useState(0);
  const [at, setAt] = useState(() => new Date());
  const [refPeriod, setRefPeriod] = useState('');
  const [fSection, setFSection] = useState('');
  const [fItem, setFItem] = useState('');
  const [fPriority, setFPriority] = useState('attention');
  const r = useMemo(() => analyzeSpending(store, { today: todayISO(), refPeriod: refPeriod || null }), [store, nonce, refPeriod]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => { setNonce((n) => n + 1); setAt(new Date()); notify('تم تحديث التحليل'); };
  const active = store.months.find((m) => m.id === store.activeId);

  const header = (
    <div className="flex flex-col gap-2">
      <p className="-mt-2 text-sm text-muted">مساعدك الذكي لتحسين إدارة المصروفات والادخار</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">آخر تحديث {at.toLocaleTimeString('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</p>
        <button onClick={refresh} className="flex h-9 items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 text-sm font-bold text-accent"><RefreshCw size={15} />تحديث التحليل</button>
      </div>
    </div>
  );
  const privacy = (
    <p className="flex items-start gap-2 rounded-xl bg-surface2 px-3 py-2 text-[11px] leading-relaxed text-muted">
      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-good" />
      يعمل التحليل على جهازك فقط بقواعد حسابية واضحة على عملياتك المسجلة، وليس ذكاءً اصطناعياً أو تنبؤاً. لا تُرسل بياناتك المالية إلى أي جهة. مبالغ التوفير تقديرية وليست مضمونة.
    </p>
  );

  if (r.status === 'empty') {
    return (
      <>
        {header}
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent"><Lightbulb size={24} /></span>
          <p className="font-extrabold">لا توجد بيانات كافية للتحليل</p>
          <p className="text-sm text-muted">{r.message}</p>
        </Card>
        {privacy}
      </>
    );
  }

  const s = r.summary;
  const sections = [...new Map(r.items.filter((x) => x.sectionId).map((x) => [x.sectionId, x.section])).entries()];
  const shown = r.items.filter((x) => (!fSection || x.sectionId === fSection)
    && (!fItem.trim() || x.name.includes(fItem.trim()))
    && (fPriority === 'all' || (fPriority === 'attention' ? x.priority !== 'none' : x.priority === fPriority)));
  const adh = s.adherence;
  const adhLabel = adh == null ? '—' : adh >= 0.9 ? 'ممتاز' : adh >= 0.7 ? 'جيد' : 'يحتاج تحسيناً';

  const setKind = (x, kind) => {
    if (!active.categories.some((c) => c.id === x.id)) { notify('البند غير موجود في الشهر الحالي'); return; }
    act.sectionOp({ type: 'updateItem', id: x.id, patch: { kind } }, 'current');
    notify(`صُنّف «${x.name}»: ${KINDS[kind].label}`);
  };

  return (
    <>
      {header}
      {r.notes.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5 text-[13px] text-warn">
          {r.notes.map((n, k) => <p key={k} className="flex items-start gap-1.5"><Info size={15} className="mt-0.5 shrink-0" />{n}</p>)}
        </div>
      )}

      {/* لوحة المؤشرات */}
      <Card className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-xs font-bold text-muted">لوحة التحليل · {monthWord(s.month)}{s.current ? ' (حتى اليوم)' : ''}</p>
          <p className="mt-1 text-sm">حُلّلت <b className="num">{r.monthsAnalyzed}</b> {r.monthsAnalyzed === 1 ? 'شهر' : 'أشهر'} فيها عمليات، منها <b className="num">{r.completedMonths}</b> مكتملة.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Tile k="إجمالي تجاوز الميزانية" v={`${fmtShort(s.overTotal)} ر.ع`} sub={`${s.overCount} بنود`} tone={s.overTotal > 0 ? 'bad' : ''} />
          <Tile k="فرص التوفير الشهرية" v={`${fmtShort(s.monthlySaving)} ر.ع`} sub="تقديرية" tone="good" icon={PiggyBank} />
          <Tile k="فرص التوفير السنوية" v={`${fmtShort(s.annualSaving)} ر.ع`} sub="إن استمر التخفيض" tone="good" />
          <Tile k="مستوى الالتزام بالميزانية" v={adh == null ? '—' : pct1(adh)} sub={adhLabel} tone={adh != null && adh < 0.7 ? 'warn' : ''} />
          <Tile k="بنود تحتاج إلى مراجعة" v={s.review} sub="حسب الأولوية" />
          <Tile k="اتجاه الإنفاق الشهري" v={s.monthTrend ? `${s.monthTrend.change > 0 ? '+' : ''}${fmtShort(s.monthTrend.change)} ر.ع` : '—'}
            sub={s.monthTrend ? 'مقابل متوسط الأشهر السابقة' : 'يحتاج شهرين مكتملين'} tone={s.monthTrend && s.monthTrend.change > 0 ? 'bad' : ''} />
        </div>
        {s.freed > 0 && <p className="text-[13px]">يمكن أيضاً تحرير <b className="num">{fmtShort(s.freed)}</b> ر.ع شهرياً من مخصصات لا تُستغل (غير محسوبة في التوفير أعلاه).</p>}
      </Card>

      <Simulator report={r} active={active} act={act} notify={notify} />

      {/* التصفية */}
      <Card className="flex flex-col gap-2 p-3">
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="الشهر" value={refPeriod} onChange={(e) => setRefPeriod(e.target.value)} className="input h-10 text-sm">
            <option value="">آخر شهر مكتمل</option>
            {r.availableMonths.map((m) => <option key={m.period} value={m.period}>{monthWord(m.label)}</option>)}
          </select>
          <select aria-label="الفئة" value={fSection} onChange={(e) => setFSection(e.target.value)} className="input h-10 text-sm">
            <option value="">كل الفئات</option>
            {sections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <input aria-label="بحث عن بند" value={fItem} onChange={(e) => setFItem(e.target.value)} className="input h-10 text-sm" placeholder="ابحث عن بند" />
        <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto" role="tablist" aria-label="الأولوية">
          {[['attention', 'تحتاج انتباهاً'], ['high', 'عالية'], ['medium', 'متوسطة'], ['low', 'منخفضة'], ['all', 'الكل']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={fPriority === k} onClick={() => setFPriority(k)} className={`pill text-xs ${fPriority === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
          ))}
        </div>
      </Card>

      {shown.length === 0 && <Card className="p-5 text-center text-sm text-muted">لا توجد بنود مطابقة للتصفية.</Card>}
      {shown.map((x) => <InsightCard key={x.id} x={x} onKind={(k) => setKind(x, k)} />)}
      {privacy}
    </>
  );
}

function Tile({ k, v, sub, tone, icon: Icon }) {
  const c = tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : '';
  return (
    <div className={`rounded-xl p-3 ${tone === 'good' ? 'bg-good/10' : 'bg-surface2'}`}>
      <p className="flex items-center gap-1 text-[11px] font-bold text-muted">{Icon && <Icon size={13} />}{k}</p>
      <p className={`num text-xl font-extrabold ${c}`} dir="auto">{v}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}

function Simulator({ report, active, act, notify }) {
  const [mode, setMode] = useState(10);
  const [custom, setCustom] = useState('');
  const [unit, setUnit] = useState('pct');
  const [confirm, setConfirm] = useState(false);
  const val = parseFloat(custom);
  const opts = mode === 'custom' ? (unit === 'pct' ? { pct: isNaN(val) ? 0 : val } : { amount: isNaN(val) ? 0 : val }) : { pct: mode };
  const sim = simulateSavings(report, opts);
  if (!sim) return null;
  const patch = sim.budgetPatch.filter((p) => active.categories.some((c) => c.id === p.id && !c.archived));
  const apply = () => {
    for (const p of patch) act.sectionOp({ type: 'updateItem', id: p.id, patch: { budget: p.to } }, 'current');
    setConfirm(false);
    notify(`عُدّلت مخصصات ${patch.length} بنود في الشهر الحالي`);
  };
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-1.5 font-extrabold"><Calculator size={17} className="text-accent" />محاكي التوفير</p>
      <p className="-mt-1 text-xs text-muted">يطبّق خفضاً على المصروفات المرنة والاختيارية فقط ({fmtShort(sim.base)} ر.ع في الشهر المرجعي). تجربة فقط، ولا تتغير بياناتك.</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="نسبة الخفض">
        {[5, 10, 15, 20].map((p) => <button key={p} type="button" role="radio" aria-checked={mode === p} onClick={() => setMode(p)} className={`pill ${mode === p ? 'pill-on' : 'pill-off'}`}>{p}٪</button>)}
        <button type="button" role="radio" aria-checked={mode === 'custom'} onClick={() => setMode('custom')} className={`pill ${mode === 'custom' ? 'pill-on' : 'pill-off'}`}>مخصص</button>
      </div>
      {mode === 'custom' && (
        <div className="flex gap-2">
          <input aria-label="قيمة الخفض" type="number" inputMode="decimal" min="0" step="0.001" value={custom} onChange={(e) => setCustom(e.target.value)} className="input num h-11" placeholder="0" />
          <select aria-label="نوع القيمة" value={unit} onChange={(e) => setUnit(e.target.value)} className="input h-11 w-28"><option value="pct">٪</option><option value="amount">ر.ع</option></select>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-xl bg-surface2 p-2.5"><dt className="text-[11px] text-muted">المصروفات الشهرية</dt><dd className="num font-extrabold">{fmtShort(sim.expensesBefore)} ← {fmtShort(sim.expensesAfter)}</dd></div>
        <div className="rounded-xl bg-surface2 p-2.5"><dt className="text-[11px] text-muted">الرصيد المتبقي الشهري</dt><dd className="num font-extrabold">{fmtShort(sim.balanceBefore)} ← {fmtShort(sim.balanceAfter)}</dd></div>
        <div className="rounded-xl bg-good/10 p-2.5"><dt className="text-[11px] text-muted">التوفير الشهري المحتمل</dt><dd className="num font-extrabold text-good">{fmtShort(sim.monthly)} ر.ع</dd></div>
        <div className="rounded-xl bg-good/10 p-2.5"><dt className="text-[11px] text-muted">التوفير السنوي المحتمل</dt><dd className="num font-extrabold text-good">{fmtShort(sim.annual)} ر.ع</dd></div>
      </dl>
      {sim.reduction > 0 && patch.length > 0 && (confirm ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-[13px]">
          <p className="font-bold">تعديل مخصصات {patch.length} بنود في «{monthWord(active.label)}» فقط:</p>
          <ul className="num text-xs text-muted">{patch.map((p) => <li key={p.id}>{p.name}: {fmtShort(p.from)} ← {fmtShort(p.to)}</li>)}</ul>
          <p className="text-xs text-muted">لا تتغير العمليات المسجلة ولا الأشهر الأخرى.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={apply} className="flex h-10 items-center justify-center gap-1 rounded-xl bg-accent font-bold text-white"><Check size={16} />تأكيد التعديل</button>
            <button type="button" onClick={() => setConfirm(false)} className="h-10 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="h-10 rounded-xl border border-accent/30 text-sm font-bold text-accent">تطبيق كتعديل على المخصصات…</button>
      ))}
    </Card>
  );
}

function InsightCard({ x, onKind }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[x.status];
  const pr = PRIORITY[x.priority];
  const max = Math.max(1, ...x.history.map((h) => Math.max(h.planned, h.paid)));
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold">الفئة: {x.name}</p>
          <p className="text-[11px] text-muted">{x.section ? `${x.section} · ` : ''}{monthWord(x.month)}{x.current ? ' (حتى اليوم)' : ''}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {pr && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pr.c}`}>{pr.t}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.c}`}>{st.t}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <label className="text-muted" htmlFor={`kind-${x.id}`}>التصنيف:</label>
        <select id={`kind-${x.id}`} value={x.kind} onChange={(e) => onKind(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-bold">
          {KIND_ORDER.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
        </select>
        {x.autoClass && <span className="rounded-full bg-warn/12 px-2 py-0.5 font-bold text-warn">تصنيف تلقائي — راجِعه</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
        <Kv k="الميزانية المحددة" v={`${fmtShort(x.planned)} ر.ع`} />
        <Kv k="المصروف الفعلي" v={`${fmtShort(x.paid)} ر.ع`} />
        {x.excess > 0 && <Kv k="تجاوز الميزانية" v={`${fmtShort(x.excess)} ر.ع`} bad />}
        {x.excess > 0 && x.excessPct != null && <Kv k="نسبة التجاوز" v={pct1(x.excessPct)} bad />}
        {x.months > 1 && <Kv k="متوسط الصرف الشهري" v={`${fmtShort(x.avgPaid)} ر.ع`} />}
        {x.trend && <Kv k="التغير عن المتوسط السابق" v={`${x.trend.change > 0 ? '+' : ''}${fmtShort(x.trend.change)} ر.ع`} bad={x.trend.unusual} />}
      </dl>
      {x.history.length > 1 && (
        <div className="flex h-12 items-end gap-1" role="img" aria-label="الصرف الشهري لهذا البند">
          {x.history.map((h) => (
            <div key={h.period} className="relative flex flex-1 items-end justify-center" style={{ height: '100%' }} title={h.period}>
              <div className="absolute bottom-0 w-full rounded-t-sm bg-sky/20" style={{ height: `${(h.planned / max) * 100}%` }} />
              <div className={`relative w-1/2 rounded-t-sm ${h.paid > h.planned ? 'bg-bad' : 'bg-accent'}`} style={{ height: `${(h.paid / max) * 100}%`, minHeight: h.paid ? 2 : 0 }} />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5 rounded-xl bg-surface2 p-3 text-[13px] leading-relaxed">
        <p><b>الملاحظة: </b>{x.observation}</p>
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-accent"><Lightbulb size={14} />التوصية</p>
        <p>{x.recommendation}</p>
        {x.notes.map((t, k) => <p key={k} className="text-muted">{t}</p>)}
        {x.cut > 0 && (
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div><p className="text-[11px] text-muted">التوفير الشهري المحتمل</p><p className="num font-extrabold text-good">{fmtShort(x.cut)} ر.ع</p></div>
            <div><p className="text-[11px] text-muted">التوفير السنوي المحتمل</p><p className="num font-extrabold text-good">{fmtShort(x.annual)} ر.ع</p></div>
          </div>
        )}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-1 flex items-center gap-1 self-start text-xs font-bold text-accent">
          كيف حُسبت؟<ChevronDown size={14} className={open ? 'rotate-180' : ''} />
        </button>
        {open && <p className="text-xs text-muted">{x.explain}</p>}
      </div>
    </Card>
  );
}
function Kv({ k, v, bad }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className={`num font-extrabold ${bad ? 'text-bad' : ''}`}>{v}</dd>
    </div>
  );
}

// «محاكي التوفير» كقسم مستقل: يحسب التحليل فقط عند فتحه
export function SimulatorTool({ store, act, notify }) {
  const r = useMemo(() => analyzeSpending(store, { today: todayISO() }), [store]);
  const active = store.months.find((m) => m.id === store.activeId);
  if (r.status === 'empty') return <Card className="p-5 text-center text-sm text-muted">{r.message}</Card>;
  return (
    <>
      <p className="-mt-2 text-sm text-muted">مبني على {monthWord(r.summary.month)}{r.summary.current ? ' (حتى اليوم)' : ''}. تجربة فقط، ولا تتغير بياناتك إلا بتأكيد صريح.</p>
      <Simulator report={r} active={active} act={act} notify={notify} />
    </>
  );
}
