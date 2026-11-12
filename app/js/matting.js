// حذف پس‌زمینه‌ی ساده (برای عکس محصول روی دیوار/میز/کاغذ یک‌رنگ) و چیدمان خروجی.
// بدون وابستگی به DOM؛ روی داده‌ی RGBA (Uint8ClampedArray) کار می‌کند و در Node هم تست می‌شود.

const smooth = (lo, hi, x) => { const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo || 1))); return t * t * (3 - 2 * t); };
const median = (a) => { if (!a.length) return 255; a.sort((x, y) => x - y); return a[a.length >> 1]; };

/** رنگ پس‌زمینه = میانه‌ی رنگ پیکسل‌های حاشیه‌ی تصویر */
export function estimateBg(d, w, h) {
  const t = Math.max(2, Math.round(Math.min(w, h) * 0.02)), step = Math.max(1, Math.floor(Math.max(w, h) / 400));
  const R = [], G = [], B = [];
  const take = (x, y) => { const i = (y * w + x) * 4; if (d[i + 3] < 128) return; R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]); };
  for (let y = 0; y < h; y += step) {
    if (y < t || y >= h - t) { for (let x = 0; x < w; x += step) take(x, y); }
    else { for (let x = 0; x < t; x += step) take(x, y); for (let x = w - t; x < w; x += step) take(x, y); }
  }
  return [median(R), median(G), median(B)];
}

/**
 * پس‌زمینه‌ای را حذف می‌کند که از لبه‌ی تصویر به آن راه دارد و رنگش به رنگ پس‌زمینه نزدیک است.
 * tol: ۰ تا ۱۰۰ (حساسیت). fill: پاک‌کردن فضاهای بسته‌ی هم‌رنگ پس‌زمینه (مثلاً سوراخ دسته‌ی کیف).
 * خروجی: { data (RGBA جدید), coverage (سهم بخش باقی‌مانده)، bg }
 */
export function removeBg(d, w, h, { bg, tol = 35, fill = false, speckle = 0.02, feather = 1 } = {}) {
  const n = w * h, [br, bgg, bb] = bg || estimateBg(d, w, h);
  const lo = 4 + tol * 0.7, hi = lo + 10 + tol * 0.35;
  const bgn = new Float32Array(n);                         // ۱ = کاملاً شبیه پس‌زمینه
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (d[p + 3] < 8) { bgn[i] = 1; continue; }
    const dr = d[p] - br, dg = d[p + 1] - bgg, db = d[p + 2] - bb;
    bgn[i] = 1 - smooth(lo, hi, Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9));
  }
  const out = new Uint8Array(n), stack = new Int32Array(n); let sp = 0;
  const push = (i) => { if (!out[i] && bgn[i] > 0.5) { out[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  if (fill) for (let i = 0; i < n; i++) if (bgn[i] > 0.9) push(i);
  while (sp) {
    const i = stack[--sp], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  // آلفا: پس‌زمینه‌ی متصل = ۰؛ پیکسل‌های مرزی نیمه‌شفاف
  let a = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) if (out[i]) a[i] = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (out[i] || bgn[i] <= 0) continue;
    if ((x > 0 && out[i - 1]) || (x < w - 1 && out[i + 1]) || (y > 0 && out[i - w]) || (y < h - 1 && out[i + w])) a[i] = 1 - bgn[i];
  }
  // ذره‌های کوچک جداافتاده (گردوخاک) حذف می‌شود؛ اجزای بزرگ (مثلاً دو گوشواره) می‌ماند
  const lab = new Int32Array(n), sizes = [0]; let comp = 0;
  for (let s = 0; s < n; s++) {
    if (lab[s] || a[s] <= 0.5) continue;
    comp++; let cnt = 0; lab[s] = comp; stack[0] = s; sp = 1;
    while (sp) {
      const i = stack[--sp]; cnt++; const x = i % w, y = (i / w) | 0;
      const q = (j) => { if (!lab[j] && a[j] > 0.5) { lab[j] = comp; stack[sp++] = j; } };
      if (x > 0) q(i - 1); if (x < w - 1) q(i + 1); if (y > 0) q(i - w); if (y < h - 1) q(i + w);
    }
    sizes[comp] = cnt;
  }
  const biggest = Math.max(0, ...sizes);
  for (let i = 0; i < n; i++) if (lab[i] && sizes[lab[i]] < biggest * speckle) a[i] = 0;
  // نرم‌کردن لبه فقط به سمت داخل محصول (پیکسل‌های پس‌زمینه هرگز آلفا نمی‌گیرند تا هاله نماند)
  const a0 = Float32Array.from(a);
  for (let r = 0; r < feather; r++) {
    const b = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; s += a[yy * w + xx]; c++; } }
      b[y * w + x] = out[y * w + x] ? 0 : s / c;
    }
    a = b;
  }
  // خروجی + حذف هاله‌ی رنگ پس‌زمینه از لبه‌ها
  const res = new Uint8ClampedArray(d), bgc = [br, bgg, bb]; let opaque = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const al = a[i]; res[p + 3] = Math.round(al * 255);
    if (al > 0.5) opaque++;
    const m = a0[i];                                          // فقط پیکسل‌های واقعاً مخلوط با پس‌زمینه اصلاح رنگ می‌شوند
    if (m > 0.2 && m < 0.98) for (let c = 0; c < 3; c++) res[p + c] = Math.min(255, Math.max(0, (d[p + c] - bgc[c] * (1 - m)) / m));
  }
  return { data: res, coverage: opaque / n, bg: bgc };
}

/** کادر دربرگیرنده‌ی بخش مات: {x0,y0,x1,y1} (x1/y1 انتهای باز) یا null */
export function bbox(d, w, h, thr = 8) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** اندازه‌ی بوم خروجی: ratio = '1:1' | '4:5' | 'orig'؛ size = ضلع بلند */
export function outSize(ratio, size, bw, bh) {
  if (ratio === '1:1') return { w: size, h: size };
  if (ratio === '4:5') return { w: Math.round(size * 0.8), h: size };
  const k = size / Math.max(bw, bh); return { w: Math.max(1, Math.round(bw * k)), h: Math.max(1, Math.round(bh * k)) };
}

/** جاگذاری محصول وسط بوم با حاشیه‌ی pad (کسری از ضلع، ۰ تا ۰٫۳) */
export function fitRect(bw, bh, cw, ch, pad = 0.08) {
  const k = Math.min((cw * (1 - 2 * pad)) / bw, (ch * (1 - 2 * pad)) / bh);
  const dw = Math.max(1, Math.round(bw * k)), dh = Math.max(1, Math.round(bh * k));
  return { dw, dh, dx: Math.round((cw - dw) / 2), dy: Math.round((ch - dh) / 2), scale: k };
}
