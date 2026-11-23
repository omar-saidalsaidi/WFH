// اختبار وظيفي شامل للتطبيق المبني (index.html) في متصفح بحجم آيفون
// التشغيل: npm run build && npm run test:e2e   (اختياري: OUT=مجلد لحفظ الملفات واللقطات)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as XLSX from 'xlsx';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = process.env.OUT || path.resolve('tests/.out');
mkdirSync(OUT, { recursive: true });
const URL = `file://${path.resolve('index.html')}`;

let failed = 0, passed = 0;
const check = (name, cond, extra = '') => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const P = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
const prevP = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; })();
const today = `${P}-${pad(now.getDate())}`;
const day = now.getDate();

const cats = [
  { id: 'rent', name: 'الإيجار', group: 'fixed', budget: 120, account: 'salary' },
  { id: 'debt', name: 'الدين', group: 'fixed', budget: 100, account: 'salary' },
  { id: 'saving', name: 'الادخار', group: 'fixed', budget: 50, account: 'salary' },
  { id: 'fuel', name: 'بنزين', group: 'daily', budget: 80, account: 'applepay' },
  { id: 'fun', name: 'ترفيه', group: 'daily', budget: 40, account: 'applepay' },
];
const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'مصاريف يومية' }, { id: 'temp', name: 'التزامات مؤقتة' }, { id: 'emergency', name: 'طوارئ' }];
const cards = [{ id: 'salary', name: 'حساب الراتب' }, { id: 'applepay', name: 'Apple Pay' }, { id: 'card1', name: 'بنك مسقط' }, { id: 'card2', name: 'البطاقة 2' }];
// بيانات الإصدار السابق (v4): شهران بلا رصيد مرحّل ولا ديون ولا أهداف
const prevTx = [
  { id: 'p1', catId: 'rent', account: 'salary', amount: 120, date: `${prevP}-01`, note: 'إيجار', created: 1 },
  { id: 'p2', catId: 'fuel', account: 'applepay', amount: 70, date: `${prevP}-10`, note: '', created: 2 },
];
const curTx = [
  { id: 'c1', catId: 'rent', account: 'salary', amount: 120, date: `${P}-01`, note: 'إيجار', created: 3 },
  { id: 'c2', catId: 'fun', account: 'applepay', amount: 34, date: `${P}-02`, note: 'سينما', created: 4 }, // 85٪ => تنبيه
  { id: 'c3', catId: 'debt', account: 'salary', amount: 100, date: `${P}-01`, note: 'قسط', created: 5 },
];
const v4 = {
  months: [
    { id: 'mPrev', period: prevP, label: 'الشهر السابق', salary: 760, sections, cards, categories: cats, transactions: prevTx },
    { id: 'mCur', period: P, label: 'الشهر الحالي', salary: 760, sections, cards, categories: cats.map((c) => (c.id === 'rent' ? { ...c } : c)), transactions: curTx },
  ],
  activeId: 'mCur',
};

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(URL);
await p.evaluate((v) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(v)); }, v4);
await p.reload();
await p.waitForTimeout(400);
const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-v4')));
const nav = (t) => p.getByRole('navigation').getByText(t, { exact: true }).click().then(() => p.waitForTimeout(250));
const noHScroll = async (where) => check(`بلا تمرير أفقي: ${where}`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);

console.log('1) الترحيل الآمن');
let st = await store();
check('الإصدار 5', st.schemaVersion === 5);
check('العمليات لم تتغير', JSON.stringify(st.months[1].transactions) === JSON.stringify(curTx) && JSON.stringify(st.months[0].transactions) === JSON.stringify(prevTx));
check('رصيد مرحّل افتراضي 0 وقوائم ديون وأهداف فارغة', st.months.every((m) => m.carryIn === 0) && st.debts.length === 0 && st.goals.length === 0);

