<?php
if (!defined('ABSPATH')) exit;
define('BAZAR_V', '4.0.0');

/*
 * ماژول‌های تنظیمات (inc/): هر کدام جداگانه و امن بارگذاری می‌شوند؛
 * اگر یکی خطا داشت (مثلاً سینتکس)، قالب با تنظیمات پیش‌فرض کار می‌کند و سایت سفید نمی‌شود.
 */
foreach (array('settings', 'rest', 'customizer') as $bz_part) {
  $bz_file = get_template_directory() . '/inc/' . $bz_part . '.php';
  if (!is_readable($bz_file)) continue;
  try {
    require_once $bz_file;
  } catch (Throwable $bz_e) {
    if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bazar theme: inc/' . $bz_part . '.php failed: ' . $bz_e->getMessage());
  }
}

/* جایگزین‌های حداقلی اگر ماژول settings بارگذاری نشد */
if (!function_exists('bazar_opt')) {
  function bazar_opt($k) {
    $d = array('topbar' => 'ارسال سریع به سراسر کشور', 'about' => 'لباس زنانه، اکسسوری و گجت‌های منتخب با ضمانت اصالت کالا.');
    $v = get_theme_mod('bazar_' . $k, isset($d[$k]) ? $d[$k] : '');
    return is_scalar($v) ? (string) $v : '';
  }
}
if (!function_exists('bazar_on'))         { function bazar_on($k) { return true; } }
if (!function_exists('bazar_value'))      { function bazar_value($k) { return null; } }
if (!function_exists('bazar_is_preview')) { function bazar_is_preview() { return false; } }
if (!function_exists('bazar_home_order')) { function bazar_home_order() { return array('categories', 'featured', 'promo', 'rows', 'benefits'); } }
if (!function_exists('bazar_tel'))        { function bazar_tel($t) { return preg_replace('/[^0-9+]/', '', (string) $t); } }
if (!function_exists('bazar_wa_url'))     { function bazar_wa_url($n) { return ''; } }
if (!function_exists('bazar_palette'))    { function bazar_palette() { return array('bg' => '#F5F6FA'); } }

/** مقدار متنی تنظیم؛ اگر خالی بود متن پیش‌فرض. */
function bazar_or($k, $fallback) {
  $v = trim(bazar_opt($k));
  return $v === '' ? $fallback : $v;
}

/** راه‌های ارتباطی فعال: هر مورد شامل type, href, label, ext. */
function bazar_contacts() {
  $out = array();
  $t = bazar_opt('phone');
  if ($t !== '') $out[] = array('type' => 'phone', 'href' => 'tel:' . bazar_tel($t), 'label' => $t, 'ext' => false);
  $t = bazar_opt('whatsapp');
  if ($t !== '') {
    $u = bazar_wa_url($t);
    if ($u !== '') $out[] = array('type' => 'whatsapp', 'href' => $u, 'label' => 'واتس‌اپ', 'ext' => true);
  }
  $t = bazar_opt('email');
  if ($t !== '') $out[] = array('type' => 'email', 'href' => 'mailto:' . $t, 'label' => $t, 'ext' => false);
  $t = bazar_opt('instagram');
  if ($t !== '') $out[] = array('type' => 'instagram', 'href' => $t, 'label' => 'اینستاگرام', 'ext' => true);
  $t = bazar_opt('telegram');
  if ($t !== '') $out[] = array('type' => 'telegram', 'href' => $t, 'label' => 'تلگرام', 'ext' => true);
  return $out;
}

/** مزایای فروشگاه: آرایه‌ای از [عنوان، توضیح]. */
function bazar_benefits() {
  $d = array(
    array('ارسال به سراسر کشور', 'با کد رهگیری'),
    array('ضمانت اصالت کالا', 'همه محصولات اصل'),
    array('پرداخت امن', 'درگاه آنلاین معتبر'),
    array('پشتیبانی', 'پاسخ‌گویی سریع'),
  );
  $v = bazar_value('benefits');
  if (!is_array($v) || !$v) return $d;
  $out = array();
  foreach ($v as $row) {
    if (is_array($row) && !empty($row['title'])) {
      $out[] = array((string) $row['title'], isset($row['text']) ? (string) $row['text'] : '');
    }
  }
  return $out ? $out : $d;
}

function bazar_icon($n, $c = '') {
  static $p = [
    'search'=>'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5','user'=>'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
    'bag'=>'M6 8h12l1 13H5zM9 8V6a3 3 0 0 1 6 0v2','menu'=>'M4 6h16M4 12h16M4 18h16','home'=>'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
    'grid'=>'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z','close'=>'M6 6l12 12M18 6L6 18','arrow'=>'M15 6l-6 6 6 6',
    'truck'=>'M1 6h13v10H1zM14 9h5l3 3v4h-8M6 19a2 2 0 1 0 .01 0M18 19a2 2 0 1 0 .01 0',
    'shield'=>'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
    'card'=>'M3 6h18v12H3zM3 10h18M7 15h4','chat'=>'M4 5h16v11H9l-5 4z'];
  return '<svg class="ic '.$c.'" viewBox="0 0 24 24" aria-hidden="true"><path d="'.($p[$n] ?? '').'"/></svg>';
}

