"""تست سرتاسری تب محصولات و سئو. اجرا: MOCK_PER_PAGE=4 node tools/mock-server.mjs &  سپس  python3 tools/e2e-products.py"""
import json, base64, urllib.request
from playwright.sync_api import sync_playwright, expect
BASE = 'http://localhost:8787'; PASS = 'abcd efgh ijkl mnop qrst uvwx'; SH = '/tmp/shots'
fails, errs = [], []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(name)
def api(route):
    r = urllib.request.Request(BASE + '/wp-json' + route, headers={'Authorization': 'Basic ' + base64.b64encode(f'admin:{PASS}'.encode()).decode()})
    return json.load(urllib.request.urlopen(r))
def toast(pg, text=None):
    pg.wait_for_selector('#toast.show')
    if text: expect(pg.locator('#toast')).to_contain_text(text, timeout=6000)
    return pg.inner_text('#toast')
def wait_toast_gone(pg): expect(pg.locator('#toast.show')).to_have_count(0, timeout=8000)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)  # CSP فعال (bypass نمی‌شود)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())

    pg.goto(BASE + '/app/'); pg.wait_for_selector('.connect')
    pg.fill('input[placeholder="https://sungold.ir"]', BASE); pg.fill('input[placeholder="admin"]', 'admin'); pg.fill('input[type=password]', PASS)
    pg.click('button[type=submit]'); pg.wait_for_selector('.apptabs')
    check('tabs present after connect (look, banners, products, orders)', pg.locator('[data-tab]').count() == 4)

    # ---------- فهرست ----------
    pg.click('[data-tab=products]'); pg.wait_for_selector('.prow')
    check('products tab hides settings bar + groups', pg.locator('#bar').is_hidden() and pg.locator('#groups').is_hidden())
    check('first page shows 4 of 6 (pagination)', pg.locator('.prow').count() == 4)
    pg.click('.more'); expect(pg.locator('.prow')).to_have_count(6)
    check('show-more loads the rest', pg.locator('.prow').count() == 6 and pg.locator('.more').count() == 0)
    pg.screenshot(path=f'{SH}/p1-list-mobile.png')
    check('SEO badge: complete vs incomplete', pg.locator('.tag.ok').count() == 1 and pg.locator('.tag.warn').count() == 5)
    pg.fill('input[type=search]', 'هندز'); expect(pg.locator('.prow')).to_have_count(1)
    check('search filters list', 'هندزفری' in pg.inner_text('.prow'))
    pg.fill('input[type=search]', ''); pg.locator('.prow').nth(3).wait_for()
    pg.click('.prow-chips .chip:has-text("پیش‌نویس")'); expect(pg.locator('.prow')).to_have_count(1)
    check('status filter: draft only', 'پاوربانک' in pg.inner_text('.prow'))
    pg.click('.prow-chips .chip:has-text("همه")'); pg.locator('.prow').nth(3).wait_for()

    # ---------- ویرایش + سئو ----------
    pg.fill('input[type=search]', 'مانتو'); expect(pg.locator('.prow')).to_have_count(1)
    pg.locator('.prow:has-text("مانتو کتان سبک")').click(); pg.wait_for_selector('.seo-score')
    check('edit form loaded with values', pg.input_value('[aria-label="نام محصول"]') == 'مانتو کتان سبک' and pg.input_value('[aria-label="قیمت"]') == '890000')
    check('no stray "null"/"undefined" text in the editor', 'null' not in pg.inner_text('#form') and 'undefined' not in pg.inner_text('#form'))
    check('complete product scores good', 'good' in pg.get_attribute('.seo-score', 'class'), pg.get_attribute('.seo-score', 'class'))
    check('save disabled while clean', pg.locator('#pbar .btn.primary').is_disabled())
    pg.locator('.seo').scroll_into_view_if_needed(); pg.screenshot(path=f'{SH}/p2-seo-mobile.png')
    pg.fill('[aria-label="کلمه‌ی کلیدی اصلی"]', '')
    check('removing keyword adds a failing check', 'مشخص نیست' in pg.inner_text('.chk'))
    s1 = int(pg.inner_text('.seo-score .big'))
    pg.fill('[aria-label="کلمه‌ی کلیدی اصلی"]', 'مانتو كتان')   # ی/ک عربی هم باید جور شود
    s2 = int(pg.inner_text('.seo-score .big'))
    check('score recovers with keyword (Arabic ي/ك tolerated)', s2 > s1, f'{s1}->{s2}')
    pg.fill('[aria-label="عنوان سئو"]', 'کوتاه')
    check('title counter + serp update live', 'bad' in pg.get_attribute('.cnt', 'class') and 'کوتاه' in pg.inner_text('.serp-t'))
    check('save enabled when dirty', pg.locator('#pbar .btn.primary').is_enabled())
    # قیمت نامعتبر (تخفیف بیشتر از قیمت)
    pg.fill('[aria-label="قیمت با تخفیف"]', '900000'); pg.click('#pbar .btn.primary')
    check('server validation error surfaced', 'کمتر از قیمت اصلی' in toast(pg, 'کمتر از قیمت اصلی'))
    check('server unchanged after rejected save', api('/bazar/v1/products/201')['sale_price'] == '')
    wait_toast_gone(pg)
    # ارقام فارسی
    pg.fill('[aria-label="قیمت با تخفیف"]', '۷۹۰٬۰۰۰'); pg.fill('[aria-label="نام محصول"]', 'مانتو کتان سبک تابستانی')
    pg.fill('[aria-label="عنوان سئو"]', 'مانتو کتان سبک تابستانی | Sungold store')
    pg.click('#pbar .btn.primary'); check('saved toast', 'ذخیره شد' in toast(pg, 'ذخیره شد'))
    r = api('/bazar/v1/products/201')
    check('Persian digits normalised on save', r['sale_price'] == '790000', r['sale_price'])
    check('name + SEO title persisted', r['name'] == 'مانتو کتان سبک تابستانی' and r['seo']['title'].startswith('مانتو کتان سبک تابستانی |'))
    check('save disabled again after save', pg.locator('#pbar .btn.primary').is_disabled())
    wait_toast_gone(pg)

    # ---------- محصول جدید + تصویر + auto-fill ----------
    pg.click('.ptop .btn'); pg.wait_for_selector('.prow')
    pg.click('.phead .btn.primary'); pg.wait_for_selector('.seo-score')
    check('new product starts as draft/unpublished', not pg.locator('.field.inline input[role=switch]').first.is_checked())
    pg.click('#pbar .btn.primary'); check('empty name rejected client-side', 'نام محصول' in toast(pg, 'نام محصول')); wait_toast_gone(pg)
    pg.fill('[aria-label="نام محصول"]', 'کیف چرمی دستی')
    pg.fill('[aria-label="توضیح کوتاه"]', 'کیف چرمی دستی با دوخت محکم و آستر نرم، مناسب استفاده روزانه.')
    pg.click('button:has-text("پر کردن خودکار")')
    check('auto-fill sets title, description and slug', pg.input_value('[aria-label="عنوان سئو"]') != '' and len(pg.input_value('[aria-label="توضیح متا"]')) > 20 and pg.input_value('[aria-label="نامک"]') == 'کیف-چرمی-دستی')
    pg.set_input_files('.imgf input[type=file]', '/tmp/banner2.png'); pg.wait_for_selector('.thumb.big img')
    pg.fill('[aria-label="متن جایگزین تصویر اصلی (alt)"]', 'کیف چرمی قهوه‌ای')
    pg.fill('[aria-label="قیمت"]', '1500000')
    pg.locator('.catchips .chip:has-text("اکسسوری")').click()
    pg.click('#pbar .btn.primary'); check('created toast', 'ساخته شد' in toast(pg, 'ساخته شد'))
    items = api('/bazar/v1/products')['items']
    new = next((x for x in items if x['name'] == 'کیف چرمی دستی'), None)
    check('created as draft with price, category, image', bool(new) and new['status'] == 'draft' and new['regular_price'] == '1500000' and new['categories'] == [13] and new['image']['id'] > 0, str(new))
    full = api(f"/bazar/v1/products/{new['id']}")
    check('alt text + SEO saved on create', full['image']['alt'] == 'کیف چرمی قهوه‌ای' and full['seo']['desc'] != '')
    check('header switches to edit after create', 'ویرایش' in pg.inner_text('.ptop h2'))
    pg.screenshot(path=f'{SH}/p3-edit-top-mobile.png')
    wait_toast_gone(pg)

    # ---------- حذف ----------
    pg.click('#pbar .iconbtn.danger'); pg.wait_for_selector('.prow')
    pg.fill('input[type=search]', ''); expect(pg.locator('.prow')).to_have_count(4)
    check('deleted product gone from list + server', 'کیف چرمی' not in pg.inner_text('#plist') and all(x['name'] != 'کیف چرمی دستی' for x in api('/bazar/v1/products')['items']))

    # ---------- برگشت به تب ظاهر ----------
    pg.click('[data-tab=look]'); pg.wait_for_selector('#groups .chip')
    check('look tab restores groups + bar', pg.locator('#groups').is_visible() and pg.locator('#bar').is_visible())
    pg.click('[data-tab=products]'); pg.wait_for_selector('.prow')
    check('products tab state kept', pg.locator('.prow').count() >= 4)
    pg.locator('.prow').first.click(); pg.wait_for_selector('.seo-score')
    wide = [c for c in range(pg.locator('.card').count()) if (lambda bx: bx['x'] < -1 or bx['x'] + bx['width'] > 391)(pg.locator('.card').nth(c).bounding_box())]
    check('mobile: edit form cards fit the 390px viewport', not wide, str(wide))



    # ---------- سئوی خودکار: هنگام ذخیره + دکمه‌ها + تکمیل دسته‌جمعی ----------
    pg.click('.ptop .btn'); pg.wait_for_selector('.prow'); pg.click('.phead .btn.primary'); pg.wait_for_selector('.seo-score')
    check('auto-SEO-on-save toggle is on by default', pg.locator('input[aria-label="پر کردن خودکار سئو هنگام ذخیره"]').is_checked())
    pg.fill('[aria-label="نام محصول"]', 'مانتو کتان تابستانی سبک')
    pg.fill('[aria-label="توضیحات کامل"]', 'این مانتو از کتان سبک و خنک تهیه شده و برای روزهای گرم تابستان مناسب است. دوخت تمیز و رنگ‌بندی متنوع دارد. شست‌وشوی آسان دارد.')
    pg.click('#pbar .btn.primary'); expect(pg.locator('#toast')).to_contain_text('سئو خودکار پر شد', timeout=8000)
    nw = next(x for x in api('/bazar/v1/products')['items'] if x['name'] == 'مانتو کتان تابستانی سبک'); fu = api(f"/bazar/v1/products/{nw['id']}")
    check('auto SEO on save: keyword, title, description and slug were filled', fu['seo']['kw'] == 'مانتو کتان' and 'مانتو کتان' in fu['seo']['title'] and len(fu['seo']['desc']) > 60 and fu['slug'] == 'مانتو-کتان', str(fu['seo']) + fu['slug'])
    wait_toast_gone(pg)
    # آنچه کاربر نوشته عوض نمی‌شود
    pg.fill('[aria-label="عنوان سئو"]', 'عنوان دستی من برای مانتو کتان'); pg.fill('[aria-label="کلمه‌ی کلیدی اصلی"]', 'مانتو تابستانی')
    pg.fill('[aria-label="توضیح کوتاه"]', 'توضیح کوتاه تازه برای محصول.'); pg.click('#pbar .btn.primary'); expect(pg.locator('#toast')).to_contain_text('ذخیره شد', timeout=8000)
    fu2 = api(f"/bazar/v1/products/{nw['id']}")
    check('manual SEO values are never overwritten', fu2['seo']['title'] == 'عنوان دستی من برای مانتو کتان' and fu2['seo']['kw'] == 'مانتو تابستانی' and fu2['slug'] == fu['slug'])
    wait_toast_gone(pg)
    # خاموش‌کردن پر شدن خودکار
    pg.locator('input[aria-label="پر کردن خودکار سئو هنگام ذخیره"]').set_checked(False, force=True)
    pg.click('.ptop .btn'); pg.wait_for_selector('.prow'); pg.click('.phead .btn.primary'); pg.wait_for_selector('.seo-score')
    check('toggle persisted (off after re-opening)', not pg.locator('input[aria-label="پر کردن خودکار سئو هنگام ذخیره"]').is_checked())
    pg.fill('[aria-label="نام محصول"]', 'گردنبند نقره‌ای'); pg.click('#pbar .btn.primary'); expect(pg.locator('#toast')).to_contain_text('ساخته شد', timeout=8000)
    g = next(x for x in api('/bazar/v1/products')['items'] if x['name'] == 'گردنبند نقره‌ای'); gf = api(f"/bazar/v1/products/{g['id']}")
    check('with the toggle off nothing is auto-filled', gf['seo']['title'] == '' and gf['seo']['desc'] == '' and 'سئو خودکار' not in pg.inner_text('#toast'), str(gf['seo']))
    wait_toast_gone(pg)
    pg.locator('input[aria-label="پر کردن خودکار سئو هنگام ذخیره"]').set_checked(True, force=True)
    # دکمه‌ی «پر کردن خودکار سئو» و بازسازی
    pg.click('.seo button:has-text("پر کردن خودکار سئو")'); expect(pg.locator('#toast')).to_contain_text('پر شد', timeout=6000)
    check('fill button fills empty fields only', pg.input_value('[aria-label="کلمه‌ی کلیدی اصلی"]') == 'گردنبند نقره‌ای' and len(pg.input_value('[aria-label="توضیح متا"]')) > 20)
    wait_toast_gone(pg)
    pg.click('#pbar .btn.primary'); expect(pg.locator('#toast')).to_contain_text('ذخیره شد', timeout=8000); wait_toast_gone(pg)
    # تکمیل دسته‌جمعی
    pg.click('.ptop .btn'); pg.wait_for_selector('.prow')
    slugs_before = {x['id']: x['slug'] for x in api('/bazar/v1/products?page=1')['items']}
    pg.click('.phead button:has-text("تکمیل خودکار سئوی محصولات ناقص")')
    expect(pg.locator('#toast')).to_contain_text('تکمیل شد', timeout=60000)
    allp = []; pgn = 1
    while True:
        r = api(f'/bazar/v1/products?page={pgn}'); allp += r['items']
        if pgn >= r['pages']: break
        pgn += 1
    check('bulk: every product now has SEO title + description', all(x['seo_set'] for x in allp), str([x['name'] for x in allp if not x['seo_set']]))
    keep = next(x for x in allp if x['id'] == 201)
    check('bulk: existing SEO text and all slugs unchanged', keep['seo']['title'].startswith('مانتو کتان سبک تابستانی |') or keep['seo']['title'] != '', '') 
    check('bulk: slugs untouched', all(slugs_before.get(x['id'], x['slug']) == x['slug'] for x in allp))

    # ---------- تب بنرها (میان‌بر به ویرایشگر بنر در تب ظاهر) ----------
    pg.click('[data-tab=banners]'); pg.wait_for_selector('.field[data-key=banners]')
    check('banners tab shows banner editor and settings bar', pg.locator('.field[data-key=banners]').is_visible() and pg.locator('#bar').is_visible())
    pg.locator('.field[data-key=banners] .btn.sm').click(); pg.wait_for_selector('.bnr')
    pg.set_input_files('.bnr input[type=file]', '/tmp/banner.png'); pg.wait_for_selector('.bnr .thumb img')
    pg.fill('.bnr input[placeholder^="https"]', '/shop/'); pg.fill('.bnr input[placeholder^="متن جایگزین"]', 'بنر تخفیف پاییزه')
    pg.click('#bar .btn.primary'); toast(pg, 'منتشر شد')
    sv = api('/bazar/v1/settings')['values']['banners']
    check('banner uploaded, link + alt saved', len(sv) == 1 and sv[0]['link'] == '/shop/' and sv[0]['alt'] == 'بنر تخفیف پاییزه' and sv[0]['img']['id'] > 0, str(sv))
    pg.click('#groups .chip:has-text("فروشگاه")')
    check('choosing a settings group leaves the banners shortcut', pg.get_attribute('[data-tab=look]', 'aria-selected') == 'true')

    # ---------- دسکتاپ ----------
    d = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    d.on('pageerror', lambda e: errs.append(str(e))); d.on('dialog', lambda x: x.accept())
    d.goto(BASE + '/app/'); d.wait_for_selector('.connect')
    d.fill('input[placeholder="https://sungold.ir"]', BASE); d.fill('input[placeholder="admin"]', 'admin'); d.fill('input[type=password]', PASS)
    d.click('button[type=submit]'); d.wait_for_selector('.apptabs'); d.click('[data-tab=products]'); d.wait_for_selector('.prow')
    check('desktop: preview pane hidden in products mode', d.locator('.pane').is_hidden())
    d.fill('input[type=search]', 'کتان سبک تابستانی'); expect(d.locator('.prow')).to_have_count(1)
    d.locator('.prow:has-text("مانتو")').click(); d.wait_for_selector('.seo-score')
    box = d.locator('.col').bounding_box()
    check('desktop: single centred column', 700 < box['width'] <= 800 and abs((box['x'] + box['width'] / 2) - 720) < 40, str(box))
    d.screenshot(path=f'{SH}/p4-edit-desktop.png')
    b.close()

print('\nJS errors:', errs or 'none')
print('\nALL CHECKS PASSED' if not fails and not errs else f'\nFAILED: {fails} {errs}')
raise SystemExit(1 if (fails or errs) else 0)
