// اختبار وظيفي للإصدار 3.2: إدارة الراتب والدخل في الأدوات، العداد المضغوط في الترويسة، حد التنبيه للمصروف الفعلي
// متصفح معزول ببيانات اختبار وساعة افتراضية؛ لا يلمس بيانات المستخدم.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = process.env.OUT || path.resolve('tests/.out');
mkdirSync(OUT, { recursive: true });
const URL = `file://${path.resolve('index.html')}`;
let failed = 0, passed = 0;
const area = {}; let cur = '';
const check = (name, cond, extra = '') => { area[cur] = area[cur] || { ok: 0, fail: 0 }; area[cur][cond ? 'ok' : 'fail']++; if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };
const section = (t) => { cur = t; console.log(t); };

const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'المصاريف اليومية' }, { id: 'temp', name: 'مؤقتة' }, { id: 'emergency', name: 'طوارئ' }];
const cards = [{ id: 'salary', name: 'حساب الراتب' }, { id: 'applepay', name: 'Apple Pay' }, { id: 'card1', name: 'البطاقة 1' }, { id: 'card2', name: 'البطاقة 2' }];
const cats = [
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 300, account: 'salary' },
  { id: 'food', name: 'أكل', group: 'daily', budget: 400, account: 'applepay' },
];
let n = 0;
const tx = (catId, amount, date = '2026-11-02') => ({ id: `t${n++}`, catId, amount, date, note: '', account: 'applepay', created: n });
const mk = (id, period, txs, extra = {}) => ({ id, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, carryFromId: null, incomes: [], sections, cards, categories: cats, transactions: txs, ...extra });
const storeWith = (txs, extra = {}) => ({ schemaVersion: 6, debts: [], goals: [], activeId: 'cur', months: [mk('prev', '2026-10', [tx('rent', 300, '2026-10-01')]), mk('cur', '2026-11', txs)], ...extra });

const b = await chromium.launch();
const errs = [];
async function open({ data, time = '2026-11-25T10:00:00+04:00', scheme = 'light', offline = false, width } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], ...(width ? { viewport: { width, height: 800 } } : {}), deviceScaleFactor: 1, colorScheme: scheme, timezoneId: 'Asia/Muscat', offline });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.clock.install({ time: new Date(time) });
  await p.goto(URL);
  await p.evaluate((v) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(v)); }, data || storeWith([tx('rent', 300)]));
  await p.reload(); await p.clock.runFor(600);
  return p;
}
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')));
const month = (s, id) => s.months.find((m) => m.id === id);
const summary = async (p) => (await p.locator('.summary-cards').innerText()).replace(/\s+/g, ' ').replace(/,/g, '');
const nav = async (p, t) => { await p.getByRole('navigation').getByText(t, { exact: true }).click(); await p.clock.runFor(250); };
const spend = (p) => p.locator('.spend-tile').evaluate((el) => ({
  over: el.dataset.over === 'true', text: el.innerText.replace(/\s+/g, ' ').replace(/,/g, ''),
  color: getComputedStyle(el.querySelector('dd')).color, inner: el.querySelector('dd span') ? getComputedStyle(el.querySelector('dd span')).color : null,
  icon: !!el.querySelector('svg'),
  bar: getComputedStyle(el.closest('section').querySelector('.h-1\\.5 > div')).backgroundColor,
}));

