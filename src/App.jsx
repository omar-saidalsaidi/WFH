import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import {
  Wallet, Plus, Pencil, Check, X, Trash2, Printer, RotateCcw, CircleCheck, Search, Share2, FileText,
  House, ChartPie, ReceiptText, TriangleAlert, Landmark, Smartphone, CreditCard, Users, Building2, HandCoins,
  PiggyBank, Wifi, Zap, Droplets, Fuel, Utensils, ShoppingCart, Popcorn, Wrench, WashingMachine, Scissors,
  Stethoscope, Siren, Tag, Flame, ChevronDown, Copy, Layers, Download, LoaderCircle, ExternalLink, Settings2, CalendarDays, CalendarPlus, LayoutGrid, Palette,
} from 'lucide-react';
import {
  COMPARE_IDS, STORAGE_KEY, STORE_KEY, dateLabel, dayHeading, defaultState, fmt, fmtShort, loadStore, monthFromTemplate, nextPeriod,
  round3, todayISO, uid, saveSnapshot, fmt3,
} from './data.js';
import {
  ITEM_ICONS, ACC_ICONS, SECTION_COLORS, CARD_COLORS, MetaContext, useMeta, Portal, status, TONE,
  Money, DeficitBadge, AccTag, Bar, Card, useModal, useIsDark, RemainChip, RemainBar,
} from './ui.jsx';
import { surfaceFor, accentFor, themeVars, summaryVars } from './colors.js';
import { HeaderCountdown } from './countdownView.jsx';
import { sortItems, itemState, SORT_MODES, DEFAULT_SORT } from './sorting.js';
import { monthSummary, monthAlerts, closingBalance, remainingInfo, toBaisa, sumOMR, pctLabel, spendWarning } from './finance.js';
import { ForecastCard, AlertsCard, PlanActualTable, AnnualView, ToolsTab } from './features.jsx';
import { MonthReport, AnnualReport, annualText } from './reports.jsx';
import { applySectionOp } from './sections.js';
import { ManageSectionsSheet, SectionRenameSheet } from './sectionsView.jsx';
import { ColorPicker } from './colorView.jsx';
import { KINDS, KIND_ORDER } from './insights.js';
import { monthWorkbook, annualWorkbook, shareOrDownload } from './exporters.js';

// ---------- التخزين ----------
function loadOpen() {
  try { const o = JSON.parse(localStorage.getItem(`${STORAGE_KEY}-open`)); if (o && typeof o === 'object') return o; } catch (e) { /* تجاهل */ }
  return { fixed: false, daily: true, temp: false, emergency: false };
}

// ---------- نص التقرير للمشاركة ----------
function reportText(data) {
  const L = [];
  L.push(`تقرير مصاريف الراتب — ${data.label}`);
  L.push(`تاريخ التقرير: ${dateLabel(todayISO())}`);
  L.push('');
  L.push(`الراتب الأساسي: ${fmt(data.salary)} ر.ع`);
  for (const i of data.incomes) L.push(`+ ${i.name}: ${fmt(i.amount)} ر.ع (${dateLabel(i.date)})`);
  L.push(`إجمالي الدخل الإضافي: ${fmt(data.extraIncome)} ر.ع`);
  L.push(`إجمالي الدخل: ${fmt(data.totalIncome)} ر.ع`);
  if (data.carryIn) L.push(`الرصيد المرحّل: ${fmt(data.carryIn)} ر.ع`);
  L.push(`المخطط (الموزع): ${fmt(data.allocated)} ر.ع`);
  L.push(`المدفوع فعلياً: ${fmt(data.spent)} ر.ع`);
  L.push(`الرصيد الفعلي المتاح: ${fmt(data.remaining)} ر.ع`);
  L.push(`المتبقي بعد المخصصات: ${fmt(data.afterAllocations)} ر.ع`);
  L.push(`المتوقع نهاية الشهر: ${fmt(data.summary.forecast)} ر.ع`);
  if (data.spent > data.available) L.push(`⚠️ عجز: تجاوز المدفوع المتاح بـ ${fmtShort(data.spent - data.available)} ر.ع`);
  for (const g of data.groups) {
    L.push('');
    L.push(`▪️ ${g.label} (${fmtShort(g.budget)} ر.ع)`);
    for (const c of g.list) {
      const tail = c.remaining < 0 ? `🔴 عجز ${fmtShort(-c.remaining)}` : `متبقي ${fmtShort(c.remaining)}`;
      const rp = c.rem.pct == null ? 'بلا مخصص' : `النسبة المتبقية ${pctLabel(c.rem.pct)}`;
      L.push(`- ${c.name}: المخصص ${fmtShort(c.planned)} · المصروف ${fmtShort(c.paid)} · ${tail} · ${rp}`);
    }
  }
  if (data.orphan > 0) L.push(`\n(مصروفات لبنود محذوفة: ${fmtShort(data.orphan)} ر.ع)`);
  L.push('');
  L.push(`العمليات (${data.history.length}):`);
  if (!data.history.length) L.push('لا توجد عمليات');
  for (const t of data.history) {
    L.push(`${dateLabel(t.date)} · ${data.catMap[t.catId]?.name || 'بند محذوف'} · ${fmt(t.amount)} ر.ع${t.note ? ` · ${t.note}` : ''}`);
  }
  return L.join('\n');
}

