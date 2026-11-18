<?php
/**
 * مدیریت سفارش‌ها از اپ — namespace: bazar/v1
 *
 * GET  /orders/meta          وضعیت‌ها، تعداد سفارش هر وضعیت، واحد پول
 * GET  /orders/stats         تعداد و فروش امروز / ۷ روز / ۳۰ روز اخیر
 * GET  /orders               فهرست (status, search, from, to, page)؛ ۲۰ تا در هر صفحه
 * GET  /orders/{id}          جزئیات کامل (اقلام، آدرس، پرداخت، یادداشت‌ها)
 * POST /orders/{id}          تغییر وضعیت و/یا کد رهگیری (PUT و PATCH هم)
 * POST /orders/{id}/notes    افزودن یادداشت (خصوصی یا برای مشتری)
 *
 * ورود: Application Passwords. دسترسی: توانایی edit_shop_orders (مدیر و مدیر فروشگاه).
 * فقط از CRUD خود ووکامرس (wc_get_orders / wc_get_order) استفاده می‌شود؛ پس با HPOS و ذخیره‌ی قدیمی هر دو سازگار است.
 * استرداد وجه عمداً از اپ ممکن نیست (باید رکورد استرداد ساخته شود؛ از پیشخوان انجام دهید).
 */
if (!defined('ABSPATH')) exit;

add_action('rest_api_init', 'bazar_ord_routes');
function bazar_ord_routes() {
  $ns = 'bazar/v1';
  register_rest_route($ns, '/orders/meta', array(
    'methods' => 'GET', 'callback' => 'bazar_ord_rest_meta', 'permission_callback' => 'bazar_ord_can',
  ));
  register_rest_route($ns, '/orders/stats', array(
    'methods' => 'GET', 'callback' => 'bazar_ord_rest_stats', 'permission_callback' => 'bazar_ord_can',
  ));
  register_rest_route($ns, '/orders', array(
    'methods' => 'GET', 'callback' => 'bazar_ord_rest_list', 'permission_callback' => 'bazar_ord_can',
  ));
  register_rest_route($ns, '/orders/(?P<id>\d+)', array(
    array('methods' => 'GET',              'callback' => 'bazar_ord_rest_get',    'permission_callback' => 'bazar_ord_can'),
    array('methods' => 'POST, PUT, PATCH', 'callback' => 'bazar_ord_rest_update', 'permission_callback' => 'bazar_ord_can'),
  ));
  register_rest_route($ns, '/orders/(?P<id>\d+)/notes', array(
    'methods' => 'POST', 'callback' => 'bazar_ord_rest_note', 'permission_callback' => 'bazar_ord_can',
  ));
}

function bazar_ord_can() {
  return function_exists('wc_get_orders') && current_user_can('edit_shop_orders');
}

/** سفارش واقعی یا null (استردادها سفارش حساب نمی‌شوند). */
function bazar_ord_get($id) {
  $id = (int) $id;
  if ($id <= 0) return null;
  $o = wc_get_order($id);
  return ($o instanceof WC_Order) ? $o : null;
}

function bazar_ord_not_found() {
  return new WP_Error('bazar_not_found', 'سفارش پیدا نشد.', array('status' => 404));
}

function bazar_ord_body($req) {
  $in = $req->get_json_params();
  if (!is_array($in)) $in = $req->get_params();
  return is_array($in) ? $in : array();
}

/* ---------------------------------------------------------------- وضعیت‌ها */

/** slug (بدون wc-) => برچسب. پیش‌نویس‌های پرداخت ناتمام (checkout-draft) نمایش داده نمی‌شوند. */
function bazar_ord_statuses() {
  $out = array();
  foreach (wc_get_order_statuses() as $k => $label) {
    $slug = strpos($k, 'wc-') === 0 ? substr($k, 3) : $k;
    if ($slug === 'checkout-draft') continue;
    $out[$slug] = (string) $label;
  }
  return $out;
}

