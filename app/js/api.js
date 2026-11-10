// ارتباط با REST API وردپرس. ورود: Application Passwords (Basic Auth روی HTTPS).
const KEY = 'sungold.connection.v1';

export const loadConn = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
export const saveConn = (c) => localStorage.setItem(KEY, JSON.stringify(c));
export const clearConn = () => localStorage.removeItem(KEY);

export class ApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) { super(message); this.status = status; this.code = code; }
}

export function normalizeSite(input) {
  let v = String(input || '').trim();
  if (!v) throw new ApiError('آدرس سایت را وارد کنید.');
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  let u;
  try { u = new URL(v); } catch { throw new ApiError('آدرس سایت معتبر نیست.'); }
  return u.origin + u.pathname.replace(/\/+$/, '');
}

function b64(str) {
  let s = '';
  new TextEncoder().encode(str).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function urlFor(conn, route, query) {
  const q = query ? new URLSearchParams(query).toString() : '';
  if (conn.restStyle === 'plain') return `${conn.site}/?rest_route=${route}${q ? '&' + q : ''}`;
  return `${conn.site}/wp-json${route}${q ? '?' + q : ''}`;
}

const MESSAGES = {
  401: 'نام کاربری یا رمز برنامه درست نیست.',
  403: 'این کاربر دسترسی مدیر ندارد (یا هاست هدر Authorization را حذف می‌کند؛ راهنمای README را ببینید).',
};

export async function call(conn, route, { method = 'GET', body, auth = true, query, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (auth) h.Authorization = 'Basic ' + b64(`${conn.user}:${conn.pass}`);
  let payload;
  if (body instanceof Blob) payload = body;
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(urlFor(conn, route, query), { method, headers: h, body: payload, cache: 'no-store' });
  } catch {
    const mixed = location.protocol === 'https:' && conn.site.startsWith('http:');
    throw new ApiError(mixed
      ? 'این اپ با HTTPS باز شده ولی سایت HTTP است؛ مرورگر اجازه نمی‌دهد. سایت را روی HTTPS ببرید.'
      : 'اتصال به سایت برقرار نشد. آدرس، HTTPS و دسترسی (CORS) را بررسی کنید.', { code: 'network' });
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* پاسخ HTML */ }

  if (!res.ok) {
    let msg = MESSAGES[res.status] || (data && data.message) || `خطای سرور (${res.status})`;
    if (res.status === 404 && route.startsWith('/bazar/')) msg = 'قالب بازار نسخه‌ی ۴ روی این سایت فعال نیست (یا پیوند یکتا مشکل دارد).';
    throw new ApiError(msg, { status: res.status, code: (data && data.code) || '' });
  }
  if (data === null) throw new ApiError('پاسخ نامعتبر از سایت (احتمالاً REST API مسدود یا ریدایرکت شده).', { status: res.status, code: 'bad_response' });
  return data;
}

/** اتصال: ابتدا ping عمومی (برای تشخیص نوع آدرس REST)، سپس خواندن تنظیمات با احراز هویت. */
export async function connect(site, user, pass) {
  const conn = { site: normalizeSite(site), user: String(user || '').trim(), pass: String(pass || '').trim(), restStyle: 'pretty' };
  if (!conn.user || !conn.pass) throw new ApiError('نام کاربری و رمز برنامه را وارد کنید.');
  let ping;
  try {
    ping = await call(conn, '/bazar/v1/ping', { auth: false });
  } catch (e) {
    if (e.code === 'network') throw e;
    conn.restStyle = 'plain'; // پیوند یکتای ساده
    ping = await call(conn, '/bazar/v1/ping', { auth: false });
  }
  const data = await call(conn, '/bazar/v1/settings');
  return { conn, ping, data };
}

/* ---------- آپلود تصویر (با کوچک‌سازی سمت کاربر) ---------- */
async function shrink(file, max = 1600) {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  if (bmp.width <= max) return file;
  const k = max / bmp.width;
  const cv = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.convertToBlob({ type: file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality: 0.9 });
}

export async function uploadImage(conn, file) {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new ApiError('فقط PNG، JPG یا WebP.');
  if (file.size > 12 * 1024 * 1024) throw new ApiError('حجم تصویر بیشتر از ۱۲ مگابایت است.');
  const blob = await shrink(file);
  const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const name = /^[\w.-]+$/.test(file.name) ? file.name : `upload-${Date.now()}.${ext}`;
  const r = await call(conn, '/wp/v2/media', {
    method: 'POST', body: blob,
    headers: { 'Content-Disposition': `attachment; filename="${name}"`, 'Content-Type': blob.type },
  });
  const sz = r.media_details && r.media_details.sizes && r.media_details.sizes.medium;
  return { id: r.id, url: (sz && sz.source_url) || r.source_url };
}
