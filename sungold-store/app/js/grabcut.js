// GrabCut (Rother و همکاران ۲۰۰۴): جداسازی محصول با کشیدن یک کادر دورش. بدون وابستگی؛ روی گوشی و Node اجرا می‌شود.
// برچسب‌ها مثل OpenCV: 0 پس‌زمینه‌ی قطعی، 1 پیش‌زمینه‌ی قطعی، 2 احتمالاً پس‌زمینه، 3 احتمالاً پیش‌زمینه.
import { GridGraph } from './maxflow.js';

const K = 5, GAMMA = 50, LAMBDA = 9 * GAMMA, SQRT1_2 = Math.SQRT1_2;
const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

class GMM {
  constructor() { this.coef = new Float64Array(K); this.mean = new Float64Array(K * 3); this.inv = new Float64Array(K * 9); this.det = new Float64Array(K); }
  comp(k, r, g, b) {
    if (this.coef[k] <= 0) return 0;
    const m = this.mean, v = this.inv, o = k * 3, q = k * 9, dr = r - m[o], dg = g - m[o + 1], db = b - m[o + 2];
    const e = dr * (v[q] * dr + v[q + 3] * dg + v[q + 6] * db) + dg * (v[q + 1] * dr + v[q + 4] * dg + v[q + 7] * db) + db * (v[q + 2] * dr + v[q + 5] * dg + v[q + 8] * db);
    return this.coef[k] / Math.sqrt(this.det[k]) * Math.exp(-0.5 * e);
  }
  prob(r, g, b) { let s = 0; for (let k = 0; k < K; k++) s += this.comp(k, r, g, b); return s; }
  which(r, g, b) { let best = 0, bv = -1; for (let k = 0; k < K; k++) { const p = this.comp(k, r, g, b); if (p > bv) { bv = p; best = k; } } return best; }
  /** idx: شماره‌ی پیکسل‌ها، comp: مؤلفه‌ی هر نمونه */
  learn(px, idx, comp) {
    const n = new Float64Array(K), s = new Float64Array(K * 3), p = new Float64Array(K * 9);
    for (let t = 0; t < idx.length; t++) {
      const k = comp[t], o = idx[t] * 4, r = px[o], g = px[o + 1], b = px[o + 2]; n[k]++;
      s[k * 3] += r; s[k * 3 + 1] += g; s[k * 3 + 2] += b;
      const q = k * 9; p[q] += r * r; p[q + 1] += r * g; p[q + 2] += r * b; p[q + 3] += g * r; p[q + 4] += g * g; p[q + 5] += g * b; p[q + 6] += b * r; p[q + 7] += b * g; p[q + 8] += b * b;
    }
    const total = idx.length || 1;
    for (let k = 0; k < K; k++) {
      if (!n[k]) { this.coef[k] = 0; continue; }
      this.coef[k] = n[k] / total;
      const mu = [s[k * 3] / n[k], s[k * 3 + 1] / n[k], s[k * 3 + 2] / n[k]]; this.mean.set(mu, k * 3);
      const c = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i * 3 + j] = p[k * 9 + i * 3 + j] / n[k] - mu[i] * mu[j];
      let d = det3(c); if (d <= 1e-6) { c[0] += 0.01; c[4] += 0.01; c[8] += 0.01; d = det3(c); }
      this.det[k] = d; const iv = inv3(c, d); for (let i = 0; i < 9; i++) this.inv[k * 9 + i] = iv[i];
    }
  }
}
const det3 = (c) => c[0] * (c[4] * c[8] - c[5] * c[7]) - c[1] * (c[3] * c[8] - c[5] * c[6]) + c[2] * (c[3] * c[7] - c[4] * c[6]);
const inv3 = (c, d) => [(c[4] * c[8] - c[5] * c[7]) / d, (c[2] * c[7] - c[1] * c[8]) / d, (c[1] * c[5] - c[2] * c[4]) / d, (c[5] * c[6] - c[3] * c[8]) / d, (c[0] * c[8] - c[2] * c[6]) / d, (c[2] * c[3] - c[0] * c[5]) / d, (c[3] * c[7] - c[4] * c[6]) / d, (c[1] * c[6] - c[0] * c[7]) / d, (c[0] * c[4] - c[1] * c[3]) / d];

