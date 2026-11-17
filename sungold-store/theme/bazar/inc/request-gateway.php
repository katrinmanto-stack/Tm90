<?php
/** روش پرداخت «ثبت درخواست خرید»: هیچ پرداختی انجام نمی‌دهد؛ فقط سفارش را به وضعیت «درخواست خرید» می‌برد. فقط با وجود ووکامرس بارگذاری می‌شود. */
if (!defined('ABSPATH')) exit;

if (class_exists('WC_Payment_Gateway') && !class_exists('Bazar_Request_Gateway')) {
  class Bazar_Request_Gateway extends WC_Payment_Gateway {
    public function __construct() {
      $this->id                 = 'bazar_request';
      $this->method_title       = 'درخواست خرید (قالب بازار)';
      $this->method_description = 'سفارش ابتدا به‌عنوان درخواست ثبت می‌شود و بعد از تأیید موجودی توسط فروشگاه، مشتری می‌تواند پرداخت کند. از اپ یا تنظیمات قالب (فروشگاه ← درخواست خرید) روشن/خاموش می‌شود.';
      $this->has_fields         = false;
      $this->supports           = array('products');
      $this->title              = 'ثبت درخواست خرید';
      $this->description        = 'سفارش شما ابتدا از نظر موجودی بررسی می‌شود. بعد از تأیید، پیوند پرداخت برای شما ایمیل می‌شود.';
      $this->enabled            = 'yes';
    }

    public function is_available() {
      return function_exists('bazar_req_on') && bazar_req_on();
    }

    public function process_payment($order_id) {
      $order = wc_get_order($order_id);
      if (!$order) return array('result' => 'failure');
      bazar_req_mark($order);
      if (function_exists('WC') && WC()->cart) WC()->cart->empty_cart();
      return array('result' => 'success', 'redirect' => $this->get_return_url($order));
    }
  }
}
