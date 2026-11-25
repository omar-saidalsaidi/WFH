// الدخل الإضافي للشهر النشط: إضافة وتعديل وحذف، مستقل عن الراتب الأساسي
import React, { useState } from 'react';
import { Check, Pencil, Trash2, Repeat, Plus } from 'lucide-react';
import { Sheet, Field, PrimaryButton, Card } from './ui.jsx';
import { fmt, fmtShort, dateLabel, todayISO, uid } from './data.js';
import { sumOMR, toBaisa } from './finance.js';

const SUGGESTED = ['مكافأة', 'بدل سفر', 'عمل إضافي', 'عائد استثمار', 'دخل جانبي', 'مبلغ مسترد', 'مبلغ آخر'];

export function IncomeSheet({ month, act, notify, onClose }) {
  const list = [...(month.incomes || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = sumOMR(list, (i) => i.amount);
  const defDate = todayISO().slice(0, 7) === month.period ? todayISO() : `${month.period}-01`;
  const empty = { id: null, name: '', amount: '', date: defDate, note: '', recurring: false };
  const [f, setF] = useState(empty);
  const [del, setDel] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setErr(''); };

  const save = () => {
    const amount = parseFloat(f.amount);
    if (!f.name.trim()) return setErr('اكتب اسماً للدخل، مثل «مكافأة».');
    if (isNaN(amount) || amount <= 0) return setErr('أدخل مبلغاً أكبر من صفر.');
    if (!f.date || f.date.slice(0, 7) !== month.period) return setErr(`اختر تاريخاً ضمن هذا الشهر (${month.period}).`);
    const entry = { id: f.id || `inc${uid()}`, name: f.name.trim(), amount: toBaisa(amount) / 1000, date: f.date, note: f.note.trim(), recurring: !!f.recurring };
    act.saveIncome(entry);
    notify(f.id ? 'تم تعديل الدخل' : `أُضيف ${fmtShort(entry.amount)} ر.ع: ${entry.name}`);
    setF(empty);
  };

  return (
    <Sheet title="الدخل الإضافي" onClose={onClose} onSubmit={save}
      footer={<>
        {err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}
        <PrimaryButton type="submit">{f.id ? <><Check size={20} />حفظ التعديل</> : <><Plus size={20} />إضافة الدخل</>}</PrimaryButton>
        {f.id && <button type="button" onClick={() => setF(empty)} className="h-10 text-sm font-bold text-muted">إلغاء التعديل</button>}
      </>}>
      <div className="flex items-center justify-between rounded-2xl border border-hpb bg-hp1 px-4 py-3 text-hpink">
        <span className="text-sm font-bold">إجمالي الدخل الإضافي لهذا الشهر</span>
        <span className="num text-xl font-extrabold">{fmt(total)} <span className="text-xs">ر.ع</span></span>
      </div>
      <p className="-mt-1 text-xs text-muted">الراتب الأساسي ({fmtShort(month.salary)}) لا يتغير. الدخل الإضافي خاص بهذا الشهر، ولا يُنسخ للشهر الجديد إلا ما تحدده «متكرراً».</p>

      {list.length > 0 && (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((i) => (
              <li key={i.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-bold"><span className="truncate">{i.name}</span>{i.recurring && <Repeat size={13} className="shrink-0 text-accent" aria-label="متكرر" />}</p>
                  <p className="truncate text-[11px] text-muted">{dateLabel(i.date)}{i.note ? ` · ${i.note}` : ''}</p>
                </div>
                <span className="num font-extrabold text-good" dir="ltr">+{fmt(i.amount)}</span>
                {del === i.id ? (
                  <button type="button" onClick={() => { act.deleteIncome(i.id); setDel(null); notify('حُذف الدخل'); if (f.id === i.id) setF(empty); }} className="h-9 rounded-lg bg-bad px-2.5 text-xs font-bold text-white">تأكيد الحذف</button>
                ) : (
                  <>
                    <button type="button" onClick={() => setF({ ...i, amount: String(i.amount), note: i.note || '' })} aria-label={`تعديل ${i.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted"><Pencil size={15} /></button>
                    <button type="button" onClick={() => setDel(i.id)} aria-label={`حذف ${i.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-bad"><Trash2 size={15} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-sm font-extrabold">{f.id ? 'تعديل الدخل' : 'دخل جديد'}</p>
      <Field label="الاسم" htmlFor="inc-name">
        <input id="inc-name" value={f.name} onChange={set('name')} className="input" placeholder="مثال: مكافأة" maxLength={40} />
      </Field>
      <div className="no-scrollbar -mx-4 -mt-1 flex shrink-0 gap-1.5 overflow-x-auto px-4 py-0.5" aria-label="أسماء مقترحة">
        {SUGGESTED.map((n) => <button key={n} type="button" onClick={() => setF({ ...f, name: n })} className={`pill text-xs ${f.name === n ? 'pill-on' : 'pill-off'}`}>{n}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ (ر.ع)" htmlFor="inc-amount">
          <input id="inc-amount" type="number" inputMode="decimal" step="0.001" min="0" value={f.amount} onChange={set('amount')} className="input num text-lg font-bold" placeholder="0.000" />
        </Field>
        <Field label="تاريخ الاستلام" htmlFor="inc-date">
          <input id="inc-date" type="date" value={f.date} min={`${month.period}-01`} max={`${month.period}-31`} onChange={set('date')} className="input num" />
        </Field>
      </div>
      <Field label="ملاحظة (اختياري)" htmlFor="inc-note">
        <input id="inc-note" value={f.note} onChange={set('note')} className="input" maxLength={80} />
      </Field>
      <label htmlFor="inc-rec" className="flex items-start gap-2 rounded-xl border border-line px-3 py-2.5 text-[13px]">
        <input id="inc-rec" type="checkbox" checked={!!f.recurring} onChange={set('recurring')} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" />
        <span><b>دخل متكرر</b><span className="block text-xs text-muted">يُنسخ تلقائياً عند بدء شهر جديد. غير المتكرر يبقى لهذا الشهر فقط.</span></span>
      </label>
    </Sheet>
  );
}