/** k-means++ روی رنگ پیکسل‌ها؛ خروجی: مؤلفه‌ی هر پیکسل */
function kmeans(px, idx, iters = 10, seed = 1) {
  const rnd = rng(seed), n = idx.length, comp = new Uint8Array(n); if (!n) return comp;
  const sub = n > 20000 ? Array.from({ length: 20000 }, () => idx[(rnd() * n) | 0]) : Array.from(idx);
  const col = (i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const cen = [col(sub[(rnd() * sub.length) | 0])];
  while (cen.length < K) {
    const ds = sub.map((i) => Math.min(...cen.map((c) => d2(col(i), c)))), tot = ds.reduce((a, b) => a + b, 0);
    if (tot === 0) { cen.push(cen[0].slice()); continue; }
    let r = rnd() * tot, j = 0; while (j < ds.length - 1 && (r -= ds[j]) > 0) j++; cen.push(col(sub[j]));
  }
  for (let it = 0; it < iters; it++) {
    const sum = Array.from({ length: K }, () => [0, 0, 0, 0]);
    for (const i of sub) { const c = col(i); let b = 0, bd = Infinity; for (let k = 0; k < K; k++) { const dd = d2(c, cen[k]); if (dd < bd) { bd = dd; b = k; } } const s = sum[b]; s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; s[3]++; }
    for (let k = 0; k < K; k++) if (sum[k][3]) cen[k] = [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]];
  }
  for (let t = 0; t < n; t++) { const c = col(idx[t]); let b = 0, bd = Infinity; for (let k = 0; k < K; k++) { const dd = d2(c, cen[k]); if (dd < bd) { bd = dd; b = k; } } comp[t] = b; }
  return comp;
}

const isBg = (m) => m === 0 || m === 2;
/**
 * px: RGBA، rect: {x0,y0,x1,y1} (انتهای باز)، options.mask: برچسب‌های اولیه (برای اصلاح با قلم)
 * خروجی: { mask, fgd, bgd }. onProgress(iter, total) و yield: واگذاری نوبت به UI بین تکرارها.
 */