function bazar_cart_badge() { $n = bazar_cart_count(); return '<b class="cart-count'.($n ? '' : ' is-zero').'">'.$n.'</b>'; }
function bazar_account_url() { return function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : wp_login_url(); }
function bazar_shop_url()    { return function_exists('wc_get_page_id') ? get_permalink(wc_get_page_id('shop')) : home_url('/'); }
function bazar_cart_count()  { return function_exists('WC') && WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0; }
function bazar_term_img($t, $size = 'large') { $id = get_term_meta($t->term_id, 'thumbnail_id', true); return $id ? wp_get_attachment_image_url($id, $size) : ''; }
function bazar_top_cats($n = 12) {
  if (!taxonomy_exists('product_cat')) return [];
  $c = get_terms(['taxonomy'=>'product_cat','parent'=>0,'hide_empty'=>false,'exclude'=>[(int) get_option('default_product_cat')],'number'=>$n,'orderby'=>'menu_order']);
  return is_wp_error($c) ? [] : $c;
}
function bazar_cat_list($depth = 2) {
  if (!taxonomy_exists('product_cat')) return;
  echo '<ul class="catlist">';
  wp_list_categories(['taxonomy'=>'product_cat','title_li'=>'','hide_empty'=>0,'depth'=>$depth,'exclude'=>(int) get_option('default_product_cat')]);
  echo '</ul>';
}
function bazar_fallback_menu() {
  echo '<ul><li><a href="'.esc_url(bazar_shop_url()).'">فروشگاه</a></li>';
  if (function_exists('wc_get_cart_url')) echo '<li><a href="'.esc_url(wc_get_cart_url()).'">سبد خرید</a></li>';
  echo '<li><a href="'.esc_url(bazar_account_url()).'">حساب من</a></li></ul>';
}

add_action('after_setup_theme', function () {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
  add_theme_support('html5', ['search-form','gallery','caption','style','script']);
  add_theme_support('custom-logo', ['height'=>48,'width'=>180,'flex-width'=>true]);
  add_theme_support('woocommerce');
  add_theme_support('wc-product-gallery-zoom');
  add_theme_support('wc-product-gallery-lightbox');
  add_theme_support('wc-product-gallery-slider');
  register_nav_menus(['primary'=>'منوی اصلی','footer'=>'منوی فوتر']);
});

add_action('widgets_init', function () {
  register_sidebar(['name'=>'فیلترهای فروشگاه','id'=>'shop','before_widget'=>'<section class="widget %2$s">','after_widget'=>'</section>','before_title'=>'<h3 class="widget-title">','after_title'=>'</h3>']);
});

add_action('wp_enqueue_scripts', function () {
  wp_enqueue_style('bazar', get_stylesheet_uri(), [], BAZAR_V);
  wp_enqueue_script('bazar', get_template_directory_uri().'/assets/main.js', [], BAZAR_V, true);
}, 20);

add_action('wp_head', function () {
  echo '<script>if(/BazarApp/.test(navigator.userAgent))document.documentElement.classList.add("in-app")</script>';
  foreach (['Vazirmatn-Variable.woff2','Lalezar-Regular.woff2'] as $f)
    if (file_exists(get_template_directory().'/assets/fonts/'.$f)) echo '<link rel="preload" href="'.esc_url(get_template_directory_uri().'/assets/fonts/'.$f).'" as="font" type="font/woff2" crossorigin>';
}, 1);

add_filter('woocommerce_add_to_cart_fragments', function ($f) {
  $f['b.cart-count'] = bazar_cart_badge();
  return $f;
});

add_action('wp_footer', function () {
  if (!function_exists('is_product') || !is_product() || !bazar_on('sticky_atc')) return;
  $p = wc_get_product(get_queried_object_id());
  if (!$p) return;
  echo '<div class="satc" hidden><div class="wrap"><span class="satc-t">'.esc_html($p->get_name()).'</span><span>'.wp_kses_post($p->get_price_html()).'</span><button class="btn" data-atc type="button">افزودن به سبد</button></div></div>';
});

add_action('after_switch_theme', function () {
  if (!taxonomy_exists('product_cat')) return;
  foreach (['لباس زنانه','اکسسوری','گجت'] as $n) if (!term_exists($n, 'product_cat')) wp_insert_term($n, 'product_cat');
});
