// واجهة «تحليل سلوك الإنفاق»
import React, { useMemo, useState } from 'react';
import { RefreshCw, Info, ShieldCheck, Lightbulb, TrendingUp, PiggyBank } from 'lucide-react';
import { Card } from './ui.jsx';
import { fmtShort, todayISO } from './data.js';
import { analyzeSpending } from './insights.js';

const KIND = { fixed: 'التزام ثابت', flexible: 'مصروف مرن', saving: 'ادخار' };
const STATUS = {
  over: { t: 'تجاوز الميزانية', c: 'bg-bad/10 text-bad' },
  trend: { t: 'زيادة غير معتادة', c: 'bg-warn/12 text-warn' },
  warn: { t: 'التزام تجاوز مخصصه', c: 'bg-warn/12 text-warn' },
  underused: { t: 'مخصص غير مستغل', c: 'bg-accent/10 text-accent' },
  info: { t: 'ملاحظة', c: 'bg-surface2 text-muted' },
  ok: { t: 'ضمن الميزانية', c: 'bg-good/10 text-good' },
};
const pct1 = (x) => `${Math.round(x * 1000) / 10}٪`;
const monthWord = (l) => (l || '').replace(/^راتب شهر /, '');

export function SpendingBehavior({ store }) {
  const [nonce, setNonce] = useState(0);
  const [at, setAt] = useState(() => new Date());
  const [filter, setFilter] = useState('attention');
  const r = useMemo(() => analyzeSpending(store, { today: todayISO() }), [store, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => { setNonce((n) => n + 1); setAt(new Date()); };

  const header = (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] text-muted">آخر تحديث {at.toLocaleTimeString('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</p>
      <button onClick={refresh} className="flex h-9 items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 text-sm font-bold text-accent"><RefreshCw size={15} />تحديث التحليل</button>
    </div>
  );
  const privacy = (
    <p className="flex items-start gap-2 rounded-xl bg-surface2 px-3 py-2 text-[11px] leading-relaxed text-muted">
      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-good" />
      يعمل التحليل على جهازك فقط بقواعد حسابية واضحة على عملياتك المسجلة، وليس ذكاءً اصطناعياً أو تنبؤاً. لا تُرسل بياناتك المالية إلى أي جهة.
    </p>
  );

  if (r.status === 'empty') {
    return (
      <>
        {header}
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent"><Lightbulb size={24} /></span>
          <p className="font-extrabold">لا توجد بيانات كافية للتحليل</p>
          <p className="text-sm text-muted">{r.message}</p>
        </Card>
        {privacy}
      </>
    );
  }

  const s = r.summary;
  const attention = r.items.filter((x) => x.status !== 'ok');
  const shown = filter === 'attention' ? attention : r.items;
  const flexShare = s.paid > 0 ? s.flexiblePaid / s.paid : 0;

  return (
    <>
      {header}
      {r.notes.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5 text-[13px] text-warn">
          {r.notes.map((n, k) => <p key={k} className="flex items-start gap-1.5"><Info size={15} className="mt-0.5 shrink-0" />{n}</p>)}
        </div>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-xs font-bold text-muted">الملخص الشهري · {monthWord(s.month)}{s.current ? ' (حتى اليوم)' : ''}</p>
          <p className="mt-1 text-sm">حُلّلت <b className="num">{r.monthsAnalyzed}</b> {r.monthsAnalyzed === 1 ? 'شهر' : 'أشهر'} فيها عمليات، منها <b className="num">{r.completedMonths}</b> مكتملة.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-good/10 p-3">
            <p className="flex items-center gap-1 text-[11px] font-bold text-good"><PiggyBank size={13} />توفير ممكن شهرياً</p>
            <p className="num text-2xl font-extrabold text-good">{fmtShort(s.monthlySaving)} <span className="text-xs">ر.ع</span></p>
            <p className="num text-[11px] text-muted">≈ {fmtShort(s.annualSaving)} ر.ع سنوياً</p>
          </div>
          <div className="rounded-xl bg-surface2 p-3">
            <p className="text-[11px] font-bold text-muted">بنود تجاوزت ميزانيتها</p>
            <p className={`num text-2xl font-extrabold ${s.overCount ? 'text-bad' : ''}`}>{s.overCount}</p>
            <p className="num text-[11px] text-muted">بمجموع تجاوز {fmtShort(s.overTotal)} ر.ع</p>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-bold text-muted">
            <span>مصاريف مرنة <span className="num text-ink">{fmtShort(s.flexiblePaid)}</span></span>
            <span>التزامات وادخار <span className="num text-ink">{fmtShort(s.fixedPaid)}</span></span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface2">
            <div className="h-full bg-accent" style={{ width: `${flexShare * 100}%` }} />
            <div className="h-full bg-sky/50" style={{ width: `${(1 - flexShare) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted">التوصيات تركّز على المصاريف المرنة فقط، ولا تقترح خفض الالتزامات الثابتة أو الادخار.</p>
        </div>
        {s.freed > 0 && <p className="text-[13px]">يمكن أيضاً تحرير <b className="num">{fmtShort(s.freed)}</b> ر.ع شهرياً من مخصصات لا تُستغل.</p>}
      </Card>

      <div className="flex gap-2" role="tablist" aria-label="تصفية البنود">
        {[['attention', `تحتاج انتباهاً (${attention.length})`], ['all', `كل البنود (${r.items.length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`pill ${filter === k ? 'pill-on' : 'pill-off'}`}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && (
        <Card className="p-5 text-center text-sm text-muted">لا توجد بنود تحتاج انتباهاً. كل المصاريف ضمن ميزانيتها.</Card>
      )}
      {shown.map((x) => <InsightCard key={x.id} x={x} />)}
      {privacy}
    </>
  );
}

function InsightCard({ x }) {
  const st = STATUS[x.status];
  const max = Math.max(1, ...x.history.map((h) => Math.max(h.planned, h.paid)));
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold">الفئة: {x.name}</p>
          <p className="text-[11px] text-muted">{x.section ? `${x.section} · ` : ''}{KIND[x.kind]} · {monthWord(x.month)}{x.current ? ' (حتى اليوم)' : ''}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.c}`}>{st.t}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
        <Kv k="الميزانية المحددة" v={`${fmtShort(x.planned)} ر.ع`} />
        <Kv k="المصروف الفعلي" v={`${fmtShort(x.paid)} ر.ع`} />
        {x.excess > 0 && <Kv k="تجاوز الميزانية" v={`${fmtShort(x.excess)} ر.ع`} bad />}
        {x.excess > 0 && x.excessPct != null && <Kv k="نسبة التجاوز" v={pct1(x.excessPct)} bad />}
        {x.months > 1 && <Kv k="متوسط الصرف الشهري" v={`${fmtShort(x.avgPaid)} ر.ع`} />}
        {x.trend && <Kv k="التغير عن المتوسط السابق" v={`${x.trend.change > 0 ? '+' : ''}${fmtShort(x.trend.change)} ر.ع`} bad={x.trend.unusual} />}
      </dl>
      {x.history.length > 1 && (
        <div className="flex h-12 items-end gap-1" role="img" aria-label="الصرف الشهري لهذا البند">
          {x.history.map((h) => (
            <div key={h.period} className="relative flex flex-1 items-end justify-center" style={{ height: '100%' }} title={h.period}>
              <div className="absolute bottom-0 w-full rounded-t-sm bg-sky/20" style={{ height: `${(h.planned / max) * 100}%` }} />
              <div className={`relative w-1/2 rounded-t-sm ${h.paid > h.planned ? 'bg-bad' : 'bg-accent'}`} style={{ height: `${(h.paid / max) * 100}%`, minHeight: h.paid ? 2 : 0 }} />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5 rounded-xl bg-surface2 p-3 text-[13px] leading-relaxed">
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-accent"><Lightbulb size={14} />التوصية</p>
        {x.tips.map((t, k) => <p key={k}>{t}</p>)}
        {x.cut > 0 && <p className="flex items-center gap-1.5 font-bold text-good"><TrendingUp size={14} />توفير ممكن: <span className="num">{fmtShort(x.cut)}</span> ر.ع شهرياً · <span className="num">{fmtShort(x.annual)}</span> ر.ع سنوياً</p>}
      </div>
    </Card>
  );
}
function Kv({ k, v, bad }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className={`num font-extrabold ${bad ? 'text-bad' : ''}`}>{v}</dd>
    </div>
  );
}
