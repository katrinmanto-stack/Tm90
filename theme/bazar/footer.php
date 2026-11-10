<footer class="ft">
  <div class="wrap ft-g">
    <div><a class="logo" href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a><p><?php echo esc_html(bazar_opt('about')); ?></p></div>
    <div><h3>دسترسی سریع</h3><?php wp_nav_menu(['theme_location'=>'footer','container'=>false,'depth'=>1,'fallback_cb'=>'bazar_fallback_menu']); ?></div>
    <div><h3>دسته‌ها</h3><ul>
      <?php foreach (bazar_top_cats(6) as $c) echo '<li><a href="'.esc_url(get_term_link($c)).'">'.esc_html($c->name).'</a></li>'; ?>
    </ul></div>
    <div><h3>تماس با ما</h3><ul>
      <?php foreach (bazar_contacts() as $bz_c) echo '<li><a href="' . esc_url($bz_c['href']) . '"' . ($bz_c['ext'] ? ' rel="noopener"' : '') . '>' . esc_html($bz_c['label']) . '</a></li>'; ?>
    </ul></div>
  </div>
  <?php $bz_cr = trim(bazar_opt('copyright')); ?>
  <div class="wrap ft-b"><?php echo $bz_cr !== '' ? esc_html($bz_cr) : '© ' . esc_html(date_i18n('Y')) . ' ' . esc_html(get_bloginfo('name')); ?></div>
</footer>
<?php if (bazar_on('tabbar_on')) : ?>
<?php $bz_acct = function_exists('is_account_page') && is_account_page(); ?>
<nav class="tabbar" aria-label="ناوبری سریع">
  <a href="<?php echo esc_url(home_url('/')); ?>"<?php echo is_front_page() ? ' aria-current="page"' : ''; ?>><?php echo bazar_icon('home'); ?>خانه</a>
  <button type="button" data-open="#drawer-menu"><?php echo bazar_icon('grid'); ?>دسته‌ها</button>
  <button type="button" data-open="#drawer-cart"><span class="tb-ic"><?php echo bazar_icon('bag').bazar_cart_badge(); ?></span>سبد خرید</button>
  <a href="<?php echo esc_url(bazar_account_url()); ?>"<?php echo $bz_acct ? ' aria-current="page"' : ''; ?>><?php echo bazar_icon('user'); ?>حساب من</a>
</nav>
<?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
