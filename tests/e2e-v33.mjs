// اختبار وظيفي للإصدار 3.3: تبسيط اللوحة، نقل بطاقتي الراتب والادخار للأدوات، مركز التنبيهات، التحميل المؤجل
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
  { id: 'saving', name: 'الادخار', group: 'fixed', budget: 50, account: 'salary', color: '#E3F5EA' },
  { id: 'food', name: 'أكل', group: 'daily', budget: 400, account: 'applepay' },
];
let n = 0;
const tx = (catId, amount, date = '2026-11-02') => ({ id: `t${n++}`, catId, amount, date, note: '', account: 'applepay', created: n });
const mk = (id, period, txs, extra = {}) => ({ id, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, carryFromId: null, incomes: [], sections, cards, categories: cats, transactions: txs, ...extra });
const storeWith = (txs, extra = {}) => ({ schemaVersion: 6, debts: [], goals: [], activeId: 'cur', settings: { cardColors: { salary: '#245B91', balance: null }, payDay: 23, spendLimit: 650, sortModes: {}, critical: { foodOn: false, fuelOn: false } }, // تنبيهات V3.4 الحرجة تُختبر في e2e-v34
  months: [mk('prev', '2026-10', [tx('rent', 300, '2026-10-01'), tx('food', 600, '2026-10-02')]), mk('cur', '2026-11', txs)], ...extra });

