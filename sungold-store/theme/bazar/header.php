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
<?php $bz_tl = trim(bazar_opt('topbar')); $bz_tu = trim(bazar_opt('topbar_link')); $bz_tk = substr(md5($bz_tl . '|' . $bz_tu), 0, 8); ?>
<div class="topbar" data-key="<?php echo esc_attr($bz_tk); ?>"><div class="wrap">
  <span><?php echo ($bz_tu !== '' && function_exists('bazar_nav_href')) ? '<a class="tb-link" href="' . esc_url(bazar_nav_href($bz_tu)) . '">' . esc_html($bz_tl) . '</a>' : esc_html($bz_tl); ?></span>
  <nav aria-label="ارتباط با ما">
    <?php foreach (bazar_contacts() as $bz_c) { if ($bz_c['type'] === 'email') continue; echo '<a href="' . esc_url($bz_c['href']) . '"' . ($bz_c['ext'] ? ' rel="noopener"' : '') . '>' . esc_html($bz_c['label']) . '</a>'; } ?>
  </nav>
  <?php if (bazar_on('topbar_close') && function_exists('bazar_x_icon')) : ?><button type="button" class="tb-x" data-tb-close aria-label="بستن اعلان"><?php echo bazar_x_icon('close'); ?></button><?php endif; ?>
</div></div>
<?php if (bazar_on('topbar_close')) : ?><script>(function(){try{var b=document.currentScript.previousElementSibling;if(b&&localStorage.getItem('bz_tb')===b.getAttribute('data-key'))b.hidden=true}catch(e){}})()</script><?php endif; ?>
<?php endif; ?>
<header class="hd">
  <div class="wrap hd-main">
    <button class="ico menu-btn" data-open="#drawer-menu" aria-label="باز کردن منو"><?php echo bazar_icon('menu'); ?></button>
    <?php if (has_custom_logo()) : ?><div class="logo logo-img"><?php the_custom_logo(); ?></div><?php else : ?><a class="logo" href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a><?php endif; ?>
    <form class="search" role="search" action="<?php echo esc_url(home_url('/')); ?>">
      <?php if (taxonomy_exists('product_cat')) wp_dropdown_categories(['taxonomy'=>'product_cat','name'=>'product_cat','value_field'=>'slug','show_option_all'=>bazar_or('allcats_label', 'همه دسته‌ها'),'hide_empty'=>0,'hierarchical'=>1,'depth'=>1,'selected'=>get_query_var('product_cat'),'exclude'=>(int) get_option('default_product_cat')]); ?>
      <input type="search" name="s" placeholder="<?php echo esc_attr(bazar_or('search_placeholder', 'جستجوی محصول…')); ?>" aria-label="<?php echo esc_attr(bazar_or('search_placeholder', 'جستجوی محصول…')); ?>" value="<?php echo esc_attr(get_search_query()); ?>">
      <input type="hidden" name="post_type" value="product">
      <button type="submit" aria-label="جستجو"><?php echo bazar_icon('search'); ?></button>
    </form>
    <div class="hd-act">
      <a class="ico" href="<?php echo esc_url(bazar_account_url()); ?>" aria-label="حساب کاربری"><?php echo bazar_icon('user'); ?></a>
      <?php if (function_exists('bazar_lists_button')) bazar_lists_button(); ?>
      <button class="ico" data-open="#drawer-cart" aria-label="سبد خرید"><?php echo bazar_icon('bag'); ?><?php echo bazar_cart_badge(); ?></button>
    </div>
  </div>
  <nav class="catbar" aria-label="منوی اصلی"><div class="wrap">
    <div class="allcats"><button type="button"><?php echo bazar_icon('menu'); ?> <?php echo esc_html(bazar_or('allcats_label', 'همه دسته‌ها')); ?></button><?php bazar_cat_list(2); ?></div>
    <div class="primary-nav"><?php if (function_exists('bazar_primary_nav')) bazar_primary_nav(); else wp_nav_menu(['theme_location'=>'primary','container'=>false,'depth'=>1,'fallback_cb'=>'bazar_fallback_menu']); ?></div>
  </div></nav>
</header>

<aside id="drawer-menu" class="drawer" aria-hidden="true" aria-label="منو">
  <div class="drawer-h"><h2><?php echo esc_html(bazar_or('drawer_title', 'دسته‌ها')); ?></h2><button class="ico" data-close aria-label="بستن"><?php echo bazar_icon('close'); ?></button></div>
  <?php if (bazar_on('drawer_cats')) bazar_cat_list(2); ?>
  <div class="primary-nav"><?php if (function_exists('bazar_primary_nav')) bazar_primary_nav(); else wp_nav_menu(['theme_location'=>'primary','container'=>false,'depth'=>1,'fallback_cb'=>'bazar_fallback_menu']); ?></div>
</aside>
<aside id="drawer-cart" class="drawer drawer-end" aria-hidden="true" aria-label="سبد خرید">
  <div class="drawer-h"><h2><?php echo esc_html(bazar_or('cart_label', 'سبد خرید')); ?></h2><button class="ico" data-close aria-label="بستن"><?php echo bazar_icon('close'); ?></button></div>
  <div class="widget_shopping_cart_content"><?php if (function_exists('woocommerce_mini_cart')) woocommerce_mini_cart(); ?></div>
</aside>
<div class="overlay"></div>
