<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Hours
{
    const OPTION_KEY = 'rop_hours_settings';

    /**
     * Default schedule reference (future use by UI).
     * If no settings exist, plugin behaves as always open for v1.2.1.
     */
    public static function defaults()
    {
        return [
            'mon_fri' => ['open' => '11:00', 'close' => '23:00'],
            'sat_sun' => ['open' => '17:00', 'close' => '02:00'],
        ];
    }

    public static function is_open()
    {
        $settings = get_option(self::OPTION_KEY, null);

        if (! is_array($settings) || empty($settings)) {
            return true;
        }

        if (isset($settings['force_closed']) && (bool) $settings['force_closed']) {
            return false;
        }

        if (isset($settings['always_open'])) {
            return (bool) $settings['always_open'];
        }

        return true;
    }

    public static function next_open_time()
    {
        if (self::is_open()) {
            return '';
        }

        $settings = get_option(self::OPTION_KEY, []);

        if (is_array($settings) && ! empty($settings['next_open_time'])) {
            return sanitize_text_field($settings['next_open_time']);
        }

        return '11:00';
    }

    public static function human_status()
    {
        if (self::is_open()) {
            return 'Aberto agora';
        }

        return sprintf('Fechado — abrimos às %s', self::next_open_time());
    }
}
