// اختبار وظيفي للإصدار 3.1: ألوان البطاقتين الرئيسيتين، العد التنازلي للراتب، الترتيب الذكي للبنود
// متصفح معزول ببيانات اختبار وساعة افتراضية؛ لا يلمس بيانات المستخدم.
// التشغيل: npm run build && node tests/e2e-v31.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PALETTE_FLAT, contrast } from '../src/colors.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = process.env.OUT || path.resolve('tests/.out');
mkdirSync(OUT, { recursive: true });
const URL = `file://${path.resolve('index.html')}`;
let failed = 0, passed = 0;
const area = {};
let cur = '';
const check = (name, cond, extra = '') => { area[cur] = area[cur] || { ok: 0, fail: 0 }; area[cur][cond ? 'ok' : 'fail']++; if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };
const section = (t) => { cur = t; console.log(t); };

const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'المصاريف اليومية', color: '#DFF4F1' }, { id: 'temp', name: 'التزامات مؤقتة' }, { id: 'emergency', name: 'طوارئ' }];
const cards = [{ id: 'salary', name: 'حساب الراتب' }, { id: 'applepay', name: 'Apple Pay' }, { id: 'card1', name: 'البطاقة 1' }, { id: 'card2', name: 'البطاقة 2' }];
// مثال الطلب بترتيبه الأصلي
const cats = [
  { id: 'internet', name: 'الإنترنت', group: 'daily', budget: 25, account: 'salary' },
  { id: 'fuel', name: 'البنزين', group: 'daily', budget: 80, account: 'applepay', color: '#245B91' },
  { id: 'rent', name: 'الإيجار', group: 'daily', budget: 150, account: 'salary' },
  { id: 'land', name: 'قرض الأرض', group: 'daily', budget: 300, account: 'salary' },
  { id: 'groc', name: 'المقاضي', group: 'daily', budget: 100, account: 'applepay' },
  { id: 'a1', name: 'بند أ', group: 'daily', budget: 50, account: 'applepay' },
  { id: 'a2', name: 'بند ب', group: 'daily', budget: 50, account: 'applepay' },
  { id: 'over', name: 'مطاعم', group: 'daily', budget: 40, account: 'applepay' },
];
let n = 0;
const tx = (catId, amount, date) => ({ id: `t${n++}`, catId, amount, date, note: '', account: 'applepay', created: n });
const P = '2026-11', P1 = '2026-10';
const curTx = [tx('internet', 25, `${P}-01`), tx('fuel', 20, `${P}-02`), tx('rent', 150, `${P}-01`), tx('land', 150, `${P}-01`), tx('groc', 40, `${P}-03`), tx('a1', 10, `${P}-03`), tx('a2', 10, `${P}-03`), tx('over', 55, `${P}-04`)];
const mk = (id, period, txs, extra = {}) => ({ id, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, carryFromId: null, incomes: [], sections, cards, categories: cats, transactions: txs, ...extra });
const seed = { schemaVersion: 6, debts: [], goals: [], activeId: 'cur', months: [mk('prev', P1, [tx('rent', 150, `${P1}-01`)]), mk('cur', P, curTx)] };

