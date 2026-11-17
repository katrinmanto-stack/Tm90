// تست GrabCut روی تصویر ساختگی با پس‌زمینه‌ی شلوغ: node tools/test-grabcut.mjs
// (روی همین صحنه و روی عکس واقعی، خروجی با grabCut خود OpenCV مقایسه شده: IoU = 1٫۰۰۰ و ۰٫۹۷۷؛ محصول کرم روی راه‌راه سفید برای هر دو الگوریتم دشوار است.)
import assert from 'node:assert/strict';
import { grabCut, upscaleAlpha, applyAlpha, downscale, cleanMask, holeMap } from '../app/js/grabcut.js';

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const W = 160, H = 120;
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// پس‌زمینه: راه‌راه خاکستری/مشکی/سفید + لکه‌ی سبز (برگ) + میز سفید؛ محصول: جعبه‌ی کرم با نوشته‌ی تیره‌ی داخلش
function scene() {
  const px = new Uint8ClampedArray(W * H * 4), truth = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; let c;
    const m = x % 20;
    c = m < 14 ? [165, 165, 168] : m < 17 ? [18, 18, 20] : [250, 250, 250];
    if (y > 98) c = [238, 238, 238];                                 // میز
    if ((x - 15) ** 2 + (y - 40) ** 2 < 220) c = [60, 130, 50];       // برگ
    const inBox = x >= 55 && x < 105 && y >= 40 && y < 100;
    if (inBox) { c = [214, 196, 160]; truth[y * W + x] = 1; if (x >= 60 && x < 100 && y >= 85 && y < 90) c = [25, 25, 25]; if ((x - 80) ** 2 + (y - 62) ** 2 < 100) c = [40, 170, 180]; }
    const j = (rnd() * 6 - 3) | 0; px[o] = c[0] + j; px[o + 1] = c[1] + j; px[o + 2] = c[2] + j; px[o + 3] = 255;
  }
  return { px, truth };
}
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k] > 0, y = b[k] > 0; if (x && y) i++; if (x || y) u++; } return i / u; };

await t('GrabCut: محصول از پس‌زمینه‌ی شلوغ جدا می‌شود (IoU > 0.95)', async () => {
  const { px, truth } = scene();
  const r = await grabCut(px, W, H, { x0: 50, y0: 35, x1: 110, y1: 104 }, { iters: 5 });
  const fg = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) fg[i] = r.mask[i] & 1;
  const v = iou(fg, truth); assert.ok(v > 0.95, 'IoU=' + v.toFixed(3));
});
await t('cleanMask: حفره‌ی بسته پر می‌شود و ذره‌ی جداافتاده حذف', async () => {
  const w = 40, h = 30, m = new Uint8Array(w * h);
  for (let y = 5; y < 25; y++) for (let x = 8; x < 32; x++) m[y * w + x] = 1;
  for (let y = 12; y < 16; y++) for (let x = 15; x < 20; x++) m[y * w + x] = 0;      // حفره
  m[2 * w + 2] = 1; m[2 * w + 3] = 1;                                                // ذره
  const f = cleanMask(m, w, h, { fillHoles: true }); assert.equal(f[13 * w + 17], 1, 'حفره'); assert.equal(f[2 * w + 2], 0, 'ذره'); assert.equal(f[10 * w + 10], 1);
  const k = cleanMask(m, w, h, { fillHoles: false }); assert.equal(k[13 * w + 17], 0, 'نگه‌داشتن سوراخ');
});
await t('holeMap/cleanMask: باز نگه‌داشتن یک سوراخ مشخص', async () => {
  const w = 40, h = 30, m = new Uint8Array(w * h);
  for (let y = 5; y < 25; y++) for (let x = 8; x < 32; x++) m[y * w + x] = 1;
  for (let y = 8; y < 11; y++) for (let x = 12; x < 16; x++) m[y * w + x] = 0;       // سوراخ ۱
  for (let y = 15; y < 19; y++) for (let x = 20; x < 26; x++) m[y * w + x] = 0;      // سوراخ ۲
  const hm = holeMap(Uint8Array.from(m), w, h); assert.equal(hm.count, 2);
  const id2 = hm.lab[16 * w + 22], id1 = hm.lab[9 * w + 13]; assert.ok(id1 && id2 && id1 !== id2);
  const f = cleanMask(m, w, h, { open: new Set([id2]) });
  assert.equal(f[9 * w + 13], 1, 'سوراخ ۱ پر شود'); assert.equal(f[16 * w + 22], 0, 'سوراخ ۲ باز بماند');
});
await t('downscale + upscaleAlpha: ابعاد و ماسک درست است', async () => {
  const { px, truth } = scene(); const lo = downscale(px, W, H, 80);
  assert.equal(lo.w, 80); assert.equal(lo.h, 60);
  const r = await grabCut(lo.px, lo.w, lo.h, { x0: 25, y0: 17, x1: 55, y1: 52 }, { iters: 5 });
  const a = upscaleAlpha(cleanMask(r.mask, lo.w, lo.h), lo.w, lo.h, px, W, H, r.fgd, r.bgd);
  const bin = Uint8Array.from(a, (v) => (v > 0.5 ? 1 : 0)); const v = iou(bin, truth); assert.ok(v > 0.93, 'IoU=' + v.toFixed(3));
  const out = applyAlpha(px, W, H, a, 1); assert.equal(out[(70 * W + 80) * 4 + 3], 255); assert.equal(out[(5 * W + 5) * 4 + 3], 0);
});
await t('نوشته‌ی تیره‌ی داخل جعبه شفاف نمی‌شود (پر کردن حفره)', async () => {
  const { px } = scene(); const r = await grabCut(px, W, H, { x0: 50, y0: 35, x1: 110, y1: 104 }, { iters: 5 });
  const a = upscaleAlpha(cleanMask(r.mask, W, H), W, H, px, W, H, r.fgd, r.bgd); assert.ok(a[87 * W + 80] > 0.9, 'alpha=' + a[87 * W + 80]);
});
await t('همه‌ی تصویر سفید (بدون اختلاف رنگ) خطا نمی‌دهد', async () => {
  const px = new Uint8ClampedArray(30 * 30 * 4).fill(255);
  const r = await grabCut(px, 30, 30, { x0: 5, y0: 5, x1: 25, y1: 25 }, { iters: 2 }); assert.equal(r.mask.length, 900);
});
console.log(`\n${n} tests passed`);