const b = await chromium.launch();
const errs = [];
async function open({ data, time = '2026-11-10T10:00:00+04:00', scheme = 'light', offline = true, width, keep = false } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], ...(width ? { viewport: { width, height: 800 } } : {}), deviceScaleFactor: 1, colorScheme: scheme, timezoneId: 'Asia/Muscat', offline, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.clock.install({ time: new Date(time) });
  await p.goto(URL);
  await p.evaluate((v) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(v)); }, data || storeWith([tx('rent', 300), tx('saving', 30), tx('food', 120)]));
  await p.reload(); await p.clock.runFor(600);
  return p;
}
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')));
const notifStore = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-notifications') || 'null'));
const nav = async (p, t) => { await p.getByRole('navigation').getByText(t, { exact: true }).click(); await p.clock.runFor(250); };
const tool = async (p, name) => { await nav(p, 'الأدوات'); if (await p.getByRole('button', { name: 'رجوع للأدوات' }).count()) { await p.getByRole('button', { name: 'رجوع للأدوات' }).click(); await p.clock.runFor(150); } await p.getByRole('button', { name }).click(); await p.clock.runFor(300); };
const bell = (p) => p.locator('.notif-bell').evaluate((el) => ({ unread: el.dataset.unread === 'true', color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
const curtain = (p) => p.getByRole('dialog', { name: 'التنبيهات' });
const titles = (p) => curtain(p).locator('li p.flex span.min-w-0').allInnerTexts();
const spendOver = async (p) => (await p.locator('.spend-tile').getAttribute('data-over')) === 'true';
const WHITE = 'rgb(255, 255, 255)', AMBER = 'rgb(255, 191, 71)';

// ================= 1) تبسيط اللوحة ونقل البطاقتين =================
section('1) لوحة مبسطة: الراتب والادخار في الأدوات');
let p = await open();
const home = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
check('لا بطاقة راتب ولا دخل إضافي في الرئيسية', (await p.locator('main .salary-card').count()) === 0 && !home.includes('الدخل الإضافي'));
check('لا بطاقة ادخار ولا بطاقة توقع ولا قائمة تنبيهات ثابتة في الرئيسية', (await p.locator('main .savings-card').count()) === 0 && !home.includes('الرصيد المتوقع نهاية الشهر') && !home.includes('تنبيهات'));
check('بطاقة الرصيد والمصروف الفعلي والبنود والترتيب باقية', await p.locator('.balance-card').isVisible() && await p.locator('.spend-tile').isVisible() && (await p.locator('[aria-label^="تسجيل مصروف على "]').count()) > 0 && (await p.getByRole('button', { name: 'لون بطاقة الرصيد المتبقي' }).count()) === 1);
check('الحسابات كما هي (760 − 450 = 310)', (await p.locator('.balance-card').innerText()).replace(/,/g, '').includes('310.00'));
await nav(p, 'الأدوات');
const toolTitles = await p.locator('main button span.block.font-bold').allInnerTexts();
check('أقسام الأدوات بالترتيب المطلوب', ['إدارة الراتب والدخل', 'إدارة الادخار', 'تحليل سلوك الإنفاق', 'محاكي التوفير', 'حدود الإنفاق والتنبيهات الحرجة', 'إعدادات الراتب والمظهر'].every((t, k) => toolTitles[k] && toolTitles[k].includes(t)), toolTitles.join(' | '));
check('عنوان المجموعة الخامسة', await p.getByRole('heading', { name: /الإعدادات والأدوات الحالية/ }).isVisible());
check('الأقسام المتقدمة غير مركّبة حتى تُفتح', (await p.locator('.savings-card').count()) === 0 && !(await p.locator('main').innerText()).includes('لوحة التحليل'));
await tool(p, /إدارة الراتب والدخل/);
const sal = await p.locator('.salary-card').evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, t: el.innerText.replace(/\s+/g, ' ') }));
check('بطاقة الراتب كاملة في الأدوات باللون المختار سابقاً', sal.bg.includes('rgb(36, 91, 145)') && sal.t.includes('الراتب الأساسي 760') && sal.t.includes('إجمالي الدخل 760'), JSON.stringify(sal));
check('أداة لون بطاقة الراتب في الأدوات', await p.getByRole('button', { name: 'لون بطاقة الراتب الأساسي' }).isVisible());
await p.fill('#salary-input', '800'); await p.getByRole('button', { name: 'حفظ الراتب' }).click(); await p.clock.runFor(150);
await p.fill('#inc-name', 'مكافأة'); await p.fill('#inc-amount', '100'); await p.getByRole('button', { name: 'إضافة الدخل' }).click(); await p.clock.runFor(150);
check('بطاقة الراتب تتحدث فوراً (800 + 100 = 900)', (await p.locator('.salary-card').innerText()).replace(/\s+/g, ' ').includes('إجمالي الدخل 900'));
await nav(p, 'الرئيسية');
check('الرئيسية تتحدث فوراً (900 − 450 = 450)', (await p.locator('.balance-card').innerText()).replace(/,/g, '').includes('450.00'));
await tool(p, /إدارة الادخار/);
const sv = (await p.locator('.savings-card').innerText()).replace(/\s+/g, ' ');
check('بطاقة الادخار في الأدوات: المخصص 50، الفعلي 30، المتبقي 20، 40٪', sv.includes('الادخار المخصص 50') && sv.includes('الادخار الفعلي 30') && sv.includes('المتبقي 20') && sv.includes('40٪'), sv);
check('بطاقة التوقع انتقلت إلى قسم الادخار', await p.getByText('الرصيد المتوقع نهاية الشهر').isVisible());
await p.getByRole('button', { name: 'تعديل مخصص الادخار' }).click(); await p.fill('#sv-saving', '60'); await p.getByRole('button', { name: 'حفظ المخصص' }).click(); await p.clock.runFor(150);
let s = await store(p);
check('تعديل مخصص الادخار للشهر الحالي فقط', s.months.find((m) => m.id === 'cur').categories.find((c) => c.id === 'saving').budget === 60 && s.months.find((m) => m.id === 'prev').categories.find((c) => c.id === 'saving').budget === 50);
check('الادخار ما زال ضمن المصروف الفعلي (450)', (await (async () => { await nav(p, 'الرئيسية'); return (await p.locator('.spend-tile').innerText()).includes('450'); })()));
await p.getByRole('button', { name: 'تصدير / طباعة التقرير' }).click(); await p.clock.runFor(300);
check('الادخار في تقرير PDF كما هو', /الادخار.*60 30 30 50٪/.test((await p.locator('article').innerText()).replace(/\s+/g, ' ')));
await p.keyboard.press('Escape'); await p.clock.runFor(150);
await tool(p, /محاكي التوفير/);
check('محاكي التوفير قسم مستقل يعمل', await p.getByText('محاكي التوفير').first().isVisible() && await p.getByRole('radio', { name: '10٪' }).isVisible());
await p.context().close();

