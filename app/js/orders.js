// تب «سفارشات»: فهرست با فیلتر وضعیت و جستجو، آمار، جزئیات، تغییر وضعیت، کد رهگیری و یادداشت.
import { h, debounce } from './dom.js';
import { icon } from './icons.js';

const O = { meta: null, stats: null, items: [], total: 0, page: 0, pages: 0, q: '', status: '', loading: false, error: '', token: 0, at: 0 };
let seen = null; // آخرین وضعیت که اپ دیده: { latest, req, n } (هم‌گام بین پیگیر و فهرست)
const cnt = (m, k) => ((m && m.counts && m.counts[k]) || 0);
const actionable = (m) => cnt(m, 'processing') + cnt(m, 'bazar-request'); // نیازمند اقدام فروشنده
const snap = (m) => ({ latest: (m && m.latest_id) || 0, req: cnt(m, 'bazar-request'), n: actionable(m) });
let host = null, C = null, listBox = null, D = null; // D = { id, o, pending, note, track, notify, noteText, noteCustomer, busy }

/* ---------- قالب‌بندی ---------- */
const nf = new Intl.NumberFormat('fa-IR');
const money = (v) => nf.format(Math.round(+v || 0));
const dateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' });
const when = (ts) => (ts ? `${dateFmt.format(ts * 1000)} · ${timeFmt.format(ts * 1000)}` : '');
const faNum = (n) => String(n ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const cur = () => (O.meta && O.meta.currency) || '';

const FA_STATUS = { 'bazar-request': 'درخواست خرید', pending: 'در انتظار پرداخت', processing: 'در حال انجام', 'on-hold': 'در انتظار بررسی', completed: 'تکمیل‌شده', cancelled: 'لغوشده', refunded: 'مسترد‌شده', failed: 'ناموفق' };
const TONE = { 'bazar-request': 'warn', processing: 'warn', 'on-hold': 'warn', completed: 'ok', cancelled: 'bad', failed: 'bad', refunded: 'bad' };
const statusLabel = (slug, serverLabel) => FA_STATUS[slug] || serverLabel || ((O.meta && (O.meta.statuses.find((s) => s.slug === slug) || {}).label) || slug);
const statusTag = (slug, label) => h('span', { class: 'tag ' + (TONE[slug] || '') }, statusLabel(slug, label));

const LAT = (s) => String(s || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const telDigits = (s) => LAT(s).replace(/[^0-9+]/g, '');
export function waLink(phone) {
  let n = LAT(phone).replace(/[^0-9]/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  else if (n.startsWith('09') && n.length === 11) n = '98' + n.slice(1);
  else if (n.startsWith('9') && n.length === 10) n = '98' + n;
  return n.length >= 10 ? `https://wa.me/${n}` : '';
}
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));

async function copyText(text, what) {
  try { await navigator.clipboard.writeText(text); C.toast(`${what} کپی شد`, 'ok'); }
  catch {
    const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }); t.value = text; document.body.append(t); t.select();
    try { document.execCommand('copy'); C.toast(`${what} کپی شد`, 'ok'); } catch { C.toast('کپی نشد؛ متن را دستی انتخاب کنید.', 'bad'); }
    t.remove();
  }
}

/** بعد از رسیدن سفارش تازه: فهرست را (اگر باز است و جزئیات باز نیست) تازه کن. */
export function reloadOrders() { O.at = 0; if (host && host.isConnected && !D) { loadStats(); loadList(true); } }

export const isOrderDirty = () => !!D && (D.pending !== D.o.status || D.track !== (D.o.tracking || '') || D.noteText.trim() !== '');

/* ---------- ورود و دسترسی ---------- */
export function mountOrders(el, ctx) {
  host = el; C = ctx;
  if (!ctx.woocommerce) { host.replaceChildren(h('div', { class: 'msg warn' }, 'ووکامرس روی این سایت فعال نیست؛ سفارشی وجود ندارد.')); return; }
  if (D) renderDetail(); else renderList();
  if (!O.meta) loadMeta();
  if (!D) { loadStats(); if (!O.items.length || Date.now() - O.at > 30000) { if (!O.loading) loadList(true); } }
}

