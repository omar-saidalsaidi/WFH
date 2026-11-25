// «إدارة الراتب والدخل» (صفحة الأدوات): الراتب الأساسي والدخل الإضافي للشهر المالي المفتوح.
// منطق الحساب نفسه في finance.js؛ هنا الإدخال والتعديل فقط.
import React, { useEffect, useState } from 'react';
import { Check, Pencil, Trash2, Repeat, Plus } from 'lucide-react';
import { Field, PrimaryButton, Card } from './ui.jsx';
import { fmt, fmtShort, dateLabel, todayISO, uid } from './data.js';
import { sumOMR, toBaisa } from './finance.js';
import { SalaryCard } from './salaryCard.jsx';
import { ColorPicker } from './colorView.jsx';

const SUGGESTED = ['مكافأة', 'بدل سفر', 'عمل إضافي', 'عائد استثمار', 'دخل جانبي', 'مبلغ مسترد', 'مبلغ آخر'];
const monthName = (l) => (l || '').replace(/^راتب شهر /, '');

export function SalaryIncomeManager({ month, store, act, notify }) {
  const [picker, setPicker] = useState(false);
  const list = [...(month.incomes || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const extra = sumOMR(list, (i) => i.amount);
  const total = (toBaisa(month.salary) + toBaisa(extra)) / 1000;
  return (
    <>
      <p className="-mt-2 text-sm text-muted">للشهر المالي المفتوح: <b className="text-ink">{monthName(month.label)}</b>. لكل شهر راتبه ودخله المستقل؛ لتعديل شهر آخر افتحه من اسم الشهر أعلى الصفحة.</p>
      <SalaryCard salary={month.salary} extra={extra} total={total} count={list.length} color={store.settings.cardColors.salary} onColor={() => setPicker(true)} />
      {picker && (
        <ColorPicker store={store} notify={notify} onClose={() => setPicker(false)}
          target={{ kind: 'summary', id: 'salary', name: 'بطاقة الراتب الأساسي', color: store.settings.cardColors.salary }}
          onApply={(color) => { act.setSettings({ cardColors: { ...store.settings.cardColors, salary: color } }); notify(color ? 'تم تطبيق اللون على كل الأشهر' : 'استُعيد اللون الافتراضي'); }} />
      )}
      <SalaryEditor key={`${month.id}-${month.salary}`} month={month} act={act} notify={notify} />
      <IncomeManager key={month.id} month={month} list={list} total={extra} act={act} notify={notify} />
    </>
  );
}

function SalaryEditor({ month, act, notify }) {
  const [v, setV] = useState(String(month.salary));
  const [err, setErr] = useState('');
  const save = (e) => {
    e.preventDefault();
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) return setErr('أدخل مبلغاً أكبر من صفر.');
    act.setSalary(toBaisa(n) / 1000); setErr('');
    notify(`الراتب الأساسي لـ ${monthName(month.label)}: ${fmtShort(n)} ر.ع`);
  };
  return (
    <Card className="p-4">
      <form noValidate onSubmit={save} className="flex flex-col gap-2">
        <label htmlFor="salary-input" className="text-sm font-extrabold">الراتب الأساسي</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input id="salary-input" type="number" inputMode="decimal" step="0.001" min="0" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }}
              className="input num h-12 pe-4 ps-12 text-xl font-extrabold" />
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">ر.ع</span>
          </div>
          <button type="submit" className="h-12 shrink-0 rounded-2xl bg-accent px-5 font-bold text-white">حفظ الراتب</button>
        </div>
        {err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}
        <p className="text-xs text-muted">العلاوات والمكافآت تُسجَّل في الدخل الإضافي أدناه، ولا تغيّر الراتب الأساسي.</p>
      </form>
    </Card>
  );
}

function IncomeManager({ month, list, total, act, notify }) {
  const defDate = todayISO().slice(0, 7) === month.period ? todayISO() : `${month.period}-01`;
  const empty = { id: null, name: '', amount: '', date: defDate, note: '', recurring: false };
  const [f, setF] = useState(empty);
  const [del, setDel] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setF(empty); setDel(null); setErr(''); }, [month.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setErr(''); };

  const save = (e) => {
    e.preventDefault();
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
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold">الدخل الإضافي</p>
        <p className="text-sm">الإجمالي <b className="num">{fmt(total)}</b> ر.ع</p>
      </div>
      {list.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
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
      ) : <p className="rounded-xl bg-surface2 px-3 py-2.5 text-sm text-muted">لا يوجد دخل إضافي لهذا الشهر.</p>}

      <form noValidate onSubmit={save} className="flex flex-col gap-3 border-t border-line pt-3">
        <p className="text-sm font-extrabold">{f.id ? 'تعديل الدخل' : 'إضافة دخل'}</p>
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
        {err && <p className="text-sm font-bold text-bad" role="alert">{err}</p>}
        <PrimaryButton type="submit">{f.id ? <><Check size={20} />حفظ التعديل</> : <><Plus size={20} />إضافة الدخل</>}</PrimaryButton>
        {f.id && <button type="button" onClick={() => setF(empty)} className="h-10 text-sm font-bold text-muted">إلغاء التعديل</button>}
      </form>
    </Card>
  );
}
