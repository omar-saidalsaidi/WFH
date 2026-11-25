// إدارة الفئات (الأقسام) — عمليات صافية على البيانات، مغطاة باختبارات في tests/sections.test.mjs
//
// القواعد:
// - كل شهر يحمل نسخته من الفئات؛ المعرّفات ثابتة ولا تُعاد كتابتها.
// - النطاق 'current' يغيّر الشهر النشط فقط. النطاق 'forward' يغيّر الشهر النشط والأشهر المحفوظة التي بعده.
// - الأشهر السابقة للشهر النشط لا تُعدَّل أبداً.
// - الأشهر الجديدة تُنسخ من الشهر النشط، فترث تعديلاته تلقائياً.
// - لا تُحذف فئة فيها بنود إلا بعد نقل بنودها إلى فئة أخرى؛ البنود تحتفظ بمعرّفاتها فتبقى عملياتها مرتبطة بها.

export const PASTELS = [
  { key: 'lavender', name: 'لافندر' },
  { key: 'blue', name: 'أزرق فاتح' },
  { key: 'mint', name: 'نعناعي' },
  { key: 'peach', name: 'خوخي' },
  { key: 'yellow', name: 'أصفر باهت' },
  { key: 'pink', name: 'وردي' },
  { key: 'teal', name: 'فيروزي' },
  { key: 'gray', name: 'رمادي فاتح' },
];
export const PASTEL_KEYS = new Set(PASTELS.map((p) => p.key));

// الفئات الأصلية للالتزامات؛ غيرها مرن افتراضياً
const DEFAULT_KIND = { fixed: 'fixed', temp: 'fixed' };
export const sectionKind = (sec) => sec.kind || DEFAULT_KIND[sec.id] || 'flexible';

