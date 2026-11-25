// اختبار وظيفي للإصدار 3.4: التنبيهات الحرجة للأكل (يومياً) والبنزين (أسبوعياً)
// متصفح معزول ببيانات اختبار وساعة افتراضية بتوقيت مسقط؛ لا يلمس بيانات المستخدم.
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

const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'المصاريف اليومية' }, { id: 'emergency', name: 'طوارئ' }];
const cards = [{ id: 'salary', name: 'حساب الراتب' }, { id: 'applepay', name: 'Apple Pay' }, { id: 'card1', name: 'البطاقة 1' }, { id: 'card2', name: 'البطاقة 2' }];
const cats = (food = 80) => [
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 300, account: 'salary' },
  { id: 'food', name: 'أكل', group: 'daily', budget: food, account: 'applepay' },
  { id: 'fuel', name: 'بنزين', group: 'daily', budget: 80, account: 'applepay' },
];
let n = 0;
const tx = (catId, amount, date) => ({ id: `t${n++}`, catId, amount, date, note: '', account: 'applepay', created: n });
const mk = (id, period, txs, extra = {}) => ({ id, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, carryFromId: null, incomes: [], sections, cards, categories: cats(), transactions: txs, ...extra });
const storeOf = (months, activeId, settings = {}) => ({ schemaVersion: 6, debts: [], goals: [], activeId, settings: { cardColors: { salary: null, balance: null }, payDay: 23, spendLimit: 650, sortModes: {}, ...settings }, months });
const nov = (txs = [tx('rent', 300, '2026-11-01')]) => storeOf([mk('oct', '2026-10', [tx('food', 30, '2026-10-20')]), mk('nov', '2026-11', txs)], 'nov');

const b = await chromium.launch();
const errs = [];
async function open({ data = nov(), time = '2026-11-10T10:00:00+04:00', scheme = 'light', width } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], ...(width ? { viewport: { width, height: 800 } } : {}), deviceScaleFactor: 1, colorScheme: scheme, timezoneId: 'Asia/Muscat', offline: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.addInitScript(() => { window.__vib = 0; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => { window.__vib++; return true; } }); });
  await p.clock.install({ time: new Date(time) });
  await p.goto(URL);
  await p.evaluate((v) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(v)); }, data);
  await p.reload(); await p.clock.runFor(600);
  return p;
}
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')));
const notifs = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-notifications') || '{"items":[]}'));
const nav = async (p, t) => { await p.getByRole('navigation').getByText(t, { exact: true }).click(); await p.clock.runFor(250); };
const tool = async (p, name) => { await nav(p, 'الأدوات'); if (await p.getByRole('button', { name: 'رجوع للأدوات' }).count()) { await p.getByRole('button', { name: 'رجوع للأدوات' }).click(); await p.clock.runFor(150); } await p.getByRole('button', { name }).click(); await p.clock.runFor(300); };
const pay = async (p, cat, amount, date) => {
  await p.getByRole('navigation').getByRole('button', { name: 'تسجيل مصروف' }).click(); await p.clock.runFor(300);
  await p.selectOption('#f-cat', cat); await p.fill('#f-amount', String(amount));
  if (date) await p.fill('#f-date', date);
  await p.getByRole('button', { name: 'حفظ وخصم المبلغ' }).click(); await p.clock.runFor(300);
};
const delLast = async (p) => { await nav(p, 'السجل'); await p.getByRole('button', { name: 'حذف العملية' }).first().click(); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.clock.runFor(200); await nav(p, 'الرئيسية'); };
const bell = (p) => p.locator('.notif-bell').evaluate((el) => ({ state: el.dataset.state, color: getComputedStyle(el).color }));
const banner = (p, kind) => p.locator(`.critical-banner[data-kind="${kind}"]`);
const badge = (p, id) => p.locator(`#item-${id} .crit-badge`);
const curtain = (p) => p.getByRole('dialog', { name: 'التنبيهات' });
const toggleBell = async (p) => { await p.locator('.notif-bell').click(); await p.clock.runFor(200); };
const RED = 'rgb(255, 69, 69)', AMBER = 'rgb(255, 191, 71)', WHITE = 'rgb(255, 255, 255)';

