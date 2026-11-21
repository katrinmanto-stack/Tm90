// تحلیل و ساخت سئوی محصول منطبق با معیارهای Rank Math (tools/test-seo.mjs).

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹', AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function norm(s) {
  return String(s ?? '')
    .replace(/[\u064A\u0649]/g, 'ی').replace(/\u0643/g, 'ک')
    .replace(/[\u064B-\u065F\u0640\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e\u00a0]/g, ' ')
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export const stripHtml = (s) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export const len = (s) => [...String(s ?? '')].length;
export const words = (s) => {
  const t = stripHtml(s);
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
};

const has = (hay, needle) => needle !== '' && norm(hay).includes(norm(needle));

const countOccurrences = (hay, needle) => {
  const nHay = norm(hay);
  const nNeedle = norm(needle);
  if (!nHay || !nNeedle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = nHay.indexOf(nNeedle, pos)) !== -1) {
    count++;
    pos += nNeedle.length;
  }
  return count;
};

const slugText = (slug) => {
  let s = String(slug ?? '');
  try { s = decodeURIComponent(s); } catch { /* همان */ }
  return s.replace(/[-_]+/g, ' ');
};

export function clip(s, max) {
  const t = String(s ?? '').trim();
  if (len(t) <= max) return t;
  const cut = [...t].slice(0, max - 1).join('');
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim() + '…';
}

const FILLER = new Set(['و', 'با', 'برای', 'از', 'در', 'به', 'را', 'که', 'این', 'آن', 'یک']);
const STOP_AT = new Set(['مدل', 'سری', 'کد', 'طرح']);

export function extractKeyword(name) {
  const head = [];
  for (const t of String(name ?? '').replace(/[()،,:;|«»"“”]/g, ' ').split(/\s+/).filter(Boolean)) {
    if (FILLER.has(t)) continue;
    if (head.length && (STOP_AT.has(t) || /[0-9۰-۹٠-٩]/.test(t))) break;
    head.push(t);
  }
  let kw = head.slice(0, head.length <= 3 ? 3 : 2).join(' ').trim();
  if (len(kw) > 40) kw = head.slice(0, 2).join(' ');
  return kw;
}

const slugOf = (kw) =>
  String(kw || '')
    .toLowerCase()
    .replace(/\u200c/g, '-')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]+/gu, ''))
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const sentences = (t) =>
  stripHtml(t)
    .replace(/([.!؟?۔])\s+/g, '$1\n')
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => len(x) >= 8);

const extractHeadingsText = (html) => {
  const matches = [...String(html ?? '').matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi)];
  return matches.map((m) => stripHtml(m[1])).join(' ');
};

function buildVariedParagraphs(name, kw, category) {
  const subject = kw || name;
  const catLabel = category || 'محصولات مرتبط';
  return [
    `<p>در این بخش بررسی می‌کنیم که <strong>${subject}</strong> چه ویژگی‌هایی دارد و چطور می‌تواند در کاربری روزمره به شما کمک کند.</p>`,
    `<p>طراحی و ساختار بدنه این محصول به گونه‌ای در نظر گرفته شده که در استفاده مداوم دوام قابل قبولی ارائه دهد و کنترل آن ساده باشد.</p>`,
    `<p>اگر به دنبال گزینه‌ای کاربردی در دسته ${catLabel} هستید، توجه به جزئیات فنی و نحوه استفاده واقعی پیش از ثبت سفارش اهمیت زیادی دارد.</p>`,
    `<p>تنظیم دقیق زاویه، رعایت نکات نگهداری و استفاده اصولی از امکانات دستگاه باعث می‌شود در طولانی‌مدت نتیجه پایدارتری بگیرید.</p>`,
    `<p>هنگام مقایسه گزینه‌های مختلف بازار، هماهنگی محصول با نیاز واقعی شما و سهولت حمل‌ونقل آن از معیارهای اصلی انتخاب محسوب می‌شود.</p>`,
    `<p>نگهداری صحیح پس از پایان کار، تمیز نگه داشتن بخش‌های متحرک و پرهیز از فشارهای غیرمعمول عمر مفید ${name} را افزایش می‌دهد.</p>`,
  ];
}