// ================= 2) مركز التنبيهات =================
section('2) مركز التنبيهات');
p = await open({ data: storeWith([tx('rent', 300), tx('food', 100)]) });
let bl = await bell(p);
check('جرس أبيض عند عدم وجود تنبيهات غير مقروءة', !bl.unread && bl.color === WHITE, JSON.stringify(bl));
check('تباين الجرس الأبيض مع خلفيته الداكنة', bl.bg === 'rgb(51, 65, 85)');
await p.locator('.notif-bell').click(); await p.clock.runFor(200);
check('«لا توجد تنبيهات» عند خلو السجل', await curtain(p).getByText('لا توجد تنبيهات').isVisible());
await p.locator('.notif-bell').click(); await p.clock.runFor(150);
check('الجرس يغلق الستارة', (await curtain(p).count()) === 0);
// تسجيل دفعة تتجاوز الحد => تنبيه جديد
await p.getByRole('navigation').getByRole('button', { name: 'تسجيل مصروف' }).click(); await p.clock.runFor(300);
await p.selectOption('#f-cat', 'food'); await p.fill('#f-amount', '270'); await p.getByRole('button', { name: 'حفظ وخصم المبلغ' }).click(); await p.clock.runFor(300);
bl = await bell(p);
check('الجرس كهرماني (#FFBF47) عند تنبيه جديد', bl.unread && bl.color === AMBER, JSON.stringify(bl));
check('لا وميض أو حركة مستمرة للجرس', (await p.locator('.notif-bell').evaluate((el) => getComputedStyle(el).animationName + getComputedStyle(el.querySelector('svg')).animationName)) === 'nonenone');
await p.locator('.notif-bell').click(); await p.clock.runFor(200);
bl = await bell(p);
check('فتح الستارة يعيد الجرس للأبيض فوراً', !bl.unread && bl.color === WHITE);
let t = await titles(p);
check('الستارة تعرض العنوان والتنبيهات', await curtain(p).getByRole('heading', { name: 'التنبيهات' }).isVisible() && t.includes('تجاوز حد الإنفاق') && t.includes('«أكل» قارب على النفاد'), t.join(' | '));
const item0 = (await curtain(p).locator('li', { hasText: 'تجاوز حد الإنفاق' }).innerText()).replace(/\s+/g, ' ');
check('كل تنبيه: عنوان ووصف وتاريخ ووقت ونوع', /عاجل/.test(item0) && /10 نوفمبر/.test(item0) && /\d{1,2}:\d{2}/.test(item0), item0);
const geo = await curtain(p).evaluate((el) => { const r = el.querySelector('.overflow-hidden').getBoundingClientRect(); return { bottom: r.bottom, h: window.innerHeight, w: document.documentElement.scrollWidth }; });
check('الستارة داخل الشاشة وبلا تمرير أفقي', geo.bottom <= geo.h && geo.w <= 390, JSON.stringify(geo));
const dashY = await p.locator('.balance-card').evaluate((el) => el.getBoundingClientRect().top);
check('الستارة لا تدفع محتوى اللوحة', dashY < 120);
check('التحذير المالي يبقى أحمر بعد قراءة التنبيه', await spendOver(p));
await curtain(p).getByRole('button', { name: 'إغلاق التنبيهات' }).click(); await p.clock.runFor(150);
check('زر الإغلاق', (await curtain(p).count()) === 0);
await p.locator('.notif-bell').click(); await p.clock.runFor(150);
await p.mouse.click(195, 600); await p.clock.runFor(150);
check('الإغلاق بالنقر خارج الستارة', (await curtain(p).count()) === 0);
// الحفظ والاستمرارية
const ns1 = await notifStore(p);
await p.reload(); await p.clock.runFor(500);
bl = await bell(p);
check('حالة المقروء محفوظة بعد إعادة التشغيل (جرس أبيض)', !bl.unread && bl.color === WHITE);
for (const step of ['التحليل', 'الأدوات', 'السجل', 'الرئيسية']) await nav(p, step);
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-10/ }).click(); await p.clock.runFor(300);
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-11/ }).click(); await p.clock.runFor(300);
await p.reload(); await p.clock.runFor(500);
const ns2 = await notifStore(p);
check('لا تكرار عند إعادة الفتح أو تغيير الصفحات أو الأشهر (أكتوبر المتجاوز لا يولّد تنبيهات)', ns2.items.length === ns1.items.length && ns2.items.every((i) => i.read) && !(await bell(p)).unread && !ns2.items.some((i) => i.key.includes('2026-10')), JSON.stringify(ns2.items.map((i) => i.key)));
// الحذف لا يعيد الإنشاء لنفس الحالة
await p.locator('.notif-bell').click(); await p.clock.runFor(200);
await curtain(p).getByRole('button', { name: 'حذف التنبيه: تجاوز حد الإنفاق' }).click(); await p.clock.runFor(150);
check('حذف تنبيه', !(await titles(p)).includes('تجاوز حد الإنفاق'));
await p.locator('.notif-bell').click(); await p.reload(); await p.clock.runFor(500);
await p.locator('.notif-bell').click(); await p.clock.runFor(200);
check('التنبيه المحذوف لا يعود لنفس الحالة', !(await titles(p)).includes('تجاوز حد الإنفاق') && !(await bell(p)).unread);
check('الحذف لا يزيل التحذير المالي من اللوحة', await spendOver(p));
await p.locator('.notif-bell').click(); await p.clock.runFor(150);
// زوال الحالة ثم عودتها => تنبيه جديد
const finBefore = JSON.stringify((await store(p)).months);
await nav(p, 'السجل');
await p.getByRole('button', { name: 'حذف العملية' }).first().click(); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.clock.runFor(200);
await nav(p, 'الرئيسية');
check('حذف الدفعة يزيل التحذير المالي فوراً', !(await spendOver(p)));
await p.getByRole('navigation').getByRole('button', { name: 'تسجيل مصروف' }).click(); await p.clock.runFor(300);
await p.selectOption('#f-cat', 'food'); await p.fill('#f-amount', '255'); await p.getByRole('button', { name: 'حفظ وخصم المبلغ' }).click(); await p.clock.runFor(300);
bl = await bell(p);
check('الحالة المحلولة ثم المتكررة تُنشئ تنبيهاً جديداً (جرس كهرماني)', bl.unread && bl.color === AMBER);
await p.locator('.notif-bell').click(); await p.clock.runFor(200);
t = await titles(p);
check('الأحدث أولاً', t.slice(0, 2).includes('تجاوز حد الإنفاق') && t.indexOf('«أكل» قارب على النفاد') < 2 && t.length === 3, t.join(' | '));
check('السجل السابق باقٍ (تاريخ التنبيهات)', (await curtain(p).locator('li').count()) >= 2);
// مسح الكل بتأكيد دون المساس بالبيانات المالية
const finNow = JSON.stringify((await store(p)).months);
await curtain(p).getByRole('button', { name: 'مسح جميع التنبيهات' }).click();
check('تأكيد قبل المسح', await curtain(p).getByText('مسح كل التنبيهات؟').isVisible());
await curtain(p).getByRole('button', { name: 'مسح', exact: true }).click(); await p.clock.runFor(150);
check('مسح جميع التنبيهات', await curtain(p).getByText('لا توجد تنبيهات').isVisible());
check('المسح لا يمس البيانات المالية', JSON.stringify((await store(p)).months) === finNow && finNow !== finBefore);
check('التحذير المالي باقٍ بعد المسح', await spendOver(p));
await p.keyboard.press('Escape'); await p.clock.runFor(100);
check('الإغلاق بزر Esc', (await curtain(p).count()) === 0);
await p.reload(); await p.clock.runFor(500);
check('المسح لا يعيد إنشاء تنبيهات الحالات القائمة', !(await bell(p)).unread && (await notifStore(p)).items.length === 0);
await p.context().close();
// تنبيه موعد الراتب
p = await open({ time: '2026-11-21T10:00:00+04:00', data: storeWith([tx('rent', 300)]) });
check('تنبيه اقتراب موعد الراتب (بعد يومين)', (await bell(p)).unread);
await p.locator('.notif-bell').click(); await p.clock.runFor(200);
check('نص تنبيه الراتب', (await titles(p)).includes('موعد الراتب قريب') && (await curtain(p).innerText()).includes('23 نوفمبر'));
await p.context().close();
// الوضع الداكن
p = await open({ scheme: 'dark', data: storeWith([tx('rent', 300), tx('food', 400)]) });
bl = await bell(p);
check('الوضع الداكن: جرس كهرماني على خلفية داكنة', bl.unread && bl.color === AMBER && bl.bg === 'rgb(45, 58, 78)', JSON.stringify(bl));
await p.locator('.notif-bell').click(); await p.clock.runFor(200);
check('الوضع الداكن: الجرس يعود أبيض', (await bell(p)).color === WHITE);
await p.screenshot({ path: `${OUT}/v33-curtain-dark.png` });
await p.context().close();