function bazar_ord_slug($s) {
  $s = sanitize_key((string) $s);
  return strpos($s, 'wc-') === 0 ? substr($s, 3) : $s;
}

/* ------------------------------------------------------------- کمکی‌های داده */

function bazar_ord_customer_name($o) {
  $n = trim($o->get_billing_first_name() . ' ' . $o->get_billing_last_name());
  if ($n === '') $n = trim($o->get_shipping_first_name() . ' ' . $o->get_shipping_last_name());
  if ($n === '') $n = trim((string) $o->get_billing_company());
  return $n !== '' ? $n : 'مهمان';
}

function bazar_ord_ts($o) {
  $d = $o->get_date_created();
  return $d ? (int) $d->getTimestamp() : 0;
}

function bazar_ord_text($html) {
  $t = preg_replace('#<br\s*/?>#i', "\n", (string) $html);
  return trim(html_entity_decode(wp_strip_all_tags($t), ENT_QUOTES, 'UTF-8'));
}

function bazar_ord_present_row($o) {
  $names = array();
  foreach ($o->get_items() as $it) {
    $names[] = $it->get_name();
    if (count($names) >= 2) break;
  }
  $slug = $o->get_status();
  $all  = bazar_ord_statuses();
  return array(
    'id'          => (int) $o->get_id(),
    'number'      => (string) $o->get_order_number(),
    'status'      => $slug,
    'status_label' => isset($all[$slug]) ? $all[$slug] : $slug,
    'total'       => (string) $o->get_total(),
    'currency'    => html_entity_decode(get_woocommerce_currency_symbol($o->get_currency()), ENT_QUOTES, 'UTF-8'),
    'ts'          => bazar_ord_ts($o),
    'customer'    => bazar_ord_customer_name($o),
    'items_count' => (int) $o->get_item_count(),
    'preview'     => implode('، ', $names),
    'paid'        => (bool) $o->is_paid(),
  );
}

function bazar_ord_items($o) {
  $out = array();
  foreach ($o->get_items() as $it) {
    if (!($it instanceof WC_Order_Item_Product)) continue;
    $p   = $it->get_product();
    $sku = '';
    $img = '';
    if ($p) {
      $sku = (string) $p->get_sku();
      $iid = (int) $p->get_image_id();
      if (!$iid && $p->get_parent_id()) {
        $par = wc_get_product($p->get_parent_id());
        $iid = $par ? (int) $par->get_image_id() : 0;
      }
      if ($iid) {
        $u   = wp_get_attachment_image_url($iid, 'thumbnail');
        $img = $u ? $u : '';
      }
    }
    $meta = array();
    foreach ($it->get_formatted_meta_data() as $m) {
      $meta[] = array('key' => wp_strip_all_tags((string) $m->display_key), 'value' => bazar_ord_text($m->display_value));
    }
    $out[] = array(
      'id'         => (int) $it->get_id(),
      'name'       => (string) $it->get_name(),
      'qty'        => (int) $it->get_quantity(),
      'subtotal'   => (string) $it->get_subtotal(),
      'total'      => (string) $it->get_total(),
      'sku'        => $sku,
      'product_id' => (int) $it->get_product_id(),
      'image'      => $img,
      'meta'       => $meta,
    );
  }
  return $out;
}

function bazar_ord_notes($o) {
  $out = array();
  $notes = wc_get_order_notes(array('order_id' => $o->get_id(), 'limit' => 50));
  foreach ((array) $notes as $n) {
    $d = $n->date_created;
    $out[] = array(
      'id'       => (int) $n->id,
      'content'  => bazar_ord_text($n->content),
      'customer' => !empty($n->customer_note),
      'by'       => (string) $n->added_by,
      'ts'       => $d ? (int) $d->getTimestamp() : 0,
    );
  }
  return $out;
}