const b = await chromium.launch();
const errs = [];
// time: لحظة زمنية تُثبَّت بها الساعة (ساعة افتراضية)، tz: المنطقة الزمنية للجهاز
async function open({ scheme = 'light', data = seed, time = '2026-11-25T10:00:00+04:00', tz = 'Asia/Muscat', offline = false, keep = false } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, colorScheme: scheme, timezoneId: tz, offline });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.clock.install({ time: new Date(time) });
  await p.goto(URL);
  if (!keep) await p.evaluate((v) => { localStorage.clear(); sessionStorage.clear(); if (v) localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(v)); }, data);
  await p.reload(); await p.clock.runFor(500);
  return p;
}
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')));
const countdown = async (p) => (await p.locator('.countdown-card').innerText()).replace(/\s+/g, ' ');
const order = (p) => p.locator('[aria-label^="تسجيل مصروف على "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('تسجيل مصروف على ', '')));
const rgbOf = (s) => { const m = s.match(/\d+(\.\d+)?/g).map(Number); return `#${m.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`; };

// ================= 1) ألوان البطاقتين =================
section('1) ألوان البطاقتين الرئيسيتين');
let p = await open();
const cardCss = (sel) => p.locator(sel).evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, bgc: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el).color }));
let bal = await cardCss('.balance-card'), sal = await cardCss('.salary-card');
check('الافتراضي البنفسجي الفاتح (#EDE4FF) للبطاقتين', bal.bg.includes('rgb(237, 228, 255)') && sal.bg.includes('rgb(237, 228, 255)') && bal.ink === 'rgb(76, 52, 124)');
await p.getByRole('button', { name: 'لون بطاقة الرصيد المتبقي' }).click(); await p.clock.runFor(400);
check('منتقي الألوان: 36 لوناً', (await p.getByRole('dialog').getByRole('radio').count()) === 36);
check('لا خيار نطاق شهري (إعداد عام)', !(await p.getByRole('dialog').innerText()).includes('أين يُطبَّق التعديل'));
await p.getByRole('radio', { name: 'عنابي' }).click();
const prev = await p.getByLabel('معاينة').evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el).color }));
check('معاينة مباشرة بالعنابي ونص فاتح', prev.bg === 'rgb(155, 48, 48)' && prev.ink === 'rgb(248, 250, 252)', JSON.stringify(prev));
await p.getByRole('button', { name: 'تطبيق' }).click(); await p.clock.runFor(300);
await p.getByRole('button', { name: 'لون بطاقة الراتب الأساسي' }).click(); await p.clock.runFor(400);
await p.fill('#hex-input', '#90caf9');
await p.getByRole('button', { name: 'تطبيق' }).click(); await p.clock.runFor(300);
let st = await store(p);
check('حفظ مستقل لكل بطاقة', st.settings.cardColors.balance === '#9B3030' && st.settings.cardColors.salary === '#90CAF9');
bal = await cardCss('.balance-card'); sal = await cardCss('.salary-card');
check('بطاقتان بلونين مستقلين', bal.bg.includes('rgb(155, 48, 48)') && sal.bg.includes('rgb(144, 202, 249)'), JSON.stringify({ bal, sal }));
check('تباين النص تلقائياً (فاتح على العنابي، داكن على الأزرق)', bal.ink === 'rgb(248, 250, 252)' && sal.ink === 'rgb(30, 41, 59)');
check('تعديل الراتب ما زال يعمل', await p.getByRole('button', { name: 'تعديل مبلغ الراتب' }).isVisible());
await p.reload(); await p.clock.runFor(400);
check('الألوان باقية بعد إعادة التشغيل', (await cardCss('.balance-card')).bg.includes('rgb(155, 48, 48)'));
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-10/ }).click(); await p.clock.runFor(300);
check('الألوان ثابتة عند تغيير الشهر (إعداد عام)', (await cardCss('.balance-card')).bg.includes('rgb(155, 48, 48)') && (await cardCss('.salary-card')).bg.includes('rgb(144, 202, 249)'));
// إظهار العجز على لون أحمر داكن: بيانات مصروفها يتجاوز الدخل
p = await open({ data: { ...seed, settings: { cardColors: { balance: '#9B3030', salary: null }, payDay: 23, sortModes: {} }, months: [mk('cur', P, [...curTx, tx('rent', 400, `${P}-05`)])] } });
const neg = await p.locator('.balance-card .text-bad').first().evaluate((el) => ({ c: getComputedStyle(el).color, bg: getComputedStyle(el.closest('span.inline-block') || el.parentElement).backgroundColor }));
check('العجز يظهر أحمر على شارة محايدة فوق البطاقة الحمراء', neg.c === 'rgb(220, 38, 38)' && neg.bg === 'rgb(255, 255, 255)', JSON.stringify(neg));
check('شارة تحذير العجز ظاهرة', await p.getByText(/عجز: المصروف تجاوز إجمالي الدخل/).isVisible());
// استعادة الافتراضي
await p.getByRole('button', { name: 'لون بطاقة الرصيد المتبقي' }).click(); await p.clock.runFor(400);
await p.getByRole('button', { name: 'استعادة اللون الافتراضي' }).click();
await p.getByRole('button', { name: 'تطبيق' }).click(); await p.clock.runFor(300);
check('استعادة اللون الافتراضي', (await store(p)).settings.cardColors.balance === null && (await cardCss('.balance-card')).bg.includes('rgb(237, 228, 255)'));
await p.screenshot({ path: `${OUT}/v31-deficit.png` });
// كل الألوان الـ 36 في الوضعين: تباين نص البطاقتين المحسوب فعلياً
for (const scheme of ['light', 'dark']) {
  const q = await open({ scheme });
  let worst = 99, worstHex = '';
  for (const { hex } of PALETTE_FLAT) {
    await q.evaluate((h) => { const s = JSON.parse(localStorage.getItem('salary-tracker-omr-v4')); s.settings = { ...s.settings, cardColors: { balance: h, salary: h } }; localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(s)); }, hex);
    await q.reload(); await q.clock.runFor(150);
    for (const sel of ['.balance-card', '.salary-card']) {
      const c = await q.locator(sel).evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage.match(/rgb\([^)]*\)/)[0], ink: getComputedStyle(el).color }));
      const r = contrast(rgbOf(c.bg), rgbOf(c.ink));
      if (r < worst) { worst = r; worstHex = hex; }
    }
  }
  check(`الألوان الـ 36 على البطاقتين (${scheme === 'dark' ? 'داكن' : 'فاتح'}): أقل تباين ${worst.toFixed(2)}:1`, worst >= 4.5, worstHex);
  await q.context().close();
}

