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

        $category_name = '';
        $category_slug = '';

        $terms = wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'all']);

        if (! is_wp_error($terms) && is_array($terms) && ! empty($terms)) {
            $top_level = array_values(array_filter($terms, static function ($term) {
                return $term instanceof WP_Term && (int) $term->parent === 0;
            }));

            if (! empty($top_level)) {
                usort($top_level, static function ($a, $b) {
                    return (int) $b->count <=> (int) $a->count;
                });

                $primary = $top_level[0];
            } else {
                $primary = $terms[0];
            }

            if ($primary instanceof WP_Term) {
                $category_name = sanitize_text_field($primary->name);
                $category_slug = sanitize_title($primary->slug);
            }
        }

        return [
            'id' => (int) $product->get_id(),
            'type' => sanitize_text_field($product->get_type()),
            'name' => wp_strip_all_tags($product->get_name()),
            'price_html' => wp_kses_post($product->get_price_html()),
            'price' => (float) $product->get_price(),
            'image' => esc_url_raw($image_url),
            'short' => '',
            'rating' => (float) $product->get_average_rating(),
            'on_sale' => (bool) $product->is_on_sale(),
            'permalink' => esc_url_raw($product->get_permalink()),
            'is_simple' => $product->is_type('simple'),
            'has_addons' => (bool) apply_filters('rop_product_has_addons', false, $product),
            'category_name' => $category_name,
            'category_slug' => $category_slug,
        ];
    }
}