const friendly = (e) => (e.status === 404 ? 'این بخش به قالب بازار نسخه‌ی ۴٫۷ یا بالاتر نیاز دارد. قالب را به‌روز کنید.' : e.status === 403 ? 'این کاربر اجازه‌ی مدیریت سفارش‌ها را ندارد (نقش «مدیر فروشگاه» یا «مدیر» لازم است).' : e.message);

async function loadMeta() {
  try {
    O.meta = await C.call('/bazar/v1/orders/meta');
    seen = snap(O.meta);
    if (C.badge) C.badge(seen.n);
    if (D) renderDetail(); else { drawChips(); drawList(); }
  }
  catch (e) { O.error = friendly(e); drawList(); }
}
async function loadStats() {
  try { O.stats = await C.call('/bazar/v1/orders/stats'); drawStats(); } catch { /* آمار اختیاری است */ }
}
async function loadList(reset) {
  if (O.loading && !reset) return;
  if (reset) { O.items = []; O.page = 0; O.pages = 0; O.total = 0; }
  const token = ++O.token;
  O.loading = true; O.error = ''; drawList();
  try {
    const query = { page: String(O.page + 1) };
    if (O.q) query.search = O.q;
    if (O.status) query.status = O.status;
    const r = await C.call('/bazar/v1/orders', { query });
    if (token !== O.token) return;
    O.items.push(...r.items); O.page = r.page; O.pages = r.pages; O.total = r.total; O.at = Date.now();
  } catch (e) { if (token === O.token) O.error = friendly(e); }
  finally { if (token === O.token) { O.loading = false; if (!D) drawList(); } }
}

/* ---------- پیگیری سفارش جدید (جایگزین ساده‌ی اعلان لحظه‌ای) ---------- */
export function startOrderWatch(call, { onCount, onNew, every = 60000 }) {
  let busy = false, timer = 0;
  const stop = () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  const tick = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const m = await call('/bazar/v1/orders/meta');
      const now = snap(m);
      onCount(now.n);
      // سفارش یا درخواست تازه: با شناسه‌ی تازه‌ترین سفارش (قالب‌های قدیمی‌تر بدون آن: مقایسه‌ی شمار)
      const fresh = seen !== null && (m.latest_id != null ? now.latest > seen.latest : now.n > seen.n);
      if (fresh) onNew({ requests: Math.max(0, now.req - seen.req), request: now.req > seen.req });
      seen = now;
      if (O.meta) { O.meta.counts = m.counts; O.meta.latest_id = m.latest_id; }
    } catch (e) { if (e && (e.status === 404 || e.status === 403)) stop(); }
    finally { busy = false; }
  };
  const onVis = () => { if (!document.hidden) tick(); };
  document.addEventListener('visibilitychange', onVis);
  tick(); timer = setInterval(tick, every);
  return stop;
}

/* ================= فهرست ================= */
let statsBox = null, chipsBox = null;

function renderList() {
  D = null;
  const search = h('input', { class: 'in', type: 'search', placeholder: 'شماره‌ی سفارش، نام یا تلفن…', 'aria-label': 'جستجوی سفارش', autocomplete: 'off' });
  search.value = O.q;
  search.addEventListener('input', debounce(() => { O.q = search.value.trim(); loadList(true); }, 400));
  statsBox = h('div', { class: 'ostats' });
  chipsBox = h('div', { class: 'prow-chips' });
  listBox = h('div', { class: 'plist', id: 'olist' });
  host.replaceChildren(
    h('section', { class: 'card phead' }, statsBox, search, chipsBox,
      h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { loadStats(); loadList(true); if (O.meta) loadMeta(); } }, icon('refresh', 18), 'بازخوانی')),
    listBox);
  drawStats(); drawChips(); drawList();
}

