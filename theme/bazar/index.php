<?php get_header(); ?>
<main class="wrap content">
<?php if (!is_singular()) : ?><h1 class="sr-only"><?php echo esc_html(wp_get_document_title()); ?></h1><?php endif; ?>
<?php if (have_posts()) : while (have_posts()) : the_post(); ?>
  <article class="post-card">
    <?php $h = is_singular() ? 'h1' : 'h2'; ?><<?php echo $h; ?> class="page-title"><?php if (is_singular()) the_title(); else echo '<a href="'.esc_url(get_permalink()).'">'.esc_html(get_the_title()).'</a>'; ?></<?php echo $h; ?>>
    <?php is_singular() ? the_content() : the_excerpt(); ?>
  </article>
<?php endwhile; the_posts_pagination(); else : ?>
  <h1 class="page-title">چیزی پیدا نشد</h1>
  <p>عبارت دیگری را جستجو کنید یا از منو یک دسته را انتخاب کنید.</p>
<?php endif; ?>
</main>
<?php get_footer(); ?>