// ================= 1) إدارة الراتب والدخل =================
section('1) إدارة الراتب والدخل في الأدوات');
let p = await open();
const prevAtStart = JSON.stringify(month(await store(p), 'prev'));
check('الصفحة الرئيسية بلا أدوات تعديل الراتب والدخل', (await p.getByRole('button', { name: 'تعديل مبلغ الراتب' }).count()) === 0 && (await p.getByRole('button', { name: 'إدارة الدخل الإضافي' }).count()) === 0);
check('بطاقتا الملخص ظاهرتان مع أدوات الألوان', await p.locator('.balance-card').isVisible() && await p.locator('.salary-card').isVisible() && await p.getByRole('button', { name: 'لون بطاقة الراتب الأساسي' }).isVisible());
await nav(p, 'الأدوات');
check('قسم «إدارة الراتب والدخل» في الأدوات', await p.getByRole('button', { name: /إدارة الراتب والدخل/ }).isVisible());
await p.getByRole('button', { name: /إدارة الراتب والدخل/ }).click(); await p.clock.runFor(300);
check('عنوان القسم', await p.getByRole('heading', { name: 'إدارة الراتب والدخل' }).isVisible());
await p.fill('#salary-input', '800'); await p.getByRole('button', { name: 'حفظ الراتب' }).click(); await p.clock.runFor(150);
const addInc = async (name, amount, note = '') => { await p.fill('#inc-name', name); await p.fill('#inc-amount', amount); if (note) await p.fill('#inc-note', note); await p.getByRole('button', { name: 'إضافة الدخل' }).click(); await p.clock.runFor(150); };
await addInc('مكافأة', '100', 'أداء');
await addInc('بدل سفر', '50.125');
let main = (await p.locator('main').innerText()).replace(/\s+/g, ' ').replace(/,/g, '');
check('عرض تفاصيل الدخل وإجمالياته (150.125 و950.125)', main.includes('مكافأة') && main.includes('أداء') && main.includes('150.125') && main.includes('950.125'), main.slice(0, 300));
await p.getByRole('button', { name: 'تعديل بدل سفر' }).click(); await p.fill('#inc-amount', '60'); await p.getByRole('button', { name: 'حفظ التعديل' }).click(); await p.clock.runFor(150);
check('تعديل مدخل دخل', month(await store(p), 'cur').incomes.find((i) => i.name === 'بدل سفر').amount === 60);
await p.getByRole('button', { name: 'حذف مكافأة' }).click(); await p.getByRole('button', { name: 'تأكيد الحذف' }).click(); await p.clock.runFor(150);
let s = await store(p);
check('حذف مدخل دخل', month(s, 'cur').incomes.length === 1);
check('الراتب الأساسي مستقل ومحفوظ للشهر الحالي فقط', month(s, 'cur').salary === 800 && month(s, 'prev').salary === 760 && month(s, 'prev').incomes.length === 0);
await nav(p, 'الرئيسية');
let sm = await summary(p);
check('تحديث فوري للصفحة الرئيسية (800 + 60 = 860، الرصيد 560)', sm.includes('الراتب الأساسي 800') && sm.includes('إجمالي الدخل 860') && sm.includes('560.00'), sm);
await p.getByRole('button', { name: 'تصدير / طباعة التقرير' }).click(); await p.clock.runFor(300);
const rep = (await p.locator('article').innerText()).replace(/\s+/g, ' ').replace(/,/g, '');
check('التقرير يعكس التعديلات فوراً', rep.includes('الراتب الأساسي 800.00') && rep.includes('إجمالي الدخل 860.00') && rep.includes('بدل سفر'));
await p.keyboard.press('Escape'); await p.clock.runFor(200);
await p.getByRole('button', { name: 'إدارة ←' }).click(); await p.clock.runFor(300);
check('رابط «إدارة» في بطاقة الراتب يفتح القسم مباشرة', await p.getByRole('heading', { name: 'إدارة الراتب والدخل' }).isVisible());
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-10/ }).click(); await p.clock.runFor(300);
check('تبديل الشهر يعرض راتب ودخل ذلك الشهر', (await p.locator('#salary-input').inputValue()) === '760' && (await p.locator('main').innerText()).includes('لا يوجد دخل إضافي لهذا الشهر'));
check('البيانات التاريخية محفوظة', JSON.stringify(month(await store(p), 'prev')) === prevAtStart);
await p.context().close();

