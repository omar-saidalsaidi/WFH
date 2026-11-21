import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet, Plus, Pencil, Check, X, Trash2, Printer, RotateCcw, CircleCheck, Search, Share2, FileText,
  House, ChartPie, ReceiptText, TriangleAlert, Landmark, Smartphone, CreditCard, Users, Building2, HandCoins,
  PiggyBank, Wifi, Zap, Droplets, Fuel, Utensils, ShoppingCart, Popcorn, Wrench, WashingMachine, Scissors,
  Stethoscope, Siren, Tag, Flame, ChevronDown, Copy,
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
  good: { bar: 'bg-good', text: 'text-good', soft: 'bg-good/10 text-good' },
  done: { bar: 'bg-good', text: 'text-good', soft: 'bg-good/10 text-good' },
  warn: { bar: 'bg-warn', text: 'text-warn', soft: 'bg-warn/12 text-warn' },
  bad: { bar: 'bg-bad', text: 'text-bad', soft: 'bg-bad/10 text-bad' },
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
function loadOpen() {
  try { const o = JSON.parse(localStorage.getItem(`${STORAGE_KEY}-open`)); if (o && typeof o === 'object') return o; } catch (e) { /* تجاهل */ }
  return { fixed: false, daily: true, temp: false, emergency: false };
}

// ---------- عناصر صغيرة ----------
function Money({ v, className = '', sign = '' }) {
  return (
    <span className={`num whitespace-nowrap ${className}`} dir="ltr">
      <span className="me-1 text-[0.6em] font-bold opacity-60">ر.ع</span>{sign}{fmt(v)}
    </span>
  );
}
function DeficitBadge({ v }) {
  return <span className="num inline-flex whitespace-nowrap rounded-full bg-bad/10 px-2 py-0.5 text-xs font-extrabold text-bad ring-1 ring-bad/25">عجز: {fmtShort(v)} ر.ع</span>;
}
function AccTag({ id }) {
  const Icon = ACC_ICONS[id] || CreditCard;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-muted">
      <Icon size={10} aria-hidden="true" />{ACCOUNTS[id]}
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
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
}

// ---------- نص التقرير للمشاركة ----------
function reportText(data) {
  const L = [];
  L.push(`تقرير مصاريف الراتب — ${dateLabel(todayISO())}`);
  L.push('');
  L.push(`الراتب: ${fmt(SALARY)} ر.ع`);
  L.push(`الموزع: ${fmt(data.allocated)} ر.ع`);
  L.push(`المصروف الفعلي: ${fmt(data.spent)} ر.ع`);
  L.push(`المتبقي الفعلي: ${fmt(data.remaining)} ر.ع`);
  if (data.spent > SALARY) L.push(`⚠️ عجز: تجاوز المصروف الراتب بـ ${fmtShort(data.spent - SALARY)} ر.ع`);
  for (const g of data.groups) {
    L.push('');
    L.push(`▪️ ${g.label} (${fmtShort(g.budget)} ر.ع)`);
    for (const c of g.list) {
      const tail = c.remaining < 0 ? `🔴 عجز ${fmtShort(-c.remaining)}` : `متبقي ${fmtShort(c.remaining)}`;
      L.push(`- ${c.name}: صُرف ${fmtShort(c.spent)} من ${fmtShort(c.budget)} · ${tail}`);
    }
  }
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
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('st4-tab') || 'home'; } catch (e) { return 'home'; } });
  const [report, setReport] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* تجاهل */ } }, [state]);
  useEffect(() => { try { sessionStorage.setItem('st4-tab', tab); } catch (e) { /* تجاهل */ } window.scrollTo(0, 0); }, [tab]);
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
      const deficit = round3(list.reduce((a, c) => a + Math.max(0, c.spent - c.budget), 0));
      return { ...g, list, budget, spent, deficit, remaining: round3(budget - spent) };
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

  return (
    <div className="app-shell min-h-full bg-bg text-ink">
      <header className="sticky z-30 border-b border-line bg-bg/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex max-w-md items-center gap-2.5 py-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-hero text-white"><Wallet size={18} /></div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-extrabold">تتبع مصاريف الراتب</p>
            <p className="text-[11px] text-muted">المتبقي <span className="num font-bold text-ink">{fmt(data.remaining)}</span> ر.ع</p>
          </div>
          <button onClick={() => setReport(true)} className="flex h-10 shrink-0 items-center gap-1 rounded-xl border border-accent/30 bg-accent/10 px-2.5 text-[12px] font-bold text-accent">
            <FileText size={15} />تصدير / طباعة التقرير
          </button>
        </div>
      </header>

      <main className="gutter mx-auto flex max-w-md flex-col gap-5 pt-4 pb-28">
        {tab === 'home' && <HomeTab data={data} act={act} notify={setToast} openSheet={openSheet} />}
        {tab === 'stats' && <StatsTab data={data} />}
        {tab === 'log' && <LogTab data={data} act={act} notify={setToast} onReport={() => setReport(true)} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} onAdd={() => openSheet()} />

      {sheet && (
        <EntrySheet cats={data.cats} initial={sheet.catId} onClose={() => setSheet(null)}
          onSave={(tx, name) => { act.addTx(tx); setSheet(null); setToast(`سُجّل ${fmtShort(tx.amount)} ر.ع على ${name}`); }} />
      )}

      {report && <ReportModal data={data} onClose={() => setReport(false)} notify={setToast} />}

      {toast && (
        <div className="no-print fixed inset-x-0 z-[60] flex justify-center px-4 toast-in" style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }} role="status">
          <div className="flex items-center gap-2 rounded-2xl bg-hero px-4 py-3 text-sm font-bold text-white shadow-lg"><CircleCheck size={18} className="text-good" />{toast}</div>
        </div>
      )}
    </div>
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
      <div className="gutter mx-auto grid max-w-md grid-cols-[1fr_1fr_auto_1fr] items-center gap-1 py-2">
        <Tab id="home" label="الرئيسية" icon={House} />
        <Tab id="stats" label="الرسومات" icon={ChartPie} />
        <button onClick={onAdd} className="flex h-12 items-center gap-1.5 rounded-2xl bg-accent px-4 text-[15px] font-extrabold text-white active:scale-95 transition">
          <Plus size={20} strokeWidth={2.8} />تسجيل مصروف
        </button>
        <Tab id="log" label="السجل" icon={ReceiptText} />
      </div>
    </nav>
  );
}

