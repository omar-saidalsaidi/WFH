// حزمة مؤجّلة: مكتبة PDF (تُنفَّذ عند أول تصدير فقط)
import html2pdf from 'html2pdf.js';
window.__deferred = window.__deferred || {};
window.__deferred.pdf = html2pdf;
