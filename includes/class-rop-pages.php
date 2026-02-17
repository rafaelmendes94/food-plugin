<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Pages
{
    public static function init()
    {
        add_shortcode('rop_foodgo_app', [__CLASS__, 'render_foodgo_app']);
        add_filter('template_include', [__CLASS__, 'maybe_use_delivery_template'], 999);
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

    public static function maybe_use_delivery_template($template)
    {
        if (! self::is_delivery_request()) {
            return $template;
        }

        $blank_template = ROP_PATH . 'public/views/blank-wrapper.php';

        if (file_exists($blank_template)) {
            return $blank_template;
        }

        return $template;
    }

    public static function add_delivery_body_class($classes)
    {
        if (! self::is_delivery_request()) {
            return $classes;
        }

        $classes[] = 'rop-delivery-page';

        return array_values(array_unique($classes));
    }

    private static function is_delivery_request()
    {
        if (is_admin()) {
            return false;
        }

        if (is_page('delivery')) {
            return true;
        }

        $queried_id = get_queried_object_id();

        if (! $queried_id) {
            return false;
        }

        return get_post_field('post_name', $queried_id) === 'delivery';
    }
}
