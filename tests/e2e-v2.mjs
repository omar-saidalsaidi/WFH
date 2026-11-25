// اختبار وظيفي للإصدار الثاني: إدارة الفئات، الألوان، تحليل سلوك الإنفاق، بطاقة الراتب البنفسجية
// التشغيل: npm run build && node tests/e2e-v2.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { surfaceFor } from '../src/colors.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = process.env.OUT || path.resolve('tests/.out');
mkdirSync(OUT, { recursive: true });
const URL = `file://${path.resolve('index.html')}`;

let failed = 0, passed = 0;
const check = (name, cond, extra = '') => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const per = (k) => { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const P2 = per(-2), P1 = per(-1), P = per(0), PN = per(1);

const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'المصاريف التشغيلية واليومية' }, { id: 'temp', name: 'التزامات مؤقتة' }, { id: 'emergency', name: 'طوارئ' }];
const cards = [{ id: 'salary', name: 'حساب الراتب' }, { id: 'applepay', name: 'Apple Pay' }, { id: 'card1', name: 'البطاقة 1' }, { id: 'card2', name: 'البطاقة 2' }];
const cats = [
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' },
  { id: 'saving', name: 'الادخار', group: 'fixed', budget: 50, account: 'salary' },
  { id: 'food', name: 'الأكل والمطاعم', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'fuel', name: 'بنزين', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'tailor', name: 'الخياط', group: 'temp', budget: 22, account: 'card2' },
];
let n = 0;
const tx = (catId, amount, date, note = '') => ({ id: `t${n++}`, catId, amount, date, note, account: 'applepay', created: n });
const mk = (id, period, txs) => ({ id, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, carryFromId: null, sections, cards, categories: cats, transactions: txs });
const seed = {
  schemaVersion: 5, debts: [], goals: [], activeId: 'cur',
  months: [
    mk('m2', P2, [tx('rent', 120, `${P2}-01`), tx('food', 60, `${P2}-03`), tx('food', 50, `${P2}-20`), tx('fuel', 40, `${P2}-05`)]),
    mk('m1', P1, [tx('rent', 120, `${P1}-01`), tx('food', 70, `${P1}-03`), tx('food', 40, `${P1}-18`), tx('fuel', 40, `${P1}-05`)]),
    mk('cur', P, [tx('rent', 120, `${P}-01`), tx('food', 25, `${P}-02`), tx('fuel', 15, `${P}-02`)]),
    mk('next', PN, []),
  ],
};

const b = await chromium.launch();
const errs = [];
async function open(scheme, data) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, colorScheme: scheme });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL);
  await p.evaluate((v) => { localStorage.clear(); sessionStorage.clear(); if (v) localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(v)); }, data);
  await p.reload(); await p.waitForTimeout(400);
  return p;
}
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')));
const month = (s, id) => s.months.find((m) => m.id === id);
const noHScroll = async (p, where) => check(`بلا تمرير أفقي: ${where}`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);

let p = await open('light', seed);

console.log('1) بطاقة الراتب البنفسجية');
const css = await p.locator('.salary-card').evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundImage, color: c.color }; });
check('خلفية #F0E8FF → #EDE4FF ونص #4C347C', css.bg.includes('rgb(240, 232, 255)') && css.bg.includes('rgb(237, 228, 255)') && css.color === 'rgb(76, 52, 124)', JSON.stringify(css));
check('زر تعديل الراتب باقٍ', await p.getByRole('button', { name: 'تعديل مبلغ الراتب' }).isVisible());
await p.screenshot({ path: `${OUT}/v2-home-light.png` });

