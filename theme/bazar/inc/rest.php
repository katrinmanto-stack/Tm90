<?php
/**
 * REST API قالب بازار — namespace: bazar/v1
 *
 * GET  /ping            عمومی؛ برای بررسی اتصال (بدون اطلاعات حساس)
 * GET  /schema          فقط مدیر؛ تعریف فرم‌ها و پالت‌های آماده
 * GET  /settings        فقط مدیر؛ مقدارهای فعلی
 * POST /settings        فقط مدیر؛ {"values": {...}} ذخیره‌ی بخشی از تنظیمات
 * POST /settings/reset  فقط مدیر؛ بازگشت به پیش‌فرض‌ها
 * POST /preview         فقط مدیر؛ {"values": {...}, "path": "/shop/"} آدرس پیش‌نمایش ذخیره‌نشده
 *
 * ورود: Application Passwords وردپرس (Basic Auth روی HTTPS).
 */
if (!defined('ABSPATH')) exit;

add_action('rest_api_init', 'bazar_register_routes');

function bazar_register_routes() {
  $ns = 'bazar/v1';
  register_rest_route($ns, '/ping', array(
    'methods' => 'GET', 'callback' => 'bazar_rest_ping', 'permission_callback' => '__return_true',
  ));
  register_rest_route($ns, '/schema', array(
    'methods' => 'GET', 'callback' => 'bazar_rest_schema', 'permission_callback' => 'bazar_rest_can',
  ));
  register_rest_route($ns, '/settings', array(
    array('methods' => 'GET', 'callback' => 'bazar_rest_get', 'permission_callback' => 'bazar_rest_can'),
    array('methods' => 'POST, PUT, PATCH', 'callback' => 'bazar_rest_save', 'permission_callback' => 'bazar_rest_can'),
  ));
  register_rest_route($ns, '/settings/reset', array(
    'methods' => 'POST', 'callback' => 'bazar_rest_reset', 'permission_callback' => 'bazar_rest_can',
  ));
  register_rest_route($ns, '/preview', array(
    'methods' => 'POST', 'callback' => 'bazar_rest_preview', 'permission_callback' => 'bazar_rest_can',
  ));
}

function bazar_rest_can() {
  return current_user_can('manage_options');
}

/** مقدار یک فیلد به شکل مناسب JSON (تصویرها با آدرس پیش‌نمایش). */
function bazar_present($f, $v) {
  $v = bazar_clean($f, $v);
  if (isset($f['type']) && $f['type'] === 'image') {
    $id  = (int) $v;
    $url = $id ? wp_get_attachment_image_url($id, 'medium') : '';
    return array('id' => $id, 'url' => $url ? $url : '');
  }
  return $v;
}

function bazar_rest_values() {
  $out = array();
  foreach (bazar_fields() as $k => $f) {
    $out[$k] = bazar_present($f, bazar_saved_value($f));
  }
  return $out;
}

function bazar_rest_ping() {
  return rest_ensure_response(array(
    'ok'            => true,
    'name'          => get_bloginfo('name'),
    'theme'         => 'bazar',
    'version'       => defined('BAZAR_V') ? BAZAR_V : '',
    'api'           => 1,
    'https'         => is_ssl(),
    'woocommerce'   => class_exists('WooCommerce'),
    'app_passwords' => function_exists('wp_is_application_passwords_available') ? wp_is_application_passwords_available() : false,
  ));
}

function bazar_rest_schema() {
  $s = bazar_schema();
  return rest_ensure_response(array(
    'version' => $s['version'],
    'groups'  => $s['groups'],
    'presets' => $s['presets'],
    'fields'  => array_values($s['fields']),
  ));
}

function bazar_rest_get() {
  return rest_ensure_response(array(
    'values'  => bazar_rest_values(),
    'palette' => bazar_palette(),
    'site'    => array('name' => get_bloginfo('name'), 'url' => home_url('/'), 'version' => defined('BAZAR_V') ? BAZAR_V : ''),
  ));
}

function bazar_clean_map($in) {
  $fields = bazar_fields();
  $clean  = array();
  $unknown = array();
  if (!is_array($in)) return array($clean, $unknown);
  foreach ($in as $k => $v) {
    if (!is_string($k) || !isset($fields[$k])) { $unknown[] = (string) $k; continue; }
    $clean[$k] = bazar_clean($fields[$k], $v);
  }
  return array($clean, $unknown);
}

function bazar_rest_save($req) {
  $in = $req->get_param('values');
  if (!is_array($in)) {
    return new WP_Error('bazar_bad_request', 'فیلد values الزامی است.', array('status' => 400));
  }
  $res     = bazar_clean_map($in);
  $clean   = $res[0];
  $unknown = $res[1];
  bazar_save($clean);

  // اگر رنگی برای خوانایی تعدیل شد، به اپ خبر بده.
  $notes = array();
  $p = bazar_palette();
  if (isset($clean['color_brand']) && $p['brand'] !== $clean['color_brand']) {
    $notes[] = array('key' => 'color_brand', 'message' => 'رنگ اصلی کمی تیره‌تر شد تا متن سفید روی دکمه‌ها خوانا بماند.');
  }
  if (isset($clean['color_ink']) && $p['ink'] !== $clean['color_ink']) {
    $notes[] = array('key' => 'color_ink', 'message' => 'رنگ متن کمی تیره‌تر شد تا خوانایی حفظ شود.');
  }
  if (isset($clean['color_sale']) && $p['sale'] !== $clean['color_sale']) {
    $notes[] = array('key' => 'color_sale', 'message' => 'رنگ تخفیف کمی تیره‌تر شد تا خوانایی حفظ شود.');
  }

  $purged = bazar_purge_caches();
  return rest_ensure_response(array(
    'saved'   => array_keys($clean),
    'unknown' => $unknown,
    'notes'   => $notes,
    'purged'  => $purged,
    'values'  => bazar_rest_values(),
    'palette' => $p,
  ));
}

function bazar_rest_reset() {
  bazar_reset_all();
  bazar_purge_caches();
  return rest_ensure_response(array('values' => bazar_rest_values(), 'palette' => bazar_palette()));
}

function bazar_rest_preview($req) {
  $in  = $req->get_param('values');
  $res = bazar_clean_map(is_array($in) ? $in : array());
  $token = wp_generate_password(20, false, false);
  set_transient('bazar_prev_' . $token, $res[0], 30 * MINUTE_IN_SECONDS);

  $url  = home_url('/');
  $path = $req->get_param('path');
  if (is_string($path) && strlen($path) > 1 && $path[0] === '/' && substr($path, 0, 2) !== '//') {
    $url = home_url($path);
  }
  return rest_ensure_response(array(
    'url'     => add_query_arg('bazar_preview', $token, $url),
    'token'   => $token,
    'expires' => 30 * MINUTE_IN_SECONDS,
  ));
}
