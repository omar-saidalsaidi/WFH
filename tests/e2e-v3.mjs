// اختبار وظيفي للإصدار 3: الدخل الإضافي، النسبة المتبقية، الألوان، إدارة البنود، التحليل والمحاكي، التقارير، الترحيل
// يعمل في متصفح معزول ببيانات اختبار؛ لا يلمس بيانات المستخدم الحقيقية.
// التشغيل: npm run build && node tests/e2e-v3.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as XLSX from 'xlsx';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = process.env.OUT || path.resolve('tests/.out');
mkdirSync(OUT, { recursive: true });
const URL = `file://${path.resolve('index.html')}`;
const results = [];
let failed = 0, passed = 0;
const check = (area, name, cond, extra = '') => { results.push({ area, name, ok: !!cond }); if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const per = (k) => { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const P1 = per(-1), P = per(0);
const day = `${P}-${pad(Math.min(now.getDate(), 28))}`;

const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'المصاريف اليومية', color: 'lavender' }, { id: 'temp', name: 'التزامات مؤقتة' }, { id: 'emergency', name: 'طوارئ' }];
const cards = [{ id: 'salary', name: 'حساب الراتب' }, { id: 'applepay', name: 'Apple Pay' }, { id: 'card1', name: 'البطاقة 1' }, { id: 'card2', name: 'البطاقة 2' }];
// بنود مصممة لتنتج نسباً متبقية: 100، 75، 50، 20، 0، سالبة، وبلا مخصص
const cats = [
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' },
  { id: 'net', name: 'النت', group: 'fixed', budget: 30, account: 'salary' },
  { id: 'fuel', name: 'بنزين السيارة', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'food', name: 'الأكل والمطاعم', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'fun', name: 'ترفيه', group: 'daily', budget: 40, account: 'applepay' },
  { id: 'gym', name: 'النادي', group: 'daily', budget: 25, account: 'card1' },
  { id: 'laundry', name: 'الدوبي', group: 'daily', budget: 10, account: 'applepay' },
  { id: 'emergency', name: 'طارئ', group: 'emergency', budget: 0, account: 'card1' },
];
let n = 0;
const tx = (catId, amount, date, note = '') => ({ id: `t${n++}`, catId, amount, date, note, account: 'applepay', created: n });
const curTx = [
  tx('rent', 120, `${P}-01`), tx('fuel', 20, `${P}-02`), tx('food', 100, `${P}-03`), tx('fun', 20, `${P}-03`),
  tx('gym', 20, `${P}-04`), tx('laundry', 10, `${P}-04`), tx('emergency', 7.5, `${P}-05`),
];
// المجموع: 120+20+100+20+20+10+7.5 = 297.5
const prevTx = [tx('rent', 120, `${P1}-01`), tx('food', 110, `${P1}-03`), tx('fuel', 40, `${P1}-05`)];
const mk = (id, period, txs, extra = {}) => ({ id, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, carryFromId: null, sections, cards, categories: cats, transactions: txs, ...extra });
// بيانات بصيغة الإصدار 5 (قبل هذا التحديث): بلا دخل إضافي، وبمفتاح لون قديم
const v5 = { schemaVersion: 5, debts: [], goals: [], activeId: 'cur', months: [mk('prev', P1, prevTx), mk('cur', P, curTx)] };

const b = await chromium.launch();
const errs = [];
async function open(scheme = 'light', data = v5, opts = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, colorScheme: scheme, acceptDownloads: true, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto(URL);
  await p.evaluate((v) => { localStorage.clear(); sessionStorage.clear(); if (v) localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(v)); }, data);
  await p.reload(); await p.waitForTimeout(400);
  return { p, ctx };
}
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')));
const month = (s, id) => s.months.find((m) => m.id === id);
const hero = async (p) => (await p.locator('.summary-cards').innerText()).replace(/\s+/g, ' ').replace(/,/g, '');
const chipOf = (p, name) => p.getByRole('button', { name: `تسجيل مصروف على ${name}` }).locator('[aria-label^="النسبة المتبقية"]');
const noHScroll = async (p, where) => check('الواجهة', `بلا تمرير أفقي: ${where}`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);

let { p } = await open();

