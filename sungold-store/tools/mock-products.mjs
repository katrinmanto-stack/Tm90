// شبیه‌ساز API محصولات (هم‌ارز theme/bazar/inc/products.php) برای سرور آزمایشی.
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const digits = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => AR.indexOf(d)).replace(/[٫]/g, '.').replace(/[٬,]/g, '');
const price = (v) => { const s = digits(v).trim(); if (s === '') return ''; return /^[0-9]{1,12}(\.[0-9]{1,4})?$/.test(s) ? s : false; };
const strip = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const kses = (s) => String(s ?? '').replace(/<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
const err = (code, message, status = 400) => ({ code: status, obj: { code, message, data: { status } } });

export function productsApi({ media, port }) {
  const svg = (c) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${c}"/><circle cx="200" cy="170" r="70" fill="#fff" opacity=".55"/><rect x="110" y="260" width="180" height="26" rx="13" fill="#fff" opacity=".55"/></svg>`);
  [[1, '#E9C46A'], [2, '#8AB4F8'], [3, '#F4A261'], [4, '#B5E48C']].forEach(([id, c]) => media.set(id, { type: 'image/svg+xml', buf: svg(c) }));
  const alts = new Map([[1, 'مانتو کتان سبک رنگ خردلی']]);
  const cats = [{ id: 11, name: 'لباس زنانه', parent: 0 }, { id: 12, name: 'مانتو', parent: 11 }, { id: 13, name: 'اکسسوری', parent: 0 }, { id: 14, name: 'گجت', parent: 0 }];
  const long = 'این مانتو از کتان سبک و خنک تهیه شده و برای روزهای گرم تابستان مناسب است. '.repeat(8);
  let nextId = 301;
  const mk = (o) => ({ type: 'simple', status: 'publish', sku: '', regular_price: '', sale_price: '', manage_stock: false, stock_quantity: null, stock_status: 'instock', image: 0, gallery: [], categories: [], description: '', short_description: '', slug: '', seo: { title: '', desc: '', kw: '', noindex: false }, ...o });
  const db = [
    mk({ id: 201, name: 'مانتو کتان سبک', slug: 'مانتو-کتان-سبک', regular_price: '890000', image: 1, categories: [12], description: long, short_description: 'مانتو کتان سبک و خنک مخصوص تابستان با دوخت تمیز.', seo: { title: 'مانتو کتان سبک تابستانی | Sungold store', desc: 'خرید آنلاین مانتو کتان سبک و خنک تابستانی با دوخت تمیز و رنگ‌بندی متنوع؛ مناسب محل کار و رفت‌وآمد روزمره.', kw: 'مانتو کتان', noindex: false } }),
    mk({ id: 202, name: 'شال نخی طرح‌دار', slug: 'شال-نخی', regular_price: '320000', sale_price: '256000', image: 2, categories: [13], short_description: 'شال نخی نرم.' }),
    mk({ id: 203, name: 'هندزفری بی‌سیم', slug: 'handsfree', regular_price: '1450000', image: 3, categories: [14], manage_stock: true, stock_quantity: 4, description: 'هندزفری بی‌سیم با شارژدهی طولانی.' }),
    mk({ id: 204, name: 'پاوربانک کوچک', slug: 'powerbank', regular_price: '960000', status: 'draft', stock_status: 'outofstock', categories: [14] }),
    mk({ id: 205, name: 'گردنبند آبکاری', slug: 'necklace', regular_price: '210000', image: 4, categories: [13], seo: { title: 'گردنبند', desc: '', kw: '', noindex: false } }),
    mk({ id: 206, name: 'ساعت هوشمند', slug: 'watch', regular_price: '2800000', categories: [14], type: 'variable' }),
  ];
  const find = (id) => db.find((p) => p.id === id);
  const img = (id) => ({ id, url: id ? `/media/${id}` : '', alt: alts.get(id) || '' });
  const present = (p, full) => {
    const o = {
      id: p.id, name: p.name, slug: p.slug, status: p.status, type: p.type, sku: p.sku, price: p.sale_price || p.regular_price, regular_price: p.regular_price, sale_price: p.sale_price,
      manage_stock: p.manage_stock, stock_quantity: p.stock_quantity, stock_status: p.stock_status, image: img(p.image), permalink: `http://localhost:${port}/product/${encodeURIComponent(p.slug)}/`,
      edit_prices: p.type === 'simple', categories: p.categories, seo: { ...p.seo }, seo_set: !!(p.seo.title && p.seo.desc),
    };
    if (full) Object.assign(o, { description: p.description, short_description: p.short_description, gallery: p.gallery.map(img), seo_driver: 'native' });
    return o;
  };

  function apply(p, inp) {
    if ('name' in inp) { const n = strip(inp.name).slice(0, 200); if (!n) return err('bazar_bad_request', 'نام محصول نمی‌تواند خالی باشد.'); p.name = n; }
    if ('slug' in inp && String(inp.slug).trim()) p.slug = String(inp.slug).trim().replace(/\s+/g, '-').toLowerCase();
    if (['publish', 'draft', 'pending', 'private'].includes(inp.status)) p.status = inp.status;
    if ('short_description' in inp) p.short_description = kses(inp.short_description);
    if ('description' in inp) p.description = kses(inp.description);
    if ('sku' in inp) {
      const sku = strip(inp.sku); if (sku && db.some((x) => x.sku === sku && x.id !== p.id)) return err('bazar_bad_request', 'این کد محصول (SKU) قبلاً استفاده شده است.');
      p.sku = sku;
    }
    if (p.type === 'simple') {
      if ('regular_price' in inp) { const v = price(inp.regular_price); if (v === false) return err('bazar_bad_request', 'قیمت اصلی معتبر نیست؛ فقط عدد وارد کنید.'); p.regular_price = v; }
      if ('sale_price' in inp) { const v = price(inp.sale_price); if (v === false) return err('bazar_bad_request', 'قیمت با تخفیف معتبر نیست؛ فقط عدد وارد کنید.'); p.sale_price = v; }
      if (p.sale_price !== '' && (p.regular_price === '' || +p.sale_price >= +p.regular_price)) return err('bazar_bad_request', 'قیمت با تخفیف باید کمتر از قیمت اصلی باشد.');
    }
    if ('manage_stock' in inp) p.manage_stock = !!inp.manage_stock;
    if (p.manage_stock) { if ('stock_quantity' in inp) p.stock_quantity = parseInt(digits(inp.stock_quantity), 10) || 0; }
    else if (['instock', 'outofstock', 'onbackorder'].includes(inp.stock_status)) p.stock_status = inp.stock_status;
    if (Array.isArray(inp.categories)) p.categories = [...new Set(inp.categories.map(Number).filter((c) => cats.some((x) => x.id === c)))];
    const att = (v) => { const id = +((v && v.id !== undefined) ? v.id : v) || 0; return media.has(id) ? id : 0; };
    if ('image' in inp) p.image = att(inp.image);
    if (Array.isArray(inp.gallery)) p.gallery = [...new Set(inp.gallery.slice(0, 12).map(att).filter(Boolean))];
    if (inp.seo && typeof inp.seo === 'object') {
      for (const [k, max] of [['title', 120], ['desc', 320], ['kw', 80]]) if (k in inp.seo) p.seo[k] = strip(inp.seo[k]).slice(0, max);
      if ('noindex' in inp.seo) p.seo.noindex = !!inp.seo.noindex;
    }
    if (inp.alts && typeof inp.alts === 'object') for (const [id, alt] of Object.entries(inp.alts)) if (media.has(+id)) alts.set(+id, strip(alt).slice(0, 125));
    return null;
  }

  return (route, method, inp, q) => {
    if (route === '/bazar/v1/products/meta') return { code: 200, obj: { categories: cats, seo: { driver: 'native', label: 'سئوی داخلی قالب', writable: true, noindex: true }, currency: 'تومان', site: { name: 'Sungold store', url: `http://localhost:${port}/` } } };
    if (route === '/bazar/v1/products' && method === 'GET') {
      let list = [...db].reverse();
      const st = q.get('status'); if (st === 'publish' || st === 'draft') list = list.filter((p) => p.status === st);
      const s = (q.get('search') || '').trim(); if (s) list = list.filter((p) => p.name.includes(s));
      const cat = +q.get('category') || 0; if (cat) list = list.filter((p) => p.categories.includes(cat));
      const page = Math.max(1, +q.get('page') || 1), per = +process.env.MOCK_PER_PAGE || 20;
      return { code: 200, obj: { items: list.slice((page - 1) * per, page * per).map((p) => present(p)), total: list.length, pages: Math.ceil(list.length / per), page } };
    }
    if (route === '/bazar/v1/products' && method === 'POST') {
      if (!strip(inp.name)) return err('bazar_bad_request', 'نام محصول الزامی است.');
      const p = mk({ id: nextId++, status: 'draft', name: '' }); const e = apply(p, inp); if (e) return e;
      if (!p.slug) p.slug = p.name.replace(/\s+/g, '-'); db.push(p); return { code: 200, obj: present(p, true) };
    }
    const m = /^\/bazar\/v1\/products\/(\d+)$/.exec(route);
    if (m) {
      const p = find(+m[1]); if (!p) return err('bazar_not_found', 'محصول پیدا نشد.', 404);
      if (method === 'GET') return { code: 200, obj: present(p, true) };
      if (method === 'DELETE') { db.splice(db.indexOf(p), 1); return { code: 200, obj: { deleted: true, id: p.id } }; }
      const draft = JSON.parse(JSON.stringify(p)); const e = apply(draft, inp); if (e) return e;
      Object.assign(p, draft); return { code: 200, obj: present(p, true) };
    }
    return null;
  };
}
