<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_ETA
{
    const OPTION_KEY = 'rop_eta_settings';

    public static function defaults()
    {
        $day = [
            ['start' => '', 'end' => '', 'add_min' => 0, 'add_max' => 0],
            ['start' => '', 'end' => '', 'add_min' => 0, 'add_max' => 0],
        ];

        return [
            'eta_base_min' => 25,
            'eta_base_max' => 45,
            'peak_enabled' => 0,
            'peak' => [
                'mon' => $day,
                'tue' => $day,
                'wed' => $day,
                'thu' => $day,
                'fri' => $day,
                'sat' => $day,
                'sun' => $day,
            ],
        ];
    }

    public static function get_settings()
    {
        $saved = get_option(self::OPTION_KEY, []);
        if (! is_array($saved)) {
            $saved = [];
        }

        $settings = wp_parse_args($saved, self::defaults());
        $settings['eta_base_min'] = max(1, absint($settings['eta_base_min']));
        $settings['eta_base_max'] = max($settings['eta_base_min'], absint($settings['eta_base_max']));
        $settings['peak_enabled'] = ! empty($settings['peak_enabled']) ? 1 : 0;
        $settings['peak'] = self::sanitize_peak_grid($settings['peak'] ?? []);

        return $settings;
    }

    public static function sanitize_settings($input)
    {
        if (! is_array($input)) {
            return self::defaults();
        }

        $baseMin = max(1, absint($input['eta_base_min'] ?? 25));
        $baseMax = max($baseMin, absint($input['eta_base_max'] ?? 45));

        return [
            'eta_base_min' => $baseMin,
            'eta_base_max' => $baseMax,
            'peak_enabled' => ! empty($input['peak_enabled']) ? 1 : 0,
            'peak' => self::sanitize_peak_grid($input['peak'] ?? []),
        ];
    }

    public static function get_eta_range($timestamp = null)
    {
        $timestamp = $timestamp ? (int) $timestamp : current_time('timestamp');
        $settings = self::get_settings();

        $min = (int) $settings['eta_base_min'];
        $max = (int) $settings['eta_base_max'];

        if (! empty($settings['peak_enabled'])) {
            $day = strtolower(substr(wp_date('D', $timestamp), 0, 3));
            foreach ((array) ($settings['peak'][$day] ?? []) as $range) {
                $start = sanitize_text_field((string) ($range['start'] ?? ''));
                $end = sanitize_text_field((string) ($range['end'] ?? ''));
                if ($start === '' || $end === '') {
                    continue;
                }

                $current = (int) wp_date('G', $timestamp) * 60 + (int) wp_date('i', $timestamp);
                $startM = self::time_to_minutes($start);
                $endM = self::time_to_minutes($end);
                $inside = $endM > $startM
                    ? ($current >= $startM && $current < $endM)
                    : ($current >= $startM || $current < $endM);

                if ($inside) {
                    $min += absint($range['add_min'] ?? 0);
                    $max += absint($range['add_max'] ?? 0);
                }
            }
        }

        if ($max < $min) {
            $max = $min;
        }

        return [$min, $max];
    }

    public static function get_eta_text($timestamp = null)
    {
        [$min, $max] = self::get_eta_range($timestamp);
        return $min . '–' . $max;
    }

    private static function sanitize_peak_grid($peak)
    {
        $output = [];
        foreach (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as $day) {
            $ranges = isset($peak[$day]) && is_array($peak[$day]) ? $peak[$day] : [];
            $output[$day] = [];
            for ($i = 0; $i < 2; $i++) {
                $range = isset($ranges[$i]) && is_array($ranges[$i]) ? $ranges[$i] : [];
                $output[$day][] = [
                    'start' => self::sanitize_time($range['start'] ?? ''),
                    'end' => self::sanitize_time($range['end'] ?? ''),
                    'add_min' => absint($range['add_min'] ?? 0),
                    'add_max' => absint($range['add_max'] ?? 0),
                ];
            }
        }

        return $output;
    }

    private static function sanitize_time($time)
    {
        $time = sanitize_text_field((string) $time);
        if (! preg_match('/^([01][0-9]|2[0-3]):([0-5][0-9])$/', $time)) {
            return '';
        }

        return $time;
    }

    private static function time_to_minutes($time)
    {
        [$h, $m] = array_map('intval', explode(':', $time));
        return ($h * 60) + $m;
    }
}
