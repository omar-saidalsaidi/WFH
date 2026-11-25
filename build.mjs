// يبني ملف HTML واحد مستقل: React + Tailwind + Lucide مضمنة بالكامل
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
const opts = { bundle: true, minify: true, write: false, format: 'iife', target: ['es2019', 'safari13'], jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } };
const js = await build({ ...opts, entryPoints: ['src/main.jsx'] });
// مكتبات التصدير الثقيلة تُبنى منفصلة وتُضمَّن كنص خامل (لا يُحلَّل عند الفتح) — راجع src/deferred.js
const lazy = {};
for (const name of ['pdf', 'xlsx']) {
  const r = await build({ ...opts, entryPoints: [`src/lazy/${name}.js`] });
  lazy[name] = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}
execSync('npx tailwindcss -i src/index.css -o dist/app.css --minify', { stdio: 'inherit' });
const css = readFileSync('dist/app.css', 'utf8');
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const head = `<title>تتبع مصاريف الراتب</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" media="print" onload="this.media='all'">
<style>${css}</style>`;
const deferred = Object.entries(lazy).map(([n, c]) => `<script type="text/x-deferred" id="deferred-${n}">${c}</script>`).join('\n');
const body = `<div id="root" dir="rtl" lang="ar"></div>\n<script>${code}</script>\n${deferred}`;

// نسخة للعارض (بدون هيكل الصفحة)
writeFileSync('dist/artifact.html', `${head}\n${body}\n`);
// نسخة مستقلة تفتح مباشرة في المتصفح وتدعم الطباعة
writeFileSync('index.html', `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0F172A">
<meta name="apple-mobile-web-app-capable" content="yes">
${head}
</head>
<body>
${body}
</body>
</html>
`);
console.log('built', `${(code.length / 1024).toFixed(0)}KB startup js`, `${(Object.values(lazy).reduce((a, c) => a + c.length, 0) / 1024).toFixed(0)}KB deferred js`, `${(css.length / 1024).toFixed(0)}KB css`);
