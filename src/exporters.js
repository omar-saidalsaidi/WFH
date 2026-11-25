// تصدير الملفات: Excel، ومشاركة/تنزيل أي ملف على الآيفون
import * as XLSX from 'xlsx';
import { monthSummary, annualSeries, pctLabel } from './finance.js';

// مشاركة الملف عبر قائمة المشاركة في iOS، أو تنزيله مباشرة
export async function shareOrDownload(blob, fileName, title) {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
  return 'downloaded';
}

const pct = (x) => (x == null ? '' : Math.round(x * 1000) / 10);
const sheet = (rows, widths) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  return ws;
};
const book = () => { const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; return wb; };
const toBlob = (wb) => new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

export function monthWorkbook(month, cardName, sectionName, today) {
  const s = monthSummary(month, today);
  const wb = book();
  XLSX.utils.book_append_sheet(wb, sheet([
    ['تقرير مصاريف الراتب', month.label],
    [],
    ['الراتب الأساسي', s.salary],
    ['إجمالي الدخل الإضافي', s.extraIncome],
    ['إجمالي الدخل', s.totalIncome],
    ['الرصيد المرحّل', s.carryIn],
    ['المتاح', s.available],
    ['المخطط (الموزع)', s.planned],
    ['المدفوع فعلياً', s.paid],
    ['نسبة التنفيذ ٪', pct(s.exec)],
    ['الرصيد الفعلي المتاح', s.balance],
    ['المتبقي بعد المخصصات', s.afterAllocations],
    ['غير المدفوع من المخطط', s.unpaid],
    ['الرصيد المتوقع نهاية الشهر', s.forecast],
    ['الرصيد المخطط (المتاح − المخطط)', s.plannedBalance],
  ], [30, 20]), 'الملخص');
  const rows = [['الفئة', 'البند', 'البطاقة', 'المخصص', 'المصروف', 'المتبقي', 'النسبة المتبقية ٪', 'العجز']];
  const remPct = (r) => (r.pct == null ? 'بلا مخصص' : Math.round(r.pct * 10) / 10);
  for (const sec of month.sections) {
    for (const i of s.items.filter((x) => x.group === sec.id)) {
      rows.push([sectionName(i.group), `${i.name}${i.archived ? ' (مؤرشف)' : ''}`, cardName(i.account), i.planned, i.paid, i.remaining, remPct(i.rem), i.remaining < 0 ? -i.remaining : 0]);
    }
  }
  rows.push(['', 'الإجمالي', '', s.planned, s.paid, s.rem.remaining, remPct(s.rem), '']);
  XLSX.utils.book_append_sheet(wb, sheet(rows, [24, 18, 14, 10, 10, 10, 16, 10]), 'المخطط والفعلي');
  const inc = [['التاريخ', 'الاسم', 'المبلغ', 'متكرر', 'ملاحظة']];
  for (const i of [...s.incomes].sort((a, b) => (a.date < b.date ? -1 : 1))) inc.push([i.date, i.name, i.amount, i.recurring ? 'نعم' : 'لا', i.note || '']);
  inc.push(['', 'الإجمالي', s.extraIncome, '', '']);
  XLSX.utils.book_append_sheet(wb, sheet(inc, [12, 20, 10, 8, 30]), 'الدخل الإضافي');
  const names = Object.fromEntries(month.categories.map((c) => [c.id, c.name]));
  const tx = [['التاريخ', 'البند', 'البطاقة', 'المبلغ', 'ملاحظة']];
  for (const t of [...month.transactions].sort((a, b) => (a.date < b.date ? -1 : 1))) tx.push([t.date, names[t.catId] || 'بند محذوف', cardName(t.account), t.amount, t.note || '']);
  XLSX.utils.book_append_sheet(wb, sheet(tx, [12, 18, 14, 10, 30]), 'العمليات');
  return toBlob(wb);
}

export function annualWorkbook(store, endPeriod) {
  const a = annualSeries(store, endPeriod);
  const wb = book();
  const rows = [['الفترة', 'الشهر', 'الراتب الأساسي', 'الدخل الإضافي', 'المخطط', 'المدفوع', 'الفائض/العجز', 'الادخار']];
  for (const r of a.rows) rows.push([r.period, r.empty ? 'لا بيانات' : r.label, r.salary, r.extra, r.planned, r.paid, r.surplus, r.saved]);
  rows.push(['', 'الإجمالي', a.totals.salary, a.totals.extra, a.totals.planned, a.totals.paid, a.totals.surplus, a.totals.saved]);
  XLSX.utils.book_append_sheet(wb, sheet(rows, [10, 24, 12, 12, 10, 10, 12, 10]), 'المقارنة السنوية');
  const top = [['البند', 'المدفوع خلال الفترة']];
  for (const t of a.top) top.push([t.name, t.paid]);
  XLSX.utils.book_append_sheet(wb, sheet(top, [24, 18]), 'أكثر البنود');
  return toBlob(wb);
}
