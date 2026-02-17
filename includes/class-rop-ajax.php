<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Ajax
{
    public static function register()
    {
        add_action('wp_ajax_rop_get_store_settings', [self::class, 'get_store_settings']);
        add_action('wp_ajax_nopriv_rop_get_store_settings', [self::class, 'get_store_settings']);
        add_action('wp_ajax_rop_get_store_status', [self::class, 'get_store_status']);
        add_action('wp_ajax_nopriv_rop_get_store_status', [self::class, 'get_store_status']);
    }

    public static function get_store_settings()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        $data = ROP_Store_Settings::get_all();

        wp_send_json_success([
            'store' => $data,
        ]);
    }

    public static function get_store_status()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        $is_open = (bool) ROP_Hours::is_open();

        wp_send_json_success([
            'is_open' => $is_open,
            'human_status' => sanitize_text_field(ROP_Hours::human_status()),
            'next_open_time' => sanitize_text_field(ROP_Hours::next_open_time()),
        ]);
    }
}