/**
 * ساخت سئوی منطبق با چک‌لیست Rank Math
 */
export function autoSeo(p, opts = {}) {
  const {
    siteName = '',
    category = '',
    minWords = 600,
    maxSlugLen = 50,
    internalUrl = '/shop',
    externalUrl = '',
  } = opts;

  const name = String(p.name || '').trim();
  const site = String(siteName || '').trim();
  const kw = String(p.kw || '').trim() || extractKeyword(name);
  const alts = {
    main: kw ? `${kw} - ${name}` : name,
    gallery: (i) => (kw ? `${kw} ${name} - تصویر ${i + 2}` : `${name} - تصویر ${i + 2}`),
  };

  if (!name) {
    return { kw: '', title: '', desc: '', slug: '', description: '', alts };
  }

  const titleCandidates = [
    site ? `${kw || name} | خرید ${name} | ${site}` : `${kw || name} | خرید ${name}`,
    site ? `${kw || name} - ${name} | ${site}` : `${kw || name} - ${name}`,
    `${kw || name} | ${name}`,
    kw ? clip(`${kw} - ${name}`, 60) : clip(name, 60),
  ];
  let title =
    titleCandidates.find((c) => len(c) >= 30 && len(c) <= 60 && (!kw || has(c, kw))) ||
    titleCandidates.filter((c) => len(c) <= 60).sort((a, b) => len(b) - len(a))[0] ||
    clip(kw ? `${kw} ${name}` : name, 60);

  let slug = slugOf(kw || name);
  if (len(slug) > maxSlugLen) {
    slug = slug.slice(0, maxSlugLen).replace(/-+$/g, '');
  }

  let desc = '';
  for (const sn of [...sentences(p.short_description), ...sentences(p.description)]) {
    const next = desc ? `${desc} ${sn}` : sn;
    if (len(next) > 155) {
      if (!desc) desc = clip(sn, 155);
      break;
    }
    desc = next;
    if (len(desc) >= 120) break;
  }
  if (!desc) {
    desc = category
      ? `${kw || name} در دسته ${category}؛ بررسی مشخصات، کاربرد و خرید آنلاین.`
      : `${kw || name}؛ بررسی مشخصات فنی، کاربرد و خرید آنلاین.`;
  }
  if (kw && !has(desc, kw)) {
    desc = clip(`${kw}: ${desc}`, 158);
  }
  for (const tail of [
    site ? `خرید از ${site}.` : 'خرید آنلاین.',
    'همین حالا سفارش دهید.',
  ]) {
    if (len(desc) < 120 && len(`${desc} ${tail}`) <= 160) {
      desc = `${desc} ${tail}`;
    }
  }
  desc = clip(desc, 160);

  let description = String(p.description || '').trim();
  const baseText = stripHtml(description);
  const currentWords = words(description);

  const internalLinkHtml = `<a href="${internalUrl || '/shop'}">${category || kw || 'محصولات مرتبط'}</a>`;
  const externalLinkHtml = externalUrl
    ? `<a href="${externalUrl}" rel="noopener" target="_blank">منبع فنی</a>`
    : `<a href="https://developers.google.com/search/docs" rel="noopener" target="_blank">راهنمای استاندارد محتوا</a>`;

  if (currentWords < minWords || !has(extractHeadingsText(description), kw)) {
    const blocks = [];
    if (description) blocks.push(description);
    if (!has(baseText, kw) && kw) {
      blocks.push(`<p>بررسی <strong>${kw}</strong> (${name}) برای انتخاب دقیق‌تر و مطمئن‌تر پیش از خرید.</p>`);
    }
    if (!has(extractHeadingsText(description), kw) && kw) {
      blocks.push(`<h2>مشخصات و ویژگی‌های ${kw}</h2>`);
    } else if (!/<h2/i.test(description)) {
      blocks.push(`<h2>مشخصات و ویژگی‌های کلیدی</h2>`);
    }
    blocks.push(
      `<p>در این بخش ساختار، کیفیت ساخت و کاربردهای روزمره ${kw || name} بررسی می‌شود تا دید شفافی نسبت به عملکرد آن داشته باشید.</p>`,
      `<h3>کاربردها و نکات استفاده</h3>`,
      `<p>برای مشاهده گزینه‌های بیشتر می‌توانید به ${internalLinkHtml} مراجعه کنید و برای مطالعه جزئیات عمومی‌تر از ${externalLinkHtml} بهره ببرید.</p>`
    );

    const pool = buildVariedParagraphs(name, kw, category);
    let idx = 0;
    while (words(blocks.join('\n')) < minWords) {
      blocks.push(pool[idx % pool.length]);
      idx++;
    }
    description = blocks.join('\n');
  }

  return { kw, title, desc, slug, description, alts };
}

