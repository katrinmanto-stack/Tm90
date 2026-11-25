/* ویرایش محصول متغیر (چندرنگ/چندسایز): ویژگی‌ها و تنوع‌ها. به products.js وصل می‌شود؛ بک‌اند: theme/bazar/inc/variable.php (قالب ۴٫۱۹+). */
import { h } from './dom.js';
import { icon } from './icons.js';

const nf = new Intl.NumberFormat('fa-IR');
const num = (n) => nf.format(+n || 0);

export const newAttr = (name = '') => ({ key: '', name, taxonomy: false, variation: true, options: [], _new: true });
export const emptyImg = () => ({ id: 0, url: '', alt: '' });

/** داده‌ی سرور ← حالت محلی */
export function varFromServer(p) {
  return {
    attributes: (p.attributes || []).map((a) => ({ ...a, options: (a.options || []).map((o) => ({ ...o })) })),
    variations: (p.variations || []).map((x) => ({ ...x, attrs: { ...(x.attrs || {}) }, image: x.image && x.image.id ? x.image : emptyImg() })),
    base_price: '', base_sale: '', base_stock: '', gen: false,
  };
}

const live = (v) => v.attributes.filter((a) => a.variation && !a._remove);
const attrKeyOf = (v, a) => a.key || '#' + v.attributes.indexOf(a);
const labelOf = (a, val) => { if (val === '' || val == null) return 'هر ' + a.name; const o = a.options.find((x) => x.value === val); return o ? o.label : val; };
const usedBy = (v, a, val) => !!a.key && v.variations.some((x) => !x._del && x.attrs[a.key] === val);

/** شمار ترکیب‌های ساخته‌نشده (تقریبی: حاصل‌ضرب شمار گزینه‌ها منهای تنوع‌های فعلی) */
export function missingCombos(v) {
  const as = live(v); if (!as.length || as.some((a) => !a.options.length)) return 0;
  const total = as.reduce((n, a) => n * a.options.length, 1);
  return Math.max(0, total - v.variations.filter((x) => !x._del).length);
}

/** بررسی پیش از ذخیره؛ رشته‌ی خطا یا '' */
export function checkVariable(v) {
  for (const a of v.attributes) {
    if (a._remove) continue;
    if (a._new && !a.name.trim()) return 'برای ویژگی تازه نام (مثلاً «رنگ») بنویسید یا آن را حذف کنید.';
    if (!a.taxonomy && !a.options.length) return `ویژگی «${a.name || 'تازه'}» حداقل یک گزینه لازم دارد.`;
  }
  for (const x of v.variations) {
    if (x._del) continue;
    const r = Number(String(x.regular_price).replace(/[^\d.]/g, '')), s = Number(String(x.sale_price).replace(/[^\d.]/g, ''));
    if (String(x.sale_price).trim() !== '' && (!r || s >= r)) return 'قیمت با تخفیف هر گزینه باید کمتر از قیمت اصلی همان گزینه باشد.';
  }
  if (v.gen && v.variations.filter((x) => !x._del).length + missingCombos(v) > 100) return 'حداکثر ۱۰۰ تنوع برای یک محصول مجاز است؛ گزینه‌ها را کمتر کنید.';
  return '';
}

/** بخش متغیر payload */
export function variablePayload(v) {
  const o = { type: 'variable' };
  o.attributes = v.attributes.filter((a) => !a.taxonomy && !(a._new && a._remove)).map((a) => (a._remove
    ? { key: a.key, remove: true }
    : { ...(a.key ? { key: a.key } : {}), name: a.name.trim(), options: a.options.map((x) => x.value) }));
  o.variations = v.variations.map((x) => {
    if (x._del) return { id: x.id, delete: true };
    const r = { id: x.id, regular_price: x.regular_price, sale_price: x.sale_price, sku: (x.sku || '').trim(), enabled: !!x.enabled, image: x.image.id || 0 };
    if (!x.parent_stock) { r.manage_stock = !!x.manage_stock; if (x.manage_stock) r.stock_quantity = x.stock_quantity; else r.stock_status = x.stock_status; }
    return r;
  });
  if (v.gen) {
    o.generate = true;
    o.defaults = { regular_price: v.base_price, sale_price: v.base_sale, ...(String(v.base_stock).trim() !== '' ? { stock_quantity: v.base_stock } : {}) };
  }
  return o;
}

/**
 * کارت «گزینه‌ها». K = { v, touch, fld, inp, toggleRow, pick, save, currency, isNew }
 *   v: E.v ، pick(btn, then) آپلود تصویر ← فیلد فایل ، save(): ذخیره‌ی فوری
 */
