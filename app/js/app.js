import { h, $, mount, toast, debounce } from './dom.js';
import { icon } from './icons.js';
import { loadConn, saveConn, clearConn, connect, call, uploadImage } from './api.js';
import { renderField, presetsBlock, paletteStrip } from './fields.js';
import { mountProducts, saveCurrent, isDirty } from './products.js';
import { openStudio } from './photo.js';

const APP_VERSION = '2.1.0';
const root = $('#app');
const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const wide = () => matchMedia('(min-width:1000px)').matches;

const S = {
  conn: null, schema: null, fields: new Map(), base: {}, values: {}, site: {},
  group: null, tab: 'look', busy: false, previewOpen: false, device: 'mobile', previewUrl: '', previewTimer: 0, install: null,
};

/* ================= کمکی‌های وضعیت ================= */
const dirtyKeys = () => Object.keys(S.values).filter((k) => !same(S.values[k], S.base[k]));
function payload(keys) {
  const o = {};
  for (const k of keys) { const f = S.fields.get(k); const v = S.values[k]; o[k] = f && f.type === 'image' ? (v && v.id) || 0
    : f && f.type === 'banners' ? (v || []).filter((b) => b.img && b.img.id).map((b) => ({ img: b.img.id, link: b.link, alt: b.alt, on: b.on }))
    : v; }
  return o;
}
function setSchemaAndValues(schema, values, site) {
  S.schema = schema; S.fields = new Map(schema.fields.map((f) => [f.key, f]));
  S.base = clone(values); S.values = clone(values); S.site = site || S.site;
  if (!S.group || !schema.groups.some((g) => g.id === S.group)) S.group = schema.groups[0].id;
}
function setValue(key, v) {
  S.values[key] = v;
  updateBar();
  if (key.startsWith('color_')) refreshColorExtras();
  schedulePreview();
}

