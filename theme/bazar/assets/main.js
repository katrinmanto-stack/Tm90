(function () {
  var d = document, b = d.body, last = null;
  function closeAll() {
    b.classList.remove('has-drawer');
    d.querySelectorAll('.drawer.open').forEach(function (e) { e.classList.remove('open'); e.setAttribute('aria-hidden', 'true'); });
    if (last && last.focus) last.focus(); last = null;
  }
  function openDrawer(sel) {
    var t = d.querySelector(sel); if (!t) return;
    var prev = d.activeElement; closeAll(); last = prev; t.classList.add('open'); t.setAttribute('aria-hidden', 'false'); b.classList.add('has-drawer');
    var f = t.querySelector('button,a'); if (f) f.focus();
  }
  function selectTab(btn) {
    var bar = btn.parentNode;
    bar.querySelectorAll('[role=tab]').forEach(function (t) {
      var on = t === btn; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
      var p = d.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on;
    });
  }
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open]');
    if (t) { e.preventDefault(); openDrawer(t.getAttribute('data-open')); return; }
    if (e.target.closest('[data-close]') || e.target.classList.contains('overlay')) { closeAll(); return; }
    var tab = e.target.closest('[role=tab]'); if (tab) { selectTab(tab); return; }
    var go = e.target.closest('[data-tab-go]');
    if (go) { var g = d.getElementById(go.getAttribute('data-tab-go')); if (g) selectTab(g); return; }
    var ar = e.target.closest('[data-slide]');
    if (ar) {
      var s = d.querySelector('.bazar-banners'); if (!s) return;
      var rtl = getComputedStyle(s).direction === 'rtl' ? -1 : 1;
      s.scrollBy({ left: (+ar.getAttribute('data-slide')) * s.clientWidth * rtl, behavior: 'smooth' });
    }
  });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAll(); return; }
    var dr = d.querySelector('.drawer.open');
    if (e.key === 'Tab' && dr) {
      var f = dr.querySelectorAll('a[href],button:not([disabled]),input,select,textarea'); if (!f.length) return;
      var first = f[0], end = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && d.activeElement === end) { e.preventDefault(); first.focus(); }
      else if (!dr.contains(d.activeElement)) { e.preventDefault(); first.focus(); }
      return;
    }
    var tb = e.target.closest && e.target.closest('[role=tab]');
    if (tb && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var tabs = [].slice.call(tb.parentNode.querySelectorAll('[role=tab]')), rtl = getComputedStyle(tb.parentNode).direction === 'rtl';
      var step = (e.key === 'ArrowRight') === !rtl ? 1 : -1;
      var nx = tabs[(tabs.indexOf(tb) + step + tabs.length) % tabs.length]; e.preventDefault(); nx.focus(); selectTab(nx);
    }
  });
  if (window.jQuery) { jQuery(b).on('added_to_cart', function () { openDrawer('#drawer-cart'); }); }

  // سایه‌ی هدر هنگام اسکرول
  var hd = d.querySelector('.hd');
  if (hd) {
    var stuck = false, chk = function () { var s = window.scrollY > 8; if (s !== stuck) { stuck = s; hd.classList.toggle('is-stuck', s); } };
    window.addEventListener('scroll', chk, { passive: true }); chk();
  }

  // نقطه‌های اسلایدر بنر (در راست‌چین هم درست کار می‌کند)
  var sl = d.querySelector('.bazar-banners');
  if (sl && sl.children.length > 1) {
    var dots = d.createElement('div'), raf;
    dots.className = 'hero-dots'; dots.setAttribute('aria-hidden', 'true');
    [].forEach.call(sl.children, function (_, i) { var s = d.createElement('span'); if (!i) s.className = 'on'; dots.appendChild(s); });
    sl.parentNode.appendChild(dots);
    sl.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var n = Math.round(Math.abs(sl.scrollLeft) / sl.clientWidth);
        [].forEach.call(dots.children, function (s, k) { s.className = k === n ? 'on' : ''; });
      });
    }, { passive: true });
  }

  // نوار افزودن به سبد در صفحه محصول
  var bar = d.querySelector('.satc'), form = d.querySelector('form.cart');
  if (bar && form && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      var r = en[0].boundingClientRect; bar.hidden = en[0].isIntersecting || r.top > 0;
    }).observe(form);
    bar.querySelector('[data-atc]').addEventListener('click', function () {
      var btn = form.querySelector('.single_add_to_cart_button');
      if (btn && !btn.disabled && !btn.classList.contains('disabled')) btn.click(); else form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
})();
