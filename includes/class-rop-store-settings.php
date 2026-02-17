<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Store_Settings
{
    const OPTION_KEY = 'rop_store_settings';

    public static function defaults()
    {
        return [
            'store_name'      => 'Foodgo',
            'slogan'          => 'Peça sua comida favorita!',
            'phone'           => '',
            'whatsapp'        => '',
            'address'         => '',
            'logo_id'         => 0,
            'primary_color'   => '#EF4444',
            'secondary_color' => '#FFFFFF',
            'dark_color'      => '#2D2929',
            'maps_url'        => '',
            'instagram_url'   => '',
        ];
    }

    public static function get_all()
    {
        $saved = get_option(self::OPTION_KEY, []);

        if (! is_array($saved)) {
            $saved = [];
        }

        $settings = wp_parse_args($saved, self::defaults());

        $settings['store_name'] = sanitize_text_field($settings['store_name']);
        $settings['slogan'] = sanitize_text_field($settings['slogan']);
        $settings['phone'] = sanitize_text_field($settings['phone']);
        $settings['whatsapp'] = sanitize_text_field($settings['whatsapp']);
        $settings['address'] = sanitize_text_field($settings['address']);
        $settings['logo_id'] = absint($settings['logo_id']);
        $settings['primary_color'] = self::sanitize_color($settings['primary_color'], '#EF4444');
        $settings['secondary_color'] = self::sanitize_color($settings['secondary_color'], '#FFFFFF');
        $settings['dark_color'] = self::sanitize_color($settings['dark_color'], '#2D2929');
        $settings['maps_url'] = esc_url_raw($settings['maps_url']);
        $settings['instagram_url'] = esc_url_raw($settings['instagram_url']);
        $settings['logo_url'] = self::get_logo_url();

        return $settings;
    }

    public static function get_colors()
    {
        $settings = self::get_all();

        return [
            'primary' => $settings['primary_color'],
            'secondary' => $settings['secondary_color'],
            'dark' => $settings['dark_color'],
        ];
    }

    public static function get_logo_url()
    {
        $saved = get_option(self::OPTION_KEY, []);
        $logo_id = 0;

        if (is_array($saved) && isset($saved['logo_id'])) {
            $logo_id = absint($saved['logo_id']);
        }

        if (! $logo_id) {
            return '';
        }

        $logo_url = wp_get_attachment_image_url($logo_id, 'full');

        return $logo_url ? esc_url_raw($logo_url) : '';
    }

    private static function sanitize_color($color, $default)
    {
        $sanitized = sanitize_hex_color((string) $color);

        return $sanitized ? strtoupper($sanitized) : $default;
    }
}
