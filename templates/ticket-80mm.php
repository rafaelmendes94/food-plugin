<?php

if (! defined('ABSPATH')) {
    exit;
}

if (! function_exists('rop_ticket_collect_item_meta_lines')) {
    function rop_ticket_collect_item_meta_lines($item)
    {
        if (! $item instanceof WC_Order_Item_Product) {
            return [];
        }

        $lines = [];
        $meta = $item->get_formatted_meta_data('');

        foreach ((array) $meta as $entry) {
            $label = isset($entry->display_key) ? wp_strip_all_tags((string) $entry->display_key) : '';
            $value = isset($entry->display_value) ? wp_strip_all_tags((string) $entry->display_value) : '';

            if ($label === '' || $value === '') {
                continue;
            }

            $lines[] = sanitize_text_field($label . ': ' . $value);
        }

        $raw = $item->get_meta('rop_barn2_raw', true);
        if (is_array($raw)) {
            foreach ($raw as $key => $value) {
                $clean_key = sanitize_text_field((string) $key);
                if ($clean_key === '') {
                    continue;
                }

                if (is_array($value)) {
                    $clean_value = implode(', ', array_map('sanitize_text_field', $value));
                } else {
                    $clean_value = sanitize_text_field((string) $value);
                }

                if ($clean_value !== '') {
                    $lines[] = $clean_key . ': ' . $clean_value;
                }
            }
        }

        return array_values(array_unique($lines));
    }
}
