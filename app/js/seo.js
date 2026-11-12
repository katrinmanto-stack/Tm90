// تحلیل سئوی محصول. بدون وابستگی به DOM تا در Node هم تست شود (tools/test-seo.mjs).

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹', AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** یکسان‌سازی متن فارسی برای مقایسه: ی/ک عربی، اعراب، نیم‌فاصله، ارقام، حروف کوچک. */
export function norm(s) {
  return String(s ?? '')
    .replace(/[\u064A\u0649]/g, 'ی').replace(/\u0643/g, 'ک')
    .replace(/[\u064B-\u065F\u0640\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e\u00a0]/g, ' ')
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
export const stripHtml = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export const len = (s) => [...String(s ?? '')].length;
export const words = (s) => { const t = stripHtml(s); return t ? t.split(/\s+/).length : 0; };
const has = (hay, needle) => needle !== '' && norm(hay).includes(norm(needle));
const slugText = (slug) => { let s = String(slug ?? ''); try { s = decodeURIComponent(s); } catch { /* همان */ } return s.replace(/[-_]+/g, ' '); };

/** کوتاه‌کردن در مرز کلمه با … */
export function clip(s, max) {
  const t = String(s ?? '').trim();
  if (len(t) <= max) return t;
  const cut = [...t].slice(0, max - 1).join('');
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim() + '…';
}

/** پیشنهاد خودکار عنوان و توضیح متا (بدون هوش مصنوعی؛ فقط از داده‌ی خود محصول). */
export function suggest(p, siteName = '') {
  const name = String(p.name || '').trim();
  const title = name ? clip(len(name) <= 45 && siteName ? `${name} | ${siteName}` : name, 60) : '';
  const base = stripHtml(p.short_description) || stripHtml(p.description);
  const desc = base ? clip(base, 155) : (name ? clip(`خرید آنلاین ${name}${siteName ? ' از ' + siteName : ''}`, 155) : '');
  return { title, desc };
}

const LV = { ok: 1, warn: 0.5, bad: 0 };

/**
 * p: { name, slug, short_description, description, image:{id,alt}, gallery:[{id,alt}], seo:{title,desc,kw,noindex} }
 * خروجی: { score: 0..100, grade: 'good'|'mid'|'bad', items:[{id, level, title, hint}] }
 */
export function analyze(p, { siteName = '', editable = true } = {}) {
  const seo = p.seo || {};
  const items = [];
  const add = (id, level, title, hint) => items.push({ id, level, title, hint });

  const tl = len(seo.title), dl = len(seo.desc);
  const effTitle = seo.title || p.name || '';
  const effDesc = seo.desc || stripHtml(p.short_description) || '';

  if (editable) {
    if (!seo.title) add('title', 'warn', 'عنوان سئو خالی است', 'گوگل از نام محصول استفاده می‌کند. با «پر کردن خودکار» یک عنوان پیشنهادی بگذارید.');
    else if (tl >= 30 && tl <= 60) add('title', 'ok', 'طول عنوان سئو مناسب است', `${tl} کاراکتر (ایده‌آل ۳۰ تا ۶۰)`);
    else if ((tl >= 15 && tl < 30) || (tl > 60 && tl <= 70)) add('title', 'warn', tl < 30 ? 'عنوان سئو کمی کوتاه است' : 'عنوان سئو کمی بلند است', `${tl} کاراکتر؛ ایده‌آل ۳۰ تا ۶۰`);
    else add('title', 'bad', tl < 15 ? 'عنوان سئو خیلی کوتاه است' : 'عنوان سئو خیلی بلند است و در گوگل بریده می‌شود', `${tl} کاراکتر؛ ایده‌آل ۳۰ تا ۶۰`);

    if (!seo.desc) add('desc', 'bad', 'توضیح متا خالی است', 'بدون توضیح متا، گوگل خودش بخشی تصادفی از صفحه را نشان می‌دهد.');
    else if (dl >= 120 && dl <= 160) add('desc', 'ok', 'طول توضیح متا مناسب است', `${dl} کاراکتر (ایده‌آل ۱۲۰ تا ۱۶۰)`);
    else if ((dl >= 70 && dl < 120) || (dl > 160 && dl <= 200)) add('desc', 'warn', dl < 120 ? 'توضیح متا کمی کوتاه است' : 'توضیح متا کمی بلند است', `${dl} کاراکتر؛ ایده‌آل ۱۲۰ تا ۱۶۰`);
    else add('desc', 'bad', dl < 70 ? 'توضیح متا خیلی کوتاه است' : 'توضیح متا خیلی بلند است و بریده می‌شود', `${dl} کاراکتر؛ ایده‌آل ۱۲۰ تا ۱۶۰`);
  }

  const kw = String(seo.kw || '').trim();
  if (editable) {
    if (!kw) add('kw', 'bad', 'کلمه‌ی کلیدی اصلی مشخص نیست', 'عبارتی که مشتری در گوگل می‌زند؛ مثلاً «مانتو کتان تابستانی».');
    else add('kw', 'ok', 'کلمه‌ی کلیدی مشخص است', kw);
  }
  if (kw) {
    add('kw_title', has(effTitle, kw) ? 'ok' : 'bad', has(effTitle, kw) ? 'کلمه‌ی کلیدی در عنوان هست' : 'کلمه‌ی کلیدی در عنوان نیست', 'بهتر است کلمه‌ی کلیدی در ابتدای عنوان بیاید.');
    add('kw_desc', has(effDesc, kw) ? 'ok' : 'warn', has(effDesc, kw) ? 'کلمه‌ی کلیدی در توضیح متا هست' : 'کلمه‌ی کلیدی در توضیح متا نیست', 'گوگل عبارت جست‌وجو را در توضیح پررنگ می‌کند.');
    add('kw_slug', has(slugText(p.slug), kw) ? 'ok' : 'warn', has(slugText(p.slug), kw) ? 'کلمه‌ی کلیدی در نشانی (نامک) هست' : 'کلمه‌ی کلیدی در نشانی (نامک) نیست', 'نامک کوتاه و شامل کلمه‌ی کلیدی بگذارید.');
    const intro = stripHtml(p.description).split(/\s+/).slice(0, 150).join(' ');
    add('kw_intro', has(intro, kw) ? 'ok' : 'warn', has(intro, kw) ? 'کلمه‌ی کلیدی در ابتدای توضیحات هست' : 'کلمه‌ی کلیدی در ۱۵۰ کلمه‌ی اول توضیحات نیست', 'یک بار در پاراگراف اول بیاورید.');
  }

  const wc = words(p.description);
  if (wc >= 150) add('content', 'ok', 'توضیحات محصول کافی است', `${wc} کلمه`);
  else if (wc >= 60) add('content', 'warn', 'توضیحات محصول کمی کوتاه است', `${wc} کلمه؛ حداقل ۱۵۰ کلمه توصیه می‌شود.`);
  else add('content', 'bad', 'توضیحات محصول خیلی کم است', `${wc} کلمه؛ مشخصات، جنس، اندازه و کاربرد را بنویسید (حداقل ۱۵۰ کلمه).`);

  const short = stripHtml(p.short_description);
  add('short', len(short) >= 20 ? 'ok' : 'warn', len(short) >= 20 ? 'توضیح کوتاه دارد' : 'توضیح کوتاه خالی یا خیلی کوتاه است', 'در صفحه‌ی محصول بالای دکمه‌ی خرید دیده می‌شود.');

  const img = p.image && p.image.id;
  add('image', img ? 'ok' : 'bad', img ? 'تصویر اصلی دارد' : 'تصویر اصلی ندارد', 'محصول بدون عکس کمتر کلیک و خرید می‌گیرد.');
  const all = [p.image, ...(p.gallery || [])].filter((x) => x && x.id);
  const missing = all.filter((x) => !String(x.alt || '').trim()).length;
  if (all.length) {
    if (!missing) add('alt', 'ok', 'همه‌ی تصاویر متن جایگزین (alt) دارند', '');
    else if (p.image && p.image.id && !String(p.image.alt || '').trim()) add('alt', 'bad', 'تصویر اصلی متن جایگزین (alt) ندارد', 'برای سئوی تصاویر و دسترسی‌پذیری لازم است.');
    else add('alt', 'warn', `${missing} تصویر متن جایگزین (alt) ندارد`, 'برای هر تصویر یک توضیح کوتاه بنویسید.');
  }

  if (seo.noindex) add('noindex', 'bad', 'این محصول «noindex» است', 'در نتایج گوگل نشان داده نمی‌شود.');

  const total = items.length || 1;
  const sum = items.reduce((a, i) => a + LV[i.level], 0);
  const score = Math.round((sum / total) * 100);
  return { score, grade: score >= 80 ? 'good' : score >= 50 ? 'mid' : 'bad', items };
}

export const gradeLabel = { good: 'سئوی خوب', mid: 'سئوی متوسط', bad: 'سئوی ضعیف' };