console.log('2) التوقع والمخطط والفعلي');
const forecastTxt = await p.locator('text=الرصيد المتوقع نهاية الشهر').first().locator('xpath=..').innerText();
// المدفوع 254، الرصيد 506، غير المدفوع: ادخار 50 + بنزين 80 + ترفيه 6 = 136 => 370 (قد يزيد بالوتيرة إن وُجد صرف يومي)
const expected = day >= 5 ? 370 - Math.max(0, (34 / day) * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - 40) : 370;
const shown = Number((forecastTxt.match(/-?[\d,]+\.\d+/) || ['NaN'])[0].replace(/,/g, ''));
check('قيمة الرصيد المتوقع', Math.abs(shown - expected) < 0.002, `(${shown} / متوقع ${expected.toFixed(3)})`);
await p.getByRole('button', { name: /كيف حُسب/ }).click();
check('تفصيل التوقع ظاهر', await p.getByText('مخصصات والتزامات لم تُدفع بعد').isVisible());
const funRow = await p.getByRole('button', { name: 'تسجيل مصروف على ترفيه' }).innerText();
check('سطر المخطط والمدفوع والنسبة', /مخطط\s*40/.test(funRow) && /مدفوع\s*34/.test(funRow) && /85٪/.test(funRow), funRow.replace(/\s+/g, ' '));
check('تنبيه 80٪', await p.getByText(/«ترفيه» بلغ 85٪/).isVisible());
await p.screenshot({ path: `${OUT}/home.png`, fullPage: true });
await noHScroll('الرئيسية');

console.log('3) يوم الاستحقاق وتنبيهه');
await p.getByRole('button', { name: 'تعديل بنزين' }).click();
const due = Math.min(28, day + 1);
await p.fill('#i-due', String(due));
await p.getByRole('button', { name: 'حفظ التعديلات' }).click();
await p.waitForTimeout(200);
check('تنبيه اقتراب موعد الدفع', await p.getByText(/«بنزين» 80 ر.ع/).count() > 0 || due <= day);

console.log('4) ترحيل الرصيد لشهر جديد');
const closing = 760 - 254;
await p.getByRole('button', { name: /تغيير الشهر/ }).click();
await p.getByRole('button', { name: '+ بدء شهر جديد' }).click();
check('خيار ترحيل الفائض ظاهر بالقيمة', await p.getByText(`ترحيل الفائض (${closing} ر.ع)`).isVisible());
check('الترحيل غير مفعّل افتراضياً', !(await p.locator('#carry-toggle').isChecked()));
await p.locator('#carry-toggle').check();
await p.getByRole('button', { name: 'ابدأ الشهر' }).click();
await p.waitForTimeout(300);
st = await store();
const nm = st.months.find((m) => m.id === st.activeId);
check('الشهر الجديد: رصيد مرحّل = الرصيد الختامي، والراتب مستقل', nm.carryIn === closing && nm.salary === 760 && nm.transactions.length === 0, JSON.stringify({ c: nm.carryIn, s: nm.salary }));
const hero = await p.locator('section').first().innerText();
check('المتبقي يشمل المرحّل', hero.replace(/,/g, '').includes((760 + closing).toFixed(2)), hero.replace(/\s+/g, ' '));
// تعديل الشهر السابق لا يغيّر المرحّل تلقائياً
await p.getByRole('button', { name: /تغيير الشهر/ }).click();
await p.getByRole('radio', { name: /الشهر الحالي/ }).click();
await p.waitForTimeout(200);
await p.getByRole('navigation').getByRole('button', { name: 'تسجيل مصروف' }).click();
await p.selectOption('#f-cat', 'fuel'); await p.fill('#f-amount', '6'); await p.getByRole('button', { name: 'حفظ وخصم المبلغ' }).click();
await p.waitForTimeout(200);
st = await store();
check('المرحّل لم يتغير تلقائياً', st.months.find((m) => m.id === nm.id).carryIn === closing);
await p.getByRole('button', { name: /تغيير الشهر/ }).click();
await p.getByRole('radio', { name: new RegExp(nm.label) }).click();
await p.waitForTimeout(200);
await p.getByRole('button', { name: /تغيير الشهر/ }).click();
const upd = p.getByRole('button', { name: /تحديث؟/ });
check('عرض تحديث يدوي للمرحّل', await upd.isVisible());
await upd.click(); await p.waitForTimeout(150);
st = await store();
check('التحديث اليدوي طبّق القيمة الجديدة', st.months.find((m) => m.id === nm.id).carryIn === closing - 6);
await p.keyboard.press('Escape');
// العودة للشهر الحالي لبقية الاختبارات
await p.getByRole('button', { name: /تغيير الشهر/ }).click();
await p.getByRole('radio', { name: /الشهر الحالي/ }).click();
await p.waitForTimeout(200);

