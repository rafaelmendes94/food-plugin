<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Assets
{

    public static function enqueue_admin_assets($hook)
    {
        if (! is_admin()) {
            return;
        }

        $is_rop_admin = strpos((string) $hook, 'rop-') !== false || strpos((string) $hook, 'toplevel_page_rop-store') !== false;

        $is_product_editor = in_array($hook, ['post.php', 'post-new.php'], true) && isset($_GET['post_type']) && sanitize_key((string) $_GET['post_type']) === 'product';
        if (in_array($hook, ['post.php', 'post-new.php'], true) && isset($_GET['post'])) {
            $is_product_editor = get_post_type(absint($_GET['post'])) === 'product';
        }

        if (! $is_rop_admin && ! $is_product_editor) {
            return;
        }

        wp_enqueue_style(
            'rop-admin',
            ROP_URL . 'public/assets/css/admin.css',
            [],
            ROP_VERSION
        );

        wp_enqueue_script(
            'rop-admin',
            ROP_URL . 'public/assets/js/admin.js',
            [],
            ROP_VERSION,
            true
        );

        wp_enqueue_media();
    }

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

        self::enqueue_delivery_woo_assets();
        self::enqueue_delivery_barn2_assets();

        wp_localize_script('rop-app', 'ropAjax', [
            'url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('rop_ajax'),
        ]);
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

    private static function enqueue_delivery_woo_assets()
    {
        $handles = [
            'jquery',
            'woocommerce',
            'wc-add-to-cart',
            'wc-add-to-cart-variation',
            'wc-cart-fragments',
            'wc-checkout',
        ];

        foreach ($handles as $handle) {
            if (wp_script_is($handle, 'registered')) {
                wp_enqueue_script($handle);
            }
        }
    }

    private static function enqueue_delivery_barn2_assets()
    {
        if (! class_exists('ROP_Compat_Barn2') || ! ROP_Compat_Barn2::is_active()) {
            return;
        }

        self::enqueue_registered_assets_by_pattern('scripts');
        self::enqueue_registered_assets_by_pattern('styles');
    }

    private static function enqueue_registered_assets_by_pattern($type)
    {
        $patterns = ['barn2', 'wcpo', 'product-options'];

        if ($type === 'scripts') {
            global $wp_scripts;
            if (! isset($wp_scripts->registered) || ! is_array($wp_scripts->registered)) {
                return;
            }

            foreach (array_keys($wp_scripts->registered) as $handle) {
                if (! is_string($handle)) {
                    continue;
                }

                foreach ($patterns as $pattern) {
                    if (strpos($handle, $pattern) !== false) {
                        wp_enqueue_script($handle);
                        break;
                    }
                }
            }

            return;
        }

        global $wp_styles;
        if (! isset($wp_styles->registered) || ! is_array($wp_styles->registered)) {
            return;
        }

        foreach (array_keys($wp_styles->registered) as $handle) {
            if (! is_string($handle)) {
                continue;
            }

            foreach ($patterns as $pattern) {
                if (strpos($handle, $pattern) !== false) {
                    wp_enqueue_style($handle);
                    break;
                }
            }
        }
    }
}
