<?php
/**
 * مدیریت محصولات و سئوی هر محصول از اپ — namespace: bazar/v1
 *
 * GET    /products/meta     دسته‌ها، نوع افزونه‌ی سئو، واحد پول
 * GET    /products          فهرست  (search, status=publish|draft, category, page)
 * POST   /products          ساخت محصول ساده
 * GET    /products/{id}     جزئیات کامل
 * POST   /products/{id}     ویرایش جزئی (PUT و PATCH هم)
 * DELETE /products/{id}     انتقال به زباله‌دان (قابل بازیابی)
 *
 * ورود: Application Passwords. دسترسی: توانایی edit_products (مدیر و مدیر فروشگاه).
 * سئو: اگر Rank Math یا Yoast فعال باشد در همان‌ها ذخیره می‌شود؛ در غیر این‌صورت سئوی داخلی قالب.
 */
if (!defined('ABSPATH')) exit;

add_action('rest_api_init', 'bazar_prod_routes');
function bazar_prod_routes() {
  $ns = 'bazar/v1';
  register_rest_route($ns, '/products/meta', array(
    'methods' => 'GET', 'callback' => 'bazar_prod_rest_meta', 'permission_callback' => 'bazar_prod_can',
  ));
  register_rest_route($ns, '/products', array(
    array('methods' => 'GET',  'callback' => 'bazar_prod_rest_list',   'permission_callback' => 'bazar_prod_can'),
    array('methods' => 'POST', 'callback' => 'bazar_prod_rest_create', 'permission_callback' => 'bazar_prod_can_create'),
  ));
  register_rest_route($ns, '/products/(?P<id>\d+)', array(
    array('methods' => 'GET',                'callback' => 'bazar_prod_rest_get',    'permission_callback' => 'bazar_prod_can_one'),
    array('methods' => 'POST, PUT, PATCH',   'callback' => 'bazar_prod_rest_update', 'permission_callback' => 'bazar_prod_can_one'),
    array('methods' => 'DELETE',             'callback' => 'bazar_prod_rest_delete', 'permission_callback' => 'bazar_prod_can_delete'),
  ));
}

/* ---------------------------------------------------------------- دسترسی */

function bazar_prod_can() {
  return function_exists('wc_get_product') && current_user_can('edit_products');
}
function bazar_prod_can_create() {
  return function_exists('wc_get_product') && current_user_can('edit_products') && current_user_can('publish_products');
}
function bazar_prod_can_one($req) {
  $id = (int) $req['id'];
  return function_exists('wc_get_product') && $id > 0 && get_post_type($id) === 'product' && current_user_can('edit_post', $id);
}
function bazar_prod_can_delete($req) {
  $id = (int) $req['id'];
  return function_exists('wc_get_product') && $id > 0 && get_post_type($id) === 'product' && current_user_can('delete_post', $id);
}

/* ------------------------------------------------------------------ سئو */

/** نوع ذخیره‌سازی سئو: rankmath | yoast | other | native */
function bazar_pseo_driver() {
  if (defined('RANK_MATH_VERSION') || class_exists('RankMath')) return 'rankmath';
  if (defined('WPSEO_VERSION')) return 'yoast';
  if (function_exists('bazar_seo_plugin_active') && bazar_seo_plugin_active()) return 'other';
  return 'native';
}

function bazar_pseo_label($driver) {
  $m = array('rankmath' => 'Rank Math', 'yoast' => 'Yoast SEO', 'other' => 'افزونه‌ی سئوی دیگر', 'native' => 'سئوی داخلی قالب');
  return isset($m[$driver]) ? $m[$driver] : '';
}

/** کلیدهای متای هر نوع. برای «other» خالی است (قابل ذخیره نیست). */
function bazar_pseo_keys($driver) {
  if ($driver === 'rankmath') return array('title' => 'rank_math_title', 'desc' => 'rank_math_description', 'kw' => 'rank_math_focus_keyword');
  if ($driver === 'yoast')    return array('title' => '_yoast_wpseo_title', 'desc' => '_yoast_wpseo_metadesc', 'kw' => '_yoast_wpseo_focuskw');
  if ($driver === 'native')   return array('title' => '_bazar_seo_title', 'desc' => '_bazar_seo_desc', 'kw' => '_bazar_seo_kw', 'noindex' => '_bazar_seo_noindex');
  return array();
}

