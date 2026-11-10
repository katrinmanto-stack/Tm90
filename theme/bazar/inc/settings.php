<?php
/**
 * Bazar settings core.
 * تنها منبع تعریف تنظیمات: inc/schema.json
 * ذخیره‌سازی: گزینه‌ی bazar_settings (به‌جز فیلدهایی که "store" دارند: عنوان سایت، لوگو، آیکن).
 */
if (!defined('ABSPATH')) exit;

/* ------------------------------------------------------------------ Schema */

function bazar_schema() {
  static $s = null;
  if ($s !== null) return $s;
  $s = array('version' => 1, 'groups' => array(), 'presets' => array(), 'fields' => array());
  $file = get_template_directory() . '/inc/schema.json';
  if (is_readable($file)) {
    $j = json_decode(file_get_contents($file), true);
    if (is_array($j) && !empty($j['fields'])) $s = $j;
  }
  return $s;
}

function bazar_fields() {
  static $f = null;
  if ($f !== null) return $f;
  $f = array();
  $s = bazar_schema();
  foreach ($s['fields'] as $row) {
    if (isset($row['key'])) $f[$row['key']] = $row;
  }
  return $f;
}

/* ------------------------------------------------------------ Preview mode */

/** مقدارهای پیش‌نمایش (ذخیره‌نشده) وقتی ?bazar_preview=TOKEN معتبر باشد. */
function bazar_preview_values() {
  static $p = false;
  if ($p !== false) return $p;
  $p = null;
  if (is_admin() || (defined('REST_REQUEST') && REST_REQUEST)) return $p;
  if (!empty($_GET['bazar_preview']) && is_string($_GET['bazar_preview'])) {
    $t = $_GET['bazar_preview'];
    if (preg_match('/^[A-Za-z0-9]{20}$/', $t)) {
      $v = get_transient('bazar_prev_' . $t);
      if (is_array($v)) {
        $p = $v;
        $GLOBALS['bazar_preview_token'] = $t;
      }
    }
  }
  return $p;
}

function bazar_is_preview() {
  return is_array(bazar_preview_values());
}

/* ------------------------------------------------------------ Read values */

function bazar_default_of($f) {
  return array_key_exists('default', $f) ? $f['default'] : '';
}

/** مقدار ذخیره‌شده‌ی یک فیلد (بدون پیش‌نمایش). */
function bazar_saved_value($f) {
  $key   = $f['key'];
  $store = isset($f['store']) ? $f['store'] : '';
  $def   = bazar_default_of($f);
  if (strpos($store, 'option:') === 0) return get_option(substr($store, 7), $def);
  if (strpos($store, 'mod:') === 0)    return get_theme_mod(substr($store, 4), $def);
  $all = get_option('bazar_settings', array());
  if (is_array($all) && array_key_exists($key, $all)) return $all[$key];
  $legacy = get_theme_mod('bazar_' . $key, null); // قالب‌های قبل از 4.0
  if ($legacy !== null && $legacy !== false) return $legacy;
  return $def;
}

function bazar_value($key) {
  $fields = bazar_fields();
  if (!isset($fields[$key])) return null;
  $pv = bazar_preview_values();
  if (is_array($pv) && array_key_exists($key, $pv)) return $pv[$key];
  return bazar_saved_value($fields[$key]);
}

function bazar_opt($key) {
  $v = bazar_value($key);
  return is_scalar($v) ? (string) $v : '';
}

function bazar_on($key) {
  return (bool) bazar_value($key);
}

/* ------------------------------------------------------------- Sanitising */

function bazar_trim_to($s, $max) {
  $s = (string) $s;
  return $max > 0 ? mb_substr($s, 0, $max) : $s;
}

function bazar_en_digits($s) {
  $fa = array('۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩');
  $en = array('0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9');
  return str_replace($fa, $en, (string) $s);
}

function bazar_tel($t) {
  return preg_replace('/[^0-9+]/', '', bazar_en_digits($t));
}

function bazar_wa_url($n) {
  $d = preg_replace('/[^0-9]/', '', bazar_en_digits($n));
  if ($d === '') return '';
  if (strpos($d, '00') === 0) $d = substr($d, 2);
  elseif (strpos($d, '09') === 0) $d = '98' . substr($d, 1);
  return 'https://wa.me/' . $d;
}

function bazar_hex6($c) {
  $c = strtolower(ltrim((string) $c, '#'));
  if (strlen($c) === 3) $c = $c[0] . $c[0] . $c[1] . $c[1] . $c[2] . $c[2];
  return '#' . $c;
}

