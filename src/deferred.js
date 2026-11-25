// تهيئة مؤجّلة لمكتبات التصدير الثقيلة (PDF وExcel).
// المكتبتان مضمّنتان في الملف نفسه داخل <script type="text/x-deferred">، فلا يحلّلهما المتصفح ولا ينفّذهما عند الفتح،
// وتُنفَّذ كل منهما مرة واحدة فقط عند أول تصدير — دون أي اتصال بالشبكة، فيبقى الملف المستقل يعمل دون إنترنت.
const cache = {};
export function loadDeferred(name) {
  if (cache[name]) return Promise.resolve(cache[name]);
  try {
    const g = (window.__deferred = window.__deferred || {});
    if (!g[name]) {
      const src = document.getElementById(`deferred-${name}`);
      if (!src) throw new Error(`deferred library not found: ${name}`);
      const el = document.createElement('script');
      el.textContent = src.textContent; // تنفيذ متزامن عند الإلحاق
      document.head.appendChild(el);
      el.remove();
    }
    if (!g[name]) throw new Error(`deferred library failed to initialise: ${name}`);
    cache[name] = g[name];
    return Promise.resolve(cache[name]);
  } catch (e) {
    return Promise.reject(e);
  }
}
