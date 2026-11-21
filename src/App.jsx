import React, { useEffect, useMemo, useState } from 'react';
import {
  Home, LayoutList, Plus, ChartPie, Printer, Wallet, CreditCard, Smartphone, Landmark, Scale,
  TriangleAlert, CircleCheck, Info, Trash2, Search, Repeat, ChevronRight, ChevronLeft, RotateCcw,
  Pencil, Check, X, Fuel, Utensils, ShoppingCart, Wrench, PiggyBank, Wifi, Zap, Droplets, Building2,
  Users, HandCoins, Scissors, Stethoscope, WashingMachine, Tag, CalendarDays, Maximize2, Minimize2,
  Copy, Sparkles,
} from 'lucide-react';
import {
  ACCOUNTS, ACCOUNT_ORDER, BALANCE_MODES, GROUPS, GROUP_ORDER, PARTITIONS, STORAGE_KEY,
  dayLabel, daysInMonth, defaultState, effBudget, fmt, fmt2, monthLabel, monthOf, pad, round3,
  shiftMonth, toISO, todayISO, uid,
} from './data.js';

const CAT_ICONS = {
  users: Users, building: Building2, coins: HandCoins, piggy: PiggyBank, wifi: Wifi, zap: Zap,
  drop: Droplets, fuel: Fuel, cart: ShoppingCart, food: Utensils, wrench: Wrench,
  laundry: WashingMachine, scissors: Scissors, clinic: Stethoscope, tag: Tag,
};
const PART_ICONS = { salary: Landmark, applepay: Smartphone, other: CreditCard };
const ACC_ICONS = { salary: Landmark, applepay: Smartphone, card1: CreditCard, card2: CreditCard };

// ---------- التخزين ----------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.categories) && Array.isArray(s.transactions)) return { ...defaultState(), ...s };
    }
  } catch (e) { /* التخزين غير متاح */ }
  return defaultState();
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* تجاهل */ }
}

// ---------- أدوات العرض ----------
const tone = (spent, budget) => {
  if (budget <= 0) return spent > 0 ? 'bad' : 'good';
  const p = spent / budget;
  if (p > 1.0001) return 'bad';
  if (p >= 0.75) return 'warn';
  return 'good';
};
const TONE = {
  good: { bar: 'bg-good', text: 'text-good', soft: 'bg-good/10 text-good', label: 'آمن' },
  warn: { bar: 'bg-warn', text: 'text-warn', soft: 'bg-warn/10 text-warn', label: 'قريب من الحد' },
  bad: { bar: 'bg-bad', text: 'text-bad', soft: 'bg-bad/10 text-bad', label: 'تجاوز الحد' },
};

function Money({ v, className = '', unit = 'ر.ع', unitClass = '' }) {
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {fmt(v)}<span className={`ms-1 text-[0.62em] font-medium opacity-70 ${unitClass}`}>{unit}</span>
    </span>
  );
}

function Bar({ value, max, t, h = 'h-2.5', marker }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0;
  return (
    <div className={`relative w-full ${h} rounded-full bg-line/70 overflow-hidden`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`${h} rounded-full ${TONE[t].bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      {marker != null && marker > 0 && marker < 100 && (
        <div className="absolute top-0 bottom-0 w-0.5 bg-ink/40" style={{ right: `${marker}%` }} title="المتوقع حتى اليوم" />
      )}
    </div>
  );
}

function AccountChip({ id, className = '' }) {
  const Icon = ACC_ICONS[id] || CreditCard;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted ${className}`}>
      <Icon size={12} aria-hidden="true" />{ACCOUNTS[id]?.short || 'غير محدد'}
    </span>
  );
}

