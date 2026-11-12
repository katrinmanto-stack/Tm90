// تب «محصولات»: فهرست، ویرایش، تصاویر و پنل سئو با امتیاز زنده.
import { h, debounce } from './dom.js';
import { icon } from './icons.js';
import { analyze, suggest, gradeLabel, len, clip, stripHtml } from './seo.js';

const P = { meta: null, items: [], total: 0, page: 0, pages: 0, q: '', status: '', loading: false, error: '', token: 0 };
let host = null, C = null, E = null, listBox = null, bar = null, seoRefs = null;
const clone = (x) => JSON.parse(JSON.stringify(x));
const fmt = (v) => { const n = Math.round(+v || 0); return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—'; };
const seoWritable = () => !!(P.meta && P.meta.seo && P.meta.seo.writable);

export const isDirty = () => !!E && JSON.stringify(E.v) !== E.base;

export function mountProducts(el, ctx) {
  host = el; C = ctx;
  if (!ctx.woocommerce) { host.replaceChildren(h('div', { class: 'msg warn' }, 'ووکامرس روی این سایت فعال نیست؛ مدیریت محصول در دسترس نیست.')); return; }
  if (E) renderEdit(); else renderList();
  if (!P.meta) loadMeta();
  if (!P.items.length && !P.loading && !P.error) loadList(true);
}

async function loadMeta() {
  try { P.meta = await C.call('/bazar/v1/products/meta'); if (E) renderEdit(); else drawList(); }
  catch (e) { P.error = e.message; drawList(); }
}

async function loadList(reset) {
  if (P.loading && !reset) return;
  if (reset) { P.items = []; P.page = 0; P.pages = 0; P.total = 0; }
  const token = ++P.token;
  P.loading = true; P.error = ''; drawList();
  try {
    const query = { page: String(P.page + 1) };
    if (P.q) query.search = P.q;
    if (P.status) query.status = P.status;
    const r = await C.call('/bazar/v1/products', { query });
    if (token !== P.token) return;
    P.items.push(...r.items); P.page = r.page; P.pages = r.pages; P.total = r.total;
  } catch (e) { if (token === P.token) P.error = e.message; }
  finally { if (token === P.token) { P.loading = false; if (!E) drawList(); } }
}

/* ================= فهرست ================= */
function renderList() {
  E = null; bar = null;
  const search = h('input', { class: 'in', type: 'search', placeholder: 'جستجوی محصول…', 'aria-label': 'جستجوی محصول', autocomplete: 'off' });
  search.value = P.q;
  search.addEventListener('input', debounce(() => { P.q = search.value.trim(); loadList(true); }, 400));
  const chip = (val, label) => h('button', { type: 'button', class: 'chip sm' + (P.status === val ? ' on' : ''), onclick: () => { P.status = val; renderList(); loadList(true); } }, label);
  listBox = h('div', { class: 'plist', id: 'plist' });
  host.replaceChildren(
    h('section', { class: 'card phead' }, search,
      h('div', { class: 'prow-chips' }, chip('', 'همه'), chip('publish', 'منتشرشده'), chip('draft', 'پیش‌نویس')),
      h('button', { type: 'button', class: 'btn primary', onclick: () => openEdit(null) }, icon('plus', 18), 'محصول جدید')),
    listBox);
  drawList();
}

function drawList() {
  if (!listBox || E) return;
  const out = [];
  const noSeo = P.meta && !seoWritable();
  for (const p of P.items) {
    const price = p.sale_price
      ? [h('b', {}, fmt(p.price)), h('s', {}, fmt(p.regular_price))]
      : [h('b', {}, fmt(p.price))];
    out.push(h('button', { type: 'button', class: 'prow', onclick: () => openEdit(p.id) },
      h('div', { class: 'pthumb' }, p.image && p.image.url ? h('img', { src: p.image.url, alt: '', loading: 'lazy' }) : icon('image', 22)),
      h('div', { class: 'pinfo' },
        h('div', { class: 'pname' }, p.name || '(بدون نام)'),
        h('div', { class: 'pprice' }, ...price, h('small', {}, (P.meta && P.meta.currency) || '')),
        h('div', { class: 'tags' },
          p.status !== 'publish' ? h('span', { class: 'tag' }, p.status === 'draft' ? 'پیش‌نویس' : 'در انتظار') : null,
          p.stock_status === 'outofstock' ? h('span', { class: 'tag bad' }, 'ناموجود') : null,
          noSeo ? null : h('span', { class: 'tag ' + (p.seo_set ? 'ok' : 'warn') }, p.seo_set ? 'سئو تنظیم‌شده' : 'سئو ناقص')))));
  }
  if (P.loading) out.push(h('div', { class: 'loading sm' }, h('div', { class: 'spin' })));
  else if (P.error) out.push(h('div', { class: 'msg bad' }, P.error, ' ', h('button', { type: 'button', class: 'btn sm', onclick: () => loadList(true) }, 'تلاش دوباره')));
  else if (!P.items.length) out.push(h('p', { class: 'help empty' }, P.q ? 'محصولی با این جست‌وجو پیدا نشد.' : 'هنوز محصولی ثبت نشده است.'));
  else if (P.page < P.pages) out.push(h('button', { type: 'button', class: 'btn ghost more', onclick: () => loadList(false) }, `نمایش بیشتر (${P.items.length} از ${P.total})`));
  listBox.replaceChildren(...out);
}

/* ================= ویرایش ================= */
const blank = () => ({
  name: '', slug: '', status: 'draft', short_description: '', description: '', sku: '', regular_price: '', sale_price: '',
  manage_stock: false, stock_quantity: 0, stock_status: 'instock', categories: [],
  image: { id: 0, url: '', alt: '' }, gallery: [], seo: { title: '', desc: '', kw: '', noindex: false },
  type: 'simple', edit_prices: true, permalink: '',
});

function fromServer(p) {
  return {
    name: p.name || '', slug: p.slug || '', status: p.status === 'publish' ? 'publish' : 'draft',
    short_description: p.short_description || '', description: p.description || '', sku: p.sku || '',
    regular_price: p.regular_price || '', sale_price: p.sale_price || '',
    manage_stock: !!p.manage_stock, stock_quantity: p.stock_quantity == null ? 0 : p.stock_quantity, stock_status: p.stock_status || 'instock',
    categories: p.categories || [], image: p.image && p.image.id ? p.image : { id: 0, url: '', alt: '' }, gallery: p.gallery || [],
    seo: { title: '', desc: '', kw: '', noindex: false, ...(p.seo || {}) },
    type: p.type || 'simple', edit_prices: p.edit_prices !== false, permalink: p.permalink || '',
  };
}

async function openEdit(id) {
  if (id == null) { E = { id: 0, v: blank(), base: '', busy: false }; E.base = JSON.stringify(E.v); return renderEdit(); }
  host.replaceChildren(h('div', { class: 'loading sm' }, h('div', { class: 'spin' })));
  try {
    const p = await C.call(`/bazar/v1/products/${id}`);
    E = { id, v: fromServer(p), base: '', busy: false }; E.base = JSON.stringify(E.v);
    renderEdit();
  } catch (e) { C.toast(e.message, 'bad'); renderList(); }
}

function leaveEdit() {
  if (isDirty() && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. خارج می‌شوید؟')) return;
  E = null; renderList();
}

const fld = (label, control, help) => h('div', { class: 'field' }, h('label', { class: 'lbl' }, label), control, help ? h('div', { class: 'help' }, help) : null);
function inp(get, set, o = {}) {
  const el = h('input', { class: 'in' + (o.ltr ? ' ltr' : ''), type: 'text', inputmode: o.mode || null, dir: o.ltr ? 'ltr' : null, placeholder: o.ph || null, maxlength: o.max || null, autocomplete: 'off', spellcheck: 'false', 'aria-label': o.label || null });
  el.value = get() ?? '';
  el.addEventListener('input', () => set(el.value));
  return el;
}
function area(get, set, rows, o = {}) {
  const el = h('textarea', { class: 'in', rows, maxlength: o.max || null, placeholder: o.ph || null, 'aria-label': o.label || null });
  el.value = get() ?? '';
  el.addEventListener('input', () => set(el.value));
  return el;
}
const toggleRow = (label, help, get, set) => {
  const i = h('input', { type: 'checkbox', role: 'switch', 'aria-label': label }); i.checked = !!get();
  i.addEventListener('change', () => set(i.checked));
  return h('div', { class: 'field inline' }, h('div', { class: 'field-t' }, h('label', { class: 'lbl' }, label), help ? h('div', { class: 'help' }, help) : null), h('label', { class: 'switch' }, i, h('span', { class: 'sw' })));
};

function touch() { updateBar(); seoRefresh(); }

function renderEdit() {
  const v = E.v;
  seoRefs = null;
  const top = h('div', { class: 'ptop' },
    h('button', { type: 'button', class: 'btn ghost sm', onclick: leaveEdit }, icon('back', 18), 'فهرست محصولات'),
    h('h2', {}, E.id ? 'ویرایش محصول' : 'محصول جدید'));

  const basic = h('section', { class: 'card' }, h('h2', {}, 'اطلاعات اصلی'),
    fld('نام محصول', inp(() => v.name, (x) => { v.name = x; touch(); }, { max: 200, label: 'نام محصول' })),
    toggleRow('منتشر شده در سایت', 'اگر خاموش باشد، محصول پیش‌نویس می‌ماند.', () => v.status === 'publish', (x) => { v.status = x ? 'publish' : 'draft'; touch(); }),
    fld('توضیح کوتاه', area(() => v.short_description, (x) => { v.short_description = x; touch(); }, 3, { label: 'توضیح کوتاه' }), 'بالای دکمه‌ی خرید نمایش داده می‌شود.'),
    fld('توضیحات کامل', area(() => v.description, (x) => { v.description = x; touch(); }, 8, { label: 'توضیحات کامل' }), 'مشخصات، جنس، اندازه، نحوه‌ی نگهداری و کاربرد را بنویسید (حداقل ۱۵۰ کلمه برای سئو).'));

  const price = h('section', { class: 'card' }, h('h2', {}, 'قیمت و موجودی'));
  if (v.edit_prices) {
    price.append(
      h('div', { class: 'two' },
        fld('قیمت (' + ((P.meta && P.meta.currency) || '') + ')', inp(() => v.regular_price, (x) => { v.regular_price = x; touch(); }, { ltr: true, mode: 'decimal', label: 'قیمت' })),
        fld('قیمت با تخفیف', inp(() => v.sale_price, (x) => { v.sale_price = x; touch(); }, { ltr: true, mode: 'decimal', label: 'قیمت با تخفیف' }))));
  } else {
    price.append(h('div', { class: 'msg warn' }, 'قیمت این نوع محصول (متغیر/گروهی) را در پیشخوان وردپرس ویرایش کنید.'));
  }
  const stockBox = h('div', {});
  const drawStock = () => stockBox.replaceChildren(v.manage_stock
    ? fld('تعداد موجودی', inp(() => String(v.stock_quantity), (x) => { v.stock_quantity = x; touch(); }, { ltr: true, mode: 'numeric', label: 'تعداد موجودی' }))
    : fld('وضعیت موجودی', segStock()));
  const segStock = () => {
    const opts = [['instock', 'موجود'], ['outofstock', 'ناموجود'], ['onbackorder', 'پیش‌سفارش']];
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'وضعیت موجودی' });
    const draw = () => wrap.replaceChildren(...opts.map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v.stock_status === k), class: v.stock_status === k ? 'on' : '', onclick: () => { v.stock_status = k; draw(); touch(); } }, l)));
    draw(); return wrap;
  };
  price.append(
    fld('کد محصول (SKU)', inp(() => v.sku, (x) => { v.sku = x; touch(); }, { ltr: true, max: 60, label: 'SKU' }), 'اختیاری؛ باید یکتا باشد.'),
    toggleRow('مدیریت تعداد موجودی', 'با هر فروش از تعداد کم می‌شود.', () => v.manage_stock, (x) => { v.manage_stock = x; drawStock(); touch(); }),
    stockBox);
  drawStock();

  const cats = (P.meta && P.meta.categories) || [];
  const byId = new Map(cats.map((c) => [c.id, c]));
  const label = (c) => (c.parent && byId.get(c.parent) ? byId.get(c.parent).name + ' › ' : '') + c.name;
  const catBox = h('div', { class: 'catchips' });
  const drawCats = () => catBox.replaceChildren(...cats.map((c) => h('button', { type: 'button', class: 'chip sm' + (v.categories.includes(c.id) ? ' on' : ''), 'aria-pressed': String(v.categories.includes(c.id)),
    onclick: () => { v.categories = v.categories.includes(c.id) ? v.categories.filter((x) => x !== c.id) : [...v.categories, c.id]; drawCats(); touch(); } }, label(c))));
  drawCats();
  const catCard = h('section', { class: 'card' }, h('h2', {}, 'دسته‌بندی'), cats.length ? catBox : h('p', { class: 'help' }, P.meta ? 'هنوز دسته‌ای ساخته نشده؛ در ووکامرس بسازید.' : 'در حال بارگذاری دسته‌ها…'));

  host.replaceChildren(top, basic, price, catCard, imagesCard(), seoCard(), h('div', { class: 'bar pbar', id: 'pbar' }));
  bar = host.querySelector('#pbar');
  updateBar(); seoRefresh();
}

