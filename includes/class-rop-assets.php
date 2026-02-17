<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Assets
{
    public static function enqueue_public_assets()
    {
        if (! is_page('delivery')) {
            return;
        }

        wp_enqueue_script(
            'rop-app',
            ROP_URL . 'public/assets/js/app.js',
            [],
            ROP_VERSION,
            true
        );
    }
}
