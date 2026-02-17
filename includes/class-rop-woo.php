<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Woo
{
    public static function is_woo_active(): bool
    {
        return class_exists('WooCommerce') && function_exists('wc_get_product');
    }

    public static function get_product_card_data(WC_Product $product): array
    {
        $image_id = $product->get_image_id();
        $image = $image_id ? wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : '';

        if (! $image) {
            $image = wc_placeholder_img_src('woocommerce_thumbnail');
        }

        $short_description = $product->get_short_description();

        return [
            'id'         => (int) $product->get_id(),
            'type'       => sanitize_key($product->get_type()),
            'name'       => wp_strip_all_tags((string) $product->get_name()),
            'price_html' => wp_kses_post((string) $product->get_price_html()),
            'price'      => (float) $product->get_price(),
            'image'      => esc_url_raw((string) $image),
            'short'      => wp_strip_all_tags((string) $short_description),
            'rating'     => (float) $product->get_average_rating(),
            'on_sale'    => (bool) $product->is_on_sale(),
            'permalink'  => esc_url_raw((string) $product->get_permalink()),
            'is_simple'  => $product->is_type('simple'),
        ];
    }

    public static function maybe_boot_cart(): void
    {
        if (! self::is_woo_active() || ! function_exists('WC')) {
            return;
        }

        if (null === WC()->session && method_exists(WC(), 'initialize_session')) {
            WC()->initialize_session();
        }

        if (null === WC()->cart && function_exists('wc_load_cart')) {
            wc_load_cart();
        }
    }
}
