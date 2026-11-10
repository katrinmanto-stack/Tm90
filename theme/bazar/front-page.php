<?php
get_header();
$wc      = function_exists('wc_get_page_id');
$cats    = bazar_top_cats(12);
$shop    = bazar_shop_url();
$banners = function_exists('bazar_banners_html') ? bazar_banners_html() : '';
$order   = bazar_home_order();

// متن‌های هیرو (قابل‌تنظیم از اپ)
$hero_title = bazar_or('hero_title', 'استایل خودت را پیدا کن');
$hero_text  = bazar_or('hero_text', 'لباس زنانه، اکسسوری و گجت‌های منتخب؛ با ارسال سریع و ضمانت اصالت کالا.');
$hero_b1    = bazar_or('hero_btn1', 'مشاهده فروشگاه');
$hero_b1u   = bazar_or('hero_btn1_url', $shop);
$hero_b2    = bazar_or('hero_btn2', 'پیشنهادهای ویژه');
$hero_b2u   = bazar_or('hero_btn2_url', '#featured');
$is_gold    = (bazar_opt('hero_style') === 'gold') && !$banners;

// تعداد و عنوان‌ها
$feat_n   = max(4, min(16, (int) bazar_or('featured_count', '8')));
$feat_ttl = bazar_or('featured_title', 'محصولات ویژه');
$rows_n   = max(1, min(4, (int) bazar_or('rows_count', '3')));

function bazar_tile($t, $cls = '') {
  $img = bazar_term_img($t, 'medium_large');
  echo '<a class="tile'.($img ? ' has-img' : ' '.$cls).'" href="'.esc_url(get_term_link($t)).'"'.($img ? ' style="background-image:url('.esc_url($img).')"' : '').'><b>'.esc_html($t->name).'</b><span>مشاهده محصولات</span></a>';
}
?>
<main>
<h1 class="sr-only"><?php bloginfo('name'); ?> | <?php bloginfo('description'); ?></h1>
<section class="wrap hero<?php echo $cats ? '' : ' hero-solo'; ?><?php echo $is_gold ? ' hero-gold' : ''; ?>" aria-label="معرفی">
  <div class="hero-main<?php echo $is_gold ? ' is-gold' : ''; ?>">
    <?php if ($banners) : echo $banners; ?>
      <button class="arr arr-p" data-slide="-1" aria-label="قبلی"><?php echo bazar_icon('arrow'); ?></button>
      <button class="arr arr-n" data-slide="1" aria-label="بعدی"><?php echo bazar_icon('arrow'); ?></button>
    <?php else : ?>
      <div class="hero-fb">
        <div class="hero-fb-t">
          <h2><?php echo esc_html($hero_title); ?></h2>
          <p><?php echo esc_html($hero_text); ?></p>
          <div class="row">
            <a class="btn btn-a" href="<?php echo esc_url($hero_b1u); ?>"><?php echo esc_html($hero_b1); ?></a>
            <a class="btn btn-o" href="<?php echo esc_url($hero_b2u); ?>"><?php echo esc_html($hero_b2); ?></a>
          </div>
        </div>
        <div class="arches" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>
    <?php endif; ?>
  </div>
  <?php if ($cats) : ?><div class="hero-side">
    <?php bazar_tile($cats[0], 't-accent'); if (isset($cats[1])) bazar_tile($cats[1], 't-soft'); ?>
  </div><?php endif; ?>
</section>

<?php foreach ($order as $sec) : ?>

<?php if ($sec === 'categories' && $cats) : ?>
<section class="wrap cats" aria-label="دسته‌بندی‌ها">
  <?php foreach ($cats as $c) : $img = bazar_term_img($c, 'woocommerce_thumbnail'); ?>
    <a class="cat" href="<?php echo esc_url(get_term_link($c)); ?>"><span class="cat-i"<?php echo $img ? ' style="background-image:url('.esc_url($img).')"' : ''; ?>><?php echo $img ? '' : esc_html(mb_substr($c->name, 0, 1)); ?></span><?php echo esc_html($c->name); ?></a>
  <?php endforeach; ?>
</section>
<?php endif; ?>

<?php if ($sec === 'featured' && $wc) : ?>
<section class="wrap" id="featured" data-sec="featured">
  <div class="sh"><h2><?php echo esc_html($feat_ttl); ?></h2>
    <div class="tabs" role="tablist">
      <button role="tab" id="tab-new" aria-controls="p-new" aria-selected="true">جدیدترین</button>
      <button role="tab" id="tab-best" aria-controls="p-best" aria-selected="false">پرفروش‌ها</button>
      <button role="tab" id="tab-sale" aria-controls="p-sale" aria-selected="false">تخفیف‌دار</button>
    </div>
  </div>
  <div id="p-new" role="tabpanel" aria-labelledby="tab-new"><?php echo do_shortcode('[products limit="'.$feat_n.'" columns="4" orderby="date" order="DESC"]'); ?></div>
  <div id="p-best" role="tabpanel" aria-labelledby="tab-best" hidden><?php echo do_shortcode('[best_selling_products limit="'.$feat_n.'" columns="4"]'); ?></div>
  <div id="p-sale" role="tabpanel" aria-labelledby="tab-sale" hidden><?php $s = do_shortcode('[sale_products limit="'.$feat_n.'" columns="4"]'); echo $s ? $s : '<p>فعلاً محصول تخفیف‌داری نداریم.</p>'; ?></div>
</section>
<?php endif; ?>

<?php if ($sec === 'promo' && $wc) : ?>
<section class="wrap promo">
  <div><h2><?php echo esc_html(bazar_or('promo_title', 'تخفیف‌های ویژه را از دست نده')); ?></h2><p><?php echo esc_html(bazar_or('promo_text', 'محصولات تخفیف‌دار را یک‌جا ببین و سریع‌تر انتخاب کن.')); ?></p></div>
  <a class="btn" href="#featured" data-tab-go="tab-sale"><?php echo esc_html(bazar_or('promo_btn', 'مشاهده تخفیف‌ها')); ?></a>
</section>
<?php endif; ?>

<?php if ($sec === 'rows' && $wc) : ?>
<?php foreach (array_slice($cats, 0, $rows_n) as $c) : ?>
<section class="wrap">
  <div class="sh"><h2><?php echo esc_html($c->name); ?></h2><a href="<?php echo esc_url(get_term_link($c)); ?>">مشاهده همه</a></div>
  <?php echo do_shortcode('[products category="'.esc_attr($c->slug).'" limit="4" columns="4"]'); ?>
</section>
<?php endforeach; ?>
<?php endif; ?>

<?php if ($sec === 'benefits') : ?>
<section class="wrap feat" aria-label="مزایا">
  <?php $bz_icons = array('truck', 'shield', 'card', 'chat'); ?>
  <?php foreach (bazar_benefits() as $i => $b) : ?>
  <div><?php echo bazar_icon($bz_icons[$i % 4]); ?><p><b><?php echo esc_html($b[0]); ?></b><span><?php echo esc_html($b[1]); ?></span></p></div>
  <?php endforeach; ?>
</section>
<?php endif; ?>

<?php endforeach; ?>

<?php if (!$wc) : ?>
<section class="wrap"><p>برای نمایش محصولات، افزونه ووکامرس را نصب و فعال کنید.</p></section>
<?php endif; ?>
</main>
<?php get_footer(); ?>
