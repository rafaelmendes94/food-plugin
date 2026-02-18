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
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_embed_product_assets'], 50);
        add_filter('show_admin_bar', [__CLASS__, 'hide_admin_bar_on_embed_product']);
        add_action('wp_footer', [__CLASS__, 'print_embed_product_bridge_script'], 999);
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

    public static function enqueue_embed_product_assets()
    {
        if (! is_singular('product') || empty($_GET['rop_embed'])) {
            return;
        }

        wp_enqueue_style(
            'rop-embed-product',
            ROP_URL . 'public/assets/css/embed-product.css',
            [],
            ROP_VERSION
        );
    }

    public static function hide_admin_bar_on_embed_product($show)
    {
        if (is_singular('product') && ! empty($_GET['rop_embed'])) {
            return false;
        }

        return $show;
    }

    public static function print_embed_product_bridge_script()
    {
        if (! is_singular('product') || empty($_GET['rop_embed'])) {
            return;
        }
        ?>
        <script>
            (function () {
                function postToParent(type) {
                    window.parent.postMessage({ source: 'rop-embed', type: type }, '*');
                }

                document.addEventListener('submit', function (e) {
                    var form = e.target;
                    if (!form || !form.classList || !form.classList.contains('cart')) {
                        return;
                    }
                    postToParent('add_to_cart_submitted');
                }, true);

                if (window.jQuery) {
                    window.jQuery(document.body).on('added_to_cart', function () {
                        postToParent('added_to_cart');
                    });
                } else {
                    document.addEventListener('click', function (e) {
                        var button = e.target.closest('button.single_add_to_cart_button, button.button');
                        if (!button) {
                            return;
                        }
                        postToParent('added_to_cart');
                    }, true);
                }
            })();
        </script>
        <?php
    }

}

