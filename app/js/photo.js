// استودیوی عکس: عکس خام را برای سایت آماده می‌کند (حذف پس‌زمینه، برش، حاشیه، پس‌زمینه‌ی سفید/شفاف، تغییر اندازه، WebP).
// همه‌چیز روی خود گوشی انجام می‌شود؛ عکس به‌جایی فرستاده نمی‌شود (جز «حذف هوشمند» که در iframe ایزوله اجرا می‌شود).
import { h, debounce } from './dom.js';
import { icon } from './icons.js';
import { removeBg, bbox, outSize, fitRect } from './matting.js';

const WORK = 1600;

/* ---------- پل ارتباطی با موتور هوشمند (iframe ایزوله بدون دسترسی به رمز و تنظیمات اپ) ---------- */
let aiFrame = null, aiReady = null, aiOnReady = null, aiSeq = 0;
const aiWait = new Map();
function onAiMsg(ev) {
  if (!aiFrame || ev.source !== aiFrame.contentWindow) return;
  const m = ev.data || {};
  if (m.type === 'ready') { if (aiOnReady) aiOnReady(); return; }
  const w = aiWait.get(m.id); if (!w) return;
  if (m.type === 'progress') { w.onProgress(String(m.text || '')); return; }
  aiWait.delete(m.id);
  if (m.type === 'done' && m.blob) w.res(m.blob); else w.rej(new Error(String(m.message || 'حذف هوشمند انجام نشد.')));
}
function aiStart() {
  if (aiReady) return aiReady;
  aiFrame = h('iframe', { src: 'studio-ai.html', sandbox: 'allow-scripts', hidden: true, title: 'موتور حذف هوشمند پس‌زمینه', 'aria-hidden': 'true' });
  aiReady = new Promise((res, rej) => {
    const to = setTimeout(() => { aiFrame.remove(); aiFrame = null; aiReady = null; rej(new Error('موتور هوشمند بارگذاری نشد. اینترنت را بررسی کنید.')); }, 15000);
    aiOnReady = () => { clearTimeout(to); res(); };
  });
  addEventListener('message', onAiMsg);
  document.body.append(aiFrame);
  return aiReady;
}
async function aiRun(blob, onProgress) {
  await aiStart();
  const id = ++aiSeq;
  return new Promise((res, rej) => {
    const to = setTimeout(() => { aiWait.delete(id); rej(new Error('زمان حذف هوشمند تمام شد. با اینترنت بهتر دوباره امتحان کنید.')); }, 180000);
    aiWait.set(id, { res: (b) => { clearTimeout(to); res(b); }, rej: (e) => { clearTimeout(to); rej(e); }, onProgress });
    aiFrame.contentWindow.postMessage({ type: 'run', id, blob }, '*');
  });
}

/* ---------- کمکی‌ها ---------- */
async function loadWork(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
  const k = Math.min(1, WORK / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), hh = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0, w, hh); bmp.close && bmp.close();
  return { cv, w, h: hh, data: cx.getImageData(0, 0, w, hh) };
}
const toBlob = (cv, type, q) => new Promise((res) => cv.toBlob(res, type, q));
const kb = (n) => (n < 1024 * 1024 ? Math.round(n / 1024) + ' کیلوبایت' : (n / 1048576).toFixed(1) + ' مگابایت');

function seg(opts, get, set, label) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const draw = () => wrap.replaceChildren(...opts.map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(get() === k), class: get() === k ? 'on' : '', onclick: () => { set(k); draw(); } }, l)));
  draw(); return wrap;
}
const row = (label, control, help) => h('div', { class: 'field' }, h('label', { class: 'lbl' }, label), control, help ? h('div', { class: 'help' }, help) : null);
function range(min, max, get, set, label) {
  const el = h('input', { type: 'range', class: 'rng', min, max, step: 1, 'aria-label': label }); el.value = get();
  el.addEventListener('input', () => set(+el.value)); return el;
}

/**
 * onUse(file) → Promise؛ پس از موفقیت، استودیو بسته می‌شود.
 * file: عکس خام انتخاب‌شده‌ی کاربر.
 */