console.log('2) إدارة الفئات');
await p.getByRole('button', { name: 'إدارة الفئات' }).click(); await p.waitForTimeout(400);
check('عدد البنود والعمليات لكل فئة', (await p.getByRole('dialog').innerText()).includes('2 بنود · 2 عمليات'));
check('خيار النطاق يعرض الشهر اللاحق', await p.getByRole('radio', { name: /والأشهر اللاحقة \(1\)/ }).isVisible());
// إضافة فئة للشهر الحالي فقط
await p.fill('#ms-new', 'الأطفال والمدرسة');
await p.getByRole('button', { name: 'إضافة الفئة' }).click(); await p.waitForTimeout(150);
let s = await store(p);
check('الإضافة: الشهر الحالي فقط', month(s, 'cur').sections.some((x) => x.name === 'الأطفال والمدرسة') && !month(s, 'next').sections.some((x) => x.name === 'الأطفال والمدرسة') && month(s, 'm1').sections.length === 4);
const newId = month(s, 'cur').sections.find((x) => x.name === 'الأطفال والمدرسة').id;
check('معرّف ثابت للفئة الجديدة', /^sec_/.test(newId));
// إعادة الترتيب
const dlg = p.getByRole('dialog', { name: 'إدارة الفئات' });
await dlg.getByRole('button', { name: 'رفع التزامات مؤقتة' }).click(); await p.waitForTimeout(150);
s = await store(p);
check('إعادة الترتيب', month(s, 'cur').sections.map((x) => x.id).join() === `fixed,temp,daily,emergency,${newId}`);
// إعادة التسمية بنطاق الأشهر اللاحقة
await dlg.getByRole('radio', { name: /والأشهر اللاحقة/ }).click();
await dlg.getByRole('button', { name: 'تغيير اسم المصاريف التشغيلية واليومية' }).click();
await p.fill('#ms-name-daily', 'المصاريف اليومية');
await dlg.getByRole('button', { name: 'حفظ الاسم' }).click(); await p.waitForTimeout(150);
s = await store(p);
check('التسمية: الحالي واللاحق، والسابق لم يتغير', month(s, 'cur').sections.find((x) => x.id === 'daily').name === 'المصاريف اليومية' && month(s, 'next').sections.find((x) => x.id === 'daily').name === 'المصاريف اليومية' && month(s, 'm1').sections.find((x) => x.id === 'daily').name === 'المصاريف التشغيلية واليومية');
// حذف فئة فيها بنود: يتطلب النقل
await dlg.getByRole('radio', { name: /فقط/ }).click();
const beforeTx = JSON.stringify(month(s, 'cur').transactions);
await dlg.getByRole('button', { name: 'حذف المصاريف اليومية' }).click();
check('تحذير يوضح البنود والعمليات', (await p.getByRole('dialog').innerText()).includes('هذه الفئة فيها 2 بنود و2 عمليات'));
await dlg.getByRole('button', { name: 'نقل البنود وحذف الفئة' }).click();
check('منع الحذف دون اختيار فئة', await p.getByText('اختر الفئة التي تُنقل إليها البنود.').isVisible());
await p.selectOption('#ms-move-daily', newId);
await dlg.getByRole('button', { name: 'نقل البنود وحذف الفئة' }).click(); await p.waitForTimeout(200);
s = await store(p);
const cur = month(s, 'cur');
check('حُذفت الفئة ونُقلت بنودها', !cur.sections.some((x) => x.id === 'daily') && cur.categories.filter((c) => c.group === newId).map((c) => c.id).join() === 'food,fuel');
check('العمليات لم تتغير ولا عمليات يتيمة', JSON.stringify(cur.transactions) === beforeTx && cur.transactions.every((t) => cur.categories.some((c) => c.id === t.catId)));
check('الشهر السابق والتالي لم يفقدا الفئة', month(s, 'm1').sections.some((x) => x.id === 'daily') && month(s, 'next').sections.some((x) => x.id === 'daily'));
// حذف فئة فارغة
await dlg.getByRole('button', { name: 'حذف طوارئ' }).click();
await dlg.getByRole('button', { name: 'تأكيد الحذف' }).click(); await p.waitForTimeout(150);
s = await store(p);
check('حذف فئة فارغة', !month(s, 'cur').sections.some((x) => x.id === 'emergency'));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
const hero = (await p.locator('.salary-card').innerText()).replace(/\s+/g, ' ');
check('الحسابات لم تتغير بعد إدارة الفئات (المتبقي 600)', hero.includes('600.00'), hero);

