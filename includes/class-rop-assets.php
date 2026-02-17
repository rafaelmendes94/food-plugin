<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Assets
{
    public static function enqueue_public_assets()
    {
        if (! self::is_delivery_request()) {
            return;
        }

        wp_enqueue_style(
            'rop-app',
            ROP_URL . 'public/assets/css/app.css',
            [],
            ROP_VERSION
        );

        wp_enqueue_script(
            'rop-app',
            ROP_URL . 'public/assets/js/app.js',
            [],
            ROP_VERSION,
            true
        );
    }

    private static function is_delivery_request()
    {
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