// ================= الرئيسية والبنود =================
function HomeTab({ data, act, notify, openSheet }) {
  const [open, setOpen] = useState(loadOpen);
  useEffect(() => { try { localStorage.setItem(`${STORAGE_KEY}-open`, JSON.stringify(open)); } catch (e) { /* تجاهل */ } }, [open]);
  const over = round3(data.spent - SALARY);
  const pct = Math.min(100, (data.spent / SALARY) * 100);
  return (
    <div className="flex flex-col gap-4 fade-in">
      <section className="rounded-3xl bg-gradient-to-bl from-hero to-hero2 p-5 text-white">
        {over > 0 && (
          <div className="mb-3 flex w-fit items-center gap-2 rounded-full bg-bad px-3 py-1.5 text-sm font-extrabold">
            <TriangleAlert size={16} />عجز: تجاوزت الراتب بـ <span className="num">{fmtShort(over)}</span> ر.ع
          </div>
        )}
        <p className="text-[13px] text-white/70">المتبقي الفعلي من الراتب</p>
        <p className="mt-1 text-[40px] font-extrabold leading-none"><Money v={data.remaining} /></p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className={`h-1.5 rounded-full transition-all duration-700 ${over > 0 ? 'bg-bad' : 'bg-white/85'}`} style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 text-center">
          {[['الراتب', SALARY], ['الموزع', data.allocated], ['المصروف الفعلي', data.spent]].map(([k, v], i) => (
            <div key={k} className={i ? 'border-r border-white/15' : ''}>
              <dt className="text-[11px] text-white/65">{k}</dt>
              <dd className="num mt-0.5 text-lg font-extrabold">{fmtShort(v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {data.groups.map((g) => (
        <GroupBlock key={g.id} g={g} open={!!open[g.id]} toggle={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))} act={act} notify={notify} openSheet={openSheet} />
      ))}
      <p className="text-center text-xs text-muted">اضغط على أي بند لتسجيل مصروف عليه مباشرة.</p>
    </div>
  );
}

function GroupBlock({ g, open, toggle, act, notify, openSheet }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2.5 px-4 py-3 text-right">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">{g.label}</span>
          <span className="block text-[11px] text-muted">
            <span className="num">{g.list.length}</span> بنود · صُرف <span className="num">{fmtShort(g.spent)}</span> من <span className="num">{fmtShort(g.budget)}</span> ر.ع
          </span>
        </span>
        {g.deficit > 0 ? <DeficitBadge v={g.deficit} /> : <span className={`num text-sm font-extrabold ${g.budget ? 'text-good' : 'text-muted'}`}>{fmtShort(g.remaining)}</span>}
        <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <ul className="divide-y divide-line border-t border-line">
            {g.list.map((c) => (
              <ItemRow key={c.id} c={c} editing={editing === c.id} setEditing={setEditing} onOpen={() => openSheet(c.id)}
                onSave={(v) => { act.setBudget(c.id, v); setEditing(null); notify(`تم تعديل مخصص ${c.name}`); }}
                onDelete={c.custom ? () => { act.delCat(c.id); setEditing(null); notify(`تم حذف ${c.name}`); } : null} />
            ))}
          </ul>
          <div className="border-t border-line px-4 py-1.5">
            {adding
              ? <NewItem group={g.id} onCancel={() => setAdding(false)} onSave={(c) => { act.addCat(c); setAdding(false); notify(`أُضيف بند ${c.name}`); }} />
              : <button onClick={() => setAdding(true)} className="flex h-10 items-center gap-1.5 text-sm font-bold text-accent"><Plus size={16} />إضافة بند</button>}
          </div>
        </>
      )}
    </Card>
  );
}

