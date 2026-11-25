/* تب «آمار»: بازدید، بازدیدکننده، سبد، سفارش، درآمد، نمودار روزانه، قیف خرید، محصولات پربازدید، منابع ورود، دستگاه‌ها، جستجوها.
   داده از GET /bazar/v1/stats (قالب ۴٫۱۴ به بالا). */
import { h } from './dom.js';
import { icon } from './icons.js';

const nf = new Intl.NumberFormat('fa-IR'), pf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const num = (v) => nf.format(Math.round(+v || 0));
const dayFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', day: 'numeric' });
const dayOnly = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' });
const dt = (d) => new Date(d + 'T12:00:00');
const SVG = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(SVG, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };

const RANGES = [['today', 'امروز'], ['7', '۷ روز'], ['30', '۳۰ روز']];
const METRICS = [['visitors', 'بازدیدکننده'], ['views', 'بازدید صفحه'], ['placed', 'سفارش'], ['revenue', 'درآمد']];
const SRC = { search: 'موتور جستجو', social: 'شبکه‌های اجتماعی', direct: 'مستقیم / بوکمارک', ref: 'سایت‌های دیگر' };
const DEV = { mobile: 'موبایل', tablet: 'تبلت', desktop: 'دسکتاپ' };
const FUN = { sessions: 'بازدید (نشست)', product: 'مشاهده‌ی محصول', cart: 'افزودن به سبد', checkout: 'ورود به پرداخت', placed: 'ثبت سفارش یا درخواست', paid: 'سفارش پرداخت‌شده' };

let host = null, C = null;
const S = { range: '7', metric: 'visitors', data: null, loading: false, error: '', at: 0, notify: null };

export function mountStats(el, ctx) {
  host = el; C = ctx;
  draw();
  if (!S.data || Date.now() - S.at > 60000) load();
}

const friendly = (e) => (e.status === 404 ? 'این بخش به قالب بازار نسخه‌ی ۴٫۱۴ یا بالاتر نیاز دارد. قالب را به‌روز کنید.' : e.status === 403 ? 'این کاربر اجازه‌ی دیدن آمار را ندارد (نقش «مدیر» یا «مدیر فروشگاه» لازم است).' : (e.message || 'دریافت آمار انجام نشد.'));

async function load() {
  if (S.loading || !C) return;
  S.loading = true; S.error = ''; draw();
  try { S.data = await C.call('/bazar/v1/stats?range=' + S.range); S.at = Date.now(); }
  catch (e) { S.error = friendly(e); }
  S.loading = false; draw();
  loadNotify();
}