function drawStats() {
  if (!statsBox) return;
  const s = O.stats;
  if (!s) { statsBox.replaceChildren(); return; }
  const box = (label, v) => h('div', { class: 'ostat' }, h('small', {}, label), h('b', {}, nf.format(v.count) + ' سفارش'), h('span', {}, money(v.revenue) + ' ' + (s.currency || cur())));
  statsBox.replaceChildren(box('امروز', s.today), box('۷ روز اخیر', s.week), box('۳۰ روز اخیر', s.month),
    s.truncated ? h('p', { class: 'help' }, 'آمار ۳۰ روز بر پایه‌ی ۱۵۰۰ سفارش آخر است.') : null);
}

function drawChips() {
  if (!chipsBox) return;
  const counts = (O.meta && O.meta.counts) || {};
  const order = ['bazar-request', 'processing', 'on-hold', 'pending', 'completed', 'cancelled', 'failed', 'refunded'];
  const known = ((O.meta && O.meta.statuses) || []).map((s) => s.slug);
  const slugs = [...order.filter((s) => known.includes(s)), ...known.filter((s) => !order.includes(s))].filter((s) => counts[s] > 0 || s === O.status);
  const chip = (val, label, n) => h('button', { type: 'button', class: 'chip sm' + (O.status === val ? ' on' : ''), 'aria-pressed': String(O.status === val), onclick: () => { O.status = val; drawChips(); loadList(true); } },
    label, n ? h('span', { class: 'cnt-b' }, nf.format(n)) : null);
  chipsBox.replaceChildren(chip('', 'همه', 0), ...slugs.map((s) => chip(s, statusLabel(s), counts[s] || 0)));
}

function drawList() {
  if (!listBox || D) return;
  const out = [];
  for (const o of O.items) {
    out.push(h('button', { type: 'button', class: 'prow orow', onclick: () => openDetail(o.id) },
      h('div', { class: 'oinfo' },
        h('div', { class: 'otop' }, h('b', {}, '#' + faNum(o.number)), h('span', { class: 'oname' }, o.customer)),
        h('div', { class: 'omid' }, o.preview || `${nf.format(o.items_count)} کالا`),
        h('div', { class: 'tags' }, statusTag(o.status, o.status_label), o.paid ? null : h('span', { class: 'tag' }, 'پرداخت‌نشده'), h('span', { class: 'odate' }, when(o.ts)))),
      h('div', { class: 'oprice' }, h('b', {}, money(o.total)), h('small', {}, o.currency || cur()))));
  }
  if (O.loading) out.push(h('div', { class: 'loading sm' }, h('div', { class: 'spin' })));
  else if (O.error) out.push(h('div', { class: 'msg bad' }, O.error, ' ', h('button', { type: 'button', class: 'btn sm', onclick: () => loadList(true) }, 'تلاش دوباره')));
  else if (!O.items.length) out.push(h('p', { class: 'help empty' }, O.q || O.status ? 'سفارشی با این فیلتر پیدا نشد.' : 'هنوز سفارشی ثبت نشده است.'));
  else if (O.page < O.pages) out.push(h('button', { type: 'button', class: 'btn ghost more', onclick: () => loadList(false) }, `نمایش بیشتر (${nf.format(O.items.length)} از ${nf.format(O.total)})`));
  listBox.replaceChildren(...out);
}

/* ================= جزئیات ================= */
async function openDetail(id) {
  host.replaceChildren(h('div', { class: 'loading sm' }, h('div', { class: 'spin' })));
  try {
    const o = await C.call(`/bazar/v1/orders/${id}`);
    setDetail(o); renderDetail(); window.scrollTo({ top: 0 });
  } catch (e) { C.toast(friendly(e), 'bad'); renderList(); }
}