// ================= 1) الأكل اليومي =================
section('1) الأكل اليومي بمخصص 80 ر.ع (الحد 2.400)');
let p = await open();
check('لا تنبيه عند الفتح، والجرس أبيض', (await bell(p)).color === WHITE && (await p.locator('.critical-banner').count()) === 0);
await pay(p, 'food', 2.399);
check('2.399: لا تنبيه حرج', (await bell(p)).state !== 'critical' && (await banner(p, 'food').count()) === 0 && (await badge(p, 'food').count()) === 0);
await delLast(p); await pay(p, 'food', 2.4);
check('2.400: لا تنبيه حرج (المساوي للحد ليس تجاوزاً)', (await bell(p)).state !== 'critical' && (await banner(p, 'food').count()) === 0);
await pay(p, 'food', 0.001);
let bl = await bell(p);
check('2.401 (دفعتان في اليوم نفسه): جرس أحمر #FF4545', bl.state === 'critical' && bl.color === RED, JSON.stringify(bl));
const bt = (await banner(p, 'food').innerText()).replace(/\s+/g, ' ');
check('شريط أحمر فوري بالعنوان والمبالغ', bt.includes('تحذير حرج: تجاوز حد مصروف الأكل اليومي') && bt.includes('2.401') && bt.includes('2.400') && bt.includes('+0.001') && /3\.001٪/.test(bt), bt);
check('توصية عملية وزر «عرض البند»', /غداً في حدود 2\.399/.test(bt) && await banner(p, 'food').getByRole('button', { name: 'عرض البند' }).isVisible());
check('مؤشر أحمر على بند الأكل بمقدار التجاوز', (await badge(p, 'food').innerText()).includes('+0.001') && (await p.locator('#item-food').getAttribute('data-critical')) === 'true');
check('الشريط باللون الأحمر بتباين كافٍ', (await banner(p, 'food').evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(180, 35, 24)');
check('لا وميض أو حركة مستمرة', (await banner(p, 'food').evaluate((el) => getComputedStyle(el).animationName)) === 'none' && (await p.locator('.notif-bell').evaluate((el) => getComputedStyle(el).animationName)) === 'none');
await pay(p, 'food', 1);
check('التحذير لا يمنع تسجيل مصروف مشروع', (await store(p)).months[1].transactions.filter((t) => t.catId === 'food').length === 3);
check('الزيادة قبل القراءة لا تكرر التنبيه', (await notifs(p)).items.filter((i) => i.level === 'critical').length === 1 && (await badge(p, 'food').innerText()).includes('+1.001'));
await toggleBell(p);
bl = await bell(p);
check('فتح الستارة يعيد الجرس للأبيض فوراً', bl.color === WHITE && bl.state === 'none');
const first = curtain(p).locator('li').first();
check('التنبيه الحرج أعلى القائمة مع التوصية و«عرض البند»', (await first.getAttribute('data-level')) === 'critical' && (await first.innerText()).includes('التجاوز 1.001') && await first.getByRole('button', { name: 'عرض البند' }).isVisible());
await toggleBell(p);
check('القراءة لا تزيل الشريط ولا مؤشر البند', await banner(p, 'food').isVisible() && await badge(p, 'food').isVisible());
await toggleBell(p);
await curtain(p).getByRole('button', { name: 'حذف التنبيه: تحذير حرج: تجاوز حد مصروف الأكل اليومي' }).click(); await p.clock.runFor(150);
await toggleBell(p);
check('الحذف لا يزيل الشريط ولا مؤشر البند', await banner(p, 'food').isVisible() && await badge(p, 'food').isVisible());
const before = (await notifs(p)).items.length;
await p.reload(); await p.clock.runFor(500);
for (const t of ['التحليل', 'الأدوات', 'الرئيسية']) await nav(p, t);
check('إعادة الفتح والتنقل لا تعيد إنشاء التنبيه', (await notifs(p)).items.length === before && (await bell(p)).color === WHITE && await banner(p, 'food').isVisible());
await pay(p, 'food', 0.5);
bl = await bell(p);
check('زيادة التجاوز بعد القراءة: تنبيه حرج جديد بالمقدار الجديد', bl.color === RED && (await notifs(p)).items[0].desc.includes('1.501'));
await banner(p, 'food').getByRole('button', { name: /^إخفاء/ }).click(); await p.clock.runFor(150);
check('«إخفاء» يطوي الشريط ويبقى مؤشر البند', (await banner(p, 'food').count()) === 0 && await badge(p, 'food').isVisible());
await p.reload(); await p.clock.runFor(500);
check('الإخفاء محفوظ بعد إعادة الفتح', (await banner(p, 'food').count()) === 0);
// تصحيح الدفعات (حذف) حتى العودة ضمن الحد
await delLast(p); await delLast(p);
check('حذف الدفعة الزائدة يُبقي التحذير ما دام التجاوز قائماً (2.401)', await badge(p, 'food').isVisible());
await delLast(p);
check('التصحيح ضمن الحد يزيل المؤشر والشريط', (await badge(p, 'food').count()) === 0 && (await banner(p, 'food').count()) === 0);
await pay(p, 'food', 0.3);
check('العودة فوق الحد بعد زوالها: تنبيه جديد وشريط ظاهر', (await bell(p)).color === RED && await banner(p, 'food').isVisible());
await p.context().close();

// تغيير المخصص الشهري
p = await open({ data: nov([tx('food', 3, '2026-11-10')]) });
check('3.000 من 80: تجاوز', await badge(p, 'food').isVisible());
await p.getByRole('button', { name: 'تعديل أكل' }).click(); await p.clock.runFor(200);
await p.fill('#i-budget', '120'); await p.getByRole('button', { name: 'حفظ التعديلات' }).click(); await p.clock.runFor(300);
check('رفع المخصص إلى 120 (الحد 3.600) يزيل التحذير فوراً', (await badge(p, 'food').count()) === 0 && (await p.locator('.critical-banner').count()) === 0);
await p.getByRole('button', { name: 'تعديل أكل' }).click(); await p.clock.runFor(200);
await p.fill('#i-budget', '0'); await p.getByRole('button', { name: 'حفظ التعديلات' }).click(); await p.clock.runFor(300);
check('المخصص صفر: لا تنبيه ولا أخطاء', (await badge(p, 'food').count()) === 0);
await p.context().close();

// التصفير عند منتصف الليل بتوقيت مسقط
p = await open({ data: nov([tx('food', 3, '2026-11-10')]), time: '2026-11-10T23:59:00+04:00' });
check('23:59 مسقط: التحذير قائم', await badge(p, 'food').isVisible());
await p.clock.runFor(2 * 60 * 1000);
check('بعد منتصف الليل: يبدأ يوم جديد ويزول التحذير دون إعادة تشغيل', (await badge(p, 'food').count()) === 0 && (await p.locator('.critical-banner').count()) === 0);
check('سجل التنبيه السابق باقٍ', (await notifs(p)).items.some((i) => i.key === 'food:food:2026-11-10'));
await p.context().close();

// ================= 2) البنزين الأسبوعي =================
section('2) البنزين الأسبوعي (الحد 15 ر.ع، الأحد–السبت)');
p = await open({ data: nov([tx('fuel', 10, '2026-11-08')]) }); // الأحد 8 نوفمبر
await pay(p, 'fuel', 4.999);
check('14.999: لا تنبيه', (await badge(p, 'fuel').count()) === 0 && (await bell(p)).state !== 'critical');
await pay(p, 'fuel', 0.001);
check('15.000: لا تنبيه', (await badge(p, 'fuel').count()) === 0);
await pay(p, 'fuel', 0.001);
bl = await bell(p);
check('15.001 (عدة دفعات خلال الأسبوع): تحذير حرج وجرس أحمر', bl.color === RED && await banner(p, 'fuel').isVisible() && (await badge(p, 'fuel').innerText()).includes('+0.001'));
const fb = (await banner(p, 'fuel').innerText()).replace(/\s+/g, ' ');
check('عنوان البنزين والتوصية', fb.includes('تحذير حرج: تجاوز حد مصروف البنزين الأسبوعي') && fb.includes('15.001') && fb.includes('15.000') && /الأسبوع القادم/.test(fb), fb);
await pay(p, 'fuel', 3, '2026-11-07');
check('دفعة الأسبوع السابق لا تُحسب', (await badge(p, 'fuel').innerText()).includes('+0.001'));
await p.clock.runFor(5 * 24 * 3600 * 1000); // الأحد 15 نوفمبر
await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.clock.runFor(300);
check('بداية الأسبوع الجديد تصفّر الحساب', (await badge(p, 'fuel').count()) === 0 && (await p.locator('.critical-banner').count()) === 0);
await p.context().close();

// أسبوع يعبر شهرين ماليين: الأحد 29 نوفمبر – السبت 5 ديسمبر
p = await open({ time: '2026-12-01T09:00:00+04:00', data: storeOf([mk('nov', '2026-11', [tx('fuel', 10, '2026-11-29')]), mk('dec', '2026-12', [])], 'dec') });
await pay(p, 'fuel', 5.001);
check('أسبوع يعبر نوفمبر وديسمبر: 10 + 5.001 = 15.001 تحذير', await banner(p, 'fuel').isVisible() && (await badge(p, 'fuel').innerText()).includes('+0.001'));
const cnt = (await notifs(p)).items.length;
await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.getByRole('radio', { name: /راتب شهر 2026-11/ }).click(); await p.clock.runFor(300);
check('تغيير الشهر المعروض لا يصفّر الحساب ولا يكرر التنبيه', await banner(p, 'fuel').isVisible() && (await notifs(p)).items.length === cnt);
await p.context().close();
// نهاية السنة: الأحد 27 ديسمبر – السبت 2 يناير
p = await open({ time: '2027-01-01T09:00:00+04:00', data: storeOf([mk('dec', '2026-12', [tx('fuel', 9, '2026-12-28')]), mk('jan', '2027-01', [])], 'jan') });
await pay(p, 'fuel', 6.5);
check('أسبوع يعبر نهاية السنة: 9 + 6.5 تحذير بتجاوز 0.500', (await badge(p, 'fuel').innerText()).includes('+0.500'));
await p.context().close();

// ================= 3) الأولوية و«عرض البند» =================
section('3) أولوية الجرس الأحمر و«عرض البند»');
p = await open({ data: nov([tx('rent', 300, '2026-11-01'), tx('food', 360, '2026-11-02')]) });
check('تنبيه عادي غير مقروء: جرس كهرماني', (await bell(p)).color === AMBER);
await pay(p, 'food', 2.5);
check('حرج + عادي غير مقروءين: الأحمر له الأولوية', (await bell(p)).color === RED);
await toggleBell(p);
const levels = await curtain(p).locator('li').evaluateAll((li) => li.map((x) => x.dataset.level));
check('الحرج في أعلى الستارة قبل العادي', levels[0] === 'critical' && levels.slice(1).every((l) => l !== 'critical'), levels.join(','));
await toggleBell(p);
await nav(p, 'الأدوات');
await p.getByRole('button', { name: /المصاريف اليومية/ }).count(); // لا شيء
await toggleBell(p);
await curtain(p).getByRole('button', { name: 'عرض البند' }).first().click(); await p.clock.runFor(400);
const vis = await p.locator('#item-food').evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
check('«عرض البند» من الستارة: ينتقل للرئيسية ويُظهر البند', (await curtain(p).count()) === 0 && vis && (await p.locator('#item-food').getAttribute('class')).includes('ring-2'));
// طيّ الفئة ثم «عرض البند» من الشريط يفتحها
await p.getByRole('button', { name: /^المصاريف اليومية/ }).first().click(); await p.clock.runFor(200);
check('الفئة مطوية', (await p.locator('#item-food').count()) === 0);
await banner(p, 'food').getByRole('button', { name: 'عرض البند' }).click(); await p.clock.runFor(400);
check('«عرض البند» يفتح الفئة المطوية ويمرّر إلى البند', await p.locator('#item-food').isVisible());
await p.screenshot({ path: `${OUT}/v34-critical-light.png` });
await p.context().close();

// ================= 4) الإعدادات =================
section('4) حدود الإنفاق والتنبيهات الحرجة (الأدوات)');
p = await open({ data: nov([tx('food', 3, '2026-11-10'), tx('fuel', 16, '2026-11-09')]) });
await nav(p, 'الأدوات');
const tt = await p.locator('main button span.block.font-bold').allInnerTexts();
check('قسم مستقل في الأدوات', tt.some((t) => t.includes('حدود الإنفاق والتنبيهات الحرجة')), tt.join(' | '));
await tool(p, /حدود الإنفاق والتنبيهات الحرجة/);
check('القيم الافتراضية: 3٪، 15، الأحد، البندان أكل وبنزين، الاهتزاز معطّل',
  (await p.inputValue('#crit-food-pct')) === '3' && (await p.inputValue('#crit-fuel-limit')) === '15' && (await p.inputValue('#crit-week-start')) === '0'
  && (await p.inputValue('#crit-food-item')) === 'food' && (await p.inputValue('#crit-fuel-item')) === 'fuel' && !(await p.isChecked('#crit-fx')));
check('ملخص اليوم والأسبوع الحاليين', (await p.locator('.crit-food-now').innerText()).includes('2.400') && (await p.locator('.crit-fuel-now').innerText()).includes('2026-11-08'));
await p.fill('#crit-food-pct', '4'); await p.locator('#crit-food-pct').locator('xpath=../..').getByRole('button', { name: 'حفظ' }).click(); await p.clock.runFor(200);
await p.fill('#crit-fuel-limit', '20'); await p.locator('#crit-fuel-limit').locator('xpath=../..').getByRole('button', { name: 'حفظ' }).click(); await p.clock.runFor(200);
await nav(p, 'الرئيسية');
check('حدود مخصصة: 4٪ (3.200) و20 ر.ع تزيل التحذيرين', (await p.locator('.crit-badge').count()) === 0);
let s = (await store(p)).settings.critical;
check('الحفظ في الإعدادات', s.foodPct === 4 && s.fuelLimit === 20);
await tool(p, /حدود الإنفاق والتنبيهات الحرجة/);
await p.fill('#crit-food-pct', '0'); await p.locator('#crit-food-pct').locator('xpath=../..').getByRole('button', { name: 'حفظ' }).click(); await p.clock.runFor(100);
check('رفض نسبة غير صالحة برسالة عربية', await p.getByText('أدخل نسبة أكبر من 0 وحتى 100.').isVisible());
await p.selectOption('#crit-week-start', '1');
await p.getByRole('button', { name: /استعادة الإعدادات الافتراضية/ }).click(); await p.clock.runFor(200);
s = (await store(p)).settings.critical;
check('استعادة الافتراضي', s.foodPct === 3 && s.fuelLimit === 15 && s.weekStart === 0 && s.foodOn && s.fuelOn);
await p.uncheck('#crit-food-on'); await p.clock.runFor(150);
await nav(p, 'الرئيسية');
check('تعطيل تنبيه الأكل يوقفه ويُبقي البنزين', (await badge(p, 'food').count()) === 0 && await badge(p, 'fuel').isVisible());
await tool(p, /حدود الإنفاق والتنبيهات الحرجة/);
await p.check('#crit-food-on'); await p.clock.runFor(150);
await p.selectOption('#crit-week-start', '1'); await p.clock.runFor(150);
check('بداية الأسبوع الاثنين: الأسبوع الحالي 9–15 نوفمبر', (await p.locator('.crit-fuel-now').innerText()).includes('2026-11-09 – 2026-11-15'));
await nav(p, 'الرئيسية');
check('دفعة الاثنين 16 ر.ع ما زالت تحذيراً ضمن أسبوعها', await badge(p, 'fuel').isVisible());
// اختيار بند آخر للأكل + إعادة التسمية لا تكسر المراقبة
await tool(p, /حدود الإنفاق والتنبيهات الحرجة/);
await p.selectOption('#crit-food-item', 'rent'); await p.clock.runFor(150);
await nav(p, 'الرئيسية');
check('ربط الأكل ببند آخر (بالمعرّف)', (await badge(p, 'food').count()) === 0);
await tool(p, /حدود الإنفاق والتنبيهات الحرجة/);
await p.selectOption('#crit-food-item', 'food'); await p.clock.runFor(150);
await nav(p, 'الرئيسية');
await p.getByRole('button', { name: 'تعديل أكل' }).click(); await p.clock.runFor(200);
await p.fill('#i-name', 'مطاعم'); await p.getByRole('button', { name: 'حفظ التعديلات' }).click(); await p.clock.runFor(300);
check('إعادة تسمية البند لا تكسر المراقبة', await badge(p, 'food').isVisible() && (await p.locator('#item-food').innerText()).includes('مطاعم'));
await p.reload(); await p.clock.runFor(500);
s = (await store(p)).settings.critical;
check('الإعدادات محفوظة بعد إعادة التشغيل', s.weekStart === 1 && s.foodItem === 'food' && s.foodOn === true);
await p.context().close();

// الاهتزاز الاختياري
p = await open({ data: nov([tx('rent', 300, '2026-11-01')]) });
await pay(p, 'food', 3);
check('الاهتزاز معطّل افتراضياً', (await p.evaluate(() => window.__vib)) === 0);
await tool(p, /حدود الإنفاق والتنبيهات الحرجة/);
await p.check('#crit-fx'); await p.clock.runFor(150);
const v0 = await p.evaluate(() => window.__vib);
await pay(p, 'fuel', 16);
check('عند التفعيل: اهتزاز واحد لكل تحذير حرج جديد', (await p.evaluate(() => window.__vib)) === v0 + 1);
await p.reload(); await p.clock.runFor(500);
check('لا اهتزاز عند إعادة الفتح', (await p.evaluate(() => window.__vib)) === 0);
await p.context().close();

// ================= 5) التحليل =================
section('5) تحليل سلوك الإنفاق');
p = await open({ data: storeOf([mk('nov', '2026-11', [tx('food', 3, '2026-11-08'), tx('food', 1, '2026-11-09'), tx('food', 5, '2026-11-10'), tx('fuel', 20, '2026-11-02'), tx('fuel', 10, '2026-11-09')])], 'nov') });
check('سجل الالتزام لا يُحسب عند التشغيل', (await p.locator('.critical-insights').count()) === 0);
await tool(p, /تحليل سلوك الإنفاق/);
const ci = (await p.locator('.critical-insights').innerText()).replace(/\s+/g, ' ');
check('اتجاه الأكل اليومي والبنزين الأسبوعي', ci.includes('آخر 14 يوماً مقابل الحد اليومي') && ci.includes('آخر 8 أسابيع مقابل الحد الأسبوعي'));
check('مرات التجاوز وإجمالي التجاوز ومتوسط الفترات المكتملة', /مرات التجاوز 2 إجمالي التجاوز 3\.200 متوسط اليوم المكتمل 2\.000/.test(ci) && /مرات التجاوز 1 إجمالي التجاوز 5\.000 متوسط الأسبوع المكتمل 20\.000/.test(ci), ci);
check('توصيات، والتنبيه أن الخفض ليس توفيراً مضموناً', ci.includes('ليس توفيراً مضموناً') && ci.includes('اجمع المشاوير'));
await p.locator('.critical-insights summary').first().click();
check('عرض كجدول', (await p.locator('.critical-insights table').first().locator('tbody tr').count()) === 14);
await p.context().close();

// ================= 6) الوضع الداكن والعرض =================
section('6) الوضع الداكن والعرض والأداء');
p = await open({ scheme: 'dark', data: nov([tx('food', 3, '2026-11-10')]) });
check('الوضع الداكن: جرس أحمر وشريط بتباين كافٍ', (await bell(p)).color === RED && (await banner(p, 'food').evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(180, 35, 24)');
await p.screenshot({ path: `${OUT}/v34-critical-dark.png` });
await p.context().close();
for (const w of [320, 375, 430]) {
  const q = await open({ width: w, data: nov([tx('food', 3, '2026-11-10'), tx('fuel', 16, '2026-11-09')]) });
  const r = await q.evaluate(() => ({ pageW: document.documentElement.scrollWidth, banners: [...document.querySelectorAll('.critical-banner')].map((e) => e.scrollWidth <= e.clientWidth + 1) }));
  check(`عرض ${w}: شريطان بلا قص ولا تمرير أفقي`, r.pageW <= w && r.banners.length === 2 && r.banners.every(Boolean), JSON.stringify(r));
  await q.context().close();
}
p = await open();
check('دون اتصال: يعمل التطبيق والمكتبات المؤجلة غير منفّذة', await p.locator('.balance-card').isVisible() && (await p.evaluate(() => Object.keys(window.__deferred || {}).length)) === 0);
await p.context().close();

section('7) عام');
check('لا أخطاء في وحدة التحكم', errs.length === 0, errs.join(' | '));
await b.close();
console.log(`\n${passed} نجح، ${failed} فشل`);
console.log('SUMMARY ' + JSON.stringify(area));
process.exit(failed ? 1 : 0);
