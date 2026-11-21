import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet, Plus, Pencil, Check, X, Trash2, Printer, RotateCcw, ArrowRight, CircleCheck, Info, Search,
  House, ChartPie, ReceiptText, TriangleAlert, Landmark, Smartphone, CreditCard, Users, Building2, HandCoins,
  PiggyBank, Wifi, Zap, Droplets, Fuel, Utensils, ShoppingCart, Popcorn, Wrench, WashingMachine, Scissors,
  Stethoscope, Siren, Tag, Flame,
} from 'lucide-react';
import {
  ACCOUNTS, COMPARE_IDS, GROUPS, SALARY, STORAGE_KEY, dateLabel, dayHeading, defaultState, fmt, fmtShort,
  round3, todayISO, uid,
} from './data.js';

const ITEM_ICONS = {
  jamiya: Users, rent: Building2, debt: HandCoins, saving: PiggyBank, net: Wifi, elec: Zap, water: Droplets,
  fuel: Fuel, food: Utensils, ration: ShoppingCart, fun: Popcorn, oil: Wrench, laundry: WashingMachine,
  tailor: Scissors, laser: Stethoscope, emergency: Siren,
};
const ACC_ICONS = { salary: Landmark, applepay: Smartphone, card1: CreditCard, card2: CreditCard };

// ---------- الحالة اللونية ----------
const status = (spent, budget) => {
  if (budget <= 0) return spent > 0 ? 'bad' : 'idle';
  const p = spent / budget;
  if (p > 1.0001) return 'bad';
  if (p > 0.9999) return 'done';
  if (p >= 0.75) return 'warn';
  return 'good';
};
const TONE = {
  good: { bar: 'bg-mint', text: 'text-mint', soft: 'bg-mint/12 text-mint' },
  warn: { bar: 'bg-amber', text: 'text-amber', soft: 'bg-amber/15 text-amber' },
  bad: { bar: 'bg-coral', text: 'text-coral', soft: 'bg-coral/12 text-coral' },
  done: { bar: 'bg-mint', text: 'text-mint', soft: 'bg-mint/12 text-mint' },
  idle: { bar: 'bg-line', text: 'text-muted', soft: 'bg-surface2 text-muted' },
};

// ---------- التخزين ----------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Array.isArray(s.categories) && Array.isArray(s.transactions)) return s;
  } catch (e) { /* التخزين غير متاح */ }
  return defaultState();
}

