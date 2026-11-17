// ساخت DOM بدون فریم‌ورک. محتوای کاربر فقط با textContent وارد می‌شود (ضد XSS).
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const mount = (root, ...kids) => root.replaceChildren(...kids.flat(Infinity).filter(Boolean));
let tt;
export function toast(msg, kind = '') {
  let el = $('#toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.textContent = msg; el.className = 'show ' + kind;
  clearTimeout(tt); tt = setTimeout(() => { el.className = ''; }, 4200);
}
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
