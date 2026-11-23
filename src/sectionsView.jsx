// واجهة إدارة الفئات: الإضافة، التسمية، الترتيب، النوع، الحذف الآمن، والألوان
import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Pencil, Trash2, Check, Plus, Palette } from 'lucide-react';
import { Sheet, Field, PrimaryButton } from './ui.jsx';
import { PASTELS, sectionKind, countItems, countPayments, laterMonths, newSectionId } from './sections.js';

const monthName = (l) => l.replace(/^راتب شهر /, '');

// اختيار نطاق التعديل: الشهر الحالي فقط، أو الحالي والأشهر المحفوظة بعده
export function ScopePicker({ store, scope, setScope }) {
  const later = laterMonths(store);
  const active = store.months.find((m) => m.id === store.activeId);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface2 p-3 text-[13px]">
      <p className="font-bold">أين يُطبَّق التعديل؟</p>
      {later.length === 0 ? (
        <p className="text-muted">على <b className="text-ink">{monthName(active.label)}</b>. الأشهر الجديدة تُنشأ من هذا الشهر فترث التعديل تلقائياً. الأشهر السابقة لا تتغير.</p>
      ) : (
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="نطاق التعديل">
          {[
            ['current', `${monthName(active.label)} فقط`, 'والأشهر الجديدة التي تُبدأ منه'],
            ['forward', `${monthName(active.label)} والأشهر اللاحقة (${later.length})`, later.map((m) => monthName(m.label)).join('، ')],
          ].map(([k, t, sub]) => (
            <button key={k} type="button" role="radio" aria-checked={scope === k} onClick={() => setScope(k)}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-right ${scope === k ? 'border-accent bg-surface' : 'border-transparent'}`}>
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${scope === k ? 'border-accent' : 'border-line'}`}>{scope === k && <span className="h-2 w-2 rounded-full bg-accent" />}</span>
              <span><b>{t}</b><span className="block text-[11px] text-muted">{sub}</span></span>
            </button>
          ))}
          <p className="text-[11px] text-muted">الأشهر السابقة لا تتغير أبداً.</p>
        </div>
      )}
    </div>
  );
}

const resultText = (r, done) => {
  if (!r.applied.length) return `لم يُطبَّق: ${r.skipped[0]?.note || 'تعذّر التعديل'}`;
  if (r.skipped.length) return `${done} في ${r.applied.length} أشهر، وتُخطّي ${r.skipped.map((x) => monthName(x.label)).join('، ')} (${r.skipped[0].note})`;
  return done;
};

// تغيير اسم فئة مع اختيار النطاق
export function SectionRenameSheet({ store, section, onOp, notify, onClose }) {
  const [name, setName] = useState(section.name);
  const [scope, setScope] = useState('current');
  const [err, setErr] = useState('');
  return (
    <Sheet title="تغيير اسم الفئة" onClose={onClose}
      onSubmit={() => { if (!name.trim()) return setErr('اكتب اسماً.'); const r = onOp({ type: 'rename', id: section.id, name: name.trim() }, scope); notify(resultText(r, 'تم تغيير الاسم')); onClose(); }}
      footer={<>{err && <p className="text-sm font-bold text-bad">{err}</p>}<PrimaryButton type="submit"><Check size={20} />حفظ الاسم</PrimaryButton></>}>
      <label htmlFor="sec-rename" className="sr-only">الاسم الجديد</label>
      <input id="sec-rename" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} className="input text-lg font-bold" maxLength={40} autoFocus onFocus={(e) => e.target.select()} />
      <ScopePicker store={store} scope={scope} setScope={setScope} />
    </Sheet>
  );
}

