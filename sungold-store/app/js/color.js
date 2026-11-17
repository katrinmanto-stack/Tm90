// محاسبه‌ی رنگ — هم‌ارز دقیق theme/bazar/inc/settings.php (bazar_palette). اگر یکی را عوض کردید دیگری را هم عوض کنید.
export const hex6 = (c) => {
  c = String(c || '').trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(c)) c = [...c].map((x) => x + x).join('');
  return /^[0-9a-f]{6}$/.test(c) ? '#' + c : null;
};
const rgb = (h) => { h = hex6(h).slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (r) => '#' + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { let l1 = lum(a), l2 = lum(b); if (l1 < l2) [l1, l2] = [l2, l1]; return (l1 + 0.05) / (l2 + 0.05); };
export const ensure = (c, against, min, toward) => { for (let i = 0; i < 30 && contrast(c, against) < min; i++) c = mix(c, toward, 0.08); return c; };

/** از ۴ رنگ انتخابی، پالت کامل می‌سازد؛ همه‌ی ترکیب‌های متن/پس‌زمینه خوانا می‌مانند. */
export function derive({ brand, accent, ink, sale }) {
  ink = ensure(ink, '#ffffff', 10, '#000000');
  brand = ensure(brand, '#ffffff', 4.5, '#000000');
  sale = ensure(sale, '#ffffff', 4.5, '#000000');
  const p = { ink, brand, accent, sale };
  p['brand-d'] = mix(brand, '#000000', 0.28);
  p['brand-l'] = mix(brand, '#ffffff', 0.90);
  p['on-accent'] = contrast(accent, ink) >= contrast(accent, '#ffffff') ? ink : '#ffffff';
  p.bg = mix(brand, '#ffffff', 0.96);
  p.soft = mix(brand, '#ffffff', 0.92);
  p.line = mix(brand, '#ffffff', 0.85);
  p.mut = ensure(mix(ink, '#ffffff', 0.38), p.soft, 4.6, ink);
  p['on-dark'] = ensure(mix(brand, '#ffffff', 0.78), brand, 6, '#ffffff');
  if (contrast(p['on-dark'], brand) < 4.5) p['on-dark'] = '#ffffff'; // برندِ در حد مرز: سفید تنها گزینه‌ی مطمئن است
  p['on-dark-2'] = ensure(mix(p['on-dark'], ink, 0.35), ink, 4.5, '#ffffff');
  p['ar-2'] = mix(brand, '#ffffff', 0.20);
  return p;
}
