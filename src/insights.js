// تحليل سلوك الإنفاق — محرك قواعد قابل للتفسير يعمل على بيانات الجهاز فقط.
// هذا ليس تعلّماً آلياً ولا تنبؤاً: كل نتيجة حسابٌ مباشر على العمليات المسجلة، ويمكن تتبعها.
// المحرك منفصل عن الواجهة: أي محرك آخر (مثل نموذج ذكاء اصطناعي بموافقة صريحة من المستخدم)
// يكفي أن ينفّذ الواجهة نفسها: { id, label, local, analyze(store, ctx) => Report }.
import { r3, periodOf } from './finance.js';
import { sectionKind } from './sections.js';

const RULES = {
  unusualPct: 0.3,      // زيادة غير معتادة: 30٪ فأكثر عن متوسط الأشهر السابقة
  unusualMin: 5,        // وبمبلغ لا يقل عن 5 ر.ع
  maxCutShare: 0.25,    // لا نقترح خفض أكثر من ربع متوسط الصرف على البند (حماية الأساسيات)
  overCutShare: 2 / 3,  // نقترح خفض ثلثي التجاوز تقريباً (هدف واقعي لا مثالي)
  underusePct: 0.6,     // مخصص غير مستغل: صُرف أقل من 60٪ منه في كل الأشهر المكتملة
  recurringMin: 3,      // ملاحظة متكررة: 3 مرات فأكثر
};

const floor5 = (x) => Math.floor(x / 5) * 5;
const ceil5 = (x) => Math.ceil(x / 5) * 5;
const pct1 = (x) => Math.round(x * 1000) / 10; // 0.375 => 37.5
const num = (x) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(r3(x));
const monthWord = (label) => (label || '').replace(/^راتب شهر /, '');

// خفض مقترح واقعي: جزء من المبلغ الزائد (ثلثاه افتراضياً) مقرباً لأقرب 5 للأسفل، ولا يتجاوز ربع متوسط الصرف
export function suggestCut(excess, avgPaid, share = RULES.overCutShare) {
  if (excess <= 0 || avgPaid <= 0) return 0;
  const cap = avgPaid * RULES.maxCutShare;
  let cut = excess * share;
  cut = Math.min(cut, cap);
  if (cut >= 5) cut = floor5(cut);
  else cut = Math.max(1, Math.floor(cut)); // مبالغ صغيرة: أقرب ريال
  return Math.min(cut, excess);
}

