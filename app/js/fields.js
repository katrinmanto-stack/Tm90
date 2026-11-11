import { h } from './dom.js';
import { icon } from './icons.js';
import { hex6, contrast, derive } from './color.js';

const LTR = ['url', 'link', 'phone', 'email'];

/* ---------- ورودی‌های ساده ---------- */
function textInput(f, v, set) {
  const multi = f.type === 'textarea';
  const el = h(multi ? 'textarea' : 'input', {
    class: 'in' + (LTR.includes(f.type) ? ' ltr' : ''),
    type: multi ? null : 'text',
    inputmode: f.type === 'phone' ? 'tel' : (f.type === 'email' ? 'email' : (f.type === 'url' || f.type === 'link' ? 'url' : null)),
    maxlength: f.max || null, rows: multi ? 3 : null, dir: LTR.includes(f.type) ? 'ltr' : null,
    autocomplete: 'off', spellcheck: 'false', 'aria-label': f.label,
  });
  el.value = v == null ? '' : String(v);
  el.addEventListener('input', () => set(el.value));
  return el;
}

function toggle(f, v, set) {
  const i = h('input', { type: 'checkbox', role: 'switch', 'aria-label': f.label });
  i.checked = !!v;
  i.addEventListener('change', () => set(i.checked));
  return h('label', { class: 'switch' }, i, h('span', { class: 'sw' }));
}

function select(f, v, set) {
  const opts = f.options || [];
  if (opts.length <= 3) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': f.label });
    const draw = (cur) => wrap.replaceChildren(...opts.map(([val, label]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(String(cur) === String(val)), class: String(cur) === String(val) ? 'on' : '',
        onclick: () => { set(val); draw(val); } }, label)));
    draw(v);
    return wrap;
  }
  const el = h('select', { class: 'in', 'aria-label': f.label }, opts.map(([val, label]) => h('option', { value: val }, label)));
  el.value = String(v);
  el.addEventListener('change', () => set(el.value));
  return el;
}

function number(f, v, set) {
  const min = f.min ?? 0, max = f.max ?? 100, step = f.step || 1;
  let cur = Number.isFinite(+v) ? +v : min;
  const out = h('output', { class: 'num' }, String(cur));
  const dec = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'کم‌تر' }, icon('minus', 18));
  const inc = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'بیش‌تر' }, icon('plus', 18));
  const sync = () => { out.textContent = String(cur); dec.disabled = cur <= min; inc.disabled = cur >= max; };
  const bump = (d) => { cur = Math.max(min, Math.min(max, cur + d * step)); sync(); set(cur); };
  dec.onclick = () => bump(-1); inc.onclick = () => bump(1);
  sync();
  return h('div', { class: 'stepper' }, dec, out, inc);
}

/* ---------- رنگ ---------- */
function colorHint(key, val) {
  const c = hex6(val); if (!c) return '';
  if (key === 'color_brand') { const r = contrast(c, '#ffffff'); return r >= 4.5 ? `متن سفید روی این رنگ خوانا است (${r.toFixed(1)}:1)` : 'کمی تیره‌تر می‌شود تا متن سفید خوانا بماند'; }
  if (key === 'color_ink') return contrast(c, '#ffffff') >= 10 ? 'مناسب متن و فوتر' : 'کمی تیره‌تر می‌شود';
  if (key === 'color_sale') return contrast(c, '#ffffff') >= 4.5 ? 'متن سفید روی نشان تخفیف خوانا است' : 'کمی تیره‌تر می‌شود';
  if (key === 'color_accent') return 'متن روی این رنگ خودکار سفید یا تیره انتخاب می‌شود';
  return '';
}

