<?php
if (!defined('ABSPATH')) exit;

/*
 * امکانات اضافه‌ی قالب (همه از اپ قابل تنظیم‌اند):
 *  - دکمه‌های شناور تماس و واتس‌اپ، پاپ‌آپ، لینک و دکمه‌ی بستن برای نوار بالا
 *  - علاقه‌مندی، مقایسه، اشتراک‌گذاری و محصولات مرتبط در ووکامرس
 *  - سئو (متا، شبکه‌های اجتماعی، اسکیما) و سرعت (پاکسازی هدر، WebP)
 * اگر این فایل خطا بدهد، بقیه‌ی قالب بدون این امکانات کار می‌کند.
 */

/** آیکن‌های این ماژول (SVG داخلی؛ بدون وابستگی به آیکن‌های دیگر قالب). */
function bazar_x_icon($n) {
  $p = array(
    'heart'   => 'M12 21s-8-5.3-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.7-8 11-8 11z',
    'compare' => 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
    'share'   => 'M4 12v7h16v-7M12 3v12M7 8l5-5 5 5',
    'phone'   => 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    'chat'    => 'M4 5h16v11H9l-5 4z',
    'close'   => 'M6 6l12 12M18 6L6 18',
  );
  $d = isset($p[$n]) ? $p[$n] : '';
  return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' . $d . '"/></svg>';
}

/* ---------------------------------------------------------------- Scripts */

add_action('wp_enqueue_scripts', 'bazar_extras_assets', 25);
function bazar_extras_assets() {
  wp_enqueue_script('bazar-extras', get_template_directory_uri() . '/assets/extras.js', array('bazar'), BAZAR_V, true);
}

/* --------------------------------------------------- دکمه‌های شناور تماس */

add_action('wp_footer', 'bazar_floating_html', 5);
function bazar_floating_html() {
  if (!bazar_on('float_on')) return;
  $links = array();
  foreach (bazar_contacts() as $c) {
    if ($c['type'] === 'whatsapp' && bazar_on('float_wa')) $links[] = $c;
    if ($c['type'] === 'phone' && bazar_on('float_tel')) $links[] = $c;
  }
  if (!$links) return;
  $pos = bazar_opt('float_pos') === 'right' ? 'right' : 'left';
  echo '<div class="fab fab-' . $pos . '">';
  foreach ($links as $c) {
    $wa    = $c['type'] === 'whatsapp';
    $label = $wa ? 'گفتگو در واتس‌اپ' : 'تماس تلفنی';
    echo '<a class="fab-b fab-' . esc_attr($c['type']) . '" href="' . esc_url($c['href']) . '"' . ($c['ext'] ? ' rel="noopener" target="_blank"' : '') . ' aria-label="' . esc_attr($label) . '">' . bazar_x_icon($wa ? 'chat' : 'phone') . '</a>';
  }
  echo '</div>';
}

/* ------------------------------------------------------------- پاپ‌آپ */

add_action('wp_footer', 'bazar_popup_html', 6);
function bazar_popup_html() {
  if (!bazar_on('popup_on')) return;
  if (function_exists('is_cart') && (is_cart() || is_checkout())) return;
  $title = trim(bazar_opt('popup_title'));
  $text  = trim(bazar_opt('popup_text'));
  $id    = (int) bazar_value('popup_img');
  $img   = ($id > 0 && wp_attachment_is_image($id)) ? wp_get_attachment_image($id, 'large', false, array('loading' => 'lazy', 'alt' => '')) : '';
  if ($title === '' && $text === '' && $img === '') return;
  $btn   = trim(bazar_opt('popup_btn'));
  $url   = trim(bazar_opt('popup_url'));
  $freq  = bazar_opt('popup_freq');
  if (!in_array($freq, array('session', 'day', 'week'), true)) $freq = 'day';
  $delay = max(1, min(60, (int) bazar_opt('popup_delay')));
  $key   = substr(md5($title . '|' . $text . '|' . $url . '|' . $id), 0, 8);

  echo '<div id="bz-popup" class="bzp" hidden role="dialog" aria-modal="true"' . ($title !== '' ? ' aria-labelledby="bzp-t"' : '') . ' data-key="' . esc_attr($key) . '" data-freq="' . esc_attr($freq) . '" data-delay="' . (int) $delay . '" data-preview="' . (bazar_is_preview() ? '1' : '0') . '">';
  echo '<div class="bzp-box"><button type="button" class="bzp-x" data-bzp-close aria-label="بستن">' . bazar_x_icon('close') . '</button>';
  echo $img;
  echo '<div class="bzp-c">';
  if ($title !== '') echo '<h2 id="bzp-t">' . esc_html($title) . '</h2>';
  if ($text !== '') echo '<p>' . esc_html($text) . '</p>';
  if ($btn !== '' && $url !== '') echo '<a class="btn btn-a" href="' . esc_url(bazar_nav_href($url)) . '">' . esc_html($btn) . '</a>';
  echo '</div></div></div>';
}