// ---------- التطبيق ----------
export default function App() {
  const [store, setStore] = useState(loadStore);
  const state = store.months.find((m) => m.id === store.activeId) || store.months[0];
  // كل التعديلات تُطبَّق على الشهر النشط فقط
  const setState = (fn) => setStore((st) => ({ ...st, months: st.months.map((m) => (m.id === st.activeId ? fn(m) : m)) }));
  const [monthSheet, setMonthSheet] = useState(false);
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('st4-tab') || 'home'; } catch (e) { return 'home'; } });
  const [report, setReport] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* تجاهل */ } }, [store]);
  useEffect(() => { try { sessionStorage.setItem('st4-tab', tab); } catch (e) { /* تجاهل */ } window.scrollTo(0, 0); }, [tab]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);

  const data = useMemo(() => {
    // كل الأرقام من وحدة الحسابات نفسها (بالبيسة) حتى تتطابق الشاشة والتقارير
    const summary = monthSummary(state, todayISO());
    const sumB = (arr, f) => sumOMR(arr, f);
    const allCats = summary.items.map((i) => ({ ...i, spent: i.paid, budget: i.planned, s: status(i.paid, i.planned) }));
    const catMap = Object.fromEntries(allCats.map((c) => [c.id, c]));
    const cats = allCats.filter((c) => !c.archived); // المؤرشف مخفي من القوائم ومحسوب في الإجماليات
    const groupOf = (list) => {
      const budget = sumB(list, (c) => c.planned);
      const spent = sumB(list, (c) => c.paid);
      return { list, budget, spent, deficit: sumB(list, (c) => Math.max(0, c.paid - c.planned)), remaining: (toBaisa(budget) - toBaisa(spent)) / 1000, rem: remainingInfo(budget, spent) };
    };
    const groups = state.sections.filter((sec) => !sec.archived).map((sec) => ({
      id: sec.id, label: sec.name, short: sec.name, color: SECTION_COLORS[sec.id] || 'rgb(var(--muted))', colorKey: sec.color || null, section: sec,
      ...groupOf(cats.filter((c) => c.group === sec.id)),
    }));
    // البنود المحذوفة: تبقى مصروفاتها محسوبة على البطاقة التي سُجلت عليها
    const orphanTx = state.transactions.filter((t) => !catMap[t.catId]);
    const orphan = summary.orphanPaid;
    const cardGroups = state.cards.map(({ id, name }) => {
      const g = groupOf(cats.filter((c) => c.account === id));
      const extra = sumB(orphanTx.filter((t) => t.account === id), (t) => t.amount)
        + sumB(allCats.filter((c) => c.archived && c.account === id), (c) => c.paid);
      const spent = (toBaisa(g.spent) + toBaisa(extra)) / 1000;
      return { id, label: name, short: name, color: CARD_COLORS[id] || 'rgb(var(--muted))', ...g, spent, deficit: Math.max(0, (toBaisa(spent) - toBaisa(g.budget)) / 1000), remaining: (toBaisa(g.budget) - toBaisa(spent)) / 1000, rem: remainingInfo(g.budget, spent) };
    });
    const accounts = cardGroups.map((g) => ({ id: g.id, label: g.label, limit: g.budget, spent: g.spent }));
    const history = [...state.transactions].sort((a, b) => (a.date === b.date ? b.created - a.created : a.date < b.date ? 1 : -1));
    const cardMap = Object.fromEntries(state.cards.map((c) => [c.id, c.name]));
    const sectionMap = Object.fromEntries(state.sections.map((x) => [x.id, x.name]));
    const meta = { sections: state.sections.filter((x) => !x.archived), allSections: state.sections, cards: state.cards, cardName: (id) => cardMap[id] || id, sectionName: (id) => sectionMap[id] || id };
    return {
      meta, label: state.label, period: state.period, salary: state.salary, carryIn: summary.carryIn, available: summary.available,
      extraIncome: summary.extraIncome, totalIncome: summary.totalIncome, incomes: summary.incomes, afterAllocations: summary.afterAllocations,
      summary, cats, allCats, catMap, groups, cardGroups, accounts, orphan, spent: summary.paid, allocated: summary.planned, remaining: summary.balance, history,
    };
  }, [state]);
  const alerts = useMemo(() => monthAlerts(state, store, todayISO()), [state, store]);
  const [toolView, setToolView] = useState(null);
  const [reportMode, setReportMode] = useState('month');

  const act = {
    addTx: (tx) => setState((s) => ({ ...s, transactions: [...s.transactions, { ...tx, id: uid(), created: Date.now() }] })),
    delTx: (id) => setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
    updateCat: (id, patch) => setState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
    addCat: (c) => setState((s) => ({ ...s, categories: [...s.categories, c] })),
    // حذف البند لا يمسح مصروفاته المسجلة، فتبقى ضمن المصروف الفعلي
    delCat: (id) => setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) })),
    // عمليات الفئات: تُطبَّق على الشهر الحالي فقط أو عليه وعلى الأشهر اللاحقة، ولا تمس الأشهر السابقة
    sectionOp: (op, scope) => { const r = applySectionOp(store, op, scope); setStore(r.store); return r; },
    renameCards: (names) => setState((s) => ({ ...s, cards: s.cards.map((x) => (names[x.id] ? { ...x, name: names[x.id] } : x)) })),
    reset: () => { saveSnapshot(store, 'قبل مسح الشهر'); setState((m) => ({ ...m, ...defaultState() })); },
    setSalary: (salary) => setState((m) => ({ ...m, salary })),
    // إعدادات المظهر العامة: تسري على كل الأشهر ولا تمس البيانات المالية
    setSettings: (patch) => setStore((st) => ({ ...st, settings: { ...st.settings, ...patch } })),
    // الدخل الإضافي: خاص بالشهر النشط فقط، ولا يمس الراتب الأساسي
    saveIncome: (inc) => setState((m) => ({ ...m, incomes: (m.incomes || []).some((x) => x.id === inc.id) ? m.incomes.map((x) => (x.id === inc.id ? inc : x)) : [...(m.incomes || []), inc] })),
    deleteIncome: (id) => setState((m) => ({ ...m, incomes: (m.incomes || []).filter((x) => x.id !== id) })),
    renameMonth: (label) => setState((m) => ({ ...m, label })),
    switchMonth: (id) => setStore((st) => ({ ...st, activeId: id })),
    // شهر جديد: الراتب مستقل، والرصيد المرحّل (فائض أو عجز) لقطة ثابتة لا تتغير تلقائياً
    newMonth: ({ carry } = {}) => setStore((st) => {
      const tpl = st.months.find((m) => m.id === st.activeId) || st.months[st.months.length - 1];
      const latest = st.months.reduce((a, m) => (m.period > a ? m.period : a), tpl.period || '');
      const m = monthFromTemplate(tpl, nextPeriod(latest));
      if (carry) { m.carryIn = closingBalance(tpl); m.carryFromId = tpl.id; }
      return { ...st, months: [...st.months, m], activeId: m.id };
    }),
    setCarry: (carryIn, carryFromId) => setState((m) => ({ ...m, carryIn, carryFromId })),
    deleteMonth: (id) => {
      saveSnapshot(store, 'قبل حذف شهر');
      setStore((st) => {
        const months = st.months.filter((m) => m.id !== id);
        if (!months.length) return st;
        return { ...st, months, activeId: st.activeId === id ? months[months.length - 1].id : st.activeId };
      });
    },
    saveDebt: (d) => setStore((st) => ({ ...st, debts: st.debts.some((x) => x.id === d.id) ? st.debts.map((x) => (x.id === d.id ? d : x)) : [...st.debts, d] })),
    delDebt: (id) => setStore((st) => ({ ...st, debts: st.debts.filter((x) => x.id !== id) })),
    saveGoal: (g) => setStore((st) => ({ ...st, goals: st.goals.some((x) => x.id === g.id) ? st.goals.map((x) => (x.id === g.id ? g : x)) : [...st.goals, g] })),
    delGoal: (id) => setStore((st) => ({ ...st, goals: st.goals.filter((x) => x.id !== id) })),
    importStore: (next) => setStore(next),
  };
  const openSheet = (catId = '') => setSheet({ catId });

  return (
    <MetaContext.Provider value={data.meta}>
    <div className="app-shell min-h-full bg-bg text-ink">
      <header className="sticky z-30 border-b border-line bg-bg/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex max-w-md items-center gap-2 py-2.5">
          <button onClick={() => setMonthSheet(true)} className="min-w-0 flex-1 text-right leading-tight" aria-label={`${data.label}، تغيير الشهر`}>
            <span className="block text-[10px] font-medium text-muted">تتبع مصاريف الراتب</span>
            <span className="flex items-center gap-1 text-[15px] font-extrabold"><span className="min-w-0 break-words">{data.label}</span><ChevronDown size={15} className="shrink-0 text-accent" /></span>
          </button>
          <HeaderCountdown payDay={store.settings.payDay} />
          <button onClick={() => { setReportMode('month'); setReport(true); }} aria-label="تصدير / طباعة التقرير" className="flex h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-accent/30 bg-accent/10 px-2 text-[10px] font-bold leading-none text-accent">
            <FileText size={16} />تصدير / طباعة
          </button>
        </div>
      </header>

      <main className="gutter mx-auto flex max-w-md flex-col gap-5 pt-4 pb-28">
        {tab === 'home' && <HomeTab data={data} store={store} month={state} alerts={alerts} act={act} notify={setToast} openSheet={openSheet} onManageIncome={() => { setToolView('income'); setTab('tools'); }} />}
        {tab === 'stats' && <StatsTab data={data} store={store} />}
        {tab === 'tools' && <ToolsTab store={store} month={state} act={act} notify={setToast} view={toolView} setView={setToolView} openReport={(m) => { setReportMode(m); setReport(true); }} />}
        {tab === 'log' && <LogTab data={data} act={act} notify={setToast} onReport={() => setReport(true)} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} onAdd={() => openSheet()} />

      {sheet && (
        <EntrySheet cats={data.cats} initial={sheet.catId} onClose={() => setSheet(null)}
          onSave={(tx, name) => { act.addTx(tx); setSheet(null); setToast(`سُجّل ${fmtShort(tx.amount)} ر.ع على ${name}`); }} />
      )}

      {report && <ReportModal data={data} store={store} mode={reportMode} onClose={() => { setReport(false); setReportMode('month'); }} notify={setToast} />}
      {monthSheet && (
        <MonthSheet store={store} active={state} onClose={() => setMonthSheet(false)} act={act} notify={setToast} />
      )}

      {toast && (
        <div className="no-print fixed inset-x-0 z-[60] flex justify-center px-4 toast-in" style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }} role="status">
          <div className="flex items-center gap-2 rounded-2xl bg-hero px-4 py-3 text-sm font-bold text-white shadow-lg"><CircleCheck size={18} className="text-good" />{toast}</div>
        </div>
      )}
    </div>
    </MetaContext.Provider>
  );
}