function color(f, v, set) {
  const cur = hex6(v) || '#000000';
  const pick = h('input', { type: 'color', class: 'swatch', 'aria-label': f.label });
  pick.value = cur;
  const txt = h('input', { class: 'in ltr hex', type: 'text', dir: 'ltr', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': f.label + ' (کد رنگ)' });
  txt.value = cur;
  const hint = h('div', { class: 'hint' }, colorHint(f.key, cur));
  const apply = (val) => { const c = hex6(val); if (!c) return false; pick.value = c; hint.textContent = colorHint(f.key, c); set(c); return true; };
  pick.addEventListener('input', () => { txt.value = pick.value; apply(pick.value); });
  txt.addEventListener('input', () => { if (hex6(txt.value) && txt.value.replace('#', '').length >= 3) apply(txt.value); });
  txt.addEventListener('blur', () => { txt.value = hex6(txt.value) || pick.value; });
  return h('div', { class: 'colorf' }, h('div', { class: 'colorf-r' }, pick, txt), hint);
}

/* ---------- تصویر ---------- */
function image(f, v, set, ctx) {
  let cur = v && v.id ? v : { id: 0, url: '' };
  const thumb = h('div', { class: 'thumb' });
  const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
  const pick = h('button', { type: 'button', class: 'btn sm' }, icon('image', 18), 'انتخاب تصویر');
  const del = h('button', { type: 'button', class: 'btn sm ghost' }, icon('trash', 18), 'حذف');
  const draw = () => { thumb.replaceChildren(cur.url ? h('img', { src: cur.url, alt: '' }) : icon('image', 28)); del.hidden = !cur.id; };
  pick.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    pick.disabled = true; pick.classList.add('busy');
    try { cur = await ctx.upload(file); set(cur); draw(); }
    catch (e) { ctx.toast(e.message, 'bad'); }
    finally { pick.disabled = false; pick.classList.remove('busy'); input.value = ''; }
  };
  del.onclick = () => { cur = { id: 0, url: '' }; set(cur); draw(); };
  draw();
  return h('div', { class: 'imgf' }, thumb, h('div', { class: 'imgf-b' }, pick, del), input);
}

/* ---------- لیست مزایا ---------- */
function benefits(f, v, set) {
  let list = Array.isArray(v) ? v.map((x) => ({ ...x })) : [];
  const box = h('div', { class: 'list' });
  const add = h('button', { type: 'button', class: 'btn sm ghost' }, icon('plus', 18), 'افزودن مورد');
  const draw = () => {
    box.replaceChildren(...list.map((row, i) => h('div', { class: 'li' },
      h('div', { class: 'li-f' },
        h('input', { class: 'in', value: row.title, maxlength: 40, placeholder: 'عنوان', 'aria-label': 'عنوان', oninput: (e) => { row.title = e.target.value; set(list.map((x) => ({ ...x }))); } }),
        h('input', { class: 'in', value: row.text, maxlength: 80, placeholder: 'توضیح کوتاه', 'aria-label': 'توضیح', oninput: (e) => { row.text = e.target.value; set(list.map((x) => ({ ...x }))); } })),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'حذف', disabled: list.length <= 1, onclick: () => { list.splice(i, 1); set(list.map((x) => ({ ...x }))); draw(); } }, icon('trash', 18)))));
    add.disabled = list.length >= 4;
  };
  add.onclick = () => { list.push({ title: '', text: '' }); draw(); };
  draw();
  return h('div', {}, box, add);
}

/* ---------- ترتیب و نمایش بخش‌های صفحه ---------- */
function sections(f, v, set) {
  const names = Object.fromEntries((f.options || []).map(([id, label]) => [id, label]));
  let list = (Array.isArray(v) ? v : []).map((x) => ({ ...x }));
  const box = h('div', { class: 'list' });
  const emit = () => set(list.map((x) => ({ ...x })));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; emit(); draw(); };
  const draw = () => box.replaceChildren(...list.map((row, i) => {
    const sw = h('input', { type: 'checkbox', role: 'switch', 'aria-label': names[row.id] });
    sw.checked = !!row.on;
    sw.addEventListener('change', () => { row.on = sw.checked; emit(); li.classList.toggle('off', !row.on); });
    const li = h('div', { class: 'li sec' + (row.on ? '' : ' off') },
      h('span', { class: 'li-n' }, names[row.id] || row.id),
      h('div', { class: 'li-a' },
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'بالا', disabled: i === 0, onclick: () => move(i, -1) }, icon('up', 18)),
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'پایین', disabled: i === list.length - 1, onclick: () => move(i, 1) }, icon('down', 18)),
        h('label', { class: 'switch' }, sw, h('span', { class: 'sw' }))));
    return li;
  }));
  draw();
  return box;
}

