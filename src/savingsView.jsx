// «إدارة الادخار» (صفحة الأدوات): بنود الادخار للشهر المفتوح — نفس الحسابات الحالية دون أي منطق جديد.
// الادخار يبقى بنداً عادياً في فئته (يُسجَّل عليه الدفع كالمعتاد ويدخل في المصروف الفعلي والتقارير).
import React, { useMemo, useState } from 'react';
import { Check, Pencil, Palette, PiggyBank } from 'lucide-react';
import { Card, RemainChip, RemainBar, useIsDark } from './ui.jsx';
import { fmtShort, todayISO } from './data.js';
import { monthSummary, isSavingItem, remainingInfo, sumOMR, toBaisa } from './finance.js';
import { surfaceFor } from './colors.js';
import { ColorPicker } from './colorView.jsx';
import { ForecastCard } from './features.jsx';

const monthName = (l) => (l || '').replace(/^راتب شهر /, '');

export function SavingsManager({ month, store, act, notify }) {
  const dark = useIsDark();
  const s = useMemo(() => monthSummary(month, todayISO()), [month]);
  const items = s.items.filter((i) => isSavingItem(i) && !i.archived);
  const planned = sumOMR(items, (i) => i.planned);
  const paid = sumOMR(items, (i) => i.paid);
  const rem = remainingInfo(planned, paid);
  const [edit, setEdit] = useState(null);
  const [color, setColor] = useState(null);
  return (
    <>
      <p className="-mt-2 text-sm text-muted">للشهر المالي المفتوح: <b className="text-ink">{monthName(month.label)}</b>. بنود الادخار تبقى في فئاتها، ويُسجَّل عليها التحويل كأي مصروف.</p>
      <Card className="savings-card flex flex-col gap-3 p-4" aria-label="بطاقة الادخار">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-good/10 text-good"><PiggyBank size={20} /></span>
          <p className="flex-1 font-extrabold">الادخار هذا الشهر</p>
          {items.length > 0 && <RemainChip rem={rem} dark={dark} />}
        </div>
        {items.length > 0 && <RemainBar rem={rem} />}
        <dl className="num grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-xl bg-surface2 py-2"><dt className="text-muted">الادخار المخصص</dt><dd className="text-base font-extrabold">{fmtShort(planned)}</dd></div>
          <div className="rounded-xl bg-good/10 py-2"><dt className="text-muted">الادخار الفعلي</dt><dd className="text-base font-extrabold text-good">{fmtShort(paid)}</dd></div>
          <div className="rounded-xl bg-surface2 py-2"><dt className="text-muted">المتبقي</dt><dd className={`text-base font-extrabold ${rem.remaining < 0 ? 'text-bad' : ''}`} dir="ltr">{fmtShort(rem.remaining)}</dd></div>
        </dl>
        {items.length === 0 && <p className="rounded-xl bg-surface2 px-3 py-2.5 text-sm text-muted">لا يوجد بند ادخار في هذا الشهر. فعّل «بند ادخار» من نافذة تعديل أي بند في الصفحة الرئيسية.</p>}
      </Card>

      {items.map((i) => {
        const surf = surfaceFor(i.color, dark);
        return (
          <Card key={i.id} className="flex flex-col gap-2.5 p-4" style={surf ? { background: surf.bg, borderColor: surf.edge, color: surf.ink, ...surf.vars } : undefined}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold text-ink">{i.name}</p>
                <p className="text-[11px] text-muted">{(month.sections.find((x) => x.id === i.group) || {}).name || ''}</p>
              </div>
              <RemainChip rem={i.rem} dark={dark} />
              <div className="flex flex-col">
                <button type="button" onClick={() => setEdit(edit && edit.id === i.id ? null : { id: i.id, v: String(i.budget) })} aria-label={`تعديل مخصص ${i.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted"><Pencil size={14} /></button>
                <button type="button" onClick={() => setColor(i)} aria-label={`لون بند ${i.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted"><Palette size={13} /></button>
              </div>
            </div>
            <RemainBar rem={i.rem} />
            <dl className="num grid grid-cols-3 gap-1 text-[11px]">
              <div><dt className="text-muted">المبلغ المخصص</dt><dd className="font-extrabold text-ink">{fmtShort(i.planned)}</dd></div>
              <div><dt className="text-muted">المبلغ المدّخر</dt><dd className="font-extrabold text-ink">{fmtShort(i.paid)}</dd></div>
              <div><dt className="text-muted">المبلغ المتبقي</dt><dd className={`font-extrabold ${i.rem.remaining < 0 ? 'text-bad' : 'text-ink'}`} dir="ltr" style={{ textAlign: 'right' }}>{fmtShort(i.rem.remaining)}</dd></div>
            </dl>
            {edit && edit.id === i.id && (
              <form noValidate className="flex items-center gap-2" onSubmit={(e) => {
                e.preventDefault();
                const n = parseFloat(edit.v);
                if (isNaN(n) || n < 0) return;
                act.sectionOp({ type: 'updateItem', id: i.id, patch: { budget: toBaisa(n) / 1000 } }, 'current');
                setEdit(null); notify(`مخصص ${i.name}: ${fmtShort(n)} ر.ع`);
              }}>
                <label htmlFor={`sv-${i.id}`} className="whitespace-nowrap text-xs font-bold text-muted">المخصص</label>
                <input id={`sv-${i.id}`} type="number" inputMode="decimal" step="0.001" min="0" value={edit.v} onChange={(e) => setEdit({ ...edit, v: e.target.value })} className="input num h-10 flex-1" autoFocus />
                <button type="submit" aria-label="حفظ المخصص" className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white"><Check size={17} /></button>
              </form>
            )}
          </Card>
        );
      })}
      {color && (
        <ColorPicker store={store} notify={notify} onClose={() => setColor(null)} onOp={act.sectionOp}
          target={{ kind: 'item', id: color.id, name: color.name, color: color.color, accent: color.accent }} />
      )}

      <p className="mt-1 text-sm font-extrabold">ما يُتوقع أن يتبقى نهاية الشهر</p>
      <ForecastCard s={s} />
    </>
  );
}
