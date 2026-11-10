#!/usr/bin/env node
// سرور آزمایشی شبیه وردپرس برای توسعه و تست اپ، بدون نیاز به وردپرس واقعی.
//   node tools/mock-server.mjs   →   http://localhost:8787/app/   (سایت: http://localhost:8787)
// کاربر: admin   رمز برنامه: abcd efgh ijkl mnop qrst uvwx
// از همان schema.json و style.css واقعی قالب استفاده می‌کند؛ صفحه‌ی سایت فقط یک شبیه‌سازی از ساختار HTML قالب است.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { derive, hex6 } from '../app/js/color.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'theme/bazar/inc/schema.json'), 'utf8'));
const themeCss = () => fs.readFileSync(path.join(ROOT, 'theme/bazar/style.css'), 'utf8');
const PORT = +process.env.PORT || 8787;
const USER = 'admin', PASS = 'abcdefghijklmnopqrstuvwx';
const F = Object.fromEntries(schema.fields.map((f) => [f.key, f]));
const media = new Map(); // id -> {type, buf}
let nextId = 100;
const defaults = () => Object.fromEntries(schema.fields.map((f) => [f.key, f.default]));
let saved = { ...defaults(), site_title: 'Sungold store', phone: '09121234567' };
const previews = new Map();

