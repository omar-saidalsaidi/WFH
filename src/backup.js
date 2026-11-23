// النسخ الاحتياطي والاستعادة مع التحقق من سلامة البيانات
import { SCHEMA_VERSION, normalizeStore } from './data.js';

export const BACKUP_APP = 'salary-tracker-omr';

// FNV-1a 32-bit: بصمة بسيطة لاكتشاف التلف أو التعديل غير المقصود
export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export function makeBackup(store, now = new Date()) {
  const data = JSON.parse(JSON.stringify(store));
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), checksum: checksum(JSON.stringify(data)), data };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// يعيد { ok, errors, warnings, store, stats } ولا يغيّر شيئاً بنفسه
export function validateBackup(input) {
  const errors = [], warnings = [];
  let obj = input;
  if (typeof input === 'string') {
    try { obj = JSON.parse(input); } catch (e) { return { ok: false, errors: ['الملف ليس JSON صالحاً.'], warnings }; }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['الملف فارغ أو غير مفهوم.'], warnings };

  let data = obj;
  if (obj.app === BACKUP_APP && obj.data) {
    data = obj.data;
    if (obj.checksum && checksum(JSON.stringify(data)) !== obj.checksum) errors.push('بصمة الملف لا تطابق محتواه: الملف تالف أو عُدّل يدوياً.');
    if (obj.schemaVersion > SCHEMA_VERSION) warnings.push('النسخة من إصدار أحدث من التطبيق، قد لا تُقرأ كل الحقول.');
  } else {
    warnings.push('الملف بلا بيانات تعريف النسخة الاحتياطية، سيتم التحقق من محتواه فقط.');
  }

  if (!data || !Array.isArray(data.months) || data.months.length === 0) {
    errors.push('لا توجد أشهر في الملف.');
    return { ok: false, errors, warnings };
  }
  const ids = new Set();
  let txCount = 0;
  data.months.forEach((m, i) => {
    const where = `الشهر ${i + 1}${m && m.label ? ` («${m.label}»)` : ''}`;
    if (!m || typeof m !== 'object') { errors.push(`${where}: بيانات غير صالحة.`); return; }
    if (!isStr(m.id)) errors.push(`${where}: معرّف مفقود.`);
    else if (ids.has(m.id)) errors.push(`${where}: معرّف مكرر.`);
    else ids.add(m.id);
    if (!PERIOD.test(m.period || '')) errors.push(`${where}: الفترة غير صحيحة.`);
    if (!isNum(m.salary) || m.salary < 0) errors.push(`${where}: الراتب غير صحيح.`);
    if (m.carryIn != null && !isNum(m.carryIn)) errors.push(`${where}: الرصيد المرحّل غير صحيح.`);
    if (!Array.isArray(m.categories)) errors.push(`${where}: قائمة البنود مفقودة.`);
    else m.categories.forEach((c, k) => {
      if (!c || !isStr(c.id) || typeof c.name !== 'string' || !isNum(c.budget) || c.budget < 0) errors.push(`${where}: البند ${k + 1} غير صالح.`);
    });
    if (!Array.isArray(m.transactions)) errors.push(`${where}: سجل العمليات مفقود.`);
    else m.transactions.forEach((t, k) => {
      txCount++;
      if (!t || !isStr(t.id) || !isStr(t.catId) || !isNum(t.amount) || t.amount <= 0 || !DATE.test(t.date || '')) errors.push(`${where}: العملية ${k + 1} غير صالحة.`);
    });
  });
  for (const [k, list] of [['debts', data.debts], ['goals', data.goals]]) {
    if (list != null && !Array.isArray(list)) errors.push(k === 'debts' ? 'قائمة الديون غير صالحة.' : 'قائمة الأهداف غير صالحة.');
  }
  (data.debts || []).forEach((d, k) => { if (!d || !isStr(d.id) || !isNum(d.opening) || d.opening < 0) errors.push(`الدين ${k + 1} غير صالح.`); });
  (data.goals || []).forEach((g, k) => { if (!g || !isStr(g.id) || !isNum(g.target) || g.target <= 0) errors.push(`الهدف ${k + 1} غير صالح.`); });

  if (errors.length) return { ok: false, errors: errors.slice(0, 8), warnings, more: Math.max(0, errors.length - 8) };
  const store = normalizeStore(data);
  return {
    ok: true, errors, warnings, store,
    stats: { months: store.months.length, transactions: txCount, debts: store.debts.length, goals: store.goals.length, exportedAt: obj.exportedAt || null },
  };
}
