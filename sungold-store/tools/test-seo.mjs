// تست تحلیل سئو: node tools/test-seo.mjs
import assert from 'node:assert/strict';
import { norm, analyze, suggest, clip, len, autoSeo, extractKeyword } from '../app/js/seo.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const lvl = (res, id) => (res.items.find((i) => i.id === id) || {}).level;

t('norm: ی/ک عربی، نیم‌فاصله و ارقام', () => {
  assert.equal(norm('شال‌گردن'), 'شال گردن');
  assert.equal(norm('كتاب ياسمين'), 'کتاب یاسمین');
  assert.equal(norm('مدل ۱۲۳ و ٤٥٦'), 'مدل 123 و 456');
});
t('clip: کوتاه‌کردن در مرز کلمه', () => {
  const s = clip('این یک متن نسبتاً طولانی برای آزمایش کوتاه کردن در مرز کلمه است', 30);
  assert.ok(len(s) <= 30 && s.endsWith('…'), s);
});
const good = {
  name: 'مانتو کتان سبک', slug: encodeURIComponent('مانتو-کتان-سبک'),
  short_description: 'مانتو کتان سبک و خنک مخصوص تابستان با دوخت تمیز.',
  description: ('مانتو کتان سبک و خنک برای روزهای گرم. ' + 'جنس پارچه نرم و مقاوم است و شست‌وشو آسان دارد. '.repeat(20)),
  image: { id: 1, alt: 'مانتو کتان' }, gallery: [{ id: 2, alt: 'پشت مانتو' }],
  seo: { title: 'مانتو کتان سبک تابستانی | فروشگاه', desc: 'خرید آنلاین مانتو کتان سبک و خنک تابستانی با دوخت تمیز و رنگ‌بندی متنوع؛ مناسب محل کار و رفت‌وآمد روزمره.', kw: 'مانتو کتان', noindex: false },
};
t('محصول کامل: امتیاز بالا و بدون مورد «bad»', () => {
  const r = analyze(good, { siteName: 'فروشگاه' });
  assert.ok(r.score >= 90, 'score=' + r.score);
  assert.equal(r.grade, 'good');
  assert.ok(!r.items.some((i) => i.level === 'bad'), JSON.stringify(r.items.filter((i) => i.level === 'bad')));
});
t('محصول خالی: امتیاز ضعیف', () => {
  const r = analyze({ name: 'x', slug: '', description: '', short_description: '', image: { id: 0 }, gallery: [], seo: {} });
  assert.equal(r.grade, 'bad');
  assert.equal(lvl(r, 'kw'), 'bad'); assert.equal(lvl(r, 'desc'), 'bad'); assert.equal(lvl(r, 'image'), 'bad');
});
t('کلمه‌ی کلیدی نبودن در عنوان', () => {
  const r = analyze({ ...good, seo: { ...good.seo, kw: 'شلوار' } });
  assert.equal(lvl(r, 'kw_title'), 'bad'); assert.equal(lvl(r, 'kw_slug'), 'warn');
});
t('تطبیق کلمه‌ی کلیدی با ی/ک عربی و نیم‌فاصله', () => {
  const r = analyze({ ...good, seo: { ...good.seo, kw: 'مانتو كتان' } });
  assert.equal(lvl(r, 'kw_title'), 'ok');
});
t('alt: همه / بعضی / اصلی خالی', () => {
  assert.equal(lvl(analyze(good), 'alt'), 'ok');
  assert.equal(lvl(analyze({ ...good, gallery: [{ id: 2, alt: '' }] }), 'alt'), 'warn');
  assert.equal(lvl(analyze({ ...good, image: { id: 1, alt: '' } }), 'alt'), 'bad');
});
t('طول عنوان و توضیح: مرزها', () => {
  const mk = (title, desc) => analyze({ ...good, seo: { ...good.seo, title, desc } });
  assert.equal(lvl(mk('ا'.repeat(30), 'ب'.repeat(120)), 'title'), 'ok');
  assert.equal(lvl(mk('ا'.repeat(61), 'ب'.repeat(161)), 'title'), 'warn');
  assert.equal(lvl(mk('ا'.repeat(61), 'ب'.repeat(161)), 'desc'), 'warn');
  assert.equal(lvl(mk('ا'.repeat(80), 'ب'.repeat(300)), 'title'), 'bad');
  assert.equal(lvl(mk('ا'.repeat(80), 'ب'.repeat(300)), 'desc'), 'bad');
});
t('noindex به‌عنوان مشکل گزارش می‌شود', () => {
  assert.equal(lvl(analyze({ ...good, seo: { ...good.seo, noindex: true } }), 'noindex'), 'bad');
});
t('editable=false: بررسی‌های عنوان/متا/کلمه‌ی کلیدی حذف می‌شود', () => {
  const r = analyze({ ...good, seo: {} }, { editable: false });
  assert.ok(!r.items.some((i) => ['title', 'desc', 'kw'].includes(i.id)));
});
t('suggest: عنوان ≤۶۰ و توضیح ≤۱۵۵', () => {
  const s = suggest(good, 'فروشگاه');
  assert.ok(len(s.title) <= 60 && s.title.includes('مانتو') && len(s.desc) <= 160 && s.desc.length > 20, JSON.stringify(s));
  const e = suggest({ name: 'کیف چرمی', short_description: '', description: '' }, 'فروشگاه');
  assert.ok(e.desc.includes('کیف چرمی'));
});