// ---------- عناصر صغيرة ----------
function Money({ v, className = '', sign = '' }) {
  return (
    <span className={`num whitespace-nowrap ${className}`} dir="ltr">
      <span className="me-1 text-[0.6em] font-bold opacity-60">ر.ع</span>{sign}{fmt(v)}
    </span>
  );
}
function DeficitBadge({ v, size = 'sm' }) {
  return (
    <span className={`num inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-coral font-extrabold text-white shadow-sm ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}>
      عجز: {fmtShort(v)} ر.ع
    </span>
  );
}
function AccTag({ id }) {
  const Icon = ACC_ICONS[id] || CreditCard;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface2 px-1.5 py-0.5 text-[11px] font-bold text-muted">
      <Icon size={11} aria-hidden="true" />{ACCOUNTS[id]}
    </span>
  );
}
function Bar({ spent, budget, h = 'h-1.5' }) {
  const s = status(spent, budget);
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
  return (
    <div className={`${h} w-full overflow-hidden rounded-full bg-surface2`}>
      <div className={`${h} rounded-full ${TONE[s].bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
function Card({ children, className = '' }) {
  return <div className={`rounded-3xl border border-line/70 bg-surface shadow-card ${className}`}>{children}</div>;
}

// ---------- التطبيق ----------
export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('st3-tab') || 'home'; } catch (e) { return 'home'; } });
  const [printing, setPrinting] = useState(false);
  const [sheet, setSheet] = useState(null); // { catId }
  const [toast, setToast] = useState('');

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* تجاهل */ } }, [state]);
  useEffect(() => { try { sessionStorage.setItem('st3-tab', tab); } catch (e) { /* تجاهل */ } window.scrollTo(0, 0); }, [tab]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);

  const data = useMemo(() => {
    const spentBy = {};
    for (const t of state.transactions) spentBy[t.catId] = (spentBy[t.catId] || 0) + t.amount;
    const cats = state.categories.map((c) => {
      const spent = round3(spentBy[c.id] || 0);
      return { ...c, spent, remaining: round3(c.budget - spent), s: status(spent, c.budget) };
    });
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
    const groups = GROUPS.map((g) => {
      const list = cats.filter((c) => c.group === g.id);
      const budget = round3(list.reduce((a, c) => a + c.budget, 0));
      const spent = round3(list.reduce((a, c) => a + c.spent, 0));
      return { ...g, list, budget, spent, remaining: round3(budget - spent) };
    });
    const accounts = Object.keys(ACCOUNTS).map((id) => {
      const limit = round3(cats.filter((c) => c.account === id).reduce((a, c) => a + c.budget, 0));
      const spent = round3(state.transactions.filter((t) => t.account === id).reduce((a, t) => a + t.amount, 0));
      return { id, label: ACCOUNTS[id], limit, spent };
    });
    const spent = round3(state.transactions.reduce((a, t) => a + t.amount, 0));
    const allocated = round3(cats.reduce((a, c) => a + c.budget, 0));
    const history = [...state.transactions].sort((a, b) => (a.date === b.date ? b.created - a.created : a.date < b.date ? 1 : -1));
    return { cats, catMap, groups, accounts, spent, allocated, remaining: round3(SALARY - spent), history };
  }, [state]);

  const act = {
    addTx: (tx) => setState((s) => ({ ...s, transactions: [...s.transactions, { ...tx, id: uid(), created: Date.now() }] })),
    delTx: (id) => setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
    setBudget: (id, budget) => setState((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, budget } : c)) })),
    addCat: (c) => setState((s) => ({ ...s, categories: [...s.categories, c] })),
    delCat: (id) => setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id), transactions: s.transactions.filter((t) => t.catId !== id) })),
    reset: () => setState(defaultState()),
  };
  const openSheet = (catId = '') => setSheet({ catId });

  if (printing) return <PrintView data={data} onBack={() => setPrinting(false)} />;

  return (
    <div className="min-h-full bg-bg text-ink">
      <main className="gutter mx-auto flex max-w-md flex-col gap-6 pb-44" style={{ paddingTop: '16px' }}>
        {tab === 'home' && <HomeTab data={data} act={act} notify={setToast} openSheet={openSheet} />}
        {tab === 'stats' && <StatsTab data={data} />}
        {tab === 'log' && <LogTab data={data} act={act} notify={setToast} onPrint={() => { setPrinting(true); window.scrollTo(0, 0); }} />}
      </main>

      {/* زر التسجيل العائم */}
      <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={() => openSheet()} className="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-indigo px-7 text-lg font-extrabold text-white shadow-fab ring-4 ring-bg transition active:scale-95">
          <Plus size={24} strokeWidth={2.8} />تسجيل مصروف
        </button>
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      {sheet && (
        <EntrySheet cats={data.cats} initial={sheet.catId} onClose={() => setSheet(null)}
          onSave={(tx, name) => { act.addTx(tx); setSheet(null); setToast(`سُجّل ${fmtShort(tx.amount)} ر.ع على ${name}`); }} />
      )}

      {toast && (
        <div className="fixed inset-x-0 z-50 flex justify-center px-4 toast-in" style={{ top: 'calc(14px + env(safe-area-inset-top, 0px))' }} role="status">
          <div className="flex items-center gap-2 rounded-2xl bg-navy px-4 py-3 text-sm font-bold text-white shadow-hero"><CircleCheck size={18} className="text-mint" />{toast}</div>
        </div>
      )}
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'home', label: 'الرئيسية والبنود', icon: House },
    { id: 'stats', label: 'البيانات والرسومات', icon: ChartPie },
    { id: 'log', label: 'سجل العمليات', icon: ReceiptText },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/90 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="التنقل">
      <ul className="gutter mx-auto grid max-w-md grid-cols-3 py-2">
        {items.map(({ id, label, icon: Icon }) => {
          const on = tab === id;
          return (
            <li key={id}>
              <button onClick={() => setTab(id)} aria-current={on ? 'page' : undefined} className={`flex w-full flex-col items-center gap-1 rounded-2xl py-1.5 transition ${on ? 'text-indigo' : 'text-muted'}`}>
                <span className={`grid h-8 w-14 place-items-center rounded-full transition ${on ? 'bg-indigo/12' : ''}`}><Icon size={21} strokeWidth={on ? 2.4 : 2} /></span>
                <span className="text-[11px] font-bold">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PageTitle({ title, sub, action }) {
  return (
    <div className="flex items-end justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ================= الرئيسية والبنود =================
function HomeTab({ data, act, notify, openSheet }) {
  const over = round3(data.spent - SALARY);
  const pct = Math.min(100, (data.spent / SALARY) * 100);
  return (
    <div className="flex flex-col gap-6 fade-in">
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-navy text-white"><Wallet size={20} /></div>
        <div className="leading-tight">
          <p className="text-xs font-medium text-muted">تتبع مصاريف الراتب</p>
          <p className="text-base font-extrabold">محفظتي الشهرية</p>
        </div>
      </div>

      {/* بطاقة الرصيد الرئيسية */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-navy via-navy to-navy2 p-5 text-white shadow-hero ring-1 ring-white/5">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-indigo/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-48 rounded-full bg-mint/15 blur-3xl" aria-hidden="true" />
        <div className="relative">
          {over > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-full bg-coral px-3 py-1.5 text-sm font-extrabold w-fit">
              <TriangleAlert size={16} />تجاوزت الراتب بـ <span className="num">{fmtShort(over)}</span> ر.ع
            </div>
          )}
          <p className="text-[13px] font-medium text-white/60">المتبقي الفعلي من الراتب</p>
          <p className="mt-1 text-[44px] font-extrabold leading-none tracking-tight"><Money v={data.remaining} className={data.remaining < 0 ? 'text-coral' : ''} /></p>
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-2 rounded-full transition-all duration-700 ${over > 0 ? 'bg-coral' : 'bg-gradient-to-l from-mint to-indigo'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-white/50">صُرف <span className="num">{Math.round(pct)}٪</span> من الراتب</p>
          </div>
          <dl className="mt-4 grid grid-cols-3 divide-x divide-x-reverse divide-white/10 rounded-2xl bg-white/[0.06] py-3 text-center">
            {[['الراتب', SALARY], ['الموزع', data.allocated], ['المصروف الفعلي', data.spent]].map(([k, v]) => (
              <div key={k} className="px-1">
                <dt className="text-[11px] text-white/55">{k}</dt>
                <dd className="num mt-0.5 text-lg font-extrabold">{fmtShort(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {data.groups.map((g) => <GroupBlock key={g.id} g={g} act={act} notify={notify} openSheet={openSheet} />)}
      <p className="-mt-2 text-center text-xs text-muted">اضغط على أي بند لتسجيل مصروف عليه مباشرة.</p>
    </div>
  );
}

function GroupBlock({ g, act, notify, openSheet }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const deficit = g.spent > g.budget ? round3(g.spent - g.budget) : 0;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
        <h2 className="min-w-0 flex-1 text-base font-extrabold">{g.label}</h2>
        {deficit > 0 ? <DeficitBadge v={deficit} /> : <span className="num text-sm font-bold text-muted">{fmtShort(g.budget)} ر.ع</span>}
      </div>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line/70">
          {g.list.map((c) => (
            <ItemRow key={c.id} c={c} editing={editing === c.id} setEditing={setEditing} onOpen={() => openSheet(c.id)}
              onSave={(v) => { act.setBudget(c.id, v); setEditing(null); notify(`تم تعديل مخصص ${c.name}`); }}
              onDelete={c.custom ? () => { act.delCat(c.id); setEditing(null); notify(`تم حذف ${c.name}`); } : null} />
          ))}
        </ul>
        <div className="border-t border-line/70 px-4 py-2">
          {adding
            ? <NewItem group={g.id} onCancel={() => setAdding(false)} onSave={(c) => { act.addCat(c); setAdding(false); notify(`أُضيف بند ${c.name}`); }} />
            : <button onClick={() => setAdding(true)} className="flex h-10 items-center gap-1.5 text-sm font-bold text-indigo"><Plus size={17} />إضافة بند</button>}
        </div>
      </Card>
    </section>
  );
}

function ItemRow({ c, editing, setEditing, onOpen, onSave, onDelete }) {
  const [val, setVal] = useState(String(c.budget));
  useEffect(() => { if (editing) setVal(String(c.budget)); }, [editing, c.budget]);
  const Icon = ITEM_ICONS[c.id] || Tag;
  const deficit = c.spent > c.budget ? round3(c.spent - c.budget) : 0;
  return (
    <li>
      <div role="button" tabIndex={0} onClick={() => !editing && onOpen()} onKeyDown={(e) => { if (!editing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
        className="flex cursor-pointer flex-col gap-2.5 px-4 py-3.5 transition active:bg-surface2" aria-label={`تسجيل مصروف على ${c.name}`}>
        <div className="flex items-center gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONE[c.s === 'idle' ? 'idle' : c.s].soft}`}><Icon size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-bold">{c.name}</span>
              <AccTag id={c.account} />
            </div>
            <p className="mt-0.5 text-xs text-muted">
              صُرف <span className="num font-bold text-ink">{fmtShort(c.spent)}</span> من <span className="num">{fmtShort(c.budget)}</span>
            </p>
          </div>
          <div className="shrink-0 text-left">
            {deficit > 0 ? <DeficitBadge v={deficit} /> : c.s === 'done' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-mint/12 px-2.5 py-1 text-xs font-extrabold text-mint"><Check size={13} strokeWidth={3} />مدفوع بالكامل</span>
            ) : (
              <span className={`text-[13px] font-bold ${c.s === 'warn' ? 'text-amber' : c.s === 'idle' ? 'text-muted' : 'text-mint'}`}>
                متبقي <span className="num text-[15px]">{fmtShort(c.remaining)}</span> ر.ع
                <span className="block text-[11px] font-medium text-muted">من <span className="num">{fmtShort(c.budget)}</span></span>
              </span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setEditing(editing ? null : c.id); }} aria-label={`تعديل مخصص ${c.name}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface2"><Pencil size={15} /></button>
        </div>
        <Bar spent={c.spent} budget={c.budget} />
      </div>
      {editing && (
        <form className="flex items-center gap-2 px-4 pb-3" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(val); if (!isNaN(v) && v >= 0) onSave(round3(v)); }}>
          <label htmlFor={`b-${c.id}`} className="whitespace-nowrap text-xs font-bold text-muted">المخصص</label>
          <input id={`b-${c.id}`} type="number" inputMode="decimal" step="0.001" min="0" value={val} onChange={(e) => setVal(e.target.value)} className="input num h-11 flex-1" autoFocus />
          <button type="submit" aria-label="حفظ" className="grid h-11 w-11 place-items-center rounded-xl bg-indigo text-white"><Check size={18} /></button>
          <button type="button" aria-label="إلغاء" onClick={() => setEditing(null)} className="grid h-11 w-11 place-items-center rounded-xl bg-surface2 text-muted"><X size={18} /></button>
          {onDelete && <button type="button" aria-label="حذف البند" onClick={onDelete} className="grid h-11 w-11 place-items-center rounded-xl bg-coral/12 text-coral"><Trash2 size={18} /></button>}
        </form>
      )}
    </li>
  );
}

function NewItem({ group, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [account, setAccount] = useState(group === 'fixed' ? 'salary' : 'applepay');
  const [err, setErr] = useState('');
  return (
    <form className="flex flex-col gap-2 py-2" onSubmit={(e) => {
      e.preventDefault();
      const b = budget === '' ? 0 : parseFloat(budget);
      if (!name.trim()) return setErr('اكتب اسم البند.');
      if (isNaN(b) || b < 0) return setErr('أدخل مخصصاً صحيحاً (صفر أو أكثر).');
      onSave({ id: `c${uid()}`, name: name.trim(), group, budget: round3(b), account, custom: true });
    }}>
      <input id={`n-name-${group}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم البند" aria-label="اسم البند" className="input" autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <input id={`n-b-${group}`} type="number" inputMode="decimal" step="0.001" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="المخصص ر.ع" aria-label="المخصص" className="input num" />
        <select id={`n-a-${group}`} value={account} onChange={(e) => setAccount(e.target.value)} aria-label="البطاقة" className="input">
          {Object.entries(ACCOUNTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {err && <p className="text-sm font-bold text-coral">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" className="h-11 rounded-xl bg-indigo font-bold text-white">إضافة</button>
        <button type="button" onClick={onCancel} className="h-11 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
      </div>
    </form>
  );
}

// ================= البيانات والرسومات =================
function StatsTab({ data }) {
  return (
    <div className="flex flex-col gap-5 fade-in">
      <PageTitle title="البيانات والرسومات" sub={<>إجمالي المصروف الفعلي <b className="num text-ink">{fmt(data.spent)}</b> ر.ع</>} />
      <DonutCard data={data} />
      <CompareCard data={data} />
      <AccountsCard data={data} />
    </div>
  );
}

function DonutCard({ data }) {
  const [sel, setSel] = useState(null);
  const total = data.spent;
  const R = 70, C = 2 * Math.PI * R, GAP = total > 0 && data.groups.filter((g) => g.spent > 0).length > 1 ? 3 : 0;
  let offset = 0;
  const segs = data.groups.map((g) => {
    const len = total > 0 ? (g.spent / total) * C : 0;
    const seg = { g, len, offset };
    offset += len;
    return seg;
  });
  const active = sel ? data.groups.find((g) => g.id === sel) : null;
  return (
    <Card className="p-5">
      <h2 className="text-base font-extrabold">توزيع المصروف الفعلي حسب الفئة</h2>
      <div className="mt-4 flex flex-col items-center gap-5">
        <div className="relative">
          <svg viewBox="0 0 180 180" width="190" height="190" role="img" aria-label="رسم دائري لتوزيع المصروف">
            <circle cx="90" cy="90" r={R} fill="none" stroke="rgb(var(--surface2))" strokeWidth="22" />
            {segs.map(({ g, len, offset: o }) => len > 0 && (
              <circle key={g.id} cx="90" cy="90" r={R} fill="none" stroke={g.color}
                strokeWidth={sel === g.id ? 28 : 22} strokeDasharray={`${Math.max(0.01, len - GAP)} ${C}`} strokeDashoffset={-o}
                transform="rotate(-90 90 90)" style={{ cursor: 'pointer', transition: 'stroke-width .2s, opacity .2s' }}
                opacity={sel && sel !== g.id ? 0.35 : 1} onClick={() => setSel(sel === g.id ? null : g.id)} />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            {total === 0 ? (
              <div><p className="text-xs text-muted">لا يوجد مصروف بعد</p><p className="num text-2xl font-extrabold">0.00</p></div>
            ) : active ? (
              <div><p className="text-xs font-bold" style={{ color: active.color }}>{active.short}</p>
                <p className="num text-3xl font-extrabold">{Math.round((active.spent / total) * 100)}٪</p>
                <p className="num text-xs text-muted">{fmt(active.spent)} ر.ع</p></div>
            ) : (
              <div><p className="text-xs text-muted">الإجمالي</p><p className="num text-2xl font-extrabold">{fmt(total)}</p><p className="text-xs text-muted">ر.ع</p></div>
            )}
          </div>
        </div>
        <ul className="grid w-full grid-cols-2 gap-2">
          {data.groups.map((g) => {
            const p = total > 0 ? Math.round((g.spent / total) * 100) : 0;
            const on = sel === g.id;
            return (
              <li key={g.id}>
                <button onClick={() => setSel(on ? null : g.id)} className={`flex w-full flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-right transition ${on ? 'border-indigo bg-indigo/5' : 'border-line/70 bg-surface2/60'}`}>
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
  const ranked = items.filter((c) => c.spent > 0).sort((a, b) => (b.budget ? b.spent / b.budget : Infinity) - (a.budget ? a.spent / a.budget : Infinity));
  const top = ranked[0];
  return (
    <Card className="p-5">
      <h2 className="text-base font-extrabold">مقارنة المخصص مقابل المصروف الفعلي</h2>
      <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-indigo/25" />المخصص</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-mint" />المصروف</span>
      </div>
      {top && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-amber/12 px-3 py-2 text-[13px] font-bold text-amber">
          <Flame size={16} />الأسرع استنزافاً: {top.name} ({top.budget ? <><span className="num">{Math.round((top.spent / top.budget) * 100)}٪</span> من مخصصه</> : 'بدون مخصص'})
        </p>
      )}
      <ul className="mt-4 flex flex-col gap-4">
        {items.map((c) => {
          const s = status(c.spent, c.budget);
          return (
            <li key={c.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{c.name}</span>
                <span className="num text-xs text-muted"><b className={`text-sm ${TONE[s === 'idle' ? 'idle' : s].text}`}>{fmtShort(c.spent)}</b> / {fmtShort(c.budget)} ر.ع</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="h-2 rounded-full bg-indigo/20" style={{ width: `${(c.budget / scale) * 100}%`, minWidth: c.budget > 0 ? '4px' : 0 }} />
                <div className="h-2 rounded-full bg-surface2">
                  <div className={`h-2 rounded-full ${TONE[s === 'idle' ? 'idle' : s].bar} transition-all duration-500`} style={{ width: `${(c.spent / scale) * 100}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AccountsCard({ data }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-1 text-base font-extrabold">توزيع الصرف حسب البطاقة / الحساب</h2>
      <div className="grid grid-cols-2 gap-3">
        {data.accounts.map((a) => {
          const Icon = ACC_ICONS[a.id];
          const s = status(a.spent, a.limit);
          const left = round3(a.limit - a.spent);
          return (
            <Card key={a.id} className="flex flex-col gap-2.5 p-4">
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${a.id === 'applepay' ? 'bg-navy text-white' : 'bg-indigo/12 text-indigo'}`}><Icon size={16} /></span>
                <span className="min-w-0 truncate text-[13px] font-bold">{a.label}</span>
              </div>
              <p className="num text-xl font-extrabold leading-none">{fmtShort(a.spent)}<span className="ms-1 text-xs font-bold text-muted">/ {fmtShort(a.limit)}</span></p>
              <Bar spent={a.spent} budget={a.limit} />
              <p className={`text-[11px] font-bold ${left < 0 ? 'text-coral' : 'text-muted'}`}>
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
function LogTab({ data, act, notify, onPrint }) {
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState('all');
  const [acc, setAcc] = useState('all');
  const [resetAsk, setResetAsk] = useState(false);

  const list = data.history.filter((t) => {
    const c = data.catMap[t.catId];
    if (grp !== 'all' && c?.group !== grp) return false;
    if (acc !== 'all' && t.account !== acc) return false;
    const s = q.trim();
    if (s && !`${c?.name || ''} ${t.note || ''} ${fmt(t.amount)}`.includes(s)) return false;
    return true;
  });
  const byDay = [];
  for (const t of list) {
    const last = byDay[byDay.length - 1];
    if (last && last.date === t.date) last.items.push(t); else byDay.push({ date: t.date, items: [t] });
  }
  const total = round3(list.reduce((a, t) => a + t.amount, 0));

  return (
    <div className="flex flex-col gap-5 fade-in">
      <PageTitle title="سجل العمليات" sub={<><span className="num">{data.history.length}</span> عملية مسجلة</>}
        action={<button onClick={onPrint} className="flex h-11 items-center gap-1.5 rounded-2xl bg-navy px-4 text-sm font-bold text-white shadow-card"><Printer size={17} />طباعة التقرير</button>} />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
          <input id="log-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في البنود أو الملاحظات" aria-label="بحث" className="input !pr-11" />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="تصفية حسب الفئة">
          {[['all', 'الكل'], ...GROUPS.map((g) => [g.id, g.short])].map(([k, l]) => (
            <button key={k} onClick={() => setGrp(k)} className={`pill ${grp === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="تصفية حسب البطاقة">
          {[['all', 'كل البطاقات'], ...Object.entries(ACCOUNTS)].map(([k, l]) => (
            <button key={k} onClick={() => setAcc(k)} className={`pill text-xs ${acc === k ? 'border-navy bg-navy text-white' : 'pill-off'}`}>{l}</button>
          ))}
        </div>
      </div>

      {list.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-surface2 px-4 py-2.5 text-sm">
          <span className="text-muted">مجموع المعروض (<span className="num">{list.length}</span>)</span>
          <b className="num">-{fmt(total)} ر.ع</b>
        </div>
      )}

      {byDay.map((d) => (
        <section key={d.date} className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-extrabold text-muted">{dayHeading(d.date)}</h3>
          <Card>
            <ul className="divide-y divide-line/70">
              {d.items.map((t) => <TxRow key={t.id} t={t} c={data.catMap[t.catId]} onDelete={() => { act.delTx(t.id); notify('حُذفت العملية وأُعيد المبلغ للبند'); }} />)}
            </ul>
          </Card>
        </section>
      ))}

      {list.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo/12 text-indigo"><ReceiptText size={26} /></span>
          <p className="font-extrabold">{data.history.length ? 'لا توجد نتائج مطابقة' : 'لا توجد عمليات بعد'}</p>
          <p className="text-sm text-muted">{data.history.length ? 'غيّر البحث أو التصفية.' : 'اضغط «تسجيل مصروف» لإضافة أول عملية.'}</p>
        </Card>
      )}

      <div className="mt-2 flex flex-col gap-2">
        <button onClick={onPrint} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-navy text-base font-extrabold text-white shadow-card"><Printer size={20} />طباعة التقرير</button>
        {resetAsk ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-coral/30 bg-coral/5 p-4">
            <p className="text-sm font-bold">سيُحذف كل العمليات وتعود البنود ومخصصاتها للوضع الافتراضي. هل أنت متأكد؟</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { act.reset(); setResetAsk(false); notify('تم مسح كل البيانات'); }} className="h-12 rounded-xl bg-coral font-bold text-white">نعم، امسح الكل</button>
              <button onClick={() => setResetAsk(false)} className="h-12 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setResetAsk(true)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-coral/30 font-bold text-coral"><RotateCcw size={17} />مسح الكل</button>
        )}
      </div>
    </div>
  );
}

function TxRow({ t, c, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!confirm) return; const x = setTimeout(() => setConfirm(false), 3000); return () => clearTimeout(x); }, [confirm]);
  const Icon = ITEM_ICONS[c?.id] || Tag;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface2 text-ink"><Icon size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5"><span className="font-bold">{c?.name || 'بند محذوف'}</span><AccTag id={t.account} /></div>
        {t.note && <p className="truncate text-xs text-muted">{t.note}</p>}
      </div>
      <span className="text-[15px] font-extrabold"><Money v={t.amount} sign="-" /></span>
      {confirm
        ? <button onClick={onDelete} className="h-9 shrink-0 rounded-xl bg-coral px-2.5 text-xs font-bold text-white">تأكيد</button>
        : <button onClick={() => setConfirm(true)} aria-label="حذف العملية" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-coral/10 hover:text-coral"><Trash2 size={17} /></button>}
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

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);

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
    <div className="backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-navy/50 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sheet-title"
        className="sheet-in gutter flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-surface pt-3 shadow-hero"
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
            {GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {cats.filter((c) => c.group === g.id).map((c) => <option key={c.id} value={c.id}>{c.group === 'emergency' && c.id === 'emergency' ? 'بنود غير متوقعة / طارئة' : c.name}</option>)}
              </optgroup>
            ))}
          </select>
          {cat && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <AccTag id={cat.account} />
              <span>المتبقي الآن <b className={`num ${cat.remaining < 0 ? 'text-coral' : 'text-mint'}`}>{fmtShort(cat.remaining)}</b> ر.ع</span>
              {after != null && <span>← بعد الحفظ <b className={`num ${after < 0 ? 'text-coral' : 'text-ink'}`}>{after < 0 ? `عجز ${fmtShort(-after)}` : fmtShort(after)}</b></span>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-date" className="text-sm font-bold text-muted">التاريخ</label>
            <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input num" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-note" className="text-sm font-bold text-muted">ملاحظة <span className="font-normal">(اختياري)</span></label>
            <input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: محطة شل" className="input" maxLength={80} />
          </div>
        </div>

        {err && <p className="text-sm font-bold text-coral" role="alert">{err}</p>}
        <button type="submit" className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-indigo text-lg font-extrabold text-white shadow-fab active:scale-[0.99]">
          <Check size={22} strokeWidth={2.8} />حفظ وخصم المبلغ
        </button>
      </form>
    </div>
  );
}

// ================= التقرير للطباعة =================
function PrintView({ data, onBack }) {
  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  return (
    <div className="min-h-full bg-bg text-ink">
      <div className="no-print gutter mx-auto flex max-w-md flex-col gap-3 pt-4">
        <div className="flex gap-2">
          <button onClick={onBack} className="flex h-12 items-center gap-1.5 rounded-2xl bg-surface2 px-4 font-bold"><ArrowRight size={18} />رجوع</button>
          <button onClick={() => window.print()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-navy font-bold text-white"><Printer size={18} />طباعة التقرير</button>
        </div>
        {framed && (
          <p className="flex items-start gap-2 rounded-2xl bg-indigo/10 p-3 text-xs leading-relaxed text-indigo">
            <Info size={15} className="mt-0.5 shrink-0" />إن لم تظهر نافذة الطباعة هنا، افتح ملف index.html مباشرة في Safari، أو التقط صورة لهذه الصفحة.
          </p>
        )}
      </div>

      <article className="report gutter mx-auto max-w-md py-4">
        <header className="flex items-end justify-between border-b-2 border-navy pb-2">
          <h1 className="text-xl font-extrabold">تقرير مصاريف الراتب</h1>
          <span className="text-xs text-muted">{dateLabel(todayISO())}</span>
        </header>

        <table className="rtable mt-3">
          <tbody>
            <tr><td>الراتب</td><td className="num font-bold">{fmt(SALARY)}</td><td>الموزع</td><td className="num font-bold">{fmt(data.allocated)}</td></tr>
            <tr><td>المصروف الفعلي</td><td className="num font-bold">{fmt(data.spent)}</td><td>المتبقي الفعلي</td><td className={`num font-bold ${data.remaining < 0 ? 'text-coral' : 'text-mint'}`}>{fmt(data.remaining)}</td></tr>
          </tbody>
        </table>

        <h2 className="mt-5 mb-2 text-sm font-bold">البنود</h2>
        <div className="overflow-x-auto">
          <table className="rtable">
            <thead><tr><th>البند</th><th>البطاقة</th><th>المخصص</th><th>المصروف</th><th>المتبقي</th></tr></thead>
            {data.groups.map((g) => (
              <tbody key={g.id}>
                <tr className="group-row"><td colSpan={2}>{g.label}</td><td className="num">{fmtShort(g.budget)}</td><td className="num">{fmtShort(g.spent)}</td><td className="num">{fmtShort(g.remaining)}</td></tr>
                {g.list.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td><td className="whitespace-nowrap text-muted">{ACCOUNTS[c.account]}</td>
                    <td className="num">{fmtShort(c.budget)}</td><td className="num">{fmtShort(c.spent)}</td>
                    <td className={`num font-bold ${c.remaining < 0 ? 'text-coral' : 'text-mint'}`}>{c.remaining < 0 ? `عجز ${fmtShort(-c.remaining)}` : fmtShort(c.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <h2 className="mt-5 mb-2 text-sm font-bold">حسب البطاقة</h2>
        <table className="rtable">
          <thead><tr><th>البطاقة</th><th>الحد المخطط</th><th>المصروف</th><th>المتبقي</th></tr></thead>
          <tbody>
            {data.accounts.map((a) => (
              <tr key={a.id}><td>{a.label}</td><td className="num">{fmtShort(a.limit)}</td><td className="num">{fmtShort(a.spent)}</td><td className={`num font-bold ${a.limit - a.spent < 0 ? 'text-coral' : ''}`}>{fmtShort(round3(a.limit - a.spent))}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-5 mb-2 text-sm font-bold">سجل العمليات (<span className="num">{data.history.length}</span>)</h2>
        <div className="overflow-x-auto">
          <table className="rtable">
            <thead><tr><th>التاريخ</th><th>البند</th><th>البطاقة</th><th>ملاحظة</th><th>المبلغ</th></tr></thead>
            <tbody>
              {data.history.map((t) => (
                <tr key={t.id}><td className="num whitespace-nowrap">{dateLabel(t.date)}</td><td>{data.catMap[t.catId]?.name || 'بند محذوف'}</td><td className="whitespace-nowrap text-muted">{ACCOUNTS[t.account]}</td><td className="text-muted">{t.note}</td><td className="num font-bold">{fmt(t.amount)}</td></tr>
              ))}
              {data.history.length === 0 && <tr><td colSpan={5} className="text-center text-muted">لا توجد عمليات</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-[10px] text-muted">جميع المبالغ بالريال العماني</p>
      </article>
    </div>
  );
}
