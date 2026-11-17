"""تست سرتاسری استودیوی عکس داخل فرم محصول. اجرا: node tools/mock-server.mjs &  سپس  python3 tools/e2e-photo.py"""
import json, base64, random, urllib.request, io
from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright, expect
BASE = 'http://localhost:8787'; PASS = 'abcd efgh ijkl mnop qrst uvwx'; SH = '/tmp/shots'
fails, errs = [], []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(name)
def api(route):
    r = urllib.request.Request(BASE + '/wp-json' + route, headers={'Authorization': 'Basic ' + base64.b64encode(f'admin:{PASS}'.encode()).decode()})
    return json.load(urllib.request.urlopen(r))

# ---- عکس خام آزمایشی: دیوار با شیب نور و نویز + محصول قرمز عریض + سایه‌ی ملایم ----
random.seed(3)
W, H = 1600, 1200
im = Image.new('RGB', (W, H)); px = im.load()
for y in range(H):
    for x in range(W):
        v = 226 - int(20 * x / W) + random.randint(-3, 3); px[x, y] = (v, v - 3, v - 10)
sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).ellipse([380, 800, 1220, 900], fill=60); sh = sh.filter(ImageFilter.GaussianBlur(25))
im = Image.composite(Image.new('RGB', (W, H), (150, 148, 140)), im, sh.point(lambda p: int(p * 0.5)))
d = ImageDraw.Draw(im); d.rounded_rectangle([400, 350, 1200, 850], radius=70, fill=(190, 40, 50)); d.ellipse([480, 400, 800, 560], fill=(215, 80, 85))
im.save('/tmp/raw.jpg', quality=92)

def opaque_bbox(p):
    a = Image.open(p).convert('RGBA'); bb = a.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox(); return a, bb


# ---- عکس شلوغ: راه‌راه خاکستری/مشکی/سفید + میز سفید + برگ؛ محصول نارنجی با زبانه‌ی آویز (سوراخ واقعی) و نوشته‌ی مشکی ----
def make_busy(path):
    from PIL import Image, ImageDraw
    random.seed(9); W2, H2 = 1200, 1500
    im2 = Image.new('RGB', (W2, H2)); dd = ImageDraw.Draw(im2); x = 0
    while x < W2:
        dd.rectangle([x, 0, x + 70, H2], fill=(168, 168, 170)); dd.rectangle([x + 70, 0, x + 90, H2], fill=(18, 18, 20)); dd.rectangle([x + 90, 0, x + 100, H2], fill=(250, 250, 250)); x += 100
    dd.rectangle([0, 1150, W2, H2], fill=(240, 240, 240))
    for _ in range(14): cx, cy = random.randint(0, 260), random.randint(100, 900); dd.ellipse([cx - 40, cy - 90, cx + 40, cy + 90], fill=(60, 130, 50))
    dd.rectangle([420, 700, 820, 1250], fill=(230, 130, 40)); dd.rectangle([540, 650, 700, 710], fill=(230, 130, 40))
    dd.rectangle([575, 662, 665, 690], fill=(168, 168, 170)); dd.rectangle([600, 662, 612, 690], fill=(18, 18, 20))      # سوراخ واقعی زبانه: دیوار پشتش پیداست
    dd.rectangle([450, 1180, 800, 1215], fill=(25, 25, 25)); dd.ellipse([540, 880, 700, 1090], fill=(40, 170, 180))
    im2.save(path, quality=92)
make_busy('/tmp/busy.jpg')