function bazar_clean($f, $v) {
  $t   = isset($f['type']) ? $f['type'] : 'text';
  $def = bazar_default_of($f);
  $max = isset($f['max']) ? (int) $f['max'] : 200;

  switch ($t) {
    case 'toggle':
      return (bool) filter_var($v, FILTER_VALIDATE_BOOLEAN);

    case 'color':
      $c = sanitize_hex_color(is_string($v) ? $v : '');
      return $c ? bazar_hex6($c) : $def;

    case 'number':
      $n   = is_numeric($v) ? (int) $v : (int) $def;
      $min = isset($f['min']) ? (int) $f['min'] : 0;
      $mx  = isset($f['max']) ? (int) $f['max'] : 100;
      return max($min, min($mx, $n));

    case 'select':
      $vals = array();
      if (!empty($f['options'])) {
        foreach ($f['options'] as $o) $vals[] = (string) $o[0];
      }
      return in_array((string) $v, $vals, true) ? (string) $v : $def;

    case 'image':
      if (is_array($v) && isset($v['id'])) $v = $v['id'];
      $id = (int) $v;
      return ($id > 0 && wp_attachment_is_image($id)) ? $id : 0;

    case 'textarea':
      return bazar_trim_to(sanitize_textarea_field(is_string($v) ? $v : ''), $max ? $max : 600);

    case 'email':
      return sanitize_email(is_string($v) ? $v : '');

    case 'phone':
      $p = is_string($v) ? $v : '';
      $p = preg_replace('/[^0-9+\s\-()\x{06F0}-\x{06F9}\x{0660}-\x{0669}]/u', '', $p);
      return bazar_trim_to(trim($p), 20);

    case 'url':
      $u = trim(is_string($v) ? $v : '');
      if ($u === '') return '';
      if (!empty($f['prefix']) && !preg_match('#^https?://#i', $u) && preg_match('/^@?[A-Za-z0-9._]{2,64}$/', $u)) {
        $u = $f['prefix'] . ltrim($u, '@');
      }
      return esc_url_raw($u, array('http', 'https'));

    case 'link': // آدرس کامل، مسیر نسبی، یا لنگر (#بخش)
      $u = trim(is_string($v) ? $v : '');
      if ($u === '') return '';
      if ($u[0] === '#') return '#' . preg_replace('/[^A-Za-z0-9_\-]/', '', substr($u, 1));
      if ($u[0] === '/' && substr($u, 0, 2) !== '//') return esc_url_raw($u);
      return esc_url_raw($u, array('http', 'https'));

    case 'benefits':
      $out = array();
      if (is_array($v)) {
        foreach ($v as $row) {
          if (!is_array($row)) continue;
          $title = isset($row['title']) ? sanitize_text_field((string) $row['title']) : '';
          $text  = isset($row['text'])  ? sanitize_text_field((string) $row['text'])  : '';
          if ($title === '') continue;
          $out[] = array('title' => bazar_trim_to($title, 40), 'text' => bazar_trim_to($text, 80));
          if (count($out) >= 4) break;
        }
      }
      return $out ? $out : $def;

    case 'sections':
      $ids = array();
      if (!empty($f['options'])) {
        foreach ($f['options'] as $o) $ids[] = (string) $o[0];
      }
      $out  = array();
      $seen = array();
      if (is_array($v)) {
        foreach ($v as $row) {
          if (!is_array($row) || !isset($row['id'])) continue;
          $id = (string) $row['id'];
          if (!in_array($id, $ids, true) || isset($seen[$id])) continue;
          $seen[$id] = true;
          $out[] = array('id' => $id, 'on' => !empty($row['on']));
        }
      }
      foreach ($ids as $id) {
        if (!isset($seen[$id])) $out[] = array('id' => $id, 'on' => true);
      }
      return $out;

    case 'text':
    default:
      return bazar_trim_to(sanitize_text_field(is_scalar($v) ? (string) $v : ''), $max);
  }
}

/* ---------------------------------------------------------------- Writing */

/** $values باید قبلاً با bazar_clean پاک‌سازی شده باشد. */
function bazar_save($values) {
  $fields = bazar_fields();
  $all = get_option('bazar_settings', array());
  if (!is_array($all)) $all = array();
  foreach ($values as $k => $v) {
    if (!isset($fields[$k])) continue;
    $store = isset($fields[$k]['store']) ? $fields[$k]['store'] : '';
    if (strpos($store, 'option:') === 0) {
      update_option(substr($store, 7), $v);
    } elseif (strpos($store, 'mod:') === 0) {
      if ($v) set_theme_mod(substr($store, 4), $v);
      else remove_theme_mod(substr($store, 4));
    } else {
      $all[$k] = $v;
    }
  }
  update_option('bazar_settings', $all);
  do_action('bazar_settings_saved', $values);
}