export async function openStudio(ctx, file, { onUse, useLabel = 'استفاده برای محصول' } = {}) {
  const S = { w: 0, h: 0, src: null, method: 'simple', tol: 35, bg: null, fill: false, ratio: '1:1', pad: 8, bgm: 'white', color: '#ffffff', shadow: true, size: 1200, ai: null, picking: false, busy: false, blob: null, cov: 1, aiMsg: '' };
  let cut = null, cutKey = '', closed = false;
  const out = h('canvas', { class: 'pv-cv', role: 'img', 'aria-label': 'پیش‌نمایش عکس آماده' });
  const pick = h('canvas', { class: 'pv-cv', hidden: true, role: 'img', 'aria-label': 'عکس اصلی؛ روی رنگ پس‌زمینه بزنید' });
  const tmp = document.createElement('canvas');
  const pv = h('div', { class: 'pv' }, out, pick);
  const info = h('div', { class: 'help pv-i', 'aria-live': 'polite' });
  const warn = h('div', { class: 'msg warn', hidden: true });
  const ctl = h('div', { class: 'studio-ctl' });
  const prevOverflow = document.body.style.overflow;

  const close = () => { if (closed) return; closed = true; document.body.style.overflow = prevOverflow; removeEventListener('keydown', onKey); out.width = out.height = tmp.width = tmp.height = 0; ov.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const useBtn = h('button', { type: 'button', class: 'btn primary', disabled: true }, onUse ? useLabel : 'ذخیره');
  const saveBtn = h('button', { type: 'button', class: 'btn ghost', disabled: true }, icon('download', 18), 'ذخیره در گوشی');
  const ov = h('div', { class: 'studio', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'آماده‌سازی عکس' },
    h('div', { class: 'studio-h' }, h('h2', {}, 'آماده‌سازی عکس'), h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'بستن', onclick: close }, icon('close', 20))),
    h('div', { class: 'studio-b' }, pv, info, warn, ctl),
    h('div', { class: 'bar studio-bar' }, h('div', { class: 'bar-a' }, saveBtn, onUse ? useBtn : null)));
  document.body.append(ov); document.body.style.overflow = 'hidden'; addEventListener('keydown', onKey);
  ov.querySelector('.iconbtn').focus();

  try { S.src = await loadWork(file); S.w = S.src.w; S.h = S.src.h; }
  catch { ctx.toast('این فایل به‌عنوان عکس باز نشد.', 'bad'); close(); return; }

  /* ----- محاسبه‌ی برش و ترکیب نهایی ----- */
  function computeCut() {
    if (S.method === 'none') return S.src.data;
    if (S.method === 'ai') return S.ai;
    const key = [S.tol, S.fill, S.bg ? S.bg.join() : ''].join('|');
    if (!cut || cutKey !== key) {
      const r = removeBg(S.src.data.data, S.w, S.h, { tol: S.tol, fill: S.fill, bg: S.bg || undefined });
      cut = new ImageData(r.data, S.w, S.h); S.cov = r.coverage; cutKey = key;
    }
    return cut;
  }
  function render() {
    if (closed) return;
    const img = computeCut();
    pick.hidden = !S.picking; out.hidden = S.picking;
    if (S.picking) { pick.width = S.w; pick.height = S.h; pick.getContext('2d').drawImage(S.src.cv, 0, 0); return; }
    if (!img) { const cx = out.getContext('2d'); out.width = S.w; out.height = S.h; cx.drawImage(S.src.cv, 0, 0); info.textContent = S.aiMsg || 'برای حذف هوشمند، دکمه‌ی «اجرای حذف هوشمند» را بزنید.'; setReady(false); return; }
    const box = (S.method === 'none' ? null : bbox(img.data, S.w, S.h, 8)) || { x0: 0, y0: 0, x1: S.w, y1: S.h };
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0, o = outSize(S.ratio, S.size, bw, bh);
    out.width = o.w; out.height = o.h;
    const cx = out.getContext('2d'), transparent = S.bgm === 'none';
    cx.clearRect(0, 0, o.w, o.h);
    if (!transparent) { cx.fillStyle = S.bgm === 'white' ? '#ffffff' : S.bgm === 'gray' ? '#f2f2f2' : S.color; cx.fillRect(0, 0, o.w, o.h); }
    const f = fitRect(bw, bh, o.w, o.h, S.pad / 100);
    tmp.width = S.w; tmp.height = S.h; tmp.getContext('2d').putImageData(img, 0, 0);
    if (S.shadow && !transparent && S.method !== 'none') {
      const rx = f.dw * 0.42, ry = Math.max(6, f.dh * 0.05);
      cx.save(); cx.translate(o.w / 2, f.dy + f.dh - ry * 0.4); cx.scale(1, ry / rx);
      const g = cx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, rx, 0, Math.PI * 2); cx.fill(); cx.restore();
    }
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(tmp, box.x0, box.y0, bw, bh, f.dx, f.dy, f.dw, f.dh);
    pv.classList.toggle('checker', transparent && S.method !== 'none');
    warn.hidden = true;
    if (S.method === 'simple') {
      if (S.cov < 0.03) { warn.hidden = false; warn.textContent = 'تقریباً همه‌چیز حذف شد. حساسیت را کمتر کنید یا رنگ پس‌زمینه را از روی عکس انتخاب کنید.'; }
      else if (S.cov > 0.97) { warn.hidden = false; warn.textContent = 'پس‌زمینه جدا نشد. حساسیت را بیشتر کنید، رنگ پس‌زمینه را انتخاب کنید یا «هوشمند» را امتحان کنید.'; }
    }
    S.blob = null; setReady(false); makeBlob();
  }
  const setReady = (v) => { useBtn.disabled = saveBtn.disabled = !v || S.busy; };
  const makeBlob = debounce(async () => {
    if (closed || S.picking) return;
    let b = await toBlob(out, 'image/webp', 0.86);
    if (b && b.type !== 'image/webp' && S.bgm !== 'none') b = await toBlob(out, 'image/jpeg', 0.88);
    if (!b || closed) return;
    S.blob = b; setReady(true);
    info.textContent = `${out.width}×${out.height} پیکسل · ${kb(b.size)} · ${b.type.split('/')[1].toUpperCase()}`;
  }, 300);
  const rerender = debounce(render, 90);
  const ensureBlob = async () => { if (!S.blob) { await toBlob(out, 'image/webp', 0.86).then((b) => { S.blob = b; }); } return S.blob; };
  const fileOf = (b) => new File([b], `product-${Date.now()}.${(b.type.split('/')[1] || 'webp').replace('jpeg', 'jpg')}`, { type: b.type });

  /* ----- حذف هوشمند ----- */
  const aiBtn = h('button', { type: 'button', class: 'btn sm' }, icon('wand', 18), 'اجرای حذف هوشمند');
  aiBtn.onclick = async () => {
    aiBtn.disabled = true; aiBtn.classList.add('busy'); S.aiMsg = 'در حال آماده‌سازی… (بار اول چند ده مگابایت دانلود می‌شود)'; info.textContent = S.aiMsg;
    try {
      const png = await toBlob(S.src.cv, 'image/png');
      const res = await aiRun(png, (t) => { S.aiMsg = t; info.textContent = t; });
      const bmp = await createImageBitmap(res);
      const c = document.createElement('canvas'); c.width = S.w; c.height = S.h;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, S.w, S.h);
      S.ai = x.getImageData(0, 0, S.w, S.h); S.aiMsg = ''; if (!closed) render();
    } catch (e) { S.aiMsg = e.message; ctx.toast(e.message, 'bad'); if (!closed) render(); }
    finally { aiBtn.disabled = false; aiBtn.classList.remove('busy'); }
  };

  /* ----- چکاننده‌ی رنگ پس‌زمینه ----- */
  pick.addEventListener('click', (e) => {
    const r = pick.getBoundingClientRect(), x = Math.round((e.clientX - r.left) / r.width * S.w), y = Math.round((e.clientY - r.top) / r.height * S.h);
    const d = S.src.cv.getContext('2d').getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data; let R = 0, G = 0, B = 0;
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
    S.bg = [R, G, B].map((v) => Math.round(v / (d.length / 4))); S.picking = false; drawCtl(); render();
  });

  /* ----- کنترل‌ها ----- */
  function drawCtl() {
    const simple = h('div', { class: S.method === 'simple' ? '' : 'hide' },
      row('حساسیت حذف پس‌زمینه', range(0, 100, () => S.tol, (v) => { S.tol = v; rerender(); }, 'حساسیت'), 'اگر بخشی از محصول پاک شد کمتر کنید؛ اگر پس‌زمینه ماند بیشتر.'),
      h('div', { class: 'btnrow' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => { S.picking = !S.picking; drawCtl(); render(); } }, icon('palette', 18), S.picking ? 'روی رنگ پس‌زمینه بزنید…' : (S.bg ? 'انتخاب دوباره‌ی رنگ پس‌زمینه' : 'انتخاب رنگ پس‌زمینه از عکس')),
        S.bg ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { S.bg = null; drawCtl(); render(); } }, 'تشخیص خودکار') : null),
      toggle('پاک‌کردن فضاهای بسته (مثلاً سوراخ دسته)', () => S.fill, (v) => { S.fill = v; render(); }));
    const ai = h('div', { class: S.method === 'ai' ? '' : 'hide' }, h('div', { class: 'btnrow' }, aiBtn), h('p', { class: 'help' }, 'آزمایشی: برای پس‌زمینه‌های شلوغ. اینترنت لازم است و بار اول چند ده مگابایت دانلود می‌شود. عکس روی گوشی پردازش می‌شود.'));
    ctl.replaceChildren(...[
      row('حذف پس‌زمینه', seg([['simple', 'ساده'], ['ai', 'هوشمند'], ['none', 'بدون حذف']], () => S.method, (k) => { S.method = k; S.picking = false; drawCtl(); render(); }, 'روش حذف پس‌زمینه'), S.method === 'simple' ? 'مناسب عکس روی دیوار، میز یا کاغذ یک‌رنگ.' : null),
      simple, ai,
      row('نسبت تصویر', seg([['1:1', 'مربع'], ['4:5', 'عمودی ۴:۵'], ['orig', 'اصلی']], () => S.ratio, (k) => { S.ratio = k; render(); }, 'نسبت تصویر')),
      row('حاشیه دور محصول', range(0, 25, () => S.pad, (v) => { S.pad = v; rerender(); }, 'حاشیه')),
      row('پس‌زمینه‌ی جدید', seg([['white', 'سفید'], ['gray', 'خاکستری'], ['color', 'رنگی'], ['none', 'شفاف']], () => S.bgm, (k) => { S.bgm = k; drawCtl(); render(); }, 'پس‌زمینه‌ی جدید')),
      S.bgm === 'color' ? row('رنگ پس‌زمینه', (() => { const i = h('input', { type: 'color', class: 'in clr', 'aria-label': 'رنگ پس‌زمینه' }); i.value = S.color; i.addEventListener('input', () => { S.color = i.value; rerender(); }); return i; })()) : null,
      toggle('سایه‌ی نرم زیر محصول', () => S.shadow, (v) => { S.shadow = v; render(); }),
      row('اندازه‌ی خروجی', seg([[800, '۸۰۰'], [1200, '۱۲۰۰'], [1600, '۱۶۰۰']], () => S.size, (k) => { S.size = k; render(); }, 'اندازه‌ی خروجی (پیکسل)'), 'برای فروشگاه ۱۲۰۰ مناسب است؛ کمتر = سایت سریع‌تر.')].filter(Boolean));
  }
  function toggle(label, get, set) {
    const i = h('input', { type: 'checkbox', role: 'switch', 'aria-label': label }); i.checked = !!get(); i.addEventListener('change', () => set(i.checked));
    return h('div', { class: 'field inline' }, h('div', { class: 'field-t' }, h('label', { class: 'lbl' }, label)), h('label', { class: 'switch' }, i, h('span', { class: 'sw' })));
  }

  /* ----- دکمه‌های پایین ----- */
  saveBtn.onclick = async () => {
    const b = await ensureBlob(); if (!b) return;
    const a = h('a', { href: URL.createObjectURL(b), download: fileOf(b).name }); document.body.append(a); a.click(); a.remove();
    ctx.toast('عکس در گوشی ذخیره شد', 'ok');
  };
  useBtn.onclick = async () => {
    const b = await ensureBlob(); if (!b || !onUse) return;
    S.busy = true; useBtn.disabled = saveBtn.disabled = true; useBtn.classList.add('busy');
    try { await onUse(fileOf(b)); close(); }
    catch (e) { ctx.toast(e.message || 'ارسال عکس ناموفق بود.', 'bad'); S.busy = false; useBtn.classList.remove('busy'); setReady(!!S.blob); }
  };

  drawCtl(); render();
}