/* ---------- تصاویر ---------- */
function pickFile(btn, then) {
  const f = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
  f.onchange = async () => {
    const file = f.files[0]; if (!file) return;
    btn.disabled = true; btn.classList.add('busy');
    try { then(await C.upload(file)); } catch (e) { C.toast(e.message, 'bad'); }
    finally { btn.disabled = false; btn.classList.remove('busy'); f.value = ''; }
  };
  btn.onclick = () => f.click();
  return f;
}

/** انتخاب عکس خام ← استودیوی عکس ← آپلود نتیجه. onResult({id,url}) */
function rawPicker(btn, onResult) {
  const f = h('input', { type: 'file', accept: 'image/*', hidden: true });
  f.onchange = () => {
    const file = f.files[0]; f.value = '';
    if (file) C.studio(file, async (out) => { onResult(await C.upload(out)); });
  };
  btn.onclick = () => f.click();
  return f;
}

function imagesCard() {
  const v = E.v;
  const card = h('section', { class: 'card' }, h('h2', {}, 'تصاویر'));
  const main = h('div', {}), gal = h('div', { class: 'list' });
  const altIn = (img, ph) => { const el = h('input', { class: 'in', type: 'text', placeholder: ph, maxlength: 125, autocomplete: 'off', 'aria-label': ph }); el.value = img.alt || ''; el.addEventListener('input', () => { img.alt = el.value; touch(); }); return el; };

  const drawMain = () => {
    const pick = h('button', { type: 'button', class: 'btn sm ghost' }, icon('image', 18), 'انتخاب تصویر آماده');
    const file = pickFile(pick, (r) => { v.image = { id: r.id, url: r.url, alt: v.image.alt || '' }; drawMain(); touch(); });
    const raw = h('button', { type: 'button', class: 'btn sm primary' }, icon('wand', 18), v.image.id ? 'عکس خام جدید' : 'آماده‌سازی عکس خام');
    const rawFile = rawPicker(raw, (r) => { v.image = { id: r.id, url: r.url, alt: v.image.alt || v.name.trim() }; drawMain(); touch(); });
    const del = h('button', { type: 'button', class: 'btn sm ghost', hidden: !v.image.id, onclick: () => { v.image = { id: 0, url: '', alt: '' }; drawMain(); touch(); } }, icon('trash', 18), 'حذف');
    main.replaceChildren(h('div', { class: 'imgf' }, h('div', { class: 'thumb big' }, v.image.url ? h('img', { src: v.image.url, alt: '' }) : icon('image', 30)), h('div', { class: 'imgf-b' }, raw, pick, del, file, rawFile)),
      v.image.id ? h('div', { class: 'altrow' }, altIn(v.image, 'متن جایگزین تصویر اصلی (alt)')) : null);
  };
  const drawGal = () => {
    const add = h('button', { type: 'button', class: 'btn sm ghost', disabled: v.gallery.length >= 12 }, icon('plus', 18), 'افزودن تصویر آماده');
    const file = pickFile(add, (r) => { v.gallery.push({ id: r.id, url: r.url, alt: '' }); drawGal(); touch(); });
    const addRaw = h('button', { type: 'button', class: 'btn sm primary', disabled: v.gallery.length >= 12 }, icon('wand', 18), 'افزودن عکس خام');
    const addRawFile = rawPicker(addRaw, (r) => { v.gallery.push({ id: r.id, url: r.url, alt: v.name.trim() }); drawGal(); touch(); });
    gal.replaceChildren(...v.gallery.map((g, i) => h('div', { class: 'gitem' },
      h('div', { class: 'thumb' }, g.url ? h('img', { src: g.url, alt: '' }) : icon('image', 22)),
      altIn(g, 'متن جایگزین (alt) تصویر ' + (i + 1)),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'حذف تصویر', onclick: () => { v.gallery.splice(i, 1); drawGal(); touch(); } }, icon('trash', 18)))),
      h('div', { class: 'btnrow' }, addRaw, add, file, addRawFile));
  };
  drawMain(); drawGal();
  card.append(main, h('h3', { class: 'sub-h' }, 'گالری'), gal, h('p', { class: 'help' }, 'متن جایگزین (alt) برای سئوی تصاویر و کاربران نابینا مهم است؛ نام و ویژگی اصلی محصول را کوتاه بنویسید.'));
  return card;
}

