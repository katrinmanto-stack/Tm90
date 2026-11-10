// تست الگوریتم پالت: برای هر ورودی (حتی بدخواهانه) خوانایی تضمین‌شده باشد.  node tools/test-palette.mjs
import { derive, contrast, hex6 } from '../app/js/color.js';
import fs from 'node:fs';
const schema = JSON.parse(fs.readFileSync(new URL('../theme/bazar/inc/schema.json', import.meta.url)));
let bad = 0, n = 0;
const rnd = () => '#' + [...Array(6)].map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
function check(c, label) {
  const p = derive(c); n++;
  const t = [
    ['white on brand', contrast('#ffffff', p.brand), 4.5], ['white on brand-d', contrast('#ffffff', p['brand-d']), 4.5],
    ['ink on bg', contrast(p.ink, p.bg), 7], ['mut on soft', contrast(p.mut, p.soft), 4.5], ['mut on white', contrast(p.mut, '#ffffff'), 4.5],
    ['on-accent on accent', contrast(p['on-accent'], p.accent), 3], ['on-dark on brand', contrast(p['on-dark'], p.brand), 4.5],
    ['on-dark on ink', contrast(p['on-dark'], p.ink), 4.5], ['on-dark-2 on ink', contrast(p['on-dark-2'], p.ink), 4.5],
    ['brand-d on brand-l', contrast(p['brand-d'], p['brand-l']), 4.5], ['white on sale', contrast('#ffffff', p.sale), 4.5],
  ];
  for (const [name, v, min] of t) if (v < min - 0.001) { bad++; console.log(`FAIL ${label} ${JSON.stringify(c)} ${name}: ${v.toFixed(2)} < ${min}`); }
}
for (const pr of schema.presets) check({ brand: pr.colors.color_brand, accent: pr.colors.color_accent, ink: pr.colors.color_ink, sale: pr.colors.color_sale }, 'preset ' + pr.id);
for (let i = 0; i < 1000; i++) check({ brand: rnd(), accent: rnd(), ink: rnd(), sale: rnd() }, 'random');
for (const c of ['#ffffff', '#000000', '#ffff00', '#00ff00']) check({ brand: c, accent: c, ink: c, sale: c }, 'extreme');
console.log(bad ? `\n${bad} violations in ${n} palettes` : `OK: ${n} palettes, all contrast guarantees hold`);
process.exit(bad ? 1 : 0);