/** عنوان سئو (فقط حالت داخلی) */
add_filter('pre_get_document_title', 'bazar_pseo_title', 20);
function bazar_pseo_title($title) {
  if (is_admin() || !is_singular('product') || bazar_pseo_driver() !== 'native') return $title;
  $t = get_post_meta(get_queried_object_id(), '_bazar_seo_title', true);
  return (is_string($t) && $t !== '') ? $t : $title;
}

/** noindex برای محصول (فقط حالت داخلی) */
add_filter('wp_robots', 'bazar_pseo_robots');
function bazar_pseo_robots($robots) {
  if (!is_array($robots) || !is_singular('product') || bazar_pseo_driver() !== 'native') return $robots;
  if (get_post_meta(get_queried_object_id(), '_bazar_seo_noindex', true) === '1') {
    $robots['noindex'] = true;
    $robots['follow']  = true;
    unset($robots['max-image-preview']);
  }
  return $robots;
}

/* ----------------------------------------------------------- کمکی‌های داده */

function bazar_prod_digits($s) {
  return strtr((string) $s, array(
    '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
    '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    '٫' => '.', '٬' => '', ',' => '',
  ));
}

/** قیمت معتبر → رشته (خالی = بدون قیمت). نامعتبر → false */
function bazar_prod_price($v) {
  $s = trim(bazar_prod_digits($v));
  if ($s === '') return '';
  if (!preg_match('/^[0-9]{1,12}(\.[0-9]{1,4})?$/', $s)) return false;
  return wc_format_decimal($s);
}

function bazar_prod_img($id) {
  $id = (int) $id;
  if ($id <= 0) return array('id' => 0, 'url' => '', 'alt' => '');
  $u = wp_get_attachment_image_url($id, 'medium');
  return array('id' => $id, 'url' => $u ? $u : '', 'alt' => (string) get_post_meta($id, '_wp_attachment_image_alt', true));
}

/** شناسه‌ی پیوست تصویری معتبر یا 0 */
function bazar_prod_attachment($v) {
  $id = is_array($v) && isset($v['id']) ? (int) $v['id'] : (int) $v;
  if ($id > 0 && get_post_type($id) === 'attachment' && wp_attachment_is_image($id)) return $id;
  return 0;
}

function bazar_prod_present($p, $full = false) {
  $driver = bazar_pseo_driver();
  $keys   = bazar_pseo_keys($driver);
  $id     = $p->get_id();
  $seo    = array('title' => '', 'desc' => '', 'kw' => '', 'noindex' => false);
  foreach (array('title', 'desc', 'kw') as $k) {
    if (isset($keys[$k])) $seo[$k] = (string) get_post_meta($id, $keys[$k], true);
  }
  if (isset($keys['noindex'])) $seo['noindex'] = get_post_meta($id, $keys['noindex'], true) === '1';

  $out = array(
    'id'            => $id,
    'name'          => $p->get_name(),
    'slug'          => rawurldecode((string) $p->get_slug()),
    'status'        => $p->get_status(),
    'type'          => $p->get_type(),
    'sku'           => (string) $p->get_sku(),
    'price'         => (string) $p->get_price(),
    'regular_price' => (string) $p->get_regular_price(),
    'sale_price'    => (string) $p->get_sale_price(),
    'manage_stock'  => (bool) $p->get_manage_stock(),
    'stock_quantity' => $p->get_stock_quantity(),
    'stock_status'  => $p->get_stock_status(),
    'image'         => bazar_prod_img($p->get_image_id()),
    'permalink'     => get_permalink($id),
    'edit_prices'   => in_array($p->get_type(), array('simple', 'external'), true),
    'categories'    => array_map('intval', $p->get_category_ids()),
    'seo'           => $seo,
    'seo_set'       => ($seo['title'] !== '' && $seo['desc'] !== ''),
  );
  if ($full) {
    $out['description']       = (string) $p->get_description();
    $out['short_description'] = (string) $p->get_short_description();
    $out['gallery']           = array_map('bazar_prod_img', $p->get_gallery_image_ids());
    $out['seo_driver']        = $driver;
  }
  return $out;
}

function bazar_prod_body($req) {
  $in = $req->get_json_params();
  if (!is_array($in)) $in = $req->get_params();
  return is_array($in) ? $in : array();
}

