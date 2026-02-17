<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Compat_Barn2
{
    public static function is_active()
    {
        return class_exists('Barn2\\Plugin\\WC_Product_Options\\Plugin')
            || defined('BARN2_WC_PRODUCT_OPTIONS_VERSION')
            || shortcode_exists('product_options')
            || shortcode_exists('wc_product_options')
            || function_exists('barn2_wc_product_options');
    }

    public static function render_options_html($product_id)
    {
        $product_id = absint($product_id);

        if (! $product_id || ! self::is_active()) {
            return '';
        }

        $product = wc_get_product($product_id);
        if (! $product) {
            return '';
        }

        $html = '';

        if (shortcode_exists('product_options')) {
            $html = do_shortcode('[product_options id="' . $product_id . '"]');
        }

        if (trim((string) $html) === '' && shortcode_exists('wc_product_options')) {
            $html = do_shortcode('[wc_product_options id="' . $product_id . '"]');
        }

        if (trim((string) $html) === '') {
            $previous_product = $GLOBALS['product'] ?? null;
            $GLOBALS['product'] = $product;

            ob_start();
            do_action('woocommerce_before_add_to_cart_button');
            do_action('woocommerce_after_add_to_cart_button');
            $html = ob_get_clean();

            if ($previous_product) {
                $GLOBALS['product'] = $previous_product;
            } else {
                unset($GLOBALS['product']);
            }
        }

        return is_string($html) ? $html : '';
    }

    public static function parse_posted_options($raw)
    {
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode(wp_unslash($raw), true);
            if (is_array($decoded)) {
                $raw = $decoded;
            }
        }

        if (! is_array($raw)) {
            return [];
        }

        $clean = [];

        foreach ($raw as $key => $value) {
            $clean_key = sanitize_text_field((string) $key);
            if ($clean_key === '') {
                continue;
            }

            if (is_array($value)) {
                $clean[$clean_key] = array_values(array_map(static function ($v) {
                    return sanitize_text_field((string) $v);
                }, $value));
                continue;
            }

            $clean[$clean_key] = sanitize_text_field((string) $value);
        }

        return $clean;
    }

    public static function build_post_from_extras($extras_array)
    {
        $extras = self::parse_posted_options($extras_array);
        $posted = [];

        foreach ($extras as $name => $value) {
            $clean_name = sanitize_text_field((string) $name);
            if ($clean_name === '') {
                continue;
            }

            if (is_array($value)) {
                $posted[$clean_name] = array_values(array_map(static function ($v) {
                    return sanitize_text_field((string) $v);
                }, $value));
                continue;
            }

            $posted[$clean_name] = sanitize_text_field((string) $value);
        }

        return $posted;
    }
}
