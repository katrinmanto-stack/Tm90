"""تست سرتاسری اپ روی سرور آزمایشی. اجرا: node tools/mock-server.mjs &  سپس  python3 tools/e2e.py"""
import json, sys, urllib.request, base64
from playwright.sync_api import sync_playwright
BASE='http://localhost:8787'; PASS='abcd efgh ijkl mnop qrst uvwx'; SH='/tmp/shots'
fails=[]; errs=[]
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ')+name+(f'  [{extra}]' if extra and not cond else '')); 
    if not cond: fails.append(name)
def api(route):
    r=urllib.request.Request(BASE+'/wp-json'+route, headers={'Authorization':'Basic '+base64.b64encode(f'admin:{PASS}'.encode()).decode()})
    return json.load(urllib.request.urlopen(r))
def pframe(pg): return next(f for f in pg.frames if 'bazar_preview' in f.url)
def wait_preview(pg, changed=True):
    """منتظر می‌ماند تا پیش‌نمایش بعد از تغییر اخیر دوباره ساخته و بارگذاری شود."""
    pg.wait_for_function("document.querySelector('#pvframe') && document.querySelector('#pvframe').src.includes('bazar_preview')")
    if changed:
        prev = pg.get_attribute('#pvframe','src')
        try: pg.wait_for_function("p => document.querySelector('#pvframe').src !== p", arg=prev, timeout=6000)
        except Exception: pass
    pg.wait_for_function("!document.querySelector('.pv-state.show')", timeout=8000)
    pg.wait_for_timeout(500)