function bazar_reset_all() {
  delete_option('bazar_settings');
  foreach (bazar_fields() as $k => $f) {
    if (empty($f['store'])) remove_theme_mod('bazar_' . $k);
  }
  do_action('bazar_settings_saved', array());
}

/** پاک‌کردن کش افزونه‌های رایج بعد از ذخیره. نام افزونه‌های پاک‌شده را برمی‌گرداند. */
function bazar_purge_caches() {
  $done = array();
  if (function_exists('rocket_clean_domain'))  { rocket_clean_domain();  $done[] = 'wp-rocket'; }
  if (function_exists('w3tc_flush_all'))       { w3tc_flush_all();       $done[] = 'w3-total-cache'; }
  if (function_exists('wp_cache_clear_cache')) { wp_cache_clear_cache(); $done[] = 'wp-super-cache'; }
  if (class_exists('autoptimizeCache') && method_exists('autoptimizeCache', 'clearall')) {
    autoptimizeCache::clearall();
    $done[] = 'autoptimize';
  }
  do_action('litespeed_purge_all');
  do_action('bazar_purge_cache');
  return $done;
}

/* ---------------------------------------------------------- Colour maths */

function bazar_hex2rgb($h) {
  $h = ltrim((string) $h, '#');
  if (strlen($h) === 3) $h = $h[0] . $h[0] . $h[1] . $h[1] . $h[2] . $h[2];
  return array(hexdec(substr($h, 0, 2)), hexdec(substr($h, 2, 2)), hexdec(substr($h, 4, 2)));
}

function bazar_rgb2hex($r) {
  return sprintf('#%02x%02x%02x',
    (int) round(max(0, min(255, $r[0]))),
    (int) round(max(0, min(255, $r[1]))),
    (int) round(max(0, min(255, $r[2]))));
}

/** t = سهم رنگ $b (0..1) */
function bazar_mix($a, $b, $t) {
  $x = bazar_hex2rgb($a);
  $y = bazar_hex2rgb($b);
  return bazar_rgb2hex(array(
    $x[0] + ($y[0] - $x[0]) * $t,
    $x[1] + ($y[1] - $x[1]) * $t,
    $x[2] + ($y[2] - $x[2]) * $t,
  ));
}