function setDetail(o, keep) {
  D = { id: o.id, o, pending: o.status, note: '', track: o.tracking || '', notify: true, noteText: '', noteCustomer: false, busy: false, hours: (o.request && o.request.hours) || 24, apNote: '', reason: 'موجودی کافی نیست', ...(keep || {}) };
  D.o = o; D.pending = o.status; D.track = o.tracking || '';
  const i = O.items.findIndex((x) => x.id === o.id);
  if (i >= 0) O.items[i] = { ...O.items[i], status: o.status, status_label: o.status_label, paid: o.paid, total: o.total };
}

function leaveDetail() {
  if (isOrderDirty() && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. خارج می‌شوید؟')) return;
  D = null; renderList(); loadStats(); loadMeta();
}

const kv = (k, v) => (v === '' || v == null ? null : h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, v)));
const card = (title, ...kids) => h('section', { class: 'card' }, title ? h('h2', {}, title) : null, ...kids);

function renderDetail() {
  const o = D.o;
  const top = h('div', { class: 'ptop' },
    h('button', { type: 'button', class: 'btn ghost sm', onclick: leaveDetail }, icon('back', 18), 'فهرست سفارشات'),
    h('h2', {}, 'سفارش #' + faNum(o.number)));

  const head = card(null,
    h('div', { class: 'ohead' }, statusTag(o.status, o.status_label), o.paid ? h('span', { class: 'tag ok' }, 'پرداخت‌شده') : h('span', { class: 'tag warn' }, 'پرداخت‌نشده')),
    kv('تاریخ ثبت', when(o.ts)),
    kv('مبلغ کل', `${money(o.total)} ${o.currency || cur()}`),
    kv('روش پرداخت', o.payment && o.payment.title),
    kv('شناسه‌ی تراکنش', o.payment && o.payment.transaction_id),
    kv('روش ارسال', (o.shipping_methods || []).join('، ')));

  /* --- وضعیت --- */
  const settable = ((O.meta && O.meta.statuses) || []).filter((s) => s.settable || s.slug === o.status);
  const stBox = h('div', { class: 'catchips', role: 'radiogroup', 'aria-label': 'وضعیت سفارش' });
  const stBtn = h('button', { type: 'button', class: 'btn primary', onclick: saveStatus }, 'ثبت وضعیت');
  const noteIn = h('input', { class: 'in', type: 'text', maxlength: 500, placeholder: 'یادداشت همراه تغییر وضعیت (اختیاری)', 'aria-label': 'یادداشت تغییر وضعیت' });
  noteIn.value = D.note; noteIn.addEventListener('input', () => { D.note = noteIn.value; });
  const drawSt = () => {
    stBox.replaceChildren(...settable.map((s) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(D.pending === s.slug), class: 'chip sm' + (D.pending === s.slug ? ' on' : ''), onclick: () => { D.pending = s.slug; drawSt(); } }, statusLabel(s.slug, s.label))));
    const changed = D.pending !== o.status;
    stBtn.disabled = !changed || D.busy; noteIn.hidden = !changed;
  };
  const statusCard = card('وضعیت سفارش', stBox, h('div', { class: 'field', style: { marginTop: '12px' } }, noteIn),
    h('div', { class: 'btnrow' }, stBtn),
    h('p', { class: 'help' }, 'تغییر وضعیت مثل پیشخوان وردپرس ایمیل‌های مربوطه را می‌فرستد و موجودی را اصلاح می‌کند. استرداد وجه را از پیشخوان انجام دهید.'));
  drawSt();

  /* --- کد رهگیری --- */
  const trIn = h('input', { class: 'in ltr', dir: 'ltr', type: 'text', maxlength: 60, placeholder: 'کد رهگیری مرسوله', 'aria-label': 'کد رهگیری', inputmode: 'text' });
  trIn.value = D.track;
  const trBtn = h('button', { type: 'button', class: 'btn', onclick: saveTracking }, icon('truck', 18), 'ذخیره‌ی کد رهگیری');
  const ntf = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'اطلاع‌رسانی به مشتری' }); ntf.checked = D.notify;
  ntf.addEventListener('change', () => { D.notify = ntf.checked; });
  trIn.addEventListener('input', () => { D.track = trIn.value; });
  const trackCard = card('کد رهگیری مرسوله', h('div', { class: 'field' }, trIn),
    h('div', { class: 'field inline' }, h('div', { class: 'field-t' }, h('label', { class: 'lbl' }, 'اطلاع‌رسانی به مشتری'), h('div', { class: 'help' }, 'کد در ایمیل و صفحه‌ی سفارش مشتری هم نمایش داده می‌شود.')), h('label', { class: 'switch' }, ntf, h('span', { class: 'sw' }))),
    h('div', { class: 'btnrow' }, trBtn));

  /* --- اقلام --- */
  const items = (o.items || []).map((it) => h('div', { class: 'oitem' },
    h('div', { class: 'pthumb' }, it.image ? h('img', { src: it.image, alt: '', loading: 'lazy' }) : icon('image', 22)),
    h('div', { class: 'pinfo' },
      h('div', { class: 'pname wrap' }, it.name),
      (it.meta || []).length ? h('div', { class: 'help' }, it.meta.map((m) => `${m.key}: ${m.value}`).join(' · ')) : null,
      it.sku ? h('div', { class: 'help', dir: 'ltr' }, 'SKU: ' + it.sku) : null),
    h('div', { class: 'oprice' }, h('b', {}, `${nf.format(it.qty)} × ${money(it.qty ? it.subtotal / it.qty : 0)}`), h('small', {}, money(it.total)))));
  const t = o.totals || {};
  const cu = o.currency || cur();
  const itemsCard = card('اقلام سفارش', h('div', { class: 'oitems' }, items),
    h('div', { class: 'otot' },
      kv('جمع اقلام', `${money(t.subtotal)} ${cu}`),
      +t.discount ? kv('تخفیف', `− ${money(t.discount)} ${cu}`) : null,
      ...(o.fees || []).map((f) => kv(f.name, `${money(f.total)} ${cu}`)),
      +t.shipping ? kv('هزینه‌ی ارسال', `${money(t.shipping)} ${cu}`) : null,
      +t.tax ? kv('مالیات', `${money(t.tax)} ${cu}`) : null,
      h('div', { class: 'kv strong' }, h('span', {}, 'مبلغ کل'), h('b', {}, `${money(t.total)} ${cu}`)),
      +t.refunded ? kv('مسترد‌شده', `${money(t.refunded)} ${cu}`) : null));

  /* --- مشتری --- */
  const ci = o.customer_info || {};
  const wa = waLink(ci.phone);
  const acts = h('div', { class: 'btnrow' },
    ci.phone ? h('a', { class: 'btn sm', href: 'tel:' + telDigits(ci.phone) }, icon('call', 18), 'تماس') : null,
    wa ? h('a', { class: 'btn sm', href: wa, target: '_blank', rel: 'noopener' }, icon('chat', 18), 'واتس‌اپ') : null,
    isEmail(ci.email) ? h('a', { class: 'btn sm ghost', href: 'mailto:' + ci.email }, 'ایمیل') : null);
  const custCard = card('مشتری و ارسال',
    kv('نام', ci.name), ci.phone ? kv('تلفن', h('span', { dir: 'ltr' }, ci.phone)) : null, kv('ایمیل', ci.email), acts,
    o.shipping_address ? h('div', { class: 'addr' }, h('small', {}, icon('pin', 16), ' آدرس ارسال'), h('p', {}, o.shipping_address),
      h('div', { class: 'btnrow' },
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => copyText(o.shipping_address, 'آدرس') }, icon('copy', 18), 'کپی آدرس'),
        o.postcode ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => copyText(LAT(o.postcode), 'کد پستی') }, icon('copy', 18), 'کپی کد پستی ' + o.postcode) : null)) : null,
    o.customer_note ? h('div', { class: 'msg warn cnote' }, h('b', {}, 'یادداشت مشتری: '), o.customer_note) : null);

  /* --- یادداشت‌ها --- */
  const nt = h('textarea', { class: 'in', rows: 3, maxlength: 1000, placeholder: 'یادداشت جدید…', 'aria-label': 'یادداشت جدید' }); nt.value = D.noteText;
  nt.addEventListener('input', () => { D.noteText = nt.value; });
  const nc = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'ارسال برای مشتری' }); nc.checked = D.noteCustomer;
  nc.addEventListener('change', () => { D.noteCustomer = nc.checked; });
  const notes = (o.notes || []).map((n) => h('li', { class: 'onote' + (n.customer ? ' cust' : '') },
    h('p', {}, n.content), h('small', {}, `${when(n.ts)} · ${n.customer ? 'برای مشتری' : (n.by && n.by !== 'system' ? 'خصوصی · ' + n.by : 'سیستم')}`)));
  const notesCard = card('یادداشت‌ها',
    h('div', { class: 'field' }, nt),
    h('div', { class: 'field inline' }, h('div', { class: 'field-t' }, h('label', { class: 'lbl' }, 'ارسال برای مشتری'), h('div', { class: 'help' }, 'خاموش = یادداشت خصوصی (فقط برای شما).')), h('label', { class: 'switch' }, nc, h('span', { class: 'sw' }))),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', onclick: addNote }, icon('send', 18), 'افزودن یادداشت')),
    notes.length ? h('ul', { class: 'onotes' }, notes) : h('p', { class: 'help empty' }, 'یادداشتی ثبت نشده.'));

  const reqCard = requestCard(o);
  const dash = o.edit_url ? h('a', { class: 'btn ghost', href: o.edit_url, target: '_blank', rel: 'noopener', style: { margin: '0 14px 14px' } }, icon('external', 18), 'باز کردن در پیشخوان وردپرس') : null;
  host.replaceChildren(...[top, head, reqCard, o.request && o.request.state === 'awaiting' ? null : statusCard, trackCard, itemsCard, custCard, notesCard, dash].filter(Boolean)); // null را replaceChildren به‌صورت متن «null» می‌نویسد
}