/* ---------- سئو ---------- */
const cntLevel = (n, ok, warn) => (n >= ok[0] && n <= ok[1] ? 'ok' : n >= warn[0] && n <= warn[1] ? 'warn' : 'bad');

function seoCard() {
  const v = E.v, seo = v.seo, meta = P.meta;
  const card = h('section', { class: 'card seo' }, h('h2', {}, 'سئوی محصول'));
  const writable = seoWritable();
  const driverNote = !meta ? null
    : meta.seo.driver === 'other' ? h('div', { class: 'msg warn' }, 'افزونه‌ی سئوی دیگری روی سایت فعال است. عنوان و توضیح متا را از خود آن افزونه تنظیم کنید؛ این‌جا فقط تحلیل و نامک/تصاویر قابل ویرایش است.')
    : h('p', { class: 'help' }, 'ذخیره در: ', h('b', {}, meta.seo.label), meta.seo.driver === 'native' ? '' : ' (اگر عنوان خالی بماند، الگوی پیش‌فرض خود افزونه استفاده می‌شود).');

  const scoreBox = h('div', { class: 'seo-score' }), serpBox = h('div', { class: 'serp', dir: 'rtl' }), listEl = h('ul', { class: 'chk' });
  const tCnt = h('span', { class: 'cnt' }), dCnt = h('span', { class: 'cnt' });

  const inTitle = inp(() => seo.title, (x) => { seo.title = x; touch(); }, { max: 120, label: 'عنوان سئو', ph: v.name || 'عنوان صفحه در گوگل' });
  const inDesc = area(() => seo.desc, (x) => { seo.desc = x; touch(); }, 3, { max: 320, label: 'توضیح متا', ph: 'خلاصه‌ی جذاب برای نتیجه‌ی گوگل (۱۲۰ تا ۱۶۰ کاراکتر)' });
  const inKw = inp(() => seo.kw, (x) => { seo.kw = x; touch(); }, { max: 80, label: 'کلمه‌ی کلیدی اصلی', ph: 'مثلاً مانتو کتان تابستانی' });
  const inSlug = inp(() => v.slug, (x) => { v.slug = x; touch(); }, { max: 120, label: 'نامک', ph: 'نشانی کوتاه محصول' });

  const auto = h('button', { type: 'button', class: 'btn sm', onclick: () => {
    const s = suggest({ name: v.name, short_description: v.short_description, description: v.description }, C.siteName || '');
    if (writable && !seo.title) { seo.title = s.title; inTitle.value = s.title; }
    if (writable && !seo.desc) { seo.desc = s.desc; inDesc.value = s.desc; }
    if (!v.slug && v.name.trim()) { v.slug = v.name.trim().split(/\s+/).slice(0, 6).join('-'); inSlug.value = v.slug; }
    touch(); C.toast('موارد خالی با پیشنهاد خودکار پر شد؛ پیش از ذخیره ویرایش کنید.', 'ok');
  } }, icon('wand', 18), 'پر کردن خودکار');

  card.append(...[driverNote, scoreBox,
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'پیش‌نمایش در گوگل'), serpBox),
    writable ? fld('عنوان سئو', inTitle) : null, writable ? tCnt : null,
    writable ? fld('توضیح متا', inDesc) : null, writable ? dCnt : null,
    writable ? fld('کلمه‌ی کلیدی اصلی', inKw, 'تحلیل پایین بر اساس همین کلمه انجام می‌شود.') : null,
    fld('نامک (نشانی محصول)', inSlug, 'کوتاه و شامل کلمه‌ی کلیدی؛ فاصله‌ها به خط‌تیره تبدیل می‌شوند.'),
    writable && meta && meta.seo.noindex ? toggleRow('مخفی از گوگل (noindex)', 'فقط برای محصولاتی که نمی‌خواهید در گوگل دیده شوند.', () => seo.noindex, (x) => { seo.noindex = x; touch(); }) : null,
    h('div', { class: 'btnrow' }, auto),
    h('h3', { class: 'sub-h' }, 'بررسی سئو'), listEl].filter(Boolean));
  seoRefs = { scoreBox, serpBox, listEl, tCnt, dCnt };
  return card;
}