function bazar_lum($h) {
  $c = bazar_hex2rgb($h);
  $o = array();
  foreach ($c as $v) {
    $v = $v / 255;
    $o[] = ($v <= 0.03928) ? $v / 12.92 : pow(($v + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * $o[0] + 0.7152 * $o[1] + 0.0722 * $o[2];
}

function bazar_contrast($a, $b) {
  $l1 = bazar_lum($a);
  $l2 = bazar_lum($b);
  if ($l1 < $l2) { $t = $l1; $l1 = $l2; $l2 = $t; }
  return ($l1 + 0.05) / ($l2 + 0.05);
}

/** رنگ را تا رسیدن به حداقل کنتراست با $against، به سمت $toward می‌برد. */
function bazar_ensure($c, $against, $min, $toward) {
  for ($i = 0; $i < 30 && bazar_contrast($c, $against) < $min; $i++) {
    $c = bazar_mix($c, $toward, 0.08);
  }
  return $c;
}

/** پالت کامل از ۴ رنگ انتخابی؛ همه‌ی ترکیب‌های متن/پس‌زمینه خوانا می‌مانند. */
function bazar_palette() {
  $ink    = bazar_ensure(bazar_opt('color_ink'),   '#ffffff', 10,  '#000000');
  $brand  = bazar_ensure(bazar_opt('color_brand'), '#ffffff', 4.5, '#000000');
  $accent = bazar_opt('color_accent');
  $sale   = bazar_ensure(bazar_opt('color_sale'),  '#ffffff', 4.5, '#000000');

  $p = array();
  $p['ink']       = $ink;
  $p['brand']     = $brand;
  $p['brand-d']   = bazar_mix($brand, '#000000', 0.28);
  $p['brand-l']   = bazar_mix($brand, '#ffffff', 0.90);
  $p['accent']    = $accent;
  $p['on-accent'] = (bazar_contrast($accent, $ink) >= bazar_contrast($accent, '#ffffff')) ? $ink : '#ffffff';
  $p['sale']      = $sale;
  $p['bg']        = bazar_mix($brand, '#ffffff', 0.96);
  $p['soft']      = bazar_mix($brand, '#ffffff', 0.92);
  $p['line']      = bazar_mix($brand, '#ffffff', 0.85);
  $p['mut']       = bazar_ensure(bazar_mix($ink, '#ffffff', 0.38), $p['soft'], 4.6, $ink);
  $p['on-dark']   = bazar_ensure(bazar_mix($brand, '#ffffff', 0.78), $brand, 6, '#ffffff');
  if (bazar_contrast($p['on-dark'], $brand) < 4.5) $p['on-dark'] = '#ffffff'; // برندِ در حد مرز: سفید تنها گزینه‌ی مطمئن است
  $p['on-dark-2'] = bazar_ensure(bazar_mix($p['on-dark'], $ink, 0.35), $ink, 4.5, '#ffffff');
  $p['ar-2']      = bazar_mix($brand, '#ffffff', 0.20);
  return $p;
}

function bazar_radii() {
  $m = array('sharp' => array(6, 10, 14), 'soft' => array(12, 20, 32), 'round' => array(16, 26, 40));
  $k = bazar_opt('radius');
  return isset($m[$k]) ? $m[$k] : $m['soft'];
}

/** CSS متغیرهای رنگ و گردی؛ فقط از مقدارهای اعتبارسنجی‌شده ساخته می‌شود. */
function bazar_css_vars() {
  $p   = bazar_palette();
  $r   = bazar_radii();
  $rgb = bazar_hex2rgb($p['ink']);
  $css = ':root{';
  foreach ($p as $k => $v) {
    $css .= '--' . $k . ':' . $v . ';';
  }
  $css .= '--ink-rgb:' . (int) $rgb[0] . ',' . (int) $rgb[1] . ',' . (int) $rgb[2] . ';';
  $css .= '--r-s:' . (int) $r[0] . 'px;--r-m:' . (int) $r[1] . 'px;--r-l:' . (int) $r[2] . 'px}';
  return $css;
}

/* ------------------------------------------------------ Front-end helpers */

/** بخش‌های روشن صفحه اصلی به ترتیب. */
function bazar_home_order() {
  $v   = bazar_value('home_sections');
  $out = array();
  if (is_array($v)) {
    foreach ($v as $row) {
      if (is_array($row) && !empty($row['on']) && isset($row['id'])) $out[] = (string) $row['id'];
    }
  }
  return $out;
}

add_action('after_setup_theme', 'bazar_preview_filters', 20);
function bazar_preview_filters() {
  $pv = bazar_preview_values();
  if (!is_array($pv)) return;
  foreach (bazar_fields() as $k => $f) {
    if (!array_key_exists($k, $pv) || empty($f['store'])) continue;
    $val = $pv[$k];
    if (strpos($f['store'], 'option:') === 0) {
      add_filter('pre_option_' . substr($f['store'], 7), function () use ($val) { return $val; });
    } elseif (strpos($f['store'], 'mod:') === 0) {
      add_filter('theme_mod_' . substr($f['store'], 4), function () use ($val) { return $val; });
    }
  }
}

add_action('wp_head', 'bazar_print_vars', 99);
function bazar_print_vars() {
  echo '<style id="bazar-vars">' . bazar_css_vars() . '</style>' . "\n";
  if (bazar_is_preview()) echo '<meta name="robots" content="noindex,nofollow">' . "\n";
}

add_filter('body_class', 'bazar_body_classes');
function bazar_body_classes($c) {
  if (!bazar_on('tabbar_on')) $c[] = 'bz-no-tabbar';
  if (!bazar_on('topbar_on')) $c[] = 'bz-no-topbar';
  if (bazar_opt('shop_columns') === '3') $c[] = 'bz-cols-3';
  return $c;
}

add_filter('loop_shop_per_page', 'bazar_per_page', 20);
function bazar_per_page($n) {
  $v = (int) bazar_opt('shop_per_page');
  return $v > 0 ? $v : $n;
}

add_filter('loop_shop_columns', 'bazar_loop_columns', 20);
function bazar_loop_columns($n) {
  $v = (int) bazar_opt('shop_columns');
  return $v > 0 ? $v : $n;
}

/** در حالت پیش‌نمایش: کش‌نشدن صفحه و حفظ توکن هنگام کلیک روی لینک‌های داخلی. */
add_action('template_redirect', 'bazar_preview_boot');
function bazar_preview_boot() {
  if (!bazar_is_preview()) return;
  if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
  nocache_headers();
  add_action('wp_footer', 'bazar_preview_script', 99);
}

function bazar_preview_script() {
  if (empty($GLOBALS['bazar_preview_token'])) return;
  $t = esc_js($GLOBALS['bazar_preview_token']);
  echo '<script>(function(t){document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;'
     . 'try{var u=new URL(a.href,location.href);if(u.origin===location.origin&&!u.searchParams.has("bazar_preview")){u.searchParams.set("bazar_preview",t);a.href=u.toString();}}catch(_){}},true);})("' . $t . '");</script>' . "\n";
}