STUB = """export async function removeBackground(blob, cfg) {
  cfg && cfg.progress && cfg.progress('compute:inference', 1, 2);
  const bmp = await createImageBitmap(blob); const c = new OffscreenCanvas(bmp.width, bmp.height); const x = c.getContext('2d');
  x.drawImage(bmp, 0, 0); x.clearRect(0, 0, bmp.width / 2, bmp.height);   // شبیه‌سازی: نیمه‌ی چپ حذف می‌شود
  return await c.convertToBlob({ type: 'image/png' });
}"""
ai_mode = {'fail': False}
def cdn(route):
    if ai_mode['fail']: return route.fulfill(status=404, body='nope')
    route.fulfill(status=200, headers={'content-type': 'text/javascript', 'access-control-allow-origin': '*'}, body=STUB)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, accept_downloads=True)   # CSP فعال
    ctx.route('https://cdn.jsdelivr.net/**', cdn)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'status of 404' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))

    pg.goto(BASE + '/app/'); pg.wait_for_selector('.connect')
    pg.fill('input[placeholder="https://sungold.ir"]', BASE); pg.fill('input[placeholder="admin"]', 'admin'); pg.fill('input[type=password]', PASS)
    pg.click('button[type=submit]'); pg.wait_for_selector('.apptabs'); pg.click('[data-tab=products]'); pg.wait_for_selector('.prow')
    pg.click('.phead .btn.primary'); pg.wait_for_selector('.seo-score')
    pg.fill('[aria-label="نام محصول"]', 'کیف چرمی دستی')
    check('raw-photo buttons present (main + gallery)', pg.locator('button:has-text("آماده‌سازی عکس خام")').count() == 1 and pg.locator('button:has-text("افزودن عکس خام")').count() == 1)

    # ---------- ۱) حذف ساده + پس‌زمینه سفید ----------
    pg.set_input_files('.imgf input[accept="image/*"]', '/tmp/raw.jpg')
    pg.wait_for_selector('.studio')
    check('default method is the box mode (draw a rectangle)', pg.get_attribute('[role=radiogroup][aria-label="روش حذف پس‌زمینه"] button.on', 'aria-checked') == 'true' and 'کادر' in pg.inner_text('.pv-i'))
    pg.click('[role=radiogroup][aria-label="روش حذف پس‌زمینه"] button:has-text("ساده")'); expect(pg.locator('.pv-i')).to_contain_text('پیکسل', timeout=15000)
    pg.screenshot(path=f'{SH}/s1-studio-white.png')
    txt = pg.inner_text('.studio')
    check('no stray "null"/"undefined" text in the studio', 'null' not in txt and 'undefined' not in txt, txt[:120])
    check('studio opens as modal dialog', pg.get_attribute('.studio', 'aria-modal') == 'true')
    check('default output: square 1200px WebP', '1200×1200' in pg.inner_text('.pv-i') and 'WEBP' in pg.inner_text('.pv-i'), pg.inner_text('.pv-i'))
    with pg.expect_download() as dl: pg.click('.studio-bar button:has-text("ذخیره در گوشی")')
    a, bb = opaque_bbox(dl.value.path()); f = Image.open(dl.value.path())
    check('saved file is a 1200x1200 WebP under 150KB', f.format == 'WEBP' and f.size == (1200, 1200) and __import__('os').path.getsize(dl.value.path()) < 150000, f'{f.format} {f.size}')
    rgb = Image.open(dl.value.path()).convert('RGB')
    check('new background is white (corners + wall removed)', all(min(rgb.getpixel(c)) >= 250 for c in [(5, 5), (1190, 5), (5, 1190), (1190, 1190), (60, 600)]), str([rgb.getpixel(c) for c in [(5, 5), (60, 600)]]))
    pr, pgc, pb = rgb.getpixel((600, 560)); check('product kept (red at centre)', pr > 150 and pgc < 90, str((pr, pgc, pb)))
    nonwhite = Image.eval(rgb.convert('L'), lambda v: 255 if v < 235 else 0).getbbox()
    mx = min(nonwhite[0], nonwhite[1], 1200 - nonwhite[2], 1200 - nonwhite[3])
    check('product centred with margin (padding ~8%)', 60 <= mx <= 200, str(nonwhite))

    # ---------- ۲) پس‌زمینه‌ی شفاف ----------
    pg.click('[role=radiogroup][aria-label="پس‌زمینه‌ی جدید"] button:has-text("شفاف")')
    expect(pg.locator('.pv.checker')).to_have_count(1)
    pg.wait_for_function if False else None
    pg.wait_for_timeout(700)
    with pg.expect_download() as dl2: pg.click('.studio-bar button:has-text("ذخیره در گوشی")')
    a2, bb2 = opaque_bbox(dl2.value.path())
    check('transparent output: alpha 0 in corners, 255 at centre', a2.getpixel((5, 5))[3] == 0 and a2.getpixel((600, 560))[3] == 255, str(a2.getpixel((5, 5))))
    pg.screenshot(path=f'{SH}/s2-studio-transparent.png')
    pg.click('[role=radiogroup][aria-label="پس‌زمینه‌ی جدید"] button:has-text("سفید")')

    # ---------- ۳) استفاده برای محصول (آپلود + alt خودکار) ----------
    pg.wait_for_timeout(600)
    pg.click('.studio-bar button:has-text("استفاده برای محصول")'); expect(pg.locator('.studio')).to_have_count(0, timeout=15000)
    pg.wait_for_selector('.thumb.big img')
    check('main image set + alt prefilled with product name', pg.input_value('[aria-label="متن جایگزین تصویر اصلی (alt)"]') == 'کیف چرمی دستی')
    pg.click('#pbar .btn.primary'); expect(pg.locator('#toast')).to_contain_text('ساخته شد', timeout=8000)
    new = next(x for x in api('/bazar/v1/products')['items'] if x['name'] == 'کیف چرمی دستی'); full = api(f"/bazar/v1/products/{new['id']}")
    check('saved product has the processed image + alt', full['image']['id'] > 0 and full['image']['alt'] == 'کیف چرمی دستی')
    img = urllib.request.urlopen(BASE + full['image']['url']).read(); fi = Image.open(io.BytesIO(img))
    check('uploaded media is the processed 1200x1200 WebP', fi.format == 'WEBP' and fi.size == (1200, 1200), f'{fi.format} {fi.size}')

    # ---------- ۴) حذف هوشمند (موتور شبیه‌سازی‌شده؛ پل ایزوله) ----------
    pg.set_input_files('.btnrow input[accept="image/*"]', '/tmp/raw.jpg'); pg.wait_for_selector('.studio')
    pg.click('[role=radiogroup][aria-label="روش حذف پس‌زمینه"] button:has-text("هوشمند")')
    pg.click('button:has-text("اجرای حذف هوشمند")')
    check('AI frame is sandboxed without same-origin', pg.get_attribute('iframe[src="studio-ai.html"]', 'sandbox') == 'allow-scripts')
    pg.wait_for_function if False else None
    expect(pg.locator('.pv-i')).to_contain_text('پیکسل', timeout=15000)
    pg.click('[role=radiogroup][aria-label="پس‌زمینه‌ی جدید"] button:has-text("شفاف")'); pg.wait_for_timeout(700)
    with pg.expect_download() as dl3: pg.click('.studio-bar button:has-text("ذخیره در گوشی")')
    a3, bb3 = opaque_bbox(dl3.value.path()); w3, h3 = bb3[2] - bb3[0], bb3[3] - bb3[1]
    check('AI result used (only right half of subject kept: w/h ≈ 0.8, simple would be ≈ 1.6)', 0.6 < w3 / h3 < 1.0, f'{w3}x{h3}')
    pg.screenshot(path=f'{SH}/s3-studio-ai.png')
    pg.click('.studio-bar button:has-text("استفاده برای محصول")'); expect(pg.locator('.studio')).to_have_count(0, timeout=15000)
    check('gallery tile added with alt', pg.locator('.gitem').count() == 1 and pg.input_value('.gitem .in') == 'کیف چرمی دستی')

    # ---------- ۵) خطای موتور هوشمند (صفحه‌ی تازه تا ماژول در حافظه نباشد) ----------
    pg.click('#pbar .btn.primary'); expect(pg.locator('#toast')).to_contain_text('ذخیره شد', timeout=8000)
    pg.reload(); pg.wait_for_selector('.apptabs'); ai_mode['fail'] = True
    pg.click('[data-tab=products]'); pg.wait_for_selector('.prow'); pg.click('.phead .btn.primary'); pg.wait_for_selector('.seo-score')
    pg.set_input_files('.imgf input[accept="image/*"]', '/tmp/raw.jpg'); pg.wait_for_selector('.studio')
    pg.click('[role=radiogroup][aria-label="روش حذف پس‌زمینه"] button:has-text("هوشمند")'); pg.click('button:has-text("اجرای حذف هوشمند")')
    expect(pg.locator('#toast')).to_contain_text('حذف هوشمند انجام نشد', timeout=20000)
    check('AI failure shows a friendly message and studio stays usable', pg.locator('.studio').count() == 1 and pg.locator('button:has-text("اجرای حذف هوشمند")').is_enabled())
    pg.click('[role=radiogroup][aria-label="روش حذف پس‌زمینه"] button:has-text("ساده")'); expect(pg.locator('.pv-i')).to_contain_text('پیکسل', timeout=10000)
    # ---------- ۶) تنظیمات ----------
    pg.click('[role=radiogroup][aria-label="نسبت تصویر"] button:has-text("عمودی")'); pg.click('[role=radiogroup][aria-label="اندازه‌ی خروجی (پیکسل)"] button:has-text("۸۰۰")')
    expect(pg.locator('.pv-i')).to_contain_text('640×800', timeout=10000)
    check('4:5 at 800px gives 640×800', '640×800' in pg.inner_text('.pv-i'), pg.inner_text('.pv-i'))
    over = pg.locator('.studio-b').evaluate('el => el.scrollWidth > el.clientWidth + 1') if False else False
    box = pg.locator('.pv').bounding_box(); check('mobile: preview fits viewport width', box['x'] >= 0 and box['x'] + box['width'] <= 391, str(box))
    pg.keyboard.press('Escape'); expect(pg.locator('.studio')).to_have_count(0)
    check('Escape closes the studio', True)
    # ---------- ۵.۵) حالت «با کادر» روی عکس شلوغ ----------
    pg.keyboard.press('Escape'); expect(pg.locator('.studio')).to_have_count(0)
    pg.set_input_files('.imgf input[accept="image/*"]', '/tmp/busy.jpg'); pg.wait_for_selector('.studio .pick:visible')
    bb = pg.locator('.pick').bounding_box(); sx = lambda x: bb['x'] + x / 1200 * bb['width']; sy = lambda y: bb['y'] + y / 1500 * bb['height']
    pg.screenshot(path=f'{SH}/s4-box-before.png')
    pg.mouse.move(sx(405), sy(635)); pg.mouse.down(); pg.mouse.move(sx(835), sy(1265), steps=10); pg.mouse.up()
    pg.screenshot(path=f'{SH}/s4-box-drawn.png')
    pg.click('button:has-text("اجرای برش")'); expect(pg.locator('.pv-i')).to_contain_text('پیکسل', timeout=30000)
    check('box mode: result shown, rectangle editor hidden', pg.locator('.pick').is_hidden() and pg.locator('button:has-text("کادر دیگر")').count() == 1)
    pg.locator('input[aria-label="سایه‌ی نرم زیر محصول"]').set_checked(False, force=True); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{SH}/s5-box-result.png')
    def save_and_read():
        with pg.expect_download() as d: pg.click('.studio-bar button:has-text("ذخیره در گوشی")')
        im = Image.open(d.value.path()).convert('RGB'); return im, __import__('numpy').array(im).astype(int)
    def wall(arr): return int(((abs(arr[..., 0] - 168) < 8) & (abs(arr[..., 1] - 168) < 8) & (abs(arr[..., 2] - 170) < 8)).sum())
    o4, arr = save_and_read(); nonwhite = Image.eval(o4.convert('L'), lambda v: 255 if v < 240 else 0).getbbox()
    bw, bh = nonwhite[2] - nonwhite[0], nonwhite[3] - nonwhite[1]
    check('box mode: product isolated (400x600 source → ≈ 672 wide in a 1200 square)', nonwhite and 650 <= bw <= 700, f'bbox={nonwhite}')
    mapx = lambda x: nonwhite[0] + (x - 420) / 400 * bw; mapy = lambda y: nonwhite[1] + (y - 650) / 600 * bh     # منبع: x 420..820, y 650..1250
    tx, ty = mapx(625), mapy(1197)
    check('box mode: dark text inside the product stays opaque', sum(o4.getpixel((int(tx) + d, int(ty)))[0] for d in (-8, 0, 8)) / 3 < 120, str(o4.getpixel((int(tx), int(ty)))))
    check('box mode: product colour intact (orange)', (lambda p: p[0] > 200 and 100 < p[1] < 160 and p[2] < 80)(o4.getpixel((int(mapx(450)), int(mapy(800))))))
    before = wall(arr)
    check('box mode: hang-tab hole shows the wall while filled (default)', before > 300, f'wall px={before}')
    def tap():
        pg.locator('.pv-cv:not(.pick)').scroll_into_view_if_needed(); cb = pg.locator('.pv-cv:not(.pick)').bounding_box()
        pg.mouse.click(cb['x'] + mapx(620) / 1200 * cb['width'], cb['y'] + mapy(676) / 1200 * cb['height'])
    tap(); pg.wait_for_timeout(1000)
    o5, arr5 = save_and_read(); after = wall(arr5)
    check('box mode: tapping the hole opens it (wall pixels mostly gone)', after < before * 0.4, f'{before} -> {after}')
    check('box mode: text still opaque after opening the hole', sum(o5.getpixel((int(tx) + d, int(ty)))[0] for d in (-8, 0, 8)) / 3 < 120)
    tap(); pg.wait_for_timeout(1000)
    o6, arr6 = save_and_read(); check('box mode: tapping again closes it', wall(arr6) > before / 2, str(wall(arr6)))
    pg.click('button:has-text("کادر دیگر")'); check('box mode: can go back to the rectangle editor', pg.locator('.pick').is_visible())
    pg.keyboard.press('Escape'); expect(pg.locator('.studio')).to_have_count(0)
    b.close()

print('\nJS errors:', errs or 'none')
print('\nALL CHECKS PASSED' if not fails and not errs else f'\nFAILED: {fails} {errs}')
raise SystemExit(1 if (fails or errs) else 0)
