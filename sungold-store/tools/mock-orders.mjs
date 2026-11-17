// شبیه‌ساز API سفارش‌ها (هم‌ارز theme/bazar/inc/orders.php) برای سرور آزمایشی.
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const digits = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => AR.indexOf(d));
const err = (code, message, status = 400, extra = {}) => ({ code: status, obj: { code, message, data: { status, ...extra } } });
const STATUSES = [['bazar-request', 'درخواست خرید'], ['pending', 'Pending payment'], ['processing', 'Processing'], ['on-hold', 'On hold'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['refunded', 'Refunded'], ['failed', 'Failed']];
const LABEL = Object.fromEntries(STATUSES);
const slug = (s) => String(s ?? '').toLowerCase().replace(/^wc-/, '').replace(/[^a-z0-9_-]/g, '');

export function ordersApi({ now = () => Date.now() } = {}) {
  const day = 86400;
  const t0 = Math.floor(now() / 1000);
  const mk = (o) => ({ status: 'processing', paid: true, items: [], fees: [], discount: '0', shipping: '0', tax: '0', refunded: '0', phone: '', email: '', note: '', tracking: '', notes: [], pay: 'درگاه زرین‌پال', trx: '', shipm: ['پست پیشتاز'], postcode: '', ...o });
  const it = (id, name, qty, price, extra = {}) => ({ id, name, qty, subtotal: String(price * qty), total: String(price * qty), sku: '', product_id: 200 + id, image: '', meta: [], ...extra });
  const db = [
    mk({ id: 1001, ts: t0 - 2 * 3600, customer: 'مریم احمدی', phone: '۰۹۱۲۳۴۵۶۷۸۹', email: 'maryam@example.com', status: 'processing', shipping: '60000', addr: 'تهران، خیابان ولیعصر، کوچه‌ی ۵، پلاک ۱۲، واحد ۳', postcode: '1234567890', note: 'لطفاً تا ساعت ۱۸ ارسال شود.', trx: 'ZP-88123',
      items: [it(1, 'مانتو کتان سبک', 1, 890000, { sku: 'MN-01', meta: [{ key: 'سایز', value: 'M' }, { key: 'رنگ', value: 'خردلی' }] }), it(2, 'شال نخی طرح‌دار', 2, 256000)],
      notes: [{ id: 1, content: 'سفارش ثبت شد و پرداخت تأیید شد.', customer: false, by: 'system', ts: t0 - 2 * 3600 }] }),
    mk({ id: 1002, ts: t0 - 5 * 3600, customer: 'علی رضایی', phone: '09351112233', status: 'on-hold', paid: false, addr: 'اصفهان، چهارباغ بالا', items: [it(3, 'هندزفری بی‌سیم', 1, 1450000)], pay: 'کارت به کارت' }),
    mk({ id: 1003, ts: t0 - 1 * day, customer: 'سارا محمدی', status: 'completed', tracking: '2400123456789', addr: 'شیراز، بلوار چمران', phone: '09177778888', items: [it(4, 'گردنبند آبکاری', 3, 210000)], discount: '30000' }),
    mk({ id: 1004, ts: t0 - 3 * day, customer: 'مهمان', status: 'pending', paid: false, items: [it(5, 'پاوربانک کوچک', 1, 960000)] }),
    mk({ id: 1005, ts: t0 - 9 * day, customer: 'نیلوفر کریمی', status: 'cancelled', paid: false, items: [it(6, 'ساعت هوشمند', 1, 2800000)] }),
    mk({ id: 1006, ts: t0 - 20 * day, customer: 'حسین قاسمی', status: 'completed', phone: '09121230000', addr: 'مشهد، احمدآباد', items: [it(7, 'مانتو کتان سبک', 2, 890000)] }),
    mk({ id: 1007, ts: t0 - 45 * day, customer: 'زهرا نوری', status: 'completed', items: [it(8, 'شال نخی طرح‌دار', 1, 256000)] }),
  ];
  const find = (id) => db.find((o) => o.id === id);
  // هم‌ارز bazar_req_stock در inc/requests.php
  const stockRows = (o) => o.items.map((i) => { const managed = i.avail != null; const ok = managed ? i.qty <= i.avail : true; return { item_id: i.id, name: i.name, qty: i.qty, managed, available: managed ? i.avail : null, ok, reason: ok ? '' : 'موجودی کافی نیست' }; });
  const reqBlock = (o) => {
    if (o.status === 'bazar-request') { const rows = stockRows(o); return { state: 'awaiting', stock: rows, all_ok: rows.every((r) => r.ok), hours: 24, expires: 0 }; }
    if (o.status === 'pending' && o.expires) return { state: 'approved', stock: [], all_ok: true, hours: 24, expires: o.expires };
    return null;
  };
  const total = (o) => o.items.reduce((a, i) => a + +i.total, 0) + +o.shipping + +o.tax - +o.discount;
  const row = (o) => ({ id: o.id, number: String(o.id), status: o.status, status_label: LABEL[o.status], total: String(total(o)), currency: 'تومان', ts: o.ts, customer: o.customer, items_count: o.items.reduce((a, i) => a + i.qty, 0), preview: o.items.slice(0, 2).map((i) => i.name).join('، '), paid: o.paid });
  const full = (o) => ({
    ...row(o),
    totals: { subtotal: String(o.items.reduce((a, i) => a + +i.subtotal, 0)), discount: o.discount, shipping: o.shipping, tax: o.tax, refunded: o.refunded, total: String(total(o)) }, fees: o.fees, items: o.items.map(({ avail, ...rest }) => rest),
    customer_info: { name: o.customer, phone: o.phone, email: o.email, user_id: 0 }, billing_address: o.addr || '', shipping_address: o.addr || '', postcode: o.postcode, needs_shipping: true,
    payment: { method: 'zarinpal', title: o.pay, transaction_id: o.trx }, shipping_methods: o.shipm, request: reqBlock(o), customer_note: o.note, tracking: o.tracking, notes: [...o.notes].sort((a, b) => b.ts - a.ts), edit_url: `http://localhost/wp-admin/post.php?post=${o.id}&action=edit`,
  });
  const counts = () => Object.fromEntries(STATUSES.map(([s]) => [s, db.filter((o) => o.status === s).length]));
  let nid = 100;
  const addNote = (o, content, customer) => o.notes.push({ id: nid++, content, customer, by: customer ? 'admin' : 'admin', ts: Math.floor(Date.now() / 1000) });

  const api = (route, method, inp, q) => {
    if (route === '/bazar/v1/orders/meta') return { code: 200, obj: { statuses: STATUSES.map(([s, l]) => ({ slug: s, label: l, settable: s !== 'refunded' && s !== 'bazar-request' })), counts: counts(), latest_id: Math.max(0, ...db.map((o) => o.id)), request_mode: true, currency: 'تومان', site: { name: 'Sungold store', url: 'http://localhost/' } } };
    if (route === '/bazar/v1/orders/stats') {
      const cutoff = (d) => Math.floor(now() / 1000) - (d - 1) * day - (Math.floor(now() / 1000) % day);
      const ok = db.filter((o) => ['processing', 'completed', 'on-hold'].includes(o.status));
      const agg = (d) => { const l = ok.filter((o) => o.ts >= cutoff(d)); return { count: l.length, revenue: l.reduce((a, o) => a + total(o) - +o.refunded, 0) }; };
      return { code: 200, obj: { today: agg(1), week: agg(7), month: agg(30), truncated: false, currency: 'تومان' } };
    }
    if (route === '/bazar/v1/orders' && method === 'GET') {
      let list = [...db].sort((a, b) => b.ts - a.ts);
      const st = slug(q.get('status')); if (st && LABEL[st]) list = list.filter((o) => o.status === st);
      const s = digits((q.get('search') || '').trim().replace(/^#/, ''));
      if (s) { if (/^\d{1,9}$/.test(s)) list = list.filter((o) => o.id === +s); else list = list.filter((o) => (o.customer + ' ' + o.phone + ' ' + o.items.map((i) => i.name).join(' ')).includes(q.get('search').trim())); }
      const page = Math.max(1, +q.get('page') || 1), per = +process.env.MOCK_PER_PAGE || 20;
      return { code: 200, obj: { items: list.slice((page - 1) * per, page * per).map(row), total: list.length, pages: Math.ceil(list.length / per), page } };
    }
    let m = /^\/bazar\/v1\/orders\/(\d+)$/.exec(route);
    if (m) {
      const o = find(+m[1]); if (!o) return err('bazar_not_found', 'سفارش پیدا نشد.', 404);
      if (method === 'GET') return { code: 200, obj: full(o) };
      if ('status' in inp && inp.status !== '') {
        const sl = slug(inp.status);
        if (!LABEL[sl]) return err('bazar_bad_request', 'وضعیت نامعتبر است.');
        if (sl === 'bazar-request') return err('bazar_bad_request', 'وضعیت «درخواست خرید» را فقط خود سیستم ثبت می‌کند.');
        if (o.status === 'bazar-request' && sl !== 'cancelled') return err('bazar_bad_request', 'برای درخواست خرید از دکمه‌ی «تأیید» (با کنترل موجودی) یا «رد» استفاده کنید.');
        if (sl === 'refunded') return err('bazar_bad_request', 'استرداد وجه را از پیشخوان وردپرس انجام دهید تا رکورد استرداد ساخته شود.');
        if (sl !== o.status) { const note = String(inp.note || '').trim().slice(0, 500); addNote(o, `${note ? note + ' ' : ''}وضعیت سفارش از ${LABEL[o.status]} به ${LABEL[sl]} تغییر کرد.`, false); o.status = sl; o.paid = ['processing', 'completed'].includes(sl) ? true : o.paid; }
      }
      if ('tracking' in inp) {
        const code = String(inp.tracking ?? '').trim().slice(0, 60);
        if (code !== o.tracking) { o.tracking = code; if (code) addNote(o, inp.notify_tracking ? `کد رهگیری مرسوله‌ی شما: ${code}` : `کد رهگیری ثبت شد: ${code}`, !!inp.notify_tracking); }
      }
      return { code: 200, obj: full(o) };
    }
    m = /^\/bazar\/v1\/orders\/(\d+)\/(approve|reject)$/.exec(route);
    if (m && method === 'POST') {
      const o = find(+m[1]); if (!o) return err('bazar_not_found', 'سفارش پیدا نشد.', 404);
      if (o.status !== 'bazar-request') return err('bazar_not_request', 'این سفارش در وضعیت «درخواست خرید» نیست (شاید قبلاً بررسی شده).', 409);
      if (m[2] === 'reject') {
        const reason = String(inp.reason || '').trim().slice(0, 500) || 'موجودی کافی نیست';
        addNote(o, `درخواست خرید رد شد: ${reason}`, false); addNote(o, `متأسفانه درخواست خرید شما انجام نشد: ${reason}`, true); o.status = 'cancelled';
        return { code: 200, obj: full(o) };
      }
      const rows = stockRows(o);
      if (!rows.every((r) => r.ok) && !inp.force) return err('bazar_stock_short', 'موجودی همه‌ی اقلام کافی نیست.', 409, { stock: rows });
      const hours = Math.max(1, Math.min(168, Math.round(+inp.hours) || 24));
      o.items.forEach((i) => { if (i.avail != null) i.avail -= i.qty; }); // رزرو موجودی
      o.status = 'pending'; o.expires = Math.floor(Date.now() / 1000) + hours * 3600; o.paid = false;
      addNote(o, 'درخواست خرید تأیید شد.', false);
      addNote(o, `درخواست خرید شما تأیید شد و کالا برای شما رزرو شد. برای پرداخت از این پیوند استفاده کنید: http://localhost/checkout/order-pay/${o.id}/?key=wc_order_mock (مهلت پرداخت: ${hours} ساعت)` + (inp.note ? '\n' + String(inp.note).slice(0, 500) : ''), true);
      return { code: 200, obj: full(o) };
    }
    m = /^\/bazar\/v1\/orders\/(\d+)\/notes$/.exec(route);
    if (m && method === 'POST') {
      const o = find(+m[1]); if (!o) return err('bazar_not_found', 'سفارش پیدا نشد.', 404);
      const text = String(inp.note || '').trim().slice(0, 1000); if (!text) return err('bazar_bad_request', 'متن یادداشت خالی است.');
      addNote(o, text, !!inp.customer); return { code: 200, obj: full(o) };
    }
    return null;
  };
  /** برای تست: سفارش تازه می‌سازد (شبیه رسیدن سفارش از سایت). */
  api.addNew = (name = 'خریدار تازه') => { const id = 1000 + db.length + 1; db.push(mk({ id, ts: Math.floor(Date.now() / 1000), customer: name, status: 'processing', items: [it(90 + id, 'محصول تازه', 1, 500000)] })); return id; };
  /** برای تست: درخواست خرید تازه. short=true → یک قلم با موجودی ناکافی. */
  api.addRequest = ({ short = false, name = 'متقاضی تازه' } = {}) => {
    const id = 1000 + db.length + 1;
    db.push(mk({ id, ts: Math.floor(Date.now() / 1000), customer: name, status: 'bazar-request', paid: false, pay: 'درخواست خرید', phone: '09120001111', addr: 'تهران، ونک',
      items: [it(70 + id, 'کیف دوشی چرم', 1, 700000, { avail: 5 }), short ? it(80 + id, 'کفش ورزشی', 3, 300000, { avail: 1 }) : it(80 + id, 'کلاه لبه‌دار', 2, 150000, { avail: 9 })] }));
    return id;
  };
  api.peek = (id) => { const o = find(id); return o ? { status: o.status, avail: o.items.map((i) => i.avail ?? null), expires: o.expires || 0, notes: o.notes.map((n) => ({ c: n.content, customer: n.customer })) } : null; };
  return api;
}