/* ---------- بنرهای اسلایدر (افزودن، حذف، ترتیب، تصویر، لینک) ---------- */
function banners(f, v, set, ctx) {
  const MAX = f.max || 8;
  let list = (Array.isArray(v) ? v : []).map((b) => ({ img: b.img && b.img.id ? { ...b.img } : { id: 0, url: '' }, link: b.link || '', alt: b.alt || '', on: b.on !== false }));
  const box = h('div', { class: 'list bnrs' });
  const add = h('button', { type: 'button', class: 'btn sm' }, icon('plus', 18), 'افزودن بنر');
  const emit = () => set(list.map((b) => ({ ...b, img: { ...b.img } })));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; emit(); draw(); };
  const draw = () => {
    box.replaceChildren(...list.map((row, i) => {
      const sw = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'نمایش بنر ' + (i + 1) });
      sw.checked = row.on;
      const card = h('div', { class: 'bnr' + (row.on ? '' : ' off') });
      sw.addEventListener('change', () => { row.on = sw.checked; card.classList.toggle('off', !row.on); emit(); });
      card.append(
        h('div', { class: 'bnr-h' },
          h('b', {}, 'بنر ' + (i + 1)),
          h('div', { class: 'li-a' },
            h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'بالا', disabled: i === 0, onclick: () => move(i, -1) }, icon('up', 18)),
            h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'پایین', disabled: i === list.length - 1, onclick: () => move(i, 1) }, icon('down', 18)),
            h('label', { class: 'switch' }, sw, h('span', { class: 'sw' })),
            h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'حذف بنر', onclick: () => { list.splice(i, 1); emit(); draw(); } }, icon('trash', 18)))),
        image({ label: 'تصویر بنر ' + (i + 1) }, row.img, (img) => { row.img = img; emit(); }, ctx),
        h('input', { class: 'in ltr', dir: 'ltr', type: 'text', inputmode: 'url', placeholder: 'https://… or /shop/', value: row.link, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'لینک بنر ' + (i + 1), oninput: (e) => { row.link = e.target.value; emit(); } }),
        h('input', { class: 'in', type: 'text', placeholder: 'متن جایگزین تصویر (اختیاری، برای سئو و دسترسی‌پذیری)', value: row.alt, maxlength: 100, autocomplete: 'off', 'aria-label': 'متن جایگزین بنر ' + (i + 1), oninput: (e) => { row.alt = e.target.value; emit(); } }));
      return card;
    }));
    if (!list.length) box.append(h('p', { class: 'help' }, 'هنوز بنری نیست؛ هیروی متنی نمایش داده می‌شود.'));
    add.disabled = list.length >= MAX;
  };
  add.onclick = () => { list.push({ img: { id: 0, url: '' }, link: '', alt: '', on: true }); emit(); draw(); };
  draw();
  return h('div', {}, box, add);
}

