<?php
/**
 * درخواست خرید قبل از پرداخت — namespace: bazar/v1
 *
 * جریان: مشتری سفارش را ثبت می‌کند (روش پرداخت «ثبت درخواست خرید»، بدون هیچ پرداختی) ← وضعیت «درخواست خرید»
 *        ← فروشنده موجودی را در اپ می‌بیند و تأیید یا رد می‌کند.
 * تأیید: موجودی رزرو می‌شود، وضعیت «در انتظار پرداخت» می‌شود و پیوند پرداخت برای مشتری ایمیل می‌شود.
 * رد:    سفارش لغو می‌شود و دلیل برای مشتری ایمیل می‌شود.
 * اگر مشتری تا پایان مهلت پرداخت نکند، سفارش خودکار لغو و موجودی آزاد می‌شود.
 *
 * POST /orders/{id}/approve   {hours?, note?, force?}
 * POST /orders/{id}/reject    {reason?}
 *
 * فعال‌سازی: تنظیم «req_on» (پیش‌فرض خاموش). خاموش = فروشگاه مثل قبل.
 * فقط از CRUD ووکامرس استفاده می‌شود؛ با چک‌اوت کلاسیک و بلوکی کار می‌کند (نیازمند تست روی سایت واقعی).
 */
if (!defined('ABSPATH')) exit;

if (!defined('BAZAR_REQ_STATUS')) define('BAZAR_REQ_STATUS', 'bazar-request');

/* ------------------------------------------------------------- تنظیمات */

function bazar_req_on() {
  // بدون ماژول تنظیمات، همیشه خاموش (جایگزین bazar_value مقدار null می‌دهد)
  return function_exists('bazar_value') && (bool) bazar_value('req_on');
}

function bazar_req_hours() {
  $h = function_exists('bazar_value') ? (int) bazar_value('req_hours') : 24;
  return max(1, min(168, $h > 0 ? $h : 24));
}

/* ---------------------------------------------------------------- وضعیت */

add_action('init', 'bazar_req_register_status');
function bazar_req_register_status() {
  register_post_status('wc-' . BAZAR_REQ_STATUS, array(
    'label'                     => 'درخواست خرید',
    'public'                    => false,
    'exclude_from_search'       => false,
    'show_in_admin_all_list'    => true,
    'show_in_admin_status_list' => true,
    'label_count'               => _n_noop('درخواست خرید <span class="count">(%s)</span>', 'درخواست خرید <span class="count">(%s)</span>'),
  ));
}

add_filter('wc_order_statuses', 'bazar_req_add_status');
function bazar_req_add_status($s) {
  if (is_array($s)) $s['wc-' . BAZAR_REQ_STATUS] = 'درخواست خرید';
  return $s;
}

/* ------------------------------------------------- روش پرداخت «درخواست» */

add_filter('woocommerce_payment_gateways', 'bazar_req_add_gateway');
function bazar_req_add_gateway($g) {
  if (class_exists('WC_Payment_Gateway')) {
    $file = get_template_directory() . '/inc/request-gateway.php';
    if (is_readable($file)) {
      require_once $file;
      if (class_exists('Bazar_Request_Gateway')) $g[] = 'Bazar_Request_Gateway';
    }
  }
  return $g;
}

/**
 * وقتی حالت درخواست روشن است، مشتری فقط همین روش را می‌بیند.
 * در صفحه‌ی پرداخت سفارش تأییدشده (order-pay) برعکس: همین روش حذف می‌شود و درگاه‌های واقعی نمایش داده می‌شوند.
 * اگر روش ما به هر دلیل در دسترس نبود، فهرست دست‌نخورده می‌ماند (فروشگاه از کار نمی‌افتد).
 */
add_filter('woocommerce_available_payment_gateways', 'bazar_req_filter_gateways');
function bazar_req_filter_gateways($g) {
  if (!is_array($g)) return $g;
  if (is_admin() && !wp_doing_ajax()) return $g;
  $pay = function_exists('is_wc_endpoint_url') && is_wc_endpoint_url('order-pay');
  if ($pay || !bazar_req_on()) { unset($g['bazar_request']); return $g; }
  if (isset($g['bazar_request'])) return array('bazar_request' => $g['bazar_request']);
  return $g;
}

/* پشتیبانی از چک‌اوت بلوکی ووکامرس */
add_action('woocommerce_blocks_payment_method_type_registration', 'bazar_req_blocks_register');
function bazar_req_blocks_register($registry) {
  if (!class_exists('Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType')) return;
  $file = get_template_directory() . '/inc/request-blocks.php';
  if (!is_readable($file)) return;
  require_once $file;
  if (class_exists('Bazar_Request_Blocks') && is_object($registry) && method_exists($registry, 'register')) {
    $registry->register(new Bazar_Request_Blocks());
  }
}

