// عناصر الواجهة المشتركة
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Landmark, Smartphone, CreditCard, Users, Building2, HandCoins, PiggyBank, Wifi, Zap, Droplets, Fuel, Utensils,
  ShoppingCart, Popcorn, Wrench, WashingMachine, Scissors, Stethoscope, Siren,
} from 'lucide-react';
import { fmt, fmtShort } from './data.js';
import { themeVars } from './colors.js';
import { pctLabel } from './finance.js';
import { itemStatus } from './finance.js';

export const ITEM_ICONS = {
  jamiya: Users, rent: Building2, debt: HandCoins, saving: PiggyBank, net: Wifi, elec: Zap, water: Droplets,
  fuel: Fuel, food: Utensils, ration: ShoppingCart, fun: Popcorn, oil: Wrench, laundry: WashingMachine,
  tailor: Scissors, laser: Stethoscope, emergency: Siren,
};
export const ACC_ICONS = { salary: Landmark, applepay: Smartphone, card1: CreditCard, card2: CreditCard };

// ---------- أسماء الفئات والبطاقات (من الحالة) ----------
export const SECTION_COLORS = { fixed: 'var(--c-sky)', daily: 'var(--c-accent)', temp: 'var(--c-warn)', emergency: 'var(--c-bad)' };
export const CARD_COLORS = { salary: 'var(--c-sky)', applepay: 'var(--c-accent)', card1: 'var(--c-warn)', card2: 'rgb(var(--muted))' };
export const MetaContext = createContext({ sections: [], cards: [], cardName: (id) => id, sectionName: (id) => id });
export const useMeta = () => useContext(MetaContext);
// النوافذ تُعرض مباشرة داخل body حتى لا تحبسها حركات الصفحة تحت الشريطين العلوي والسفلي
export const Portal = ({ children }) => createPortal(children, document.body);

// ---------- الحالة اللونية ----------
// الحالة اللونية موحّدة مع الحسابات: تنبيه عند 80٪، تجاوز فوق 100٪
export const status = itemStatus;
export const TONE = {
  good: { bar: 'bg-good', text: 'text-good', soft: 'bg-good/10 text-good' },
  done: { bar: 'bg-good', text: 'text-good', soft: 'bg-good/10 text-good' },
  warn: { bar: 'bg-warn', text: 'text-warn', soft: 'bg-warn/12 text-warn' },
  bad: { bar: 'bg-bad', text: 'text-bad', soft: 'bg-bad/10 text-bad' },
  idle: { bar: 'bg-line', text: 'text-muted', soft: 'bg-surface2 text-muted' },
};

// ---------- عناصر صغيرة ----------
export function Money({ v, className = '', sign = '' }) {
  return (
    <span className={`num whitespace-nowrap ${className}`} dir="ltr">
      <span className="me-1 text-[0.6em] font-bold opacity-60">ر.ع</span>{sign}{fmt(v)}
    </span>
  );
}
export function DeficitBadge({ v }) {
  return <span className="num inline-flex whitespace-nowrap rounded-full bg-bad/10 px-2 py-0.5 text-xs font-extrabold text-bad ring-1 ring-bad/25">عجز: {fmtShort(v)} ر.ع</span>;
}
export function AccTag({ id }) {
  const { cardName } = useMeta();
  const Icon = ACC_ICONS[id] || CreditCard;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-muted">
      <Icon size={10} aria-hidden="true" />{cardName(id)}
    </span>
  );
}
export function Bar({ spent, budget, h = 'h-1.5' }) {
  const s = status(spent, budget);
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
  return (
    <div className={`${h} w-full overflow-hidden rounded-full bg-surface2`}>
      <div className={`${h} rounded-full ${TONE[s].bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
export function Card({ children, className = '', style }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`} style={style}>{children}</div>;
}

export function useModal(onClose) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
}