function BottomNav({ tab, setTab, onAdd }) {
  const Tab = ({ id, label, icon: Icon }) => {
    const on = tab === id;
    return (
      <button onClick={() => setTab(id)} aria-current={on ? 'page' : undefined} className={`flex w-full flex-col items-center gap-1 py-1 ${on ? 'text-accent' : 'text-muted'}`}>
        <span className={`grid h-8 w-12 place-items-center rounded-full transition ${on ? 'bg-accent/12' : ''}`}><Icon size={20} strokeWidth={on ? 2.4 : 2} /></span>
        <span className="text-[11px] font-bold leading-none">{label}</span>
      </button>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="التنقل">
      <div className="gutter mx-auto grid max-w-md grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-0.5 py-2">
        <Tab id="home" label="الرئيسية" icon={House} />
        <Tab id="stats" label="التحليل" icon={ChartPie} />
        <button onClick={onAdd} aria-label="تسجيل مصروف" className="flex h-12 items-center gap-1 rounded-2xl bg-accent px-3 text-[14px] font-extrabold text-white active:scale-95 transition">
          <Plus size={19} strokeWidth={2.8} />تسجيل مصروف
        </button>
        <Tab id="log" label="السجل" icon={ReceiptText} />
        <Tab id="tools" label="الأدوات" icon={LayoutGrid} />
      </div>
    </nav>
  );
}

// ================= الرئيسية والبنود =================
const DEFAULT_OPEN = { fixed: false, daily: true, temp: false, emergency: false, salary: false, applepay: true, card1: false, card2: false };

function HomeTab({ data, store, month, alerts, act, notify, openSheet, onManageIncome }) {
  const [open, setOpen] = useState(loadOpen);
  const [view, setView] = useState(() => { try { return localStorage.getItem(`${STORAGE_KEY}-view`) || 'group'; } catch (e) { return 'group'; } });
  const [swiped, setSwiped] = useState(null);
  const [editor, setEditor] = useState(null); // { item } أو { defaults }
  const [rename, setRename] = useState(null); // { kind: 'section' | 'card', id, name }
  const [manageCards, setManageCards] = useState(false);
  const [manageSections, setManageSections] = useState(false);
  const [colorFor, setColorFor] = useState(null);
  const [cardColor, setCardColor] = useState(null); // 'salary' | 'balance'
  const sw = spendWarning(data.spent, store.settings.spendLimit);
  const dark = useIsDark();
  const balanceStyle = summaryVars(store.settings.cardColors.balance, dark)?.vars;
  const salaryStyle = summaryVars(store.settings.cardColors.salary, dark)?.vars;
  const onCardColor = (which) => setCardColor(which);
  useEffect(() => { try { localStorage.setItem(`${STORAGE_KEY}-open`, JSON.stringify(open)); } catch (e) { /* تجاهل */ } }, [open]);
  useEffect(() => { try { localStorage.setItem(`${STORAGE_KEY}-view`, view); } catch (e) { /* تجاهل */ } }, [view]);
  // العجز يُقاس على المتاح (الراتب + الرصيد المرحّل)
  const over = round3(data.spent - data.available);
  const pct = data.available > 0 ? Math.min(100, (data.spent / data.available) * 100) : 100;
  const sections = view === 'card' ? data.cardGroups : data.groups;
  const isOpen = (id) => (open[id] ?? DEFAULT_OPEN[id]) === true;

  // حذف آمن: البند الذي له عمليات يُؤرشف ولا يُحذف، فتبقى عملياته مرتبطة ومحسوبة
  const removeItem = (c) => {
    const r = act.sectionOp({ type: 'deleteItem', id: c.id }, 'current');
    setSwiped(null); setEditor(null);
    notify(r.archived ? `«${c.name}» له عمليات مسجلة، فنُقل إلى الأرشيف بدل حذفه` : `تم حذف بند ${c.name}`);
  };
  const paysOf = (id) => month.transactions.filter((t) => t.catId === id).length;

  return (
    <div className="flex flex-col gap-4 fade-in">
      <div className="summary-cards flex flex-col gap-2.5">
      <section className="balance-card rounded-3xl border border-hpb bg-gradient-to-bl from-hp1 via-hp1 to-hpsec p-4 text-hpink" style={balanceStyle} aria-label="الرصيد المتبقي">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {over > 0 && (
              <div className="mb-3 flex w-fit items-center gap-2 rounded-full bg-bad px-3 py-1.5 text-sm font-extrabold text-white ring-2 ring-white/70">
                <TriangleAlert size={16} />عجز: المصروف تجاوز إجمالي الدخل{data.carryIn ? ' والمرحّل' : ''} بـ <span className="num">{fmtShort(over)}</span> ر.ع
              </div>
            )}
            <p className="text-[13px] font-bold text-hpink/75">الرصيد الفعلي المتاح · {data.label.replace(/^راتب /, '')}</p>
          </div>
          <button onClick={() => onCardColor('balance')} aria-label="لون بطاقة الرصيد المتبقي" className="-me-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-hpink/70"><Palette size={15} /></button>
        </div>
        <p className="mt-1 text-[40px] font-extrabold leading-none">
          {data.remaining < 0
            ? <span className="inline-block rounded-2xl bg-surface px-2 py-1 shadow-sm" style={themeVars(dark)}><Money v={data.remaining} className="text-bad" /></span>
            : <Money v={data.remaining} />}
        </p>
        <p className="num mt-1.5 text-[11px] text-hpink/70">إجمالي الدخل {fmt(data.totalIncome)}{data.carryIn ? ` + مرحّل ${fmt(data.carryIn)}` : ''} − المصروف الفعلي {fmt(data.spent)}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-hpink/12">
          <div className={`h-1.5 rounded-full transition-all duration-700 ${over > 0 || sw.over ? 'bg-bad' : 'bg-hpink/80'}`} style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-1.5 text-center">
          <div className="spend-tile rounded-2xl border border-hpb/70 px-1 py-1.5" data-over={sw.over ? 'true' : 'false'}>
            <dt className="text-[10px] font-bold text-hpink/75">إجمالي المصروف الفعلي</dt>
            <dd className="num text-base font-extrabold">
              {sw.over
                ? <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 text-bad" style={themeVars(dark)}><TriangleAlert size={13} aria-label="تحذير" />{fmt3(data.spent)}</span>
                : fmtShort(data.spent)}
            </dd>
            {sw.over && <dd className="mt-1"><span className="inline-block rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold leading-snug text-bad" style={themeVars(dark)}>تجاوز حد الإنفاق بمقدار <span className="num">{fmt3(sw.excess)}</span> ر.ع</span></dd>}
          </div>
          <div className="rounded-2xl border border-hpb/70 px-1 py-1.5">
            <dt className="text-[10px] font-bold text-hpink/75">المتبقي بعد المخصصات</dt>
            <dd className="num text-base font-extrabold" dir="ltr">
              {data.afterAllocations < 0 ? <span className="rounded-md bg-surface px-1.5 text-bad" style={themeVars(dark)}>{fmtShort(data.afterAllocations)}</span> : fmtShort(data.afterAllocations)}
            </dd>
          </div>
        </dl>
        {data.carryIn !== 0 && (
          <p className="mt-2 rounded-xl bg-hp2/50 px-3 py-1.5 text-center text-xs">
            رصيد مرحّل من الشهر السابق: <b className="num" dir="ltr">{data.carryIn > 0 ? '+' : '−'}{fmtShort(Math.abs(data.carryIn))}</b> ر.ع
          </p>
        )}
      </section>

      <section className="salary-card rounded-3xl border border-hpb bg-gradient-to-bl from-hp1 via-hp1 to-hpsec p-3 text-hpink" style={salaryStyle} aria-label="الراتب الأساسي والدخل">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[12px] font-bold text-hpink/75">الراتب والدخل</p>
          <span className="flex items-center gap-1">
            <button onClick={onManageIncome} className="h-8 rounded-lg px-2 text-[11px] font-bold text-hpink underline-offset-2 hover:underline">إدارة ←</button>
            <button onClick={() => onCardColor('salary')} aria-label="لون بطاقة الراتب الأساسي" className="-me-1 grid h-8 w-9 place-items-center rounded-lg text-hpink/70"><Palette size={14} /></button>
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-2xl bg-hp2/50 px-1 py-2">
            <dt className="text-[10px] font-bold text-hpink/75">الراتب الأساسي</dt>
            <dd className="num mt-0.5 text-[17px] font-extrabold">{fmtShort(data.salary)}</dd>
          </div>
          <div className="rounded-2xl border border-dashed border-hpb bg-hp1/70 px-1 py-2">
            <dt className="text-[10px] font-bold text-hpink/75">الدخل الإضافي</dt>
            <dd className="num mt-0.5 text-[17px] font-extrabold">{fmtShort(data.extraIncome)}</dd>
            <dd className="text-[9px] text-hpink/60">{data.incomes.length ? `${data.incomes.length} مدخلات` : 'لا يوجد'}</dd>
          </div>
          <div className="rounded-2xl bg-hp2/50 px-1 py-2">
            <dt className="text-[10px] font-bold text-hpink/75">إجمالي الدخل</dt>
            <dd className="num mt-0.5 text-[17px] font-extrabold">{fmtShort(data.totalIncome)}</dd>
          </div>
        </dl>
      </section>
      </div>



      <ForecastCard s={data.summary} />
      <AlertsCard alerts={alerts} onOpenItem={(id) => openSheet(id)} />

      <div className="flex items-stretch gap-2">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1" role="tablist" aria-label="طريقة عرض البنود">
          {[['group', 'حسب الفئة', Layers], ['card', 'حسب البطاقة', CreditCard]].map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => { setView(k); setSwiped(null); }}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold transition ${view === k ? 'bg-accent text-white' : 'text-muted'}`}>
              <Icon size={15} />{l}
            </button>
          ))}
        </div>
        <button onClick={() => (view === 'card' ? setManageCards(true) : setManageSections(true))} className="flex w-[78px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-line bg-surface px-1.5 text-[11px] font-bold text-muted">
          <Settings2 size={17} className="text-accent" />{view === 'card' ? 'إدارة البطاقات' : 'إدارة الفئات'}
        </button>
      </div>

      {sections.map((g) => (
        <GroupBlock key={g.id} g={g} view={view} open={isOpen(g.id)} toggle={() => setOpen((o) => ({ ...o, [g.id]: !isOpen(g.id) }))}
          openSheet={openSheet} swiped={swiped} setSwiped={setSwiped} onRemove={removeItem}
          onEdit={(c) => setEditor({ item: c })}
          onRename={() => setRename({ kind: view === 'card' ? 'card' : 'section', id: g.id, name: g.label })}
          sortMode={view === 'card' ? 'manual' : (store.settings.sortModes[g.id] || DEFAULT_SORT)}
          onSortMode={view === 'card' ? null : (mode) => act.setSettings({ sortModes: { ...store.settings.sortModes, [g.id]: mode } })}
          onColor={view === 'card' ? null : (item) => setColorFor(item
            ? { kind: 'item', id: item.id, name: item.name, color: item.color, accent: item.accent }
            : { kind: 'section', id: g.section.id, name: g.section.name, color: g.section.color, accent: g.section.accent })}
          onAdd={() => setEditor({ defaults: view === 'card' ? { account: g.id, group: g.id === 'salary' ? 'fixed' : 'daily' } : { group: g.id, account: g.id === 'fixed' ? 'salary' : 'applepay' } })} />
      ))}
      {data.orphan > 0 && (
        <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">مصروفات بقيمة <b className="num text-ink">{fmtShort(data.orphan)}</b> ر.ع تخص بنوداً محذوفة، وما زالت محسوبة في المصروف الفعلي.</p>
      )}
      <p className="text-center text-xs text-muted">اضغط على البند لتسجيل مصروف عليه، واسحبه لليسار لحذفه.</p>

      {rename && rename.kind === 'section' && (
        <SectionRenameSheet store={store} section={{ id: rename.id, name: rename.name }} onOp={act.sectionOp} notify={notify} onClose={() => setRename(null)} />
      )}
      {cardColor && (
        <ColorPicker store={store} notify={notify} onClose={() => setCardColor(null)}
          target={{ kind: 'summary', id: cardColor, name: cardColor === 'salary' ? 'بطاقة الراتب الأساسي' : 'بطاقة الرصيد المتبقي', color: store.settings.cardColors[cardColor] }}
          onApply={(color) => { act.setSettings({ cardColors: { ...store.settings.cardColors, [cardColor]: color } }); notify(color ? 'تم تطبيق اللون على كل الأشهر' : 'استُعيد اللون الافتراضي'); }} />
      )}
      {colorFor && <ColorPicker store={store} target={colorFor} onOp={act.sectionOp} notify={notify} onClose={() => setColorFor(null)} />}
      {manageSections && <ManageSectionsSheet store={store} month={month} onOp={act.sectionOp} notify={notify} onClose={() => setManageSections(false)} />}
      {rename && rename.kind === 'card' && (
        <RenameSheet title={rename.kind === 'card' ? 'تغيير اسم البطاقة' : 'تغيير اسم الفئة'} value={rename.name} onClose={() => setRename(null)}
          onSave={(name) => {
            act.renameCards({ [rename.id]: name });
            notify('تم تغيير الاسم'); setRename(null);
          }} />
      )}
      {manageCards && (
        <ManageCardsSheet cards={data.meta.cards} onClose={() => setManageCards(false)}
          onSave={(names) => { act.renameCards(names); notify('تم حفظ أسماء البطاقات'); setManageCards(false); }} />
      )}
      {editor && (
        <ItemSheet item={editor.item} defaults={editor.defaults} onClose={() => setEditor(null)} onDelete={removeItem}
          onSave={(patch) => {
            if (editor.item) { act.updateCat(editor.item.id, patch); notify(`تم تحديث ${patch.name}`); }
            else { act.addCat({ id: `c${uid()}`, custom: true, ...patch }); notify(`أُضيف بند ${patch.name}`); }
            setEditor(null);
          }} />
      )}
    </div>
  );
}

function GroupBlock({ g, view, open, toggle, openSheet, swiped, setSwiped, onRemove, onEdit, onAdd, onRename, onColor, sortMode = 'manual', onSortMode }) {
  const dark = useIsDark();
  const sec = view === 'card' ? null : g.section;
  const surf = sec ? surfaceFor(sec.color, dark) : null;
  const acc = sec ? accentFor(sec.accent, dark) : null;
  return (
    <Card className="overflow-hidden" style={surf ? { background: surf.bg, borderColor: surf.edge, color: surf.ink, ...surf.vars } : undefined}>
      <div className="flex items-stretch">
        <button onClick={toggle} aria-expanded={open} className="flex min-w-0 flex-1 flex-col gap-2 py-3 ps-4 text-right">
          <span className="flex w-full items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[rgb(var(--ink)/0.1)]" style={{ background: acc ? acc.bg : g.color }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-ink">{g.label}</span>
              <span className="num block text-[11px] text-muted">
                <span>{g.list.length}</span> بنود · المخصص <b className="text-ink">{fmtShort(g.budget)}</b> · المصروف <b className="text-ink">{fmtShort(g.spent)}</b>
              </span>
            </span>
            <RemainChip rem={g.rem} dark={dark} />
            <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
          <RemainBar rem={g.rem} h="h-2" />
        </button>
        <div className="me-1 flex shrink-0 flex-col justify-center">
          <button onClick={onRename} aria-label={`تغيير اسم ${g.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted"><Pencil size={14} /></button>
          {onColor && <button onClick={() => onColor()} aria-label={`لون ${g.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted"><Palette size={14} /></button>}
        </div>
      </div>
      {open && (
        <>
          {onSortMode && g.list.length > 1 && (
            <div className="flex items-center gap-2 border-t border-line px-4 py-1.5 text-[11px]">
              <label htmlFor={`sort-${g.id}`} className="font-bold text-muted">الترتيب</label>
              <select id={`sort-${g.id}`} value={sortMode} onChange={(e) => onSortMode(e.target.value)}
                className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-bold text-ink" style={themeVars(dark)}>
                {SORT_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          )}
          {g.list.length > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {(() => {
                // العرض فقط: لا يُغيَّر الترتيب اليدوي المحفوظ ولا المعرّفات ولا العمليات
                const sorted = sortItems(g.list, sortMode);
                let lastState = null;
                return sorted.map((c) => {
                  const st = itemState(c.planned, c.paid);
                  const label = sortMode === 'smart' && st !== lastState && st !== 'outstanding'
                    ? (st === 'over' ? 'متجاوزة للميزانية' : 'مكتملة') : null;
                  lastState = st;
                  return (
                    <React.Fragment key={c.id}>
                      {label && <li className="px-4 py-1" aria-hidden="true"><span className={`inline-block rounded-md bg-surface px-2 py-0.5 text-[11px] font-extrabold ${st === 'over' ? 'text-bad' : 'text-muted'}`} style={themeVars(dark)}>{label}</span></li>}
                      <SwipeRow id={c.id} swiped={swiped} setSwiped={setSwiped} onDelete={() => onRemove(c)} archive={c.paid > 0}
                        surface={surfaceFor(c.color, dark) || (surf ? { bg: 'rgb(var(--surface))', vars: {}, reset: true } : null)} dark={dark}>
                        <ItemRow c={c} view={view} dark={dark} onOpen={() => openSheet(c.id)} onEdit={() => onEdit(c)} onColor={onColor ? () => onColor(c) : null} />
                      </SwipeRow>
                    </React.Fragment>
                  );
                });
              })()}
            </ul>
          ) : <p className="border-t border-line px-4 py-3 text-sm text-muted">لا توجد بنود هنا.</p>}
          <div className="border-t border-line px-4 py-1.5">
            <button onClick={onAdd} className={`flex h-10 items-center gap-1.5 text-sm font-bold ${surf ? 'text-ink' : 'text-accent'}`}><Plus size={16} />إضافة بند</button>
          </div>
        </>
      )}
    </Card>
  );
}

// سحب لليسار يكشف زر الحذف (مثل البريد في iOS)
function SwipeRow({ id, swiped, setSwiped, onDelete, archive, surface, dark, children }) {
  const open = swiped === id;
  const [confirm, setConfirm] = useState(false);
  const [drag, setDrag] = useState(null);
  const t = useRef(null);
  const W = confirm ? 156 : 84;
  useEffect(() => { if (!open) setConfirm(false); }, [open]);
  const base = open ? -W : 0;
  const x = drag ?? base;

  const onTouchStart = (e) => {
    if (swiped && swiped !== id) setSwiped(null);
    const p = e.touches[0];
    t.current = { x: p.clientX, y: p.clientY, dir: null, moved: false, last: base };
  };
  const onTouchMove = (e) => {
    const s = t.current; if (!s) return;
    const p = e.touches[0];
    const dx = p.clientX - s.x, dy = p.clientY - s.y;
    if (!s.dir) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.dir = 'h';
      else if (Math.abs(dy) > 8) s.dir = 'v';
    }
    if (s.dir === 'h') {
      s.moved = true;
      s.last = Math.max(-W - 40, Math.min(0, base + dx));
      setDrag(s.last);
    }
  };
  const onTouchEnd = () => {
    const s = t.current; if (!s) return;
    if (s.dir === 'h') setSwiped(s.last < -W / 2 ? id : null);
    setDrag(null);
  };
  const onClickCapture = (e) => {
    if (t.current?.moved) { t.current.moved = false; e.stopPropagation(); e.preventDefault(); return; }
    if (open) { setSwiped(null); e.stopPropagation(); e.preventDefault(); }
  };

  return (
    <li className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex bg-bad" style={{ width: Math.max(W, -x) }} aria-hidden={!open}>
        <button tabIndex={open ? 0 : -1} onClick={() => (confirm ? onDelete() : setConfirm(true))}
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-2 text-sm font-extrabold text-white">
          <Trash2 size={18} />{confirm ? (archive ? 'له عمليات: أرشفة؟' : 'تأكيد حذف البند؟') : 'حذف'}
        </button>
      </div>
      <div className="relative bg-surface" style={{
        transform: `translateX(${x}px)`, transition: drag == null ? 'transform .25s ease' : 'none', touchAction: 'pan-y',
        // لون البند الخاص، أو العودة لألوان المظهر داخل فئة ملونة
        ...(surface ? (surface.reset ? themeVars(dark) : { background: surface.bg, color: surface.ink, ...surface.vars }) : {}),
      }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} onClickCapture={onClickCapture}>
        {children}
      </div>
    </li>
  );
}

function ItemRow({ c, view, dark, onOpen, onEdit, onColor }) {
  const Icon = ITEM_ICONS[c.id] || Tag;
  const groupShort = useMeta().sectionName(c.group);
  const acc = accentFor(c.accent, dark);
  const rem = c.rem;
  return (
    <div role="button" tabIndex={0} aria-label={`تسجيل مصروف على ${c.name}`}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="flex cursor-pointer select-none flex-col gap-2 px-4 py-3 transition active:opacity-80">
      <div className="flex items-center gap-2.5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${acc ? '' : TONE[c.s].soft}`} style={acc ? { background: acc.bg, color: acc.ink } : undefined}><Icon size={17} /></div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {view === 'card'
              ? <span className="whitespace-nowrap rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-muted">{groupShort}</span>
              : <AccTag id={c.account} />}
            {c.dueDay ? <span className="text-[10px] text-muted">يستحق يوم {c.dueDay}</span> : null}
            {itemState(c.planned, c.paid) === 'over'
              ? <span className="rounded-md bg-bad px-1.5 py-0.5 text-[10px] font-extrabold text-white">⚠ تجاوز الميزانية</span>
              : c.planned > 0 && itemState(c.planned, c.paid) === 'done'
                ? <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-extrabold text-good" style={themeVars(dark)}>✓ مكتمل</span> : null}
          </div>
        </div>
        <RemainChip rem={rem} dark={dark} />
        <div className="-me-2 flex shrink-0 flex-col">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label={`تعديل ${c.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted"><Pencil size={14} /></button>
          {onColor && <button onClick={(e) => { e.stopPropagation(); onColor(); }} aria-label={`لون بند ${c.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted"><Palette size={13} /></button>}
        </div>
      </div>
      <RemainBar rem={rem} />
      <dl className="num grid grid-cols-3 gap-1 text-[11px]">
        <div><dt className="text-muted">المبلغ المخصص</dt><dd className="font-extrabold text-ink">{fmtShort(c.planned)}</dd></div>
        <div><dt className="text-muted">المبلغ المصروف</dt><dd className="font-extrabold text-ink">{fmtShort(c.paid)}</dd></div>
        <div><dt className="text-muted">المبلغ المتبقي</dt><dd className={`font-extrabold ${rem.remaining < 0 ? 'text-bad' : 'text-ink'}`} dir="ltr" style={{ textAlign: 'right' }}>{fmtShort(rem.remaining)}</dd></div>
      </dl>
    </div>
  );
}


// نافذة الأشهر: تسمية الشهر الحالي، التبديل بين الأشهر، بدء شهر جديد
function MonthSheet({ store, active, act, notify, onClose }) {
  const [label, setLabel] = useState(active.label);
  const [askNew, setAskNew] = useState(false);
  const [askDel, setAskDel] = useState(false);
  const [carry, setCarry] = useState(false);
  useEffect(() => { setLabel(active.label); setAskDel(false); }, [active.id, active.label]);
  const closing = closingBalance(active);
  const source = active.carryFromId ? store.months.find((m) => m.id === active.carryFromId) : null;
  const sourceNow = source ? closingBalance(source) : null;
  useModal(onClose);
  const months = [...store.months].sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0));
  const spentOf = (m) => round3(m.transactions.reduce((a, t) => a + t.amount, 0));
  return (
    <Portal>
    <div className="no-print backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-hero/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="month-title"
        className="sheet-in gutter flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="month-title" className="text-xl font-extrabold">الأشهر</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-muted"><X size={20} /></button>
        </div>

        <form className="flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; act.renameMonth(label.trim()); notify('تم تغيير اسم الشهر'); }}>
          <label htmlFor="month-label" className="text-sm font-bold text-muted">اسم الشهر الحالي</label>
          <div className="flex gap-2">
            <input id="month-label" value={label} onChange={(e) => setLabel(e.target.value)} className="input font-bold" maxLength={40} />
            <button type="submit" disabled={!label.trim() || label.trim() === active.label} className="h-12 shrink-0 rounded-2xl bg-accent px-4 font-bold text-white disabled:opacity-40">حفظ</button>
          </div>
        </form>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-muted">الأشهر المحفوظة</p>
          <ul className="flex flex-col gap-2" role="radiogroup" aria-label="اختيار الشهر">
            {months.map((m) => {
              const on = m.id === active.id;
              const sp = spentOf(m);
              return (
                <li key={m.id}>
                  <button role="radio" aria-checked={on} onClick={() => { act.switchMonth(m.id); notify(`تم فتح ${m.label}`); onClose(); }}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-right transition ${on ? 'border-accent bg-accent/5' : 'border-line'}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${on ? 'bg-accent text-white' : 'bg-surface2 text-muted'}`}><CalendarDays size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{m.label}</span>
                      <span className="block text-[11px] text-muted">الراتب <span className="num">{fmtShort(m.salary)}</span> · صُرف <span className="num">{fmtShort(sp)}</span> · <span className="num">{m.transactions.length}</span> عملية</span>
                    </span>
                    <span className={`num text-sm font-extrabold ${closingBalance(m) < 0 ? 'text-bad' : 'text-good'}`}>{fmtShort(closingBalance(m))}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {(active.carryIn !== 0 || source) && (
          <div className="flex flex-col gap-1.5 rounded-2xl bg-surface2 p-3 text-[13px]">
            <p className="font-bold">الرصيد المرحّل لهذا الشهر: <span className="num" dir="ltr">{active.carryIn >= 0 ? '+' : '−'}{fmtShort(Math.abs(active.carryIn))}</span> ر.ع</p>
            <p className="text-xs text-muted">الراتب ({fmtShort(active.salary)}) مستقل عن الرصيد المرحّل. الرصيد ثُبّت عند بدء الشهر ولا يتغير تلقائياً.</p>
            {source && sourceNow !== active.carryIn && (
              <button onClick={() => { act.setCarry(sourceNow, source.id); notify('تم تحديث الرصيد المرحّل'); }} className="h-10 rounded-xl border border-accent/40 text-sm font-bold text-accent">
                رصيد «{source.label}» أصبح {fmtShort(sourceNow)} — تحديث؟
              </button>
            )}
            {active.carryIn !== 0 && <button onClick={() => { act.setCarry(0, null); notify('أُلغي الترحيل لهذا الشهر'); }} className="text-xs font-bold text-bad">إلغاء الترحيل لهذا الشهر</button>}
          </div>
        )}

        {askNew ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-accent/30 bg-accent/5 p-3.5">
            <p className="text-sm font-bold">بدء شهر جديد؟</p>
            <p className="text-xs leading-relaxed text-muted">يُنسخ الراتب والفئات والبطاقات والبنود ومخصصاتها من «{active.label}»، ويبدأ المصروف والسجل من الصفر. يبقى الشهر الحالي محفوظاً ويمكنك فتحه أو طباعته في أي وقت.</p>
            <label htmlFor="carry-toggle" className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-[13px]">
              <input id="carry-toggle" type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" />
              <span>
                <b>ترحيل {closing >= 0 ? 'الفائض' : 'العجز'} ({fmtShort(Math.abs(closing))} ر.ع)</b>
                <span className="block text-xs text-muted">يُضاف كرصيد مرحّل منفصل، ويبقى الراتب {fmtShort(active.salary)} كما هو.</span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { act.newMonth({ carry: carry && closing !== 0 }); notify('بدأ شهر جديد'); onClose(); }} className="h-11 rounded-xl bg-accent font-bold text-white">ابدأ الشهر</button>
              <button onClick={() => setAskNew(false)} className="h-11 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAskNew(true)} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 font-extrabold text-accent">
            <CalendarPlus size={20} />+ بدء شهر جديد
          </button>
        )}

        {store.months.length > 1 && (
          askDel ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { act.deleteMonth(active.id); notify('تم حذف الشهر'); onClose(); }} className="h-11 rounded-xl bg-bad text-sm font-bold text-white">تأكيد حذف «{active.label}»</button>
              <button onClick={() => setAskDel(false)} className="h-11 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
            </div>
          ) : (
            <button onClick={() => setAskDel(true)} className="flex h-10 items-center justify-center gap-1.5 text-sm font-bold text-bad"><Trash2 size={15} />حذف الشهر الحالي</button>
          )
        )}
      </div>
    </div>
    </Portal>
  );
}

// نافذة تغيير اسم فئة أو بطاقة
function RenameSheet({ title, value, onSave, onClose }) {
  const [name, setName] = useState(value);
  const [err, setErr] = useState('');
  useModal(onClose);
  return (
    <Portal>
    <div className="no-print backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-hero/40" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return setErr('اكتب اسماً.'); onSave(name.trim()); }}
        role="dialog" aria-modal="true" aria-labelledby="rename-title"
        className="sheet-in gutter flex w-full max-w-md flex-col gap-3.5 rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="rename-title" className="text-xl font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-muted"><X size={20} /></button>
        </div>
        <label htmlFor="rename-input" className="sr-only">الاسم الجديد</label>
        <input id="rename-input" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} className="input text-lg font-bold" maxLength={40} autoFocus onFocus={(e) => e.target.select()} />
        {err && <p className="text-sm font-bold text-bad">{err}</p>}
        <p className="text-xs text-muted">يتغير الاسم في كل مكان، وتبقى البنود والعمليات كما هي.</p>
        <button type="submit" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-extrabold text-white"><Check size={21} strokeWidth={2.8} />حفظ الاسم</button>
      </form>
    </div>
    </Portal>
  );
}

// إدارة أسماء البطاقات
function ManageCardsSheet({ cards, onSave, onClose }) {
  const [names, setNames] = useState(() => Object.fromEntries(cards.map((c) => [c.id, c.name])));
  const [err, setErr] = useState('');
  useModal(onClose);
  return (
    <Portal>
    <div className="no-print backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-hero/40" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cards-title"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, v.trim()]));
          if (Object.values(clean).some((v) => !v)) return setErr('لا يمكن ترك اسم بطاقة فارغاً.');
          onSave(clean);
        }}
        className="sheet-in gutter flex max-h-[92vh] w-full max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="cards-title" className="text-xl font-extrabold">إدارة البطاقات</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-muted"><X size={20} /></button>
        </div>
        <p className="-mt-1 text-xs text-muted">غيّر اسم أي بطاقة، مثل «بنك مسقط» أو «بطاقة السفر». يظهر الاسم الجديد في كل البنود والقوائم والتقارير.</p>
        {cards.map((c) => {
          const Icon = ACC_ICONS[c.id] || CreditCard;
          return (
            <div key={c.id} className="flex items-center gap-2.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={18} /></span>
              <label htmlFor={`card-${c.id}`} className="sr-only">اسم البطاقة</label>
              <input id={`card-${c.id}`} value={names[c.id] ?? ''} onChange={(e) => { setNames((n) => ({ ...n, [c.id]: e.target.value })); setErr(''); }}
                className="input font-bold" maxLength={30} />
            </div>
          );
        })}
        {err && <p className="text-sm font-bold text-bad">{err}</p>}
        <button type="submit" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-extrabold text-white"><Check size={21} strokeWidth={2.8} />حفظ الأسماء</button>
      </form>
    </div>
    </Portal>
  );
}

// نافذة تعديل / إضافة بند
function ItemSheet({ item, defaults, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item?.name || '');
  const [budget, setBudget] = useState(item ? String(item.budget) : '');
  const [group, setGroup] = useState(item?.group || defaults?.group || 'daily');
  const [account, setAccount] = useState(item?.account || defaults?.account || 'applepay');
  const [dueDay, setDueDay] = useState(item?.dueDay ? String(item.dueDay) : '');
  const [isSaving, setIsSaving] = useState(item ? (item.isSaving ?? item.id === 'saving') : false);
  const [kind, setKind] = useState(item?.kind || '');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const { cards, sections } = useMeta();
  useModal(onClose);
  const submit = (e) => {
    e.preventDefault();
    const b = budget === '' ? 0 : parseFloat(budget);
    if (!name.trim()) return setErr('اكتب اسم البند.');
    if (isNaN(b) || b < 0) return setErr('أدخل مخصصاً صحيحاً (صفر أو أكثر).');
    const day = dueDay === '' ? null : parseInt(dueDay, 10);
    if (day != null && (isNaN(day) || day < 1 || day > 31)) return setErr('يوم الاستحقاق بين 1 و31.');
    onSave({ name: name.trim(), budget: round3(b), group, account, dueDay: day, isSaving, kind: kind || null });
  };
  return (
    <Portal>
    <div className="no-print backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-hero/40" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="item-title"
        className="sheet-in gutter flex max-h-[92vh] w-full max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-surface pt-3"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <h2 id="item-title" className="flex-1 text-xl font-extrabold">{item ? 'تعديل البند' : 'بند جديد'}</h2>
          {item && (
            <button type="button" onClick={() => (confirm ? onDelete(item) : setConfirm(true))} aria-label="حذف البند"
              className={`flex h-10 items-center gap-1 rounded-full px-3 text-sm font-bold transition ${confirm ? 'bg-bad text-white' : 'bg-bad/10 text-bad'}`}>
              <Trash2 size={17} />{confirm ? (item.spent > 0 ? 'له عمليات: أرشفة؟' : 'تأكيد حذف البند؟') : ''}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-muted"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="i-name" className="text-sm font-bold text-muted">اسم البند</label>
          <input id="i-name" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} className="input" placeholder="مثال: هدايا" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="i-budget" className="text-sm font-bold text-muted">المخصص (ر.ع)</label>
          <input id="i-budget" type="number" inputMode="decimal" step="0.001" min="0" value={budget} onChange={(e) => { setBudget(e.target.value); setErr(''); }} className="input num text-lg font-bold" placeholder="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-muted">البطاقة / الحساب</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="البطاقة">
            {cards.map(({ id: k, name: l }) => {
              const Icon = ACC_ICONS[k] || CreditCard;
              return (
                <button key={k} type="button" role="radio" aria-checked={account === k} onClick={() => setAccount(k)}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition ${account === k ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted'}`}>
                  <Icon size={15} className="shrink-0" /><span className="truncate">{l}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="i-group" className="text-sm font-bold text-muted">الفئة</label>
          <select id="i-group" value={group} onChange={(e) => setGroup(e.target.value)} className="input">
            {sections.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="i-due" className="text-sm font-bold text-muted">يوم الاستحقاق</label>
            <input id="i-due" type="number" inputMode="numeric" min="1" max="31" value={dueDay} onChange={(e) => { setDueDay(e.target.value); setErr(''); }} className="input num" placeholder="اختياري" />
          </div>
          <label htmlFor="i-saving" className="flex items-center gap-2 self-end rounded-2xl border border-line px-3 py-3 text-sm font-bold">
            <input id="i-saving" type="checkbox" checked={isSaving} onChange={(e) => setIsSaving(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
            بند ادخار
          </label>
        </div>
        <p className="-mt-1 text-xs text-muted">يوم الاستحقاق يفعّل تنبيه اقتراب موعد الدفع. وبنود الادخار تُحسب في تحليل الادخار السنوي.</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="i-kind" className="text-sm font-bold text-muted">تصنيف البند للتحليل</label>
          <select id="i-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input">
            <option value="">حسب تصنيف الفئة (تلقائي)</option>
            {KIND_ORDER.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
          </select>
        </div>
        {item && item.spent > 0 && <p className="text-xs text-muted">العمليات المسجلة سابقاً تبقى في السجل على البطاقة التي دُفعت منها.</p>}
        {err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}
        <button type="submit" className="flex h-13 min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-extrabold text-white"><Check size={21} strokeWidth={2.8} />{item ? 'حفظ التعديلات' : 'إضافة البند'}</button>
      </form>
    </div>
    </Portal>
  );
}

// ================= البيانات والرسومات =================
function StatsTab({ data, store }) {
  const [mode, setMode] = useState(() => { try { return sessionStorage.getItem('st5-stats') || 'month'; } catch (e) { return 'month'; } });
  useEffect(() => { try { sessionStorage.setItem('st5-stats', mode); } catch (e) { /* تجاهل */ } }, [mode]);
  return (
    <div className="flex flex-col gap-4 fade-in">
      <div>
        <h1 className="text-2xl font-extrabold">التحليل</h1>
        <p className="text-sm text-muted">{mode === 'month' ? <>{data.label} · المدفوع <b className="num text-ink">{fmt(data.spent)}</b> ر.ع</> : <>آخر 12 شهراً حتى {data.label.replace(/^راتب شهر /, '')}</>}</p>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1" role="tablist" aria-label="نطاق التحليل">
        {[['month', 'هذا الشهر'], ['year', 'سنوي (12 شهراً)']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-10 rounded-xl text-[13px] font-bold transition ${mode === k ? 'bg-accent text-white' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {mode === 'month' ? (
        <>
          <PlanActualTable s={data.summary} sections={data.meta.sections} />
          <DonutCard data={data} />
          <CompareCard data={data} />
          <AccountsCard data={data} />
        </>
      ) : <AnnualView store={store} endPeriod={data.period} />}
    </div>
  );
}

function DonutCard({ data }) {
  const [sel, setSel] = useState(null);
  const total = data.spent;
  const R = 70, C = 2 * Math.PI * R, GAP = data.groups.filter((g) => g.spent > 0).length > 1 ? 3 : 0;
  let offset = 0;
  const segs = data.groups.map((g) => { const len = total > 0 ? (g.spent / total) * C : 0; const s = { g, len, offset }; offset += len; return s; });
  const active = sel ? data.groups.find((g) => g.id === sel) : null;
  return (
    <Card className="p-4">
      <h2 className="text-[15px] font-extrabold">توزيع المصروف الفعلي حسب الفئة</h2>
      <div className="mt-3 flex flex-col items-center gap-4">
        <div className="relative">
          <svg viewBox="0 0 180 180" width="176" height="176" role="img" aria-label="رسم دائري لتوزيع المصروف">
            <circle cx="90" cy="90" r={R} fill="none" stroke="rgb(var(--surface2))" strokeWidth="20" />
            {segs.map(({ g, len, offset: o }) => len > 0 && (
              <circle key={g.id} cx="90" cy="90" r={R} fill="none" stroke={g.color} strokeWidth={sel === g.id ? 26 : 20}
                strokeDasharray={`${Math.max(0.01, len - GAP)} ${C}`} strokeDashoffset={-o} transform="rotate(-90 90 90)"
                style={{ cursor: 'pointer', transition: 'stroke-width .2s, opacity .2s' }} opacity={sel && sel !== g.id ? 0.35 : 1}
                onClick={() => setSel(sel === g.id ? null : g.id)} />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            {total === 0 ? <div><p className="text-xs text-muted">لا يوجد مصروف بعد</p><p className="num text-2xl font-extrabold">0.00</p></div>
              : active ? <div><p className="text-xs font-bold" style={{ color: active.color }}>{active.short}</p><p className="num text-3xl font-extrabold">{Math.round((active.spent / total) * 100)}٪</p><p className="num text-xs text-muted">{fmt(active.spent)} ر.ع</p></div>
                : <div><p className="text-xs text-muted">الإجمالي</p><p className="num text-2xl font-extrabold">{fmt(total)}</p><p className="text-xs text-muted">ر.ع</p></div>}
          </div>
        </div>
        <ul className="grid w-full grid-cols-2 gap-2">
          {data.groups.map((g) => {
            const p = total > 0 ? Math.round((g.spent / total) * 100) : 0;
            const on = sel === g.id;
            return (
              <li key={g.id}>
                <button onClick={() => setSel(on ? null : g.id)} className={`flex w-full flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-right transition ${on ? 'border-accent bg-accent/5' : 'border-line bg-surface2/60'}`}>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />{g.short}</span>
                  <span className="flex w-full items-baseline justify-between gap-1">
                    <span className="num text-base font-extrabold">{fmtShort(g.spent)} <span className="text-[10px] font-bold text-muted">ر.ع</span></span>
                    <span className="num text-xs font-bold text-muted">{p}٪</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

function CompareCard({ data }) {
  const items = COMPARE_IDS.map((id) => data.catMap[id]).filter(Boolean);
  const scale = Math.max(1, ...items.map((c) => Math.max(c.budget, c.spent)));
  const top = items.filter((c) => c.spent > 0).sort((a, b) => (b.budget ? b.spent / b.budget : Infinity) - (a.budget ? a.spent / a.budget : Infinity))[0];
  return (
    <Card className="p-4">
      <h2 className="text-[15px] font-extrabold">مقارنة المخصص مقابل المصروف الفعلي</h2>
      <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-sky/25" />المخصص</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-good" />المصروف</span>
      </div>
      {top && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2 text-[13px] font-bold text-warn">
          <Flame size={16} />الأسرع استنزافاً: {top.name} ({top.budget ? <><span className="num">{Math.round((top.spent / top.budget) * 100)}٪</span> من مخصصه</> : 'بدون مخصص'})
        </p>
      )}
      <ul className="mt-4 flex flex-col gap-3.5">
        {items.map((c) => (
          <li key={c.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold">{c.name}</span>
              <span className="num text-xs text-muted"><b className={`text-sm ${TONE[c.s].text}`}>{fmtShort(c.spent)}</b> / {fmtShort(c.budget)} ر.ع</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-2 rounded-full bg-sky/20" style={{ width: `${(c.budget / scale) * 100}%`, minWidth: c.budget > 0 ? '4px' : 0 }} />
              <div className="h-2 rounded-full bg-surface2">
                <div className={`h-2 rounded-full ${TONE[c.s].bar} transition-all duration-500`} style={{ width: `${(c.spent / scale) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AccountsCard({ data }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="px-1 text-[15px] font-extrabold">توزيع الصرف حسب البطاقة / الحساب</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {data.accounts.map((a) => {
          const Icon = ACC_ICONS[a.id];
          const left = round3(a.limit - a.spent);
          return (
            <Card key={a.id} className="flex flex-col gap-2 p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent"><Icon size={16} /></span>
                <span className="min-w-0 truncate text-[13px] font-bold">{a.label}</span>
              </div>
              <p className="num text-xl font-extrabold leading-none">{fmtShort(a.spent)}<span className="ms-1 text-xs font-bold text-muted">/ {fmtShort(a.limit)}</span></p>
              <Bar spent={a.spent} budget={a.limit} />
              <p className={`text-[11px] font-bold ${left < 0 ? 'text-bad' : 'text-muted'}`}>
                {left < 0 ? <>عجز <span className="num">{fmtShort(-left)}</span> ر.ع</> : <>متبقي <span className="num">{fmtShort(left)}</span> ر.ع</>}
              </p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ================= سجل العمليات =================
function LogTab({ data, act, notify, onReport }) {
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState('all');
  const [acc, setAcc] = useState('all');
  const [resetAsk, setResetAsk] = useState(false);

  const list = data.history.filter((t) => {
    const c = data.catMap[t.catId];
    if (grp !== 'all' && c?.group !== grp) return false;
    if (acc !== 'all' && t.account !== acc) return false;
    const s = q.trim();
    return !s || `${c?.name || ''} ${t.note || ''} ${fmt(t.amount)}`.includes(s);
  });
  const byDay = [];
  for (const t of list) {
    const last = byDay[byDay.length - 1];
    if (last && last.date === t.date) last.items.push(t); else byDay.push({ date: t.date, items: [t] });
  }
  const total = round3(list.reduce((a, t) => a + t.amount, 0));

  return (
    <div className="flex flex-col gap-4 fade-in">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">سجل العمليات</h1>
          <p className="text-sm text-muted"><span className="num">{data.history.length}</span> عملية مسجلة</p>
        </div>
      </div>
      <button onClick={onReport} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-extrabold text-white"><Printer size={19} />تصدير / طباعة التقرير</button>

      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
          <input id="log-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في البنود أو الملاحظات" aria-label="بحث" className="input bg-surface !pr-11" />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="تصفية حسب الفئة">
          {[['all', 'الكل'], ...data.meta.sections.map((g) => [g.id, g.name])].map(([k, l]) => (
            <button key={k} onClick={() => setGrp(k)} className={`pill ${grp === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="تصفية حسب البطاقة">
          {[['all', 'كل البطاقات'], ...data.meta.cards.map((c) => [c.id, c.name])].map(([k, l]) => (
            <button key={k} onClick={() => setAcc(k)} className={`pill text-xs ${acc === k ? 'border-hero bg-hero text-white' : 'pill-off'}`}>{l}</button>
          ))}
        </div>
      </div>

      {list.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-2 text-sm">
          <span className="text-muted">مجموع المعروض (<span className="num">{list.length}</span>)</span>
          <b className="num" dir="ltr">-{fmt(total)} ر.ع</b>
        </div>
      )}

      {byDay.map((d) => (
        <section key={d.date} className="flex flex-col gap-1.5">
          <h3 className="px-1 text-xs font-extrabold text-muted">{dayHeading(d.date)}</h3>
          <Card>
            <ul className="divide-y divide-line">
              {d.items.map((t) => <TxRow key={t.id} t={t} c={data.catMap[t.catId]} onDelete={() => { act.delTx(t.id); notify('حُذفت العملية وأُعيد المبلغ للبند'); }} />)}
            </ul>
          </Card>
        </section>
      ))}

      {list.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent"><ReceiptText size={24} /></span>
          <p className="font-extrabold">{data.history.length ? 'لا توجد نتائج مطابقة' : 'لا توجد عمليات بعد'}</p>
          <p className="text-sm text-muted">{data.history.length ? 'غيّر البحث أو التصفية.' : 'اضغط «تسجيل مصروف» في الشريط السفلي لإضافة أول عملية.'}</p>
        </Card>
      )}

      {resetAsk ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-bad/30 bg-bad/5 p-4">
          <p className="text-sm font-bold">سيُحذف كل عمليات «{data.label}» وتعود بنوده ومخصصاته للوضع الافتراضي. الأشهر الأخرى لا تتأثر. هل أنت متأكد؟</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { act.reset(); setResetAsk(false); notify('تم مسح كل البيانات'); }} className="h-12 rounded-xl bg-bad font-bold text-white">نعم، امسح الكل</button>
            <button onClick={() => setResetAsk(false)} className="h-12 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setResetAsk(true)} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-2xl border border-bad/25 text-sm font-bold text-bad"><RotateCcw size={16} />مسح الكل</button>
      )}
    </div>
  );
}

function TxRow({ t, c, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!confirm) return; const x = setTimeout(() => setConfirm(false), 3000); return () => clearTimeout(x); }, [confirm]);
  const Icon = ITEM_ICONS[c?.id] || Tag;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2 text-muted"><Icon size={17} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><span className="truncate font-bold">{c?.name || 'بند محذوف'}</span><AccTag id={t.account} /></div>
        {t.note && <p className="truncate text-xs text-muted">{t.note}</p>}
      </div>
      <span className="text-[15px] font-extrabold"><Money v={t.amount} sign="-" /></span>
      {confirm
        ? <button onClick={onDelete} className="h-9 shrink-0 rounded-xl bg-bad px-2.5 text-xs font-bold text-white">تأكيد</button>
        : <button onClick={() => setConfirm(true)} aria-label="حذف العملية" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-bad/10 hover:text-bad"><Trash2 size={16} /></button>}
    </li>
  );
}

// ================= نافذة التسجيل =================
function EntrySheet({ cats, initial, onSave, onClose }) {
  const [catId, setCatId] = useState(initial || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const cat = cats.find((c) => c.id === catId);
  const { sections } = useMeta();
  useModal(onClose);

  const a = parseFloat(amount);
  const after = cat && !isNaN(a) && a > 0 ? round3(cat.remaining - a) : null;
  const submit = (e) => {
    e.preventDefault();
    if (!cat) return setErr('اختر البند.');
    if (isNaN(a) || a <= 0) return setErr('أدخل مبلغاً أكبر من صفر.');
    if (!date) return setErr('اختر التاريخ.');
    onSave({ catId: cat.id, account: cat.account, amount: round3(a), date, note: note.trim() }, cat.name);
  };

  return (
    <div className="no-print backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-hero/40" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sheet-title"
        className="sheet-in gutter flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface pt-3"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="sheet-title" className="text-xl font-extrabold">تسجيل مصروف</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-muted"><X size={20} /></button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-amount" className="text-sm font-bold text-muted">المبلغ</label>
          <div className="relative">
            <input id="f-amount" type="number" inputMode="decimal" step="0.001" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(''); }}
              placeholder="0.000" className="input num h-16 pe-4 ps-14 text-3xl font-extrabold" autoFocus={!!initial} />
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted">ر.ع</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-cat" className="text-sm font-bold text-muted">البند</label>
          <select id="f-cat" value={catId} onChange={(e) => { setCatId(e.target.value); setErr(''); }} className="input font-bold">
            <option value="" disabled>اختر البند…</option>
            {sections.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {cats.filter((c) => c.group === g.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
          {cat && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <AccTag id={cat.account} />
              <span>المتبقي الآن <b className={`num ${cat.remaining < 0 ? 'text-bad' : 'text-good'}`}>{fmtShort(cat.remaining)}</b> ر.ع</span>
              {after != null && <span>← بعد الحفظ <b className={`num ${after < 0 ? 'text-bad' : 'text-ink'}`}>{after < 0 ? `عجز ${fmtShort(-after)}` : fmtShort(after)}</b></span>}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-date" className="text-sm font-bold text-muted">التاريخ</label>
          <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input num" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-note" className="text-sm font-bold text-muted">ملاحظة <span className="font-normal">(اختياري)</span></label>
          <input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: محطة شل" className="input" maxLength={80} />
        </div>

        {err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}
        <button type="submit" className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-extrabold text-white active:scale-[0.99]">
          <Check size={22} strokeWidth={2.8} />حفظ وخصم المبلغ
        </button>
      </form>
    </div>
  );
}


// ================= نافذة التقرير: طباعة ومشاركة =================
function ReportModal({ data, store, mode: initialMode, onClose, notify }) {
  useModal(onClose);
  const [mode, setMode] = useState(initialMode || 'month');
  const [withAnalysis, setWithAnalysis] = useState(false);
  const [fallback, setFallback] = useState('');
  const text = useMemo(() => (mode === 'year' ? annualText(store, data.period) : reportText(data)), [data, store, mode]);

  const articleRef = useRef(null);
  const [pdf, setPdf] = useState({ state: 'idle' }); // idle | busy | ready | error
  const [xl, setXl] = useState(false);
  useEffect(() => { setPdf({ state: 'idle' }); setFallback(''); }, [mode, withAnalysis]);
  const base = mode === 'year' ? `salary-year-${data.period}` : `salary-report-${data.period || todayISO().slice(0, 7)}`;
  const fileName = `${base}.pdf`;
  const doExcel = async () => {
    setXl(true);
    try {
      const month = store.months.find((m) => m.id === store.activeId);
      const blob = mode === 'year' ? annualWorkbook(store, data.period) : monthWorkbook(month, data.meta.cardName, data.meta.sectionName, todayISO());
      const r = await shareOrDownload(blob, `${base}.xlsx`, data.label);
      if (r === 'downloaded') notify('تم تنزيل ملف Excel');
    } catch (e) { notify('تعذّر إنشاء ملف Excel'); } finally { setXl(false); }
  };

  const doPrint = () => {
    try { window.print(); } catch (e) { /* بعض العارضات تمنع الطباعة */ }
  };
  const sharePdf = async (file, url) => {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'تقرير مصاريف الراتب' }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return true; }
    }
    // تحميل مباشر كبديل
    try {
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    } catch (e) { return false; }
  };
  const doPdf = async () => {
    if (pdf.state === 'ready') { await sharePdf(pdf.file, pdf.url); return; }
    setPdf({ state: 'busy' });
    try {
      const wrap = document.createElement('div');
      wrap.className = 'pdf-light';
      wrap.dir = 'rtl';
      const clone = articleRef.current.cloneNode(true);
      clone.removeAttribute('style');
      clone.className = 'pdf-report';
      // html2canvas يعكس «ر.ع» بسبب النقطة بين الحرفين، فنكتب «ريال» في نسخة PDF
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) n.nodeValue = n.nodeValue.replace(/ر\.ع/g, 'ريال');
      wrap.appendChild(clone);
      const blob = await html2pdf().set({
        margin: [10, 10, 12, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, letterRendering: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.pdf-avoid'] },
      }).from(wrap).outputPdf('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdf({ state: 'ready', file, url });
      await sharePdf(file, url);
    } catch (e) {
      setPdf({ state: 'error' });
    }
  };
  useEffect(() => () => { if (pdf.url) URL.revokeObjectURL(pdf.url); }, [pdf.url]);

  const doShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'تقرير مصاريف الراتب', text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text); notify('نُسخ التقرير، الصقه في واتساب أو الملاحظات'); return; } catch (e) { /* ننتقل للبديل */ }
    }
    setFallback(text);
  };

  return (
    <div className="report-modal backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-hero/40 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="report-title"
        className="report-panel sheet-in flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="no-print gutter flex flex-col gap-3 border-b border-line pt-3 pb-3">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">تصدير / مشاركة التقرير</h2>
            <button onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-muted"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1" role="tablist" aria-label="نوع التقرير">
            {[['month', 'تقرير شهري'], ['year', 'تقرير سنوي']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-9 rounded-lg text-[13px] font-bold ${mode === k ? 'bg-surface text-accent shadow-sm' : 'text-muted'}`}>{l}</button>
            ))}
          </div>
          {mode === 'month' && (
            <label htmlFor="with-analysis" className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13px] font-bold">
              <input id="with-analysis" type="checkbox" checked={withAnalysis} onChange={(e) => setWithAnalysis(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
              تضمين تحليل سلوك الإنفاق في التقرير
            </label>
          )}
          <button onClick={doPdf} disabled={pdf.state === 'busy'} aria-busy={pdf.state === 'busy'}
            className="flex h-13 min-h-[52px] items-center justify-center gap-2 rounded-xl bg-accent text-base font-extrabold text-white disabled:opacity-80">
            {pdf.state === 'busy' ? <><LoaderCircle size={20} className="animate-spin" />جارٍ إنشاء ملف PDF…</>
              : pdf.state === 'ready' ? <><Share2 size={19} />مشاركة ملف PDF الجاهز</>
                : <><Download size={19} />تحميل / مشاركة كـ PDF</>}
          </button>
          {pdf.state === 'ready' && (
            <a href={pdf.url} download={fileName} target="_blank" rel="noopener" className="-mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-accent">
              <ExternalLink size={13} />فتح الملف إن لم تظهر نافذة المشاركة
            </a>
          )}
          {pdf.state === 'error' && <p className="text-xs font-bold text-bad">تعذّر إنشاء الملف. جرّب المشاركة النصية أو الطباعة.</p>}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={doExcel} disabled={xl} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-good/30 bg-good/10 text-[13px] font-extrabold text-good disabled:opacity-60">{xl ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}Excel</button>
            <button onClick={doShare} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 text-[13px] font-extrabold text-accent"><Share2 size={16} />نص</button>
            <button onClick={doPrint} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] font-extrabold text-muted"><Printer size={16} />طباعة</button>
          </div>
          {fallback && (
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted"><Copy size={13} />حدّد النص وانسخه يدوياً:</p>
              <textarea id="report-text" readOnly value={fallback} rows={6} className="input h-auto py-2 text-xs leading-relaxed" onFocus={(e) => e.target.select()} autoFocus />
            </div>
          )}
        </div>

        <article ref={articleRef} className="gutter flex-1 overflow-y-auto py-4" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
          {mode === 'year' ? <AnnualReport store={store} endPeriod={data.period} title={`حتى ${data.label.replace(/^راتب شهر /, '')}`} /> : <MonthReport data={data} store={store} includeAnalysis={withAnalysis} />}
        </article>
      </div>
    </div>
  );
}