/* ---------- هم‌ارز bazar_clean ---------- */
const trim = (s, n) => String(s ?? '').slice(0, n);
function clean(f, v) {
  const max = f.max || 200;
  switch (f.type) {
    case 'toggle': return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
    case 'color': return hex6(v) || f.default;
    case 'number': { const n = Number.isFinite(+v) && v !== '' && v !== null ? Math.trunc(+v) : f.default; return Math.max(f.min ?? 0, Math.min(f.max ?? 100, n)); }
    case 'select': return f.options.some((o) => String(o[0]) === String(v)) ? String(v) : f.default;
    case 'image': { const id = +((v && v.id !== undefined) ? v.id : v) || 0; return media.has(id) ? id : 0; }
    case 'textarea': return trim(v, max);
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) ? String(v) : '';
    case 'phone': return trim(String(v ?? '').replace(/[^0-9+\s\-()\u06F0-\u06F9\u0660-\u0669]/g, '').trim(), 20);
    case 'url': { let u = String(v ?? '').trim(); if (!u) return ''; if (f.prefix && !/^https?:\/\//i.test(u) && /^@?[A-Za-z0-9._]{2,64}$/.test(u)) u = f.prefix + u.replace(/^@/, ''); return /^https?:\/\//i.test(u) ? u : ''; }
    case 'link': { const u = String(v ?? '').trim(); if (!u) return ''; if (u[0] === '#') return '#' + u.slice(1).replace(/[^A-Za-z0-9_-]/g, ''); if (u[0] === '/' && u[1] !== '/') return u; return /^https?:\/\//i.test(u) ? u : ''; }
    case 'benefits': { const out = []; for (const r of Array.isArray(v) ? v : []) { const t = trim(r && r.title, 40).trim(); if (!t) continue; out.push({ title: t, text: trim(r.text, 80) }); if (out.length >= 4) break; } return out.length ? out : f.default; }
    case 'sections': { const ids = f.options.map((o) => o[0]); const seen = new Set(), out = []; for (const r of Array.isArray(v) ? v : []) { if (!r || !ids.includes(r.id) || seen.has(r.id)) continue; seen.add(r.id); out.push({ id: r.id, on: !!r.on }); } for (const id of ids) if (!seen.has(id)) out.push({ id, on: true }); return out; }
    default: return trim(String(v ?? '').replace(/<[^>]*>/g, ''), max);
  }
}
const present = (f, v) => f.type === 'image' ? { id: +v || 0, url: +v ? `/media/${v}` : '' } : v;
const valuesOut = () => Object.fromEntries(schema.fields.map((f) => [f.key, present(f, saved[f.key])]));
const paletteOf = (vals) => derive({ brand: vals.color_brand, accent: vals.color_accent, ink: vals.color_ink, sale: vals.color_sale });

/* ---------- صفحه‌ی سایتِ شبیه‌سازی‌شده ---------- */
const pal = [['#F6D9C9', '#E9A98B'], ['#D4E7E5', '#7DB5B3'], ['#EAD9F0', '#B79BC9'], ['#F3E7B9', '#D9BE63'], ['#CFE3F1', '#7FA9C9'], ['#F5CFD6', '#D98C9B'], ['#DDE8CF', '#9DBB7C'], ['#E9DCCB', '#C2A27C']];
const svgImg = (i) => { const [a, b] = pal[i % 8]; return 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='${a}'/><path d='M200 130c40 0 60 30 60 60 0 20-10 30-20 40l60 120c8 16-4 30-20 30H120c-16 0-28-14-20-30l60-120c-10-10-20-20-20-40 0-30 20-60 60-60z' fill='${b}'/></svg>`).toString('base64'); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (p) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>`;
const IC = { search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6', bag: 'M6 8h12l1 13H5zM9 8V6a3 3 0 0 1 6 0v2', menu: 'M4 6h16M4 12h16M4 18h16', home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', truck: 'M1 6h13v10H1zM14 9h5l3 3v4h-8M6 19a2 2 0 1 0 .01 0M18 19a2 2 0 1 0 .01 0', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5', card: 'M3 6h18v12H3zM3 10h18M7 15h4', chat: 'M4 5h16v11H9l-5 4z' };
const names = ['مانتو کتان تابستانه', 'کیف دستی چرم مصنوعی', 'هدفون بی‌سیم مدل Air', 'شال نخی طرح‌دار', 'ساعت هوشمند ورزشی', 'گوشواره آویز طلایی', 'پاوربانک ۲۰۰۰۰', 'روسری ابریشمی'];
const cards = (n) => `<div class="woocommerce"><ul class="products products">${Array.from({ length: n }, (_, i) => `<li class="product">${i === 1 ? '<span class="onsale">٪۲۰ تخفیف</span>' : ''}<a class="woocommerce-LoopProduct-link" href="#"><img src="${svgImg(i)}" alt=""><h2 class="woocommerce-loop-product__title">${names[i % 8]}</h2><span class="price"><span>${(1290 - i * 90)}٬۰۰۰ تومان</span></span></a><a class="button" href="#">افزودن به سبد خرید</a></li>`).join('')}</ul></div>`;

function renderSite(v) {
  const p = paletteOf(v), rgb = [1, 3, 5].map((i) => parseInt(p.ink.slice(i, i + 2), 16)).join(',');
  const rad = { sharp: [6, 10, 14], soft: [12, 20, 32], round: [16, 26, 40] }[v.radius] || [12, 20, 32];
  const vars = ':root{' + Object.entries(p).map(([k, x]) => `--${k}:${x}`).join(';') + `;--ink-rgb:${rgb};--r-s:${rad[0]}px;--r-m:${rad[1]}px;--r-l:${rad[2]}px}`;
  const gold = v.hero_style === 'gold';
  const logo = +v.logo ? `<span class="logo logo-img"><img src="/media/${+v.logo}" alt=""></span>` : `<a class="logo" href="#">${esc(v.site_title)}</a>`;
  const contacts = [v.phone && [v.phone, 'phone'], v.whatsapp && ['واتس‌اپ'], v.instagram && ['اینستاگرام'], v.telegram && ['تلگرام']].filter(Boolean).map((c) => `<a href="#">${esc(c[0])}</a>`).join('');
  const cats = ['لباس زنانه', 'اکسسوری', 'گجت', 'کیف و کفش', 'شال و روسری', 'ساعت', 'هدفون', 'عطر'];
  const order = Object.fromEntries(v.home_sections.map((s, i) => [s.id, s.on ? i + 1 : 0]));
  const sec = (id, html) => order[id] ? `<div style="order:${order[id]}">${html}</div>` : '';
  const benefits = v.benefits.map((b, i) => `<div>${ic([IC.truck, IC.shield, IC.card, IC.chat][i % 4])}<p><b>${esc(b.title)}</b><span>${esc(b.text)}</span></p></div>`).join('');
  const rows = cats.slice(0, v.rows_count).map((c) => `<section class="wrap"><div class="sh"><h2>${c}</h2><a href="#">مشاهده همه</a></div>${cards(4)}</section>`).join('');
  return `<!doctype html><html dir="rtl" lang="fa" class="${''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(v.site_title)}</title>
<style>${themeCss().replace(/url\(assets\/fonts[^)]*\)/g, 'url(none)')}</style><style id="bazar-vars">${vars}</style></head>
<body class="home ${v.tabbar_on ? '' : 'bz-no-tabbar'} ${String(v.shop_columns) === '3' ? 'bz-cols-3' : ''}">
${v.topbar_on ? `<div class="topbar"><div class="wrap"><span>${esc(v.topbar)}</span><nav>${contacts}</nav></div></div>` : ''}
<header class="hd"><div class="wrap hd-main"><button class="ico menu-btn">${ic(IC.menu)}</button>${logo}
<form class="search" onsubmit="return false"><select><option>همه دسته‌ها</option></select><input type="search" placeholder="جستجوی محصول…"><button>${ic(IC.search)}</button></form>
<div class="hd-act"><a class="ico" href="#">${ic(IC.user)}</a><button class="ico">${ic(IC.bag)}<b class="cart-count">۲</b></button></div></div>
<nav class="catbar"><div class="wrap"><div class="allcats"><button>${ic(IC.menu)} همه دسته‌ها</button></div><div class="primary-nav"><ul><li class="current-menu-item"><a href="#">فروشگاه</a></li><li><a href="#">تخفیف‌ها</a></li><li><a href="#">تماس با ما</a></li></ul></div></div></nav></header>
<main style="display:flex;flex-direction:column">
<section class="wrap hero ${gold ? 'hero-gold' : ''}" style="order:0"><div class="hero-main ${gold ? 'is-gold' : ''}"><div class="hero-fb"><div class="hero-fb-t"><h2>${esc(v.hero_title)}</h2><p>${esc(v.hero_text)}</p>
<div class="row"><a class="btn btn-a" href="#">${esc(v.hero_btn1)}</a><a class="btn btn-o" href="#">${esc(v.hero_btn2)}</a></div></div><div class="arches"><i></i><i></i><i></i></div></div></div>
<div class="hero-side"><a class="tile t-accent" href="#"><b>${cats[0]}</b><span>مشاهده محصولات</span></a><a class="tile t-soft" href="#"><b>${cats[1]}</b><span>مشاهده محصولات</span></a></div></section>
${sec('categories', `<section class="wrap cats">${cats.map((c) => `<a class="cat" href="#"><span class="cat-i">${c[0]}</span>${c}</a>`).join('')}</section>`)}
${sec('featured', `<section class="wrap" id="featured"><div class="sh"><h2>${esc(v.featured_title)}</h2><div class="tabs"><button aria-selected="true">جدیدترین</button><button>پرفروش‌ها</button></div></div>${cards(v.featured_count)}</section>`)}
${sec('promo', `<section class="wrap promo"><div><h2>${esc(v.promo_title)}</h2><p>${esc(v.promo_text)}</p></div><a class="btn" href="#">${esc(v.promo_btn)}</a></section>`)}
${sec('rows', rows)}
${sec('benefits', `<section class="wrap feat">${benefits}</section>`)}
</main>
<footer class="ft"><div class="wrap ft-g"><div><a class="logo" href="#">${esc(v.site_title)}</a><p>${esc(v.about)}</p></div><div><h3>دسترسی سریع</h3><ul><li><a href="#">فروشگاه</a></li><li><a href="#">سبد خرید</a></li></ul></div><div><h3>دسته‌ها</h3><ul><li><a href="#">لباس زنانه</a></li><li><a href="#">اکسسوری</a></li></ul></div><div><h3>تماس با ما</h3><ul>${contacts.replace(/<a/g, '<li><a').replace(/<\/a>/g, '</a></li>')}</ul></div></div>
<div class="wrap ft-b">${esc(v.copyright || '© ۱۴۰۵ ' + v.site_title)}</div></footer>
${v.tabbar_on ? `<nav class="tabbar"><a href="#" aria-current="page">${ic(IC.home)}خانه</a><button>${ic(IC.grid)}دسته‌ها</button><button><span class="tb-ic">${ic(IC.bag)}<b class="cart-count">۲</b></span>سبد خرید</button><a href="#">${ic(IC.user)}حساب من</a></nav>` : ''}
</body></html>`;
}

/* ---------- سرور ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const authed = (req) => { const m = /^Basic (.+)$/.exec(req.headers.authorization || ''); if (!m) return false; const [u, ...p] = Buffer.from(m[1], 'base64').toString('utf8').split(':'); return u === USER && p.join(':').replace(/\s+/g, '') === PASS; };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const origin = req.headers.origin;
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Disposition, X-WP-Nonce'); res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE'); }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  let route = null;
  if (url.pathname.startsWith('/wp-json/')) route = url.pathname.slice('/wp-json'.length);
  else if (url.searchParams.get('rest_route')) route = url.searchParams.get('rest_route');

  if (route !== null) {
    if (route === '/bazar/v1/ping') return json(res, 200, { ok: true, name: saved.site_title, theme: 'bazar', version: '4.0.0', api: 1, https: false, woocommerce: true, app_passwords: true });
    if (!authed(req)) return json(res, 401, { code: 'rest_forbidden', message: 'Sorry, you are not allowed to do that.' });
    const body = req.method === 'GET' ? Buffer.alloc(0) : await readBody(req);
    const data = () => { try { return JSON.parse(body.toString('utf8') || '{}'); } catch { return {}; } };
    if (route === '/bazar/v1/schema') return json(res, 200, schema);
    if (route === '/bazar/v1/settings' && req.method === 'GET') return json(res, 200, { values: valuesOut(), palette: paletteOf(saved), site: { name: saved.site_title, url: `http://localhost:${PORT}/`, version: '4.0.0' } });
    if (route === '/bazar/v1/settings') {
      const { values } = data(); if (!values || typeof values !== 'object') return json(res, 400, { code: 'bazar_bad_request', message: 'فیلد values الزامی است.' });
      const unknown = [], savedKeys = [];
      for (const [k, v] of Object.entries(values)) { if (!F[k]) { unknown.push(k); continue; } saved[k] = clean(F[k], v); savedKeys.push(k); }
      const p = paletteOf(saved), notes = [];
      if (savedKeys.includes('color_brand') && p.brand !== saved.color_brand) notes.push({ key: 'color_brand', message: 'رنگ اصلی کمی تیره‌تر شد تا متن سفید روی دکمه‌ها خوانا بماند.' });
      return json(res, 200, { saved: savedKeys, unknown, notes, purged: [], values: valuesOut(), palette: p });
    }
    if (route === '/bazar/v1/settings/reset') { const keep = { site_title: saved.site_title, logo: saved.logo, site_icon: saved.site_icon }; saved = { ...defaults(), ...keep }; return json(res, 200, { values: valuesOut(), palette: paletteOf(saved) }); }
    if (route === '/bazar/v1/preview') {
      const { values = {}, path: pth } = data(); const clean_ = {};
      for (const [k, v] of Object.entries(values)) if (F[k]) clean_[k] = clean(F[k], v);
      const token = [...Array(20)].map(() => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
      previews.set(token, clean_); setTimeout(() => previews.delete(token), 30 * 60 * 1000);
      return json(res, 200, { url: `http://localhost:${PORT}${pth && pth[0] === '/' && pth[1] !== '/' ? pth : '/'}?bazar_preview=${token}`, token, expires: 1800 });
    }
    if (route === '/wp/v2/media' && req.method === 'POST') {
      const id = nextId++; media.set(id, { type: req.headers['content-type'] || 'application/octet-stream', buf: body });
      return json(res, 201, { id, source_url: `/media/${id}`, media_details: { sizes: { medium: { source_url: `/media/${id}` } } } });
    }
    return json(res, 404, { code: 'rest_no_route', message: 'No route was found matching the URL and request method.' });
  }

  const mm = /^\/media\/(\d+)$/.exec(url.pathname);
  if (mm && media.has(+mm[1])) { const m = media.get(+mm[1]); res.writeHead(200, { 'Content-Type': m.type }); return res.end(m.buf); }

  if (url.pathname === '/') {
    const t = url.searchParams.get('bazar_preview'); const pv = t && previews.get(t);
    const vals = { ...saved, ...(pv || {}) };
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(renderSite(vals));
  }
  if (url.pathname === '/app') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
  if (url.pathname.startsWith('/app/')) {
    let rel = url.pathname.slice('/app/'.length) || 'index.html'; if (rel.endsWith('/')) rel += 'index.html';
    const fp = path.join(ROOT, 'app', path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (fp.startsWith(path.join(ROOT, 'app')) && fs.existsSync(fp) && fs.statSync(fp).isFile()) { res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); return fs.createReadStream(fp).pipe(res); }
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, () => console.log(`Mock WordPress: http://localhost:${PORT}   |   App: http://localhost:${PORT}/app/\nuser: ${USER}   app password: abcd efgh ijkl mnop qrst uvwx`));
export { clean, renderSite };
