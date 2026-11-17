<?php get_header(); $side = (is_shop() || is_product_taxonomy()) && is_active_sidebar('shop'); ?>
<main class="wrap content<?php echo $side ? ' has-side' : ''; ?>">
  <?php if ($side) : ?><aside><?php dynamic_sidebar('shop'); ?></aside><?php endif; ?>
  <div><?php woocommerce_content(); ?></div>
</main>
<?php get_footer(); ?>