with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------------- Desktop ----------------
    ctx=b.new_context(viewport={'width':1440,'height':900}, bypass_csp=True); pg=ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE+'/app/'); pg.wait_for_selector('.connect')
    pg.screenshot(path=f'{SH}/01-connect-desktop.png')
    # wrong password
    pg.fill('input[autocomplete=url]',BASE); pg.fill('input[autocomplete=username]','admin'); pg.fill('input[type=password]','wrong pass')
    pg.click('button[type=submit]'); pg.wait_for_selector('.msg.bad:not([hidden])')
    check('wrong password shows error', 'رمز' in pg.inner_text('.msg.bad'))
    # correct
    pg.fill('input[type=password]',PASS); pg.click('button[type=submit]'); pg.wait_for_selector('#form .card')
    check('connected -> settings form rendered', pg.locator('#form .field').count()>=3)
    check('group chips from schema', pg.locator('.chip').count()==5, str(pg.locator('.chip').count()))
    wait_preview(pg)
    check('live preview iframe loaded with token', 'bazar_preview=' in pg.get_attribute('#pvframe','src'))
    pg.screenshot(path=f'{SH}/02-main-brand-desktop.png')

    # ---- colours: preset -> preview reflects derived palette
    pg.click('.chip:has-text("رنگ و ظاهر")'); pg.wait_for_selector('.preset')
    pg.click('.preset:has-text("جنگلی و شنی")'); wait_preview(pg)
    brand=pframe(pg).evaluate("getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()")
    check('preview applied preset brand colour', brand=='#1f4d3a', brand)
    check('unsaved counter shows 4 changes', '۴' in pg.inner_text('.bar-s') or '4' in pg.inner_text('.bar-s'), pg.inner_text('.bar-s'))
    check('server NOT changed before save', api('/bazar/v1/settings')['values']['color_brand']=='#232c6e')
    pg.screenshot(path=f'{SH}/03-colors-preset-desktop.png')

    # too-light brand -> hint + auto-darken on save
    pg.fill('.field[data-key=color_brand] .hex','#ffe08a'); pg.wait_for_timeout(200)
    check('low-contrast hint shown', 'تیره‌تر' in pg.inner_text('.field[data-key=color_brand] .hint'))
    pg.fill('.field[data-key=color_brand] .hex','#1f4d3a')
    pg.click('.bar .btn.primary'); pg.wait_for_selector('#toast.show')
    pg.wait_for_function("!document.querySelector('.bar').classList.contains('dirty')")
    s=api('/bazar/v1/settings')['values']
    check('saved to server', s['color_brand']=='#1f4d3a' and s['color_accent']=='#e3c07a', str(s['color_brand']))
    check('bar shows saved state', 'ذخیره و منتشر است' in pg.inner_text('.bar-s'))

    # ---- home: texts, hero style, order/toggle
    pg.click('.chip:has-text("صفحه اصلی")'); pg.wait_for_selector('.li.sec')
    pg.fill('.field[data-key=hero_title] input','کلکسیون پاییز Sungold')
    pg.click('.field[data-key=hero_style] .seg button:has-text("رنگ تأکید")')
    first=pg.locator('.li.sec .li-n').first.inner_text()
    pg.locator('.li.sec').nth(0).locator('button[aria-label="پایین"]').click()
    pg.locator('.li.sec').nth(4).locator('.switch').click()   # turn benefits off
    wait_preview(pg)
    f=pframe(pg)
    check('preview shows new hero title', 'کلکسیون پاییز' in f.inner_text('.hero-fb h2'))
    check('preview hero gold style', f.locator('.hero-main.is-gold').count()==1)
    check('benefits section hidden in preview', f.locator('.feat').count()==0)
    pg.screenshot(path=f'{SH}/04-home-gold-hero-desktop.png')
    pg.click('.bar .btn.primary'); pg.wait_for_function("!document.querySelector('.bar').classList.contains('dirty')")
    s=api('/bazar/v1/settings')['values']
    check('order + toggle persisted', s['home_sections'][1]['id']=='categories' and s['home_sections'][4]['on']==False, json.dumps(s['home_sections'])[:120])
    check('hero title persisted', s['hero_title']=='کلکسیون پاییز Sungold')

    # ---- logo upload
    pg.click('.chip:has-text("هویت فروشگاه")'); pg.wait_for_selector('.imgf')
    pg.set_input_files('.field[data-key=logo] input[type=file]','/tmp/logo.png'); pg.wait_for_selector('.field[data-key=logo] .thumb img')
    wait_preview(pg); pg.wait_for_timeout(500)
    check('logo shown in preview header', pframe(pg).locator('.hd .logo img').count()==1)
    pg.fill('.field[data-key=site_title] input','Sungold Store ✨'); pg.click('.bar .btn.primary'); pg.wait_for_function("!document.querySelector('.bar').classList.contains('dirty')")
    s=api('/bazar/v1/settings')['values']
    check('logo + title saved', s['logo']['id']>0 and s['site_title']=='Sungold Store ✨')
    pg.screenshot(path=f'{SH}/05-brand-logo-desktop.png')

    # ---- reset via settings sheet
    pg.click('.appbar .iconbtn'); pg.wait_for_selector('.sheet')
    pg.screenshot(path=f'{SH}/06-sheet-desktop.png')
    pg.once('dialog', lambda d: d.accept()); pg.click('.sheet .btn.danger'); pg.wait_for_selector('#toast.ok')
    s=api('/bazar/v1/settings')['values']
    check('reset restores defaults (keeps name/logo)', s['color_brand']=='#232c6e' and s['hero_title']=='استایل خودت را پیدا کن' and s['logo']['id']>0)
    ctx.close()


    # ---------------- CSP: سیاست امنیتی اپ بدون دور زدن اعمال شود ----------------
    ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page()
    pg.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")
    pg.goto(BASE+'/app/'); pg.wait_for_selector('.connect')
    pg.fill('input[autocomplete=url]',BASE); pg.fill('input[autocomplete=username]','admin'); pg.fill('input[type=password]',PASS); pg.click('button[type=submit]')
    pg.wait_for_selector('#form .card'); pg.click('.chip:has-text("رنگ و ظاهر")'); pg.wait_for_selector('.preset'); pg.click('.preset:has-text("مشکی و طلایی")')
    pg.wait_for_timeout(2500)
    v=pg.evaluate("window.__csp")
    check('CSP enforced with zero violations in the app', v==[], str(v))
    check('preview iframe still allowed under CSP', 'bazar_preview' in pg.get_attribute('#pvframe','src'))
    ctx.close()

    # ---------------- Mobile ----------------
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, bypass_csp=True); pg=ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE+'/app/'); pg.wait_for_selector('.connect'); pg.screenshot(path=f'{SH}/10-connect-mobile.png')
    pg.fill('input[autocomplete=url]',BASE); pg.fill('input[autocomplete=username]','admin'); pg.fill('input[type=password]',PASS); pg.click('button[type=submit]')
    pg.wait_for_selector('#form .card'); pg.screenshot(path=f'{SH}/11-main-mobile.png')
    check('mobile: preview pane hidden by default', not pg.locator('#pane').is_visible())
    pg.click('.chip:has-text("رنگ و ظاهر")'); pg.click('.preset:has-text("عنابی و رزگلد")')
    pg.screenshot(path=f'{SH}/12-colors-mobile.png', full_page=False)
    pg.click('.bar .btn:has-text("پیش‌نمایش")'); wait_preview(pg); pg.wait_for_timeout(500)
    check('mobile: preview sheet opens', pg.locator('#pane').is_visible())
    pg.screenshot(path=f'{SH}/13-preview-mobile.png')
    pg.click('#pane .only-narrow'); check('mobile: preview sheet closes', not pg.locator('#pane').is_visible())
    ov=pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    check('mobile: no horizontal overflow', ov==0, str(ov))
    # session persists across reload
    pg.reload(); pg.wait_for_selector('#form .card'); check('session persisted after reload', True)
    ctx.close(); b.close()

print('\nJS errors:', errs or 'none')
print('FAILED:', fails) if fails else print('\nALL CHECKS PASSED')
sys.exit(1 if fails or errs else 0)
