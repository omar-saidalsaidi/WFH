// واجهة إدارة الفئات: الإضافة، التسمية، الترتيب، النوع، الحذف الآمن، والألوان
import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Pencil, Trash2, Check, Plus, Palette, Archive, ArchiveRestore, ChevronDown } from 'lucide-react';
import { Sheet, Field, PrimaryButton } from './ui.jsx';
import { resolveColor } from './colors.js';
import { KINDS, KIND_ORDER } from './insights.js';
import { sectionKind, countItems, countArchivedItems, countPayments, itemPayments, laterMonths, newSectionId } from './sections.js';

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

// إدارة الفئات
export function ManageSectionsSheet({ store, month, onOp, notify, onClose }) {
  const [scope, setScope] = useState('current');
  const [editing, setEditing] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(null); // { id, moveTo }
  const [adding, setAdding] = useState({ name: '', kind: 'flexible' });
  const [err, setErr] = useState('');
  const [openItems, setOpenItems] = useState(null);
  const secs = month.sections.filter((x) => !x.archived);
  const archivedSecs = month.sections.filter((x) => x.archived);
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
            <li key={sec.id} className="rounded-2xl border border-line bg-surface p-3" style={resolveColor(sec.color) ? { borderInlineStartWidth: 6, borderInlineStartColor: resolveColor(sec.color) } : undefined}>
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
                <label htmlFor={`ms-kind-${sec.id}`} className="text-muted">التصنيف:</label>
                <select id={`ms-kind-${sec.id}`} value={kind} onChange={(e) => run({ type: 'setKind', id: sec.id, kind: e.target.value }, 'تم تغيير التصنيف')} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-bold">
                  {KIND_ORDER.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
                </select>
                {!sec.kind && <span className="rounded-full bg-warn/12 px-2 py-0.5 font-bold text-warn">تلقائي</span>}
              </div>
              <button type="button" onClick={() => setOpenItems(openItems === sec.id ? null : sec.id)} aria-expanded={openItems === sec.id}
                className="mt-2 flex h-9 w-full items-center justify-between rounded-xl bg-surface/70 px-3 text-xs font-bold text-accent">
                إدارة بنود الفئة ({items}{countArchivedItems(month, sec.id) ? ` + ${countArchivedItems(month, sec.id)} مؤرشف` : ''})
                <ChevronDown size={15} className={openItems === sec.id ? 'rotate-180' : ''} />
              </button>
              {openItems === sec.id && <ItemsManager month={month} sectionId={sec.id} run={run} />}
              {isDel && (
                <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-bad/30 bg-surface p-3 text-[13px]">
                  {items > 0 ? (
                    <>
                      <p><b>هذه الفئة فيها <span className="num">{items}</span> بنود و<span className="num">{pays}</span> عمليات.</b> لن يُحذف أي بند أو عملية: انقل البنود إلى فئة أخرى، أو أرشف الفئة لإخفائها مع بقاء عملياتها محسوبة.</p>
                      <button type="button" onClick={() => { run({ type: 'archiveSection', id: sec.id, archived: true }, 'أُرشفت الفئة، وعملياتها باقية'); setDeleting(null); }}
                        className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-bold text-ink"><Archive size={15} />أرشفة الفئة بدلاً من الحذف</button>
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

      {archivedSecs.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-surface2 p-3 text-[13px]">
          <p className="font-bold">فئات مؤرشفة</p>
          {archivedSecs.map((sec) => (
            <div key={sec.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{sec.name} <span className="text-[11px] text-muted">(<span className="num">{countPayments(month, sec.id)}</span> عمليات محفوظة)</span></span>
              <button type="button" onClick={() => run({ type: 'archiveSection', id: sec.id, archived: false }, 'أُعيدت الفئة')} className="flex h-9 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-bold text-accent"><ArchiveRestore size={14} />استعادة</button>
            </div>
          ))}
        </div>
      )}

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
          <label htmlFor="ms-new-kind" className="text-muted">التصنيف:</label>
          <select id="ms-new-kind" value={adding.kind} onChange={(e) => setAdding({ ...adding, kind: e.target.value })} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-bold">
            {KIND_ORDER.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
          </select>
        </div>
        {err && !deleting && <p className="text-sm font-bold text-bad">{err}</p>}
        <button type="submit" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent font-bold text-white"><Plus size={17} />إضافة الفئة</button>
      </form>
      <p className="text-xs leading-relaxed text-muted">التصنيف يحدد طريقة التحليل: الالتزامات الثابتة والادخار لا يُقترح تخفيضها، والأساسية تُخفَّض بلطف عند التجاوز فقط، والمرنة والاختيارية تُحلَّل لاقتراح التوفير. يمكن تغيير تصنيف أي بند منفرداً من نافذة تعديله. المعرّفات الداخلية للفئات لا تتغير، فتبقى البنود والعمليات مرتبطة بها.</p>
    </Sheet>
  );
}

// بنود فئة واحدة: تسمية، ترتيب، أرشفة/استعادة، حذف آمن، إضافة سريعة
function ItemsManager({ month, sectionId, run }) {
  const all = month.categories.filter((c) => c.group === sectionId);
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [add, setAdd] = useState({ name: '', budget: '' });
  const [err, setErr] = useState('');
  const move = (k, dir) => {
    const order = active.map((c) => c.id);
    const j = k + dir;
    if (j < 0 || j >= order.length) return;
    [order[k], order[j]] = [order[j], order[k]];
    run({ type: 'reorderItems', group: sectionId, order: [...order, ...archived.map((c) => c.id)] }, 'تم ترتيب البنود');
  };
  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-xl bg-surface p-2">
      {active.length === 0 && <p className="px-1 py-2 text-xs text-muted">لا توجد بنود نشطة في هذه الفئة.</p>}
      {active.map((c, k) => {
        const pays = itemPayments(month, c.id);
        return (
          <div key={c.id} className="flex flex-col gap-1 rounded-lg border border-line px-2 py-1.5">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(k, -1)} disabled={k === 0} aria-label={`رفع بند ${c.name}`} className="grid h-8 w-7 place-items-center text-muted disabled:opacity-25"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(k, 1)} disabled={k === active.length - 1} aria-label={`خفض بند ${c.name}`} className="grid h-8 w-7 place-items-center text-muted disabled:opacity-25"><ArrowDown size={14} /></button>
              {edit && edit.id === c.id ? (
                <form className="flex min-w-0 flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); if (!edit.name.trim()) return; run({ type: 'updateItem', id: c.id, patch: { name: edit.name.trim() } }, 'تم تغيير اسم البند'); setEdit(null); }}>
                  <label htmlFor={`it-name-${c.id}`} className="sr-only">اسم البند</label>
                  <input id={`it-name-${c.id}`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="input h-9 text-sm font-bold" maxLength={40} autoFocus />
                  <button type="submit" aria-label="حفظ اسم البند" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-white"><Check size={15} /></button>
                </form>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{c.name} <span className="text-[10px] font-normal text-muted">(<span className="num">{pays}</span> عمليات)</span></span>
              )}
              {!(edit && edit.id === c.id) && <button type="button" onClick={() => { setEdit({ id: c.id, name: c.name }); setDel(null); }} aria-label={`تغيير اسم بند ${c.name}`} className="grid h-8 w-8 place-items-center text-muted"><Pencil size={13} /></button>}
              <button type="button" onClick={() => { setDel(del === c.id ? null : c.id); setEdit(null); }} aria-label={`حذف بند ${c.name}`} className="grid h-8 w-8 place-items-center text-bad"><Trash2 size={13} /></button>
            </div>
            {del === c.id && (
              <div className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-muted">{pays > 0 ? `له ${pays} عمليات، فسيُؤرشف وتبقى عملياته محسوبة.` : 'لا عمليات عليه، سيُحذف.'}</span>
                <button type="button" onClick={() => { run({ type: 'deleteItem', id: c.id }, pays > 0 ? 'أُرشف البند' : 'حُذف البند'); setDel(null); }} className="h-8 rounded-lg bg-bad px-2.5 font-bold text-white">{pays > 0 ? 'تأكيد الأرشفة' : 'تأكيد الحذف'}</button>
              </div>
            )}
          </div>
        );
      })}
      {archived.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t border-line pt-1.5">
          <p className="text-[11px] font-bold text-muted">مؤرشف (مدفوعاته محسوبة، ولا يُحجز له مخصص)</p>
          {archived.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <button type="button" onClick={() => run({ type: 'archiveItem', id: c.id, archived: false }, 'أُعيد البند')} className="flex h-8 items-center gap-1 rounded-lg border border-line px-2 font-bold text-accent"><ArchiveRestore size={13} />استعادة</button>
            </div>
          ))}
        </div>
      )}
      <form className="mt-1 flex gap-1.5" onSubmit={(e) => {
        e.preventDefault();
        const b = add.budget === '' ? 0 : parseFloat(add.budget);
        if (!add.name.trim()) return setErr('اكتب اسم البند.');
        if (isNaN(b) || b < 0) return setErr('المخصص غير صحيح.');
        run({ type: 'addItem', item: { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: add.name.trim(), group: sectionId, budget: Math.round(b * 1000) / 1000, account: 'applepay', custom: true } }, `أُضيف بند ${add.name.trim()}`);
        setAdd({ name: '', budget: '' }); setErr('');
      }}>
        <label htmlFor={`add-it-${sectionId}`} className="sr-only">اسم البند الجديد</label>
        <input id={`add-it-${sectionId}`} value={add.name} onChange={(e) => { setAdd({ ...add, name: e.target.value }); setErr(''); }} className="input h-9 text-sm" placeholder="بند جديد" maxLength={40} />
        <input aria-label="مخصص البند الجديد" type="number" inputMode="decimal" step="0.001" min="0" value={add.budget} onChange={(e) => setAdd({ ...add, budget: e.target.value })} className="input num h-9 w-20 text-sm" placeholder="ر.ع" />
        <button type="submit" aria-label="إضافة البند" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-white"><Plus size={16} /></button>
      </form>
      {err && <p className="text-xs font-bold text-bad">{err}</p>}
    </div>
  );
}

export { Palette };
