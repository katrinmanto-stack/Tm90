<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php $bz_pal = bazar_palette(); ?>
<meta name="theme-color" content="<?php echo esc_attr($bz_pal['bg']); ?>">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php if (bazar_on('topbar_on')) : ?>
<div class="topbar"><div class="wrap">
  <span><?php echo esc_html(bazar_opt('topbar')); ?></span>
  <nav aria-label="ارتباط با ما">
    <?php foreach (bazar_contacts() as $bz_c) { if ($bz_c['type'] === 'email') continue; echo '<a href="' . esc_url($bz_c['href']) . '"' . ($bz_c['ext'] ? ' rel="noopener"' : '') . '>' . esc_html($bz_c['label']) . '</a>'; } ?>
  </nav>
</div></div>
<?php endif; ?>
<header class="hd">
  <div class="wrap hd-main">
    <button class="ico menu-btn" data-open="#drawer-menu" aria-label="باز کردن منو"><?php echo bazar_icon('menu'); ?></button>
    <?php if (has_custom_logo()) : ?><div class="logo logo-img"><?php the_custom_logo(); ?></div><?php else : ?><a class="logo" href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a><?php endif; ?>
    <form class="search" role="search" action="<?php echo esc_url(home_url('/')); ?>">
      <?php if (taxonomy_exists('product_cat')) wp_dropdown_categories(['taxonomy'=>'product_cat','name'=>'product_cat','value_field'=>'slug','show_option_all'=>'همه دسته‌ها','hide_empty'=>0,'hierarchical'=>1,'depth'=>1,'selected'=>get_query_var('product_cat'),'exclude'=>(int) get_option('default_product_cat')]); ?>
      <input type="search" name="s" placeholder="جستجوی محصول…" aria-label="جستجوی محصول" value="<?php echo esc_attr(get_search_query()); ?>">
      <input type="hidden" name="post_type" value="product">
      <button type="submit" aria-label="جستجو"><?php echo bazar_icon('search'); ?></button>
    </form>
    <div class="hd-act">
      <a class="ico" href="<?php echo esc_url(bazar_account_url()); ?>" aria-label="حساب کاربری"><?php echo bazar_icon('user'); ?></a>
      <button class="ico" data-open="#drawer-cart" aria-label="سبد خرید"><?php echo bazar_icon('bag'); ?><?php echo bazar_cart_badge(); ?></button>
    </div>
  </div>
  <nav class="catbar" aria-label="منوی اصلی"><div class="wrap">
    <div class="allcats"><button type="button"><?php echo bazar_icon('menu'); ?> همه دسته‌ها</button><?php bazar_cat_list(2); ?></div>
    <div class="primary-nav"><?php wp_nav_menu(['theme_location'=>'primary','container'=>false,'depth'=>1,'fallback_cb'=>'bazar_fallback_menu']); ?></div>
  </div></nav>
</header>

<aside id="drawer-menu" class="drawer" aria-hidden="true" aria-label="منو">
  <div class="drawer-h"><h2>دسته‌ها</h2><button class="ico" data-close aria-label="بستن"><?php echo bazar_icon('close'); ?></button></div>
  <?php bazar_cat_list(2); ?>
  <div class="primary-nav"><?php wp_nav_menu(['theme_location'=>'primary','container'=>false,'depth'=>1,'fallback_cb'=>'bazar_fallback_menu']); ?></div>
</aside>
<aside id="drawer-cart" class="drawer drawer-end" aria-hidden="true" aria-label="سبد خرید">
  <div class="drawer-h"><h2>سبد خرید</h2><button class="ico" data-close aria-label="بستن"><?php echo bazar_icon('close'); ?></button></div>
  <div class="widget_shopping_cart_content"><?php if (function_exists('woocommerce_mini_cart')) woocommerce_mini_cart(); ?></div>
</aside>
<div class="overlay"></div>
