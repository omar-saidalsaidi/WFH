import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Pencil, Check, X, Trash2, Printer, RotateCcw, ArrowRight, CircleCheck, Info } from 'lucide-react';
import { ACCOUNTS, GROUPS, SALARY, STORAGE_KEY, dateLabel, defaultState, fmt, round3, todayISO, uid } from './data.js';

// ---------- التخزين ----------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Array.isArray(s.categories) && Array.isArray(s.transactions)) return s;
  } catch (e) { /* التخزين غير متاح */ }
  return defaultState();
}

function Money({ v, className = '' }) {
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {fmt(v)}<span className="ms-1 text-[0.65em] font-medium opacity-70">ر.ع</span>
    </span>
  );
}

function DeficitBadge({ v }) {
  return <span className="num whitespace-nowrap rounded-full bg-bad px-2.5 py-1 text-xs font-bold text-white">عجز: {fmt(v)} ر.ع</span>;
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState('main');
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* تجاهل */ }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const data = useMemo(() => {
    const spentBy = {};
    for (const t of state.transactions) spentBy[t.catId] = (spentBy[t.catId] || 0) + t.amount;
    const cats = state.categories.map((c) => {
      const spent = round3(spentBy[c.id] || 0);
      return { ...c, spent, remaining: round3(c.budget - spent) };
    });
    const groups = GROUPS.map((g) => {
      const list = cats.filter((c) => c.group === g.id);
      const budget = round3(list.reduce((a, c) => a + c.budget, 0));
      const spent = round3(list.reduce((a, c) => a + c.spent, 0));
      return { ...g, list, budget, spent, remaining: round3(budget - spent) };
    });
    const spent = round3(state.transactions.reduce((a, t) => a + t.amount, 0));
    const allocated = round3(state.categories.reduce((a, c) => a + c.budget, 0));
    const catMap = Object.fromEntries(state.categories.map((c) => [c.id, c]));
    const history = [...state.transactions].sort((a, b) => (a.date === b.date ? b.created - a.created : a.date < b.date ? 1 : -1));
    return { cats, groups, spent, allocated, remaining: round3(SALARY - spent), catMap, history };
  }, [state]);

  const act = {
    addTx: (tx) => setState((s) => ({ ...s, transactions: [...s.transactions, { ...tx, id: uid(), created: Date.now() }] })),
    delTx: (id) => setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
    setBudget: (id, budget) => setState((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, budget } : c)) })),
    addCat: (c) => setState((s) => ({ ...s, categories: [...s.categories, c] })),
    delCat: (id) => setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id), transactions: s.transactions.filter((t) => t.catId !== id) })),
    reset: () => setState(defaultState()),
  };

  if (view === 'print') return <PrintView data={data} onBack={() => setView('main')} />;

  return (
    <div className="min-h-full bg-bg text-ink">
      <header className="sticky z-30 border-b border-line/60 bg-bg/90 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex max-w-md items-center gap-2 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-hero1 to-hero2 text-white"><Wallet size={19} /></div>
          <h1 className="flex-1 font-display text-lg font-bold">تتبع مصاريف الراتب</h1>
          <button onClick={() => setView('print')} className="flex h-10 items-center gap-1.5 rounded-xl bg-surface px-3 text-sm font-bold text-accent shadow-sm border border-line">
            <Printer size={17} />طباعة التقرير
          </button>
        </div>
      </header>

      <main className="gutter mx-auto flex max-w-md flex-col gap-5 pt-4 pb-32">
        <Summary data={data} />
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold">تتبع البنود والمتبقي</h2>
          {data.groups.map((g) => (
            <GroupCard key={g.id} g={g} act={act} notify={setToast} />
          ))}
        </section>
        <History data={data} onDelete={(id) => { act.delTx(id); setToast('تم حذف العملية وإرجاع المبلغ للبند'); }} />
        <ResetBox onReset={() => { act.reset(); setToast('تم مسح كل البيانات'); }} />
      </main>

      {/* زر التسجيل الثابت */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-bg via-bg/95 to-bg/0 pt-6" style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="gutter mx-auto max-w-md">
          <button onClick={() => setFormOpen(true)} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-hero1 to-hero2 font-display text-xl font-bold text-white shadow-lg active:scale-[0.99]">
            <Plus size={26} strokeWidth={2.6} />تسجيل مصروف
          </button>
        </div>
      </div>

      {formOpen && (
        <EntrySheet cats={data.cats} onClose={() => setFormOpen(false)}
          onSave={(tx, name) => { act.addTx(tx); setFormOpen(false); setToast(`سُجّل ${fmt(tx.amount)} ر.ع على ${name}`); }} />
      )}

      {toast && (
        <div className="fixed inset-x-0 z-50 flex justify-center px-4 toast-in" style={{ bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }} role="status">
          <div className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-bg shadow-xl"><CircleCheck size={18} />{toast}</div>
        </div>
      )}
    </div>
  );
}