/* ------------------------------------- علاقه‌مندی، مقایسه و اشتراک‌گذاری */

function bazar_lists_enabled() {
  return bazar_on('wish_on') || bazar_on('compare_on');
}

/** دکمه‌ی قلب در هدر (باز کردن لیست علاقه‌مندی و مقایسه). */
function bazar_lists_button() {
  if (!bazar_lists_enabled()) return;
  $tab   = bazar_on('wish_on') ? 'wish' : 'compare';
  $label = bazar_or($tab === 'wish' ? 'wish_label' : 'compare_label', $tab === 'wish' ? 'علاقه‌مندی' : 'مقایسه');
  echo '<button class="ico" data-open="#drawer-lists" data-lists-tab="' . esc_attr($tab) . '" aria-label="' . esc_attr($label) . '">' . bazar_x_icon($tab === 'wish' ? 'heart' : 'compare') . '<b class="cart-count is-zero" data-lists-count>0</b></button>';
}

/** قلب روی کارت محصول در لیست‌ها. */
add_action('woocommerce_after_shop_loop_item', 'bazar_loop_heart', 6);
function bazar_loop_heart() {
  if (!bazar_on('wish_on')) return;
  global $product;
  if (!$product) return;
  $label = bazar_or('wish_label', 'علاقه‌مندی');
  echo '<button type="button" class="pcard-heart" data-wish="' . (int) $product->get_id() . '" aria-pressed="false" aria-label="' . esc_attr($label) . '">' . bazar_x_icon('heart') . '</button>';
}

/** دکمه‌های صفحه‌ی محصول: علاقه‌مندی، مقایسه، اشتراک‌گذاری. */
add_action('woocommerce_single_product_summary', 'bazar_product_actions', 35);
function bazar_product_actions() {
  global $product;
  if (!$product) return;
  $w = bazar_on('wish_on');
  $c = bazar_on('compare_on');
  $s = bazar_on('share_on');
  if (!$w && !$c && !$s) return;
  $id = (int) $product->get_id();
  echo '<div class="pact">';
  if ($w) echo '<button type="button" class="pact-b" data-wish="' . $id . '" aria-pressed="false">' . bazar_x_icon('heart') . '<span>' . esc_html(bazar_or('wish_label', 'علاقه‌مندی')) . '</span></button>';
  if ($c) echo '<button type="button" class="pact-b" data-cmp="' . $id . '" aria-pressed="false">' . bazar_x_icon('compare') . '<span>' . esc_html(bazar_or('compare_label', 'مقایسه')) . '</span></button>';
  if ($s) echo '<button type="button" class="pact-b" data-share data-title="' . esc_attr($product->get_name()) . '" data-url="' . esc_url(get_permalink($id)) . '">' . bazar_x_icon('share') . '<span>' . esc_html(bazar_or('share_label', 'اشتراک‌گذاری')) . '</span></button>';
  echo '</div>';
}

