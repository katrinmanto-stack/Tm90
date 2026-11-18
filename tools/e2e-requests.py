"""تست سرتاسری «درخواست خرید قبل از پرداخت». اجرا: MOCK_PER_PAGE=4 node tools/mock-server.mjs &  سپس  python3 tools/e2e-requests.py"""
import json, base64, time, urllib.request, urllib.error
from playwright.sync_api import sync_playwright, expect
BASE = 'http://localhost:8787'; PASS = 'abcd efgh ijkl mnop qrst uvwx'
AUTH = {'Authorization': 'Basic ' + base64.b64encode(f'admin:{PASS}'.encode()).decode()}
fails, errs = [], []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(name)
def api(route, method='GET', body=None, anon=False):
    h = {} if anon else dict(AUTH)
    data = None
    if body is not None: data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
    r = urllib.request.Request(BASE + route, data=data, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r); return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)
def mk(name, short=False): return api('/wp-json/__mock/new-request', 'POST', {'short': short, 'name': name})[1]['id']
def peek(i): return api(f'/wp-json/__mock/peek?id={i}')[1]
def toast(pg, text):
    pg.wait_for_selector('#toast.show'); expect(pg.locator('#toast')).to_contain_text(text, timeout=6000)
def back(pg): pg.click('text=فهرست سفارشات'); pg.wait_for_selector('.orow')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())

    pg.goto(BASE + '/app/'); pg.wait_for_selector('.connect')
    pg.fill('input[placeholder="https://sungold.ir"]', BASE); pg.fill('input[placeholder="admin"]', 'admin'); pg.fill('input[type=password]', PASS)
    pg.click('button[type=submit]'); pg.wait_for_selector('.apptabs')
    pg.wait_for_selector('[data-tab=orders] .tbadge')
    check('baseline badge ۱ (only the processing order)', pg.inner_text('[data-tab=orders] .tbadge').strip() == '۱')

    # ---------- درخواست‌های تازه ← هشدار و شمارنده ----------
    r1 = mk('متقاضی-یک', short=True); r2 = mk('متقاضی-دو'); r3 = mk('متقاضی-سه')
    pg.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
    toast(pg, 'درخواست خرید جدید رسید')
    check('new-request toast says «request», not a plain order', True)
    pg.wait_for_function("() => document.querySelector('[data-tab=orders] .tbadge')?.textContent.trim() === '۴'", timeout=6000)
    check('badge counts processing + requests (۴)', True)
    st, meta = api('/wp-json/bazar/v1/orders/meta')
    check('meta: request count + latest_id + request status not settable', meta['counts']['bazar-request'] == 3 and meta['latest_id'] == r3 and not [s for s in meta['statuses'] if s['slug'] == 'bazar-request'][0]['settable'])

    # ---------- قفل‌های سرور ----------
    st, e = api(f'/wp-json/bazar/v1/orders/{r2}', 'POST', {'status': 'completed'})
    check('generic status change is refused for a pending request (stock check cannot be bypassed)', st == 400 and 'تأیید' in e['message'], str(e))
    st, e = api(f'/wp-json/bazar/v1/orders/1001', 'POST', {'status': 'bazar-request'})
    check('cannot set status «bazar-request» manually', st == 400, str(e))
    st, e = api(f'/wp-json/bazar/v1/orders/{r1}/approve', 'POST', {})
    check('approve without force on short stock → 409 bazar_stock_short with per-item rows', st == 409 and e['code'] == 'bazar_stock_short' and any(not r['ok'] for r in e['data']['stock']) and any(r['ok'] for r in e['data']['stock']), str(e))
    check('nothing changed after refused approve (no stock reserved)', peek(r1)['status'] == 'bazar-request' and peek(r1)['avail'] == [5, 1])
    st, e = api(f'/wp-json/bazar/v1/orders/{r2}/approve', 'POST', {}, anon=True)
    check('approve API rejects anonymous requests', st in (401, 403), str(st))

    # ---------- رابط: فهرست و فیلتر ----------
    pg.click('[data-tab=orders]'); pg.wait_for_selector('.orow')
    pg.locator('.chip.sm', has_text='درخواست خرید').first.click()
    pg.wait_for_function("() => document.querySelectorAll('.orow').length === 3", timeout=6000)
    check('«درخواست خرید» chip filters to the 3 requests', True)

    # ---------- تأیید با کمبود موجودی ----------
    pg.locator('.orow', has_text='متقاضی-یک').click(); pg.wait_for_selector('[data-act=approve]')
    check('request card shows one OK and one short item', pg.locator('[data-rq=ok]').count() == 1 and pg.locator('[data-rq=short]').count() == 1)
    check('stock numbers shown (request / available)', 'موجودی: ۱' in pg.inner_text('[data-rq=short]') and 'درخواست: ۳' in pg.inner_text('[data-rq=short]'))
    check('generic status picker hidden while awaiting approval', pg.locator('h2', has_text='وضعیت سفارش').count() == 0)
    check('approve button warns about shortage', 'کمبود' in pg.inner_text('[data-act=approve]'))
    pg.click('[data-act=approve]')           # confirm dialog is auto-accepted
    toast(pg, 'درخواست تأیید شد')
    pg.wait_for_selector('text=منتظر پرداخت مشتری')
    s1 = peek(r1)
    check('approved: pending, stock reserved (4 and -2), expiry ≈ 24h', s1['status'] == 'pending' and s1['avail'] == [4, -2] and 23 * 3600 < s1['expires'] - time.time() < 25 * 3600, str(s1))
    check('customer got a note with the pay link', any(n['customer'] and 'order-pay' in n['c'] for n in s1['notes']))
    check('request card replaced by waiting state (no approve button)', pg.locator('[data-act=approve]').count() == 0)
    st, e = api(f'/wp-json/bazar/v1/orders/{r1}/approve', 'POST', {'force': True})
    check('second approve → 409 bazar_not_request', st == 409 and e['code'] == 'bazar_not_request', str(e))

    # ---------- تأیید معمولی با مهلت دلخواه ----------
    back(pg)
    pg.locator('.orow', has_text='متقاضی-دو').click(); pg.wait_for_selector('[data-act=approve]')
    check('all-OK request: plain approve label', 'تأیید و ارسال لینک پرداخت' in pg.inner_text('[data-act=approve]') and pg.locator('[data-rq=short]').count() == 0)
    pg.fill('input[aria-label="مهلت پرداخت (ساعت)"]', '48'); pg.fill('input[aria-label="پیام تأیید"]', 'ممنون از صبر شما')
    pg.click('[data-act=approve]'); toast(pg, 'درخواست تأیید شد'); pg.wait_for_selector('text=منتظر پرداخت مشتری')
    s2 = peek(r2)
    check('custom 48h window honoured, stock reserved (4, 7)', s2['status'] == 'pending' and s2['avail'] == [4, 7] and 47 * 3600 < s2['expires'] - time.time() < 49 * 3600, str(s2))
    check('approval message is included in the customer note', any(n['customer'] and 'ممنون از صبر شما' in n['c'] for n in s2['notes']))

    # ---------- رد ----------
    back(pg)
    pg.locator('.orow', has_text='متقاضی-سه').click(); pg.wait_for_selector('[data-act=reject]')
    pg.fill('input[aria-label="دلیل رد"]', 'محصول تا دو هفته‌ی دیگر می‌رسد')
    pg.click('[data-act=reject]'); toast(pg, 'درخواست رد شد')
    s3 = peek(r3)
    check('rejected: cancelled, nothing reserved, reason reaches the customer', s3['status'] == 'cancelled' and s3['avail'] == [5, 9] and any(n['customer'] and 'دو هفته' in n['c'] for n in s3['notes']), str(s3))

    # ---------- پایان: شمارنده و فهرست ----------
    back(pg)
    pg.wait_for_function("() => { const b = document.querySelector('[data-tab=orders] .tbadge'); return !!b && b.textContent.trim() === '۱'; }", timeout=8000)
    check('badge back to ۱ once every request is handled', pg.inner_text('[data-tab=orders] .tbadge').strip() == '۱')
    pg.screenshot(path='/tmp/shots/requests-list.png') if __import__('os').path.isdir('/tmp/shots') else None

    print('console/page errors:', errs or 'none'); check('no JS errors', not errs, str(errs))
    b.close()
print('\nALL PASSED' if not fails else f'\nFAILED: {fails}')
raise SystemExit(1 if fails else 0)