console.log('3) ألوان الفئات');
await p.getByRole('button', { name: `لون الأطفال والمدرسة` }).click(); await p.waitForTimeout(400);
await p.getByRole('radio', { name: 'أخضر نعناعي' }).click();
await p.getByRole('button', { name: 'تطبيق' }).click(); await p.waitForTimeout(200);
s = await store(p);
check('حُفظ اللون مع الفئة', month(s, 'cur').sections.find((x) => x.id === newId).color === '#E3F5EA');
const cardOf = (pg, name) => pg.getByRole('button', { name: `لون ${name}`, exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
const card = cardOf(p, 'الأطفال والمدرسة');
const bgLight = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
check('البطاقة الخارجية ملونة (#E3F5EA)', bgLight === 'rgb(227, 245, 234)', bgLight);
await card.locator('button[aria-expanded]').first().click(); await p.waitForTimeout(150);
const rowBg = await card.locator('ul li > div.relative').first().evaluate((el) => getComputedStyle(el).backgroundColor);
check('صفوف البنود الداخلية بقيت بيضاء', rowBg === 'rgb(255, 255, 255)', rowBg);
await p.getByRole('button', { name: 'تغيير اسم الالتزامات الثابتة' }).click(); await p.waitForTimeout(300);
await p.fill('#sec-rename', 'التزاماتي'); await p.getByRole('button', { name: 'حفظ الاسم' }).click(); await p.waitForTimeout(150);
s = await store(p);
check('إعادة التسمية من رأس الفئة', month(s, 'cur').sections.find((x) => x.id === 'fixed').name === 'التزاماتي');
await p.reload(); await p.waitForTimeout(300);
check('التعديلات باقية بعد إعادة التحميل', (await p.locator('main').innerText()).includes('التزاماتي') && (await cardOf(p, 'الأطفال والمدرسة').evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(227, 245, 234)');
await p.screenshot({ path: `${OUT}/v2-categories.png`, fullPage: true });
await noHScroll(p, 'الرئيسية');

console.log('4) تحليل سلوك الإنفاق (عدة أشهر)');
await p.getByRole('navigation').getByText('الأدوات', { exact: true }).click(); await p.waitForTimeout(200);
await p.getByRole('button', { name: /تحليل سلوك الإنفاق/ }).click(); await p.waitForTimeout(300);
const main = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
check('تحليل 3 أشهر منها 2 مكتملة', main.includes('حُلّلت 3 أشهر فيها عمليات، منها 2 مكتملة'), main.slice(0, 200));
check('مثال الأكل: 80 مقابل 110، تجاوز 30، نسبة 37.5٪', /الفئة: الأكل والمطاعم.*الميزانية المحددة 80 ر.ع المصروف الفعلي 110 ر.ع تجاوز الميزانية 30 ر.ع نسبة التجاوز 37.5٪/.test(main));
check('نص التوصية والتوفير السنوي', main.includes('تجاوزت مصروفات «الأكل والمطاعم» الميزانية المحددة بنسبة 37.5٪') && main.includes('بمقدار 20 ر.ع شهرياً') && main.includes('240 ر.ع سنوياً'));
check('تكرار التجاوز', main.includes('تجاوز الميزانية تكرر في 2 من 3 أشهر'));
check('الملخص: توفير شهري وسنوي', /فرص التوفير الشهرية 20 ر.ع/.test(main) && /فرص التوفير السنوية 240 ر.ع/.test(main));
check('بيان الخصوصية وأنه ليس ذكاءً اصطناعياً', main.includes('وليس ذكاءً اصطناعياً') && main.includes('لا تُرسل بياناتك'));
check('الإيجار ليس من البنود التي تحتاج انتباهاً', !/الفئة: الإيجار/.test(main));
await p.getByRole('tablist', { name: 'الأولوية' }).getByRole('tab', { name: 'الكل', exact: true }).click(); await p.waitForTimeout(100);
const all = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
check('الالتزامات الثابتة لا يُقترح تخفيضها', /الفئة: الإيجار.*لا نقترح تخفيضه لأنه من الالتزامات الأساسية/.test(all));
await p.getByRole('button', { name: 'تحديث التحليل' }).click(); await p.waitForTimeout(100);
check('زر التحديث يعمل', await p.getByText(/آخر تحديث/).isVisible());
await p.screenshot({ path: `${OUT}/v2-behavior.png`, fullPage: true });
await noHScroll(p, 'تحليل السلوك');

console.log('5) الوضع الداكن');
const pd = await open('dark', seed);
const dcss = await pd.locator('.salary-card').evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundImage, color: c.color }; });
check('بطاقة الراتب داكنة بنص فاتح', dcss.bg.includes('rgb(43, 35, 66)') && dcss.color === 'rgb(230, 219, 255)', JSON.stringify(dcss));
await pd.evaluate(() => { const s = JSON.parse(localStorage.getItem('salary-tracker-omr-v4')); s.months.find((m) => m.id === 'cur').sections[1].color = 'peach'; localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(s)); });
await pd.reload(); await pd.waitForTimeout(300);
const secName = (await pd.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')).months.find((m) => m.id === 'cur').sections[1].name));
const dbg = await cardOf(pd, secName).evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el.querySelector('span.block')).color }));
const exp = surfaceFor('peach', true); const hex2rgb = (h) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
check('مفتاح اللون القديم يُترجم ويُكيَّف للوضع الداكن مع نص فاتح', dbg.bg === hex2rgb(exp.bg) && dbg.fg === 'rgb(248, 250, 252)' && exp.ratio >= 4.5, JSON.stringify({ dbg, exp: exp.bg }));
await pd.screenshot({ path: `${OUT}/v2-home-dark.png` });

console.log('6) بيانات غير كافية وصفر مصروفات');
const pl = await open('light', { ...seed, months: [mk('cur', P, [tx('food', 12, `${P}-02`)])], activeId: 'cur' });
await pl.getByRole('navigation').getByText('الأدوات', { exact: true }).click();
await pl.getByRole('button', { name: /تحليل سلوك الإنفاق/ }).click(); await pl.waitForTimeout(200);
check('تنبيه: لا يوجد شهر مكتمل', await pl.getByText(/لا يوجد شهر مكتمل بعد/).isVisible());
const pz = await open('light', null);
await pz.getByRole('navigation').getByText('الأدوات', { exact: true }).click();
await pz.getByRole('button', { name: /تحليل سلوك الإنفاق/ }).click(); await pz.waitForTimeout(200);
check('صفر مصروفات: رسالة واضحة دون استنتاجات', await pz.getByText('لا توجد بيانات كافية للتحليل').isVisible() && await pz.locator('text=/الفئة:/').count() === 0);

check('لا أخطاء في وحدة التحكم', errs.length === 0, errs.join(' | '));
await b.close();
console.log(`\n${passed} نجح، ${failed} فشل`);
process.exit(failed ? 1 : 0);