function Section({ title, sub, action, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------- التطبيق ----------
export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem('st-tab') || 'home'; } catch (e) { return 'home'; }
  });
  const [month, setMonth] = useState(() => monthOf(todayISO()));
  const [toast, setToast] = useState(null);
  const [clean, setClean] = useState(false);

  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => {
    try { sessionStorage.setItem('st-tab', tab); } catch (e) { /* تجاهل */ }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [tab]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg, kind = 'good') => setToast({ msg, kind, k: Date.now() });

  const m = useMemo(() => compute(state, month), [state, month]);

  const update = (fn) => setState((s) => fn(s));
  const actions = {
    setBalance: (on) => update((s) => ({ ...s, balanceMode: on ? s.lastBalanceMode || 'daily' : 'off' })),
    setBalanceMode: (mode) => update((s) => ({ ...s, balanceMode: mode, lastBalanceMode: mode })),
    addTx: (tx) => { update((s) => ({ ...s, transactions: [{ ...tx, id: uid() }, ...s.transactions] })); },
    delTx: (id) => { update((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })); notify('تم حذف العملية', 'bad'); },
    setBudget: (id, v) => update((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, budget: v, adj: undefined } : c)) })),
    addCat: (c) => update((s) => ({ ...s, categories: [...s.categories, c] })),
    delCat: (id) => update((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) })),
    copyRecurring: () => {
      const prev = shiftMonth(month, -1);
      let added = 0;
      update((s) => {
        const existing = s.transactions.filter((t) => monthOf(t.date) === month);
        const src = s.transactions.filter((t) => monthOf(t.date) === prev && t.recurring);
        const dim = daysInMonth(month);
        const fresh = src
          .filter((t) => !existing.some((e) => e.catId === t.catId && e.recurring && Math.abs(e.amount - t.amount) < 0.001))
          .map((t) => ({ ...t, id: uid(), sample: false, date: `${month}-${pad(Math.min(Number(t.date.slice(8)), dim))}` }));
        added = fresh.length;
        return fresh.length ? { ...s, transactions: [...fresh, ...s.transactions] } : s;
      });
      setTimeout(() => notify(added ? `أُضيفت ${added} عمليات متكررة من ${monthLabel(prev)}` : `لا توجد عمليات متكررة جديدة في ${monthLabel(prev)}`, added ? 'good' : 'warn'), 0);
    },
    reset: () => { setState(defaultState()); setMonth(monthOf(todayISO())); notify('أُعيد ضبط التطبيق على الإعدادات الافتراضية'); setTab('home'); },
  };

  const isCurrentMonth = month === monthOf(todayISO());

  return (
    <div className="min-h-full bg-bg text-ink">
      {!clean && (
        <header className="no-print sticky z-30 bg-bg/90 backdrop-blur border-b border-line/60" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <div className="mx-auto flex max-w-md items-center justify-between gap-2 gutter py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-hero1 to-hero2 text-white shadow-sm">
                <Wallet size={19} aria-hidden="true" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="font-display text-[15px] font-bold truncate">تتبع مصاريف الراتب</p>
                <p className="text-[11px] text-muted">راتب شهري <span className="num">{fmt(state.salary)}</span> ر.ع</p>
              </div>
            </div>
            <MonthSwitcher month={month} setMonth={setMonth} isCurrent={isCurrentMonth} />
          </div>
        </header>
      )}

      <main className={`mx-auto max-w-md gutter pt-4 ${clean ? 'pb-10' : 'pb-32'}`}>
        {tab === 'home' && <Dashboard state={state} m={m} month={month} actions={actions} isCurrent={isCurrentMonth} go={setTab} />}
        {tab === 'budget' && <BudgetTab state={state} m={m} actions={actions} notify={notify} />}
        {tab === 'add' && <AddTab state={state} m={m} actions={actions} notify={notify} month={month} setMonth={setMonth} />}
        {tab === 'log' && <LogTab state={state} m={m} month={month} actions={actions} />}
        {tab === 'report' && <ReportTab state={state} m={m} month={month} clean={clean} setClean={setClean} actions={actions} />}
      </main>

      {!clean && <BottomNav tab={tab} setTab={setTab} />}
      {clean && (
        <button onClick={() => setClean(false)} className="no-print fixed z-40 rounded-full bg-ink/80 px-4 py-2 text-sm font-semibold text-bg shadow-lg" style={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', left: 'calc(16px + env(safe-area-inset-left, 0px))' }}>
          <span className="inline-flex items-center gap-1.5"><Minimize2 size={15} />إنهاء العرض النظيف</span>
        </button>
      )}

      {toast && (
        <div key={toast.k} className="no-print fixed inset-x-0 z-50 flex justify-center px-4 toast-in" style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }} role="status">
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl text-white ${toast.kind === 'bad' ? 'bg-bad' : toast.kind === 'warn' ? 'bg-warn' : 'bg-good'}`}>
            {toast.kind === 'good' ? <CircleCheck size={18} /> : <Info size={18} />}{toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- الحسابات ----------
function compute(state, month) {
  const mode = state.balanceMode;
  const catMap = Object.fromEntries(state.categories.map((c) => [c.id, c]));
  const tx = state.transactions.filter((t) => monthOf(t.date) === month).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const spentByCat = {};
  const spentByAcc = { salary: 0, applepay: 0, card1: 0, card2: 0 };
  let spent = 0;
  for (const t of tx) {
    spentByCat[t.catId] = (spentByCat[t.catId] || 0) + t.amount;
    spentByAcc[t.account] = (spentByAcc[t.account] || 0) + t.amount;
    spent += t.amount;
  }
  const cats = state.categories.map((c) => {
    const budget = effBudget(c, mode);
    const s = round3(spentByCat[c.id] || 0);
    const paid = c.group === 'fixed' && budget > 0 && Math.abs(s - budget) < 0.001;
    return { ...c, eff: budget, adjusted: budget !== c.budget, spent: s, remaining: round3(budget - s), paid, t: paid ? 'good' : tone(s, budget) };
  });
  const budgeted = round3(cats.reduce((a, c) => a + c.eff, 0));
  const originalBudget = round3(state.categories.reduce((a, c) => a + c.budget, 0));
  const groups = Object.fromEntries(GROUP_ORDER.map((g) => {
    const list = cats.filter((c) => c.group === g);
    const b = round3(list.reduce((a, c) => a + c.eff, 0));
    const sp = round3(list.reduce((a, c) => a + c.spent, 0));
    return [g, { list, budget: b, spent: sp, remaining: round3(b - sp) }];
  }));
  // المصاريف التي ليس لها بند معروف
  const orphan = round3(tx.filter((t) => !catMap[t.catId]).reduce((a, t) => a + t.amount, 0));

  const parts = Object.fromEntries(PARTITIONS.map((p) => {
    const b = round3(cats.filter((c) => ACCOUNTS[c.account]?.partition === p.id).reduce((a, c) => a + c.eff, 0));
    const sp = round3(ACCOUNT_ORDER.filter((a) => ACCOUNTS[a].partition === p.id).reduce((a, k) => a + (spentByAcc[k] || 0), 0));
    return [p.id, { budget: b, spent: sp, remaining: round3(b - sp) }];
  }));

  // حدود Apple Pay اليومية والأسبوعية
  const dim = daysInMonth(month);
  const today = todayISO();
  const thisMonth = monthOf(today);
  const dayNow = month === thisMonth ? Number(today.slice(8)) : month < thisMonth ? dim : 0;
  const daysLeft = month === thisMonth ? dim - dayNow + 1 : month < thisMonth ? 0 : dim;
  const ap = parts.applepay;
  const dailyBase = ap.budget / 28;
  const weeklyBase = ap.budget / 4;
  const dailyNow = daysLeft > 0 ? Math.max(0, ap.remaining) / daysLeft : 0;
  // الأسبوع الحالي يبدأ يوم الأحد
  let weekSpent = 0;
  let weekStart = null;
  if (month === thisMonth) {
    const d = new Date();
    const ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    weekStart = toISO(ws);
    weekSpent = round3(tx.filter((t) => t.account === 'applepay' && t.date >= weekStart && t.date <= today).reduce((a, t) => a + t.amount, 0));
  }
  const todaySpent = round3(tx.filter((t) => t.account === 'applepay' && t.date === today).reduce((a, t) => a + t.amount, 0));

  return {
    tx, cats, catMap, groups, parts, spentByAcc,
    spent: round3(spent), budgeted, originalBudget,
    diff: round3(state.salary - budgeted),
    pocket: round3(state.salary - spent),
    orphan, dim, dayNow, daysLeft, dailyBase, weeklyBase, dailyNow, weekSpent, weekStart, todaySpent,
    elapsedPct: dim ? (dayNow / dim) * 100 : 0,
  };
}

// ---------- مكونات عامة ----------
function MonthSwitcher({ month, setMonth, isCurrent }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-surface border border-line px-1 py-1 shadow-sm">
      <button aria-label="الشهر السابق" onClick={() => setMonth(shiftMonth(month, -1))} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface2"><ChevronRight size={18} /></button>
      <button onClick={() => setMonth(monthOf(todayISO()))} className="px-1 text-xs font-bold whitespace-nowrap" title="العودة للشهر الحالي">
        {monthLabel(month)}{!isCurrent && <span className="block text-[10px] font-medium text-accent">عودة للحالي</span>}
      </button>
      <button aria-label="الشهر التالي" onClick={() => setMonth(shiftMonth(month, 1))} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface2"><ChevronLeft size={18} /></button>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'budget', label: 'البنود', icon: LayoutList },
    { id: 'add', label: 'إضافة', icon: Plus, main: true },
    { id: 'log', label: 'السجل والتحليل', icon: ChartPie },
    { id: 'report', label: 'الطباعة', icon: Printer },
  ];
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="التنقل الرئيسي">
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end gutter pt-1.5 pb-2">
        {items.map((it) => {
          const active = tab === it.id;
          const Icon = it.icon;
          if (it.main) {
            return (
              <li key={it.id} className="flex justify-center">
                <button onClick={() => setTab(it.id)} aria-current={active ? 'page' : undefined} className="-mt-7 flex flex-col items-center gap-1">
                  <span className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-hero1 to-hero2 text-white shadow-lg ring-4 ring-bg ${active ? 'scale-105' : ''} transition`}>
                    <Icon size={30} strokeWidth={2.5} />
                  </span>
                  <span className={`text-[11px] font-bold ${active ? 'text-accent' : 'text-muted'}`}>إضافة عملية</span>
                </button>
              </li>
            );
          }
          return (
            <li key={it.id}>
              <button onClick={() => setTab(it.id)} aria-current={active ? 'page' : undefined} className={`flex w-full flex-col items-center gap-1 rounded-xl py-1.5 ${active ? 'text-accent' : 'text-muted'}`}>
                <span className={`grid h-9 w-12 place-items-center rounded-full transition ${active ? 'bg-accent/12' : ''}`}><Icon size={22} strokeWidth={active ? 2.4 : 2} /></span>
                <span className="text-[11px] font-bold leading-none text-center">{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Switch({ on, onChange, label, id }) {
  return (
    <button id={id} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-good' : 'bg-line'}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'right-7' : 'right-1'}`} />
    </button>
  );
}

// ---------- الرئيسية ----------
function Dashboard({ state, m, month, actions, isCurrent, go }) {
  const on = state.balanceMode !== 'off';
  const status = m.diff < 0 ? 'deficit' : m.diff === 0 ? 'balanced' : 'surplus';
  return (
    <div className="flex flex-col gap-5 fade-in">
      {/* البطاقة الرئيسية */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-hero1 via-hero1 to-hero2 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 left-16 h-40 w-40 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white/75">المتبقي في الجيب · {monthLabel(month)}</p>
            <p className="mt-1 font-display text-[44px] font-bold leading-none"><Money v={m.pocket} /></p>
            <p className="mt-2 text-xs text-white/75">من راتب <span className="num">{fmt(state.salary)}</span> ر.ع بعد مصروف <span className="num">{fmt(m.spent)}</span> ر.ع</p>
          </div>
          <StatusPill status={status} diff={m.diff} />
        </div>
        <div className="relative mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
          <div className="h-2 rounded-full bg-white" style={{ width: `${Math.min(100, (m.spent / state.salary) * 100)}%` }} />
        </div>
        <dl className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['الراتب', state.salary],
            ['المخصص', m.budgeted],
            ['المصروف', m.spent],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/10 px-1 py-2.5">
              <dt className="text-[11px] text-white/70">{k}</dt>
              <dd className="font-display text-lg font-bold"><Money v={v} /></dd>
            </div>
          ))}
        </dl>
      </section>

      {/* الموازنة الفورية */}
      <BalanceCard state={state} m={m} actions={actions} on={on} />

      {/* الأقسام الثلاثة */}
      <Section title="توزيع الراتب على البطاقات" sub="كل مبلغ ومن أي حساب يُدفع">
        <div className="flex flex-col gap-3">
          {PARTITIONS.map((p) => <PartitionCard key={p.id} p={p} d={m.parts[p.id]} m={m} isCurrent={isCurrent} />)}
        </div>
      </Section>

      {/* البنود الأقرب للحد */}
      <Section title="بنود تحتاج انتباهك" sub="الأعلى استهلاكاً من مخصصها" action={<button onClick={() => go('budget')} className="text-sm font-bold text-accent">كل البنود</button>}>
        <div className="rounded-3xl border border-line bg-surface p-2 shadow-sm">
          {[...m.cats].filter((c) => c.eff > 0 && !c.paid).sort((a, b) => b.spent / b.eff - a.spent / a.eff).slice(0, 4).map((c) => <CatRow key={c.id} c={c} compact />)}
        </div>
      </Section>

      {m.tx.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-surface p-6 text-center">
          <p className="font-bold">لا توجد عمليات في {monthLabel(month)} بعد</p>
          <p className="mt-1 text-sm text-muted">أضف أول مصروف من زر الإضافة في الأسفل.</p>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, diff }) {
  if (status === 'deficit') {
    return (
      <div className="shrink-0 rounded-2xl bg-bad px-3 py-2 text-center shadow-md ring-2 ring-white/30">
        <TriangleAlert size={18} className="mx-auto" />
        <p className="mt-0.5 text-sm font-extrabold whitespace-nowrap">عجز: <span className="num">{fmt(Math.abs(diff))}</span> ر.ع</p>
      </div>
    );
  }
  return (
    <div className="shrink-0 rounded-2xl bg-good px-3 py-2 text-center shadow-md ring-2 ring-white/30">
      <CircleCheck size={18} className="mx-auto" />
      <p className="mt-0.5 text-sm font-extrabold whitespace-nowrap">{status === 'balanced' ? 'ميزانية متزنة' : <>فائض <span className="num">{fmt(diff)}</span> ر.ع</>}</p>
    </div>
  );
}

function BalanceCard({ state, m, actions, on }) {
  const deficitBase = round3(state.salary - m.originalBudget);
  return (
    <section className={`rounded-3xl border p-4 shadow-sm transition ${on ? 'border-good/40 bg-good/5' : 'border-bad/40 bg-bad/5'}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${on ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'}`}><Scale size={22} /></div>
        <div className="min-w-0 flex-1">
          <label htmlFor="balance-switch" className="font-display text-base font-bold">الموازنة الفورية للشهر الحالي</label>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            {on
              ? <>الميزانية الآن <b className="text-good num">{fmt(m.budgeted)}</b> ر.ع، والفرق عن الراتب <b className="num">{fmt(m.diff)}</b> ر.ع.</>
              : deficitBase < 0
                ? <>المخصصات <b className="num text-ink">{fmt(m.originalBudget)}</b> ر.ع تتجاوز الراتب بـ <b className="text-bad num">{fmt(Math.abs(deficitBase))}</b> ر.ع. فعّل الموازنة لسد العجز.</>
                : <>المخصصات ضمن حدود الراتب.</>}
          </p>
        </div>
        <Switch id="balance-switch" on={on} onChange={actions.setBalance} label="تفعيل الموازنة الفورية" />
      </div>

      {on && (
        <div className="mt-4 flex flex-col gap-3 fade-in">
          <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="طريقة الموازنة">
            {Object.entries(BALANCE_MODES).map(([k, v]) => {
              const sel = state.balanceMode === k;
              return (
                <button key={k} role="radio" aria-checked={sel} onClick={() => actions.setBalanceMode(k)}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-3 text-right transition ${sel ? 'border-accent bg-surface shadow-sm' : 'border-line bg-surface/60'}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${sel ? 'border-accent' : 'border-line'}`}>{sel && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{v.label}{k === 'daily' && <span className="ms-2 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] text-accent">مُوصى به</span>}</span>
                    <span className="block text-xs text-muted">{v.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-start gap-2 rounded-2xl bg-ocean/10 px-3 py-3 text-[13px] leading-relaxed text-ocean">
            <Info size={18} className="mt-0.5 shrink-0" />
            <p><b>التوازن التلقائي الشهر القادم عند انتهاء أقساط الخياط.</b> بانتهاء قسط الخياط (<span className="num">22</span> ر.ع) يتحرر مبلغ يغطي العجز، فتعود البنود إلى مخصصاتها الأصلية.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function PartitionCard({ p, d, m, isCurrent }) {
  const Icon = PART_ICONS[p.id];
  const t = tone(d.spent, d.budget);
  const accs = ACCOUNT_ORDER.filter((a) => ACCOUNTS[a].partition === p.id);
  return (
    <article className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent"><Icon size={22} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-bold leading-tight">{p.title}</h3>
          <p className="text-xs text-muted">{p.sub} · <span className="num">{fmt(d.budget)}</span> ر.ع</p>
        </div>
        <div className="text-left">
          <p className="text-[11px] text-muted">المتبقي</p>
          <p className={`font-display text-xl font-bold ${d.remaining < 0 ? 'text-bad' : 'text-ink'}`}><Money v={d.remaining} /></p>
        </div>
      </div>
      <div className="mt-3"><Bar value={d.spent} max={d.budget} t={t} marker={p.id === 'applepay' && isCurrent ? m.elapsedPct : null} /></div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted">مصروف <b className="num text-ink">{fmt(d.spent)}</b> من <span className="num">{fmt(d.budget)}</span></span>
        <span className={`rounded-full px-2 py-0.5 font-bold ${TONE[t].soft}`}>{d.budget > 0 ? Math.round((d.spent / d.budget) * 100) : 0}٪</span>
      </div>
      {p.id === 'other' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {accs.map((a) => <span key={a} className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-muted">{ACCOUNTS[a].short}: <span className="num text-ink">{fmt(m.spentByAcc[a] || 0)}</span> ر.ع</span>)}
        </div>
      )}
      {p.id === 'applepay' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Metric label="الحد اليومي" main={m.dailyBase} hint={isCurrent ? <>المتاح الآن <b className="num">{fmt2(m.dailyNow)}</b> يومياً لـ <span className="num">{m.daysLeft}</span> يوم</> : 'على أساس 28 يوماً'} />
          <Metric label="الحد الأسبوعي" main={m.weeklyBase}
            hint={isCurrent ? <>صُرف هذا الأسبوع <b className={`num ${m.weekSpent > m.weeklyBase ? 'text-bad' : ''}`}>{fmt2(m.weekSpent)}</b></> : 'ربع مخصص البطاقة'}
            bar={isCurrent ? { v: m.weekSpent, max: m.weeklyBase } : null} />
        </div>
      )}
    </article>
  );
}

function Metric({ label, main, hint, bar }) {
  return (
    <div className="rounded-2xl bg-surface2 p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="font-display text-lg font-bold">~<span className="num">{fmt2(main)}</span><span className="ms-1 text-[0.62em] opacity-70">ر.ع</span></p>
      {bar && <div className="my-1.5"><Bar value={bar.v} max={bar.max} t={tone(bar.v, bar.max)} h="h-1.5" /></div>}
      <p className="text-[11px] leading-snug text-muted">{hint}</p>
    </div>
  );
}

// ---------- صف البند ----------
function CatRow({ c, compact, onEdit, onDelete, editing, setEditing }) {
  const Icon = CAT_ICONS[c.icon] || Tag;
  const [val, setVal] = useState(String(c.budget));
  useEffect(() => { if (editing) setVal(String(c.budget)); }, [editing, c.budget]);
  const over = c.remaining < 0;
  return (
    <div className="flex flex-col gap-2 rounded-2xl px-2 py-3">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[c.t].soft}`}><Icon size={19} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-bold text-[15px] leading-tight">{c.name}</p>
            {!compact && <AccountChip id={c.account} />}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {c.paid ? <span className="font-bold text-good">مدفوع بالكامل ✓</span> : over ? <span className="font-bold text-bad">تجاوز بـ <span className="num">{fmt(-c.remaining)}</span> ر.ع</span>
              : <>المتبقي <b className={`num ${TONE[c.t].text}`}>{fmt(c.remaining)}</b> ر.ع</>}
            {' '}من أصل <b className="num text-ink">{fmt(c.eff)}</b> ر.ع
            {c.adjusted && <span className="ms-1 text-[11px]">(بدلاً من <s className="num">{fmt(c.budget)}</s>)</span>}
          </p>
        </div>
        {!compact && onEdit && !editing && (
          <button onClick={() => setEditing(c.id)} aria-label={`تعديل مخصص ${c.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface2"><Pencil size={17} /></button>
        )}
      </div>
      <Bar value={c.spent} max={c.eff} t={c.t} h="h-2" />
      {editing && (
        <form className="flex items-center gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(val); if (!isNaN(v) && v >= 0) { onEdit(c.id, round3(v)); setEditing(null); } }}>
          <label htmlFor={`edit-${c.id}`} className="text-xs font-semibold text-muted whitespace-nowrap">المخصص الأصلي</label>
          <input id={`edit-${c.id}`} inputMode="decimal" type="number" step="0.001" min="0" value={val} onChange={(e) => setVal(e.target.value)} className="num h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-base" autoFocus />
          <button type="submit" aria-label="حفظ" className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white"><Check size={18} /></button>
          <button type="button" aria-label="إلغاء" onClick={() => setEditing(null)} className="grid h-11 w-11 place-items-center rounded-xl bg-surface2 text-muted"><X size={18} /></button>
          {onDelete && <button type="button" aria-label="حذف البند" onClick={() => onDelete(c.id)} className="grid h-11 w-11 place-items-center rounded-xl bg-bad/10 text-bad"><Trash2 size={18} /></button>}
        </form>
      )}
    </div>
  );
}

// ---------- البنود ----------
function BudgetTab({ state, m, actions, notify }) {
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const defaultIds = new Set(['jamiya', 'rent', 'debt', 'saving', 'net', 'elec', 'water', 'fuel', 'ration', 'food', 'oil', 'laundry', 'tailor', 'laser']);
  return (
    <div className="flex flex-col gap-6 fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">حالة البنود والمتبقي</h1>
        <p className="text-sm text-muted">المخصص مقابل المصروف لكل بند، مع المتبقي بالضبط.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-good/10 px-2.5 py-1 text-good">أخضر: آمن (أقل من 75٪)</span>
          <span className="rounded-full bg-warn/10 px-2.5 py-1 text-warn">برتقالي: قريب من الحد</span>
          <span className="rounded-full bg-bad/10 px-2.5 py-1 text-bad">أحمر: تجاوز</span>
        </div>
      </div>
      {GROUP_ORDER.map((g) => {
        const G = m.groups[g];
        return (
          <Section key={g} title={GROUPS[g].label} sub={GROUPS[g].sub}
            action={<div className="text-left text-xs"><span className="text-muted">المتبقي </span><b className={`num text-base ${G.remaining < 0 ? 'text-bad' : ''}`}>{fmt(G.remaining)}</b><span className="text-muted"> / <span className="num">{fmt(G.budget)}</span></span></div>}>
            <div className="divide-y divide-line rounded-3xl border border-line bg-surface p-2 shadow-sm">
              {G.list.map((c) => (
                <CatRow key={c.id} c={c} onEdit={(id, v) => { actions.setBudget(id, v); notify(`تم تحديث مخصص ${c.name}`); }}
                  onDelete={!defaultIds.has(c.id) ? (id) => { actions.delCat(id); setEditing(null); notify('تم حذف البند', 'bad'); } : null}
                  editing={editing === c.id} setEditing={setEditing} />
              ))}
              {G.list.length === 0 && <p className="p-4 text-center text-sm text-muted">لا توجد بنود في هذا التصنيف.</p>}
            </div>
          </Section>
        );
      })}
      {m.orphan > 0 && <p className="rounded-2xl bg-warn/10 p-3 text-sm text-warn">عمليات بقيمة <span className="num">{fmt(m.orphan)}</span> ر.ع مرتبطة ببنود محذوفة.</p>}

      {showNew ? <NewCategory onCancel={() => setShowNew(false)} onSave={(c) => { actions.addCat(c); setShowNew(false); notify(`أُضيف بند ${c.name}`); }} />
        : (
          <button onClick={() => setShowNew(true)} className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 font-bold text-accent">
            <Plus size={20} />إضافة بند مخصص
          </button>
        )}
      <p className="text-center text-xs text-muted">تعديل المخصص يلغي قيمة الموازنة الفورية لذلك البند.</p>
    </div>
  );
}

function NewCategory({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('variable');
  const [budget, setBudget] = useState('');
  const [account, setAccount] = useState('applepay');
  const [err, setErr] = useState('');
  return (
    <form className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm" onSubmit={(e) => {
      e.preventDefault();
      const b = parseFloat(budget);
      if (!name.trim()) return setErr('اكتب اسم البند.');
      if (isNaN(b) || b < 0) return setErr('أدخل مخصصاً صحيحاً بالريال (صفر أو أكثر).');
      onSave({ id: `c${Date.now().toString(36)}`, name: name.trim(), group, budget: round3(b), account, icon: 'tag' });
    }}>
      <h3 className="font-display font-bold">بند جديد</h3>
      <Field label="اسم البند" htmlFor="nc-name"><input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: هدايا" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="التصنيف" htmlFor="nc-group">
          <select id="nc-group" value={group} onChange={(e) => setGroup(e.target.value)} className="input">{GROUP_ORDER.map((g) => <option key={g} value={g}>{GROUPS[g].label}</option>)}</select>
        </Field>
        <Field label="المخصص (ر.ع)" htmlFor="nc-budget"><input id="nc-budget" inputMode="decimal" type="number" step="0.001" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className="input num" placeholder="0" /></Field>
      </div>
      <Field label="يُدفع من" htmlFor="nc-acc">
        <select id="nc-acc" value={account} onChange={(e) => setAccount(e.target.value)} className="input">{ACCOUNT_ORDER.map((a) => <option key={a} value={a}>{ACCOUNTS[a].label}</option>)}</select>
      </Field>
      {err && <p className="text-sm font-semibold text-bad">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" className="h-12 rounded-2xl bg-accent font-bold text-white">حفظ البند</button>
        <button type="button" onClick={onCancel} className="h-12 rounded-2xl bg-surface2 font-bold text-muted">إلغاء</button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children, hint }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ---------- إضافة عملية ----------
function AddTab({ state, m, actions, notify, month, setMonth }) {
  const [date, setDate] = useState(todayISO());
  const [catId, setCatId] = useState('food');
  const [account, setAccount] = useState('applepay');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [err, setErr] = useState('');
  const cat = state.categories.find((c) => c.id === catId) || state.categories[0];
  const live = m.cats.find((c) => c.id === cat?.id);
  const amt = parseFloat(amount);
  const after = live && !isNaN(amt) ? round3(live.remaining - amt) : null;

  const pickCat = (id) => {
    setCatId(id);
    const c = state.categories.find((x) => x.id === id);
    if (c) { setAccount(c.account); setRecurring(c.group === 'fixed'); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!date) return setErr('اختر تاريخ العملية.');
    if (isNaN(amt) || amt <= 0) return setErr('أدخل مبلغاً أكبر من صفر بالريال العماني.');
    actions.addTx({ date, catId: cat.id, account, amount: round3(amt), note: note.trim(), recurring });
    notify(`أُضيفت ${fmt(amt)} ر.ع إلى ${cat.name}`);
    if (monthOf(date) !== month) setMonth(monthOf(date));
    setAmount(''); setNote(''); setErr('');
  };

  const quick = ['fuel', 'food', 'ration', 'laundry'].map((id) => state.categories.find((c) => c.id === id)).filter(Boolean);

  return (
    <div className="flex flex-col gap-5 fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">إضافة عملية جديدة</h1>
        <p className="text-sm text-muted">اختر البند وسيُحدَّد التصنيف والبطاقة تلقائياً.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label="بنود سريعة">
        {quick.map((c) => {
          const Icon = CAT_ICONS[c.icon] || Tag;
          const sel = c.id === catId;
          return (
            <button key={c.id} type="button" onClick={() => pickCat(c.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-sm font-bold transition ${sel ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink'}`}>
              <Icon size={16} />{c.name}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4 shadow-sm">
        <Field label="المبلغ (ر.ع)" htmlFor="tx-amount">
          <div className="relative">
            <input id="tx-amount" inputMode="decimal" type="number" step="0.001" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(''); }}
              placeholder="0.000" className="num h-16 w-full rounded-2xl border-2 border-line bg-bg pe-16 ps-4 font-display text-3xl font-bold focus:border-accent" />
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted">ر.ع</span>
          </div>
        </Field>

        <Field label="البند" htmlFor="tx-cat">
          <select id="tx-cat" value={cat?.id} onChange={(e) => pickCat(e.target.value)} className="input">
            {GROUP_ORDER.map((g) => (
              <optgroup key={g} label={GROUPS[g].label}>
                {state.categories.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface2 px-3 py-2.5 text-sm">
          <span className="text-muted">التصنيف:</span>
          <span className="rounded-full bg-accent/12 px-2.5 py-0.5 font-bold text-accent">{GROUPS[cat?.group]?.label}</span>
          {live && <span className="ms-auto text-xs text-muted">المتبقي في البند <b className={`num ${TONE[live.t].text}`}>{fmt(live.remaining)}</b> ر.ع</span>}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field label="التاريخ" htmlFor="tx-date">
            <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input num" />
          </Field>
          <Field label="البطاقة / الحساب المستخدم" htmlFor="tx-acc">
            <select id="tx-acc" value={account} onChange={(e) => setAccount(e.target.value)} className="input">
              {ACCOUNT_ORDER.map((a) => <option key={a} value={a}>{ACCOUNTS[a].label}</option>)}
            </select>
          </Field>
        </div>
        {cat && account !== cat.account && (
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-warn"><Info size={14} />هذا البند يُدفع عادة من {ACCOUNTS[cat.account].label}.</p>
        )}

        <Field label="ملاحظة" htmlFor="tx-note">
          <input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="مثال: محطة شل، لولو، عشاء…" />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 px-3 py-3">
          <label htmlFor="tx-rec" className="flex items-center gap-2 text-sm font-bold"><Repeat size={18} className="text-ocean" />تكرار العملية شهرياً</label>
          <Switch id="tx-rec" on={recurring} onChange={setRecurring} label="تكرار العملية شهرياً" />
        </div>

        {after != null && (
          <p className={`text-sm font-semibold ${after < 0 ? 'text-bad' : 'text-muted'}`}>
            {after < 0 ? <>تنبيه: ستتجاوز مخصص {cat.name} بـ <span className="num">{fmt(-after)}</span> ر.ع</> : <>بعد الإضافة يتبقى <span className="num text-ink">{fmt(after)}</span> ر.ع في {cat.name}</>}
          </p>
        )}
        {err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}

        <button type="submit" className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-hero1 to-hero2 font-display text-xl font-bold text-white shadow-lg active:scale-[0.99] transition">
          <Plus size={24} strokeWidth={2.6} />حفظ العملية
        </button>
      </form>

      <Section title="آخر العمليات" sub={monthLabel(month)}>
        <div className="divide-y divide-line rounded-3xl border border-line bg-surface px-3 shadow-sm">
          {m.tx.slice(0, 4).map((t) => <TxRow key={t.id} t={t} cat={m.catMap[t.catId]} />)}
          {m.tx.length === 0 && <p className="py-5 text-center text-sm text-muted">لا توجد عمليات بعد.</p>}
        </div>
      </Section>
    </div>
  );
}

function TxRow({ t, cat, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const Icon = CAT_ICONS[cat?.icon] || Tag;
  useEffect(() => { if (!confirm) return; const x = setTimeout(() => setConfirm(false), 3000); return () => clearTimeout(x); }, [confirm]);
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-accent"><Icon size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-[15px]">{cat?.name || 'بند محذوف'}</p>
          {t.recurring && <Repeat size={13} className="shrink-0 text-ocean" aria-label="متكررة" />}
          {t.sample && <span className="shrink-0 rounded bg-surface2 px-1 text-[10px] text-muted">مثال</span>}
        </div>
        <p className="truncate text-xs text-muted">{dayLabel(t.date)} · {ACCOUNTS[t.account]?.short}{t.note ? ` · ${t.note}` : ''}</p>
      </div>
      <p className="font-display text-base font-bold"><Money v={t.amount} /></p>
      {onDelete && (
        confirm
          ? <button onClick={() => onDelete(t.id)} className="h-10 shrink-0 rounded-xl bg-bad px-3 text-xs font-bold text-white">تأكيد الحذف</button>
          : <button onClick={() => setConfirm(true)} aria-label="حذف العملية" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-bad/10 hover:text-bad"><Trash2 size={18} /></button>
      )}
    </div>
  );
}

// ---------- السجل والتحليل ----------
const GROUP_COLORS = { fixed: 'rgb(var(--brand))', variable: 'rgb(var(--accent))', oneoff: 'rgb(var(--ocean-soft))' };

function Donut({ data, total, size = 168 }) {
  const r = 62, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg viewBox="0 0 168 168" width={size} height={size} role="img" aria-label="توزيع المصروف حسب التصنيف" className="shrink-0">
      <circle cx="84" cy="84" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="20" />
      {total > 0 && data.map((d) => {
        const len = (d.v / total) * c;
        const el = <circle key={d.k} cx="84" cy="84" r={r} fill="none" stroke={d.color} strokeWidth="20" strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 84 84)" strokeLinecap="butt" />;
        off += len;
        return el;
      })}
      <text x="84" y="78" textAnchor="middle" fill="rgb(var(--muted))" fontSize="11" fontWeight="600">إجمالي المصروف</text>
      <text x="84" y="102" textAnchor="middle" fill="rgb(var(--ink))" fontSize="22" fontWeight="800" className="num">{fmt(total)}</text>
    </svg>
  );
}

function LogTab({ state, m, month, actions }) {
  const [q, setQ] = useState('');
  const [g, setG] = useState('all');
  const [acc, setAcc] = useState('all');
  const filtered = m.tx.filter((t) => {
    const cat = m.catMap[t.catId];
    if (g !== 'all' && cat?.group !== g) return false;
    if (acc !== 'all' && t.account !== acc) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      const hay = `${cat?.name || ''} ${t.note || ''} ${ACCOUNTS[t.account]?.label || ''} ${t.amount}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
  const grouped = GROUP_ORDER.map((k) => ({ k, list: filtered.filter((t) => m.catMap[t.catId]?.group === k) })).filter((x) => x.list.length);
  const orphans = filtered.filter((t) => !m.catMap[t.catId]);
  const donut = GROUP_ORDER.map((k) => ({ k, v: m.groups[k].spent, color: GROUP_COLORS[k] }));
  const recCount = state.transactions.filter((t) => monthOf(t.date) === shiftMonth(month, -1) && t.recurring).length;

  return (
    <div className="flex flex-col gap-6 fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">السجل والتحليلات</h1>
        <p className="text-sm text-muted">{monthLabel(month)} · <span className="num">{m.tx.length}</span> عملية</p>
      </div>

      {/* التحليل */}
      <section className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="font-display font-bold">نسبة الإنفاق حسب التصنيف</h2>
        <div className="mt-3 flex flex-col items-center gap-4 min-[380px]:flex-row">
          <Donut data={donut} total={m.spent} size={150} />
          <ul className="flex w-full min-w-0 flex-col gap-3">
            {GROUP_ORDER.map((k) => {
              const G = m.groups[k];
              const share = m.spent > 0 ? Math.round((G.spent / m.spent) * 100) : 0;
              return (
                <li key={k} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 font-bold"><span className="h-3 w-3 rounded-sm" style={{ background: GROUP_COLORS[k] }} />{GROUPS[k].label}</span>
                    <span className="num font-bold">{share}٪</span>
                  </div>
                  <p className="text-xs text-muted"><span className="num">{fmt(G.spent)}</span> من <span className="num">{fmt(G.budget)}</span> ر.ع مخصص</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="text-sm font-bold">استهلاك المخصص</h3>
          {GROUP_ORDER.map((k) => {
            const G = m.groups[k];
            const p = G.budget ? Math.round((G.spent / G.budget) * 100) : 0;
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold text-muted">{GROUPS[k].label}</span>
                <div className="flex-1"><Bar value={G.spent} max={G.budget} t={tone(G.spent, G.budget)} /></div>
                <span className="num w-10 shrink-0 text-left text-xs font-bold">{p}٪</span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="text-sm font-bold">المصروف حسب البطاقة</h3>
          {ACCOUNT_ORDER.map((a) => {
            const v = m.spentByAcc[a] || 0;
            const max = Math.max(...ACCOUNT_ORDER.map((x) => m.spentByAcc[x] || 0), 1);
            return (
              <div key={a} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold text-muted">{ACCOUNTS[a].short}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line/70"><div className="h-2.5 rounded-full bg-ocean" style={{ width: `${(v / max) * 100}%` }} /></div>
                <span className="num w-14 shrink-0 text-left text-xs font-bold">{fmt(v)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* أدوات البحث */}
      <section className="flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input id="log-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالبند أو الملاحظة أو المبلغ" className="input pe-4 ps-4 !pr-11" aria-label="بحث في العمليات" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[['all', 'الكل'], ...GROUP_ORDER.map((k) => [k, GROUPS[k].label])].map(([k, l]) => (
            <button key={k} onClick={() => setG(k)} className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold ${g === k ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-muted'}`}>{l}</button>
          ))}
        </div>
        <select id="log-acc" value={acc} onChange={(e) => setAcc(e.target.value)} className="input" aria-label="تصفية حسب البطاقة">
          <option value="all">كل البطاقات والحسابات</option>
          {ACCOUNT_ORDER.map((a) => <option key={a} value={a}>{ACCOUNTS[a].label}</option>)}
        </select>
        <button onClick={actions.copyRecurring} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ocean/10 text-sm font-bold text-ocean">
          <Copy size={17} />نسخ العمليات المتكررة من الشهر السابق{recCount ? <span className="num">({recCount})</span> : null}
        </button>
      </section>

      {/* القائمة */}
      {grouped.map(({ k, list }) => (
        <Section key={k} title={GROUPS[k].label} sub={`${list.length} عملية`} action={<b className="font-display text-base"><Money v={list.reduce((a, t) => a + t.amount, 0)} /></b>}>
          <div className="divide-y divide-line rounded-3xl border border-line bg-surface px-3 shadow-sm">
            {list.map((t) => <TxRow key={t.id} t={t} cat={m.catMap[t.catId]} onDelete={actions.delTx} />)}
          </div>
        </Section>
      ))}
      {orphans.length > 0 && (
        <Section title="بنود محذوفة">
          <div className="divide-y divide-line rounded-3xl border border-line bg-surface px-3">{orphans.map((t) => <TxRow key={t.id} t={t} cat={null} onDelete={actions.delTx} />)}</div>
        </Section>
      )}
      {filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">لا توجد عمليات مطابقة للبحث أو التصفية.</div>
      )}
    </div>
  );
}

// ---------- التقرير ----------
function ReportTab({ state, m, month, clean, setClean, actions }) {
  const [resetAsk, setResetAsk] = useState(false);
  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const modeLabel = state.balanceMode === 'off' ? 'غير مفعّلة' : BALANCE_MODES[state.balanceMode].label;
  return (
    <div className="flex flex-col gap-5 fade-in">
      {!clean && (
        <div className="no-print flex flex-col gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">طباعة التقرير الشهري</h1>
            <p className="text-sm text-muted">تقرير نظيف بالجداول للحفظ أو الطباعة أو لقطة الشاشة.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {!framed && (
              <button onClick={() => window.print()} className="col-span-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-hero1 to-hero2 font-display text-lg font-bold text-white shadow-lg">
                <Printer size={22} />طباعة التقرير الشهري / PDF
              </button>
            )}
            <button onClick={() => { setClean(true); window.scrollTo(0, 0); }} className={`flex h-14 items-center justify-center gap-2 rounded-2xl font-bold ${framed ? 'col-span-2 bg-gradient-to-l from-hero1 to-hero2 text-white shadow-lg font-display text-lg' : 'col-span-2 bg-surface2 text-ink'}`}>
              <Maximize2 size={20} />عرض نظيف للتقاط الشاشة
            </button>
          </div>
          {framed && (
            <p className="flex items-start gap-2 rounded-2xl bg-ocean/10 p-3 text-[13px] leading-relaxed text-ocean">
              <Info size={17} className="mt-0.5 shrink-0" />
              نافذة الطباعة لا تعمل داخل هذا العارض. لطباعة التقرير أو حفظه PDF افتح ملف التطبيق <b>index.html</b> مباشرة في المتصفح، أو استخدم العرض النظيف ثم التقط صورة للشاشة.
            </p>
          )}
        </div>
      )}

      <article className="report rounded-3xl border border-line bg-surface p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-3 border-b-2 border-hero1 pb-3">
          <div>
            <p className="text-xs font-bold text-accent">التقرير الشهري للراتب</p>
            <h2 className="font-display text-xl font-bold">{monthLabel(month)}</h2>
            <p className="text-xs text-muted">الموازنة الفورية: {modeLabel}</p>
          </div>
          <div className={`rounded-xl px-3 py-2 text-center text-sm font-extrabold text-white ${m.diff < 0 ? 'bg-bad' : 'bg-good'}`}>
            {m.diff < 0 ? <>عجز <span className="num">{fmt(-m.diff)}</span> ر.ع</> : m.diff === 0 ? 'ميزانية متزنة' : <>فائض <span className="num">{fmt(m.diff)}</span> ر.ع</>}
          </div>
        </header>

        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {[['الراتب', state.salary], ['المخصص', m.budgeted], ['المصروف', m.spent], ['المتبقي', m.pocket]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface2 px-1 py-2">
              <p className="text-[10px] font-semibold text-muted">{k}</p>
              <p className="num text-[15px] font-extrabold">{fmt(v)}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-5 mb-2 text-sm font-bold">ملخص البطاقات والحسابات</h3>
        <div className="overflow-x-auto">
          <table className="rtable">
            <thead><tr><th>الحساب</th><th>المخصص</th><th>المصروف</th><th>المتبقي</th><th className="w-1/4">الاستهلاك</th></tr></thead>
            <tbody>
              {PARTITIONS.map((p) => {
                const d = m.parts[p.id];
                const t = tone(d.spent, d.budget);
                return (
                  <tr key={p.id}><td className="font-bold">{p.title}</td><td className="num">{fmt(d.budget)}</td><td className="num">{fmt(d.spent)}</td><td className={`num font-bold ${d.remaining < 0 ? 'text-bad' : ''}`}>{fmt(d.remaining)}</td>
                    <td><Bar value={d.spent} max={d.budget} t={t} h="h-1.5" /></td></tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 mb-2 text-sm font-bold">الميزانية حسب البنود</h3>
        <div className="overflow-x-auto">
          <table className="rtable">
            <thead><tr><th>البند</th><th>يُدفع من</th><th>المخصص</th><th>المصروف</th><th>المتبقي</th></tr></thead>
            {GROUP_ORDER.map((g) => {
              const G = m.groups[g];
              return (
                <tbody key={g}>
                  <tr className="group-row"><td colSpan={2}>{GROUPS[g].label}</td><td className="num">{fmt(G.budget)}</td><td className="num">{fmt(G.spent)}</td><td className="num">{fmt(G.remaining)}</td></tr>
                  {G.list.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}{c.adjusted && <span className="text-[10px] text-muted"> (معدّل من <span className="num">{fmt(c.budget)}</span>)</span>}</td>
                      <td className="text-muted">{ACCOUNTS[c.account]?.short}</td>
                      <td className="num">{fmt(c.eff)}</td><td className="num">{fmt(c.spent)}</td>
                      <td className={`num font-bold ${TONE[c.t].text}`}>{fmt(c.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
            <tfoot><tr><td colSpan={2}>الإجمالي</td><td className="num">{fmt(m.budgeted)}</td><td className="num">{fmt(m.spent)}</td><td className="num">{fmt(round3(m.budgeted - m.spent))}</td></tr></tfoot>
          </table>
        </div>

        <h3 className="mt-5 mb-2 text-sm font-bold">العمليات المفصّلة (<span className="num">{m.tx.length}</span>)</h3>
        <div className="overflow-x-auto">
          <table className="rtable">
            <thead><tr><th>التاريخ</th><th>البند</th><th>البطاقة</th><th>ملاحظة</th><th>المبلغ</th></tr></thead>
            <tbody>
              {[...m.tx].reverse().map((t) => (
                <tr key={t.id}><td className="num whitespace-nowrap">{t.date.slice(5).split('-').reverse().join('/')}</td><td>{m.catMap[t.catId]?.name || 'بند محذوف'}{t.recurring ? ' ↻' : ''}</td><td className="text-muted whitespace-nowrap">{ACCOUNTS[t.account]?.short}</td><td className="text-muted">{t.note}</td><td className="num font-bold">{fmt(t.amount)}</td></tr>
              ))}
              {m.tx.length === 0 && <tr><td colSpan={5} className="text-center text-muted">لا توجد عمليات</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-[10px] text-muted">جميع المبالغ بالريال العماني · ↻ عملية متكررة شهرياً · أُعدّ في {dayLabel(todayISO())}</p>
      </article>

      {!clean && (
        <section className="no-print mt-2 rounded-3xl border border-bad/30 bg-bad/5 p-4">
          <h2 className="flex items-center gap-2 font-display font-bold text-bad"><RotateCcw size={18} />إعادة ضبط</h2>
          <p className="mt-1 text-sm text-muted">يحذف كل العمليات والتعديلات المحفوظة على هذا الجهاز ويعيد البنود والبيانات التجريبية الافتراضية.</p>
          {resetAsk ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => { actions.reset(); setResetAsk(false); }} className="h-12 rounded-2xl bg-bad font-bold text-white">نعم، أعد الضبط</button>
              <button onClick={() => setResetAsk(false)} className="h-12 rounded-2xl bg-surface2 font-bold text-muted">إلغاء</button>
            </div>
          ) : (
            <button onClick={() => setResetAsk(true)} className="mt-3 h-12 w-full rounded-2xl border-2 border-bad/40 font-bold text-bad">إعادة ضبط التطبيق</button>
          )}
        </section>
      )}
    </div>
  );
}
