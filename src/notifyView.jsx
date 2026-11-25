// جرس التنبيهات (أبيض / كهرماني) وستارة التنبيهات المنسدلة
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bell, X, Trash2, TriangleAlert, CircleAlert, CalendarClock, CheckCheck, Siren, Eye } from 'lucide-react';
import { Portal } from './ui.jsx';
import {
  computeConditions, syncNotifications, loadNotifState, saveNotifState, unreadCount, markAllRead,
  deleteNotification, clearNotifications, displayOrder, unreadCritical, hideBanner, bannerHidden,
} from './notifications.js';
import { criticalConditions } from './critical.js';

const pad = (n) => String(n).padStart(2, '0');

// حالة التنبيهات: تُزامَن فقط عند تغيّر بيانات الشهر الجاري أو الإعدادات أو التاريخ — لا استطلاع دوري
export function useNotifications(store, today) {
  const [state, setState] = useState(loadNotifState);
  const period = `${today.y}-${pad(today.m)}`;
  const current = store.months.find((m) => m.period === period) || null;
  const { spendLimit, payDay, critical } = store.settings;
  const conditions = useMemo(
    () => computeConditions({ months: current ? [current] : [], debts: store.debts, goals: [], settings: { spendLimit, payDay } }, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, store.debts, spendLimit, payDay, today.y, today.m, today.d],
  );
  // الحرجة: عمليات الأكل والبنزين من كل الأشهر (الأسبوع قد يمتد على شهرين)
  const crit = useMemo(
    () => criticalConditions({ months: store.months, settings: { critical } }, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.months, critical, today.y, today.m, today.d],
  );
  const all = useMemo(() => [...crit, ...conditions], [crit, conditions]);
  useEffect(() => { setState((prev) => syncNotifications(prev, all, new Date().toISOString())); }, [all]);
  const [saved, setSaved] = useState(state);
  useEffect(() => { if (state !== saved) { saveNotifState(state); setSaved(state); } }, [state, saved]);
  // تنبيه حسي اختياري: اهتزاز قصير أو نغمة واحدة، فقط عند تنبيه حرج جديد وإذا فعّله المستخدم
  const lastSeq = useRef(state.seq);
  useEffect(() => {
    if (state.seq === lastSeq.current) return;
    const fresh = state.items.some((i) => !i.read && i.level === 'critical' && Number(i.id.split('#')[1]) > lastSeq.current);
    lastSeq.current = state.seq;
    if (fresh && critical?.alertFx) alertOnce();
  }, [state, critical]);
  return {
    state,
    crit,
    unread: unreadCount(state),
    critical: unreadCritical(state),
    banners: crit.filter((c) => !bannerHidden(state, c)),
    readAll: () => setState((s) => markAllRead(s)),
    remove: (id) => setState((s) => deleteNotification(s, id)),
    clear: () => setState((s) => clearNotifications(s)),
    hide: (key) => setState((s) => hideBanner(s, key)),
  };
}

export const fxSupport = () => ({
  vibrate: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
  sound: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
});
export function alertOnce() {
  try { if (fxSupport().vibrate) navigator.vibrate(180); } catch (e) { /* غير مدعوم */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.18); o.onended = () => ctx.close();
  } catch (e) { /* غير مدعوم */ }
}

