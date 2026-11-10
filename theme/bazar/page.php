<?php get_header(); ?>
<main class="wrap content">
<?php while (have_posts()) : the_post(); ?>
  <h1 class="page-title"><?php the_title(); ?></h1>
  <?php the_content(); ?>
<?php endwhile; ?>
</main>
<?php get_footer(); ?>
