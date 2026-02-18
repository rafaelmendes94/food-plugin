<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Hours
{
    const OPTION_KEY = 'rop_hours_settings';

    public static function init()
    {
        add_action('woocommerce_checkout_process', [self::class, 'validate_checkout_open']);
    }

    public static function defaults()
    {
        $day = [
            'enabled' => 1,
            'ranges' => [
                ['start' => '09:00', 'end' => '18:00'],
                ['start' => '', 'end' => ''],
            ],
        ];

        return [
            'mon' => $day,
            'tue' => $day,
            'wed' => $day,
            'thu' => $day,
            'fri' => $day,
            'sat' => $day,
            'sun' => $day,
        ];
    }

    public static function get_settings()
    {
        $saved = get_option(self::OPTION_KEY, []);
        if (! is_array($saved)) {
            $saved = [];
        }

        $settings = wp_parse_args($saved, self::defaults());
        $days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        foreach ($days as $day) {
            $row = isset($settings[$day]) && is_array($settings[$day]) ? $settings[$day] : [];
            $enabled = isset($row['enabled']) ? absint($row['enabled']) : 0;
            $ranges = isset($row['ranges']) && is_array($row['ranges']) ? $row['ranges'] : [];
            $normalized = [];

            for ($i = 0; $i < 2; $i++) {
                $range = isset($ranges[$i]) && is_array($ranges[$i]) ? $ranges[$i] : [];
                $normalized[] = [
                    'start' => self::sanitize_time($range['start'] ?? ''),
                    'end' => self::sanitize_time($range['end'] ?? ''),
                ];
            }

            $settings[$day] = [
                'enabled' => $enabled ? 1 : 0,
                'ranges' => $normalized,
            ];
        }

        return $settings;
    }

    public static function sanitize_settings($input)
    {
        if (! is_array($input)) {
            return self::defaults();
        }

        $output = [];
        foreach (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as $day) {
            $row = isset($input[$day]) && is_array($input[$day]) ? $input[$day] : [];
            $ranges = isset($row['ranges']) && is_array($row['ranges']) ? $row['ranges'] : [];
            $normalized = [];

            for ($i = 0; $i < 2; $i++) {
                $range = isset($ranges[$i]) && is_array($ranges[$i]) ? $ranges[$i] : [];
                $start = self::sanitize_time($range['start'] ?? '');
                $end = self::sanitize_time($range['end'] ?? '');
                if ($start !== '' && $end !== '' && self::time_to_minutes($start) !== self::time_to_minutes($end)) {
                    $normalized[] = ['start' => $start, 'end' => $end];
                } else {
                    $normalized[] = ['start' => '', 'end' => ''];
                }
            }

            $output[$day] = [
                'enabled' => ! empty($row['enabled']) ? 1 : 0,
                'ranges' => $normalized,
            ];
        }

        return $output;
    }

    public static function is_open($timestamp = null)
    {
        $timestamp = $timestamp ? (int) $timestamp : current_time('timestamp');
        $settings = self::get_settings();
        $dayKey = strtolower(wp_date('D', $timestamp));
        $dayKey = substr($dayKey, 0, 3);
        $map = ['mon' => 'mon', 'tue' => 'tue', 'wed' => 'wed', 'thu' => 'thu', 'fri' => 'fri', 'sat' => 'sat', 'sun' => 'sun'];
        $day = $map[$dayKey] ?? 'mon';

        return self::is_open_in_day($settings[$day] ?? [], $timestamp);
    }

    public static function next_open_time($timestamp = null)
    {
        $timestamp = $timestamp ? (int) $timestamp : current_time('timestamp');
        if (self::is_open($timestamp)) {
            return '';
        }

        $settings = self::get_settings();
        $days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        $currentW = (int) wp_date('w', $timestamp);

        for ($offset = 0; $offset < 8; $offset++) {
            $idx = ($currentW + $offset) % 7;
            $day = $days[$idx];
            $info = $settings[$day] ?? ['enabled' => 0, 'ranges' => []];
            if (empty($info['enabled'])) {
                continue;
            }

            foreach ((array) ($info['ranges'] ?? []) as $range) {
                $start = self::sanitize_time($range['start'] ?? '');
                if ($start === '') {
                    continue;
                }

                if ($offset === 0) {
                    $startTs = strtotime(wp_date('Y-m-d', $timestamp) . ' ' . $start);
                    if ($startTs && $startTs > $timestamp) {
                        return $start;
                    }
                } else {
                    return $start;
                }
            }
        }

        return '09:00';
    }

    public static function human_status($timestamp = null)
    {
        if (self::is_open($timestamp)) {
            return 'Aberto agora';
        }

        return sprintf('Fechado — abrimos às %s', self::next_open_time($timestamp));
    }

    public static function schedule_for_display()
    {
        $settings = self::get_settings();
        $labels = [
            'mon' => 'Segunda',
            'tue' => 'Terça',
            'wed' => 'Quarta',
            'thu' => 'Quinta',
            'fri' => 'Sexta',
            'sat' => 'Sábado',
            'sun' => 'Domingo',
        ];

        $rows = [];
        foreach ($labels as $day => $label) {
            $entry = $settings[$day] ?? [];
            if (empty($entry['enabled'])) {
                $rows[] = ['day' => $label, 'text' => 'Fechado'];
                continue;
            }

            $parts = [];
            foreach ((array) ($entry['ranges'] ?? []) as $range) {
                $start = self::sanitize_time($range['start'] ?? '');
                $end = self::sanitize_time($range['end'] ?? '');
                if ($start !== '' && $end !== '') {
                    $parts[] = $start . ' às ' . $end;
                }
            }

            $rows[] = ['day' => $label, 'text' => empty($parts) ? 'Fechado' : implode(' • ', $parts)];
        }

        return $rows;
    }

    public static function validate_checkout_open()
    {
        if (self::is_open()) {
            return;
        }

        wc_add_notice(self::human_status(), 'error');
    }

    private static function is_open_in_day($dayData, $timestamp)
    {
        if (! is_array($dayData) || empty($dayData['enabled'])) {
            return false;
        }

        $currentMinutes = (int) wp_date('G', $timestamp) * 60 + (int) wp_date('i', $timestamp);
        foreach ((array) ($dayData['ranges'] ?? []) as $range) {
            $start = self::sanitize_time($range['start'] ?? '');
            $end = self::sanitize_time($range['end'] ?? '');
            if ($start === '' || $end === '') {
                continue;
            }

            $startMinutes = self::time_to_minutes($start);
            $endMinutes = self::time_to_minutes($end);

            if ($endMinutes > $startMinutes) {
                if ($currentMinutes >= $startMinutes && $currentMinutes < $endMinutes) {
                    return true;
                }
            } else {
                if ($currentMinutes >= $startMinutes || $currentMinutes < $endMinutes) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function sanitize_time($time)
    {
        $time = sanitize_text_field((string) $time);
        if ($time === '') {
            return '';
        }

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
