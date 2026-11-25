// جرس التنبيهات (أبيض / كهرماني) وستارة التنبيهات المنسدلة
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Bell, X, Trash2, TriangleAlert, CircleAlert, CalendarClock, CheckCheck } from 'lucide-react';
import { Portal } from './ui.jsx';
import {
  computeConditions, syncNotifications, loadNotifState, saveNotifState, unreadCount, markAllRead,
  deleteNotification, clearNotifications,
} from './notifications.js';

const pad = (n) => String(n).padStart(2, '0');

// حالة التنبيهات: تُزامَن فقط عند تغيّر بيانات الشهر الجاري أو الإعدادات أو التاريخ — لا استطلاع دوري
export function useNotifications(store, today) {
  const [state, setState] = useState(loadNotifState);
  const period = `${today.y}-${pad(today.m)}`;
  const current = store.months.find((m) => m.period === period) || null;
  const { spendLimit, payDay } = store.settings;
  const conditions = useMemo(
    () => computeConditions({ months: current ? [current] : [], debts: store.debts, goals: [], settings: { spendLimit, payDay } }, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, store.debts, spendLimit, payDay, today.y, today.m, today.d],
  );
  useEffect(() => { setState((prev) => syncNotifications(prev, conditions, new Date().toISOString())); }, [conditions]);
  const [saved, setSaved] = useState(state);
  useEffect(() => { if (state !== saved) { saveNotifState(state); setSaved(state); } }, [state, saved]);
  return {
    state,
    unread: unreadCount(state),
    readAll: () => setState((s) => markAllRead(s)),
    remove: (id) => setState((s) => deleteNotification(s, id)),
    clear: () => setState((s) => clearNotifications(s)),
  };
}

export function NotificationBell({ unread, open, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog"
      aria-label={unread ? `التنبيهات: ${unread} غير مقروءة` : 'التنبيهات: لا جديد'}
      className="notif-bell grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-hero" data-unread={unread ? 'true' : 'false'}
      style={{ color: unread ? '#FFBF47' : '#FFFFFF' }}>
      <Bell size={20} strokeWidth={2.2} fill={unread ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}

const ICON = { bad: TriangleAlert, warn: CircleAlert, info: CalendarClock };
const LEVEL = { bad: { t: 'عاجل', c: 'bg-bad/10 text-bad' }, warn: { t: 'تنبيه', c: 'bg-warn/12 text-warn' }, info: { t: 'معلومة', c: 'bg-accent/10 text-accent' } };
const when = (iso) => { try { return new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Muscat' }).format(new Date(iso)); } catch (e) { return ''; } };

// الستارة: تُركَّب فقط عند الفتح، وتنسدل أسفل الترويسة دون دفع محتوى الصفحة
export function NotificationCurtain({ notif, headerRef, onClose }) {
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
  const items = notif.state.items;
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
                    <li key={n.id} className={`flex items-start gap-2.5 px-3 py-2.5 ${n.read ? '' : 'bg-warn/5'}`}>
                      <Icon size={17} className={`mt-0.5 shrink-0 ${n.level === 'bad' ? 'text-bad' : n.level === 'warn' ? 'text-warn' : 'text-accent'}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold">
                          <span className="min-w-0 break-words">{n.title}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${lv.c}`}>{lv.t}</span>
                        </p>
                        <p className="text-[12px] leading-relaxed text-muted">{n.desc}</p>
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