export const ruleEngine = {
  id: 'rules-v1',
  label: 'قواعد حسابية قابلة للتفسير',
  local: true,
  analyze(store, ctx = {}) {
    const today = ctx.today;
    const curP = periodOf(today);
    const months = store.months
      .filter((m) => m.period <= curP && m.transactions.length > 0)
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    if (!months.length) {
      return { status: 'empty', engine: this.id, message: 'لا توجد مصروفات مسجلة بعد، لذلك لا يمكن تحليل سلوك الإنفاق. سجّل مصروفاتك لبضعة أسابيع ثم حدّث التحليل.' };
    }
    const completed = months.filter((m) => m.period < curP);
    const hasCurrent = months.some((m) => m.period === curP);

    // تجميع كل بند عبر الأشهر بمعرّفه الثابت
    const items = new Map();
    months.forEach((m, mi) => {
      const secs = Object.fromEntries(m.sections.map((s) => [s.id, s]));
      const paidBy = {}, notesBy = {}, countBy = {};
      for (const t of m.transactions) {
        paidBy[t.catId] = (paidBy[t.catId] || 0) + t.amount;
        countBy[t.catId] = (countBy[t.catId] || 0) + 1;
        const n = (t.note || '').trim();
        if (n) { notesBy[t.catId] = notesBy[t.catId] || {}; const o = (notesBy[t.catId][n] = notesBy[t.catId][n] || { count: 0, total: 0 }); o.count++; o.total += t.amount; }
      }
      const ids = new Set([...m.categories.map((c) => c.id), ...Object.keys(paidBy)]);
      for (const id of ids) {
        const c = m.categories.find((x) => x.id === id);
        const it = items.get(id) || { id, rows: [], notes: {} };
        if (c) {
          const sec = secs[c.group];
          it.name = c.name;
          it.section = sec ? sec.name : '';
          it.kind = c.isSaving === true || (c.isSaving !== false && c.id === 'saving') ? 'saving' : (c.dueDay || (sec && sectionKind(sec) === 'fixed')) ? 'fixed' : 'flexible';
        } else if (!it.name) { it.name = 'بند محذوف'; it.kind = 'flexible'; it.section = ''; }
        it.rows.push({ period: m.period, label: m.label, current: m.period === curP, planned: c ? r3(c.budget) : 0, paid: r3(paidBy[id] || 0), count: countBy[id] || 0, mi });
        for (const [n, o] of Object.entries(notesBy[id] || {})) { const a = (it.notes[n] = it.notes[n] || { count: 0, total: 0 }); a.count += o.count; a.total += o.total; }
        items.set(id, it);
      }
    });

    const out = [];
    for (const it of items.values()) {
      const rows = it.rows;
      if (rows.every((r) => r.paid === 0 && r.planned === 0)) continue;
      if (rows.every((r) => r.paid === 0)) continue; // لا صرف فعلي = لا سلوك يُحلَّل
      const done = rows.filter((r) => !r.current);
      // الشهر المرجعي: الشهر الجاري إن تجاوز ميزانيته فعلاً (تجاوز مؤكد)، وإلا آخر شهر مكتمل؛
      // فالشهر الجاري ناقص ولا يصح الحكم منه بأن البند «ضمن الميزانية»
      const curRow = rows.find((r) => r.current);
      const last = curRow && (curRow.paid > curRow.planned || !done.length) ? curRow : done[done.length - 1];
      const basis = done.length ? done : rows;
      const avgPaid = r3(basis.reduce((a, r) => a + r.paid, 0) / basis.length);
      const overRows = rows.filter((r) => r.paid > r.planned + 1e-9 && (r.planned > 0 || r.paid > 0));
      const excess = r3(Math.max(0, last.paid - last.planned));
      const excessPct = last.planned > 0 ? excess / last.planned : null;

      // الاتجاه: آخر شهر مكتمل مقابل متوسط الأشهر المكتملة السابقة له (يحتاج شهرين مكتملين)
      let trend = null;
      if (done.length >= 2) {
        const lastDone = done[done.length - 1];
        const prev = done.slice(0, -1);
        const prevAvg = prev.reduce((a, r) => a + r.paid, 0) / prev.length;
        const change = r3(lastDone.paid - prevAvg);
        trend = { change, pct: prevAvg > 0 ? change / prevAvg : null, prevAvg: r3(prevAvg), label: lastDone.label,
          unusual: change >= RULES.unusualMin && (prevAvg === 0 || change / prevAvg >= RULES.unusualPct) };
      }
      const recurring = Object.entries(it.notes).filter(([, o]) => o.count >= RULES.recurringMin)
        .map(([note, o]) => ({ note, count: o.count, total: r3(o.total) })).sort((a, b) => b.total - a.total).slice(0, 2);
      const underused = it.kind === 'flexible' && done.length >= 2 && done.every((r) => r.planned > 0 && r.paid < r.planned * RULES.underusePct);

      // التوصية وحجم التوفير الممكن
      let cut = 0, freed = 0, kind = 'ok';
      const tips = [];
      const where = last.current ? `حتى الآن في ${monthWord(last.label)}` : `في ${monthWord(last.label)}`;
      if (it.kind === 'saving') {
        if (last.paid < last.planned && !last.current) { kind = 'info'; tips.push(`لم يكتمل تحويل الادخار ${where}: حُوّل ${num(last.paid)} من ${num(last.planned)} ر.ع.`); }
        else tips.push('بند ادخار: لا نقترح تخفيضه.');
      } else if (it.kind === 'fixed') {
        if (excess > 0) { kind = 'warn'; tips.push(`تجاوز هذا الالتزام الثابت مخصصه بـ ${num(excess)} ر.ع ${where}. راجع المبلغ المستحق، أو حدّث المخصص إن كان المبلغ قد تغيّر.`); }
        else tips.push('التزام ثابت ضمن مخصصه. لا نقترح تخفيضه لأنه من الالتزامات الأساسية.');
      } else if (excess > 0) {
        kind = 'over';
        cut = suggestCut(excess, Math.max(avgPaid, last.paid));
        const pctText = excessPct != null ? ` بنسبة ${pct1(excessPct)}٪` : '';
        tips.push(`لاحظنا أن مصروفات «${it.name}» تجاوزت الميزانية المحددة${pctText} ${where}. نقترح تقليل المصروفات غير الضرورية بمقدار ${num(cut)} ر.ع شهرياً، مما قد يوفر ${num(cut * 12)} ر.ع سنوياً إذا استمر هذا التخفيض طوال العام.`);
      } else if (trend && trend.unusual) {
        kind = 'trend';
        cut = suggestCut(trend.change / 2, avgPaid, 1); // نصف الزيادة
        tips.push(`ارتفع الصرف على «${it.name}» في ${monthWord(trend.label)} بـ ${num(trend.change)} ر.ع عن متوسط الأشهر السابقة (${num(trend.prevAvg)} ر.ع). إن لم تكن الزيادة ضرورية، فإن إعادته قريباً من متوسطه توفر نحو ${num(cut)} ر.ع شهرياً.`);
      } else if (underused) {
        kind = 'underused';
        const maxPaid = Math.max(...done.map((r) => r.paid));
        freed = r3(Math.max(0, last.planned - ceil5(maxPaid)));
        if (freed > 0) tips.push(`صرفت أقل من ${Math.round(RULES.underusePct * 100)}٪ من مخصص «${it.name}» في كل الأشهر المكتملة. يمكن خفض المخصص إلى ${num(ceil5(maxPaid))} ر.ع وتحرير ${num(freed)} ر.ع شهرياً للادخار أو لبند آخر.`);
        else tips.push('الصرف أقل من المخصص باستمرار.');
      } else {
        tips.push(last.planned > 0 ? `الصرف ضمن الميزانية ${where} (${pct1(last.paid / last.planned)}٪ من المخصص).` : 'لا يوجد مخصص لهذا البند.');
      }
      if (overRows.length >= 2) tips.push(`تجاوز الميزانية تكرر في ${overRows.length} من ${rows.length} أشهر.`);
      for (const r of recurring) tips.push(`تكررت عمليات بملاحظة «${r.note}» ${r.count} مرات بمجموع ${num(r.total)} ر.ع.`);

      out.push({
        id: it.id, name: it.name, section: it.section, kind: it.kind, status: kind,
        month: last.label, current: last.current, planned: last.planned, paid: last.paid, excess, excessPct,
        overMonths: overRows.length, months: rows.length, avgPaid, trend, recurring,
        cut, annual: r3(cut * 12), freed, tips, history: rows.map((r) => ({ period: r.period, planned: r.planned, paid: r.paid })),
      });
    }
    const order = { over: 0, trend: 1, warn: 2, underused: 3, info: 4, ok: 5 };
    out.sort((a, b) => order[a.status] - order[b.status] || b.cut - a.cut || b.excess - a.excess);

    const monthly = r3(out.reduce((a, x) => a + x.cut, 0));
    // الملخص الشهري على نفس الشهر المرجعي للبنود: آخر شهر مكتمل، أو الشهر الجاري إن لم يكتمل شهر بعد
    const ref = completed.length ? completed[completed.length - 1] : months[months.length - 1];
    const rowsOf = (kind) => out.filter((x) => !kind || kind(x)).map((x) => x.history.find((h) => h.period === ref.period)).filter(Boolean);
    const sumOf = (rows, f) => r3(rows.reduce((a, h) => a + f(h), 0));
    const refRows = rowsOf();
    const notes = [];
    if (completed.length === 0) notes.push('لا يوجد شهر مكتمل بعد، لذا التحليل مبني على الشهر الحالي حتى اليوم فقط. لا يمكن الحكم على الاتجاهات أو تكرار التجاوز بعد.');
    else if (completed.length === 1) notes.push('يوجد شهر مكتمل واحد فقط، لذلك مقارنة الاتجاهات بين الأشهر غير متاحة بعد. تحتاج شهرين مكتملين على الأقل.');
    if (hasCurrent && completed.length > 0) notes.push(`الملخص مبني على آخر شهر مكتمل (${monthWord(ref.label)}). الشهر الحالي لم ينتهِ، ويظهر في البنود فقط إذا تجاوزت ميزانيتها فعلاً.`);

    return {
      status: completed.length >= 2 ? 'ok' : 'limited', engine: this.id, engineLabel: this.label, notes,
      monthsAnalyzed: months.length, completedMonths: completed.length,
      summary: {
        month: ref.label, current: ref.period === curP,
        planned: sumOf(refRows, (h) => h.planned),
        paid: r3(ref.transactions.reduce((a, t) => a + t.amount, 0)),
        flexiblePaid: sumOf(rowsOf((x) => x.kind === 'flexible'), (h) => h.paid),
        fixedPaid: sumOf(rowsOf((x) => x.kind !== 'flexible'), (h) => h.paid),
        overCount: refRows.filter((h) => h.paid > h.planned + 1e-9).length,
        overTotal: sumOf(refRows, (h) => Math.max(0, h.paid - h.planned)),
        monthlySaving: monthly, annualSaving: r3(monthly * 12),
        freed: r3(out.reduce((a, x) => a + x.freed, 0)),
      },
      items: out,
    };
  },
};

export function analyzeSpending(store, ctx, engine = ruleEngine) {
  return engine.analyze(store, ctx);
}
