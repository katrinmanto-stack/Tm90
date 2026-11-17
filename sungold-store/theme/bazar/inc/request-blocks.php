<?php
/** یکپارچگی روش «درخواست خرید» با چک‌اوت بلوکی ووکامرس. فقط وقتی AbstractPaymentMethodType موجود باشد بارگذاری می‌شود. */
if (!defined('ABSPATH')) exit;

if (class_exists('Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType') && !class_exists('Bazar_Request_Blocks')) {
  final class Bazar_Request_Blocks extends Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType {
    protected $name = 'bazar_request';

    public function initialize() {
      $this->settings = array();
    }

    public function is_active() {
      return function_exists('bazar_req_on') && bazar_req_on();
    }

    public function get_payment_method_script_handles() {
      wp_register_script(
        'bazar-request-blocks',
        get_template_directory_uri() . '/assets/request-blocks.js',
        array('wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities'),
        defined('BAZAR_V') ? BAZAR_V : '1',
        true
      );
      return array('bazar-request-blocks');
    }

    public function get_payment_method_data() {
      return array(
        'title'       => 'ثبت درخواست خرید',
        'description' => 'سفارش شما ابتدا از نظر موجودی بررسی می‌شود. بعد از تأیید، پیوند پرداخت برای شما ایمیل می‌شود.',
        'supports'    => array('products'),
      );
    }
  }
}
