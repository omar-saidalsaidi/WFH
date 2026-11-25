// تحليل سلوك الإنفاق — محرك قواعد قابل للتفسير يعمل على بيانات الجهاز فقط.
// هذا ليس تعلّماً آلياً ولا تنبؤاً: كل نتيجة حسابٌ مباشر على العمليات المسجلة، ويمكن تتبعها (حقل «explain»).
// المحرك منفصل عن الواجهة: أي محرك آخر (مثل نموذج ذكاء اصطناعي بموافقة صريحة من المستخدم)
// يكفي أن ينفّذ الواجهة نفسها: { id, label, local, analyze(store, ctx) => Report }.
import { r3, periodOf, monthSummary, addMonths, sumOMR, toBaisa } from './finance.js';
import { sectionKind } from './sections.js';

const RULES = {
  unusualPct: 0.3,      // زيادة غير معتادة: 30٪ فأكثر عن متوسط الأشهر السابقة
  unusualMin: 5,        // وبمبلغ لا يقل عن 5 ر.ع
  underusePct: 0.6,     // مخصص غير مستغل: صُرف أقل من 60٪ منه في كل الأشهر المكتملة
  recurringMin: 3,      // ملاحظة متكررة: 3 مرات فأكثر
  frequentMin: 8,       // تحليل التكرار: 8 عمليات فأكثر في الشهر المرجعي
  highExcessPct: 0.2,   // أولوية عالية: تجاوز 20٪ فأكثر أو تكرار التجاوز
  weeksPerMonth: 4.345,
};

// التصنيفات وقواعد الخفض لكل منها
export const KINDS = {
  fixed: { label: 'التزامات ثابتة', cut: null },
  essential: { label: 'مصروفات أساسية', cut: { share: 0.5, cap: 0.1 } },
  flexible: { label: 'مصروفات مرنة', cut: { share: 2 / 3, cap: 0.25 } },
  discretionary: { label: 'مصروفات اختيارية', cut: { share: 2 / 3, cap: 0.35 } },
  saving: { label: 'ادخار', cut: null },
};
export const KIND_ORDER = ['fixed', 'essential', 'flexible', 'discretionary', 'saving'];
const REDUCIBLE = new Set(['essential', 'flexible', 'discretionary']);

const floor5 = (x) => Math.floor(x / 5) * 5;
const ceil5 = (x) => Math.ceil(x / 5) * 5;
const pct1 = (x) => Math.round(x * 1000) / 10; // 0.375 => 37.5
const num = (x) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(r3(x));
const num1 = (x) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(x);
const monthWord = (label) => (label || '').replace(/^راتب شهر /, '');

// التصنيف: اختيار المستخدم للبند، ثم للفئة، وإلا تصنيف تلقائي يُعرض للمراجعة
export function classifyItem(c, sec) {
  if (c && c.kind && KINDS[c.kind]) return { kind: c.kind, auto: false };
  if (c && (c.isSaving === true || (c.isSaving !== false && c.id === 'saving'))) return { kind: 'saving', auto: c.isSaving !== true };
  if (sec && sec.kind && KINDS[sec.kind]) return { kind: sec.kind, auto: false };
  if (c && c.dueDay) return { kind: 'fixed', auto: true };
  return { kind: sec ? sectionKind(sec) : 'flexible', auto: true };
}

// خفض مقترح واقعي: جزء من المبلغ الزائد مقرباً لأقرب 5 للأسفل، ولا يتجاوز نسبة من متوسط الصرف (حماية الأساسيات)
export function suggestCut(excess, avgPaid, share = 2 / 3, capShare = 0.25) {
  if (excess <= 0 || avgPaid <= 0) return 0;
  const cap = avgPaid * capShare;
  let cut = Math.min(excess * share, cap);
  if (cut >= 5) cut = floor5(cut);
  else cut = Math.max(1, Math.floor(cut)); // مبالغ صغيرة: أقرب ريال
  return Math.min(cut, excess);
}