// ---------- الملخص العلوي ----------
function Summary({ data }) {
  const over = round3(data.spent - SALARY);
  const items = [
    ['الراتب', SALARY],
    ['الموزع', data.allocated],
    ['المصروف الفعلي', data.spent],
    ['المتبقي الفعلي من الراتب', data.remaining],
  ];
  return (
    <section className="rounded-3xl bg-gradient-to-br from-hero1 to-hero2 p-4 text-white shadow-lg">
      <dl className="grid grid-cols-2 gap-2.5">
        {items.map(([k, v], i) => (
          <div key={k} className={`rounded-2xl px-3 py-3 ${i === 3 ? 'bg-white text-hero1' : 'bg-white/12'}`}>
            <dt className={`text-xs font-semibold ${i === 3 ? 'text-hero1/80' : 'text-white/75'}`}>{k}</dt>
            <dd className={`mt-1 font-display text-2xl font-bold ${i === 3 && v < 0 ? 'text-bad' : ''}`}><Money v={v} /></dd>
          </div>
        ))}
      </dl>
      {over > 0 && (
        <p className="mt-3 rounded-2xl bg-bad px-3 py-2.5 text-center text-sm font-bold">عجز: المصروف تجاوز الراتب بـ <span className="num">{fmt(over)}</span> ر.ع</p>
      )}
    </section>
  );
}

// ---------- مجموعة البنود ----------
function GroupCard({ g, act, notify }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const deficit = g.spent > g.budget ? round3(g.spent - g.budget) : 0;
  return (
    <div className="rounded-3xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h3 className="flex-1 font-display text-[15px] font-bold">{g.label} <span className="num text-muted">({fmt(g.budget)} ر.ع)</span></h3>
        {deficit > 0 && <DeficitBadge v={deficit} />}
      </div>
      <ul className="divide-y divide-line">
        {g.list.map((c) => (
          <CatRow key={c.id} c={c} editing={editing === c.id} setEditing={setEditing}
            onSave={(v) => { act.setBudget(c.id, v); setEditing(null); notify(`تم تعديل مخصص ${c.name}`); }}
            onDelete={c.custom ? () => { act.delCat(c.id); setEditing(null); notify(`تم حذف ${c.name}`); } : null} />
        ))}
      </ul>
      <div className="px-4 pb-3 pt-1">
        {adding
          ? <NewItem group={g.id} onCancel={() => setAdding(false)} onSave={(c) => { act.addCat(c); setAdding(false); notify(`أُضيف بند ${c.name}`); }} />
          : <button onClick={() => setAdding(true)} className="flex h-10 items-center gap-1.5 text-sm font-bold text-accent"><Plus size={17} />إضافة بند</button>}
      </div>
    </div>
  );
}