export const newSectionId = () => `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const countItems = (month, sectionId) => month.categories.filter((c) => c.group === sectionId && !c.archived).length;
export const countArchivedItems = (month, sectionId) => month.categories.filter((c) => c.group === sectionId && c.archived).length;
export const itemPayments = (month, itemId) => month.transactions.filter((t) => t.catId === itemId).length;
export const countPayments = (month, sectionId) => {
  const ids = new Set(month.categories.filter((c) => c.group === sectionId).map((c) => c.id));
  return month.transactions.filter((t) => ids.has(t.catId)).length;
};

// تطبيق عملية على شهر واحد. يعيد { month, applied, note }
export function applyToMonth(month, op) {
  const has = (id) => month.sections.some((s) => s.id === id);
  switch (op.type) {
    case 'add':
      if (has(op.section.id)) return { month, applied: false, note: 'موجودة' };
      return { month: { ...month, sections: [...month.sections, { ...op.section }] }, applied: true };
    case 'rename':
    case 'recolor':
    case 'setKind': {
      if (!has(op.id)) return { month, applied: false, note: 'غير موجودة' };
      let patch;
      if (op.type === 'rename') patch = { name: op.name };
      else if (op.type === 'recolor') { patch = {}; if ('color' in op) patch.color = op.color || null; if ('accent' in op) patch.accent = op.accent || null; }
      else patch = { kind: op.kind };
      return { month: { ...month, sections: month.sections.map((s) => (s.id === op.id ? { ...s, ...patch } : s)) }, applied: true };
    }
    case 'reorder': {
      // يُطبَّق الترتيب على الفئات الموجودة، وأي فئة غير مذكورة تبقى في آخر القائمة
      const pos = new Map(op.order.map((id, k) => [id, k]));
      const sorted = [...month.sections].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6) - (pos.has(b.id) ? pos.get(b.id) : 1e6));
      return { month: { ...month, sections: sorted }, applied: true };
    }
    case 'delete': {
      if (!has(op.id)) return { month, applied: false, note: 'غير موجودة' };
      const items = month.categories.filter((c) => c.group === op.id).length; // يشمل البنود المؤرشفة
      if (items > 0) {
        if (!op.moveTo || op.moveTo === op.id || !has(op.moveTo)) return { month, applied: false, note: 'لا توجد فئة لنقل البنود إليها' };
      }
      if (month.sections.length <= 1) return { month, applied: false, note: 'لا يمكن حذف آخر فئة' };
      return {
        month: {
          ...month,
          sections: month.sections.filter((s) => s.id !== op.id),
          categories: items > 0 ? month.categories.map((c) => (c.group === op.id ? { ...c, group: op.moveTo } : c)) : month.categories,
        },
        applied: true, moved: items,
      };
    }
    case 'archiveSection': {
      if (!has(op.id)) return { month, applied: false, note: 'غير موجودة' };
      return { month: { ...month, sections: month.sections.map((s) => (s.id === op.id ? { ...s, archived: !!op.archived } : s)) }, applied: true };
    }

    // ---------- البنود ----------
    case 'addItem': {
      if (month.categories.some((c) => c.id === op.item.id)) return { month, applied: false, note: 'موجود' };
      if (!has(op.item.group)) return { month, applied: false, note: 'الفئة غير موجودة' };
      return { month: { ...month, categories: [...month.categories, { ...op.item }] }, applied: true };
    }
    case 'updateItem': {
      // تعديل خصائص البند (الاسم، اللون، التصنيف...) دون المساس بالعمليات المسجلة
      if (!month.categories.some((c) => c.id === op.id)) return { month, applied: false, note: 'غير موجود' };
      const patch = { ...op.patch };
      if (patch.group && !has(patch.group)) delete patch.group;
      return { month: { ...month, categories: month.categories.map((c) => (c.id === op.id ? { ...c, ...patch } : c)) }, applied: true };
    }
    case 'reorderItems': {
      // يُعاد ترتيب بنود فئة واحدة في مواضعها نفسها داخل القائمة، وتبقى بنود الفئات الأخرى مكانها
      const inGroup = month.categories.filter((c) => c.group === op.group);
      const pos = new Map(op.order.map((id, k) => [id, k]));
      const sorted = [...inGroup].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6) - (pos.has(b.id) ? pos.get(b.id) : 1e6));
      let k = 0;
      return { month: { ...month, categories: month.categories.map((c) => (c.group === op.group ? sorted[k++] : c)) }, applied: true };
    }
    case 'archiveItem': {
      if (!month.categories.some((c) => c.id === op.id)) return { month, applied: false, note: 'غير موجود' };
      return { month: { ...month, categories: month.categories.map((c) => (c.id === op.id ? { ...c, archived: !!op.archived } : c)) }, applied: true };
    }
    case 'deleteItem': {
      // لا يُحذف بند له عمليات في الشهر: يُؤرشف بدلاً من ذلك فتبقى عملياته مرتبطة به ومحسوبة
      if (!month.categories.some((c) => c.id === op.id)) return { month, applied: false, note: 'غير موجود' };
      const pays = month.transactions.filter((t) => t.catId === op.id).length;
      if (pays > 0) {
        return { month: { ...month, categories: month.categories.map((c) => (c.id === op.id ? { ...c, archived: true } : c)) }, applied: true, archived: true, payments: pays };
      }
      return { month: { ...month, categories: month.categories.filter((c) => c.id !== op.id) }, applied: true };
    }
    default:
      throw new Error(`عملية غير معروفة: ${op.type}`);
  }
}

// تطبيق عملية على البيانات حسب النطاق. يعيد { store, applied: [labels], skipped: [{label, note}] }
export function applySectionOp(store, op, scope = 'current') {
  const active = store.months.find((m) => m.id === store.activeId);
  if (!active) return { store, applied: [], skipped: [] };
  const targets = new Set([active.id]);
  if (scope === 'forward') for (const m of store.months) if (m.period > active.period) targets.add(m.id);
  const applied = [], skipped = [];
  let archived = 0;
  const months = store.months.map((m) => {
    if (!targets.has(m.id)) return m;
    const r = applyToMonth(m, op);
    if (r.applied) applied.push(m.label); else skipped.push({ label: m.label, note: r.note });
    if (r.archived) archived++;
    return r.month;
  });
  return { store: { ...store, months }, applied, skipped, archived };
}

export const laterMonths = (store) => {
  const active = store.months.find((m) => m.id === store.activeId);
  return active ? store.months.filter((m) => m.period > active.period) : [];
};