/* ---------- درخواست خرید: کنترل موجودی، تأیید و رد ---------- */
function requestCard(o) {
  const r = o.request;
  if (!r) return null;
  if (r.state === 'approved') {
    return card('درخواست خرید', h('div', { class: 'msg warn' }, 'تأیید شده؛ منتظر پرداخت مشتری' + (r.expires ? ` (تا ${when(r.expires)})` : '') + '. اگر پرداخت نکند سفارش خودکار لغو و موجودی آزاد می‌شود.'));
  }
  const rows = (r.stock || []).map((s) => h('div', { class: 'oitem rq ' + (s.ok ? 'ok' : 'bad'), 'data-rq': s.ok ? 'ok' : 'short' },
    h('div', { class: 'pinfo' },
      h('div', { class: 'pname wrap' }, s.name),
      h('div', { class: 'help' }, s.managed ? `درخواست: ${nf.format(s.qty)} · موجودی: ${nf.format(s.available)}` : `درخواست: ${nf.format(s.qty)}` + (s.ok ? ' · موجود' : ''))),
    h('span', { class: 'tag ' + (s.ok ? 'ok' : 'bad') }, s.ok ? 'کافی' : (s.reason || 'ناکافی'))));

  const hours = h('input', { class: 'in', type: 'number', min: 1, max: 168, inputmode: 'numeric', 'aria-label': 'مهلت پرداخت (ساعت)' }); hours.value = D.hours;
  hours.addEventListener('input', () => { D.hours = +hours.value || 24; });
  const apNote = h('input', { class: 'in', type: 'text', maxlength: 500, placeholder: 'پیام اختیاری برای مشتری همراه تأیید', 'aria-label': 'پیام تأیید' }); apNote.value = D.apNote;
  apNote.addEventListener('input', () => { D.apNote = apNote.value; });
  const reason = h('input', { class: 'in', type: 'text', maxlength: 500, 'aria-label': 'دلیل رد' }); reason.value = D.reason;
  reason.addEventListener('input', () => { D.reason = reason.value; });

  return card('درخواست خرید: بررسی موجودی',
    h('div', { class: r.all_ok ? 'msg ok-m' : 'msg bad', role: 'status' }, r.all_ok ? 'موجودی همه‌ی اقلام کافی است.' : 'موجودی بعضی اقلام کافی نیست.'),
    h('div', { class: 'oitems' }, rows),
    h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'lbl' }, 'مهلت پرداخت بعد از تأیید (ساعت)'), hours),
    h('div', { class: 'field' }, apNote),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', 'data-act': 'approve', onclick: approveRequest }, icon('check', 18), r.all_ok ? 'تأیید و ارسال لینک پرداخت' : 'تأیید با وجود کمبود موجودی')),
    h('p', { class: 'help' }, 'با تأیید، موجودی برای مشتری رزرو می‌شود و پیوند پرداخت ایمیل می‌شود.'),
    h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'lbl' }, 'دلیل رد (برای مشتری ایمیل می‌شود)'), reason),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn danger', 'data-act': 'reject', onclick: rejectRequest }, 'رد درخواست')));
}
function approveRequest() {
  if (!D || !D.o.request) return;
  const r = D.o.request;
  if (!r.all_ok && !confirm('موجودی بعضی اقلام کافی نیست. با این حال تأیید و موجودی رزرو شود؟')) return;
  const hrs = Math.max(1, Math.min(168, Math.round(+D.hours) || 24));
  return act(`/bazar/v1/orders/${D.id}/approve`, { hours: hrs, note: D.apNote.trim(), force: !r.all_ok }, 'درخواست تأیید شد و پیوند پرداخت برای مشتری فرستاده شد', true);
}
function rejectRequest() {
  if (!D || !D.o.request) return;
  if (!confirm('درخواست رد و سفارش لغو شود؟ دلیل برای مشتری ایمیل می‌شود.')) return;
  return act(`/bazar/v1/orders/${D.id}/reject`, { reason: D.reason.trim() }, 'درخواست رد شد', true);
}

