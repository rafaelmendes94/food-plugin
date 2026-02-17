<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Woo
{
    public static function is_woo_active()
    {
        return class_exists('WooCommerce') && function_exists('wc_get_product');
    }

    public static function get_product_card_data($product)
    {
        if (! $product instanceof WC_Product) {
            return [];
        }

        $image_url = '';
        $image_id = $product->get_image_id();

        if ($image_id) {
            $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
        }

        if (! $image_url) {
            $image_url = wc_placeholder_img_src('woocommerce_thumbnail');
        }

        $short = $product->get_short_description();

        return [
            'id' => (int) $product->get_id(),
            'type' => sanitize_text_field($product->get_type()),
            'name' => wp_strip_all_tags($product->get_name()),
            'price_html' => wp_kses_post($product->get_price_html()),
            'price' => (float) $product->get_price(),
            'image' => esc_url_raw($image_url),
            'short' => wp_strip_all_tags((string) $short),
            'rating' => (float) $product->get_average_rating(),
            'on_sale' => (bool) $product->is_on_sale(),
            'permalink' => esc_url_raw($product->get_permalink()),
            'is_simple' => $product->is_type('simple'),
            'has_addons' => (bool) apply_filters('rop_product_has_addons', false, $product),
        ];
    }
}