/* ================= صفحه‌ی اتصال ================= */
function viewConnect(prefill = {}, error = '') {
  const site = h('input', { class: 'in ltr', dir: 'ltr', type: 'text', inputmode: 'url', placeholder: 'https://sungold.ir', autocomplete: 'url', required: true });
  const user = h('input', { class: 'in ltr', dir: 'ltr', type: 'text', placeholder: 'admin', autocomplete: 'username', required: true });
  const pass = h('input', { class: 'in ltr', dir: 'ltr', type: 'password', placeholder: 'xxxx xxxx xxxx xxxx xxxx xxxx', autocomplete: 'current-password', required: true });
  site.value = prefill.site || ''; user.value = prefill.user || '';
  const msg = h('div', { class: 'msg bad', role: 'alert', hidden: !error }, error);
  const btn = h('button', { class: 'btn primary lg', type: 'submit' }, 'اتصال به فروشگاه');
  const lab = (t, el) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, t), el);

  const form = h('form', { class: 'card connect', novalidate: true },
    h('h1', {}, 'اتصال به فروشگاه'),
    h('p', { class: 'sub' }, 'آدرس سایت و رمز برنامه‌ی وردپرس را وارد کنید. رمز فقط روی همین دستگاه ذخیره می‌شود.'),
    lab('آدرس سایت', site), lab('نام کاربری مدیر', user), lab('رمز برنامه (Application Password)', pass), msg, btn,
    h('details', { class: 'how' },
      h('summary', {}, 'رمز برنامه را از کجا بسازم؟'),
      h('ol', {},
        h('li', {}, 'وارد پیشخوان وردپرس شوید: کاربران ← پروفایل شما.'),
        h('li', {}, 'پایین صفحه، بخش «رمزهای عبور برنامه» را پیدا کنید و نامی مثل Sungold App بنویسید.'),
        h('li', {}, 'روی «افزودن» بزنید و رمز نمایش‌داده‌شده را همین‌جا بچسبانید.')),
      h('p', { class: 'help' }, 'سایت باید HTTPS داشته باشد و قالب بازار (نسخه‌ی ۴) فعال باشد.')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); msg.hidden = true; btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'در حال اتصال…';
    try {
      const { conn, ping, data } = await connect(site.value, user.value, pass.value);
      const schema = await call(conn, '/bazar/v1/schema');
      saveConn(conn); S.conn = conn;
      setSchemaAndValues(schema, data.values, { name: ping.name, version: ping.version, url: conn.site, woocommerce: ping.woocommerce, nav_defaults: (data.site && data.site.nav_defaults) || [] });
      viewMain();
    } catch (err) {
      msg.textContent = err.message; msg.hidden = false;
    } finally { btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'اتصال به فروشگاه'; }
  });

  mount(root, h('div', { class: 'welcome' },
    h('div', { class: 'welcome-art', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('div', { class: 'welcome-t' }, h('b', {}, 'Sungold'), h('span', {}, 'مدیریت ظاهر فروشگاه')), form));
}

/* ================= صفحه‌ی اصلی اپ ================= */
let frame, pvbox, pvwrap, pvstate, colorExtras;

function viewMain() {
  const appbar = h('header', { class: 'appbar' },
    h('div', { class: 'brandmark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('div', { class: 'ttl' }, h('b', {}, S.site.name || 'Sungold'), h('small', {}, 'مدیریت فروشگاه')),
    h('button', { class: 'iconbtn light', type: 'button', onclick: openSettings, 'aria-label': 'تنظیمات اتصال' }, icon('gear')));

  frame = h('iframe', { id: 'pvframe', title: 'پیش‌نمایش سایت', sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups', referrerpolicy: 'no-referrer' });
  frame.addEventListener('load', () => setPvState(''));
  pvwrap = h('div', { id: 'pvwrap', class: 'pvwrap' }, frame);
  pvstate = h('div', { class: 'pv-state', role: 'status' });
  pvbox = h('div', { id: 'pvbox', class: 'pvbox' }, pvwrap, pvstate);
  new ResizeObserver(fit).observe(pvbox);

  const dev = (name, label, ic) => h('button', { type: 'button', 'data-dev': name, class: S.device === name ? 'on' : '', 'aria-label': label,
    onclick: () => { S.device = name; document.querySelectorAll('[data-dev]').forEach((b) => b.classList.toggle('on', b.dataset.dev === name)); fit(); } }, icon(ic, 20));
  const pane = h('section', { class: 'pane', id: 'pane', 'aria-label': 'پیش‌نمایش' },
    h('div', { class: 'pane-h' },
      h('b', {}, 'پیش‌نمایش زنده'),
      h('div', { class: 'seg tiny' }, dev('mobile', 'موبایل', 'phone'), dev('desktop', 'دسکتاپ', 'monitor')),
      h('div', { class: 'pane-a' },
        h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'بازخوانی', onclick: () => schedulePreview(true) }, icon('refresh', 20)),
        h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'باز کردن در تب جدید', onclick: () => S.previewUrl && window.open(S.previewUrl, '_blank', 'noopener') }, icon('external', 20)),
        h('button', { class: 'iconbtn only-narrow', type: 'button', 'aria-label': 'بستن', onclick: closePreview }, icon('close', 20)))),
    pvbox,
    h('p', { class: 'pane-f' }, 'اگر پیش‌نمایش خالی ماند، سایت نمایش در فریم را مسدود کرده؛ از دکمه‌ی «باز کردن در تب جدید» استفاده کنید.'));

  mount(root,
    h('div', { class: 'shell' },
      h('div', { class: 'col' }, appbar, tabsNav(), h('nav', { class: 'groups', id: 'groups', 'aria-label': 'بخش‌های تنظیمات' }), h('main', { class: 'form', id: 'form' })),
      pane),
    h('div', { class: 'bar', id: 'bar' }));
  drawGroups(); renderForm(); updateBar();
  if (S.tab === 'products') setTab('products'); else if (wide()) schedulePreview(true);
}

/* ---------- تب‌های اصلی: ظاهر قالب | محصولات ---------- */
const prodCtx = () => ({ call: (route, opts) => call(S.conn, route, opts), upload: (f) => uploadImage(S.conn, f), toast, studio: (file, onUse) => openStudio({ toast }, file, { onUse }), siteName: S.site.name, siteUrl: S.site.url, woocommerce: S.site.woocommerce !== false });
function tabsNav() {
  const t = (id, label, ic) => h('button', { type: 'button', role: 'tab', 'data-tab': id, class: S.tab === id ? 'on' : '', 'aria-selected': String(S.tab === id), onclick: () => setTab(id) }, icon(ic, 18), label);
  return h('nav', { class: 'apptabs', role: 'tablist', 'aria-label': 'بخش‌های اپ' }, t('look', 'ظاهر', 'palette'), t('banners', 'بنرها', 'image'), t('products', 'محصولات', 'box'));
}
function syncTabs() {
  document.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
}
function setTab(t) {
  S.tab = t;
  if (t === 'banners') S.group = 'home';
  const shell = $('.shell'); if (shell) shell.classList.toggle('mode-products', t === 'products');
  document.body.classList.toggle('pmode', t === 'products');
  const bar = $('#bar'); if (bar) bar.hidden = t === 'products';
  syncTabs();
  if (t !== 'banners') window.scrollTo({ top: 0 });
  if (t === 'products') mountProducts($('#form'), prodCtx());
  else {
    drawGroups(); renderForm(); updateBar(); schedulePreview(true);
    if (t === 'banners') requestAnimationFrame(() => { const el = $('.field[data-key=banners]'); if (el) { const top = el.getBoundingClientRect().top + scrollY - 130; window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } });
  }
}

function drawGroups() {
  $('#groups').replaceChildren(...S.schema.groups.map((g) => h('button', {
    type: 'button', class: 'chip' + (g.id === S.group ? ' on' : ''), 'aria-current': g.id === S.group ? 'true' : null,
    onclick: () => { S.group = g.id; if (S.tab === 'banners') { S.tab = 'look'; syncTabs(); } drawGroups(); renderForm(); window.scrollTo({ top: 0 }); },
  }, icon(g.icon, 18), g.label)));
}

function renderForm() {
  const ctx = { toast, upload: (file) => uploadImage(S.conn, file), navDefaults: () => S.site.nav_defaults || [] };
  const fields = S.schema.fields.filter((f) => f.group === S.group);
  const out = [];
  let card = null;
  const openCard = (title) => { card = h('section', { class: 'card' }, title ? h('h2', {}, title) : null); out.push(card); };
  openCard(null);

  if (S.group === 'colors') {
    const presets = presetsBlock(S.schema.presets || [], () => S.values, (colors) => {
      Object.entries(colors).forEach(([k, v]) => { S.values[k] = v; });
      S.stamp = (S.stamp || 0) + 1; updateBar(); renderForm(); schedulePreview();
    });
    colorExtras = { presets, strip: paletteStrip(S.values) };
    card.append(h('h2', {}, 'پالت‌های آماده'), presets.el);
    openCard('رنگ‌ها');
  }

  for (const f of fields) {
    if (f.section && !(S.group === 'colors' && f.section === 'رنگ‌ها')) openCard(f.section);
    card.append(renderField(f, S.values[f.key], (v) => setValue(f.key, v), ctx));
    if (S.group === 'colors' && f.key === 'color_sale') {
      card.append(h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'پالت نهایی (خودکار هماهنگ می‌شود)'), colorExtras.strip,
        h('p', { class: 'help' }, 'از این ۴ رنگ، بقیه‌ی رنگ‌ها (روشن، تیره، پس‌زمینه و …) به‌طوری ساخته می‌شوند که متن همیشه خوانا بماند.')));
    }
  }
  if (S.group === 'brand' && S.site.woocommerce === false) {
    out.push(h('div', { class: 'msg warn' }, 'ووکامرس روی این سایت فعال نیست؛ بخش‌های محصول در سایت نمایش داده نمی‌شوند.'));
  }
  $('#form').replaceChildren(...out.filter((el) => el.children.length > 0 || el.textContent.trim())); // کارت خالی نشان نده
}