export const ruleEngine = {
  id: 'rules-v2',
  label: 'قواعد حسابية قابلة للتفسير',
  local: true,
  analyze(store, ctx = {}) {
    // تصفية الشهر: تحليل شهر مكتمل محدد كأنه آخر شهر (ما بعده يُستبعد)
    const curP = ctx.refPeriod ? addMonths(ctx.refPeriod, 1) : periodOf(ctx.today);
    const months = store.months
      .filter((m) => m.period <= curP && m.transactions.length > 0 && (!ctx.refPeriod || m.period <= ctx.refPeriod))
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    const available = store.months.filter((m) => m.transactions.length > 0 && m.period <= periodOf(ctx.today)).map((m) => ({ period: m.period, label: m.label })).sort((a, b) => (a.period < b.period ? 1 : -1));
    if (!months.length) {
      return { status: 'empty', engine: this.id, availableMonths: available, message: 'لا توجد مصروفات مسجلة بعد، لذلك لا يمكن تحليل سلوك الإنفاق. سجّل مصروفاتك لبضعة أسابيع ثم حدّث التحليل.' };
    }
    const completed = months.filter((m) => m.period < curP);
    const hasCurrent = months.some((m) => m.period === curP);

    // تجميع كل بند عبر الأشهر بمعرّفه الثابت
    const items = new Map();
    months.forEach((m) => {
      const secs = Object.fromEntries(m.sections.map((s) => [s.id, s]));
      const paidBy = {}, notesBy = {}, countBy = {};
      for (const t of m.transactions) {
        paidBy[t.catId] = (paidBy[t.catId] || 0) + toBaisa(t.amount);
        countBy[t.catId] = (countBy[t.catId] || 0) + 1;
        const n = (t.note || '').trim();
        if (n) { notesBy[t.catId] = notesBy[t.catId] || {}; const o = (notesBy[t.catId][n] = notesBy[t.catId][n] || { count: 0, total: 0, amounts: [] }); o.count++; o.total += t.amount; o.amounts.push(t.amount); }
      }
      const ids = new Set([...m.categories.map((c) => c.id), ...Object.keys(paidBy)]);
      for (const id of ids) {
        const c = m.categories.find((x) => x.id === id);
        const it = items.get(id) || { id, rows: [], notes: {} };
        if (c) {
          const sec = secs[c.group];
          const cls = classifyItem(c, sec);
          it.name = c.name; it.section = sec ? sec.name : ''; it.sectionId = c.group; it.kind = cls.kind; it.autoClass = cls.auto;
        } else if (!it.name) { it.name = 'بند محذوف'; it.kind = 'flexible'; it.autoClass = true; it.section = ''; it.sectionId = null; }
        it.rows.push({ period: m.period, label: m.label, current: m.period === curP, planned: c ? r3(c.budget) : 0, paid: (paidBy[id] || 0) / 1000, count: countBy[id] || 0 });
        for (const [n, o] of Object.entries(notesBy[id] || {})) { const a = (it.notes[n] = it.notes[n] || { count: 0, total: 0, amounts: [] }); a.count += o.count; a.total += o.total; a.amounts.push(...o.amounts); }
        items.set(id, it);
      }
    });

    const out = [];
    for (const it of items.values()) {
      const rows = it.rows;
      if (rows.every((r) => r.paid === 0)) continue; // لا صرف فعلي = لا سلوك يُحلَّل
      const done = rows.filter((r) => !r.current);
      // الشهر المرجعي: الشهر الجاري إن تجاوز ميزانيته فعلاً (تجاوز مؤكد)، وإلا آخر شهر مكتمل
      const curRow = rows.find((r) => r.current);
      const last = curRow && (curRow.paid > curRow.planned || !done.length) ? curRow : done[done.length - 1];
      const basis = done.length ? done : rows;
      const avgPaid = r3(basis.reduce((a, r) => a + r.paid, 0) / basis.length);
      const overRows = rows.filter((r) => r.paid > r.planned + 1e-9);
      const excess = r3(Math.max(0, last.paid - last.planned));
      const excessPct = last.planned > 0 ? excess / last.planned : null;

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
        .map(([note, o]) => ({ note, count: o.count, total: r3(o.total), sameAmount: o.amounts.every((a) => Math.abs(a - o.amounts[0]) < 0.001) }))
        .sort((a, b) => b.total - a.total).slice(0, 2);
      const frequency = last.count >= RULES.frequentMin ? { count: last.count, avg: r3(last.paid / last.count) } : null;
      const underused = REDUCIBLE.has(it.kind) && done.length >= 2 && done.every((r) => r.planned > 0 && r.paid < r.planned * RULES.underusePct);
      const rule = KINDS[it.kind].cut;
      const where = last.current ? `حتى الآن في ${monthWord(last.label)}` : `في ${monthWord(last.label)}`;
      const weekly = last.planned > 0 ? last.planned / RULES.weeksPerMonth : null;

      let cut = 0, freed = 0, status = 'ok', observation = '', recommendation = '', explain = '';
      const notes = [];
      if (it.kind === 'saving') {
        if (last.paid < last.planned && !last.current) { status = 'info'; observation = `لم يكتمل تحويل الادخار ${where}: حُوّل ${num(last.paid)} من ${num(last.planned)} ر.ع.`; recommendation = 'جرّب تحويل مبلغ الادخار في يوم استلام الراتب قبل بدء الصرف.'; }
        else { observation = `بند ادخار ${where}.`; recommendation = 'لا نقترح تخفيضه.'; }
        explain = 'بنود الادخار مستثناة من اقتراحات التخفيض.';
      } else if (it.kind === 'fixed') {
        if (excess > 0) { status = 'warn'; observation = `تجاوز هذا الالتزام الثابت مخصصه بـ ${num(excess)} ر.ع ${where}.`; recommendation = 'راجع المبلغ المستحق مع الجهة، أو حدّث المخصص إن كان المبلغ قد تغيّر.'; }
        else { observation = `التزام ثابت ضمن مخصصه ${where}.`; recommendation = 'لا نقترح تخفيضه لأنه من الالتزامات الأساسية أو التعاقدية.'; }
        explain = 'الالتزامات الثابتة (مثل الإيجار والأقساط) لا يُقترح تخفيضها، ويُكتفى بالتنبيه عند تجاوزها.';
      } else if (excess > 0 && last.planned === 0) {
        // صرف بلا مخصص (مثل الطوارئ): لا يُقترح «خفض»، بل تخصيص مبلغ إن تكرر
        status = 'over';
        observation = `صُرف ${num(last.paid)} ر.ع على «${it.name}» دون مخصص ${where}.`;
        recommendation = overRows.length >= 2
          ? `تكرر هذا الصرف في ${overRows.length} أشهر؛ خصّص له مبلغاً شهرياً (نحو ${num(ceil5(avgPaid))} ر.ع) حتى لا يضغط على باقي البنود.`
          : 'إن تكرر هذا الصرف، فخصّص له مبلغاً شهرياً صغيراً حتى لا يضغط على باقي البنود.';
        explain = 'البند بلا مخصص، لذا لا يُحسب تجاوز بنسبة ولا يُقترح توفير؛ المقترح المخصص = متوسط الصرف مقرباً لأقرب 5 للأعلى.';
      } else if (excess > 0) {
        status = 'over';
        cut = suggestCut(excess, Math.max(avgPaid, last.paid), rule.share, rule.cap);
        const pctText = excessPct != null ? ` بنسبة ${pct1(excessPct)}٪` : ' دون مخصص';
        observation = `تجاوزت مصروفات «${it.name}» الميزانية المحددة${pctText} ${where}.`;
        const how = it.kind === 'discretionary'
          ? `من خلال تأجيل المشتريات غير الضرورية 48 ساعة قبل الشراء${weekly ? `، وتحديد سقف أسبوعي نحو ${num1(weekly)} ر.ع` : ''}`
          : it.kind === 'essential'
            ? 'من خلال التخطيط المسبق للمشتريات ومقارنة الأسعار، دون المساس بالاحتياجات الأساسية'
            : `من خلال تحديد سقف أسبوعي${weekly ? ` نحو ${num1(weekly)} ر.ع` : ''} ومراجعة المشتريات المتكررة`;
        recommendation = `يمكنك تجربة تخفيض ${KINDS[it.kind].label.replace('مصروفات ', 'المصروفات ')} بمقدار ${num(cut)} ر.ع شهرياً، ${how}. التوفير السنوي المحتمل ${num(cut * 12)} ر.ع سنوياً، بشرط استمرار التخفيض طوال العام.`;
        explain = `التجاوز = المصروف ${num(last.paid)} − الميزانية ${num(last.planned)} = ${num(excess)} ر.ع. الخفض المقترح = ${Math.round(rule.share * 100)}٪ من التجاوز مقرباً لأقرب 5 ريالات للأسفل، ولا يزيد عن ${Math.round(rule.cap * 100)}٪ من متوسط صرفك على البند (${num(Math.max(avgPaid, last.paid))} ر.ع) حمايةً لاحتياجاتك. السنوي = الشهري × 12.`;
      } else if (trend && trend.unusual && it.kind !== 'essential') {
        status = 'trend';
        cut = suggestCut(trend.change / 2, avgPaid, 1, rule.cap);
        observation = `ارتفع الصرف على «${it.name}» في ${monthWord(trend.label)} بـ ${num(trend.change)} ر.ع عن متوسط الأشهر السابقة (${num(trend.prevAvg)} ر.ع).`;
        recommendation = `إن لم تكن الزيادة ضرورية، فإعادته تدريجياً قريباً من متوسطه توفر نحو ${num(cut)} ر.ع شهرياً (${num(cut * 12)} ر.ع سنوياً إن استمر).`;
        explain = `الزيادة = آخر شهر مكتمل − متوسط الأشهر المكتملة قبله. تُعد غير معتادة إذا بلغت ${RULES.unusualMin} ر.ع و${Math.round(RULES.unusualPct * 100)}٪ فأكثر. الخفض المقترح = نصف الزيادة مقرباً لأقرب 5 ريالات.`;
      } else if (trend && trend.unusual) {
        status = 'info';
        observation = `ارتفع الصرف الأساسي على «${it.name}» بـ ${num(trend.change)} ر.ع عن متوسطه.`;
        recommendation = 'مصروف أساسي: راجع السبب (أسعار أو احتياج جديد) دون الحاجة لتخفيضه.';
        explain = 'المصروفات الأساسية لا يُقترح تخفيضها عند الزيادة، بل عند تجاوز الميزانية فقط.';
      } else if (underused) {
        status = 'underused';
        const maxPaid = Math.max(...done.map((r) => r.paid));
        freed = r3(Math.max(0, last.planned - ceil5(maxPaid)));
        observation = `صرفت أقل من ${Math.round(RULES.underusePct * 100)}٪ من مخصص «${it.name}» في كل الأشهر المكتملة.`;
        recommendation = freed > 0 ? `يمكن خفض المخصص إلى ${num(ceil5(maxPaid))} ر.ع وتحرير ${num(freed)} ر.ع شهرياً للادخار أو لبند آخر.` : 'الصرف أقل من المخصص باستمرار.';
        explain = 'المبلغ المحرر = المخصص − أعلى صرف شهري مقرباً لأقرب 5 للأعلى. لا يُحسب ضمن التوفير من الصرف لأنه مخصص غير مستخدم أصلاً.';
      } else {
        observation = last.planned > 0 ? `الصرف ضمن الميزانية ${where} (${pct1(last.paid / last.planned)}٪ من المخصص).` : 'لا يوجد مخصص لهذا البند.';
        recommendation = 'استمر على هذا المستوى.';
        explain = 'لا تجاوز ولا زيادة غير معتادة.';
      }
      if (overRows.length >= 2) notes.push(`تجاوز الميزانية تكرر في ${overRows.length} من ${rows.length} أشهر.`);
      for (const r of recurring) notes.push(`تكررت عمليات بملاحظة «${r.note}» ${r.count} مرات بمجموع ${num(r.total)} ر.ع${r.sameAmount ? ' وبالمبلغ نفسه؛ إن كان اشتراكاً فراجع مدى حاجتك له' : ''}.`);
      if (frequency) notes.push(`سجّلت ${frequency.count} عمليات على هذا البند بمتوسط ${num(frequency.avg)} ر.ع للعملية. تقليل عدد المرات قد يكون أسهل من تقليل المبلغ.`);

      const priority = status === 'over' && excessPct != null && (excessPct >= RULES.highExcessPct || overRows.length >= 2) ? 'high'
        : status === 'over' || status === 'trend' || status === 'warn' ? 'medium'
          : status === 'underused' || status === 'info' ? 'low' : 'none';

      out.push({
        id: it.id, name: it.name, section: it.section, sectionId: it.sectionId, kind: it.kind, kindLabel: KINDS[it.kind].label, autoClass: it.autoClass,
        status, priority, month: last.label, period: last.period, current: last.current, planned: last.planned, paid: last.paid, excess, excessPct,
        overMonths: overRows.length, months: rows.length, avgPaid, trend, recurring, frequency,
        observation, recommendation, explain, notes, tips: [`${observation} ${recommendation}`, ...notes],
        cut, annual: r3(cut * 12), freed, history: rows.map((r) => ({ period: r.period, planned: r.planned, paid: r.paid })),
      });
    }
    const order = { high: 0, medium: 1, low: 2, none: 3 };
    out.sort((a, b) => order[a.priority] - order[b.priority] || b.cut - a.cut || b.excess - a.excess);

    // التوفير الشهري: مجموع خفض واحد لكل بند — لا يُحتسب البند مرتين
    const monthly = sumOMR(out, (x) => x.cut);
    const ref = completed.length ? completed[completed.length - 1] : months[months.length - 1];
    const refSum = monthSummary(ref, null);
    const refRows = out.map((x) => ({ x, h: x.history.find((h) => h.period === ref.period) })).filter((r) => r.h);
    const budgeted = refRows.filter((r) => r.h.planned > 0);
    const adherence = budgeted.length ? budgeted.filter((r) => r.h.paid <= r.h.planned + 1e-9).length / budgeted.length : null;
    let monthTrend = null;
    const prevDone = completed.filter((m) => m.period < ref.period);
    if (prevDone.length >= 1 && completed.length >= 2) {
      const prevAvg = prevDone.reduce((a, m) => a + monthSummary(m, null).paid, 0) / prevDone.length;
      monthTrend = { change: r3(refSum.paid - prevAvg), pct: prevAvg > 0 ? (refSum.paid - prevAvg) / prevAvg : null };
    }
    const notes = [];
    if (completed.length === 0) notes.push('لا يوجد شهر مكتمل بعد، لذا التحليل مبني على الشهر الحالي حتى اليوم فقط. لا يمكن الحكم على الاتجاهات أو تكرار التجاوز بعد.');
    else if (completed.length === 1) notes.push('يوجد شهر مكتمل واحد فقط، لذلك مقارنة الاتجاهات بين الأشهر غير متاحة بعد. تحتاج شهرين مكتملين على الأقل.');
    if (hasCurrent && completed.length > 0) notes.push(`الملخص مبني على آخر شهر مكتمل (${monthWord(ref.label)}). الشهر الحالي لم ينتهِ، ويظهر في البنود فقط إذا تجاوزت ميزانيتها فعلاً.`);

    return {
      status: completed.length >= 2 ? 'ok' : 'limited', engine: this.id, engineLabel: this.label, notes, availableMonths: available,
      monthsAnalyzed: months.length, completedMonths: completed.length,
      summary: {
        month: ref.label, period: ref.period, current: ref.period === curP,
        planned: sumOMR(refRows, (r) => r.h.planned),
        paid: refSum.paid, totalIncome: refSum.totalIncome, balance: refSum.balance,
        flexiblePaid: sumOMR(refRows.filter((r) => REDUCIBLE.has(r.x.kind)), (r) => r.h.paid),
        fixedPaid: sumOMR(refRows.filter((r) => !REDUCIBLE.has(r.x.kind)), (r) => r.h.paid),
        overCount: refRows.filter((r) => r.h.paid > r.h.planned + 1e-9).length,
        overTotal: sumOMR(refRows, (r) => Math.max(0, r.h.paid - r.h.planned)),
        monthlySaving: monthly, annualSaving: r3(monthly * 12),
        freed: sumOMR(out, (x) => x.freed),
        adherence, review: out.filter((x) => x.priority !== 'none').length, monthTrend,
      },
      items: out,
    };
  },
};

