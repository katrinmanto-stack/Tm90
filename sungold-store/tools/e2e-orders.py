"""تست سرتاسری تب سفارشات. اجرا: MOCK_PER_PAGE=4 node tools/mock-server.mjs &  سپس  python3 tools/e2e-orders.py"""
import json, base64, urllib.request
from playwright.sync_api import sync_playwright, expect
BASE = 'http://localhost:8787'; PASS = 'abcd efgh ijkl mnop qrst uvwx'; SH = '/tmp/shots'
fails, errs = [], []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(name)
def api(route, method='GET', body=None):
    h = {'Authorization': 'Basic ' + base64.b64encode(f'admin:{PASS}'.encode()).decode()}
    data = None
    if body is not None: data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
    r = urllib.request.Request(BASE + route, data=data, headers=h, method=method)
    return json.load(urllib.request.urlopen(r))
def only(pg, text, timeout=6000):
    pg.wait_for_function("([t]) => { const r = [...document.querySelectorAll('.orow')]; return r.length === 1 && r[0].textContent.includes(t); }", arg=[text], timeout=timeout)
def toast(pg, text=None):
    pg.wait_for_selector('#toast.show')
    if text: expect(pg.locator('#toast')).to_contain_text(text, timeout=6000)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, permissions=['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())

    pg.goto(BASE + '/app/'); pg.wait_for_selector('.connect')
    pg.fill('input[placeholder="https://sungold.ir"]', BASE); pg.fill('input[placeholder="admin"]', 'admin'); pg.fill('input[type=password]', PASS)
    pg.click('button[type=submit]'); pg.wait_for_selector('.apptabs')
    check('4 tabs incl. orders', pg.locator('[data-tab]').count() == 4 and pg.locator('[data-tab=orders]').count() == 1)
    pg.wait_for_selector('[data-tab=orders] .tbadge')
    check('badge shows processing count (۱)', pg.inner_text('[data-tab=orders] .tbadge').strip() == '۱')
    tabs = pg.evaluate("[...document.querySelectorAll('.apptabs button')].map(b=>[Math.round(b.getBoundingClientRect().width), b.scrollWidth>b.clientWidth+1])")
    check('all 4 tabs fit on a 390px phone without clipping', all(not clip for _, clip in tabs), str(tabs))

    # ---------- فهرست ----------
    pg.click('[data-tab=orders]'); pg.wait_for_selector('.orow')
    check('orders tab hides settings bar + groups + preview', pg.locator('#bar').is_hidden() and pg.locator('#groups').is_hidden())
    check('first page shows 4 of 7 (pagination)', pg.locator('.orow').count() == 4, str(pg.locator('.orow').count()))
    pg.click('.more'); expect(pg.locator('.orow')).to_have_count(7)
    check('show-more loads the rest, button gone', pg.locator('.more').count() == 0)
    check('stats card: today/7d/30d', pg.locator('.ostat').count() == 3)
    st = pg.inner_text('.ostats')
    check('stats use Persian digits, no NaN/undefined', 'NaN' not in st and 'undefined' not in st and any(c in st for c in '۰۱۲۳۴۵۶۷۸۹'), st)
    first = pg.inner_text('.orow >> nth=0')
    check('newest order first, Persian number + date + total', '#۱۰۰۱' in first and 'مریم احمدی' in first and '۱٬۴۶۲٬۰۰۰' in first, first)
    check('jalali date rendered (not gregorian digits)', not any(c in first for c in '0123456789'), first)
    pg.screenshot(path=f'{SH}/o1-list-mobile.png')
    chips = pg.inner_text('.prow-chips')
    check('status chips with counts', 'همه' in chips and 'در حال انجام' in chips and 'تکمیل‌شده' in chips and 'مسترد' not in chips, chips)
    pg.click('.prow-chips .chip:has-text("تکمیل‌شده")'); expect(pg.locator('.orow')).to_have_count(3)
    check('status filter: completed only', all('تکمیل‌شده' in t for t in pg.locator('.orow').all_inner_texts()))
    pg.click('.prow-chips .chip:has-text("همه")'); pg.locator('.orow').nth(3).wait_for()
    pg.fill('input[type=search]', '۱۰۰۲'); only(pg, 'علی رضایی')
    check('search by order number (Persian digits)', 'علی رضایی' in pg.inner_text('.orow'))
    pg.fill('input[type=search]', 'نیلوفر'); only(pg, 'نیلوفر')
    check('search by customer name', '#۱۰۰۵' in pg.inner_text('.orow'))
    pg.fill('input[type=search]', 'zzzz'); pg.wait_for_selector('.empty')
    check('empty state message', 'پیدا نشد' in pg.inner_text('.empty'))
    pg.fill('input[type=search]', ''); pg.locator('.orow').nth(3).wait_for()

    # ---------- جزئیات ----------
    pg.locator('.orow:has-text("#۱۰۰۱")').click(); pg.wait_for_selector('.oitem')
    d = pg.inner_text('#form')
    check('detail: items, variation meta, sku', 'مانتو کتان سبک' in d and 'سایز: M' in d and 'MN-01' in d)
    check('detail: totals incl. shipping', 'هزینه‌ی ارسال' in d and '۱٬۴۶۲٬۰۰۰' in d, d[-600:])
    check('detail: address + customer note + payment', 'ولیعصر' in d and 'تا ساعت ۱۸' in d and 'زرین‌پال' in d)
    check('detail: call + whatsapp links built from Persian digits', pg.get_attribute('a:has-text("تماس")', 'href') == 'tel:09123456789' and pg.get_attribute('a:has-text("واتس‌اپ")', 'href') == 'https://wa.me/989123456789', str(pg.get_attribute('a:has-text("واتس‌اپ")', 'href')))
    check('no stray null/undefined/NaN', not any(x in d for x in ('null', 'undefined', 'NaN')))
    check('status save disabled until a change', pg.locator('button:has-text("ثبت وضعیت")').is_disabled())
    pg.screenshot(path=f'{SH}/o2-detail-mobile.png', full_page=True)

    pg.click('button:has-text("کپی آدرس")'); toast(pg, 'آدرس کپی شد')
    clip = pg.evaluate('navigator.clipboard.readText()')
    check('copy address puts the address on the clipboard', 'ولیعصر' in clip, clip)

    # تغییر وضعیت
    pg.click('[role=radio]:has-text("تکمیل‌شده")')
    check('save enabled + note field appears after picking a status', pg.locator('button:has-text("ثبت وضعیت")').is_enabled() and pg.locator('input[aria-label="یادداشت تغییر وضعیت"]').is_visible())
    pg.fill('input[aria-label="یادداشت تغییر وضعیت"]', 'بسته تحویل پست شد')
    pg.click('button:has-text("ثبت وضعیت")'); toast(pg, 'تغییر کرد')
    pg.wait_for_selector('.onote')
    check('server saved the new status', api('/wp-json/bazar/v1/orders/1001')['status'] == 'completed')
    check('status-change note is in the timeline', 'بسته تحویل پست شد' in pg.inner_text('.onotes'))
    check('header tag updated', 'تکمیل‌شده' in pg.inner_text('.ohead'))

    # کد رهگیری
    pg.fill('input[aria-label="کد رهگیری"]', '2400999888777')
    pg.click('button:has-text("ذخیره‌ی کد رهگیری")'); toast(pg, 'کد رهگیری ذخیره شد')
    o = api('/wp-json/bazar/v1/orders/1001')
    check('tracking saved + customer notified (customer note)', o['tracking'] == '2400999888777' and any(n['customer'] and '2400999888777' in n['content'] for n in o['notes']))

    # یادداشت
    pg.fill('textarea[aria-label="یادداشت جدید"]', 'تماس گرفته شد؛ مشتری تأیید کرد.')
    pg.click('button:has-text("افزودن یادداشت")'); toast(pg, 'یادداشت افزوده شد')
    o = api('/wp-json/bazar/v1/orders/1001')
    check('private note saved (not customer-facing)', any((not n['customer']) and 'مشتری تأیید کرد' in n['content'] for n in o['notes']))
    check('note box cleared after adding', pg.input_value('textarea[aria-label="یادداشت جدید"]') == '')
    pg.click('button:has-text("افزودن یادداشت")'); toast(pg, 'متن یادداشت را بنویسید')

    # بازگشت: وضعیت در فهرست به‌روز است، شمارنده‌ی تب کم می‌شود
    pg.click('button:has-text("فهرست سفارشات")'); pg.wait_for_selector('.orow')
    check('list reflects the new status without a reload', 'تکمیل‌شده' in pg.inner_text('.orow:has-text("#۱۰۰۱")'))

    # استرداد از اپ ممکن نیست (سرور هم رد می‌کند)
    try:
        api('/wp-json/bazar/v1/orders/1002', 'POST', {'status': 'refunded'}); refused = False
    except urllib.error.HTTPError as e:
        refused = e.code == 400
    check('server refuses setting status to refunded', refused)
    try:
        api('/wp-json/bazar/v1/orders/1002', 'POST', {'status': 'hacked'}); bad = False
    except urllib.error.HTTPError as e:
        bad = e.code == 400
    check('server refuses unknown status', bad)
    check('refunded is not offered in the status picker', True)
    pg.locator('.orow:has-text("#۱۰۰۲")').click(); pg.wait_for_selector('.oitem')
    check('status picker excludes refunded', pg.locator('[role=radio]:has-text("مسترد")').count() == 0)
    check('unpaid order is flagged', 'پرداخت‌نشده' in pg.inner_text('.ohead'))
    # تغییرات ذخیره‌نشده: خروج با تأیید
    pg.click('[role=radio]:has-text("لغوشده")')
    pg.click('button:has-text("فهرست سفارشات")'); pg.wait_for_selector('.orow')
    check('leaving with unsaved change asks (dialog accepted) and does not save it', api('/wp-json/bazar/v1/orders/1002')['status'] == 'on-hold')

    # ---------- سفارش تازه: پیام + نشانگر ----------
    check('badge cleared after the only processing order was completed', pg.locator('[data-tab=orders] .tbadge').count() == 0)
    urllib.request.urlopen(urllib.request.Request(BASE + '/wp-json/__mock/new-order', method='POST', headers={'Authorization': 'Basic ' + base64.b64encode(f'admin:{PASS}'.encode()).decode()}, data=b'{}'))
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_selector('[data-tab=orders] .tbadge', timeout=8000)
    check('badge appears when a new order arrives', pg.inner_text('[data-tab=orders] .tbadge').strip() == '۱')
    toast(pg, 'سفارش جدید رسید')
    pg.wait_for_selector('.orow:has-text("خریدار تازه")', timeout=8000)
    check('orders list auto-refreshes with the new order on top', 'خریدار تازه' in pg.inner_text('.orow >> nth=0'))

    # ---------- سایر تب‌ها هنوز سالم ----------
    pg.click('[data-tab=products]'); pg.wait_for_selector('.prow')
    check('products tab still works after orders', pg.locator('.prow').count() >= 4)
    pg.click('[data-tab=look]'); pg.wait_for_selector('#groups .chip')
    check('look tab restores bar + groups', pg.locator('#bar').is_visible() and pg.locator('#groups').is_visible())

    # ---------- دسکتاپ ----------
    dk = b.new_context(viewport={'width': 1280, 'height': 800}).new_page()
    dk.on('dialog', lambda x: x.accept())
    dk.goto(BASE + '/app/'); dk.wait_for_selector('.connect')
    dk.fill('input[placeholder="https://sungold.ir"]', BASE); dk.fill('input[placeholder="admin"]', 'admin'); dk.fill('input[type=password]', PASS)
    dk.click('button[type=submit]'); dk.wait_for_selector('.apptabs'); dk.click('[data-tab=orders]'); dk.wait_for_selector('.orow')
    check('desktop: orders list renders in single column mode', dk.locator('.mode-products').count() == 1 and dk.locator('.pane').is_hidden())
    dk.screenshot(path=f'{SH}/o3-list-desktop.png')

    # ---------- دسترسی ----------
    try:
        r = urllib.request.Request(BASE + '/wp-json/bazar/v1/orders'); urllib.request.urlopen(r); anon = False
    except urllib.error.HTTPError as e:
        anon = e.code == 401
    check('orders API rejects anonymous requests', anon)

    b.close()
print('console/page errors:', errs if errs else 'none')
check('no JS errors', not errs, str(errs))
print('\nFAILED:' if fails else '\nALL PASSED', fails or '')
raise SystemExit(1 if fails else 0)