console.log('1) ترحيل البيانات المحفوظة');
let s = await store(p);
const bk = await p.evaluate(() => localStorage.getItem('salary-tracker-omr-backup-schema5'));
check('الترحيل', 'نسخة احتياطية حرفية قبل الترقية', bk === JSON.stringify(v5));
check('الترحيل', 'الإصدار 6 ودخل إضافي فارغ لكل شهر', s.schemaVersion === 6 && s.months.every((m) => Array.isArray(m.incomes) && m.incomes.length === 0));
check('الترحيل', 'العمليات والرواتب كما هي دون تكرار', JSON.stringify(month(s, 'cur').transactions) === JSON.stringify(curTx) && JSON.stringify(month(s, 'prev').transactions) === JSON.stringify(prevTx) && s.months.every((m) => m.salary === 760));
check('الترحيل', 'مفتاح اللون القديم محفوظ', month(s, 'cur').sections[1].color === 'lavender');
await p.reload(); await p.waitForTimeout(200);
check('الترحيل', 'ترحيل متكرر لا يغيّر شيئاً', JSON.stringify(await store(p)) === JSON.stringify(s));

console.log('2) النسبة المتبقية');
for (const id of ['الالتزامات الثابتة', 'طوارئ']) await p.getByRole('button', { name: new RegExp(`^${id}`) }).first().click();
await p.waitForTimeout(200);
const expectChip = [['النت', '100٪', 'متبقي 30'], ['بنزين السيارة', '75٪', 'متبقي 60'], ['ترفيه', '50٪', 'متبقي 20'], ['النادي', '20٪', 'قارب على النفاد'], ['الدوبي', '0٪', 'استُهلك بالكامل'], ['الأكل والمطاعم', '-25٪', 'تجاوز 20 ر.ع'], ['طارئ', '—', 'صرف 7.5 بلا مخصص']];
for (const [name, pct, sub] of expectChip) {
  const t = (await chipOf(p, name).innerText()).replace(/\s+/g, ' ');
  check('النسبة المتبقية', `${name}: ${pct}`, t.includes(pct) && t.includes(sub), t);
}
const bars = await p.getByRole('button', { name: 'تسجيل مصروف على الأكل والمطاعم' }).locator('[role=progressbar] > span').evaluate((el) => el.style.width);
check('النسبة المتبقية', 'التجاوز لا يعطي شريطاً سالباً', bars === '0%', bars);
const fuelBar = await p.getByRole('button', { name: 'تسجيل مصروف على بنزين السيارة' }).locator('[role=progressbar] > span').evaluate((el) => el.style.width);
check('النسبة المتبقية', 'الشريط يمثل المتبقي (75٪)', fuelBar === '75%', fuelBar);
const fuelRow = (await p.getByRole('button', { name: 'تسجيل مصروف على بنزين السيارة' }).innerText()).replace(/\s+/g, ' ');
check('النسبة المتبقية', 'المخصص والمصروف والمتبقي في كل بند', /المبلغ المخصص 80/.test(fuelRow) && /المبلغ المصروف 20/.test(fuelRow) && /المبلغ المتبقي 60/.test(fuelRow));
const dailyHeader = (await p.getByRole('button', { name: /^المصاريف اليومية/ }).first().innerText()).replace(/\s+/g, ' ');
// الفئة اليومية: مخصص 235، مصروف 170 => متبقي 65 = 27.7٪
check('النسبة المتبقية', 'ملخص الفئة بالنسبة المتبقية (27.7٪)', dailyHeader.includes('27.7٪') && dailyHeader.includes('متبقي 65'), dailyHeader);
// تحديث فوري بعد إضافة عملية
await p.getByRole('button', { name: 'تسجيل مصروف على بنزين السيارة' }).click();
await p.fill('#f-amount', '20'); await p.getByRole('button', { name: 'حفظ وخصم المبلغ' }).click(); await p.waitForTimeout(200);
check('النسبة المتبقية', 'تحديث فوري بعد إضافة عملية (75٪ ← 50٪)', (await chipOf(p, 'بنزين السيارة').innerText()).includes('50٪'));
await p.getByRole('navigation').getByText('السجل', { exact: true }).click();
await p.getByRole('button', { name: 'حذف العملية' }).first().click(); await p.getByRole('button', { name: 'تأكيد' }).click();
await p.getByRole('navigation').getByText('الرئيسية', { exact: true }).click(); await p.waitForTimeout(200);
check('النسبة المتبقية', 'تحديث فوري بعد حذف العملية (عودة إلى 75٪)', (await chipOf(p, 'بنزين السيارة').innerText()).includes('75٪'));
await p.screenshot({ path: `${OUT}/v3-home.png`, fullPage: true });