function bazar_ord_present_full($o) {
  $row = bazar_ord_present_row($o);
  $ship = array();
  foreach ($o->get_shipping_methods() as $s) $ship[] = (string) $s->get_name();
  $fees = array();
  foreach ($o->get_fees() as $f) $fees[] = array('name' => (string) $f->get_name(), 'total' => (string) $f->get_total());

  $bill_addr = bazar_ord_text($o->get_formatted_billing_address(''));
  $ship_addr = bazar_ord_text($o->get_formatted_shipping_address(''));

  $row['totals'] = array(
    'subtotal' => (string) $o->get_subtotal(),
    'discount' => (string) $o->get_total_discount(),
    'shipping' => (string) $o->get_shipping_total(),
    'tax'      => (string) $o->get_total_tax(),
    'refunded' => (string) $o->get_total_refunded(),
    'total'    => (string) $o->get_total(),
  );
  $row['fees']     = $fees;
  $row['items']    = bazar_ord_items($o);
  $row['customer_info'] = array(
    'name'  => bazar_ord_customer_name($o),
    'phone' => (string) $o->get_billing_phone(),
    'email' => (string) $o->get_billing_email(),
    'user_id' => (int) $o->get_customer_id(),
  );
  $row['billing_address']  = $bill_addr;
  $row['shipping_address'] = $ship_addr !== '' ? $ship_addr : $bill_addr;
  $row['postcode']         = (string) ($o->get_shipping_postcode() !== '' ? $o->get_shipping_postcode() : $o->get_billing_postcode());
  $row['needs_shipping']   = (bool) $o->needs_shipping_address();
  $row['payment']          = array(
    'method'         => (string) $o->get_payment_method(),
    'title'          => (string) $o->get_payment_method_title(),
    'transaction_id' => (string) $o->get_transaction_id(),
  );
  $row['shipping_methods'] = $ship;
  $row['customer_note']    = (string) $o->get_customer_note();
  $row['tracking']         = (string) $o->get_meta('_bazar_tracking');
  $row['notes']            = bazar_ord_notes($o);
  $row['edit_url']         = $o->get_edit_order_url();
  $row['request']          = function_exists('bazar_req_present') ? bazar_req_present($o) : null;
  return $row;
}

/* ------------------------------------------------------------- پاسخ‌ها */

