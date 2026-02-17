<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Pages
{
    public static function init()
    {
        add_shortcode('rop_foodgo_app', [__CLASS__, 'render_foodgo_app']);
        add_filter('template_include', function ($template) {
            if (is_page('delivery')) {
                return ROP_PATH . 'public/views/template-delivery.php';
            }

            return $template;
        }, 999);
        add_filter('body_class', [__CLASS__, 'add_delivery_body_class']);
    }

    public static function activate()
    {
        $existing_page = get_page_by_path('delivery');

        if ($existing_page instanceof WP_Post) {
            if ($existing_page->post_content !== '[rop_foodgo_app]') {
                wp_update_post([
                    'ID' => $existing_page->ID,
                    'post_content' => '[rop_foodgo_app]',
                ]);
            }

            return;
        }

        wp_insert_post([
            'post_title'   => 'Delivery',
            'post_name'    => 'delivery',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => '[rop_foodgo_app]',
        ]);
    }

    public static function render_foodgo_app()
    {
        ob_start();
        include ROP_PATH . 'public/views/app-shell.php';
        return ob_get_clean();
    }

    public static function add_delivery_body_class($classes)
    {
        if (! is_page('delivery')) {
            return $classes;
        }

        $classes[] = 'rop-delivery-page';

        return array_values(array_unique($classes));
    }
}