console.log('3) الدخل الإضافي');
await p.getByRole('button', { name: 'تعديل مبلغ الراتب' }).click(); await p.fill('#salary-input', '760.125'); await p.getByRole('button', { name: 'حفظ الراتب' }).click(); await p.waitForTimeout(150);
check('الدخل', 'تعديل الراتب الأساسي بثلاث منازل', month(await store(p), 'cur').salary === 760.125);
await p.getByRole('button', { name: 'تعديل مبلغ الراتب' }).click(); await p.fill('#salary-input', '760'); await p.getByRole('button', { name: 'حفظ الراتب' }).click(); await p.waitForTimeout(150);
await p.getByRole('button', { name: 'إدارة الدخل الإضافي' }).click(); await p.waitForTimeout(300);
const add = async (name, amount, opts = {}) => {
  if (opts.pill) await p.getByRole('dialog').getByRole('button', { name, exact: true }).click(); else await p.fill('#inc-name', name);
  await p.fill('#inc-amount', amount);
  if (opts.note) await p.fill('#inc-note', opts.note);
  if (opts.recurring) await p.locator('#inc-rec').check();
  await p.getByRole('button', { name: 'إضافة الدخل' }).click(); await p.waitForTimeout(120);
};
await add('مكافأة', '100', { pill: true, note: 'أداء' });
await add('دخل آخر', '50', { recurring: true });
await add('مبلغ مسترد', '0.125');
s = await store(p);
check('الدخل', 'ثلاث مدخلات محفوظة في الشهر الحالي فقط', month(s, 'cur').incomes.length === 3 && month(s, 'prev').incomes.length === 0);
check('الدخل', 'الراتب الأساسي لم يتغير', month(s, 'cur').salary === 760);
check('الدخل', 'الإجمالي 150.125 بثلاث منازل', (await p.getByRole('dialog').innerText()).includes('150.125'));
// تعديل ثم حذف
await p.getByRole('button', { name: 'تعديل مبلغ مسترد' }).click(); await p.fill('#inc-amount', '0.375'); await p.getByRole('button', { name: 'حفظ التعديل' }).click(); await p.waitForTimeout(120);
check('الدخل', 'تعديل مدخل', month(await store(p), 'cur').incomes.find((i) => i.name === 'مبلغ مسترد').amount === 0.375);
await p.getByRole('button', { name: 'حذف مبلغ مسترد' }).click(); await p.getByRole('button', { name: 'تأكيد الحذف' }).click(); await p.waitForTimeout(120);
check('الدخل', 'حذف مدخل', month(await store(p), 'cur').incomes.length === 2);
await p.fill('#inc-name', 'خطأ'); await p.fill('#inc-amount', '-5'); await p.getByRole('button', { name: 'إضافة الدخل' }).click();
check('الدخل', 'رفض مبلغ غير صالح', await p.getByText('أدخل مبلغاً أكبر من صفر.').isVisible() && month(await store(p), 'cur').incomes.length === 2);
await p.screenshot({ path: `${OUT}/v3-income.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
let h = await hero(p);
// 760 + 150 = 910 − 297.5 = 612.5
check('الدخل', 'إجمالي الدخل 910 والرصيد 612.5', h.includes('إجمالي الدخل 910') && h.includes('612.50'), h);
// المتبقي بعد المخصصات: 910 − Σmax(مخصص، مصروف) = 910 − (120+30+80+100+40+25+10+7.5) = 497.5
check('الدخل', 'المتبقي بعد المخصصات منفصل (497.5) دون خصم مزدوج', h.includes('المتبقي بعد المخصصات 497.5'), h);

console.log('4) إدارة البنود والفئات');
await p.getByRole('button', { name: 'إدارة الفئات' }).click(); await p.waitForTimeout(300);
const dlg = p.getByRole('dialog', { name: 'إدارة الفئات' });
await dlg.getByRole('button', { name: /إدارة بنود الفئة/ }).nth(1).click();
await dlg.getByRole('button', { name: 'تغيير اسم بند ترفيه' }).click();
await p.fill('#it-name-fun', 'ترفيه وسينما'); await dlg.getByRole('button', { name: 'حفظ اسم البند' }).click(); await p.waitForTimeout(100);
await dlg.getByRole('button', { name: 'رفع بند الدوبي' }).click(); await p.waitForTimeout(100);
await p.fill('#add-it-daily', 'قهوة'); await dlg.getByLabel('مخصص البند الجديد').fill('12'); await dlg.getByRole('button', { name: 'إضافة البند' }).click(); await p.waitForTimeout(100);
s = await store(p);
let cur = month(s, 'cur');
check('البنود', 'تغيير اسم بند (والسابق لم يتغير)', cur.categories.find((c) => c.id === 'fun').name === 'ترفيه وسينما' && month(s, 'prev').categories.find((c) => c.id === 'fun').name === 'ترفيه');
check('البنود', 'إعادة ترتيب البنود', cur.categories.filter((c) => c.group === 'daily').map((c) => c.id).join() === 'fuel,food,fun,laundry,gym,' .replace(/,$/, '') || cur.categories.filter((c) => c.group === 'daily').map((c) => c.id).indexOf('laundry') < cur.categories.filter((c) => c.group === 'daily').map((c) => c.id).indexOf('gym'));
check('البنود', 'إضافة بند بمعرّف ثابت فريد', cur.categories.some((c) => c.name === 'قهوة' && /^c/.test(c.id)));
await dlg.getByRole('button', { name: 'حذف بند الأكل والمطاعم' }).click();
check('البنود', 'تحذير: البند له عمليات فسيُؤرشف', (await dlg.innerText()).includes('له 1 عمليات، فسيُؤرشف'));
await dlg.getByRole('button', { name: 'تأكيد الأرشفة' }).click(); await p.waitForTimeout(150);
s = await store(p); cur = month(s, 'cur');
check('البنود', 'البند المؤرشف وعملياته محفوظة', cur.categories.find((c) => c.id === 'food').archived === true && cur.transactions.length === curTx.length);
await dlg.getByRole('button', { name: 'استعادة' }).first().click(); await p.waitForTimeout(100);
check('البنود', 'استعادة البند المؤرشف', !month(await store(p), 'cur').categories.find((c) => c.id === 'food').archived);
// فئة فيها عمليات: أرشفة بدل الحذف
await dlg.getByRole('button', { name: 'حذف طوارئ' }).click();
await dlg.getByRole('button', { name: 'أرشفة الفئة بدلاً من الحذف' }).click(); await p.waitForTimeout(150);
s = await store(p); cur = month(s, 'cur');
check('الفئات', 'أرشفة فئة فيها عمليات دون حذف أي عملية', cur.sections.find((x) => x.id === 'emergency').archived === true && cur.transactions.length === curTx.length);
await dlg.getByRole('button', { name: 'استعادة' }).first().click(); await p.waitForTimeout(100);
check('الفئات', 'استعادة الفئة المؤرشفة', !month(await store(p), 'cur').sections.find((x) => x.id === 'emergency').archived);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);

console.log('5) السحب للحذف');
const swipe = async (name) => {
  const row = p.getByRole('button', { name: `تسجيل مصروف على ${name}` });
  await row.scrollIntoViewIfNeeded();
  const bx = await row.boundingBox();
  await row.evaluate((el, bx) => {
    const mk = (type, x) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: bx.y + 20 }); el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true })); };
    const x0 = bx.x + bx.width - 40; mk('touchstart', x0); for (let i = 1; i <= 8; i++) mk('touchmove', x0 - i * 15); mk('touchend', x0 - 120);
  }, bx);
  await p.waitForTimeout(350);
};
await swipe('قهوة');
await p.getByRole('button', { name: 'حذف', exact: true }).click(); await p.getByRole('button', { name: 'تأكيد حذف البند؟' }).click(); await p.waitForTimeout(150);
check('البنود', 'السحب يحذف بنداً بلا عمليات', !month(await store(p), 'cur').categories.some((c) => c.name === 'قهوة'));
await swipe('ترفيه وسينما');
await p.getByRole('button', { name: 'حذف', exact: true }).click();
check('البنود', 'السحب على بند له عمليات يعرض «أرشفة»', await p.getByRole('button', { name: 'له عمليات: أرشفة؟' }).isVisible());
await p.getByRole('button', { name: 'له عمليات: أرشفة؟' }).click(); await p.waitForTimeout(150);
cur = month(await store(p), 'cur');
check('البنود', 'السحب أرشف البند ولم يحذف عملياته', cur.categories.find((c) => c.id === 'fun').archived === true && cur.transactions.some((t) => t.catId === 'fun'));
h = await hero(p);
check('البنود', 'الأرشفة لا تغيّر الرصيد الفعلي (612.5)', h.includes('612.50'), h);

console.log('6) الألوان');
await p.getByRole('button', { name: 'لون بند بنزين السيارة' }).click(); await p.waitForTimeout(400);
await p.getByRole('radio', { name: 'أزرق داكن' }).click();
await p.getByRole('tab', { name: 'لون التمييز' }).click();
await p.getByRole('radio', { name: 'ذهبي', exact: true }).click();
check('الألوان', 'معاينة مباشرة قبل التطبيق', (await p.getByLabel('معاينة').evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(36, 91, 145)');
await p.getByRole('button', { name: 'تطبيق' }).click(); await p.waitForTimeout(200);
cur = month(await store(p), 'cur');
const fuelCat = cur.categories.find((c) => c.id === 'fuel');
check('الألوان', 'لون خلفية البند ولون التمييز محفوظان', fuelCat.color === '#245B91' && fuelCat.accent === '#FFD54F');
const fuelStyle = await p.getByRole('button', { name: 'تسجيل مصروف على بنزين السيارة' }).locator('xpath=..').evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el.querySelector('span.block')).color }));
check('الألوان', 'تباين تلقائي: نص فاتح على أزرق داكن', fuelStyle.bg === 'rgb(36, 91, 145)' && fuelStyle.ink === 'rgb(248, 250, 252)', JSON.stringify(fuelStyle));
const chipBg = await chipOf(p, 'بنزين السيارة').evaluate((el) => getComputedStyle(el).backgroundColor);
check('الألوان', 'شارة الحالة المالية محايدة ومتميزة عن اللون الزخرفي', chipBg === 'rgb(255, 255, 255)', chipBg);
// HEX مخصص للفئة + استعادة الافتراضي
await p.getByRole('button', { name: 'لون المصاريف اليومية', exact: true }).click(); await p.waitForTimeout(400);
await p.fill('#hex-input', '#ffe0b2');
await p.getByRole('button', { name: 'تطبيق' }).click(); await p.waitForTimeout(150);
check('الألوان', 'لون HEX مخصص للفئة', month(await store(p), 'cur').sections.find((x) => x.id === 'daily').color === '#FFE0B2');
await p.getByRole('button', { name: 'لون الالتزامات الثابتة', exact: true }).click(); await p.waitForTimeout(400);
await p.getByRole('radio', { name: 'وردي', exact: true }).click(); await p.getByRole('button', { name: 'استعادة اللون الافتراضي' }).click();
await p.getByRole('button', { name: 'تطبيق' }).click(); await p.waitForTimeout(150);
check('الألوان', 'استعادة اللون الافتراضي', !month(await store(p), 'cur').sections.find((x) => x.id === 'fixed').color);
await p.reload(); await p.waitForTimeout(300);
const afterReload = await p.getByRole('button', { name: 'تسجيل مصروف على بنزين السيارة' }).locator('xpath=..').evaluate((el) => getComputedStyle(el).backgroundColor);
check('الألوان', 'الألوان باقية بعد إعادة التشغيل', afterReload === 'rgb(36, 91, 145)');
await noHScroll(p, 'الرئيسية الملونة');

console.log('7) تحليل سلوك الإنفاق والمحاكي');
await p.getByRole('navigation').getByText('الأدوات', { exact: true }).click(); await p.waitForTimeout(200);
await p.getByRole('button', { name: /تحليل سلوك الإنفاق/ }).click(); await p.waitForTimeout(300);
let main = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
check('التحليل', 'العنوان الفرعي', main.includes('مساعدك الذكي لتحسين إدارة المصروفات والادخار'));
check('التحليل', 'تنبيه البيانات المحدودة (شهر مكتمل واحد)', main.includes('يوجد شهر مكتمل واحد فقط'));
check('التحليل', 'مؤشرات اللوحة الست', ['إجمالي تجاوز الميزانية', 'فرص التوفير الشهرية', 'فرص التوفير السنوية', 'مستوى الالتزام بالميزانية', 'بنود تحتاج إلى مراجعة', 'اتجاه الإنفاق الشهري'].every((k) => main.includes(k)));
// الأكل تجاوز ميزانيته في الشهر الحالي (100 من 80): التجاوز المؤكد في الشهر الجاري يُعرض بدل الشهر السابق (110)
check('التحليل', 'تجاوز مؤكد في الشهر الجاري: 80 مقابل 100، 25٪، خفض 10 و120 سنوياً', /الميزانية المحددة 80 ر.ع المصروف الفعلي 100 ر.ع تجاوز الميزانية 20 ر.ع نسبة التجاوز 25٪/.test(main) && main.includes('بمقدار 10 ر.ع شهرياً') && main.includes('120 ر.ع سنوياً') && main.includes('حتى الآن'));
check('التحليل', 'أولوية وتصنيف تلقائي للمراجعة', main.includes('أولوية عالية') && main.includes('تصنيف تلقائي — راجِعه'));
await p.getByRole('button', { name: 'كيف حُسبت؟' }).first().click();
check('التحليل', 'شرح طريقة الحساب', (await p.locator('main').innerText()).includes('التجاوز = المصروف 100 − الميزانية 80 = 20'));
// تغيير التصنيف
await p.locator('#kind-food').selectOption('essential'); await p.waitForTimeout(200);
cur = month(await store(p), 'cur');
check('التحليل', 'تغيير تصنيف بند يُحفظ في الشهر الحالي', cur.categories.find((c) => c.id === 'food').kind === 'essential');
main = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
check('التحليل', 'المصروف الأساسي: صياغة لطيفة وسقف 10٪', main.includes('دون المساس بالاحتياجات الأساسية') && main.includes('مصروفات أساسية'));
// المحاكي
const beforeSim = JSON.stringify(await store(p));
await p.getByRole('radio', { name: '15٪' }).click();
const simTxt = (await p.getByText('محاكي التوفير').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').innerText()).replace(/\s+/g, ' ').replace(/,/g, '');
check('المحاكي', 'نتائج 15٪ (المصروف المرن 40 => 6 شهرياً، 72 سنوياً)', simTxt.includes('6 ر.ع') && simTxt.includes('72 ر.ع'), simTxt);
check('المحاكي', 'المحاكاة لا تغيّر البيانات', JSON.stringify(await store(p)) === beforeSim);
await p.getByRole('radio', { name: 'مخصص' }).click(); await p.getByLabel('قيمة الخفض').fill('8'); await p.getByLabel('نوع القيمة').selectOption('amount');
check('المحاكي', 'قيمة مخصصة بالريال', (await p.getByText('محاكي التوفير').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').innerText()).includes('96 ر.ع'));
await p.getByRole('radio', { name: '10٪' }).click();
await p.getByRole('button', { name: 'تطبيق كتعديل على المخصصات…' }).click();
check('المحاكي', 'تأكيد صريح قبل تعديل المخصصات', await p.getByRole('button', { name: 'تأكيد التعديل' }).isVisible() && JSON.stringify(await store(p)) === beforeSim);
await p.getByRole('button', { name: 'تأكيد التعديل' }).click(); await p.waitForTimeout(200);
s = await store(p);
check('المحاكي', 'بعد التأكيد: مخصص البنزين 72 في الشهر الحالي فقط والعمليات كما هي', month(s, 'cur').categories.find((c) => c.id === 'fuel').budget === 72 && month(s, 'prev').categories.find((c) => c.id === 'fuel').budget === 80 && month(s, 'cur').transactions.length === curTx.length);
await p.screenshot({ path: `${OUT}/v3-behavior.png`, fullPage: true });
await noHScroll(p, 'التحليل');

console.log('8) شهر جديد، التنقل بين الأشهر، ومسح الكل');
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.waitForTimeout(300);
await p.getByRole('button', { name: '+ بدء شهر جديد' }).click(); await p.getByRole('button', { name: 'ابدأ الشهر' }).click(); await p.waitForTimeout(300);
s = await store(p);
const nm = month(s, s.activeId);
check('الأشهر', 'الشهر الجديد: الدخل المتكرر فقط', nm.incomes.length === 1 && nm.incomes[0].name === 'دخل آخر' && nm.incomes[0].amount === 50);
check('الأشهر', 'الشهر الجديد يحتفظ بالألوان', nm.categories.find((c) => c.id === 'fuel').color === '#245B91' && nm.sections.find((x) => x.id === 'daily').color === '#FFE0B2');
check('الأشهر', 'الشهر السابق لم يتغير', month(s, 'cur').incomes.length === 2);
await p.getByRole('navigation').getByText('الرئيسية', { exact: true }).click(); await p.waitForTimeout(150);
h = await hero(p);
check('الأشهر', 'الشهر الجديد: راتب 760 + 50 = 810', h.includes('إجمالي الدخل 810'), h);
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: new RegExp(`راتب شهر ${P1}`) }).click(); await p.waitForTimeout(200);
h = await hero(p);
check('الأشهر', 'التنقل إلى شهر قديم يعرض بياناته (760 − 270 = 490)', h.includes('490.00'), h);
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: new RegExp(`راتب شهر ${P}`) }).click(); await p.waitForTimeout(200);
await p.getByRole('tab', { name: 'حسب البطاقة' }).click(); await p.waitForTimeout(150);
check('الأشهر', 'التبديل إلى عرض البطاقات', await p.getByRole('button', { name: /^Apple Pay/ }).first().isVisible());
await p.getByRole('tab', { name: 'حسب الفئة' }).click();
await p.getByRole('navigation').getByText('السجل', { exact: true }).click();
const beforeReset = await store(p);
await p.getByRole('button', { name: 'مسح الكل' }).click(); await p.getByRole('button', { name: 'نعم، امسح الكل' }).click(); await p.waitForTimeout(200);
s = await store(p);
check('الأشهر', '«مسح الكل» يقتصر على الشهر المحدد', month(s, 'cur').transactions.length === 0 && JSON.stringify(month(s, 'prev')) === JSON.stringify(month(beforeReset, 'prev')) && JSON.stringify(month(s, nm.id)) === JSON.stringify(month(beforeReset, nm.id)));
check('الأشهر', '«مسح الكل» يحفظ نسخة تلقائية أولاً', (await p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-snapshots') || '[]')[0]?.reason)) === 'قبل مسح الشهر');

console.log('9) التقارير');
// بيانات جديدة لاختبار التقرير الكامل مع الدخل والتحليل
({ p } = await open('light', { ...v5, months: [mk('prev', P1, prevTx), mk('cur', P, curTx, { incomes: [{ id: 'i1', name: 'مكافأة', amount: 100, date: `${P}-10`, note: '', recurring: false }, { id: 'i2', name: 'بدل سفر', amount: 50, date: `${P}-12`, note: 'مهمة', recurring: true }] })] }));
await p.getByRole('button', { name: 'تصدير / طباعة التقرير' }).click(); await p.waitForTimeout(300);
let rep = (await p.locator('article').innerText()).replace(/\s+/g, ' ').replace(/,/g, '');
check('التقارير', 'الراتب والدخل الإضافي وإجمالي الدخل في التقرير', rep.includes('الراتب الأساسي 760.00') && rep.includes('إجمالي الدخل الإضافي 150.00') && rep.includes('إجمالي الدخل 910.00') && rep.includes('بدل سفر'));
check('التقارير', 'المتبقي والنسبة المتبقية لكل بند', /بنزين السيارة.*80 20 60 75٪/.test(rep) && /الأكل والمطاعم.*80 100 -20 -25٪ \(تجاوز 20\)/.test(rep), rep.slice(0, 400));
check('التقارير', 'التحليل غير مضمّن افتراضياً', !rep.includes('تحليل سلوك الإنفاق'));
await p.locator('#with-analysis').check(); await p.waitForTimeout(200);
rep = (await p.locator('article').innerText()).replace(/\s+/g, ' ');
check('التقارير', 'تضمين التحليل اختيارياً', rep.includes('تحليل سلوك الإنفاق') && rep.includes('الأكل والمطاعم'));
for (const [name, withA] of [['month-analysis', true]]) {
  const dl = p.waitForEvent('download', { timeout: 60000 });
  await p.getByRole('button', { name: 'تحميل / مشاركة كـ PDF' }).click();
  const f = await dl; const fp = `${OUT}/v3-${f.suggestedFilename()}`; await f.saveAs(fp);
  const info = execFileSync('pdfinfo', [fp]).toString();
  check('التقارير', `PDF A4 بتسمية الشهر (${f.suggestedFilename()})`, f.suggestedFilename() === `salary-report-${P}.pdf` && /Page size:\s+595/.test(info));
  const pages = Number(/Pages:\s+(\d+)/.exec(info)[1]);
  execFileSync('pdftoppm', ['-r', '70', '-png', fp, `${OUT}/v3-pdf`]);
  check('التقارير', `PDF يحتوي التحليل (${pages} صفحات)`, pages >= 2 && withA);
}
const dlx = p.waitForEvent('download', { timeout: 30000 });
await p.getByRole('button', { name: 'Excel', exact: true }).click();
const x = await dlx; const xp = `${OUT}/v3-${x.suggestedFilename()}`; await x.saveAs(xp);
const wb = XLSX.read(readFileSync(xp));
const incRows = XLSX.utils.sheet_to_json(wb.Sheets['الدخل الإضافي'], { header: 1 });
const sumRows = XLSX.utils.sheet_to_json(wb.Sheets['الملخص'], { header: 1 });
check('التقارير', 'Excel: ورقة الدخل الإضافي والإجماليات', incRows.length === 4 && incRows[3][2] === 150 && sumRows.some((r) => r[0] === 'إجمالي الدخل' && r[1] === 910));
await p.getByRole('tab', { name: 'تقرير سنوي' }).click(); await p.waitForTimeout(200);
check('التقارير', 'التقرير السنوي يشمل الدخل الإضافي', (await p.locator('article').innerText()).includes('إجمالي الدخل الإضافي'));
await p.keyboard.press('Escape');

console.log('10) الوضع الداكن وعدم الاتصال');
const dk = await open('dark', { ...v5, months: [mk('cur', P, curTx, { categories: cats.map((c) => (c.id === 'fuel' ? { ...c, color: '#EDE4FF' } : c)) })] });
const dcard = await dk.p.locator('.salary-card').evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, c: getComputedStyle(el).color, border: getComputedStyle(el).borderColor }));
check('الواجهة', 'بطاقة الراتب البنفسجية في الوضع الداكن', dcard.bg.includes('rgb(43, 35, 66)') && dcard.c === 'rgb(230, 219, 255)', JSON.stringify(dcard));
const dfuel = await dk.p.getByRole('button', { name: 'تسجيل مصروف على بنزين السيارة' }).locator('xpath=..').evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el.querySelector('span.block')).color }));
check('الواجهة', 'اللون الفاتح يُكيَّف للوضع الداكن بنص فاتح', dfuel.bg !== 'rgb(237, 228, 255)' && dfuel.ink === 'rgb(248, 250, 252)', JSON.stringify(dfuel));
await noHScroll(dk.p, 'الوضع الداكن');
await dk.p.screenshot({ path: `${OUT}/v3-dark.png`, fullPage: true });
const lightLight = await open('light', v5);
const lcard = await lightLight.p.locator('.salary-card').evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, c: getComputedStyle(el).color, border: getComputedStyle(el).borderColor }));
check('الواجهة', 'بطاقة الراتب: #F0E8FF → #EDE4FF، نص #4C347C، إطار #CBB7F0', lcard.bg.includes('rgb(240, 232, 255)') && lcard.bg.includes('rgb(237, 228, 255)') && lcard.c === 'rgb(76, 52, 124)' && lcard.border === 'rgb(203, 183, 240)', JSON.stringify(lcard));
// عدم الاتصال: حظر كل الطلبات الخارجية
const off = await open('light', v5, { offline: true });
check('الواجهة', 'يعمل دون اتصال', (await off.p.locator('.summary-cards').innerText()).includes('الرصيد الفعلي المتاح'));
for (const w of [320, 375, 430]) {
  await off.p.setViewportSize({ width: w, height: 800 }); await off.p.waitForTimeout(100);
  check('الواجهة', `بلا تمرير أفقي بعرض ${w}`, (await off.p.evaluate(() => document.documentElement.scrollWidth)) <= w);
}
check('الواجهة', 'لا أخطاء في وحدة التحكم', errs.length === 0, errs.join(' | '));

await b.close();
console.log(`\n${passed} نجح، ${failed} فشل`);
const byArea = {};
for (const r of results) { byArea[r.area] = byArea[r.area] || { ok: 0, fail: 0 }; byArea[r.area][r.ok ? 'ok' : 'fail']++; }
console.log('SUMMARY ' + JSON.stringify(byArea));
process.exit(failed ? 1 : 0);