export async function grabCut(px, w, h, rect, { iters = 5, mask: init = null, onProgress = null, yieldUi = false } = {}) {
  const n = w * h, mask = init ? Uint8Array.from(init) : new Uint8Array(n).fill(0);
  if (!init) for (let y = Math.max(0, rect.y0); y < Math.min(h, rect.y1); y++) for (let x = Math.max(0, rect.x0); x < Math.min(w, rect.x1); x++) mask[y * w + x] = 3;
  // وزن همسایگی‌ها: چپ، بالا‌چپ، بالا، بالا‌راست (جهت‌های ۰ تا ۳ در گراف)
  const ddx = [-1, -1, 0, 1], ddy = [0, -1, -1, -1];
  const diff = (i, j) => { const a = i * 4, b = j * 4; return (px[a] - px[b]) ** 2 + (px[a + 1] - px[b + 1]) ** 2 + (px[a + 2] - px[b + 2]) ** 2; };
  let sum = 0, cnt = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let t = 0; t < 4; t++) { const xx = x + ddx[t], yy = y + ddy[t]; if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue; sum += diff(y * w + x, yy * w + xx); cnt++; }
  const beta = sum <= 1e-12 ? 0 : 1 / (2 * (sum / cnt));

  const bgdIdx = [], fgdIdx = [];
  const collect = () => { bgdIdx.length = 0; fgdIdx.length = 0; for (let i = 0; i < n; i++) (isBg(mask[i]) ? bgdIdx : fgdIdx).push(i); };
  collect();
  const bgd = new GMM(), fgd = new GMM();
  bgd.learn(px, bgdIdx, kmeans(px, bgdIdx, 10, 1)); fgd.learn(px, fgdIdx, kmeans(px, fgdIdx, 10, 2));
  const g = new GridGraph(w, h), clampLog = (p) => -Math.log(Math.max(p, 1e-30));

  for (let it = 0; it < iters; it++) {
    collect();
    const cb = new Uint8Array(bgdIdx.length), cf = new Uint8Array(fgdIdx.length);
    for (let t = 0; t < bgdIdx.length; t++) { const o = bgdIdx[t] * 4; cb[t] = bgd.which(px[o], px[o + 1], px[o + 2]); }
    for (let t = 0; t < fgdIdx.length; t++) { const o = fgdIdx[t] * 4; cf[t] = fgd.which(px[o], px[o + 1], px[o + 2]); }
    bgd.learn(px, bgdIdx, cb); fgd.learn(px, fgdIdx, cf);

    g.cap.fill(0); g.tc.fill(0); g.flow = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4, m = mask[i];
      if (m === 2 || m === 3) g.addTerm(i, clampLog(bgd.prob(px[o], px[o + 1], px[o + 2])), clampLog(fgd.prob(px[o], px[o + 1], px[o + 2])));
      else if (m === 0) g.addTerm(i, 0, LAMBDA); else g.addTerm(i, LAMBDA, 0);
      for (let t = 0; t < 4; t++) {
        const xx = x + ddx[t], yy = y + ddy[t]; if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        g.addEdge(i, t, (t === 0 || t === 2 ? GAMMA : GAMMA * SQRT1_2) * Math.exp(-beta * diff(i, yy * w + xx)));
      }
    }
    g.maxflow();
    for (let i = 0; i < n; i++) if (mask[i] === 2 || mask[i] === 3) mask[i] = g.inSource(i) ? 3 : 2;
    if (onProgress) onProgress(it + 1, iters);
    if (yieldUi) await new Promise((r) => setTimeout(r, 0));
  }
  return { mask, fgd, bgd };
}

/**
 * ماسک کم‌وضوح (gw×gh) را به تصویر کامل (w×h) می‌رساند و لبه‌ها را با مدل رنگی تیزتر می‌کند.
 * خروجی: Float32Array آلفا ۰..۱ (اندازه‌ی w×h)
 */
export function upscaleAlpha(lowMask, gw, gh, px, w, h, fgd, bgd) {
  const a = new Float32Array(w * h), fx = gw / w, fy = gh / h;
  const v = (x, y) => { x = Math.min(gw - 1, Math.max(0, x)); y = Math.min(gh - 1, Math.max(0, y)); return lowMask[y * gw + x] & 1; };
  for (let y = 0; y < h; y++) {
    const sy = (y + 0.5) * fy - 0.5, y0 = Math.floor(sy), ty = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5) * fx - 0.5, x0 = Math.floor(sx), tx = sx - x0;
      const prior = (v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx) * (1 - ty) + (v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx) * ty;
      if (prior <= 0.001 || prior >= 0.999) { a[y * w + x] = prior > 0.5 ? 1 : 0; continue; }
      const o = (y * w + x) * 4, pf = fgd.prob(px[o], px[o + 1], px[o + 2]), pb = bgd.prob(px[o], px[o + 1], px[o + 2]);
      const d = Math.max(-8, Math.min(8, Math.log(Math.max(pf, 1e-30)) - Math.log(Math.max(pb, 1e-30))));
      a[y * w + x] = 1 / (1 + Math.exp(-(10 * (2 * prior - 1) + 0.6 * d)));
    }
  }
  return a;
}

/** میانگین‌گیری ۳×۳ فقط روی آلفا + تبدیل به RGBA (رنگ‌ها دست‌نخورده) */
export function applyAlpha(px, w, h, a, feather = 1) {
  let cur = a;
  for (let r = 0; r < feather; r++) {
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; s += cur[yy * w + xx]; c++; } }
      b[y * w + x] = cur[y * w + x] <= 0 ? 0 : s / c;                              // فقط به سمت داخل نرم می‌شود
    }
    cur = b;
  }
  const out = new Uint8ClampedArray(px);
  for (let i = 0; i < w * h; i++) out[i * 4 + 3] = Math.round(cur[i] * 255);
  return out;
}

