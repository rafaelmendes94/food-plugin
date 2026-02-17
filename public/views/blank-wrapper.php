<?php
if (! defined('ABSPATH')) {
    exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class('rop-delivery-page'); ?>>
<?php
wp_body_open();

if (have_posts()) {
    while (have_posts()) {
        the_post();
        echo do_shortcode(get_the_content());
    }
} else {
    echo do_shortcode('[rop_foodgo_app]');
}
?>
<?php wp_footer(); ?>
</body>
</html>