// ================= 2) العداد المضغوط =================
section('2) العداد المضغوط في الترويسة');
const hc = async (p) => (await p.locator('header .header-countdown').innerText()).replace(/\s+/g, ' ').trim();
for (const [name, time, exp] of [
  ['قبل يوم 23', '2026-11-05T10:00:00+04:00', '18 يوم للراتب'],
  ['يوم 23', '2026-11-23T08:00:00+04:00', '0 اليوم'],
  ['بعد يوم 23', '2026-11-25T10:00:00+04:00', '28 يوم للراتب'],
  ['نوفمبر إلى ديسمبر', '2026-11-30T22:00:00+04:00', '23 يوم للراتب'],
  ['ديسمبر إلى يناير', '2026-12-24T09:00:00+04:00', '30 يوم للراتب'],
]) {
  const q = await open({ time });
  check(`${name}: «${exp}»`, (await hc(q)) === exp, await hc(q));
  await q.context().close();
}
p = await open();
check('أُزيلت بطاقة العد التنازلي الكبيرة', (await p.locator('.countdown-card').count()) === 0 && !(await p.locator('main').innerText()).includes('آخر موعد راتب مجدول'));
const hdr = await p.locator('header').evaluate((h) => {
  const box = h.querySelector('.header-countdown').getBoundingClientRect();
  const exp = [...h.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'تصدير / طباعة التقرير').getBoundingClientRect();
  return { gap: Math.round(box.left - exp.right), sameRow: Math.abs(box.top - exp.top) < 2, svg: h.querySelector('.header-countdown svg') != null, bar: h.querySelector('.header-countdown [role=progressbar]') != null };
});
check('بجوار زر تصدير / طباعة مباشرة', hdr.sameRow && hdr.gap >= 0 && hdr.gap <= 12, JSON.stringify(hdr));
check('رقم وتسمية فقط: بلا أيقونة أو شريط تقدم', !hdr.svg && !hdr.bar);
await p.context().close();
for (const w of [320, 375, 390, 430]) {
  const q = await open({ width: w, data: storeWith([tx('rent', 300)], {}) });
  const r = await q.locator('header').evaluate((h) => {
    const lab = h.querySelector('button span.break-words'); const rc = lab.getBoundingClientRect();
    return { clipped: lab.scrollWidth > lab.clientWidth + 1 || rc.left < 0 || rc.right > window.innerWidth, pageW: document.documentElement.scrollWidth, text: lab.textContent };
  });
  check(`عرض ${w}: اسم الشهر كاملاً دون قص، وبلا تمرير أفقي`, !r.clipped && r.pageW <= w && r.text === 'راتب شهر 2026-11', JSON.stringify(r));
  await q.context().close();
}
const qo = await open({ offline: true });
check('يعمل دون اتصال', (await hc(qo)) === '28 يوم للراتب');
await qo.getByRole('button', { name: /تغيير الشهر/ }).click(); await qo.getByRole('radio', { name: /راتب شهر 2026-10/ }).click(); await qo.clock.runFor(300);
check('مستقل عن الشهر المالي المحدد', (await hc(qo)) === '28 يوم للراتب');
await qo.context().close();

