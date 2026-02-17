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
            || function_exists('barn2_wc_product_options');
    }

    public static function render_options_html($product_id)
    {
        $product_id = absint($product_id);

        if (! $product_id || ! self::is_active()) {
            return '';
        }

        if (shortcode_exists('product_options')) {
            $html = do_shortcode('[product_options id="' . $product_id . '"]');
            if (is_string($html) && trim($html) !== '') {
                return $html;
            }
        }

        return '';
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
            $clean_key = sanitize_key((string) $key);

            if ($clean_key === '') {
                continue;
            }

            if (is_array($value)) {
                $clean[$clean_key] = array_values(array_map('sanitize_text_field', $value));
            } else {
                $clean[$clean_key] = sanitize_text_field((string) $value);
            }
        }

        return $clean;
    }
}