/* «منتظر موجودی» (قالب ۴٫۱۶+): اگر قالب قدیمی‌تر باشد ساکت نادیده گرفته می‌شود */
async function loadNotify() {
  try { S.notify = await C.call('/bazar/v1/notify'); } catch (e) { S.notify = null; }
  draw();
}
async function notifyDone(ids, okMsg) {
  try { await C.call('/bazar/v1/notify/done', { method: 'POST', body: { ids } }); C.toast(okMsg, 'ok'); await loadNotify(); }
  catch (e) { C.toast(e.message || 'انجام نشد.', 'bad'); }
}
const LAT = (v) => String(v).replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
const isPhone = (c) => /^\+?\d{10,15}$/.test(LAT(c));
function waNum(c) { let n = LAT(c).replace(/\D/g, ''); if (n.startsWith('00')) n = n.slice(2); if (n.length === 11 && n.startsWith('0')) n = '98' + n.slice(1); return n; }
function notifyCard() {
  const n = S.notify;
  if (!n || !(n.items || []).length) return null;
  const blocks = n.items.map((it) => {
    const p = it.product, msg = `سلام، «${p.name}» دوباره موجود شد: ${p.url}`, ids = it.contacts.map((c) => c.id);
    return h('div', { class: 'nwrap', 'data-nprod': p.id },
      h('div', { class: 'nhead' },
        h('div', { class: 'sname' }, h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.name), h('small', {}, `${num(it.contacts.length)} نفر منتظر` + (p.in_stock && p.qty != null ? ` · موجودی فعلی ${num(p.qty)}` : ''))),
        h('span', { class: 'tag ' + (p.in_stock ? 'ok' : '') }, p.in_stock ? 'موجود شد' : 'ناموجود')),
      ...it.contacts.map((c) => h('div', { class: 'ncontact', 'data-nid': c.id },
        h('span', { class: 'nc', dir: 'ltr' }, c.c),
        isPhone(c.c) ? h('a', { class: 'btn sm', 'data-act': 'n-wa', href: `https://wa.me/${waNum(c.c)}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener' }, 'واتس‌اپ') : null,
        isPhone(c.c) ? h('a', { class: 'btn sm ghost', 'data-act': 'n-sms', href: `sms:${LAT(c.c).replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(msg)}` }, 'پیامک') : h('a', { class: 'btn sm', 'data-act': 'n-mail', href: `mailto:${c.c}?subject=${encodeURIComponent(p.name + ' موجود شد')}&body=${encodeURIComponent(msg)}` }, 'ایمیل'),
        h('button', { type: 'button', class: 'btn sm ghost', 'data-act': 'n-done', 'aria-label': 'اطلاع دادم', onclick: () => notifyDone([c.id], 'ثبت شد؛ از فهرست حذف شد') }, 'اطلاع دادم'))),
      it.contacts.length > 1 ? h('button', { type: 'button', class: 'btn sm ghost nall', 'data-act': 'n-all', onclick: () => { if (confirm(`همه‌ی ${num(it.contacts.length)} نفر خبر داده شدند و از فهرست حذف شوند؟`)) notifyDone(ids, 'فهرست این محصول پاک شد'); } }, 'همه‌ی این محصول اطلاع داده شد') : null);
  });
  return card('منتظر موجودی شدن', h('p', { class: 'help' }, `${num(n.total)} نفر منتظر ${num(n.items.length)} محصول هستند. وقتی محصول موجود شد، از اینجا با واتس‌اپ یا پیامک خبرشان کنید و «اطلاع دادم» را بزنید. (ارسال خودکار نیاز به افزونه‌ی پیامک دارد.)`), ...blocks);
}

/* ---------- ابزارها ---------- */
const card = (title, ...kids) => h('section', { class: 'card' }, title ? h('h2', {}, title) : null, ...kids.filter(Boolean));
const conv = (t) => (t && t.sessions > 0 ? (t.placed / t.sessions) * 100 : 0);
function delta(cur, prev, label) {
  if (!prev) return h('span', { class: 'sdelta' + (cur > 0 ? ' up' : ''), title: label }, cur > 0 ? 'جدید' : '—');
  const p = ((cur - prev) / prev) * 100;
  if (Math.abs(p) < 0.5) return h('span', { class: 'sdelta', title: label }, '＝ بدون تغییر');
  return h('span', { class: 'sdelta ' + (p > 0 ? 'up' : 'down'), title: label }, (p > 0 ? '↑ ' : '↓ ') + pf.format(Math.abs(p)) + '٪');
}
const fmt = (k, v, cur) => (k === 'revenue' ? `${num(v)} ${cur || ''}`.trim() : k === 'conv' ? pf.format(v) + '٪' : num(v));

/* ---------- بخش‌ها ---------- */
function head() {
  return h('div', { class: 'ptop' },
    h('h2', {}, 'آمار بازدید'),
    h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'تازه‌سازی', 'data-act': 'stats-refresh', onclick: load }, icon('refresh', 20)));
}
function ranges() {
  return h('div', { class: 'prow-chips sranges', role: 'group', 'aria-label': 'بازه‌ی زمانی' }, RANGES.map(([k, l]) => h('button', {
    type: 'button', class: 'chip sm' + (S.range === k ? ' on' : ''), 'data-range': k, 'aria-pressed': String(S.range === k),
    onclick: () => { if (S.range === k) return; S.range = k; S.data = null; load(); },
  }, l)));
}
function kpis(d) {
  const t = d.totals, p = d.prev, label = d.range === 'today' ? 'نسبت به دیروز' : 'نسبت به دوره‌ی قبل';
  const cur = d.currency;
  const items = [['views', 'بازدید صفحه'], ['visitors', 'بازدیدکننده'], ['cart', 'افزودن به سبد'], ['placed', 'سفارش / درخواست'], ['revenue', 'درآمد'], ['conv', 'نرخ تبدیل']];
  const val = (o, k) => (k === 'conv' ? conv(o) : o[k]);
  return card(null,
    h('div', { class: 'skpis' }, items.map(([k, l]) => h('div', { class: 'skpi', 'data-kpi': k },
      h('small', {}, l), h('b', {}, fmt(k, val(t, k), cur)), delta(val(t, k), val(p, k), label)))),
    h('p', { class: 'help' }, 'بازدیدکننده = یکتا در هر روز (در بازه‌های چندروزه مجموع روزانه). نرخ تبدیل = سفارش‌ها ÷ نشست‌ها. بازدید مدیران و ربات‌ها شمرده نمی‌شود.'));
}

let chartBox = null;
function chartCard(d) {
  const ser = d.series || [];
  const tabs = h('div', { class: 'prow-chips stabs', role: 'group', 'aria-label': 'معیار نمودار' }, METRICS.map(([k, l]) => h('button', {
    type: 'button', class: 'chip sm' + (S.metric === k ? ' on' : ''), 'data-metric': k, 'aria-pressed': String(S.metric === k),
    onclick: () => { S.metric = k; draw(); },
  }, l)));
  const k = S.metric, vals = ser.map((s) => +s[k] || 0), max = Math.max(1, ...vals), n = vals.length;
  const W = 320, H = 110, pad = 4, bw = (W - pad * 2) / n, gap = Math.min(8, bw * 0.28);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H + 18}`, class: 'schart', role: 'img', 'aria-label': 'نمودار روزانه' });
  const read = h('div', { class: 'sread', 'aria-live': 'polite' });
  const show = (i) => {
    svg.querySelectorAll('.sbar').forEach((b) => b.classList.toggle('sel', +b.dataset.i === i));
    const s = ser[i]; read.textContent = `${dayFmt.format(dt(s.d))}: ${fmt(k, vals[i], d.currency)} ${METRICS.find((m) => m[0] === k)[1]}`;
  };
  vals.forEach((v, i) => { // قدیمی‌ترین سمت راست (چیدمان راست‌به‌چپ)
    const x = W - pad - (i + 1) * bw + gap / 2, bh = Math.max(v > 0 ? 3 : 1.5, (v / max) * H), y = H - bh;
    const r = sv('rect', { x: x.toFixed(1), y: y.toFixed(1), width: Math.max(2, bw - gap).toFixed(1), height: bh.toFixed(1), rx: 3, class: 'sbar' + (v === 0 ? ' zero' : ''), 'data-i': i, tabindex: 0, role: 'button', 'aria-label': `${dayFmt.format(dt(ser[i].d))}: ${num(v)}` });
    r.addEventListener('click', () => show(i)); r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } });
    svg.appendChild(r);
    if (n <= 7 || i % 5 === 0 || i === n - 1) { const t = sv('text', { x: (x + (bw - gap) / 2).toFixed(1), y: H + 14, 'text-anchor': 'middle', class: 'sx' }); t.textContent = dayOnly.format(dt(ser[i].d)); svg.appendChild(t); }
  });
  chartBox = { show, last: n - 1 };
  queueMicrotask(() => chartBox && chartBox.show(chartBox.last));
  return card('روند روزانه', tabs, h('div', { class: 'schartbox' }, svg), read);
}
function funnelCard(d) {
  const rows = (d.funnel || []).filter((r) => FUN[r.k]); const max = Math.max(1, ...rows.map((r) => r.n));
  return card('قیف خرید', h('div', { class: 'sfun' }, rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1].n : 0, pct = i >= 2 && prev > 0 && r.n <= prev ? `${pf.format((r.n / prev) * 100)}٪ از مرحله‌ی قبل` : '';
    return h('div', { class: 'sfun-row', 'data-fun': r.k },
      h('div', { class: 'sfun-top' }, h('span', {}, FUN[r.k]), h('b', {}, num(r.n))),
      h('div', { class: 'sfun-track' }, h('i', { style: { width: Math.max(r.n > 0 ? 2 : 0, (r.n / max) * 100) + '%' } })),
      pct ? h('small', {}, pct) : null);
  })), h('p', { class: 'help' }, 'تعداد رویدادهاست، نه نفر؛ مثلاً یک نشست می‌تواند چند محصول ببیند. بیشترین ریزش را دنبال کنید.'));
}
function productsCard(d) {
  const ps = d.products || [];
  if (!ps.length) return card('محصولات پربازدید', h('p', { class: 'help' }, 'هنوز بازدید محصولی ثبت نشده.'));
  return card('محصولات پربازدید', h('div', { class: 'slist' }, ps.map((p, i) => {
    const r = p.views > 0 ? (p.adds / p.views) * 100 : 0, cold = p.adds === 0 && p.views >= 10;
    return h('div', { class: 'srow', 'data-prod': p.id },
      h('span', { class: 'srank' }, num(i + 1)),
      h('div', { class: 'sname' }, h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.name), h('small', {}, `${num(p.views)} بازدید · ${num(p.adds)} افزودن به سبد` + (p.views ? ` (${pf.format(r)}٪)` : ''))),
      cold ? h('span', { class: 'tag warn', title: 'بازدید زیاد ولی هیچ‌کس به سبد نیفزوده: قیمت، عکس یا توضیح را بررسی کنید' }, 'بدون سبد') : null);
  })), (d.cats || []).length ? h('div', { class: 'catchips', style: { marginTop: '12px' } }, d.cats.map((c) => h('span', { class: 'chip sm' }, `${c.name} `, h('span', { class: 'cnt-b' }, num(c.views))))) : null);
}
function sourcesCard(d) {
  const tot = Object.values(d.sources || {}).reduce((a, b) => a + b, 0);
  if (!tot) return card('منابع ورود', h('p', { class: 'help' }, 'هنوز نشستی ثبت نشده.'));
  const refs = (d.refs || []).map((r) => h('div', { class: 'sref' }, h('span', { dir: 'ltr' }, r.host.startsWith('utm:') ? 'کمپین: ' + r.host.slice(4) : r.host), h('b', {}, num(r.n))));
  return card('منابع ورود', h('div', { class: 'sbars' }, Object.keys(SRC).map((k) => {
    const n = d.sources[k] || 0;
    return h('div', { class: 'sbarrow', 'data-src': k }, h('div', { class: 'sfun-top' }, h('span', {}, SRC[k]), h('b', {}, `${pf.format((n / tot) * 100)}٪`)), h('div', { class: 'sfun-track' }, h('i', { style: { width: (n / tot) * 100 + '%' } })));
  })), refs.length ? h('div', { class: 'srefs' }, h('small', {}, 'بیشترین ارجاع‌ها'), ...refs) : null);
}
function devicesCard(d) {
  const v = d.devices || {}, tot = (v.mobile || 0) + (v.tablet || 0) + (v.desktop || 0);
  if (!tot) return null;
  const cls = { mobile: 'm', tablet: 't', desktop: 'd' };
  return card('دستگاه‌ها', h('div', { class: 'sseg', role: 'img', 'aria-label': 'سهم دستگاه‌ها' }, Object.keys(DEV).map((k) => ((v[k] || 0) ? h('i', { class: cls[k], style: { width: ((v[k] / tot) * 100) + '%' } }) : null))),
    h('div', { class: 'slegend' }, Object.keys(DEV).map((k) => h('span', { 'data-dev': k }, h('i', { class: cls[k] }), `${DEV[k]} ${pf.format(((v[k] || 0) / tot) * 100)}٪`))));
}
function searchesCard(d) {
  const q = d.searches || [];
  if (!q.length) return null;
  return card('جستجوهای پرتکرار', h('div', { class: 'catchips' }, q.map((s) => h('span', { class: 'chip sm', 'data-q': s.q }, `${s.q} `, h('span', { class: 'cnt-b' }, num(s.n))))), h('p', { class: 'help' }, 'چیزی که مشتری‌ها دنبالش‌اند. اگر محصولش را ندارید، فرصت فروش است.'));
}
function emptyCard(d) {
  return card(null, h('div', { class: 'empty' }, icon('chart', 34), h('p', {}, h('b', {}, 'هنوز بازدیدی ثبت نشده.')),
    h('p', { class: 'help' }, 'آمار از اولین بازدید مشتری‌ها پر می‌شود. سایت را یک بار در مرورگر دیگری (بدون ورود به بخش مدیریت) باز کنید؛ بازدید مدیران شمرده نمی‌شود. اگر بعد از چند ساعت هنوز خالی بود، افزونه‌ی کش یا امنیت ممکن است درخواست‌های REST را مسدود کرده باشد.')));
}