/** کشوی علاقه‌مندی و مقایسه + دکمه‌ی شناور مقایسه. */
add_action('wp_footer', 'bazar_lists_drawer', 7);
function bazar_lists_drawer() {
  if (!bazar_lists_enabled()) return;
  $w  = bazar_on('wish_on');
  $c  = bazar_on('compare_on');
  $wl = bazar_or('wish_label', 'علاقه‌مندی');
  $cl = bazar_or('compare_label', 'مقایسه');
  echo '<aside id="drawer-lists" class="drawer drawer-end" aria-hidden="true" aria-label="' . esc_attr($wl . ' / ' . $cl) . '" data-api="' . esc_url(rest_url('wc/store/v1/products')) . '">';
  echo '<div class="drawer-h"><h2>' . esc_html($w && !$c ? $wl : ($c && !$w ? $cl : $wl . ' و ' . $cl)) . '</h2><button class="ico" data-close aria-label="بستن">' . bazar_x_icon('close') . '</button></div>';
  if ($w && $c) {
    echo '<div class="ltabs" role="tablist">';
    echo '<button type="button" role="tab" id="tl-wish" aria-controls="pl-wish" aria-selected="true">' . esc_html($wl) . '</button>';
    echo '<button type="button" role="tab" id="tl-compare" aria-controls="pl-compare" aria-selected="false" tabindex="-1">' . esc_html($cl) . '</button>';
    echo '</div>';
  }
  if ($w) echo '<div id="pl-wish" role="tabpanel" data-list="wish"></div>';
  if ($c) echo '<div id="pl-compare" role="tabpanel" data-list="compare"' . ($w ? ' hidden' : '') . '></div>';
  echo '</aside>';
  if ($c) {
    echo '<button type="button" class="cmp-pill" data-open="#drawer-lists" data-lists-tab="compare" hidden>' . bazar_x_icon('compare') . esc_html($cl) . ' (<span data-cmp-count>0</span>)</button>';
  }
}

/** محصولات مرتبط: روشن/خاموش و تعداد. */
add_action('wp', 'bazar_related_setup');
function bazar_related_setup() {
  if (!bazar_on('related_on')) {
    remove_action('woocommerce_after_single_product_summary', 'woocommerce_output_related_products', 20);
  }
}
add_filter('woocommerce_output_related_products_args', 'bazar_related_args');
function bazar_related_args($args) {
  $n = max(2, min(8, (int) bazar_opt('related_n')));
  $args['posts_per_page'] = $n;
  $args['columns']        = min(4, $n);
  return $args;
}

/* ------------------------------------------------------------------ سئو */

function bazar_seo_plugin_active() {
  return defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION') || defined('AIOSEO_VERSION')
    || defined('SEOPRESS_VERSION') || defined('THE_SEO_FRAMEWORK_VERSION') || class_exists('RankMath');
}

function bazar_seo_clean($s, $max) {
  $s = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags((string) $s)));
  return mb_strlen($s) > $max ? mb_substr($s, 0, $max - 1) . '…' : $s;
}

add_action('wp_head', 'bazar_seo_head', 5);
function bazar_seo_head() {
  if (is_admin() || is_feed() || is_robots() || is_trackback()) return;
  if (!bazar_on('seo_meta') || bazar_seo_plugin_active()) return;

  $url = '';
  $desc = '';
  $img = '';
  $type = 'website';
  $price = '';

  if (is_front_page()) {
    $url  = home_url('/');
    $desc = trim(bazar_opt('seo_desc'));
    if ($desc === '') $desc = get_bloginfo('description');
  } elseif (is_singular()) {
    $post = get_queried_object();
    if (!$post || empty($post->ID)) return;
    $url  = get_permalink($post);
    $desc = has_excerpt($post) ? $post->post_excerpt : strip_shortcodes($post->post_content);
    $custom = get_post_meta($post->ID, '_bazar_seo_desc', true);
    if (is_string($custom) && $custom !== '') $desc = $custom;
    $tid  = get_post_thumbnail_id($post);
    if ($tid) $img = (string) wp_get_attachment_image_url($tid, 'large');
    $type = get_post_type($post) === 'product' ? 'product' : 'article';
    if ($type === 'product' && function_exists('wc_get_product')) {
      $p = wc_get_product($post->ID);
      if ($p && $p->get_price() !== '') $price = (string) $p->get_price();
    }
  } elseif (is_tax() || is_category() || is_tag()) {
    $t = get_queried_object();
    if (!$t || empty($t->term_id)) return;
    $l = get_term_link($t);
    if (is_wp_error($l)) return;
    $url  = $l;
    $desc = term_description($t);
    $tid  = (int) get_term_meta($t->term_id, 'thumbnail_id', true);
    if ($tid) $img = (string) wp_get_attachment_image_url($tid, 'large');
  } else {
    return;
  }

  if ($img === '') {
    $sid = (int) bazar_value('seo_img');
    if ($sid > 0) $img = (string) wp_get_attachment_image_url($sid, 'large');
  }
  if ($img === '') {
    $lid = (int) get_theme_mod('custom_logo');
    if ($lid > 0) $img = (string) wp_get_attachment_image_url($lid, 'large');
  }
  if ($img === '' && function_exists('get_site_icon_url')) $img = (string) get_site_icon_url(512);

  $desc  = bazar_seo_clean($desc, 160);
  $title = wp_get_document_title();

  if ($desc !== '') echo '<meta name="description" content="' . esc_attr($desc) . '">' . "\n";
  echo '<meta property="og:locale" content="' . esc_attr(get_locale()) . '">' . "\n";
  echo '<meta property="og:type" content="' . esc_attr($type) . '">' . "\n";
  echo '<meta property="og:title" content="' . esc_attr($title) . '">' . "\n";
  if ($desc !== '') echo '<meta property="og:description" content="' . esc_attr($desc) . '">' . "\n";
  echo '<meta property="og:url" content="' . esc_url($url) . '">' . "\n";
  echo '<meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '">' . "\n";
  if ($img !== '') echo '<meta property="og:image" content="' . esc_url($img) . '">' . "\n";
  echo '<meta name="twitter:card" content="' . ($img !== '' ? 'summary_large_image' : 'summary') . '">' . "\n";
  if ($price !== '' && function_exists('get_woocommerce_currency')) {
    echo '<meta property="product:price:amount" content="' . esc_attr($price) . '">' . "\n";
    echo '<meta property="product:price:currency" content="' . esc_attr(get_woocommerce_currency()) . '">' . "\n";
  }
}

