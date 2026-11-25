// حزمة مؤجّلة: مكتبة Excel (تُنفَّذ عند أول تصدير فقط)
import * as XLSX from 'xlsx';
window.__deferred = window.__deferred || {};
window.__deferred.xlsx = XLSX;