/* ---------- رسم ---------- */
function draw() {
  if (!host || !host.isConnected) return;
  const d = S.data, kids = [head(), ranges()];
  if (S.error) kids.push(h('div', { class: 'msg bad', role: 'alert' }, S.error));
  if (S.loading && !d) kids.push(h('div', { class: 'empty' }, h('div', { class: 'spin' })));
  if (d) {
    if (!d.enabled) kids.push(h('div', { class: 'msg warn' }, 'ثبت آمار خاموش است. از «ظاهر ← فروشگاه ← آمار بازدید» روشنش کنید. داده‌های قبلی در جدول می‌ماند.'));
    else if (!d.ready) kids.push(h('div', { class: 'msg warn' }, 'جدول آمار هنوز ساخته نشده. یک بار سایت را باز کنید (بدون ورود مدیر) و دوباره تازه‌سازی کنید. اگر درست نشد، دسترسی «ساخت جدول» دیتابیس هاست را بررسی کنید.'));
    const none = !d.totals.views && !d.totals.visitors && !(d.series || []).some((s) => s.views || s.placed);
    if (none && !d.since) kids.push(emptyCard(d));
    else kids.push(kpis(d), notifyCard(), chartCard(d), funnelCard(d), productsCard(d), sourcesCard(d), devicesCard(d), searchesCard(d),
      h('p', { class: 'help', style: { margin: '0 14px 24px' } }, d.since ? `ثبت آمار از ${dayFmt.format(dt(d.since))} شروع شده. ` : '', 'اطلاعات شخصی (IP، کوکی، نشانی صفحه) ذخیره نمی‌شود.'));
    if (S.loading) kids.push(h('div', { class: 'help', style: { textAlign: 'center' } }, 'در حال تازه‌سازی…'));
  }
  host.replaceChildren(...kids.filter(Boolean));
}