// نافذة سفلية عامة (تُعرض في body)
export function Sheet({ title, onClose, onSubmit, children, footer, wide }) {
  useModal(onClose);
  const Tag = onSubmit ? 'form' : 'div';
  return (
    <Portal>
      <div className="no-print backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-hero/40" onClick={onClose}>
        <Tag onClick={(e) => e.stopPropagation()} onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit(e); } : undefined}
          noValidate={onSubmit ? true : undefined}
          role="dialog" aria-modal="true" aria-label={title}
          className={`sheet-in gutter flex max-h-[92vh] w-full ${wide ? 'max-w-lg' : 'max-w-md'} flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-surface pt-3`}
          style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
          <span className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface2 text-xl leading-none text-muted">×</button>
          </div>
          {children}
          {footer}
        </Tag>
      </div>
    </Portal>
  );
}

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-muted">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const PrimaryButton = ({ children, className = '', ...p }) => (
  <button {...p} className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-lg font-extrabold text-white disabled:opacity-50 ${className}`}>{children}</button>
);

// شريط تقدم بسيط بنسبة 0..1
export function Progress({ value, tone = 'good', h = 'h-2' }) {
  const w = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <div className={`${h} w-full overflow-hidden rounded-full bg-surface2`}>
      <div className={`${h} rounded-full ${TONE[tone]?.bar || 'bg-accent'} transition-all duration-500`} style={{ width: `${w}%` }} />
    </div>
  );
}

export const pctText = (x) => (x == null ? '—' : `${Math.round(x * 100)}٪`);

// الوضع الداكن الحالي: تفضيل النظام، أو اختيار صريح عبر data-theme
export function useIsDark() {
  const read = () => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const on = () => setDark(read());
    mq && mq.addEventListener && mq.addEventListener('change', on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq && mq.removeEventListener && mq.removeEventListener('change', on); mo.disconnect(); };
  }, []);
  return dark;
}

// تنسيق النسبة المتبقية وألوانها (ألوان الحالة المالية ثابتة ولا تتأثر بالألوان الزخرفية)
export const REM_TONE = {
  good: { text: 'text-good', bar: 'bg-good', label: null },
  warn: { text: 'text-warn', bar: 'bg-warn', label: null },
  low: { text: 'text-bad', bar: 'bg-bad', label: 'قارب على النفاد' },
  zero: { text: 'text-muted', bar: 'bg-muted', label: 'استُهلك بالكامل' },
  over: { text: 'text-bad', bar: 'bg-bad', label: 'تجاوز الميزانية' },
  none: { text: 'text-muted', bar: 'bg-line', label: 'بلا مخصص' },
  unbudgeted: { text: 'text-bad', bar: 'bg-bad', label: 'صرف بلا مخصص' },
};

// شارة النسبة المتبقية: رقم كبير وعريض، بخلفية محايدة ثابتة
export function RemainChip({ rem, dark, size = 'md' }) {
  const t = REM_TONE[rem.tone];
  const big = size === 'lg' ? 'text-[26px]' : 'text-[21px]';
  const sub = rem.tone === 'over' ? `تجاوز ${fmtShort(rem.over)} ر.ع`
    : rem.tone === 'unbudgeted' ? `صرف ${fmtShort(rem.over)} بلا مخصص`
      : t.label || `متبقي ${fmtShort(rem.remaining)}`;
  return (
    <span className="flex min-w-[82px] shrink-0 flex-col items-center rounded-xl bg-surface px-2 py-1 text-center shadow-[0_0_0_1px_rgb(var(--line))]" style={themeVars(dark)}
      aria-label={rem.pct == null ? `النسبة المتبقية غير متاحة: ${sub}` : `النسبة المتبقية ${pctLabel(rem.pct)}، ${sub}`}>
      <span className="text-[9px] font-bold leading-tight text-muted">النسبة المتبقية</span>
      <span className={`num ${big} font-extrabold leading-tight ${t.text}`} dir="ltr">{rem.pct == null ? '—' : pctLabel(rem.pct)}</span>
      <span className={`whitespace-nowrap text-[10px] font-bold leading-tight ${rem.tone === 'good' || rem.tone === 'warn' ? 'text-muted' : t.text}`}>{sub}</span>
    </span>
  );
}

// شريط عريض يمثل المتبقي (وليس المصروف)؛ لا عرض سالب أبداً
export function RemainBar({ rem, h = 'h-2.5' }) {
  const t = REM_TONE[rem.tone];
  return (
    <span className={`block ${h} w-full overflow-hidden rounded-full`} style={{ background: 'rgb(var(--ink) / 0.12)' }}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rem.bar)} aria-label="المتبقي من المخصص">
      <span className={`block ${h} rounded-full ${t.bar} transition-all duration-500`} style={{ width: `${rem.bar}%` }} />
    </span>
  );
}