function seoRefresh() {
  if (!seoRefs || !E) return;
  const v = E.v, seo = v.seo, { scoreBox, serpBox, listEl, tCnt, dCnt } = seoRefs;
  const res = analyze({ name: v.name, slug: v.slug, short_description: v.short_description, description: v.description, image: v.image, gallery: v.gallery, seo }, { siteName: C.siteName, editable: seoWritable() });

  scoreBox.className = 'seo-score ' + res.grade;
  scoreBox.replaceChildren(h('b', { class: 'big' }, String(res.score)), h('div', { class: 'sc-t' }, h('b', {}, gradeLabel[res.grade]), h('div', { class: 'meter', role: 'img', 'aria-label': `امتیاز سئو ${res.score} از ۱۰۰` }, h('i', { style: { width: res.score + '%' } }))));

  let host_ = '';
  try { host_ = new URL((P.meta && P.meta.site && P.meta.site.url) || C.siteUrl || location.origin).host; } catch { /* خالی */ }
  let path = v.slug || '…';
  if (E.v.permalink && v.slug) { try { path = decodeURIComponent(new URL(E.v.permalink).pathname).split('/').filter(Boolean).join(' › '); } catch { /* همان نامک */ } }
  else path = 'product › ' + path;
  const t = seo.title || v.name || 'عنوان محصول';
  const d = seo.desc || stripHtml(v.short_description) || stripHtml(v.description) || 'توضیح متا خالی است؛ گوگل بخشی از متن صفحه را نشان می‌دهد.';
  serpBox.replaceChildren(h('div', { class: 'serp-u', dir: 'ltr' }, `${host_} › ${path.replace(/ › /g, ' › ')}`), h('div', { class: 'serp-t' }, clip(t, 60)), h('div', { class: 'serp-d' }, clip(d, 160)));

  const tl = len(seo.title), dl = len(seo.desc);
  tCnt.className = 'cnt ' + (tl ? cntLevel(tl, [30, 60], [15, 70]) : ''); tCnt.textContent = tl ? `${tl} کاراکتر · ایده‌آل ۳۰ تا ۶۰` : '';
  dCnt.className = 'cnt ' + (dl ? cntLevel(dl, [120, 160], [70, 200]) : ''); dCnt.textContent = dl ? `${dl} کاراکتر · ایده‌آل ۱۲۰ تا ۱۶۰` : '';

  const order = { bad: 0, warn: 1, ok: 2 };
  listEl.replaceChildren(...[...res.items].sort((a, b) => order[a.level] - order[b.level]).map((i) =>
    h('li', { class: 'chk-i ' + i.level }, h('span', { class: 'chk-m', 'aria-hidden': 'true' }, icon(i.level === 'ok' ? 'check' : 'alert', 16)), h('div', {}, h('b', {}, i.title), i.hint ? h('div', { class: 'help' }, i.hint) : null))));
}

