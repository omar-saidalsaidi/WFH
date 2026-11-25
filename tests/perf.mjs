// قياس الأداء: نفس البيانات ونفس البيئة لنسختين من التطبيق
// التشغيل: node tests/perf.mjs <path/to/index.html> [label]
// يُبطَّأ المعالج 4× لمحاكاة هاتف، ويُقاس 7 مرات تشغيل بارد ويُؤخذ الوسيط.
import { createRequire } from 'node:module';
import { statSync, readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const file = path.resolve(process.argv[2] || 'index.html');
const label = process.argv[3] || path.basename(path.dirname(file));
const RUNS = Number(process.env.RUNS || 7);
const CPU = Number(process.env.CPU || 4);

// بيانات واقعية: 12 شهراً، 16 بنداً، ~50 عملية شهرياً
const pad = (n) => String(n).padStart(2, '0');
const sections = [{ id: 'fixed', name: 'الالتزامات الثابتة' }, { id: 'daily', name: 'المصاريف اليومية' }, { id: 'temp', name: 'مؤقتة' }, { id: 'emergency', name: 'طوارئ' }];
const cards = [{ id: 'salary', name: 'حساب الراتب' }, { id: 'applepay', name: 'Apple Pay' }, { id: 'card1', name: 'البطاقة 1' }, { id: 'card2', name: 'البطاقة 2' }];
const cats = [['jamiya', 150, 'fixed'], ['rent', 120, 'fixed'], ['debt', 100, 'fixed'], ['saving', 50, 'fixed'], ['net', 30, 'fixed'], ['elec', 25, 'fixed'], ['water', 5, 'fixed'],
  ['fuel', 80, 'daily'], ['food', 80, 'daily'], ['ration', 40, 'daily'], ['fun', 40, 'daily'], ['oil', 15, 'daily'], ['laundry', 8, 'daily'], ['tailor', 22, 'temp'], ['laser', 12, 'temp'], ['emergency', 0, 'emergency']]
  .map(([id, budget, group]) => ({ id, name: id, group, budget, account: 'applepay' }));
const months = [];
let seq = 0;
for (let k = 0; k < 12; k++) {
  const d = new Date(2025, 11 + k, 1);
  const period = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const tx = [];
  for (let i = 0; i < 50; i++) { const c = cats[i % cats.length]; tx.push({ id: `t${seq++}`, catId: c.id, amount: Math.round((3 + ((i * 7919) % 60)) * 1000 / 7) / 1000, date: `${period}-${pad(1 + (i % 27))}`, note: i % 5 ? '' : 'قهوة', account: 'applepay', created: seq }); }
  months.push({ id: `m${k}`, period, label: `راتب شهر ${period}`, salary: 760, carryIn: 0, incomes: [{ id: `i${k}`, name: 'مكافأة', amount: 50, date: `${period}-10`, recurring: false }], sections, cards, categories: cats, transactions: tx });
}
const data = { schemaVersion: 6, debts: [], goals: [], activeId: 'm11', months };

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const b = await chromium.launch();
const runs = [];
for (let r = 0; r < RUNS; r++) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, offline: true });
  // بيانات محفوظة مسبقاً (كما لدى المستخدم)، وتسجيل وقت ظهور اللوحة والمهام الطويلة منذ بداية التحميل
  await ctx.addInitScript((d) => {
    if (!localStorage.getItem('salary-tracker-omr-v4')) localStorage.setItem('salary-tracker-omr-v4', JSON.stringify(d));
    window.__perf = { long: [], ready: null };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ }
    const probe = () => {
      if (!window.__perf.ready && document.querySelector('[aria-label^="تسجيل مصروف على "]') && document.querySelector('.balance-card, .salary-card')) { window.__perf.ready = performance.now(); mo.disconnect(); }
    };
    const mo = new MutationObserver(probe);
    mo.observe(document, { childList: true, subtree: true });
  }, data);
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Performance.enable');
  await p.goto(`file://${file}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__perf.ready != null, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const ready = window.__perf.ready;
    const tbt = window.__perf.long.filter(([s]) => s < ready + 1500).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    const longest = Math.max(0, ...window.__perf.long.map(([, d]) => d));
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || null;
    return { load: nav.loadEventEnd, dcl: nav.domContentLoadedEventEnd, fcp, ready, tbt, longest };
  });
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  m.script = metrics.ScriptDuration * 1000;
  m.heap = metrics.JSHeapUsedSize / 1048576;
  if (r === RUNS - 1) {
    // استجابة التفاعل (التطبيق مُحمّل): زمن النقرة حتى اكتمال العرض
    const timeClick = (find) => p.evaluate(async (src) => {
      // eslint-disable-next-line no-new-func
      const el = new Function(`return (${src})()`)();
      const t0 = performance.now(); el.click();
      await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      return performance.now() - t0;
    }, find.toString());
    const navBtn = (txt) => `() => [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === '${txt}')`;
    m.navStats = await timeClick(navBtn('التحليل'));
    m.navHome = await timeClick(navBtn('الرئيسية'));
    m.navTools = await timeClick(navBtn('الأدوات'));
    await timeClick(navBtn('الرئيسية'));
    await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.waitForTimeout(400);
    m.monthSwitch = await timeClick("() => [...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.includes('2026-06'))");
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: /تغيير الشهر/ }).click(); await p.waitForTimeout(400);
    await timeClick("() => [...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.includes('2026-11'))");
    await p.waitForTimeout(300);
    await p.getByRole('navigation').getByRole('button', { name: 'تسجيل مصروف' }).click(); await p.waitForTimeout(400);
    await p.selectOption('#f-cat', 'food'); await p.fill('#f-amount', '4.5');
    m.payment = await timeClick("() => [...document.querySelectorAll('button[type=submit]')].find((b) => b.textContent.includes('حفظ وخصم المبلغ'))");
  }
  runs.push(m);
  await ctx.close();
}
await b.close();
const html = readFileSync(file, 'utf8');
const inlineJs = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].reduce((a, x) => a + Buffer.byteLength(x[1]), 0);
const deferredJs = [...html.matchAll(/<script type="text\/x-deferred"[^>]*>([\s\S]*?)<\/script>/g)].reduce((a, x) => a + Buffer.byteLength(x[1]), 0);
const last = runs[runs.length - 1];
const out = {
  label, runs: RUNS, cpuThrottle: `${CPU}x`,
  fileKB: Math.round(statSync(file).size / 1024), startupJsKB: Math.round(inlineJs / 1024), deferredJsKB: Math.round(deferredJs / 1024),
  fcpMs: Math.round(median(runs.map((x) => x.fcp))), dashboardReadyMs: Math.round(median(runs.map((x) => x.ready))), loadMs: Math.round(median(runs.map((x) => x.load))),
  scriptMs: Math.round(median(runs.map((x) => x.script))), tbtMs: Math.round(median(runs.map((x) => x.tbt))), longestTaskMs: Math.round(median(runs.map((x) => x.longest))), heapMB: +median(runs.map((x) => x.heap)).toFixed(1),
  navStatsMs: Math.round(last.navStats), navHomeMs: Math.round(last.navHome), navToolsMs: Math.round(last.navTools), monthSwitchMs: Math.round(last.monthSwitch), paymentMs: Math.round(last.payment),
};
console.log(JSON.stringify(out));
