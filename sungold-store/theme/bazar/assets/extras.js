(function () {
  var d = document, w = window;
  var KW = 'bz_wish', KC = 'bz_cmp', MAXC = 4, cache = {}, toastEl, toastT;

  function ls() { try { return w.localStorage; } catch (e) { return null; } }
  function read(k) {
    try { var v = JSON.parse(ls().getItem(k)); return Array.isArray(v) ? v.map(Number).filter(Boolean) : []; } catch (e) { return []; }
  }
  function write(k, v) { try { ls().setItem(k, JSON.stringify(v)); } catch (e) {} }
  function el(tag, cls, text) {
    var n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n;
  }
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', 'bz-toast'); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); d.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------- نوار بالا: دکمه‌ی بستن ---------- */
  d.addEventListener('click', function (e) {
    var x = e.target.closest('[data-tb-close]');
    if (!x) return;
    var bar = x.closest('.topbar'); if (!bar) return;
    bar.hidden = true;
    try { ls().setItem('bz_tb', bar.getAttribute('data-key') || '1'); } catch (er) {}
  });

  /* ---------- پاپ‌آپ ---------- */
  var pop = d.getElementById('bz-popup');
  if (pop) {
    var key = pop.getAttribute('data-key'), freq = pop.getAttribute('data-freq'),
        delay = (+pop.getAttribute('data-delay') || 5) * 1000, prev = pop.getAttribute('data-preview') === '1';
    var due = function () {
      if (prev) return true;
      try {
        if (freq === 'session') return !w.sessionStorage.getItem('bzp_' + key);
        var t = +ls().getItem('bzp_' + key) || 0;
        return Date.now() - t > (freq === 'week' ? 6048e5 : 864e5);
      } catch (e) { return true; }
    };
    var mark = function () {
      if (prev) return;
      try { if (freq === 'session') w.sessionStorage.setItem('bzp_' + key, '1'); else ls().setItem('bzp_' + key, String(Date.now())); } catch (e) {}
    };
    var tries = 0;
    var show = function () {
      if (d.querySelector('.drawer.open') && tries++ < 3) { setTimeout(show, 3000); return; }
      pop.hidden = false; mark();
      var c = pop.querySelector('[data-bzp-close]'); if (c) c.focus();
    };
    var hide = function () { pop.hidden = true; };
    if (due()) setTimeout(show, prev ? 800 : delay);
    pop.addEventListener('click', function (e) { if (e.target === pop || e.target.closest('[data-bzp-close]')) hide(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) hide(); });
  }

  /* ---------- اشتراک‌گذاری ---------- */
  function copyText(t) {
    if (w.navigator.clipboard && w.navigator.clipboard.writeText) return w.navigator.clipboard.writeText(t);
    return new Promise(function (ok, no) {
      var a = d.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; d.body.appendChild(a); a.select();
      try { d.execCommand('copy') ? ok() : no(); } catch (e) { no(e); } d.body.removeChild(a);
    });
  }
  function share(btn) {
    var title = btn.getAttribute('data-title') || d.title, url = btn.getAttribute('data-url') || w.location.href;
    if (w.navigator.share) { w.navigator.share({ title: title, url: url }).catch(function () {}); return; }
    copyText(url).then(function () { toast('لینک کپی شد'); }, function () { toast(url); });
  }

  /* ---------- علاقه‌مندی و مقایسه ---------- */
  var drawer = d.getElementById('drawer-lists');

  function sync() {
    var wl = read(KW), cl = read(KC);
    [].forEach.call(d.querySelectorAll('[data-wish]'), function (b) {
      var on = wl.indexOf(+b.getAttribute('data-wish')) > -1;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    [].forEach.call(d.querySelectorAll('[data-cmp]'), function (b) {
      var on = cl.indexOf(+b.getAttribute('data-cmp')) > -1;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var total = wl.length + cl.length;
    [].forEach.call(d.querySelectorAll('[data-lists-count]'), function (c) { c.textContent = total; c.classList.toggle('is-zero', !total); });
    var pill = d.querySelector('.cmp-pill');
    if (pill) { pill.hidden = !cl.length; var n = pill.querySelector('[data-cmp-count]'); if (n) n.textContent = cl.length; }
  }

  function toggle(k, id, max) {
    var l = read(k), i = l.indexOf(id);
    if (i > -1) { l.splice(i, 1); write(k, l); return 'remove'; }
    if (max && l.length >= max) { toast('حداکثر ' + max + ' محصول را می‌توان مقایسه کرد'); return 'full'; }
    l.push(id); write(k, l); return 'add';
  }

  function isOpen() { return drawer && drawer.classList.contains('open'); }

  function fetchProducts(ids) {
    var need = ids.filter(function (id) { return !cache[id]; });
    if (!need.length || !drawer) return Promise.resolve(true);
    var api = drawer.getAttribute('data-api') || '';
    var url = api + (api.indexOf('?') > -1 ? '&' : '?') + 'include=' + need.join(',') + '&per_page=' + Math.min(100, need.length);
    return w.fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    }).then(function (list) {
      if (!Array.isArray(list)) throw new Error('bad');
      list.forEach(function (p) { cache[p.id] = p; });
      // محصولات حذف‌شده را از لیست‌ها پاک کن
      [KW, KC].forEach(function (k) {
        var l = read(k), f = l.filter(function (id) { return cache[id] || need.indexOf(id) === -1; });
        if (f.length !== l.length) write(k, f);
      });
      return true;
    });
  }

  function priceNode(p) { var n = el('div', 'lst-p'); n.innerHTML = p.price_html || ''; return n; }
  function thumb(p) { return (p.images && p.images[0] && (p.images[0].thumbnail || p.images[0].src)) || ''; }

  function drawWish(box) {
    box.textContent = '';
    var ids = read(KW).filter(function (id) { return cache[id]; });
    if (!ids.length) { box.appendChild(el('p', 'lst-empty', 'هنوز محصولی اضافه نکرده‌اید.')); return; }
    ids.forEach(function (id) {
      var p = cache[id], row = el('div', 'lst-i'), a = el('a', 'lst-img'), info = el('div'), n = el('a', 'lst-n', p.name), rm = el('button', 'lst-rm', '×');
      a.href = p.permalink; var im = el('img'); im.src = thumb(p); im.alt = ''; im.loading = 'lazy'; a.appendChild(im);
      n.href = p.permalink; info.appendChild(n); info.appendChild(priceNode(p));
      rm.type = 'button'; rm.setAttribute('data-wish', id); rm.setAttribute('aria-label', 'حذف');
      row.appendChild(a); row.appendChild(info); row.appendChild(rm); box.appendChild(row);
    });
  }

  function drawCompare(box) {
    box.textContent = '';
    var ids = read(KC).filter(function (id) { return cache[id]; });
    if (!ids.length) { box.appendChild(el('p', 'lst-empty', 'محصولی برای مقایسه انتخاب نشده است.')); return; }
    var names = [], seen = {};
    ids.forEach(function (id) {
      (cache[id].attributes || []).forEach(function (a) { if (!seen[a.name]) { seen[a.name] = 1; names.push(a.name); } });
    });
    var wrap = el('div', 'cmp-w'), t = el('table', 'cmp-t'), head = el('tr');
    head.appendChild(el('th', null, ''));
    ids.forEach(function (id) {
      var p = cache[id], th = el('th'), a = el('a'), rm = el('button', 'lst-rm', '×');
      var im = el('img'); im.src = thumb(p); im.alt = ''; a.href = p.permalink; a.appendChild(im);
      var nm = el('a', 'lst-n', p.name); nm.href = p.permalink;
      rm.type = 'button'; rm.setAttribute('data-cmp', id); rm.setAttribute('aria-label', 'حذف');
      th.appendChild(a); th.appendChild(nm); th.appendChild(rm); head.appendChild(th);
    });
    t.appendChild(head);
    var addRow = function (label, fn) {
      var tr = el('tr'); tr.appendChild(el('th', null, label));
      ids.forEach(function (id) { var td = el('td'); fn(td, cache[id]); tr.appendChild(td); });
      t.appendChild(tr);
    };
    addRow('قیمت', function (td, p) { td.innerHTML = p.price_html || ''; });
    addRow('موجودی', function (td, p) { td.textContent = p.is_in_stock ? 'موجود' : 'ناموجود'; });
    names.forEach(function (nm) {
      addRow(nm, function (td, p) {
        var v = (p.attributes || []).filter(function (a) { return a.name === nm; })[0];
        td.textContent = v ? (v.terms || []).map(function (x) { return x.name; }).join('، ') : '—';
      });
    });
    wrap.appendChild(t); box.appendChild(wrap);
  }

  function render() {
    if (!drawer) return;
    var wb = drawer.querySelector('[data-list=wish]'), cb = drawer.querySelector('[data-list=compare]');
    var ids = read(KW).concat(read(KC));
    var draw = function () { if (wb) drawWish(wb); if (cb) drawCompare(cb); };
    if (!ids.length) { draw(); return; }
    [wb, cb].forEach(function (b) { if (b && !b.firstChild) b.appendChild(el('p', 'lst-empty', 'در حال بارگذاری…')); });
    fetchProducts(ids).then(draw, function () {
      [wb, cb].forEach(function (b) { if (b) { b.textContent = ''; b.appendChild(el('p', 'lst-empty', 'بارگذاری ناموفق بود؛ دوباره تلاش کنید.')); } });
    });
  }

  d.addEventListener('click', function (e) {
    var wi = e.target.closest('[data-wish]');
    if (wi) {
      e.preventDefault();
      var r1 = toggle(KW, +wi.getAttribute('data-wish'));
      sync(); toast(r1 === 'add' ? 'به علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد'); if (isOpen()) render();
      return;
    }
    var ci = e.target.closest('[data-cmp]');
    if (ci) {
      e.preventDefault();
      var r2 = toggle(KC, +ci.getAttribute('data-cmp'), MAXC);
      sync();
      if (r2 !== 'full') toast(r2 === 'add' ? 'به مقایسه اضافه شد' : 'از مقایسه حذف شد');
      if (isOpen()) render();
      return;
    }
    var sh = e.target.closest('[data-share]');
    if (sh) { e.preventDefault(); share(sh); return; }
    var tab = e.target.closest('[data-lists-tab]');
    if (tab) {
      var name = tab.getAttribute('data-lists-tab');
      setTimeout(function () { var t = d.getElementById('tl-' + name); if (t && t.getAttribute('aria-selected') !== 'true') t.click(); render(); }, 0);
    }
  });

  w.addEventListener('storage', sync);
  sync();
})();