console.log('5) التحليل السنوي');
await nav('التحليل');
check('جدول المخطط مقابل الفعلي', await p.getByText('المخطط مقابل الفعلي').isVisible());
await p.getByRole('tab', { name: /سنوي/ }).click(); await p.waitForTimeout(200);
check('12 عموداً شهرياً', (await p.locator('[aria-label="أعمدة الراتب والمدفوع لكل شهر"] > button').count()) === 12);
check('أكثر البنود: الإيجار أولاً', (await p.getByText('أكثر البنود استهلاكاً').locator('xpath=..').innerText()).includes('الإيجار'));
await p.screenshot({ path: `${OUT}/annual.png`, fullPage: true });
await noHScroll('التحليل السنوي');

console.log('6) الديون');
await nav('الأدوات');
await p.getByRole('button', { name: /الديون والالتزامات/ }).click();
await p.getByRole('button', { name: 'إضافة دين أو التزام' }).click();
await p.fill('#d-name', 'قرض شخصي'); await p.fill('#d-open', '1000'); await p.fill('#d-asof', `${P}-01`);
await p.fill('#d-inst', '100'); await p.fill('#d-day', '1');
await p.getByRole('button', { name: 'حفظ', exact: true }).click(); await p.waitForTimeout(200);
const debtTxt = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
check('المتبقي 900 بعد ربط قسط هذا الشهر', /المتبقي 900/.test(debtTxt), debtTxt.slice(0, 200));
check('9 أقساط متبقية وتاريخ انتهاء', /أقساط متبقية 9/.test(debtTxt) && debtTxt.includes('الانتهاء المتوقع'));
await p.screenshot({ path: `${OUT}/debts.png`, fullPage: true });

console.log('7) أهداف الادخار');
await p.getByRole('button', { name: 'رجوع للأدوات' }).click();
await p.getByRole('button', { name: /أهداف الادخار/ }).click();
await p.getByRole('button', { name: 'هدف جديد' }).click();
const dl = (() => { const d = new Date(now.getFullYear(), now.getMonth() + 9, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; })();
await p.fill('#g-name', 'صندوق الطوارئ'); await p.fill('#g-target', '1200'); await p.fill('#g-start', '200'); await p.fill('#g-dl', dl);
await p.getByRole('button', { name: 'حفظ', exact: true }).click(); await p.waitForTimeout(200);
const goalTxt = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
check('الإنجاز 17٪ والمطلوب شهرياً 100 لـ 10 أشهر', goalTxt.includes('17٪') && /المطلوب شهرياً 100 ر.ع لمدة 10 أشهر/.test(goalTxt), goalTxt.slice(0, 220));

console.log('8) محاكاة السيناريوهات');
const before = JSON.stringify(await store());
await p.getByRole('button', { name: 'رجوع للأدوات' }).click();
await p.getByRole('button', { name: /محاكاة السيناريوهات/ }).click();
await p.fill('#sc-sal', '100');
await p.selectOption('#sc-item', 'rent'); await p.getByRole('button', { name: 'إضافة', exact: true }).click();
await p.fill('#sc-b-rent', '100');
await p.fill('#sc-ex-n', 'قسط سيارة'); await p.getByLabel('مبلغ القسط').fill('50');
const scTxt = (await p.locator('table').last().innerText()).replace(/\s+/g, ' ');
check('فرق الفائض المخطط +70', /الفائض المخطط.*\+70/.test(scTxt), scTxt);
check('البيانات الفعلية لم تتغير', JSON.stringify(await store()) === before);
await p.screenshot({ path: `${OUT}/scenario.png`, fullPage: true });
await noHScroll('السيناريوهات');

console.log('9) النسخ الاحتياطي والاستعادة');
await p.getByRole('button', { name: 'رجوع للأدوات' }).click();
await p.getByRole('button', { name: /النسخ الاحتياطي/ }).click();
let dlp = p.waitForEvent('download');
await p.getByRole('button', { name: /تصدير \/ مشاركة النسخة/ }).click();
const bk = await dlp; const bkPath = `${OUT}/backup.json`; await bk.saveAs(bkPath);
const bkObj = JSON.parse(readFileSync(bkPath, 'utf8'));
check('ملف النسخة يضم كل الأشهر والديون والأهداف مع بصمة', bkObj.data.months.length === 3 && bkObj.data.debts.length === 1 && bkObj.data.goals.length === 1 && /^[0-9a-f]{8}$/.test(bkObj.checksum));
const good = JSON.stringify(await store());
// ملف تالف: يُرفض ولا تتغير البيانات
const bad = { ...bkObj, data: { ...bkObj.data, months: bkObj.data.months.map((m, k) => (k === 0 ? { ...m, transactions: [{ ...m.transactions[0], amount: 999 }] } : m)) } };
await p.setInputFiles('#restore-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
await p.waitForTimeout(200);
check('رفض الملف المعدّل', await p.getByText('لم تتم الاستعادة: الملف غير صالح').isVisible() && await p.getByText(/بصمة الملف/).isVisible());
check('البيانات لم تتغير بعد الرفض', JSON.stringify(await store()) === good);
// حذف عملية ثم الاستعادة من النسخة السليمة
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('salary-tracker-omr-v4')); return s; });
await nav('السجل');
await p.getByRole('button', { name: 'حذف العملية' }).first().click(); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.waitForTimeout(150);
const afterDel = await store();
check('حُذفت عملية قبل الاستعادة', afterDel.months.find((m) => m.id === 'mCur').transactions.length === 3);
await nav('الأدوات');
check('الأدوات تعود للأداة المفتوحة', await p.getByRole('heading', { name: 'النسخ الاحتياطي والاستعادة' }).isVisible());
await p.setInputFiles('#restore-file', bkPath); await p.waitForTimeout(200);
check('الملف السليم مقبول مع ملخص', await p.getByText('الملف سليم').isVisible());
await p.getByRole('button', { name: 'استعادة', exact: true }).click(); await p.waitForTimeout(300);
const restored = await store();
check('الاستعادة أعادت البيانات كما صُدّرت', JSON.stringify(restored) === JSON.stringify(bkObj.data));
const snaps = await p.evaluate(() => JSON.parse(localStorage.getItem('salary-tracker-omr-snapshots') || '[]'));
check('حُفظت نسخة تلقائية قبل الاستيراد', snaps[0] && snaps[0].reason === 'قبل الاستيراد' && snaps[0].store.months.find((m) => m.id === 'mCur').transactions.length === 3);
await p.reload(); await p.waitForTimeout(300);
check('البيانات باقية بعد إعادة التحميل', JSON.stringify(await store()) === JSON.stringify(bkObj.data));