/** مقدارهای ارسالی را روی شیء محصول اعمال می‌کند (هنوز ذخیره نمی‌کند). true یا WP_Error */
function bazar_prod_apply($p, $in) {
  try {
    if (isset($in['name'])) {
      $n = trim(sanitize_text_field((string) $in['name']));
      if ($n === '') return new WP_Error('bazar_bad_request', 'نام محصول نمی‌تواند خالی باشد.', array('status' => 400));
      $p->set_name(mb_substr($n, 0, 200));
    }
    if (isset($in['slug'])) {
      $sl = sanitize_title((string) $in['slug']);
      if ($sl !== '') $p->set_slug($sl);
    }
    if (isset($in['status']) && in_array($in['status'], array('publish', 'draft', 'pending', 'private'), true)) {
      $st = $in['status'];
      if (($st === 'publish' || $st === 'private') && !current_user_can('publish_products')) $st = 'pending';
      $p->set_status($st);
    }
    if (isset($in['short_description'])) $p->set_short_description(wp_kses_post((string) $in['short_description']));
    if (isset($in['description']))       $p->set_description(wp_kses_post((string) $in['description']));
    if (isset($in['sku'])) $p->set_sku(wc_clean((string) $in['sku']));

    if ($p->is_type('simple') || $p->is_type('external')) {
      if (array_key_exists('regular_price', $in)) {
        $v = bazar_prod_price($in['regular_price']);
        if ($v === false) return new WP_Error('bazar_bad_request', 'قیمت اصلی معتبر نیست؛ فقط عدد وارد کنید.', array('status' => 400));
        $p->set_regular_price($v);
      }
      if (array_key_exists('sale_price', $in)) {
        $v = bazar_prod_price($in['sale_price']);
        if ($v === false) return new WP_Error('bazar_bad_request', 'قیمت با تخفیف معتبر نیست؛ فقط عدد وارد کنید.', array('status' => 400));
        $p->set_sale_price($v);
      }
      $reg  = (string) $p->get_regular_price();
      $sale = (string) $p->get_sale_price();
      if ($sale !== '' && ($reg === '' || (float) $sale >= (float) $reg)) {
        return new WP_Error('bazar_bad_request', 'قیمت با تخفیف باید کمتر از قیمت اصلی باشد.', array('status' => 400));
      }
    }

    if (array_key_exists('manage_stock', $in)) $p->set_manage_stock(!empty($in['manage_stock']));
    if ($p->get_manage_stock()) {
      if (isset($in['stock_quantity'])) $p->set_stock_quantity((int) bazar_prod_digits($in['stock_quantity']));
    } elseif (isset($in['stock_status']) && in_array($in['stock_status'], array('instock', 'outofstock', 'onbackorder'), true)) {
      $p->set_stock_status($in['stock_status']);
    }

    if (isset($in['categories']) && is_array($in['categories'])) {
      $ids = array();
      foreach ($in['categories'] as $c) {
        $c = (int) $c;
        if ($c > 0 && term_exists($c, 'product_cat')) $ids[] = $c;
      }
      $p->set_category_ids(array_values(array_unique($ids)));
    }

    if (array_key_exists('image', $in)) $p->set_image_id(bazar_prod_attachment($in['image']));
    if (isset($in['gallery']) && is_array($in['gallery'])) {
      $g = array();
      foreach (array_slice($in['gallery'], 0, 12) as $x) {
        $aid = bazar_prod_attachment($x);
        if ($aid > 0) $g[] = $aid;
      }
      $p->set_gallery_image_ids(array_values(array_unique($g)));
    }
  } catch (Throwable $e) {
    return new WP_Error('bazar_bad_request', $e->getMessage(), array('status' => 400));
  }
  return true;
}

function bazar_prod_save_seo($id, $in) {
  if (!isset($in['seo']) || !is_array($in['seo'])) return;
  $keys = bazar_pseo_keys(bazar_pseo_driver());
  if (!$keys) return;
  $caps = array('title' => 120, 'desc' => 320, 'kw' => 80);
  foreach ($caps as $k => $max) {
    if (!isset($keys[$k]) || !array_key_exists($k, $in['seo'])) continue;
    $v = trim(preg_replace('/\s+/u', ' ', sanitize_text_field(mb_substr((string) $in['seo'][$k], 0, $max))));
    if ($v === '') delete_post_meta($id, $keys[$k]); else update_post_meta($id, $keys[$k], $v);
  }
  if (isset($keys['noindex']) && array_key_exists('noindex', $in['seo'])) {
    if (!empty($in['seo']['noindex'])) update_post_meta($id, $keys['noindex'], '1'); else delete_post_meta($id, $keys['noindex']);
  }
}

/** متن جایگزین تصاویر: alts = { "شناسه‌ی تصویر": "متن" } */
function bazar_prod_save_alts($in) {
  if (!isset($in['alts']) || !is_array($in['alts'])) return;
  foreach (array_slice($in['alts'], 0, 30, true) as $aid => $alt) {
    $aid = (int) $aid;
    if ($aid > 0 && get_post_type($aid) === 'attachment' && current_user_can('edit_post', $aid)) {
      update_post_meta($aid, '_wp_attachment_image_alt', sanitize_text_field(mb_substr((string) $alt, 0, 125)));
    }
  }
}