export function variationsCard(K) {
  const v = K.v;
  if (!v.attributes.some((a) => a.variation && !a._remove) && !v.variations.length) v.attributes.push(newAttr('رنگ'));
  const box = h('section', { class: 'card vcard' }, h('h2', {}, 'گزینه‌ها (رنگ، سایز، …)'));
  const body = h('div', {});
  box.append(body);

  const chip = (a, o) => {
    const used = usedBy(v, a, o.value);
    const x = !a.taxonomy ? h('button', { type: 'button', class: 'x', 'aria-label': 'حذف گزینه‌ی ' + o.label, title: used ? 'در تنوع‌ها استفاده شده؛ اول آن تنوع را حذف کنید' : 'حذف گزینه', disabled: used,
      onclick: () => { a.options = a.options.filter((q) => q !== o); K.touch(); draw(); } }, '×') : null;
    return h('span', { class: 'vopt' + (used ? ' used' : '') }, o.label, x);
  };

  const attrBlock = (a) => {
    const adder = h('input', { class: 'in', type: 'text', placeholder: 'گزینه‌ی تازه (چند تا را با ویرگول جدا کنید)', 'aria-label': 'گزینه‌ی تازه برای ' + (a.name || 'ویژگی'), maxlength: 120, autocomplete: 'off' });
    const add = () => {
      const parts = adder.value.split(/[,،\n]/).map((s) => s.trim().replace(/\|/g, '/').slice(0, 40)).filter(Boolean);
      let n = 0; for (const p of parts) if (!a.options.some((o) => o.value === p) && a.options.length < 30) { a.options.push({ value: p, label: p }); n++; }
      adder.value = ''; if (n) { K.touch(); draw(); }
    };
    adder.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    const nameEl = a._new
      ? h('input', { class: 'in vname', type: 'text', maxlength: 40, placeholder: 'نام ویژگی، مثل رنگ یا سایز', 'aria-label': 'نام ویژگی', value: a.name, oninput: (e) => { a.name = e.target.value; K.touch(); } })
      : h('b', { class: 'vname' }, a.name);
    return h('div', { class: 'vattr', 'data-attr': a.key || 'new' },
      h('div', { class: 'vattr-h' }, nameEl,
        a.taxonomy ? h('span', { class: 'tag' }, 'ویژگی عمومی') : h('button', { type: 'button', class: 'iconbtn danger', 'aria-label': 'حذف ویژگی', onclick: () => { if (a._new) v.attributes.splice(v.attributes.indexOf(a), 1); else a._remove = true; K.touch(); draw(); } }, icon('trash', 18))),
      h('div', { class: 'vopts' }, a.options.map((o) => chip(a, o)), !a.options.length ? h('small', { class: 'help' }, 'هنوز گزینه‌ای نیست.') : null),
      a.taxonomy
        ? h('p', { class: 'help' }, 'گزینه‌های این ویژگی در پیشخوان وردپرس (محصولات ← ویژگی‌ها) اضافه می‌شود.')
        : h('div', { class: 'vadd' }, adder, h('button', { type: 'button', class: 'btn sm', onclick: add }, icon('plus', 18), 'افزودن')));
  };

  const baseBlock = () => {
    const miss = missingCombos(v);
    if (!miss && !v.gen) return null;
    const cur = K.currency ? ' (' + K.currency + ')' : '';
    return h('div', { class: 'vbase', 'data-vbase': '1' },
      h('p', { class: 'help' }, v.variations.length
        ? `${num(miss)} ترکیب تازه ساخته می‌شود. قیمت و موجودی پایه‌ی آن‌ها:`
        : `بعد از ذخیره، همه‌ی ترکیب‌های رنگ/سایز (${num(miss)} مورد) با این قیمت ساخته می‌شود؛ بعد برای هر کدام جدا ویرایش کنید:`),
      h('div', { class: 'two' }, K.fld('قیمت پایه' + cur, K.inp(() => v.base_price, (x) => { v.base_price = x; K.touch(); }, { ltr: true, mode: 'decimal', label: 'قیمت پایه' })), K.fld('قیمت با تخفیف', K.inp(() => v.base_sale, (x) => { v.base_sale = x; K.touch(); }, { ltr: true, mode: 'decimal', label: 'قیمت پایه با تخفیف' }))),
      K.fld('تعداد موجودی هر ترکیب (اختیاری)', K.inp(() => v.base_stock, (x) => { v.base_stock = x; K.touch(); }, { ltr: true, mode: 'numeric', label: 'تعداد موجودی پایه' }), 'خالی = بدون مدیریت تعداد (موجود).'),
      v.variations.length && !K.isNew ? h('button', { type: 'button', class: 'btn primary', 'data-act': 'gen', onclick: () => { v.gen = true; K.save(); } }, icon('plus', 18), `ساخت ${num(miss)} ترکیب تازه`) : null);
  };

  const rowOf = (x) => {
    const as = live(v).filter((a) => a.key);
    const label = as.map((a) => labelOf(a, x.attrs[a.key])).join(' / ') || 'ترکیب ' + num(x.id);
    const dis = !x.enabled;
    const pickBtn = h('button', { type: 'button', class: 'vthumb', 'aria-label': 'تصویر این گزینه' }, x.image.url ? h('img', { src: x.image.url, alt: '' }) : icon('image', 20));
    const file = K.pick(pickBtn, (r) => { x.image = { id: r.id, url: r.url, alt: '' }; K.touch(); draw(); });
    const stock = x.parent_stock
      ? h('p', { class: 'help' }, 'موجودی این گزینه از خود محصول مدیریت می‌شود.')
      : h('div', {},
        K.toggleRow('مدیریت تعداد', null, () => x.manage_stock, (on) => { x.manage_stock = on; K.touch(); draw(); }),
        x.manage_stock
          ? K.fld('تعداد موجودی', K.inp(() => String(x.stock_quantity ?? 0), (s) => { x.stock_quantity = s; K.touch(); }, { ltr: true, mode: 'numeric', label: 'تعداد موجودی ' + label }))
          : h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'وضعیت موجودی ' + label }, [['instock', 'موجود'], ['outofstock', 'ناموجود'], ['onbackorder', 'پیش‌سفارش']].map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(x.stock_status === k), class: x.stock_status === k ? 'on' : '', onclick: () => { x.stock_status = k; K.touch(); draw(); } }, l))));
    return h('div', { class: 'vrow' + (dis ? ' off' : ''), 'data-var': x.id },
      h('div', { class: 'vrow-h' }, pickBtn, h('div', { class: 'vlabel' }, h('b', {}, label), dis ? h('small', { class: 'help' }, 'غیرفعال (در سایت دیده نمی‌شود)') : null),
        h('label', { class: 'switch', title: 'نمایش در سایت' }, h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'فعال: ' + label, checked: x.enabled, onchange: (e) => { x.enabled = e.target.checked; K.touch(); draw(); } }), h('span', { class: 'sw' })),
        h('button', { type: 'button', class: 'iconbtn danger', 'aria-label': 'حذف ' + label, 'data-act': 'vdel', onclick: () => { if (confirm(`گزینه‌ی «${label}» حذف شود؟ بعد از ذخیره از سایت پاک می‌شود.`)) { x._del = true; K.touch(); draw(); } } }, icon('trash', 18)), file),
      h('div', { class: 'two' },
        K.fld('قیمت', K.inp(() => x.regular_price, (s) => { x.regular_price = s; K.touch(); }, { ltr: true, mode: 'decimal', label: 'قیمت ' + label })),
        K.fld('قیمت با تخفیف', K.inp(() => x.sale_price, (s) => { x.sale_price = s; K.touch(); }, { ltr: true, mode: 'decimal', label: 'قیمت با تخفیف ' + label }))),
      stock,
      K.fld('کد (SKU)', K.inp(() => x.sku, (s) => { x.sku = s; K.touch(); }, { ltr: true, max: 60, label: 'SKU ' + label })));
  };

  const draw = () => {
    const rows = v.variations.filter((x) => !x._del);
    const noPrice = rows.filter((x) => x.enabled && !String(x.regular_price).trim()).length;
    body.replaceChildren(...[
      ...v.attributes.filter((a) => a.variation && !a._remove).map(attrBlock),
      live(v).length < 4 ? h('button', { type: 'button', class: 'btn ghost sm', 'data-act': 'add-attr', onclick: () => { v.attributes.push(newAttr('')); K.touch(); draw(); } }, icon('plus', 18), 'ویژگی دیگر (مثلاً سایز)') : null,
      baseBlock(),
      rows.length ? h('h3', { class: 'sub-h' }, `تنوع‌ها (${num(rows.length)})`) : null,
      noPrice ? h('div', { class: 'msg warn' }, `${num(noPrice)} گزینه‌ی فعال قیمت ندارد و در سایت قابل خرید نیست.`) : null,
      ...rows.map(rowOf),
    ].filter(Boolean));
  };
  draw();
  return box;
}