function refreshColorExtras() {
  if (!colorExtras || S.group !== 'colors') return;
  const next = paletteStrip(S.values);
  colorExtras.strip.replaceWith(next); colorExtras.strip = next;
  colorExtras.presets.redraw();
}

/* ================= نوار پایین ================= */
function updateBar() {
  const n = dirtyKeys().length;
  const bar = $('#bar'); if (!bar) return;
  bar.classList.toggle('dirty', n > 0);
  bar.replaceChildren(
    h('div', { class: 'bar-s' }, n ? h('span', { class: 'dot' }) : icon('check', 18), n ? `${n} تغییر ذخیره‌نشده` : 'همه‌چیز ذخیره و منتشر است'),
    h('div', { class: 'bar-a' },
      h('button', { type: 'button', class: 'btn ghost only-narrow', onclick: openPreview }, icon('eye', 18), 'پیش‌نمایش'),
      n ? h('button', { type: 'button', class: 'btn ghost', onclick: undo, disabled: S.busy }, icon('undo', 18), 'بازگردانی') : null,
      h('button', { type: 'button', class: 'btn primary' + (S.busy ? ' busy' : ''), disabled: !n || S.busy, onclick: save }, S.busy ? 'در حال ذخیره…' : 'ذخیره و انتشار')));
}

function undo() { S.values = clone(S.base); updateBar(); renderForm(); schedulePreview(true); }

async function save() {
  const keys = dirtyKeys(); if (!keys.length || S.busy) return;
  S.busy = true; updateBar();
  try {
    const r = await call(S.conn, '/bazar/v1/settings', { method: 'POST', body: { values: payload(keys) } });
    S.base = clone(r.values); S.values = clone(r.values);
    (r.notes || []).forEach((n) => toast(n.message, 'warn'));
    if (!(r.notes || []).length) toast('تغییرات ذخیره و روی سایت منتشر شد' + (r.purged && r.purged.length ? ' (کش پاک شد)' : ''), 'ok');
    renderForm(); schedulePreview(true);
  } catch (e) { fail(e); } finally { S.busy = false; updateBar(); }
}

function fail(e) {
  toast(e.message || 'خطای ناشناخته', 'bad');
  if (e.status === 401 || e.status === 403) openSettings();
}

