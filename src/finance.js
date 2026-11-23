// الحسابات المالية الصافية (بلا واجهة) — مغطاة باختبارات في tests/finance.test.mjs
// المصطلحات:
//   المخطط (planned)  = المخصص للبند في الشهر
//   المدفوع (paid)    = مجموع العمليات المسجلة فعلياً على البند
//   المتبقي (remaining) = المخطط − المدفوع (سالب يعني عجزاً في البند)
//   نسبة التنفيذ (exec) = المدفوع ÷ المخطط

export const r3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const sum = (arr, f = (x) => x) => r3(arr.reduce((a, x) => a + f(x), 0));
const pad = (n) => String(n).padStart(2, '0');

export const WARN_AT = 0.8; // تنبيه عند 80٪
export const DUE_SOON_DAYS = 3;

export const daysInPeriod = (p) => { const [y, m] = p.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const addMonths = (p, n) => { const [y, m] = p.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const periodOf = (iso) => iso.slice(0, 7);
export const monthsBetween = (a, b) => { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
const dueDate = (period, day) => `${period}-${pad(Math.min(Math.max(1, day), daysInPeriod(period)))}`;

export const isSavingItem = (c) => c.isSaving === true || (c.isSaving !== false && c.id === 'saving');

// حالة البند: idle | good | warn (≥80٪) | done (=100٪) | bad (تجاوز)
export function itemStatus(paid, planned) {
  if (planned <= 0) return paid > 0 ? 'bad' : 'idle';
  const p = paid / planned;
  if (p > 1.0001) return 'bad';
  if (p > 0.9999) return 'done';
  if (p >= WARN_AT) return 'warn';
  return 'good';
}

// ---------- ملخص الشهر: المخطط والفعلي والرصيد والتوقع ----------
export function monthSummary(month, today) {
  const carryIn = Number.isFinite(month.carryIn) ? month.carryIn : 0;
  const paidBy = {};
  for (const t of month.transactions) paidBy[t.catId] = (paidBy[t.catId] || 0) + t.amount;
  const known = new Set(month.categories.map((c) => c.id));

  const isCurrent = !!today && periodOf(today) === month.period;
  const dim = month.period ? daysInPeriod(month.period) : 30;
  const dayNow = isCurrent ? Number(today.slice(8, 10)) : null;
  const isPast = !!today && month.period && month.period < periodOf(today);

  const items = month.categories.map((c) => {
    const planned = r3(c.budget);
    const paid = r3(paidBy[c.id] || 0);
    const remaining = r3(planned - paid);
    // التوقع: الالتزامات غير المدفوعة تُحسب بكامل المتبقي منها؛
    // والمصاريف اليومية في الشهر الجاري تُسقَط بحسب وتيرة الصرف إن كانت أعلى من المخطط
    let projected = Math.max(planned, paid);
    if (isCurrent && c.group === 'daily' && dayNow >= 5 && paid > 0) {
      projected = Math.max(projected, (paid / dayNow) * dim);
    }
    if (isPast) projected = paid; // الشهر المنتهي: لا مصروفات قادمة
    const toSpend = r3(Math.max(0, projected - paid));
    return {
      ...c, planned, paid, remaining,
      exec: planned > 0 ? paid / planned : null,
      status: itemStatus(paid, planned),
      projected: r3(projected), toSpend,
      paceOver: r3(Math.max(0, projected - Math.max(planned, paid))),
    };
  });

  const orphanPaid = sum(month.transactions.filter((t) => !known.has(t.catId)), (t) => t.amount);
  const planned = sum(items, (i) => i.planned);
  const paid = sum(month.transactions, (t) => t.amount);
  const available = r3(month.salary + carryIn);
  const balance = r3(available - paid); // الرصيد الفعلي الآن
  const unpaid = sum(items, (i) => Math.max(0, i.planned - i.paid)); // التزامات ومخصصات لم تُدفع بعد
  const paceOver = sum(items, (i) => i.paceOver);
  const toSpend = sum(items, (i) => i.toSpend);
  const forecast = r3(balance - toSpend); // الرصيد المتوقع نهاية الشهر
  const saved = sum(items.filter(isSavingItem), (i) => i.paid);

  return {
    items, salary: month.salary, carryIn, available, planned, paid, orphanPaid,
    balance, plannedBalance: r3(available - planned), unpaid, paceOver, toSpend, forecast, saved,
    exec: planned > 0 ? paid / planned : null,
    isCurrent, isPast, dim, dayNow,
  };
}

// رصيد نهاية الشهر الذي يُرحَّل (فعلي فقط: الراتب + المرحّل − المدفوع)
export const closingBalance = (month) => r3(month.salary + (month.carryIn || 0) - sum(month.transactions, (t) => t.amount));

// ---------- التنبيهات ----------
export function monthAlerts(month, store, today) {
  const s = monthSummary(month, today);
  const out = [];
  for (const i of s.items) {
    if (i.planned <= 0 && i.paid > 0) out.push({ kind: 'over', level: 'bad', itemId: i.id, name: i.name, amount: i.paid });
    else if (i.status === 'bad') out.push({ kind: 'over', level: 'bad', itemId: i.id, name: i.name, amount: r3(i.paid - i.planned), pct: i.exec });
    else if (i.status === 'warn') out.push({ kind: 'near', level: 'warn', itemId: i.id, name: i.name, pct: i.exec, amount: i.remaining });
    if (s.isCurrent && i.dueDay && i.paid < i.planned) {
      const left = i.dueDay - s.dayNow;
      if (left < 0) out.push({ kind: 'overdue', level: 'bad', itemId: i.id, name: i.name, date: dueDate(month.period, i.dueDay), amount: r3(i.planned - i.paid) });
      else if (left <= DUE_SOON_DAYS) out.push({ kind: 'due', level: 'warn', itemId: i.id, name: i.name, date: dueDate(month.period, i.dueDay), days: left, amount: r3(i.planned - i.paid) });
    }
  }
  if (s.isCurrent) {
    for (const d of store.debts || []) {
      const st = debtStatus(d, store, today);
      if (st.remaining <= 0 || !d.dueDay) continue;
      // إن كان القسط مرتبطاً ببند في الشهر فتنبيه البند يكفي
      if (d.linkedCatId && month.categories.some((c) => c.id === d.linkedCatId && c.dueDay)) continue;
      if (st.paidThisMonth >= Math.min(d.installment, st.remaining)) continue;
      const left = d.dueDay - s.dayNow;
      if (left >= 0 && left <= DUE_SOON_DAYS) out.push({ kind: 'debtDue', level: 'warn', debtId: d.id, name: d.name, date: dueDate(month.period, d.dueDay), days: left, amount: d.installment });
      else if (left < 0) out.push({ kind: 'debtOverdue', level: 'bad', debtId: d.id, name: d.name, date: dueDate(month.period, d.dueDay), amount: d.installment });
    }
  }
  const rank = { bad: 0, warn: 1 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// ---------- الديون ----------
// الرصيد المتبقي = الرصيد الافتتاحي − (العمليات المسجلة على البند المرتبط منذ تاريخ الرصيد + الدفعات اليدوية)
export function debtStatus(debt, store, today) {
  const since = debt.asOf || '0000-00-00';
  const txs = [];
  if (debt.linkedCatId) {
    for (const m of store.months) for (const t of m.transactions) if (t.catId === debt.linkedCatId && t.date >= since) txs.push(t);
  }
  const manual = (debt.payments || []).filter((p) => p.date >= since);
  const paidTotal = r3(sum(txs, (t) => t.amount) + sum(manual, (p) => p.amount));
  const remaining = r3(Math.max(0, debt.opening - paidTotal));
  const cur = today ? periodOf(today) : null;
  const paidThisMonth = cur ? r3(sum(txs.filter((t) => periodOf(t.date) === cur), (t) => t.amount) + sum(manual.filter((p) => periodOf(p.date) === cur), (p) => p.amount)) : 0;
  const inst = debt.installment > 0 ? debt.installment : 0;
  const count = inst ? Math.ceil(remaining / inst - 1e-9) : null;
  const schedule = [];
  if (inst && remaining > 0 && cur) {
    const day = debt.dueDay || 1;
    // إن دُفع قسط هذا الشهر يبدأ الجدول من الشهر القادم
    let p = paidThisMonth >= Math.min(inst, remaining) ? addMonths(cur, 1) : cur;
    let left = remaining;
    for (let k = 0; k < count && k < 240; k++) {
      const amt = r3(Math.min(inst, left));
      schedule.push({ date: dueDate(p, day), amount: amt });
      left = r3(left - amt);
      p = addMonths(p, 1);
    }
  }
  return {
    paidTotal, remaining, paidThisMonth, installmentsLeft: count,
    pct: debt.opening > 0 ? Math.min(1, paidTotal / debt.opening) : 1,
    next: schedule.slice(0, 3), endDate: schedule.length ? schedule[schedule.length - 1].date : null,
  };
}

// ---------- أهداف الادخار ----------
export function goalStatus(goal, store, today) {
  const since = goal.createdAt || '0000-00-00';
  let linked = 0;
  if (goal.linkedCatId) {
    for (const m of store.months) for (const t of m.transactions) if (t.catId === goal.linkedCatId && t.date >= since) linked += t.amount;
  }
  const saved = r3((goal.start || 0) + sum(goal.contributions || [], (c) => c.amount) + linked);
  const remaining = r3(Math.max(0, goal.target - saved));
  const cur = today ? periodOf(today) : null;
  let monthsLeft = null;
  if (goal.deadline && cur) monthsLeft = Math.max(0, monthsBetween(cur, goal.deadline) + 1); // يشمل الشهر الحالي
  const monthly = remaining <= 0 ? 0 : monthsLeft ? r3(remaining / monthsLeft) : remaining;
  return { saved, remaining, pct: goal.target > 0 ? Math.min(1, saved / goal.target) : 0, monthsLeft, monthly, done: remaining <= 0, late: monthsLeft === 0 && remaining > 0 };
}

// ---------- التحليل السنوي ----------
export function annualSeries(store, endPeriod, count = 12) {
  const periods = Array.from({ length: count }, (_, k) => addMonths(endPeriod, k - count + 1));
  const rows = periods.map((p) => {
    const ms = store.months.filter((m) => m.period === p);
    if (!ms.length) return { period: p, empty: true, salary: 0, planned: 0, paid: 0, surplus: 0, saved: 0 };
    const ss = ms.map((m) => monthSummary(m, null));
    const salary = sum(ss, (s) => s.salary);
    const paid = sum(ss, (s) => s.paid);
    return {
      period: p, empty: false, label: ms[0].label, salary, planned: sum(ss, (s) => s.planned), paid,
      surplus: r3(salary - paid), saved: sum(ss, (s) => s.saved), carryIn: sum(ss, (s) => s.carryIn),
    };
  });
  const filled = rows.filter((r) => !r.empty);
  const totals = {
    salary: sum(filled, (r) => r.salary), paid: sum(filled, (r) => r.paid), planned: sum(filled, (r) => r.planned),
    saved: sum(filled, (r) => r.saved), surplus: sum(filled, (r) => r.surplus), months: filled.length,
  };
  totals.avgPaid = filled.length ? r3(totals.paid / filled.length) : 0;
  // اتجاه الإنفاق: متوسط آخر 3 أشهر مقابل الثلاثة السابقة لها
  const last = filled.slice(-3), prev = filled.slice(-6, -3);
  const avg = (a) => (a.length ? a.reduce((x, r) => x + r.paid, 0) / a.length : null);
  const trend = last.length && prev.length ? r3(avg(last) - avg(prev)) : null;
  // أكثر البنود استهلاكاً
  const byItem = {};
  for (const m of store.months) {
    if (!periods.includes(m.period)) continue;
    const names = Object.fromEntries(m.categories.map((c) => [c.id, c.name]));
    for (const t of m.transactions) {
      const k = t.catId;
      byItem[k] = byItem[k] || { id: k, name: names[k] || 'بند محذوف', paid: 0 };
      if (names[k]) byItem[k].name = names[k];
      byItem[k].paid = r3(byItem[k].paid + t.amount);
    }
  }
  const top = Object.values(byItem).sort((a, b) => b.paid - a.paid).slice(0, 6);
  return { rows, totals, trend, top };
}

// ---------- محاكاة السيناريوهات (لا تغيّر البيانات) ----------
// adj: { salaryDelta, budgets: { [itemId]: newBudget }, extras: [{ name, amount }] }
export function applyScenario(month, adj) {
  const categories = month.categories.map((c) => (adj.budgets && adj.budgets[c.id] != null ? { ...c, budget: adj.budgets[c.id] } : { ...c }));
  for (const [k, e] of (adj.extras || []).entries()) {
    if (e.amount > 0) categories.push({ id: `__scenario_${k}`, name: e.name || 'قسط جديد', group: 'fixed', budget: e.amount, account: 'salary' });
  }
  return { ...month, salary: r3(month.salary + (adj.salaryDelta || 0)), categories, transactions: month.transactions.slice() };
}
export function compareScenario(month, adj, today) {
  const a = monthSummary(month, today);
  const b = monthSummary(applyScenario(month, adj), today);
  const pick = (s) => ({ salary: s.salary, planned: s.planned, plannedBalance: s.plannedBalance, forecast: s.forecast, balance: s.balance });
  const before = pick(a), after = pick(b);
  const diff = Object.fromEntries(Object.keys(before).map((k) => [k, r3(after[k] - before[k])]));
  return { before, after, diff };
}
