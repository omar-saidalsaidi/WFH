// منتقي الألوان: 36 لوناً + HEX مخصص، معاينة مباشرة، استعادة الافتراضي، ونطاق التطبيق
import React, { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Sheet, PrimaryButton, RemainChip, RemainBar, useIsDark } from './ui.jsx';
import { PALETTE, resolveColor, normalizeHex, surfaceFor, accentFor, contrast } from './colors.js';
import { remainingInfo } from './finance.js';
import { ScopePicker } from './sectionsView.jsx';

// target: { kind: 'section' | 'item', id, name, color, accent }
export function ColorPicker({ store, target, onOp, notify, onClose }) {
  const dark = useIsDark();
  const [part, setPart] = useState('color'); // color = خلفية البطاقة، accent = لون التمييز
  const [vals, setVals] = useState({ color: resolveColor(target.color), accent: resolveColor(target.accent) });
  const [hex, setHex] = useState(resolveColor(target[part]) || '');
  const [scope, setScope] = useState('current');
  const cur = vals[part];
  const pick = (v) => { setVals({ ...vals, [part]: v }); setHex(v || ''); };
  const surf = surfaceFor(vals.color, dark);
  const acc = accentFor(vals.accent, dark);
  const sample = remainingInfo(80, 20);

  const apply = () => {
    const changed = { color: vals.color !== resolveColor(target.color), accent: vals.accent !== resolveColor(target.accent) };
    if (!changed.color && !changed.accent) { onClose(); return; }
    const op = target.kind === 'section'
      ? { type: 'recolor', id: target.id, ...(changed.color ? { color: vals.color } : {}), ...(changed.accent ? { accent: vals.accent } : {}) }
      : { type: 'updateItem', id: target.id, patch: { ...(changed.color ? { color: vals.color } : {}), ...(changed.accent ? { accent: vals.accent } : {}) } };
    const r = onOp(op, scope);
    notify(r.applied.length ? 'تم تطبيق اللون' : 'لم يُطبَّق اللون');
    onClose();
  };
  const hexOk = normalizeHex(hex);

  return (
    <Sheet title={`ألوان «${target.name}»`} onClose={onClose}
      footer={<PrimaryButton type="button" onClick={apply}><Check size={20} />تطبيق</PrimaryButton>}>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1" role="tablist" aria-label="جزء البطاقة">
        {[['color', target.kind === 'section' ? 'خلفية الفئة' : 'خلفية البند'], ['accent', 'لون التمييز']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={part === k} onClick={() => { setPart(k); setHex(vals[k] || ''); }}
            className={`h-9 rounded-lg text-[13px] font-bold ${part === k ? 'bg-surface text-accent shadow-sm' : 'text-muted'}`}>{l}</button>
        ))}
      </div>

      {/* معاينة مباشرة */}
      <div className="rounded-2xl border p-3" style={surf ? { background: surf.bg, borderColor: surf.edge, color: surf.ink, ...surf.vars } : undefined} aria-label="معاينة">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-good/10 text-sm font-extrabold text-good" style={acc ? { background: acc.bg, color: acc.ink } : undefined}>أ</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold text-ink">{target.name}</p>
            <p className="num text-[11px] text-muted">المخصص 80 · المصروف 20</p>
          </div>
          <RemainChip rem={sample} dark={dark} />
        </div>
        <div className="mt-2"><RemainBar rem={sample} /></div>
      </div>
      {surf && <p className="-mt-2 text-[11px] text-muted">النص يتكيف تلقائياً (تباين {surf.ratio.toFixed(1)}:1). ألوان التحذير المالية تبقى على شارة محايدة.</p>}

      {PALETTE.map((g) => (
        <div key={g.group} className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-muted">{g.group}</p>
          <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={g.group}>
            {g.colors.map(([name, h]) => (
              <button key={h} type="button" role="radio" aria-checked={cur === h} aria-label={name} title={name} onClick={() => pick(h)}
                className={`grid aspect-square place-items-center rounded-lg border border-black/10 ${cur === h ? 'ring-2 ring-accent ring-offset-2 ring-offset-[rgb(var(--surface))]' : ''}`}
                style={{ background: h }}>
                {cur === h && <Check size={15} style={{ color: contrast(h, '#FFFFFF') > contrast(h, '#1E293B') ? '#FFFFFF' : '#1E293B' }} />}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="hex-input" className="text-xs font-bold text-muted">لون مخصص (HEX)</label>
        <div className="flex gap-2">
          <input type="color" aria-label="منتقي اللون" value={hexOk || '#EDE4FF'} onChange={(e) => pick(normalizeHex(e.target.value))} className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-line bg-surface p-1" />
          <input id="hex-input" value={hex} onChange={(e) => { setHex(e.target.value); const v = normalizeHex(e.target.value); if (v) setVals({ ...vals, [part]: v }); }}
            className="input num" dir="ltr" placeholder="#EDE4FF" maxLength={7} />
        </div>
        {hex && !hexOk && <p className="text-xs font-bold text-bad">صيغة غير صحيحة. مثال: #EDE4FF</p>}
      </div>

      <button type="button" onClick={() => pick(null)} className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-sm font-bold ${cur == null ? 'border-accent text-accent' : 'border-line text-muted'}`}>
        <RotateCcw size={15} />استعادة اللون الافتراضي
      </button>
      <ScopePicker store={store} scope={scope} setScope={setScope} />
      <p className="text-[11px] text-muted">الألوان تُنقل تلقائياً إلى الأشهر الجديدة.</p>
    </Sheet>
  );
}