function bazar_prod_write($p, $in) {
  $ok = bazar_prod_apply($p, $in);
  if (is_wp_error($ok)) return $ok;
  try {
    $p->save();
  } catch (Throwable $e) {
    return new WP_Error('bazar_save_failed', $e->getMessage(), array('status' => 400));
  }
  $id = (int) $p->get_id();
  bazar_prod_save_seo($id, $in);
  bazar_prod_save_alts($in);
  // افزونه‌های سئو بعد از ذخیره‌ی نوشته، ایندکس خودشان را به‌روز می‌کنند.
  if (bazar_pseo_driver() !== 'native') wp_update_post(array('ID' => $id));
  if (function_exists('bazar_purge_caches')) bazar_purge_caches();
  $fresh = wc_get_product($id);
  return rest_ensure_response(bazar_prod_present($fresh ? $fresh : $p, true));
}

/* ------------------------------------------------------------- پاسخ‌ها */

function bazar_prod_rest_meta() {
  $cats  = array();
  $terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false, 'orderby' => 'name', 'exclude' => array((int) get_option('default_product_cat'))));
  if (!is_wp_error($terms)) {
    foreach ($terms as $t) $cats[] = array('id' => (int) $t->term_id, 'name' => $t->name, 'parent' => (int) $t->parent);
  }
  $driver = bazar_pseo_driver();
  $keys   = bazar_pseo_keys($driver);
  return rest_ensure_response(array(
    'categories' => $cats,
    'seo'        => array('driver' => $driver, 'label' => bazar_pseo_label($driver), 'writable' => !empty($keys), 'noindex' => isset($keys['noindex'])),
    'currency'   => html_entity_decode(get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8'),
    'site'       => array('name' => get_bloginfo('name'), 'url' => home_url('/')),
  ));
}

function bazar_prod_rest_list($req) {
  $page = max(1, (int) $req->get_param('page'));
  $args = array(
    'post_type' => 'product', 'post_status' => array('publish', 'draft', 'pending', 'private'),
    'posts_per_page' => 20, 'paged' => $page, 'orderby' => 'date', 'order' => 'DESC',
  );
  $st = $req->get_param('status');
  if ($st === 'publish' || $st === 'draft') $args['post_status'] = $st;
  $s = trim((string) $req->get_param('search'));
  if ($s !== '') $args['s'] = $s;
  $cat = (int) $req->get_param('category');
  if ($cat > 0) $args['tax_query'] = array(array('taxonomy' => 'product_cat', 'field' => 'term_id', 'terms' => array($cat)));

  $q = new WP_Query($args);
  $items = array();
  foreach ($q->posts as $post) {
    $p = wc_get_product($post);
    if ($p) $items[] = bazar_prod_present($p);
  }
  return rest_ensure_response(array('items' => $items, 'total' => (int) $q->found_posts, 'pages' => (int) $q->max_num_pages, 'page' => $page));
}

function bazar_prod_rest_get($req) {
  $p = wc_get_product((int) $req['id']);
  if (!$p) return new WP_Error('bazar_not_found', 'محصول پیدا نشد.', array('status' => 404));
  return rest_ensure_response(bazar_prod_present($p, true));
}

function bazar_prod_rest_create($req) {
  $in = bazar_prod_body($req);
  $n  = isset($in['name']) ? trim(sanitize_text_field((string) $in['name'])) : '';
  if ($n === '') return new WP_Error('bazar_bad_request', 'نام محصول الزامی است.', array('status' => 400));
  $p = new WC_Product_Simple();
  $p->set_status('draft');
  return bazar_prod_write($p, $in);
}

function bazar_prod_rest_update($req) {
  $p = wc_get_product((int) $req['id']);
  if (!$p) return new WP_Error('bazar_not_found', 'محصول پیدا نشد.', array('status' => 404));
  return bazar_prod_write($p, bazar_prod_body($req));
}

function bazar_prod_rest_delete($req) {
  $id = (int) $req['id'];
  if (!wp_trash_post($id)) return new WP_Error('bazar_delete_failed', 'انتقال به زباله‌دان انجام نشد.', array('status' => 500));
  if (function_exists('bazar_purge_caches')) bazar_purge_caches();
  return rest_ensure_response(array('deleted' => true, 'id' => $id));
}