section('2ب) قيم الحد 650 مع التنبيهات');
for (const [v, exp] of [[649.999, false], [650, false], [650.001, true], [670, true]]) {
  const q = await open({ data: storeWith([tx('rent', 300), { ...tx('food', 0), amount: Math.round((v - 300) * 1000) / 1000 }]) });
  const ns = await notifStore(q);
  const has = !!(ns && ns.items.some((i) => i.key === 'spend:2026-11'));
  check(`${v.toFixed(3)}: تحذير ${exp ? 'أحمر' : 'لا'} وتنبيه ${exp ? 'نعم' : 'لا'}`, (await spendOver(q)) === exp && has === exp, JSON.stringify({ over: await spendOver(q), has }));
  if (exp) { await q.locator('.notif-bell').click(); await q.clock.runFor(150); await q.locator('.notif-bell').click(); check(`${v.toFixed(3)}: التحذير يبقى أحمر بعد القراءة`, await spendOver(q)); }
  await q.context().close();
}

// ================= 3) الأداء والعمل دون اتصال =================
section('3) التحميل المؤجل والعمل دون اتصال');
p = await open();
check('مكتبات PDF وExcel غير منفّذة عند الفتح', (await p.evaluate(() => Object.keys(window.__deferred || {}).length)) === 0);
check('المكتبات مضمّنة في الملف (بلا شبكة)', (await p.locator('script[type="text/x-deferred"]').count()) === 2);
await p.getByRole('button', { name: 'تصدير / طباعة التقرير' }).click(); await p.clock.runFor(300);
const dl = p.waitForEvent('download', { timeout: 60000 });
await p.getByRole('button', { name: 'تحميل / مشاركة كـ PDF' }).click();
await p.clock.runFor(2000);
const f = await dl;
check('تصدير PDF دون اتصال يعمل بالتحميل عند الطلب', f.suggestedFilename() === 'salary-report-2026-11.pdf' && (await p.evaluate(() => Object.keys(window.__deferred))).includes('pdf'));
await p.context().close();
for (const w of [320, 375, 390, 430]) {
  const q = await open({ width: w });
  const r = await q.locator('header').evaluate((h) => { const lab = h.querySelector('button span.break-words'); const rc = lab.getBoundingClientRect(); return { clipped: lab.scrollWidth > lab.clientWidth + 1 || rc.left < 0, lines: Math.round(rc.height / 18.75), pageW: document.documentElement.scrollWidth, bellW: h.querySelector('.notif-bell').getBoundingClientRect().width }; });
  check(`عرض ${w}: الترويسة كاملة (${r.lines} سطر) وأهداف لمس 44px وبلا تمرير أفقي`, !r.clipped && r.pageW <= w && r.bellW >= 44 && (w < 375 || r.lines === 1), JSON.stringify(r));
  await q.context().close();
}

section('4) عام');
check('لا أخطاء في وحدة التحكم', errs.length === 0, errs.join(' | '));
await b.close();
console.log(`\n${passed} نجح، ${failed} فشل`);
console.log('SUMMARY ' + JSON.stringify(area));
process.exit(failed ? 1 : 0);