/* ---------- منوی اصلی و همبرگری ---------- */
function menu(f, v, set, ctx) {
  const MAX = f.max || 10;
  let list = (Array.isArray(v) ? v : []).map((m) => ({ title: m.title || '', url: m.url || '', on: m.on !== false }));
  const box = h('div', { class: 'list bnrs' });
  const add = h('button', { type: 'button', class: 'btn sm' }, icon('plus', 18), 'افزودن آیتم');
  const sug = h('button', { type: 'button', class: 'btn sm' }, icon('plus', 18), 'افزودن آیتم‌های پیشنهادی');
  const emit = () => set(list.map((m) => ({ ...m })));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; emit(); draw(); };
  const draw = () => {
    box.replaceChildren(...list.map((row, i) => {
      const sw = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'نمایش آیتم ' + (i + 1) });
      sw.checked = row.on;
      const card = h('div', { class: 'bnr mn' + (row.on ? '' : ' off') });
      sw.addEventListener('change', () => { row.on = sw.checked; card.classList.toggle('off', !row.on); emit(); });
      card.append(
        h('div', { class: 'bnr-h' },
          h('b', {}, 'آیتم ' + (i + 1)),
          h('div', { class: 'li-a' },
            h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'بالا', disabled: i === 0, onclick: () => move(i, -1) }, icon('up', 18)),
            h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'پایین', disabled: i === list.length - 1, onclick: () => move(i, 1) }, icon('down', 18)),
            h('label', { class: 'switch' }, sw, h('span', { class: 'sw' })),
            h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'حذف آیتم', onclick: () => { list.splice(i, 1); emit(); draw(); } }, icon('trash', 18)))),
        h('input', { class: 'in', type: 'text', placeholder: 'عنوان (مثلاً درباره ما)', value: row.title, maxlength: 40, autocomplete: 'off', 'aria-label': 'عنوان آیتم ' + (i + 1), oninput: (e) => { row.title = e.target.value; emit(); } }),
        h('input', { class: 'in ltr', dir: 'ltr', type: 'text', inputmode: 'url', placeholder: 'https://… or /about/', value: row.url, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'لینک آیتم ' + (i + 1), oninput: (e) => { row.url = e.target.value; emit(); } }));
      return card;
    }));
    if (!list.length) box.append(h('p', { class: 'help' }, 'آیتمی تعریف نشده؛ منوی وردپرس (یا منوی پیش‌فرض) استفاده می‌شود.'));
    add.disabled = list.length >= MAX;
  };
  add.onclick = () => { list.push({ title: '', url: '', on: true }); emit(); draw(); };
  const defs = (ctx && ctx.navDefaults && ctx.navDefaults()) || [];
  sug.onclick = () => {
    let missing = false;
    for (const d of defs) {
      if (list.length >= MAX) break;
      if (list.some((x) => x.url === d.url)) continue;
      list.push({ title: d.title, url: d.url, on: true });
      if (d.missing) missing = true;
    }
    emit(); draw();
    if (missing) ctx.toast('صفحه‌ی «درباره ما» هنوز در وردپرس ساخته نشده؛ یک برگه با نشانی about بسازید.', 'warn');
  };
  draw();
  return h('div', { class: 'row-actions' }, box, h('div', { class: 'btnrow' }, add, defs.length ? sug : ''));
}

const RENDERERS = { toggle, select, number, color, image, benefits, sections, banners, menu };

export function renderField(f, value, onChange, ctx) {
  const control = (RENDERERS[f.type] || textInput)(f, value, onChange, ctx);
  const inline = f.type === 'toggle';
  const label = h('label', { class: 'lbl' }, f.label);
  const help = f.help ? h('div', { class: 'help' }, f.help) : null;
  const block = h('div', { class: 'field' + (inline ? ' inline' : ''), 'data-key': f.key },
    inline ? h('div', { class: 'field-t' }, label, help) : [label, control, help],
    inline ? control : null);
  return block;
}

/* ---------- پالت‌های آماده + نوار پالت نهایی ---------- */
export function presetsBlock(presets, getColors, apply) {
  const box = h('div', { class: 'presets' });
  const draw = () => {
    const cur = getColors();
    box.replaceChildren(...presets.map((p) => {
      const on = Object.keys(p.colors).every((k) => hex6(cur[k]) === p.colors[k]);
      return h('button', { type: 'button', class: 'preset' + (on ? ' on' : ''), onclick: () => apply(p.colors), 'aria-pressed': String(on) },
        h('span', { class: 'dots' }, ['color_brand', 'color_accent', 'color_ink'].map((k) => h('i', { style: { background: p.colors[k] } }))),
        h('span', {}, p.label));
    }));
  };
  draw();
  return { el: box, redraw: draw };
}

export function paletteStrip(colors) {
  const pal = derive({ brand: hex6(colors.color_brand) || '#232c6e', accent: hex6(colors.color_accent) || '#f6b93b', ink: hex6(colors.color_ink) || '#101535', sale: hex6(colors.color_sale) || '#d63f2e' });
  const keys = [['brand', 'اصلی'], ['brand-d', 'اصلی تیره'], ['brand-l', 'اصلی روشن'], ['accent', 'تأکید'], ['ink', 'متن'], ['bg', 'پس‌زمینه'], ['soft', 'ملایم'], ['sale', 'تخفیف']];
  return h('div', { class: 'strip', role: 'img', 'aria-label': 'پالت نهایی' },
    keys.map(([k, n]) => h('div', { class: 'strip-i' }, h('i', { style: { background: pal[k] }, title: pal[k] }), h('span', {}, n))));
}