// ================= 2) العد التنازلي =================
section('2) العد التنازلي للراتب');
const cases = [
  ['قبل يوم 23', '2026-11-05T10:00:00+04:00', ['18 يوماً متبقياً', '23 نوفمبر 2026', '23 أكتوبر 2026']],
  ['يوم 23', '2026-11-23T08:00:00+04:00', ['اليوم موعد الراتب', '23 نوفمبر 2026', '23 أكتوبر 2026']],
  ['بعد يوم 23 (مثال الطلب)', '2026-11-25T10:00:00+04:00', ['28 يوماً متبقياً', '23 ديسمبر 2026', '23 نوفمبر 2026']],
  ['نوفمبر إلى ديسمبر', '2026-11-30T22:00:00+04:00', ['23 يوماً متبقياً', '23 ديسمبر 2026']],
  ['ديسمبر إلى يناير', '2026-12-24T09:00:00+04:00', ['30 يوماً متبقياً', '23 يناير 2027', '23 ديسمبر 2026']],
  ['يوم واحد', '2027-01-22T09:00:00+04:00', ['يوم واحد متبقٍ']],
  ['يومان', '2027-01-21T09:00:00+04:00', ['يومان متبقيان']],
  ['فبراير في سنة كبيسة', '2028-02-24T09:00:00+04:00', ['28 يوماً متبقياً', '23 مارس 2028', '23 فبراير 2028']],
];
for (const [name, time, exp] of cases) {
  const q = await open({ time });
  const t = await countdown(q);
  check(name, exp.every((e) => t.includes(e)), t);
  await q.context().close();
}
// منطقة الجهاز مختلفة: الحساب بتوقيت مسقط
let q = await open({ time: '2026-11-22T20:30:00Z', tz: 'America/Los_Angeles' });
check('توقيت مسقط ولو كانت منطقة الجهاز مختلفة (لوس أنجلوس 22 نوفمبر = مسقط 23)', (await countdown(q)).includes('اليوم موعد الراتب'));
await q.context().close();
// منتصف الليل والتطبيق مفتوح
q = await open({ time: '2026-11-22T23:58:00+04:00' });
check('قبل منتصف الليل: يوم واحد', (await countdown(q)).includes('يوم واحد متبقٍ'));
await q.clock.runFor('00:03:00');
check('تحديث تلقائي عند منتصف الليل في مسقط', (await countdown(q)).includes('اليوم موعد الراتب'));
// العودة للتطبيق بعد مدة (دون تشغيل المؤقتات)
await q.clock.setSystemTime(new Date('2026-11-26T09:00:00+04:00'));
await q.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await q.clock.runFor(100);
check('تحديث عند استئناف التطبيق', (await countdown(q)).includes('27 يوماً متبقياً'));
const before = JSON.stringify(await store(q));
check('بلوغ الصفر لم يضف أي عملية أو يغيّر البيانات', JSON.stringify(await store(q)) === before && (await store(q)).months.find((m) => m.id === 'cur').transactions.length === curTx.length);
// الاستقلال عن الشهر المالي المعروض
await q.getByRole('button', { name: /تغيير الشهر/ }).click(); await q.getByRole('radio', { name: /راتب شهر 2026-10/ }).click(); await q.clock.runFor(200);
check('مستقل عن الشهر المالي المحدد', (await countdown(q)).includes('27 يوماً متبقياً'));
await q.context().close();
// يوم صرف مخصص من الإعدادات
q = await open({ time: '2026-11-25T10:00:00+04:00' });
await q.getByRole('navigation').getByText('الأدوات', { exact: true }).click(); await q.clock.runFor(200);
await q.getByRole('button', { name: /إعدادات الراتب والمظهر/ }).click(); await q.clock.runFor(200);
check('حقل «يوم صرف الراتب» بقيمة 23', (await q.locator('#set-pay-day').inputValue()) === '23');
await q.fill('#set-pay-day', '31'); await q.getByRole('button', { name: 'حفظ', exact: true }).click(); await q.clock.runFor(200);
await q.getByRole('navigation').getByText('الرئيسية', { exact: true }).click(); await q.clock.runFor(200);
check('يوم 31 في نوفمبر = آخر يوم (30 نوفمبر)', (await countdown(q)).includes('30 نوفمبر 2026') && (await countdown(q)).includes('5 أيام متبقية'));
await q.getByRole('button', { name: 'يوم صرف الراتب' }).click(); await q.clock.runFor(300);
await q.fill('#pay-day', '0'); await q.getByRole('button', { name: 'حفظ', exact: true }).click();
check('رفض يوم غير صالح', await q.getByText('أدخل يوماً بين 1 و31.').isVisible());
await q.fill('#pay-day', '1'); await q.getByRole('button', { name: 'حفظ', exact: true }).click(); await q.clock.runFor(200);
check('يوم صرف مخصص (1) يُحفظ ويُطبَّق', (await store(q)).settings.payDay === 1 && (await countdown(q)).includes('1 ديسمبر 2026'));
await q.context().close();
q = await open({ offline: true });
check('يعمل دون اتصال', (await countdown(q)).includes('28 يوماً متبقياً'));
await q.context().close();

