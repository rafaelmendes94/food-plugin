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
        return self::render_fields_only_html($product_id);
    }

    public static function render_fields_only_html($product_id)
    {
        $product_id = absint($product_id);

        if (! $product_id || ! self::is_active()) {
            return '';
        }

        $product = wc_get_product($product_id);
        $post = get_post($product_id);

        if (! $product || ! $post instanceof WP_Post) {
            return '';
        }

        $previous_product = $GLOBALS['product'] ?? null;
        $previous_post = $GLOBALS['post'] ?? null;

        $GLOBALS['product'] = $product;
        $GLOBALS['post'] = $post;
        setup_postdata($post);

        ob_start();
        do_action('woocommerce_before_single_product');
        do_action('woocommerce_before_add_to_cart_form');
        do_action('woocommerce_before_add_to_cart_button');
        do_action('woocommerce_before_add_to_cart_quantity');
        do_action('woocommerce_after_add_to_cart_quantity');
        do_action('woocommerce_after_add_to_cart_button');
        do_action('woocommerce_after_add_to_cart_form');
        $html = ob_get_clean();

        wp_reset_postdata();

        if ($previous_product) {
            $GLOBALS['product'] = $previous_product;
        } else {
            unset($GLOBALS['product']);
        }

        if ($previous_post) {
            $GLOBALS['post'] = $previous_post;
        } else {
            unset($GLOBALS['post']);
        }

        $html = is_string($html) ? trim($html) : '';
        if ($html === '') {
            return '';
        }

        libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $loaded = $dom->loadHTML('<?xml encoding="utf-8" ?><div id="rop-barn2-root">' . $html . '</div>');

        if (! $loaded) {
            return '';
        }

        $xpath = new DOMXPath($dom);
        $root = $xpath->query('//*[@id="rop-barn2-root"]')->item(0);

        if (! $root instanceof DOMNode) {
            return '';
        }

        foreach ($xpath->query('.//button[@type="submit"] | .//input[@type="submit"] | .//*[contains(@class,"single_add_to_cart_button")] | .//*[contains(@class,"quantity")] | .//input[@name="quantity"]', $root) as $bad) {
            if ($bad->parentNode) {
                $bad->parentNode->removeChild($bad);
            }
        }

        foreach ($xpath->query('.//form', $root) as $form) {
            $fragment = $dom->createDocumentFragment();
            while ($form->firstChild) {
                $fragment->appendChild($form->firstChild);
            }
            if ($form->parentNode) {
                $form->parentNode->replaceChild($fragment, $form);
            }
        }

        $wrappers = $xpath->query('.//*[contains(translate(@class,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"wpo") or contains(translate(@class,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"barn2") or contains(translate(@class,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"wcpo")]', $root);

        $out = '';
        if ($wrappers->length > 0) {
            foreach ($wrappers as $node) {
                $out .= $dom->saveHTML($node);
            }
        } else {
            $groups = $xpath->query('.//input[@name] | .//select[@name] | .//textarea[@name]', $root);
            $fallback = '';

            foreach ($groups as $field) {
                $labelHtml = '';
                $id = $field->attributes && $field->attributes->getNamedItem('id')
                    ? $field->attributes->getNamedItem('id')->nodeValue
                    : '';

                if ($id !== '') {
                    $label = $xpath->query('.//label[@for="' . esc_attr($id) . '"]', $root)->item(0);
                    if ($label) {
                        $labelHtml = $dom->saveHTML($label);
                    }
                }

                if ($labelHtml === '' && $field->parentNode instanceof DOMElement && strtolower($field->parentNode->nodeName) === 'label') {
                    $labelHtml = $dom->saveHTML($field->parentNode);
                }

                $fieldHtml = $dom->saveHTML($field);
                $fallback .= '<div class="rop-barn2-field">' . $labelHtml . $fieldHtml . '</div>';
            }

            $out = $fallback;
        }

        $out = trim((string) $out);
        if ($out === '') {
            return '';
        }

        return '<div class="rop-barn2-fields">' . $out . '</div>';
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
            if (is_array($value) && isset($value['name'])) {
                $clean_key = sanitize_text_field((string) $value['name']);
                $raw_value = $value['value'] ?? '';
            } else {
                $clean_key = sanitize_text_field((string) $key);
                $raw_value = $value;
            }

            if ($clean_key === '') {
                continue;
            }

            if (is_array($raw_value)) {
                $clean[$clean_key] = array_values(array_map(static function ($v) {
                    return sanitize_text_field((string) $v);
                }, $raw_value));
                continue;
            }

            $clean[$clean_key] = sanitize_text_field((string) $raw_value);
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