// اختيار لون باستيل للفئة
export function ColorSheet({ store, section, onOp, notify, onClose }) {
  const [scope, setScope] = useState('current');
  const [pick, setPick] = useState(section.color || null);
  const apply = () => { const r = onOp({ type: 'recolor', id: section.id, color: pick }, scope); notify(resultText(r, 'تم تغيير اللون')); onClose(); };
  return (
    <Sheet title={`لون «${section.name}»`} onClose={onClose}
      footer={<PrimaryButton type="button" onClick={apply}><Check size={20} />تطبيق</PrimaryButton>}>
      <div className="grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="الألوان">
        {PASTELS.map((p) => (
          <button key={p.key} type="button" role="radio" aria-checked={pick === p.key} onClick={() => setPick(p.key)}
            className={`pastel-${p.key} flex flex-col items-center gap-1 rounded-xl p-1.5 ${pick === p.key ? 'ring-2 ring-accent' : ''}`}>
            <span className="swatch grid h-11 w-full place-items-center rounded-lg">{pick === p.key && <Check size={18} className="text-ink" />}</span>
            <span className="text-[10px] font-bold text-muted">{p.name}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setPick(null)} className={`h-10 rounded-xl border text-sm font-bold ${pick == null ? 'border-accent text-accent' : 'border-line text-muted'}`}>بلا لون (الافتراضي)</button>
      <div className={`${pick ? `pastel-${pick} pastel-card` : ''} rounded-2xl border border-line bg-surface px-4 py-3`}>
        <p className="font-extrabold">{section.name}</p>
        <p className="num text-xs text-muted">معاينة: صُرف 45 من 120 ر.ع</p>
      </div>
      <ScopePicker store={store} scope={scope} setScope={setScope} />
    </Sheet>
  );
}

// إدارة الفئات
export function ManageSectionsSheet({ store, month, onOp, notify, onClose }) {
  const [scope, setScope] = useState('current');
  const [editing, setEditing] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(null); // { id, moveTo }
  const [adding, setAdding] = useState({ name: '', kind: 'flexible' });
  const [err, setErr] = useState('');
  const secs = month.sections;
  const run = (op, done) => { const r = onOp(op, scope); notify(resultText(r, done)); return r; };
  const move = (k, dir) => {
    const order = secs.map((s) => s.id);
    const j = k + dir;
    if (j < 0 || j >= order.length) return;
    [order[k], order[j]] = [order[j], order[k]];
    run({ type: 'reorder', order }, 'تم تغيير الترتيب');
  };

  return (
    <Sheet title="إدارة الفئات" onClose={onClose}>
      <ScopePicker store={store} scope={scope} setScope={setScope} />
      <ul className="flex flex-col gap-2">
        {secs.map((sec, k) => {
          const items = countItems(month, sec.id);
          const pays = countPayments(month, sec.id);
          const kind = sectionKind(sec);
          const isEdit = editing && editing.id === sec.id;
          const isDel = deleting && deleting.id === sec.id;
          return (
            <li key={sec.id} className={`${sec.color ? `pastel-${sec.color} pastel-card` : ''} rounded-2xl border border-line bg-surface p-3`}>
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(k, -1)} disabled={k === 0} aria-label={`رفع ${sec.name}`} className="grid h-7 w-8 place-items-center rounded-md text-muted disabled:opacity-25"><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => move(k, 1)} disabled={k === secs.length - 1} aria-label={`خفض ${sec.name}`} className="grid h-7 w-8 place-items-center rounded-md text-muted disabled:opacity-25"><ArrowDown size={15} /></button>
                </div>
                {isEdit ? (
                  <form className="flex min-w-0 flex-1 gap-1.5" onSubmit={(e) => { e.preventDefault(); if (!editing.name.trim()) return; run({ type: 'rename', id: sec.id, name: editing.name.trim() }, 'تم تغيير الاسم'); setEditing(null); }}>
                    <label htmlFor={`ms-name-${sec.id}`} className="sr-only">اسم الفئة</label>
                    <input id={`ms-name-${sec.id}`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input h-10 font-bold" maxLength={40} autoFocus />
                    <button type="submit" aria-label="حفظ الاسم" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-white"><Check size={17} /></button>
                  </form>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{sec.name}</p>
                    <p className="text-[11px] text-muted"><span className="num">{items}</span> بنود · <span className="num">{pays}</span> عمليات</p>
                  </div>
                )}
                {!isEdit && <button type="button" onClick={() => { setEditing({ id: sec.id, name: sec.name }); setDeleting(null); }} aria-label={`تغيير اسم ${sec.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted"><Pencil size={15} /></button>}
                {!isEdit && <button type="button" onClick={() => { setDeleting({ id: sec.id, moveTo: '' }); setEditing(null); setErr(''); }} aria-label={`حذف ${sec.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-bad"><Trash2 size={15} /></button>}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="text-muted">النوع:</span>
                {[['fixed', 'التزامات ثابتة'], ['flexible', 'مصاريف مرنة']].map(([kk, l]) => (
                  <button key={kk} type="button" onClick={() => kind !== kk && run({ type: 'setKind', id: sec.id, kind: kk }, 'تم تغيير النوع')}
                    aria-pressed={kind === kk} className={`rounded-full border px-2.5 py-1 font-bold ${kind === kk ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted'}`}>{l}</button>
                ))}
              </div>
              {isDel && (
                <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-bad/30 bg-surface p-3 text-[13px]">
                  {items > 0 ? (
                    <>
                      <p><b>هذه الفئة فيها <span className="num">{items}</span> بنود و<span className="num">{pays}</span> عمليات.</b> لن يُحذف أي بند أو عملية: انقل البنود إلى فئة أخرى أولاً، وتبقى كل عملياتها كما هي.</p>
                      <label htmlFor={`ms-move-${sec.id}`} className="font-bold">نقل البنود إلى</label>
                      <select id={`ms-move-${sec.id}`} value={deleting.moveTo} onChange={(e) => { setDeleting({ ...deleting, moveTo: e.target.value }); setErr(''); }} className="input h-11">
                        <option value="" disabled>اختر فئة…</option>
                        {secs.filter((x) => x.id !== sec.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </>
                  ) : <p>الفئة فارغة. سيُحذف اسمها فقط.</p>}
                  {err && <p className="font-bold text-bad">{err}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => {
                      if (items > 0 && !deleting.moveTo) return setErr('اختر الفئة التي تُنقل إليها البنود.');
                      if (secs.length <= 1) return setErr('لا يمكن حذف آخر فئة.');
                      run({ type: 'delete', id: sec.id, moveTo: deleting.moveTo || null }, items > 0 ? 'نُقلت البنود وحُذفت الفئة' : 'حُذفت الفئة');
                      setDeleting(null);
                    }} className="h-11 rounded-xl bg-bad text-sm font-bold text-white">{items > 0 ? 'نقل البنود وحذف الفئة' : 'تأكيد الحذف'}</button>
                    <button type="button" onClick={() => setDeleting(null)} className="h-11 rounded-xl bg-surface2 font-bold text-muted">إلغاء</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-accent/30 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const name = adding.name.trim();
          if (!name) return setErr('اكتب اسم الفئة الجديدة.');
          if (secs.some((x) => x.name === name)) return setErr('يوجد فئة بنفس الاسم.');
          run({ type: 'add', section: { id: newSectionId(), name, kind: adding.kind } }, `أُضيفت فئة ${name}`);
          setAdding({ name: '', kind: 'flexible' }); setErr('');
        }}>
        <Field label="فئة جديدة" htmlFor="ms-new">
          <input id="ms-new" value={adding.name} onChange={(e) => { setAdding({ ...adding, name: e.target.value }); setErr(''); }} className="input" placeholder="مثال: الأطفال والمدرسة" maxLength={40} />
        </Field>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted">النوع:</span>
          {[['fixed', 'التزامات ثابتة'], ['flexible', 'مصاريف مرنة']].map(([kk, l]) => (
            <button key={kk} type="button" onClick={() => setAdding({ ...adding, kind: kk })} aria-pressed={adding.kind === kk}
              className={`rounded-full border px-2.5 py-1 font-bold ${adding.kind === kk ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted'}`}>{l}</button>
          ))}
        </div>
        {err && !deleting && <p className="text-sm font-bold text-bad">{err}</p>}
        <button type="submit" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent font-bold text-white"><Plus size={17} />إضافة الفئة</button>
      </form>
      <p className="text-xs leading-relaxed text-muted">النوع يحدد طريقة التحليل: الالتزامات الثابتة لا يُقترح تخفيضها، والمصاريف المرنة تُحلَّل لاقتراح التوفير. المعرّفات الداخلية للفئات لا تتغير، فتبقى البنود والعمليات مرتبطة بها.</p>
    </Sheet>
  );
}

export { Palette };