export function analyzeSpending(store, ctx, engine = ruleEngine) {
  return engine.analyze(store, ctx);
}

// ---------- محاكي التوفير (لا يغيّر البيانات) ----------
// يطبّق خفضاً بنسبة أو مبلغ على المصروفات القابلة للتخفيض (الأساسية والمرنة والاختيارية) في الشهر المرجعي
export function simulateSavings(report, { pct = null, amount = null, kinds = ['flexible', 'discretionary'] } = {}) {
  if (!report || !report.items) return null;
  const s = report.summary;
  const eligible = report.items.map((x) => ({ x, h: x.history.find((h) => h.period === s.period) })).filter((r) => r.h && kinds.includes(r.x.kind) && r.h.paid > 0);
  const base = sumOMR(eligible, (r) => r.h.paid);
  let reduction = 0;
  if (pct != null && pct > 0) reduction = r3((base * Math.min(pct, 100)) / 100);
  else if (amount != null && amount > 0) reduction = r3(Math.min(amount, base));
  const share = base > 0 ? reduction / base : 0;
  return {
    base, reduction, share,
    expensesBefore: s.paid, expensesAfter: (toBaisa(s.paid) - toBaisa(reduction)) / 1000,
    balanceBefore: s.balance, balanceAfter: (toBaisa(s.balance) + toBaisa(reduction)) / 1000,
    monthly: reduction, annual: r3(reduction * 12),
    // تعديل مقترح للمخصصات (لا يُطبَّق إلا بتأكيد صريح من المستخدم)
    budgetPatch: eligible.filter((r) => r.h.planned > 0).map((r) => ({ id: r.x.id, name: r.x.name, from: r.h.planned, to: r3(r.h.planned * (1 - share)) })),
  };
}