/* ================= پیش‌نمایش ================= */
const previewVisible = () => wide() || S.previewOpen;
function openPreview() { S.previewOpen = true; $('#pane').classList.add('open'); document.body.classList.add('lock'); schedulePreview(true); requestAnimationFrame(fit); }
function closePreview() { S.previewOpen = false; $('#pane').classList.remove('open'); document.body.classList.remove('lock'); }
function setPvState(t) { if (!pvstate) return; pvstate.textContent = t; pvstate.classList.toggle('show', !!t); }

function schedulePreview(now) {
  clearTimeout(S.previewTimer);
  if (S.tab === 'products' || !previewVisible()) return;
  S.previewTimer = setTimeout(refreshPreview, now ? 0 : 900);
}
async function refreshPreview() {
  if (!previewVisible() || !frame) return;
  setPvState('در حال ساخت پیش‌نمایش…');
  try {
    const r = await call(S.conn, '/bazar/v1/preview', { method: 'POST', body: { values: payload(dirtyKeys()), path: '/' } });
    S.previewUrl = r.url; frame.src = r.url;
    setTimeout(() => setPvState(''), 15000);
  } catch (e) { setPvState(''); fail(e); }
}
function fit() {
  if (!pvbox || !pvwrap) return;
  const fw = S.device === 'mobile' ? 390 : 1280;
  const bw = pvbox.clientWidth - 24, bh = pvbox.clientHeight - 24;
  if (bw <= 0 || bh <= 0) return;
  const sc = Math.min(1, bw / fw);
  pvwrap.style.width = fw * sc + 'px'; pvwrap.style.height = bh + 'px';
  frame.style.width = fw + 'px'; frame.style.height = bh / sc + 'px'; frame.style.transform = `scale(${sc})`;
}
matchMedia('(min-width:1000px)').addEventListener('change', () => { closePreview(); if (S.schema) schedulePreview(true); });

/* ================= تنظیمات اتصال ================= */
function openSettings() {
  const close = () => sheet.remove();
  const row = (k, v) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { dir: 'ltr' }, v || '—'));
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'تنظیمات اتصال', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet-c card' },
      h('div', { class: 'sheet-h' }, h('h2', {}, 'اتصال و ابزارها'), h('button', { class: 'iconbtn', type: 'button', onclick: close, 'aria-label': 'بستن' }, icon('close'))),
      row('سایت', S.conn.site), row('کاربر', S.conn.user), row('نسخه‌ی قالب', S.site.version), row('نسخه‌ی اپ', APP_VERSION),
      S.install ? h('button', { class: 'btn', type: 'button', onclick: async () => { S.install.prompt(); await S.install.userChoice; S.install = null; close(); } }, icon('download', 18), 'نصب اپ روی دستگاه') : null,
      h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!confirm('همه‌ی تنظیمات ظاهری قالب به حالت پیش‌فرض برمی‌گردد (نام سایت و لوگو دست‌نخورده می‌مانند). ادامه می‌دهید؟')) return;
        try { const r = await call(S.conn, '/bazar/v1/settings/reset', { method: 'POST' }); S.base = clone(r.values); S.values = clone(r.values); renderForm(); updateBar(); schedulePreview(true); toast('به پیش‌فرض برگشت', 'ok'); close(); } catch (e) { fail(e); }
      } }, icon('undo', 18), 'بازنشانی تنظیمات قالب'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (dirtyKeys().length && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. قطع اتصال؟')) return; clearConn(); location.reload(); } }, icon('logout', 18), 'قطع اتصال')));
  document.body.append(sheet);
}

/* ================= راه‌اندازی ================= */
async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.install = e; });
  addEventListener('beforeunload', (e) => { if (S.schema && (dirtyKeys().length || isDirty())) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.schema) { e.preventDefault(); if (S.tab === 'products') saveCurrent(); else save(); } });

  const c = loadConn();
  if (!c) return viewConnect();
  mount(root, h('div', { class: 'loading' }, h('div', { class: 'spin' }), 'در حال اتصال…'));
  try {
    S.conn = c;
    const [schema, data, ping] = await Promise.all([
      call(c, '/bazar/v1/schema'), call(c, '/bazar/v1/settings'), call(c, '/bazar/v1/ping', { auth: false }).catch(() => ({})),
    ]);
    setSchemaAndValues(schema, data.values, { name: (data.site && data.site.name) || ping.name, version: (data.site && data.site.version) || ping.version, url: c.site, woocommerce: ping.woocommerce, nav_defaults: (data.site && data.site.nav_defaults) || [] });
    viewMain();
  } catch (e) {
    S.conn = null;
    viewConnect({ site: c.site, user: c.user }, e.message);
  }
}
boot();