function ItemRow({ c, editing, setEditing, onOpen, onSave, onDelete }) {
  const [val, setVal] = useState(String(c.budget));
  useEffect(() => { if (editing) setVal(String(c.budget)); }, [editing, c.budget]);
  const Icon = ITEM_ICONS[c.id] || Tag;
  const deficit = c.spent > c.budget ? round3(c.spent - c.budget) : 0;
  return (
    <li>
      <div role="button" tabIndex={0} aria-label={`تسجيل مصروف على ${c.name}`}
        onClick={() => !editing && onOpen()} onKeyDown={(e) => { if (!editing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition active:bg-surface2">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE[c.s].soft}`}><Icon size={17} /></div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{c.name}</span>
          <div className="mt-1 flex items-center gap-2">
            <AccTag id={c.account} />
            <div className="min-w-0 flex-1"><Bar spent={c.spent} budget={c.budget} h="h-1" /></div>
          </div>
        </div>
        <div className="w-[88px] shrink-0 text-left leading-tight">
          {deficit > 0 ? <DeficitBadge v={deficit} /> : c.s === 'done' ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-good"><Check size={13} strokeWidth={3} />مدفوع</span>
          ) : (
            <>
              <span className={`num block text-[15px] font-extrabold ${c.s === 'warn' ? 'text-warn' : c.s === 'idle' ? 'text-muted' : 'text-good'}`}>{fmtShort(c.remaining)}</span>
              <span className="num block text-[10px] text-muted">متبقي من {fmtShort(c.budget)}</span>
            </>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setEditing(editing ? null : c.id); }} aria-label={`تعديل مخصص ${c.name}`}
          className="-me-2 grid h-9 w-8 shrink-0 place-items-center rounded-lg text-muted/70 hover:bg-surface2"><Pencil size={14} /></button>
      </div>
      {editing && (
        <form className="flex items-center gap-2 bg-surface2/60 px-4 py-2.5" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(val); if (!isNaN(v) && v >= 0) onSave(round3(v)); }}>
          <label htmlFor={`b-${c.id}`} className="whitespace-nowrap text-xs font-bold text-muted">المخصص</label>
          <input id={`b-${c.id}`} type="number" inputMode="decimal" step="0.001" min="0" value={val} onChange={(e) => setVal(e.target.value)} className="input num h-10 flex-1 bg-surface" autoFocus />
          <button type="submit" aria-label="حفظ" className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white"><Check size={17} /></button>
          <button type="button" aria-label="إلغاء" onClick={() => setEditing(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-muted border border-line"><X size={17} /></button>
          {onDelete && <button type="button" aria-label="حذف البند" onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-xl bg-bad/10 text-bad"><Trash2 size={17} /></button>}
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
      {err && <p className="text-sm font-bold text-bad">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" className="h-11 rounded-xl bg-accent font-bold text-white">إضافة</button>
        <button type="button" onClick={onCancel} className="h-11 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
      </div>
    </form>
  );
}

// ================= البيانات والرسومات =================
function StatsTab({ data }) {
  return (
    <div className="flex flex-col gap-4 fade-in">
      <div>
        <h1 className="text-2xl font-extrabold">البيانات والرسومات</h1>
        <p className="text-sm text-muted">إجمالي المصروف الفعلي <b className="num text-ink">{fmt(data.spent)}</b> ر.ع</p>
      </div>
      <DonutCard data={data} />
      <CompareCard data={data} />
      <AccountsCard data={data} />
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
          {[['all', 'الكل'], ...GROUPS.map((g) => [g.id, g.short])].map(([k, l]) => (
            <button key={k} onClick={() => setGrp(k)} className={`pill ${grp === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="تصفية حسب البطاقة">
          {[['all', 'كل البطاقات'], ...Object.entries(ACCOUNTS)].map(([k, l]) => (
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
          <p className="text-sm font-bold">سيُحذف كل العمليات وتعود البنود ومخصصاتها للوضع الافتراضي. هل أنت متأكد؟</p>
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
            {GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {cats.filter((c) => c.group === g.id).map((c) => <option key={c.id} value={c.id}>{c.id === 'emergency' ? 'بنود غير متوقعة / طارئة' : c.name}</option>)}
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

function useModal(onClose) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
}

// ================= نافذة التقرير: طباعة ومشاركة =================
function ReportModal({ data, onClose, notify }) {
  useModal(onClose);
  const [fallback, setFallback] = useState('');
  const text = useMemo(() => reportText(data), [data]);

  const doPrint = () => {
    try { window.print(); } catch (e) { /* بعض العارضات تمنع الطباعة */ }
  };
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
            <h2 className="text-lg font-extrabold">تصدير / طباعة التقرير</h2>
            <button onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-muted"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={doPrint} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-extrabold text-white"><Printer size={18} />طباعة / حفظ كـ PDF</button>
            <button onClick={doShare} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 text-sm font-extrabold text-accent"><Share2 size={18} />نسخ / مشاركة نصياً</button>
          </div>
          {fallback && (
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted"><Copy size={13} />حدّد النص وانسخه يدوياً:</p>
              <textarea id="report-text" readOnly value={fallback} rows={6} className="input h-auto py-2 text-xs leading-relaxed" onFocus={(e) => e.target.select()} autoFocus />
            </div>
          )}
        </div>

        <article className="gutter flex-1 overflow-y-auto py-4" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
          <header className="flex items-end justify-between border-b-2 border-hero pb-2">
            <h1 id="report-title" className="text-xl font-extrabold">تقرير مصاريف الراتب</h1>
            <span className="text-xs text-muted">{dateLabel(todayISO())}</span>
          </header>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[['الراتب', SALARY], ['الموزع', data.allocated], ['المصروف الفعلي', data.spent], ['المتبقي الفعلي', data.remaining]].map(([k, v], i) => (
              <div key={k} className={`rounded-xl border border-line px-3 py-2 ${i === 3 ? 'bg-good/5' : ''}`}>
                <p className="text-[11px] text-muted">{k}</p>
                <p className={`num text-lg font-extrabold ${i === 3 && v < 0 ? 'text-bad' : ''}`}>{fmt(v)} <span className="text-[10px] text-muted">ر.ع</span></p>
              </div>
            ))}
          </div>
          {data.spent > SALARY && <p className="mt-2 rounded-xl bg-bad/10 px-3 py-2 text-sm font-bold text-bad">عجز: تجاوز المصروف الراتب بـ <span className="num">{fmtShort(data.spent - SALARY)}</span> ر.ع</p>}

          <h2 className="mt-5 mb-2 text-sm font-extrabold">البنود والعجز</h2>
          <div className="overflow-x-auto">
            <table className="rtable">
              <thead><tr><th>البند</th><th>البطاقة</th><th>المخصص</th><th>المصروف</th><th>المتبقي</th></tr></thead>
              {data.groups.map((g) => (
                <tbody key={g.id}>
                  <tr className="group-row"><td colSpan={2}>{g.label}</td><td className="num">{fmtShort(g.budget)}</td><td className="num">{fmtShort(g.spent)}</td><td className={`num ${g.deficit > 0 ? 'text-bad' : ''}`}>{g.deficit > 0 ? `عجز ${fmtShort(g.deficit)}` : fmtShort(g.remaining)}</td></tr>
                  {g.list.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td><td className="whitespace-nowrap text-muted">{ACCOUNTS[c.account]}</td>
                      <td className="num">{fmtShort(c.budget)}</td><td className="num">{fmtShort(c.spent)}</td>
                      <td className={`num whitespace-nowrap font-bold ${c.remaining < 0 ? 'text-bad' : 'text-good'}`}>{c.remaining < 0 ? `عجز ${fmtShort(-c.remaining)}` : fmtShort(c.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
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
          <p className="mt-4 text-center text-[10px] text-muted">جميع المبالغ بالريال العماني</p>
        </article>
      </div>
    </div>
  );
}