/** اسکیمای سازمان و وب‌سایت برای صفحه‌ی اصلی (اسکیمای محصول و مسیر را خود ووکامرس می‌سازد). */
add_action('wp_head', 'bazar_schema_head', 6);
function bazar_schema_head() {
  if (is_admin() || !is_front_page() || !bazar_on('seo_schema')) return;
  if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION') || defined('AIOSEO_VERSION')) return;

  $org = array('@type' => 'Organization', 'name' => get_bloginfo('name'), 'url' => home_url('/'));
  $lid = (int) get_theme_mod('custom_logo');
  if ($lid > 0) {
    $logo = wp_get_attachment_image_url($lid, 'full');
    if ($logo) $org['logo'] = $logo;
  }
  $same = array();
  foreach (bazar_contacts() as $c) {
    if ($c['type'] === 'phone')  $org['telephone'] = bazar_tel(bazar_opt('phone'));
    if ($c['type'] === 'email')  $org['email'] = bazar_opt('email');
    if ($c['type'] === 'instagram' || $c['type'] === 'telegram') $same[] = $c['href'];
  }
  if ($same) $org['sameAs'] = $same;

  $site = array(
    '@type'           => 'WebSite',
    'name'            => get_bloginfo('name'),
    'url'             => home_url('/'),
    'inLanguage'      => get_bloginfo('language'),
    'potentialAction' => array(
      '@type'       => 'SearchAction',
      'target'      => home_url('/') . '?s={search_term_string}&post_type=product',
      'query-input' => 'required name=search_term_string',
    ),
  );
  $graph = array('@context' => 'https://schema.org', '@graph' => array($org, $site));
  echo '<script type="application/ld+json">' . wp_json_encode($graph, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . '</script>' . "\n";
}

/* ----------------------------------------------------------------- سرعت */

add_action('init', 'bazar_speed_init');
function bazar_speed_init() {
  if (!bazar_on('speed_clean')) return;
  remove_action('wp_head', 'print_emoji_detection_script', 7);
  remove_action('wp_print_styles', 'print_emoji_styles');
  remove_action('wp_head', 'wp_generator');
  remove_action('wp_head', 'wlwmanifest_link');
  remove_action('wp_head', 'rsd_link');
  remove_action('wp_head', 'wp_shortlink_wp_head', 10);
  remove_action('wp_head', 'wp_oembed_add_discovery_links');
}

/** تصاویر جدید (JPEG/PNG) در صورت پشتیبانی سرور به WebP تبدیل می‌شوند. */
add_filter('image_editor_output_format', 'bazar_webp_output');
function bazar_webp_output($map) {
  if (!bazar_on('speed_webp')) return $map;
  if (function_exists('wp_image_editor_supports') && wp_image_editor_supports(array('mime_type' => 'image/webp'))) {
    $map['image/jpeg'] = 'image/webp';
    $map['image/png']  = 'image/webp';
  }
  return $map;
}