/** سفارش را به «درخواست خرید» می‌برد؛ از روش پرداخت صدا زده می‌شود. */
function bazar_req_mark($o) {
  $o->set_payment_method('bazar_request');
  $o->set_payment_method_title('درخواست خرید');
  $o->update_meta_data('_bazar_request', '1');
  $o->update_status(BAZAR_REQ_STATUS, 'درخواست خرید ثبت شد؛ منتظر بررسی موجودی توسط فروشگاه است. ');
  bazar_req_notify_admin($o);
}

function bazar_req_notify_admin($o) {
  $to = get_option('admin_email');
  if (!is_string($to) || !is_email($to)) return;
  $body = 'یک درخواست خرید تازه رسید و منتظر بررسی موجودی است.' . "\n\n"
        . 'شماره: ' . $o->get_order_number() . "\n"
        . 'مشتری: ' . bazar_ord_customer_name($o) . "\n"
        . 'مبلغ: ' . $o->get_total() . "\n\n"
        . 'برای تأیید یا رد، اپ مدیریت فروشگاه را باز کنید یا اینجا: ' . $o->get_edit_order_url();
  wp_mail($to, 'درخواست خرید جدید #' . $o->get_order_number(), $body);
}

/* پیام صفحه‌ی «سفارش دریافت شد» */
add_filter('woocommerce_thankyou_order_received_text', 'bazar_req_thankyou', 10, 2);
function bazar_req_thankyou($text, $o) {
  if ($o instanceof WC_Order && $o->get_status() === BAZAR_REQ_STATUS) {
    return 'درخواست خرید شما ثبت شد. بعد از بررسی موجودی، پیوند پرداخت برای شما ایمیل می‌شود و در بخش «حساب من ← سفارش‌ها» هم دیده می‌شود.';
  }
  return $text;
}

/* ------------------------------------------------------------ موجودی */

/** بررسی موجودی هر قلم. خروجی: array('ok' => bool, 'rows' => [...]) */
function bazar_req_stock($o) {
  $rows = array();
  $ok   = true;
  foreach ($o->get_items() as $it) {
    if (!($it instanceof WC_Order_Item_Product)) continue;
    $p   = $it->get_product();
    $qty = (int) $it->get_quantity();
    $row = array(
      'item_id'   => (int) $it->get_id(),
      'name'      => (string) $it->get_name(),
      'qty'       => $qty,
      'managed'   => false,
      'available' => null,
      'ok'        => true,
      'reason'    => '',
    );
    if (!$p) {
      $row['ok'] = false; $row['reason'] = 'محصول حذف شده';
    } elseif ($p->managing_stock()) {
      $avail = (int) $p->get_stock_quantity();
      $row['managed'] = true; $row['available'] = $avail;
      if ($qty > $avail && !$p->backorders_allowed()) { $row['ok'] = false; $row['reason'] = 'موجودی کافی نیست'; }
    } elseif (!$p->is_in_stock()) {
      $row['ok'] = false; $row['reason'] = 'ناموجود';
    }
    if (!$row['ok']) $ok = false;
    $rows[] = $row;
  }
  return array('ok' => $ok, 'rows' => $rows);
}

/** بخش «request» در پاسخ جزئیات سفارش (برای اپ). null = سفارش عادی. */
function bazar_req_present($o) {
  $st = $o->get_status();
  if ($st === BAZAR_REQ_STATUS) {
    $s = bazar_req_stock($o);
    return array('state' => 'awaiting', 'stock' => $s['rows'], 'all_ok' => (bool) $s['ok'], 'hours' => bazar_req_hours(), 'expires' => 0);
  }
  $exp = (int) $o->get_meta('_bazar_pay_expires');
  if ($st === 'pending' && $exp > 0) {
    return array('state' => 'approved', 'stock' => array(), 'all_ok' => true, 'hours' => bazar_req_hours(), 'expires' => $exp);
  }
  return null;
}

/* -------------------------------------------------------------- REST */

add_action('rest_api_init', 'bazar_req_routes');
function bazar_req_routes() {
  $ns = 'bazar/v1';
  register_rest_route($ns, '/orders/(?P<id>\d+)/approve', array(
    'methods' => 'POST', 'callback' => 'bazar_req_rest_approve', 'permission_callback' => 'bazar_ord_can',
  ));
  register_rest_route($ns, '/orders/(?P<id>\d+)/reject', array(
    'methods' => 'POST', 'callback' => 'bazar_req_rest_reject', 'permission_callback' => 'bazar_ord_can',
  ));
}

function bazar_req_not_request() {
  return new WP_Error('bazar_not_request', 'این سفارش در وضعیت «درخواست خرید» نیست (شاید قبلاً بررسی شده).', array('status' => 409));
}