/** کوچک‌کردن RGBA با میانگین‌گیری جعبه‌ای (برای اجرای سریع GrabCut) */
export function downscale(px, w, h, maxSide) {
  const k = Math.min(1, maxSide / Math.max(w, h)); if (k >= 1) return { px, w, h, k: 1 };
  const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k)), out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) { const y0 = Math.floor(y / k), y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) / k)));
    for (let x = 0; x < nw; x++) { const x0 = Math.floor(x / k), x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) / k))); let r = 0, g = 0, b = 0, c = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const o = (yy * w + xx) * 4; r += px[o]; g += px[o + 1]; b += px[o + 2]; c++; }
      const o = (y * nw + x) * 4; out[o] = r / c; out[o + 1] = g / c; out[o + 2] = b / c; out[o + 3] = 255; } }
  return { px: out, w: nw, h: nh, k };
}

/** اجزای «سوراخ»: ناحیه‌های غیرمحصول که از لبه‌ی تصویر به آن‌ها راه نیست. lab[i] = شماره‌ی سوراخ (۰ = سوراخ نیست) */
export function holeMap(fg, w, h) {
  const n = w * h, bg = new Uint8Array(n), stack = new Int32Array(n), lab = new Int32Array(n); let sp = 0, count = 0;
  const nb = (i, f) => { const x = i % w, y = (i / w) | 0; if (x > 0) f(i - 1); if (x < w - 1) f(i + 1); if (y > 0) f(i - w); if (y < h - 1) f(i + w); };
  const push = (i) => { if (!fg[i] && !bg[i]) { bg[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) { const i = stack[--sp]; nb(i, push); }
  for (let s0 = 0; s0 < n; s0++) {
    if (fg[s0] || bg[s0] || lab[s0]) continue;
    count++; lab[s0] = count; sp = 0; stack[sp++] = s0;
    while (sp) { const i = stack[--sp]; nb(i, (j) => { if (!fg[j] && !bg[j] && !lab[j]) { lab[j] = count; stack[sp++] = j; } }); }
  }
  return { lab, count };
}

/**
 * تمیزکاری ماسک: ذره‌های جداافتاده حذف می‌شود و سوراخ‌های بسته‌ی داخل محصول پر می‌شود
 * (مثلاً نوشته‌ی تیره‌ی روی جعبه که شبیه پس‌زمینه‌ی تیره دیده شده). open: مجموعه‌ی شماره‌ی سوراخ‌هایی که باید باز بمانند
 * (مثلاً سوراخ دسته). خروجی: ماسک ۰/۱.
 */
export function cleanMask(mask, w, h, { fillHoles = true, speckle = 0.02, open = null } = {}) {
  const n = w * h, fg = new Uint8Array(n), stack = new Int32Array(n);
  for (let i = 0; i < n; i++) fg[i] = mask[i] & 1;
  const lab = new Int32Array(n), sizes = [0]; let comp = 0;
  const nb = (i, f) => { const x = i % w, y = (i / w) | 0; if (x > 0) f(i - 1); if (x < w - 1) f(i + 1); if (y > 0) f(i - w); if (y < h - 1) f(i + w); };
  for (let s = 0; s < n; s++) {
    if (!fg[s] || lab[s]) continue;
    comp++; let c = 0, sp = 0; lab[s] = comp; stack[sp++] = s;
    while (sp) { const i = stack[--sp]; c++; nb(i, (j) => { if (fg[j] && !lab[j]) { lab[j] = comp; stack[sp++] = j; } }); }
    sizes[comp] = c;
  }
  const big = Math.max(0, ...sizes);
  for (let i = 0; i < n; i++) if (fg[i] && sizes[lab[i]] < big * speckle) fg[i] = 0;
  if (fillHoles) { const hm = holeMap(fg, w, h); for (let i = 0; i < n; i++) if (hm.lab[i] && !(open && open.has(hm.lab[i]))) fg[i] = 1; }
  return fg;
}