// ================= 3) الترتيب الذكي =================
section('3) الترتيب الذكي للبنود');
p = await open();
const manualBefore = (await store(p)).months.find((m) => m.id === 'cur').categories.map((c) => c.id).join();
check('مثال الطلب: المستحقة بالمخصص تنازلياً، ثم المتجاوزة، ثم المكتملة', (await order(p)).join('،') === 'قرض الأرض،المقاضي،البنزين،بند أ،بند ب،مطاعم،الإيجار،الإنترنت', (await order(p)).join('،'));
check('المخصص المتساوي يحافظ على الترتيب الأصلي (بند أ قبل بند ب)', (await order(p)).indexOf('بند أ') < (await order(p)).indexOf('بند ب'));
check('فواصل «متجاوزة للميزانية» و«مكتملة»', await p.getByText('متجاوزة للميزانية', { exact: true }).isVisible() && await p.getByText('مكتملة', { exact: true }).first().isVisible());
check('تحذير التجاوز على البند المتجاوز', (await p.getByRole('button', { name: 'تسجيل مصروف على مطاعم' }).innerText()).includes('تجاوز الميزانية'));
check('شارة «مكتمل» على البنود المسددة', (await p.getByRole('button', { name: 'تسجيل مصروف على الإيجار' }).innerText()).includes('مكتمل'));
// دفعة تكمل المقاضي => تنتقل للمكتملة
await p.getByRole('button', { name: 'تسجيل مصروف على المقاضي' }).click(); await p.clock.runFor(400);
await p.fill('#f-amount', '60'); await p.getByRole('button', { name: 'حفظ وخصم المبلغ' }).click(); await p.clock.runFor(300);
let o = await order(p);
check('اكتمال الدفع ينقل البند للمكتملة (بالمخصص تنازلياً)', o.indexOf('مطاعم') < o.indexOf('الإيجار') && o.indexOf('الإيجار') < o.indexOf('المقاضي') && o.indexOf('المقاضي') < o.indexOf('الإنترنت'), o.join('،'));
// حذف الدفعة => يعود للمستحقة
await p.getByRole('navigation').getByText('السجل', { exact: true }).click(); await p.clock.runFor(200);
await p.getByRole('button', { name: 'حذف العملية' }).first().click(); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.clock.runFor(200);
await p.getByRole('navigation').getByText('الرئيسية', { exact: true }).click(); await p.clock.runFor(200);
o = await order(p);
check('حذف الدفعة يعيد البند للمستحقة', o.indexOf('المقاضي') === 1, o.join('،'));
// تغيير المخصص يعيد الترتيب
await p.getByRole('button', { name: 'تعديل البنزين' }).click(); await p.clock.runFor(300);
await p.fill('#i-budget', '500'); await p.getByRole('button', { name: 'حفظ التعديلات' }).click(); await p.clock.runFor(300);
check('تغيير المخصص يعيد الترتيب فوراً (البنزين أولاً)', (await order(p))[0] === 'البنزين');
// إضافة بند جديد مستحق بمخصص كبير
await p.getByRole('button', { name: 'إضافة بند' }).first().click(); await p.clock.runFor(300);
await p.fill('#i-name', 'سفر'); await p.fill('#i-budget', '200'); await p.getByRole('button', { name: 'إضافة البند' }).click(); await p.clock.runFor(300);
o = await order(p);
check('البند الجديد في موضعه الصحيح', o.indexOf('سفر') === 2, o.join('،'));
// الأنماط الأخرى
await p.locator('#sort-daily').selectOption('budget'); await p.clock.runFor(200);
check('المخصص: الأعلى أولاً', (await order(p)).slice(0, 3).join('،') === 'البنزين،قرض الأرض،سفر');
await p.locator('#sort-daily').selectOption('remaining'); await p.clock.runFor(200);
check('المتبقي: الأعلى أولاً', (await order(p)).slice(0, 2).join('،') === 'البنزين،سفر');
await p.locator('#sort-daily').selectOption('manual'); await p.clock.runFor(200);
check('الترتيب اليدوي = الترتيب المحفوظ', (await order(p)).slice(0, 3).join('،') === 'الإنترنت،البنزين،الإيجار');
st = await store(p);
check('الترتيب يُحفظ لكل فئة كإعداد عرض', st.settings.sortModes.daily === 'manual');
check('الترتيب لا يغيّر المعرّفات ولا الترتيب اليدوي المحفوظ', st.months.find((m) => m.id === 'cur').categories.map((c) => c.id).join() === `${manualBefore},${st.months.find((m) => m.id === 'cur').categories.at(-1).id}`);
// الترتيب اليدوي من إدارة الفئات ما زال يعمل
await p.getByRole('button', { name: 'إدارة الفئات' }).click(); await p.clock.runFor(300);
const dlg = p.getByRole('dialog', { name: 'إدارة الفئات' });
await dlg.getByRole('button', { name: /إدارة بنود الفئة/ }).nth(1).click();
await dlg.getByRole('button', { name: 'رفع بند البنزين' }).click(); await p.clock.runFor(150);
await p.keyboard.press('Escape'); await p.clock.runFor(200);
check('إعادة الترتيب اليدوي متاحة ومنعكسة', (await order(p))[0] === 'البنزين');
await p.locator('#sort-daily').selectOption('smart'); await p.clock.runFor(200);
// الألوان لم تتغير مع الترتيب
const fuelBg = await p.getByRole('button', { name: 'تسجيل مصروف على البنزين' }).locator('xpath=..').evaluate((el) => getComputedStyle(el).backgroundColor);
check('لون البند يبقى مع البند بعد الترتيب', fuelBg === 'rgb(36, 91, 145)');
const secBg = await p.getByRole('button', { name: 'لون المصاريف اليومية', exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').evaluate((el) => getComputedStyle(el).backgroundColor);
check('لون الفئة لم يتغير', secBg === 'rgb(223, 244, 241)');
// تغيير الشهر لا يغيّر البيانات التاريخية
const prevBefore = JSON.stringify((await store(p)).months.find((m) => m.id === 'prev'));
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-10/ }).click(); await p.clock.runFor(300);
check('عرض شهر آخر مرتباً دون تغيير بياناته', (await order(p)).length === 8 && JSON.stringify((await store(p)).months.find((m) => m.id === 'prev')) === prevBefore);
// السحب للحذف ما زال يعمل مع الترتيب
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-11/ }).click(); await p.clock.runFor(300);
const row = p.getByRole('button', { name: 'تسجيل مصروف على سفر' });
await row.scrollIntoViewIfNeeded();
const bx = await row.boundingBox();
await row.evaluate((el, bx) => {
  const mkT = (type, x) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: bx.y + 20 }); el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true })); };
  const x0 = bx.x + bx.width - 40; mkT('touchstart', x0); for (let i = 1; i <= 8; i++) mkT('touchmove', x0 - i * 15); mkT('touchend', x0 - 120);
}, bx);
await p.clock.runFor(400);
await p.getByRole('button', { name: 'حذف', exact: true }).click(); await p.getByRole('button', { name: 'تأكيد حذف البند؟' }).click(); await p.clock.runFor(200);
check('السحب للحذف يعمل مع الترتيب الذكي', !(await order(p)).includes('سفر'));
await p.screenshot({ path: `${OUT}/v31-sorted.png`, fullPage: true });
for (const w of [320, 375, 430]) { await p.setViewportSize({ width: w, height: 800 }); await p.clock.runFor(100); check(`بلا تمرير أفقي بعرض ${w}`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= w); }
const pd = await open({ scheme: 'dark' });
await pd.screenshot({ path: `${OUT}/v31-dark.png`, fullPage: true });
check('الوضع الداكن بلا تمرير أفقي', (await pd.evaluate(() => document.documentElement.scrollWidth)) <= 390);

section('4) عام');
check('لا أخطاء في وحدة التحكم', errs.length === 0, errs.join(' | '));
await b.close();
console.log(`\n${passed} نجح، ${failed} فشل`);
console.log('SUMMARY ' + JSON.stringify(area));
process.exit(failed ? 1 : 0);
