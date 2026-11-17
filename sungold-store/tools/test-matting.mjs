// تست حذف پس‌زمینه و چیدمان: node tools/test-matting.mjs
import assert from 'node:assert/strict';
import { estimateBg, removeBg, bbox, outSize, fitRect } from '../app/js/matting.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const W = 200, H = 150;
function img(bgFn, rects = []) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4; let c = bgFn(x, y);
    for (const r of rects) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) c = r.c;
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
  }
  return d;
}
const alpha = (d, x, y) => d[(y * W + x) * 4 + 3];
const white = () => [250, 250, 250], RED = [200, 30, 40];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

t('estimateBg: رنگ حاشیه را پیدا می‌کند (حتی با نویز)', () => {
  const d = img(() => [240 + (rnd() * 10 | 0), 238, 235], [{ x: 60, y: 40, w: 80, h: 60, c: RED }]);
  const [r, g, b] = estimateBg(d, W, H);
  assert.ok(r >= 238 && r <= 252 && Math.abs(g - 238) <= 2 && Math.abs(b - 235) <= 2, [r, g, b].join());
});
t('پس‌زمینه شفاف می‌شود و محصول می‌ماند', () => {
  const d = img(white, [{ x: 60, y: 40, w: 80, h: 60, c: RED }]);
  const r = removeBg(d, W, H);
  assert.equal(alpha(r.data, 2, 2), 0); assert.equal(alpha(r.data, 197, 147), 0);
  assert.equal(alpha(r.data, 100, 70), 255);
  assert.ok(Math.abs(r.coverage - 4800 / 30000) < 0.03, 'coverage=' + r.coverage);
});
t('کادر دربرگیرنده درست است', () => {
  const r = removeBg(img(white, [{ x: 60, y: 40, w: 80, h: 60, c: RED }]), W, H);
  const b = bbox(r.data, W, H, 128);
  assert.ok(Math.abs(b.x0 - 60) <= 2 && Math.abs(b.x1 - 140) <= 2 && Math.abs(b.y0 - 40) <= 2 && Math.abs(b.y1 - 100) <= 2, JSON.stringify(b));
});
t('پس‌زمینه‌ی شیب‌دار (روشنایی نامساوی) هم حذف می‌شود', () => {
  const d = img((x) => { const v = 215 + Math.round((x / W) * 35); return [v, v, v]; }, [{ x: 60, y: 40, w: 80, h: 60, c: RED }]);
  const r = removeBg(d, W, H, { tol: 45 });
  assert.equal(alpha(r.data, 3, 75), 0); assert.equal(alpha(r.data, 197, 75), 0); assert.equal(alpha(r.data, 100, 70), 255);
});
t('رنگ داخل محصول که شبیه پس‌زمینه است حذف نمی‌شود (بدون راه به لبه)', () => {
  const d = img(white, [{ x: 50, y: 30, w: 100, h: 90, c: RED }, { x: 80, y: 60, w: 30, h: 30, c: [250, 250, 250] }]);
  const r = removeBg(d, W, H);
  assert.equal(alpha(r.data, 95, 75), 255, 'سوراخ نباید پاک شود');
  const f = removeBg(d, W, H, { fill: true });
  assert.equal(alpha(f.data, 95, 75), 0, 'با fill باید پاک شود');
});
t('ذره‌ی کوچک جداافتاده حذف می‌شود ولی جزء بزرگ دوم می‌ماند', () => {
  const d = img(white, [{ x: 40, y: 40, w: 50, h: 50, c: RED }, { x: 120, y: 40, w: 30, h: 50, c: RED }, { x: 10, y: 10, w: 2, h: 2, c: [20, 20, 20] }]);
  const r = removeBg(d, W, H);
  assert.equal(alpha(r.data, 10, 10), 0, 'ذره'); assert.equal(alpha(r.data, 55, 60), 255); assert.equal(alpha(r.data, 135, 60), 255, 'جزء دوم');
});
t('حساسیت بیشتر = حذف بیشتر برای محصول کم‌رنگ', () => {
  const PINK = [236, 215, 220], d = img(white, [{ x: 60, y: 40, w: 80, h: 60, c: PINK }]);
  const low = removeBg(d, W, H, { tol: 5 }).coverage, high = removeBg(d, W, H, { tol: 90 }).coverage;
  assert.ok(low > 0.1 && high < low, `low=${low} high=${high}`);
});
t('رنگ پس‌زمینه‌ی انتخابی کاربر (چکاننده) رعایت می‌شود', () => {
  const GREEN = [40, 160, 90], d = img(() => GREEN, [{ x: 60, y: 40, w: 80, h: 60, c: RED }]);
  const r = removeBg(d, W, H, { bg: GREEN });
  assert.equal(alpha(r.data, 5, 5), 0); assert.equal(alpha(r.data, 100, 70), 255);
});
t('هاله‌ی سفید لبه‌ها کم می‌شود (decontaminate)', () => {
  const d = img(white, [{ x: 60, y: 40, w: 80, h: 60, c: RED }]);
  const r = removeBg(d, W, H, { feather: 2 }).data;
  let worst = 0;
  for (let y = 38; y < 42; y++) { const p = (y * W + 100) * 4; if (r[p + 3] > 60) worst = Math.max(worst, r[p + 1]); }
  assert.ok(worst < 200, 'سبز لبه=' + worst);
});
t('تصویر شفاف‌دار: ورودی تغییر نمی‌کند', () => {
  const d = img(white, [{ x: 60, y: 40, w: 80, h: 60, c: RED }]), copy = new Uint8ClampedArray(d);
  removeBg(d, W, H); assert.deepEqual(d, copy);
});
t('outSize + fitRect', () => {
  assert.deepEqual(outSize('1:1', 1200, 80, 60), { w: 1200, h: 1200 });
  assert.deepEqual(outSize('4:5', 1000, 80, 60), { w: 800, h: 1000 });
  assert.deepEqual(outSize('orig', 1000, 400, 200), { w: 1000, h: 500 });
  const f = fitRect(80, 60, 1000, 1000, 0.1);
  assert.equal(f.dw, 800); assert.equal(f.dh, 600); assert.equal(f.dx, 100); assert.equal(f.dy, 200);
});
t('بدون پس‌زمینه‌ی قابل‌تشخیص: ضریب پوشش گزارش می‌شود', () => {
  const noise = img(() => [rnd() * 255 | 0, rnd() * 255 | 0, rnd() * 255 | 0]);
  const r = removeBg(noise, W, H); assert.ok(r.coverage > 0.9, 'coverage=' + r.coverage);
});
console.log(`\n${n} tests passed`);