/* ---------- عملیات ---------- */
async function act(route, body, okMsg, refresh) {
  if (!D || D.busy) return;
  D.busy = true;
  try {
    const o = await C.call(route, { method: 'POST', body });
    const keep = { notify: D.notify };
    setDetail(o, keep);
    C.toast(okMsg, 'ok');
    if (body.status || refresh) loadMeta();
  } catch (e) {
    C.toast(friendly(e), 'bad');
    // درخواست هم‌زمان توسط کس دیگر بررسی شده یا موجودی عوض شده: جزئیات را تازه کن
    if (e.status === 409 && D) { try { setDetail(await C.call(`/bazar/v1/orders/${D.id}`), { notify: D.notify }); } catch { /* همان نمایش قبلی */ } }
  }
  finally { if (D) D.busy = false; if (D) renderDetail(); }
}

function saveStatus() {
  if (!D || D.pending === D.o.status) return;
  const body = { status: D.pending };
  if (D.note.trim()) body.note = D.note.trim();
  return act(`/bazar/v1/orders/${D.id}`, body, 'وضعیت سفارش به «' + statusLabel(D.pending) + '» تغییر کرد');
}
function saveTracking() {
  if (!D) return;
  return act(`/bazar/v1/orders/${D.id}`, { tracking: D.track.trim(), notify_tracking: !!D.notify }, D.track.trim() ? 'کد رهگیری ذخیره شد' : 'کد رهگیری پاک شد');
}
function addNote() {
  if (!D) return;
  const text = D.noteText.trim();
  if (!text) { C.toast('متن یادداشت را بنویسید.', 'bad'); return; }
  if (D.noteCustomer && !confirm('این یادداشت برای مشتری ایمیل می‌شود. ارسال شود؟')) return;
  return act(`/bazar/v1/orders/${D.id}/notes`, { note: text, customer: !!D.noteCustomer }, 'یادداشت افزوده شد');
}