// ================= 3) حد التنبيه للمصروف الفعلي =================
section('3) حد التنبيه للمصروف الفعلي');
const RED = 'rgb(220, 38, 38)';
for (const [amt, over, excess] of [[649.999, false], [650, false], [650.001, true, '0.001'], [670, true, '20.000']]) {
  const q = await open({ data: storeWith([tx('rent', 300), tx('food', Math.round((amt - 300) * 1000) / 1000)]) });
  const r = await spend(q);
  const ok = over
    ? r.over && r.inner === RED && r.icon && r.bar === RED && r.text.includes(`تجاوز حد الإنفاق بمقدار ${excess} ر.ع`)
    : !r.over && r.color !== RED && !r.icon && r.bar !== RED && !r.text.includes('تجاوز حد الإنفاق');
  check(`${amt.toFixed(3)} ر.ع: ${over ? `تحذير أحمر، تجاوز ${excess}` : 'مؤشر عادي'}`, ok, JSON.stringify(r));
  if (amt === 670) { check('عرض المبلغ بثلاث منازل (670.000)', r.text.includes('670.000')); await q.screenshot({ path: `${OUT}/v32-over.png`, clip: { x: 0, y: 0, width: 390, height: 520 } }); }
  await q.context().close();
}
p = await open({ data: storeWith([tx('rent', 300), tx('food', 370)]) });
await nav(p, 'الأدوات'); await p.getByRole('button', { name: /إدارة الراتب والدخل/ }).click(); await p.clock.runFor(300);
await p.fill('#inc-name', 'مكافأة كبيرة'); await p.fill('#inc-amount', '500'); await p.getByRole('button', { name: 'إضافة الدخل' }).click(); await p.clock.runFor(150);
await nav(p, 'الرئيسية');
let r = await spend(p);
check('الدخل الإضافي لا يرفع الحد (ما زال تجاوز 20.000)', r.over && r.text.includes('20.000'), r.text);
check('الحد مستقل عن الرصيد (الرصيد موجب والتحذير قائم)', (await summary(p)).includes('590.00') && r.over);
await nav(p, 'السجل');
await p.getByRole('button', { name: 'حذف العملية' }).first().click(); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.clock.runFor(200);
await nav(p, 'الرئيسية');
r = await spend(p);
check('حذف دفعة يحدّث التحذير فوراً (يختفي)', !r.over, r.text);
await p.getByRole('navigation').getByRole('button', { name: 'تسجيل مصروف' }).click(); await p.clock.runFor(300);
await p.selectOption('#f-cat', 'food'); await p.fill('#f-amount', '400.5'); await p.getByRole('button', { name: 'حفظ وخصم المبلغ' }).click(); await p.clock.runFor(300);
r = await spend(p);
check('لا منع للتسجيل فوق الحد، والتحذير يظهر فوراً (تجاوز 50.500)', r.over && r.text.includes('50.500'), r.text);
await nav(p, 'الأدوات'); await p.getByRole('button', { name: 'رجوع للأدوات' }).click(); await p.clock.runFor(150);
await p.getByRole('button', { name: /إعدادات الراتب والمظهر/ }).click(); await p.clock.runFor(300);
check('إعداد «حد التنبيه للمصروف الفعلي» بقيمة 650', (await p.locator('#set-spend-limit').inputValue()) === '650');
await p.fill('#set-spend-limit', '720'); await p.getByRole('button', { name: 'حفظ', exact: true }).nth(1).click(); await p.clock.runFor(150);
await nav(p, 'الرئيسية');
check('رفع الحد يعيد الحساب فوراً (لا تحذير عند 700.5)', !(await spend(p)).over);
await nav(p, 'الأدوات');
await p.fill('#set-spend-limit', '690.25'); await p.getByRole('button', { name: 'حفظ', exact: true }).nth(1).click(); await p.clock.runFor(150);
await nav(p, 'الرئيسية');
r = await spend(p);
check('حد مخصص 690.250 => تجاوز 10.250', r.over && r.text.includes('10.250'), r.text);
await p.reload(); await p.clock.runFor(400);
check('الحد محفوظ بعد إعادة التشغيل', (await store(p)).settings.spendLimit === 690.25 && (await spend(p)).over);
await nav(p, 'الأدوات'); await p.getByRole('button', { name: /إعدادات الراتب والمظهر/ }).click(); await p.clock.runFor(300);
check('القيمة المحفوظة تظهر في الإعداد', (await p.locator('#set-spend-limit').inputValue()) === '690.25');
await p.fill('#set-spend-limit', '-3'); await p.getByRole('button', { name: 'حفظ', exact: true }).nth(1).click();
check('رفض قيمة غير صالحة', await p.getByText('أدخل مبلغاً أكبر من صفر.').isVisible() && (await store(p)).settings.spendLimit === 690.25);
await p.getByRole('button', { name: 'استعادة الحد الافتراضي (650 ر.ع)' }).click(); await p.clock.runFor(150);
await nav(p, 'الرئيسية');
r = await spend(p);
check('استعادة الافتراضي 650 => تجاوز 50.500', (await store(p)).settings.spendLimit === 650 && r.text.includes('50.500'));
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-10/ }).click(); await p.clock.runFor(300);
check('الحد يُطبَّق على مصروف الشهر المحدد (أكتوبر 300: لا تحذير)', !(await spend(p)).over);
await p.context().close();
const pd = await open({ scheme: 'dark', data: storeWith([tx('rent', 300), tx('food', 370)]) });
r = await spend(pd);
const chipBg = await pd.locator('.spend-tile dd span').first().evaluate((el) => getComputedStyle(el).backgroundColor);
check('الوضع الداكن: تحذير بأحمر الوضع الداكن على شارة محايدة داكنة', r.over && r.inner === 'rgb(248, 113, 113)' && chipBg === 'rgb(26, 35, 47)', JSON.stringify({ inner: r.inner, chipBg }));
await pd.screenshot({ path: `${OUT}/v32-dark.png`, clip: { x: 0, y: 0, width: 390, height: 520 } });
await pd.context().close();

section('4) عام');
check('لا أخطاء في وحدة التحكم', errs.length === 0, errs.join(' | '));
await b.close();
console.log(`\n${passed} نجح، ${failed} فشل`);
console.log('SUMMARY ' + JSON.stringify(area));
process.exit(failed ? 1 : 0);