function CatRow({ c, editing, setEditing, onSave, onDelete }) {
  const [val, setVal] = useState(String(c.budget));
  useEffect(() => { if (editing) setVal(String(c.budget)); }, [editing, c.budget]);
  const deficit = c.spent > c.budget ? round3(c.spent - c.budget) : 0;
  const pct = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : c.spent > 0 ? 100 : 0;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{c.name}</span>
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">{ACCOUNTS[c.account]}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            المخصص <b className="num text-ink">{fmt(c.budget)}</b> · المصروف <b className="num text-ink">{fmt(c.spent)}</b>
          </p>
        </div>
        <div className="shrink-0 text-left">
          {deficit > 0 ? <DeficitBadge v={deficit} /> : (
            <span className={`block rounded-xl px-2.5 py-1 text-sm font-bold ${c.remaining > 0 ? 'bg-good/10 text-good' : 'bg-accent/10 text-accent'}`}>
              المتبقي <span className="num">{fmt(c.remaining)}</span>
            </span>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(c.id)} aria-label={`تعديل مخصص ${c.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface2"><Pencil size={16} /></button>
        )}
      </div>
      {(c.budget > 0 || c.spent > 0) && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
          <div className={`h-1.5 rounded-full ${deficit > 0 ? 'bg-bad' : 'bg-ocean'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {editing && (
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(val); if (!isNaN(v) && v >= 0) onSave(round3(v)); }}>
          <label htmlFor={`b-${c.id}`} className="whitespace-nowrap text-xs font-semibold text-muted">المخصص</label>
          <input id={`b-${c.id}`} type="number" inputMode="decimal" step="0.001" min="0" value={val} onChange={(e) => setVal(e.target.value)} className="input num h-11 flex-1" autoFocus />
          <button type="submit" aria-label="حفظ" className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white"><Check size={18} /></button>
          <button type="button" aria-label="إلغاء" onClick={() => setEditing(null)} className="grid h-11 w-11 place-items-center rounded-xl bg-surface2 text-muted"><X size={18} /></button>
          {onDelete && <button type="button" aria-label="حذف البند" onClick={onDelete} className="grid h-11 w-11 place-items-center rounded-xl bg-bad/10 text-bad"><Trash2 size={18} /></button>}
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
    <form className="flex flex-col gap-2 rounded-2xl bg-surface2 p-3" onSubmit={(e) => {
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
      {err && <p className="text-sm font-semibold text-bad">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" className="h-11 rounded-xl bg-accent font-bold text-white">إضافة</button>
        <button type="button" onClick={onCancel} className="h-11 rounded-xl bg-surface font-bold text-muted">إلغاء</button>
      </div>
    </form>
  );
}

// ---------- نموذج التسجيل ----------
function EntrySheet({ cats, onSave, onClose }) {
  const [catId, setCatId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const cat = cats.find((c) => c.id === catId);

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const a = parseFloat(amount);
    if (!cat) return setErr('اختر البند.');
    if (isNaN(a) || a <= 0) return setErr('أدخل مبلغاً أكبر من صفر.');
    if (!date) return setErr('اختر التاريخ.');
    onSave({ catId: cat.id, amount: round3(a), date, note: note.trim() }, cat.name);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sheet-title"
        className="sheet-in gutter flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface pt-4 shadow-2xl"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between">
          <h2 id="sheet-title" className="font-display text-lg font-bold">إدخال عملية سداد سريعة</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-muted"><X size={20} /></button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-cat" className="text-sm font-bold">البند</label>
          <select id="f-cat" value={catId} onChange={(e) => { setCatId(e.target.value); setErr(''); }} className="input">
            <option value="" disabled>اختر البند…</option>
            {GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {cats.filter((c) => c.group === g.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
          {cat && (
            <p className="text-xs text-muted">
              يُدفع من {ACCOUNTS[cat.account]} · المتبقي في البند <b className={`num ${cat.remaining < 0 ? 'text-bad' : 'text-good'}`}>{fmt(cat.remaining)}</b> ر.ع
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-amount" className="text-sm font-bold">المبلغ (ر.ع)</label>
          <input id="f-amount" type="number" inputMode="decimal" step="0.001" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(''); }}
            placeholder="0.000" className="input num h-14 font-display text-2xl font-bold" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-date" className="text-sm font-bold">التاريخ</label>
          <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input num" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-note" className="text-sm font-bold">ملاحظة <span className="font-normal text-muted">(اختياري)</span></label>
          <input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: محطة شل" className="input" maxLength={80} />
        </div>

        {err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}
        <button type="submit" className="h-14 rounded-2xl bg-gradient-to-l from-hero1 to-hero2 font-display text-lg font-bold text-white shadow-lg">حفظ وخصم المبلغ</button>
      </form>
    </div>
  );
}

// ---------- السجل ----------
function History({ data, onDelete }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold">سجل العمليات</h2>
      {data.history.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
          لم تُسجَّل أي عملية بعد. اضغط «تسجيل مصروف» لإضافة أول عملية.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-3xl border border-line bg-surface px-4 shadow-sm">
          {data.history.map((t) => <TxRow key={t.id} t={t} name={data.catMap[t.catId]?.name || 'بند محذوف'} onDelete={onDelete} />)}
        </ul>
      )}
    </section>
  );
}

function TxRow({ t, name, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!confirm) return; const x = setTimeout(() => setConfirm(false), 3000); return () => clearTimeout(x); }, [confirm]);
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        <p className="truncate text-xs text-muted">{dateLabel(t.date)}{t.note ? ` · ${t.note}` : ''}</p>
      </div>
      <span className="font-display font-bold"><Money v={t.amount} /></span>
      {confirm
        ? <button onClick={() => onDelete(t.id)} className="h-10 shrink-0 rounded-xl bg-bad px-3 text-xs font-bold text-white">تأكيد الحذف</button>
        : <button onClick={() => setConfirm(true)} aria-label="حذف العملية" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-bad/10 hover:text-bad"><Trash2 size={18} /></button>}
    </li>
  );
}

function ResetBox({ onReset }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <div className="flex flex-col gap-2 rounded-3xl border border-bad/30 bg-bad/5 p-4">
      <p className="text-sm font-semibold">سيُحذف كل العمليات وتعود البنود ومخصصاتها للوضع الافتراضي. هل أنت متأكد؟</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => { onReset(); setAsk(false); }} className="h-12 rounded-2xl bg-bad font-bold text-white">نعم، امسح الكل</button>
        <button onClick={() => setAsk(false)} className="h-12 rounded-2xl bg-surface2 font-bold text-muted">إلغاء</button>
      </div>
    </div>
  ) : (
    <button onClick={() => setAsk(true)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-bad/30 font-bold text-bad">
      <RotateCcw size={17} />مسح الكل
    </button>
  );
}

// ---------- التقرير للطباعة ----------
function PrintView({ data, onBack }) {
  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  return (
    <div className="min-h-full bg-bg text-ink">
      <div className="no-print gutter mx-auto flex max-w-md flex-col gap-3 pt-4">
        <div className="flex gap-2">
          <button onClick={onBack} className="flex h-12 items-center gap-1.5 rounded-2xl bg-surface2 px-4 font-bold"><ArrowRight size={18} />رجوع</button>
          <button onClick={() => window.print()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-hero1 to-hero2 font-bold text-white"><Printer size={18} />طباعة التقرير</button>
        </div>
        {framed && (
          <p className="flex items-start gap-2 rounded-2xl bg-ocean/10 p-3 text-xs leading-relaxed text-ocean">
            <Info size={15} className="mt-0.5 shrink-0" />إن لم تظهر نافذة الطباعة هنا، افتح ملف index.html مباشرة في المتصفح، أو التقط صورة لهذه الصفحة.
          </p>
        )}
      </div>

      <article className="report gutter mx-auto max-w-md py-4 print:max-w-none print:p-0">
        <header className="flex items-end justify-between border-b-2 border-hero1 pb-2">
          <h1 className="font-display text-xl font-bold">تقرير مصاريف الراتب</h1>
          <span className="text-xs text-muted">{dateLabel(todayISO())}</span>
        </header>

        <table className="rtable mt-3">
          <tbody>
            <tr><td>الراتب</td><td className="num font-bold">{fmt(SALARY)}</td><td>الموزع</td><td className="num font-bold">{fmt(data.allocated)}</td></tr>
            <tr><td>المصروف الفعلي</td><td className="num font-bold">{fmt(data.spent)}</td><td>المتبقي الفعلي</td><td className={`num font-bold ${data.remaining < 0 ? 'text-bad' : ''}`}>{fmt(data.remaining)}</td></tr>
          </tbody>
        </table>

        <h2 className="mt-5 mb-2 text-sm font-bold">البنود</h2>
        <div className="overflow-x-auto">
          <table className="rtable">
            <thead><tr><th>البند</th><th>البطاقة</th><th>المخصص</th><th>المصروف</th><th>المتبقي</th></tr></thead>
            {data.groups.map((g) => (
              <tbody key={g.id}>
                <tr className="group-row"><td colSpan={2}>{g.label}</td><td className="num">{fmt(g.budget)}</td><td className="num">{fmt(g.spent)}</td><td className="num">{fmt(g.remaining)}</td></tr>
                {g.list.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td><td className="text-muted whitespace-nowrap">{ACCOUNTS[c.account]}</td>
                    <td className="num">{fmt(c.budget)}</td><td className="num">{fmt(c.spent)}</td>
                    <td className={`num font-bold ${c.remaining < 0 ? 'text-bad' : 'text-good'}`}>{c.remaining < 0 ? `عجز ${fmt(-c.remaining)}` : fmt(c.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <h2 className="mt-5 mb-2 text-sm font-bold">سجل العمليات (<span className="num">{data.history.length}</span>)</h2>
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
  );
}