/* ================= نوار ذخیره ================= */
function updateBar() {
  if (!bar || !E) return;
  const dirty = isDirty();
  bar.classList.toggle('dirty', dirty);
  const view = E.id && E.v.permalink && E.v.status === 'publish' ? h('a', { class: 'btn ghost', href: E.v.permalink, target: '_blank', rel: 'noopener' }, icon('external', 18), 'مشاهده') : null;
  const del = E.id ? h('button', { type: 'button', class: 'iconbtn danger', 'aria-label': 'انتقال به زباله‌دان', onclick: remove }, icon('trash', 18)) : null;
  bar.replaceChildren(
    h('div', { class: 'bar-s' }, dirty ? h('span', { class: 'dot' }) : icon('check', 18), dirty ? 'تغییر ذخیره‌نشده' : 'ذخیره است'),
    h('div', { class: 'bar-a' }, del, view, h('button', { type: 'button', class: 'btn primary' + (E.busy ? ' busy' : ''), disabled: E.busy || (!dirty && !!E.id), onclick: saveCurrent }, E.busy ? 'در حال ذخیره…' : (E.id ? 'ذخیره' : 'ساخت محصول'))));
}

function payload(v) {
  const o = {
    name: v.name.trim(), status: v.status, short_description: v.short_description, description: v.description, sku: v.sku.trim(),
    categories: v.categories, image: v.image.id || 0, gallery: v.gallery.map((g) => g.id), manage_stock: v.manage_stock, alts: {},
  };
  if (v.slug.trim()) o.slug = v.slug.trim();
  if (v.edit_prices) { o.regular_price = v.regular_price; o.sale_price = v.sale_price; }
  if (v.manage_stock) o.stock_quantity = v.stock_quantity; else o.stock_status = v.stock_status;
  [v.image, ...v.gallery].filter((x) => x.id).forEach((x) => { o.alts[x.id] = x.alt || ''; });
  if (seoWritable()) o.seo = { title: v.seo.title, desc: v.seo.desc, kw: v.seo.kw, ...(P.meta.seo.noindex ? { noindex: !!v.seo.noindex } : {}) };
  return o;
}