console.log('10) التقارير PDF وExcel');
await p.getByRole('button', { name: 'تصدير / طباعة التقرير' }).click(); await p.waitForTimeout(300);
for (const mode of ['month', 'year']) {
  if (mode === 'year') { await p.getByRole('tab', { name: 'تقرير سنوي' }).click(); await p.waitForTimeout(200); }
  dlp = p.waitForEvent('download', { timeout: 60000 });
  await p.getByRole('button', { name: 'تحميل / مشاركة كـ PDF' }).click();
  const f = await dlp; const fp = `${OUT}/${f.suggestedFilename()}`; await f.saveAs(fp);
  const info = execFileSync('pdfinfo', [fp]).toString();
  check(`PDF ${mode === 'year' ? 'سنوي' : 'شهري'} صالح (A4)`, /Page size:\s+595/.test(info) && /Pages:\s+[1-9]/.test(info), f.suggestedFilename());
  execFileSync('pdftoppm', ['-r', '70', '-png', '-f', '1', '-l', '1', fp, `${OUT}/pdf-${mode}`]);
  dlp = p.waitForEvent('download', { timeout: 30000 });
  await p.getByRole('button', { name: 'Excel', exact: true }).click();
  const x = await dlp; const xp = `${OUT}/${x.suggestedFilename()}`; await x.saveAs(xp);
  const wb = XLSX.read(readFileSync(xp));
  if (mode === 'month') {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['المخطط والفعلي'], { header: 1 });
    const rent = rows.find((r) => r[1] === 'الإيجار');
    check('Excel شهري: أوراق وبيانات المخطط والمدفوع', wb.SheetNames.join() === 'الملخص,المخطط والفعلي,العمليات' && rent && rent[3] === 120 && rent[4] === 120 && rent[5] === 0, JSON.stringify(rent));
  } else {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['المقارنة السنوية'], { header: 1 });
    check('Excel سنوي: 12 شهراً + إجمالي', rows.length === 14, String(rows.length));
  }
}
await p.keyboard.press('Escape');

console.log('11) الواجهة');
for (const t of ['الرئيسية', 'السجل', 'الأدوات']) { await nav(t); await noHScroll(t); }
check('لا أخطاء في وحدة التحكم', errs.length === 0, errs.join(' | '));
await b.close();
console.log(`\n${passed} نجح، ${failed} فشل`);
process.exit(failed ? 1 : 0);