function bazar_req_rest_approve($req) {
  $o = bazar_ord_get($req['id']);
  if (!$o) return bazar_ord_not_found();
  if ($o->get_status() !== BAZAR_REQ_STATUS) return bazar_req_not_request();
  $in = bazar_ord_body($req);

  $st = bazar_req_stock($o);
  if (!$st['ok'] && empty($in['force'])) {
    return new WP_Error('bazar_stock_short', 'موجودی همه‌ی اقلام کافی نیست.', array('status' => 409, 'stock' => $st['rows']));
  }
  $hours = isset($in['hours']) && is_numeric($in['hours']) ? (int) $in['hours'] : bazar_req_hours();
  $hours = max(1, min(168, $hours));
  $note  = isset($in['note']) ? trim(sanitize_textarea_field(mb_substr((string) $in['note'], 0, 500))) : '';

  try {
    wc_reduce_stock_levels($o->get_id()); // رزرو موجودی تا پایان مهلت پرداخت
    $fresh = bazar_ord_get($o->get_id());
    if ($fresh) $o = $fresh;
    $o->update_meta_data('_bazar_pay_expires', time() + $hours * HOUR_IN_SECONDS);
    $o->update_meta_data('_bazar_approved_by', get_current_user_id());
    $o->set_payment_method('');
    $o->set_payment_method_title('');
    $o->save();
    $o->update_status('pending', 'درخواست خرید تأیید شد' . ($st['ok'] ? '' : ' (با موجودی ناکافی، به تشخیص فروشنده)') . '. ');
    $msg = 'درخواست خرید شما تأیید شد و کالا برای شما رزرو شد. برای پرداخت از این پیوند استفاده کنید: '
         . $o->get_checkout_payment_url() . ' (مهلت پرداخت: ' . $hours . ' ساعت)';
    if ($note !== '') $msg .= "\n" . $note;
    $o->add_order_note($msg, 1, true);
  } catch (Throwable $e) {
    return new WP_Error('bazar_save_failed', $e->getMessage(), array('status' => 400));
  }
  $out = bazar_ord_get($o->get_id());
  return rest_ensure_response(bazar_ord_present_full($out ? $out : $o));
}

function bazar_req_rest_reject($req) {
  $o = bazar_ord_get($req['id']);
  if (!$o) return bazar_ord_not_found();
  if ($o->get_status() !== BAZAR_REQ_STATUS) return bazar_req_not_request();
  $in = bazar_ord_body($req);
  $reason = isset($in['reason']) ? trim(sanitize_textarea_field(mb_substr((string) $in['reason'], 0, 500))) : '';
  if ($reason === '') $reason = 'موجودی کافی نیست';
  try {
    $o->update_status('cancelled', 'درخواست خرید رد شد: ' . $reason . ' ');
    $o->add_order_note('متأسفانه درخواست خرید شما انجام نشد: ' . $reason, 1, true);
  } catch (Throwable $e) {
    return new WP_Error('bazar_save_failed', $e->getMessage(), array('status' => 400));
  }
  $out = bazar_ord_get($o->get_id());
  return rest_ensure_response(bazar_ord_present_full($out ? $out : $o));
}

/* ------------------------------------------- مهلت پرداخت بعد از تأیید */

/** ووکامرس سفارش‌های پرداخت‌نشده را بعد از «مدت نگهداری موجودی» (پیش‌فرض ۶۰ دقیقه) لغو می‌کند؛ مهلت این سفارش‌ها را خودمان مدیریت می‌کنیم. */
add_filter('woocommerce_cancel_unpaid_order', 'bazar_req_keep_unpaid', 10, 2);
function bazar_req_keep_unpaid($cancel, $o) {
  if ($o instanceof WC_Order && (int) $o->get_meta('_bazar_pay_expires') > 0) return false;
  return $cancel;
}

add_action('init', 'bazar_req_schedule');
function bazar_req_schedule() {
  if (!wp_next_scheduled('bazar_req_expire')) wp_schedule_event(time() + 300, 'hourly', 'bazar_req_expire');
}

add_action('bazar_req_expire', 'bazar_req_expire_run');
function bazar_req_expire_run() {
  if (!function_exists('wc_get_orders')) return;
  $orders = wc_get_orders(array(
    'limit'      => 50,
    'status'     => array('wc-pending'),
    'meta_query' => array(array('key' => '_bazar_pay_expires', 'value' => time(), 'compare' => '<', 'type' => 'NUMERIC')),
  ));
  foreach ((array) $orders as $o) {
    if (!($o instanceof WC_Order)) continue;
    if ((int) $o->get_meta('_bazar_pay_expires') <= 0) continue;
    try {
      $o->delete_meta_data('_bazar_pay_expires');
      $o->save();
      $o->update_status('cancelled', 'مهلت پرداخت بعد از تأیید درخواست تمام شد؛ سفارش لغو و موجودی آزاد شد. ');
      $o->add_order_note('مهلت پرداخت سفارش شما تمام شد و سفارش لغو شد. اگر هنوز می‌خواهید، دوباره درخواست ثبت کنید.', 1, true);
    } catch (Throwable $e) {
      if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bazar requests: expire failed: ' . $e->getMessage());
    }
  }
}

/* بعد از پرداخت موفق، نشانه‌ی مهلت پاک شود */
add_action('woocommerce_payment_complete', 'bazar_req_paid');
function bazar_req_paid($order_id) {
  $o = wc_get_order($order_id);
  if ($o instanceof WC_Order && $o->get_meta('_bazar_pay_expires') !== '') {
    $o->delete_meta_data('_bazar_pay_expires');
    $o->save();
  }
}