t('extractKeyword: ۲ تا ۳ کلمه‌ی اول، تا مدل/سری/کد لاتین', () => {
  assert.equal(extractKeyword('مانتو کتان سبک تابستانی'), 'مانتو کتان'); assert.equal(extractKeyword('کیف چرمی دستی'), 'کیف چرمی دستی');
  assert.equal(extractKeyword('هندزفری بی‌سیم گرین لاین مدل Lipstick'), 'هندزفری بی‌سیم');
  assert.equal(extractKeyword('کیف و کفش چرمی'), 'کیف کفش چرمی');
  assert.equal(extractKeyword('شارژر GaN مدل 30W'), 'شارژر GaN');
  assert.equal(extractKeyword('  شال  '), 'شال');
  assert.equal(extractKeyword(''), '');
});
const SITE = 'فروشگاه سان‌گلد';
const samples = [
  { name: 'مانتو کتان سبک', short_description: 'مانتو کتان سبک و خنک مخصوص تابستان با دوخت تمیز.', description: 'این مانتو از کتان سبک و خنک تهیه شده است. برای روزهای گرم تابستان مناسب است. شست‌وشوی آسان دارد و بعد از شست‌وشو جمع نمی‌شود. در سه رنگ موجود است.' },
  { name: 'هندزفری بی‌سیم', short_description: '', description: '' },
  { name: 'شال', short_description: 'شال نخی نرم.', description: '' },
  { name: 'کیف چرمی دستی زنانه مدل Classic 2024', short_description: '', description: '<p>کیف چرمی دستی با دوخت محکم و آستر نرم؛ مناسب استفاده‌ی روزانه و مهمانی.</p><p>دو جیب داخلی دارد.</p>' },
];
t('autoSeo: طول عنوان ۳۰–۶۰ (یا نزدیک) و توضیح ۱۲۰–۱۶۰، شامل کلمه‌ی کلیدی', () => {
  for (const p of samples) {
    const r = autoSeo(p, { siteName: SITE });
    assert.ok(len(r.title) >= 18 && len(r.title) <= 60, `${p.name}: title ${len(r.title)} «${r.title}»`);
    assert.ok(len(r.desc) >= 60 && len(r.desc) <= 160, `${p.name}: desc ${len(r.desc)} «${r.desc}»`);
    assert.ok(norm(r.title).includes(norm(r.kw)) && norm(r.desc).includes(norm(r.kw)), `${p.name}: kw «${r.kw}» نیست`);
    assert.ok(r.slug && !/\s/.test(r.slug), 'slug=' + r.slug);
  }
  const full = autoSeo(samples[0], { siteName: SITE }); assert.ok(len(full.title) >= 30 && len(full.desc) >= 120, `${len(full.title)}/${len(full.desc)}`);
});
t('autoSeo: کلمه‌ی کلیدی دلخواه رعایت می‌شود و در عنوان/توضیح می‌آید', () => {
  const r = autoSeo({ ...samples[0], kw: 'مانتو تابستانی' }, { siteName: SITE });
  assert.equal(r.kw, 'مانتو تابستانی'); assert.ok(norm(r.title).includes('مانتو تابستانی') && norm(r.desc).includes('مانتو تابستانی'));
});
t('autoSeo: نامک از کلمه‌ی کلیدی (نیم‌فاصله → خط‌تیره) و alt تصاویر یکتا', () => {
  const r = autoSeo({ name: 'هندزفری بی‌سیم گرین لاین' }); assert.equal(r.slug, 'هندزفری-بی-سیم');
  assert.equal(r.alts.main, 'هندزفری بی‌سیم گرین لاین'); assert.notEqual(r.alts.gallery(0), r.alts.gallery(1)); assert.ok(r.alts.gallery(0).includes('تصویر'));
});
t('autoSeo: با توضیحات و تصویر، امتیاز تحلیل خوب می‌شود و مورد «bad» سئو ندارد', () => {
  const p = { ...samples[0], description: samples[0].description + ' ' + 'نمونه جمله‌ی کامل درباره‌ی جنس و دوخت و نگهداری محصول است. '.repeat(18), image: { id: 1, alt: '' }, gallery: [{ id: 2, alt: '' }] };
  const r = autoSeo(p, { siteName: SITE });
  const res = analyze({ ...p, slug: r.slug, image: { id: 1, alt: r.alts.main }, gallery: [{ id: 2, alt: r.alts.gallery(0) }], seo: { title: r.title, desc: r.desc, kw: r.kw } }, { siteName: SITE });
  assert.ok(res.score >= 85, 'score=' + res.score + JSON.stringify(res.items.filter((i) => i.level !== 'ok').map((i) => i.id)));
  assert.ok(!res.items.some((i) => i.level === 'bad'));
});
t('autoSeo: بدون نام چیزی نمی‌سازد', () => { const r = autoSeo({ name: '  ' }); assert.equal(r.title, ''); assert.equal(r.kw, ''); });
console.log(`\n${n} tests passed`);