function bazar_ord_rest_meta() {
  $statuses = array();
  $counts   = array();
  foreach (bazar_ord_statuses() as $slug => $label) {
    // «درخواست خرید» فقط با دکمه‌ی تأیید/رد عوض می‌شود تا کنترل موجودی دور زده نشود.
    $statuses[] = array('slug' => $slug, 'label' => $label, 'settable' => $slug !== 'refunded' && $slug !== 'bazar-request');
    $counts[$slug] = function_exists('wc_orders_count') ? (int) wc_orders_count($slug) : 0;
  }
  // شناسه‌ی تازه‌ترین سفارش: اپ با آن سفارش جدید را تشخیص می‌دهد (مقایسه‌ی تعداد، تکمیل+ثبت هم‌زمان را نمی‌دید).
  $ids = wc_get_orders(array(
    'limit' => 1, 'orderby' => 'id', 'order' => 'DESC', 'return' => 'ids',
    'status' => array_map(function ($s) { return 'wc-' . $s; }, array_keys(bazar_ord_statuses())),
  ));
  return rest_ensure_response(array(
    'statuses' => $statuses,
    'counts'   => $counts,
    'latest_id' => $ids ? (int) $ids[0] : 0,
    'request_mode' => function_exists('bazar_req_on') ? bazar_req_on() : false,
    'currency' => html_entity_decode(get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8'),
    'site'     => array('name' => get_bloginfo('name'), 'url' => home_url('/')),
  ));
}

function bazar_ord_rest_stats() {
  $tz    = wp_timezone();
  $today = (new DateTimeImmutable('now', $tz))->setTime(0, 0, 0);
  $starts = array(
    'today' => $today,
    'week'  => $today->modify('-6 days'),
    'month' => $today->modify('-29 days'),
  );
  $cap = 1500;
  $orders = wc_get_orders(array(
    'limit'        => $cap,
    'status'       => array('wc-processing', 'wc-completed', 'wc-on-hold'),
    'date_created' => '>=' . $starts['month']->getTimestamp(),
    'orderby'      => 'date',
    'order'        => 'DESC',
  ));
  $out = array(
    'today' => array('count' => 0, 'revenue' => 0.0),
    'week'  => array('count' => 0, 'revenue' => 0.0),
    'month' => array('count' => 0, 'revenue' => 0.0),
  );
  foreach ($orders as $o) {
    $ts  = bazar_ord_ts($o);
    $net = (float) $o->get_total() - (float) $o->get_total_refunded();
    foreach ($starts as $k => $st) {
      if ($ts >= $st->getTimestamp()) {
        $out[$k]['count']++;
        $out[$k]['revenue'] += $net;
      }
    }
  }
  foreach ($out as $k => $v) $out[$k]['revenue'] = round($v['revenue'], 2);
  $out['truncated'] = count($orders) >= $cap;
  $out['currency']  = html_entity_decode(get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8');
  return rest_ensure_response($out);
}

function bazar_ord_rest_list($req) {
  $page = max(1, (int) $req->get_param('page'));
  $all  = bazar_ord_statuses();
  $args = array(
    'limit'    => 20,
    'paged'    => $page,
    'paginate' => true,
    'orderby'  => 'date',
    'order'    => 'DESC',
    'status'   => array_map(function ($s) { return 'wc-' . $s; }, array_keys($all)),
  );
  $st = bazar_ord_slug((string) $req->get_param('status'));
  if ($st !== '' && isset($all[$st])) $args['status'] = array('wc-' . $st);

  $from = (string) $req->get_param('from');
  $to   = (string) $req->get_param('to');
  $okd  = '/^\d{4}-\d{2}-\d{2}$/';
  if (preg_match($okd, $from) && preg_match($okd, $to)) $args['date_created'] = $from . '...' . $to;
  elseif (preg_match($okd, $from))                      $args['date_created'] = '>=' . strtotime($from . ' 00:00:00');
  elseif (preg_match($okd, $to))                        $args['date_created'] = '<=' . strtotime($to . ' 23:59:59');

  $s = trim((string) $req->get_param('search'));
  if ($s !== '') {
    $digits = function_exists('bazar_prod_digits') ? bazar_prod_digits($s) : $s;
    $digits = ltrim($digits, '#');
    if (ctype_digit($digits) && strlen($digits) <= 9) {
      // شماره‌ی سفارش: مستقیم پیدا کن
      $one = bazar_ord_get((int) $digits);
      $items = array();
      if ($one && isset($all[$one->get_status()])) $items[] = bazar_ord_present_row($one);
      return rest_ensure_response(array('items' => $items, 'total' => count($items), 'pages' => count($items) ? 1 : 0, 'page' => 1));
    }
    $args['s'] = $s;
  }

  $res   = wc_get_orders($args);
  $items = array();
  foreach ($res->orders as $o) {
    if ($o instanceof WC_Order) $items[] = bazar_ord_present_row($o);
  }
  return rest_ensure_response(array('items' => $items, 'total' => (int) $res->total, 'pages' => (int) $res->max_num_pages, 'page' => $page));
}

function bazar_ord_rest_get($req) {
  $o = bazar_ord_get($req['id']);
  if (!$o) return bazar_ord_not_found();
  return rest_ensure_response(bazar_ord_present_full($o));
}

function bazar_ord_rest_update($req) {
  $o = bazar_ord_get($req['id']);
  if (!$o) return bazar_ord_not_found();
  $in = bazar_ord_body($req);

  try {
    if (isset($in['status']) && $in['status'] !== '') {
      $slug = bazar_ord_slug($in['status']);
      $all  = bazar_ord_statuses();
      if (!isset($all[$slug])) {
        return new WP_Error('bazar_bad_request', 'وضعیت نامعتبر است.', array('status' => 400));
      }
      if ($slug === 'bazar-request') {
        return new WP_Error('bazar_bad_request', 'وضعیت «درخواست خرید» را فقط خود سیستم ثبت می‌کند.', array('status' => 400));
      }
      if ($o->get_status() === 'bazar-request' && $slug !== 'cancelled') {
        return new WP_Error('bazar_bad_request', 'برای درخواست خرید از دکمه‌ی «تأیید» (با کنترل موجودی) یا «رد» استفاده کنید.', array('status' => 400));
      }
      if ($slug === 'refunded') {
        return new WP_Error('bazar_bad_request', 'استرداد وجه را از پیشخوان وردپرس انجام دهید تا رکورد استرداد ساخته شود.', array('status' => 400));
      }
      if ($slug !== $o->get_status()) {
        $note = isset($in['note']) ? trim(sanitize_textarea_field(mb_substr((string) $in['note'], 0, 500))) : '';
        $o->update_status($slug, $note !== '' ? $note . ' ' : '', true);
      }
    }

    if (array_key_exists('tracking', $in)) {
      $code = trim(sanitize_text_field(mb_substr((string) $in['tracking'], 0, 60)));
      if ($code !== (string) $o->get_meta('_bazar_tracking')) {
        if ($code === '') $o->delete_meta_data('_bazar_tracking'); else $o->update_meta_data('_bazar_tracking', $code);
        $o->save();
        if ($code !== '' && !empty($in['notify_tracking'])) {
          $o->add_order_note('کد رهگیری مرسوله‌ی شما: ' . $code, 1, true);
        } elseif ($code !== '') {
          $o->add_order_note('کد رهگیری ثبت شد: ' . $code, 0, true);
        }
      }
    }
  } catch (Throwable $e) {
    return new WP_Error('bazar_save_failed', $e->getMessage(), array('status' => 400));
  }

  $fresh = bazar_ord_get($o->get_id());
  return rest_ensure_response(bazar_ord_present_full($fresh ? $fresh : $o));
}

function bazar_ord_rest_note($req) {
  $o = bazar_ord_get($req['id']);
  if (!$o) return bazar_ord_not_found();
  $in   = bazar_ord_body($req);
  $text = isset($in['note']) ? trim(sanitize_textarea_field(mb_substr((string) $in['note'], 0, 1000))) : '';
  if ($text === '') return new WP_Error('bazar_bad_request', 'متن یادداشت خالی است.', array('status' => 400));
  try {
    $o->add_order_note($text, !empty($in['customer']) ? 1 : 0, true);
  } catch (Throwable $e) {
    return new WP_Error('bazar_save_failed', $e->getMessage(), array('status' => 400));
  }
  $fresh = bazar_ord_get($o->get_id());
  return rest_ensure_response(bazar_ord_present_full($fresh ? $fresh : $o));
}

/* ------------------------------------------- نمایش کد رهگیری به مشتری */

add_action('woocommerce_order_details_after_order_table', 'bazar_ord_show_tracking');
function bazar_ord_show_tracking($order) {
  if (!($order instanceof WC_Order)) return;
  $c = (string) $order->get_meta('_bazar_tracking');
  if ($c === '') return;
  echo '<p class="bazar-tracking"><strong>کد رهگیری مرسوله:</strong> <bdi>' . esc_html($c) . '</bdi></p>';
}

add_action('woocommerce_email_order_meta', 'bazar_ord_email_tracking', 20, 3);
function bazar_ord_email_tracking($order, $sent_to_admin = false, $plain_text = false) {
  if ($sent_to_admin || !($order instanceof WC_Order)) return;
  $c = (string) $order->get_meta('_bazar_tracking');
  if ($c === '') return;
  if ($plain_text) echo "\nکد رهگیری مرسوله: " . $c . "\n";
  else echo '<p><strong>کد رهگیری مرسوله:</strong> <bdi>' . esc_html($c) . '</bdi></p>';
}