export async function saveCurrent() {
  if (!E || E.busy) return;
  if (!E.v.name.trim()) { C.toast('نام محصول را وارد کنید.', 'bad'); return; }
  E.busy = true; updateBar();
  try {
    const route = E.id ? `/bazar/v1/products/${E.id}` : '/bazar/v1/products';
    const r = await C.call(route, { method: 'POST', body: payload(E.v) });
    const created = !E.id;
    E.id = r.id; E.v = fromServer(r); E.base = JSON.stringify(E.v);
    const i = P.items.findIndex((x) => x.id === r.id);
    if (i >= 0) P.items[i] = r; else { P.items.unshift(r); P.total += 1; }
    C.toast(created ? 'محصول ساخته شد' : 'تغییرات محصول ذخیره شد', 'ok');
    renderEdit();
  } catch (e) { C.toast(e.message, 'bad'); }
  finally { if (E) { E.busy = false; updateBar(); } }
}

async function remove() {
  if (!E || !E.id || !confirm('این محصول به زباله‌دان منتقل شود؟ (از پیشخوان وردپرس قابل بازیابی است)')) return;
  try {
    await C.call(`/bazar/v1/products/${E.id}`, { method: 'DELETE' });
    P.items = P.items.filter((x) => x.id !== E.id); P.total = Math.max(0, P.total - 1);
    E = null; C.toast('به زباله‌دان منتقل شد', 'ok'); renderList();
  } catch (e) { C.toast(e.message, 'bad'); }
}