export function suggest(p, siteName = '') {
  const r = autoSeo(p, { siteName });
  return { title: r.title, desc: r.desc };
}

const LV = { ok: 1, warn: 0.5, bad: 0 };

/**
 * آنالیز کامل سئو مطابق معیارهای Rank Math
 */
export function analyze(p, { minWords = 600, maxSlugLen = 50, editable = true, siteOrigin = '' } = {}) {
  const seo = p.seo || {};
  const items = [];
  const add = (id, level, title, hint) => items.push({ id, level, title, hint });

  const tl = len(seo.title);
  const dl = len(seo.desc);
  const effTitle = seo.title || p.name || '';
  const effDesc = seo.desc || stripHtml(p.short_description) || '';
  const kw = String(seo.kw || '').trim();

  if (editable) {
    if (!seo.title) {
      add('title', 'warn', 'عنوان سئو خالی است', 'یک عنوان سئوی ۳۰ تا ۶۰ کاراکتری وارد کنید.');
    } else if (tl >= 30 && tl <= 60) {
      add('title', 'ok', 'طول عنوان سئو مناسب است', `${tl} کاراکتر (ایده‌آل ۳۰ تا ۶۰)`);
    } else if ((tl >= 15 && tl < 30) || (tl > 60 && tl <= 70)) {
      add('title', 'warn', tl < 30 ? 'عنوان سئو کوتاه است' : 'عنوان سئو کمی بلند است', `${tl} کاراکتر؛ ایده‌آل ۳۰ تا ۶۰`);
    } else {
      add('title', 'bad', tl < 15 ? 'عنوان سئو خیلی کوتاه است' : 'عنوان سئو خیلی بلند است', `${tl} کاراکتر؛ ایده‌آل ۳۰ تا ۶۰`);
    }

    if (!seo.desc) {
      add('desc', 'bad', 'توضیح متا خالی است', 'یک توضیح متای ۱۲۰ تا ۱۶۰ کاراکتر بنویسید.');
    } else if (dl >= 120 && dl <= 160) {
      add('desc', 'ok', 'طول توضیح متا مناسب است', `${dl} کاراکتر (ایده‌آل ۱۲۰ تا ۱۶۰)`);
    } else if ((dl >= 70 && dl < 120) || (dl > 160 && dl <= 200)) {
      add('desc', 'warn', dl < 120 ? 'توضیح متا کوتاه است' : 'توضیح متا کمی بلند است', `${dl} کاراکتر؛ ایده‌آل ۱۲۰ تا ۱۶۰`);
    } else {
      add('desc', 'bad', dl < 70 ? 'توضیح متا خیلی کوتاه است' : 'توضیح متا خیلی بلند است', `${dl} کاراکتر؛ ایده‌آل ۱۲۰ تا ۱۶۰`);
    }

    if (!kw) {
      add('kw', 'bad', 'کلمه کلیدی اصلی مشخص نیست', 'عبارت اصلی جست‌وجوی کاربر را وارد کنید.');
    } else {
      add('kw', 'ok', 'کلمه کلیدی اصلی مشخص است', kw);
    }
  }

  const slugStr = slugText(p.slug);
  if (len(p.slug || '') > maxSlugLen) {
    add('slug_len', 'warn', 'نامک (URL) طولانی است', `${len(p.slug || '')} کاراکتر؛ کوتاه‌تر باشد بهتر است.`);
  } else if (p.slug) {
    add('slug_len', 'ok', 'طول نامک مناسب است', `${len(p.slug)} کاراکتر`);
  }

  const plainDesc = stripHtml(p.description);
  const wc = words(p.description);
  const headingsText = extractHeadingsText(p.description);
  const intro = plainDesc.split(/\s+/).slice(0, 150).join(' ');

  if (kw) {
    add(
      'kw_title',
      has(effTitle, kw) ? 'ok' : 'bad',
      has(effTitle, kw) ? 'کلمه کلیدی در عنوان هست' : 'کلمه کلیدی در عنوان نیست',
      'کلمه کلیدی را در عنوان و ترجیحاً ابتدای آن بیاورید.'
    );

    const kwAtStart = norm(effTitle).startsWith(norm(kw));
    add(
      'kw_title_start',
      kwAtStart ? 'ok' : 'warn',
      kwAtStart ? 'کلمه کلیدی در ابتدای عنوان است' : 'کلمه کلیدی در ابتدای عنوان نیست',
      'قرار دادن کلمه کلیدی در شروع عنوان امتیاز بیشتری می‌دهد.'
    );

    add(
      'kw_desc',
      has(effDesc, kw) ? 'ok' : 'warn',
      has(effDesc, kw) ? 'کلمه کلیدی در توضیح متا هست' : 'کلمه کلیدی در توضیح متا نیست',
      'کلمه کلیدی را در توضیحات متا قرار دهید.'
    );

    add(
      'kw_slug',
      has(slugStr, kw) ? 'ok' : 'warn',
      has(slugStr, kw) ? 'کلمه کلیدی در نامک هست' : 'کلمه کلیدی در نامک نیست',
      'کلمه کلیدی را در نامک محصول بگنجانید.'
    );

    add(
      'kw_intro',
      has(intro, kw) ? 'ok' : 'warn',
      has(intro, kw) ? 'کلمه کلیدی در ابتدای محتوا هست' : 'کلمه کلیدی در ابتدای محتوا نیست',
      'در پاراگراف اول توضیحات از کلمه کلیدی استفاده کنید.'
    );

    add(
      'kw_heading',
      has(headingsText, kw) ? 'ok' : 'warn',
      has(headingsText, kw) ? 'کلمه کلیدی در زیرتیترها هست' : 'کلمه کلیدی در زیرتیترها نیست',
      'حداقل در یکی از زیرتیترهای H2 یا H3 کلمه کلیدی بیاید.'
    );

    const kwCount = countOccurrences(plainDesc, kw);
    const density = wc > 0 ? (kwCount / wc) * 100 : 0;
    if (kwCount === 0) {
      add('kw_density', 'bad', 'کلمه کلیدی در متن اصلی نیست', 'چند بار در متن از کلمه کلیدی استفاده کنید.');
    } else if (density >= 0.5 && density <= 2.5) {
      add('kw_density', 'ok', 'تراکم کلمه کلیدی مناسب است', `${kwCount} بار (${density.toFixed(1)}٪)`);
    } else {
      add('kw_density', 'warn', 'تراکم کلمه کلیدی نیاز به تنظیم دارد', `${kwCount} بار (${density.toFixed(1)}٪)؛ بازه ۰.۵٪ تا ۲.۵٪ مناسب‌تر است.`);
    }
  }

  if (wc >= minWords) {
    add('content_len', 'ok', 'طول توضیحات کامل است', `${wc} کلمه (حداقل ${minWords})`);
  } else if (wc >= 150) {
    add('content_len', 'warn', 'طول توضیحات برای Rank Math کوتاه است', `${wc} کلمه؛ برای امتیاز کامل حداقل ${minWords} کلمه توصیه می‌شود.`);
  } else {
    add('content_len', 'bad', 'توضیحات محصول خیلی کوتاه است', `${wc} کلمه؛ حداقل ${minWords} کلمه بنویسید.`);
  }

  const hrefs = [...String(p.description || '').matchAll(/<a\b[^>]*href=["']([^"']*)["']/gi)].map((m) => m[1].trim());
  const cleanOrigin = String(siteOrigin || '').replace(/\/+$/, '').toLowerCase();

  const hasInternalLink = hrefs.some((h) => {
    if (!h || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:')) return false;
    if (h.startsWith('/')) return true;
    if (cleanOrigin && h.toLowerCase().startsWith(cleanOrigin)) return true;
    return false;
  });

  const hasExternalLink = hrefs.some((h) => {
    if (!/^https?:\/\//i.test(h)) return false;
    if (cleanOrigin && h.toLowerCase().startsWith(cleanOrigin)) return false;
    return true;
  });

  add('internal_link', hasInternalLink ? 'ok' : 'warn', hasInternalLink ? 'لینک داخلی در متن هست' : 'لینک داخلی در متن نیست', 'به دسته‌ها یا محصولات مرتبط لینک بدهید.');
  add('external_link', hasExternalLink ? 'ok' : 'warn', hasExternalLink ? 'لینک خارجی در متن هست' : 'لینک خارجی در متن نیست', 'در صورت نیاز به یک منبع معتبر خارجی لینک بدهید.');

  const img = p.image && p.image.id;
  const hasMediaInBody = /<(img|video|iframe)\b/i.test(String(p.description || ''));
  add('image', img ? 'ok' : 'bad', img ? 'تصویر اصلی دارد' : 'تصویر اصلی ندارد', 'محصول باید تصویر اصلی داشته باشد.');
  add('media_body', (hasMediaInBody || img) ? 'ok' : 'warn', hasMediaInBody ? 'رسانه در بدنه متن هست' : (img ? 'تصویر محصول تنظیم شده است' : 'رسانه‌ای در صفحه نیست'), 'وجود تصویر یا ویدیو به خوانایی کمک می‌کند.');

  const short = stripHtml(p.short_description);
  add('short', len(short) >= 20 ? 'ok' : 'warn', len(short) >= 20 ? 'توضیح کوتاه دارد' : 'توضیح کوتاه خالی یا خیلی کوتاه است', 'در صفحه محصول بالای دکمه خرید نمایش داده می‌شود.');

  const all = [p.image, ...(p.gallery || [])].filter((x) => x && x.id);
  const missing = all.filter((x) => !String(x.alt || '').trim()).length;
  if (all.length) {
    if (!missing) {
      add('alt', 'ok', 'همه تصاویر متن جایگزین (alt) دارند', '');
    } else if (p.image && p.image.id && !String(p.image.alt || '').trim()) {
      add('alt', 'bad', 'تصویر اصلی متن جایگزین (alt) ندارد', 'برای سئوی تصاویر متن جایگزین بنویسید.');
    } else {
      add('alt', 'warn', `${missing} تصویر متن جایگزین (alt) ندارد`, 'برای تصاویر متن جایگزین وارد کنید.');
    }
  }

  if (seo.noindex) {
    add('noindex', 'bad', 'این محصول «noindex» است', 'در نتایج گوگل ایندکس نمی‌شود.');
  }

  const total = items.length || 1;
  const sum = items.reduce((a, i) => a + LV[i.level], 0);
  const score = Math.round((sum / total) * 100);
  return { score, grade: score >= 80 ? 'good' : score >= 50 ? 'mid' : 'bad', items };
}

export const gradeLabel = { good: 'سئوی خوب', mid: 'سئوی متوسط', bad: 'سئوی ضعیف' };