export const BELL = { none: '#FFFFFF', unread: '#FFBF47', critical: '#FF4545' };
export function NotificationBell({ unread, critical, open, onToggle }) {
  const st = critical ? 'critical' : unread ? 'unread' : 'none';
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog"
      aria-label={critical ? `التنبيهات: تحذير حرج غير مقروء (${unread})` : unread ? `التنبيهات: ${unread} غير مقروءة` : 'التنبيهات: لا جديد'}
      className="notif-bell grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-hero" data-unread={unread ? 'true' : 'false'} data-state={st}
      style={{ color: BELL[st] }}>
      <Bell size={20} strokeWidth={2.2} fill={unread ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}

const ICON = { critical: Siren, bad: TriangleAlert, warn: CircleAlert, info: CalendarClock };
const LEVEL = { critical: { t: 'حرج', c: 'bg-[#B42318] text-white' }, bad: { t: 'عاجل', c: 'bg-bad/10 text-bad' }, warn: { t: 'تنبيه', c: 'bg-warn/12 text-warn' }, info: { t: 'معلومة', c: 'bg-accent/10 text-accent' } };
const when = (iso) => { try { return new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Muscat' }).format(new Date(iso)); } catch (e) { return ''; } };

// الستارة: تُركَّب فقط عند الفتح، وتنسدل أسفل الترويسة دون دفع محتوى الصفحة
export function NotificationCurtain({ notif, headerRef, onClose, onShowItem }) {
  const [top, setTop] = useState(64);
  const [ask, setAsk] = useState(false);
  useLayoutEffect(() => {
    const h = headerRef.current;
    if (h) setTop(Math.round(h.getBoundingClientRect().bottom));
  }, [headerRef]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const items = displayOrder(notif.state);
  return (
    <Portal>
      <div className="no-print fixed inset-x-0 bottom-0 z-40 bg-hero/25" style={{ top }} onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="false" aria-label="التنبيهات" className="notif-curtain curtain-in no-print fixed inset-x-0 z-40 flex justify-center" style={{ top }}>
        <div className="gutter w-full max-w-md">
          <div className="flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-b-2xl border border-t-0 border-line bg-surface shadow-xl">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <h2 className="flex-1 text-base font-extrabold">التنبيهات</h2>
              {notif.unread > 0 && <button type="button" onClick={notif.readAll} className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-accent"><CheckCheck size={14} />تحديد الكل كمقروء</button>}
              <button type="button" onClick={onClose} aria-label="إغلاق التنبيهات" className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-muted"><X size={16} /></button>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">لا توجد تنبيهات</p>
            ) : (
              <ul className="flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
                {items.map((n) => {
                  const Icon = ICON[n.level] || CircleAlert;
                  const lv = LEVEL[n.level] || LEVEL.info;
                  return (
                    <li key={n.id} data-level={n.level} className={`flex items-start gap-2.5 px-3 py-2.5 ${n.level === 'critical' && notif.state.active[n.key] ? 'border-s-4 border-bad bg-bad/10' : n.read ? '' : 'bg-warn/5'}`}>
                      <Icon size={17} className={`mt-0.5 shrink-0 ${n.level === 'bad' || n.level === 'critical' ? 'text-bad' : n.level === 'warn' ? 'text-warn' : 'text-accent'}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold">
                          <span className="min-w-0 break-words">{n.title}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${lv.c}`}>{lv.t}</span>
                        </p>
                        <p className="text-[12px] leading-relaxed text-muted">{n.desc}</p>
                        {n.advice && <p className="mt-0.5 text-[12px] font-bold leading-relaxed text-ink">{n.advice}</p>}
                        {n.level === 'critical' && n.itemId && notif.state.active[n.key] && onShowItem && (
                          <button type="button" onClick={() => onShowItem(n)} className="mt-1 flex h-8 items-center gap-1 rounded-lg bg-[#B42318] px-2.5 text-[12px] font-bold text-white"><Eye size={13} />عرض البند</button>
                        )}
                        <p className="num text-[10px] text-muted">{when(n.at)}</p>
                      </div>
                      <button type="button" onClick={() => notif.remove(n.id)} aria-label={`حذف التنبيه: ${n.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted"><Trash2 size={14} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            {items.length > 0 && (
              <div className="border-t border-line px-3 py-2">
                {ask ? (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="flex-1 font-bold">مسح كل التنبيهات؟ لا تتأثر بياناتك المالية.</span>
                    <button type="button" onClick={() => { notif.clear(); setAsk(false); }} className="h-8 rounded-lg bg-bad px-2.5 font-bold text-white">مسح</button>
                    <button type="button" onClick={() => setAsk(false)} className="h-8 rounded-lg bg-surface2 px-2.5 font-bold text-muted">إلغاء</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAsk(true)} className="flex h-8 items-center gap-1 text-[12px] font-bold text-bad"><Trash2 size={13} />مسح جميع التنبيهات</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// شريط التحذير الحرج في الرئيسية: يبقى ما دامت الحالة قائمة (قراءة التنبيه أو حذفه لا يزيله)،
// ولا يمنع تسجيل المصروفات. «إخفاء» يطويه حتى يزيد التجاوز أو تبدأ فترة جديدة.
export function CriticalBanners({ items, onShow, onHide }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2" role="alert">
      {items.map((c) => (
        <section key={c.key} className="critical-banner rounded-2xl bg-[#B42318] p-3 text-white shadow-md" data-kind={c.kind} aria-label={c.title}>
          <p className="flex items-start gap-2 text-[14px] font-extrabold leading-snug"><Siren size={18} className="mt-0.5 shrink-0" aria-hidden="true" />{c.title}</p>
          <dl className="num mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
            <div className="rounded-lg bg-white/15 px-1 py-1"><dt>{c.kind === 'food' ? 'صُرف اليوم' : 'صُرف هذا الأسبوع'}</dt><dd className="text-[14px] font-extrabold">{c.spent.toFixed(3)}</dd></div>
            <div className="rounded-lg bg-white/15 px-1 py-1"><dt>{c.kind === 'food' ? 'الحد اليومي' : 'الحد الأسبوعي'}</dt><dd className="text-[14px] font-extrabold">{c.limit.toFixed(3)}</dd></div>
            <div className="rounded-lg bg-white px-1 py-1 text-[#B42318]"><dt className="font-bold">التجاوز</dt><dd className="crit-excess text-[14px] font-extrabold" dir="ltr">+{c.excess.toFixed(3)}</dd></div>
          </dl>
          {c.kind === 'food' && c.pct != null && <p className="num mt-1.5 text-[11px] font-bold">نسبة الصرف اليوم {(Math.round(c.pct * 1000) / 1000)}٪ من مخصص الأكل الشهري</p>}
          <p className="mt-1.5 text-[12px] leading-relaxed">{c.advice}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => onShow(c)} className="flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-[13px] font-extrabold text-[#B42318]"><Eye size={14} />عرض البند</button>
            <button type="button" onClick={() => onHide(c.key)} aria-label={`إخفاء: ${c.title}`} className="h-9 rounded-lg px-3 text-[12px] font-bold text-white/90 ring-1 ring-white/50">إخفاء</button>
          </div>
        </section>
      ))}
    </div>
  );
}
