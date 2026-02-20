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
        $now = self::resolve_now($timestamp);
        $settings = self::get_settings();

        $today = self::day_key_from_date($now);
        $yesterday = self::day_key_from_date($now->modify('-1 day'));

        $open_today = self::is_open_for_day($settings[$today] ?? [], $now, $now, false);
        $open_from_yesterday = self::is_open_for_day($settings[$yesterday] ?? [], $now->modify('-1 day'), $now, true);

        if (! $open_today && ! $open_from_yesterday && self::has_mismatch_today($settings[$today] ?? [], $now)) {
            self::log_issue('hours_mismatch', [
                'now' => wp_date('c', $now->getTimestamp(), wp_timezone()),
                'tz' => wp_timezone_string(),
                'dow' => (int) $now->format('N'),
                'ranges' => $settings[$today]['ranges'] ?? [],
            ]);
        }

        return $open_today || $open_from_yesterday;
    }

    public static function next_open_time($timestamp = null)
    {
        $now = self::resolve_now($timestamp);
        if (self::is_open($timestamp)) {
            return '';
        }

        $settings = self::get_settings();
        $best = null;

        for ($offset = 0; $offset < 8; $offset++) {
            $dayDate = $now->modify('+' . $offset . ' day');
            $dayKey = self::day_key_from_date($dayDate);
            $day = $settings[$dayKey] ?? ['enabled' => 0, 'ranges' => []];
            if (empty($day['enabled'])) {
                continue;
            }

            foreach ((array) ($day['ranges'] ?? []) as $range) {
                $start = self::sanitize_time($range['start'] ?? '');
                $end = self::sanitize_time($range['end'] ?? '');
                if ($start === '' || $end === '') {
                    continue;
                }

                [$h, $m] = array_map('intval', explode(':', $start));
                $candidate = $dayDate->setTime($h, $m, 0);
                if ($candidate <= $now) {
                    continue;
                }

                if ($best === null || $candidate < $best) {
                    $best = $candidate;
                }
            }
        }

        return $best ? $best->format('H:i') : '09:00';
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

    private static function is_open_for_day($dayData, DateTimeImmutable $dayDate, DateTimeImmutable $now, $only_overnight)
    {
        if (! is_array($dayData) || empty($dayData['enabled'])) {
            return false;
        }

        foreach ((array) ($dayData['ranges'] ?? []) as $range) {
            $start = self::sanitize_time($range['start'] ?? '');
            $end = self::sanitize_time($range['end'] ?? '');
            if ($start === '' || $end === '') {
                continue;
            }

            [$sh, $sm] = array_map('intval', explode(':', $start));
            [$eh, $em] = array_map('intval', explode(':', $end));

            $startDt = $dayDate->setTime($sh, $sm, 0);
            $endDt = $dayDate->setTime($eh, $em, 0);
            $overnight = $endDt <= $startDt;
            if ($overnight) {
                $endDt = $endDt->modify('+1 day');
            }

            if ($only_overnight && ! $overnight) {
                continue;
            }

            if ($now >= $startDt && $now < $endDt) {
                return true;
            }
        }

        return false;
    }

    private static function has_mismatch_today($dayData, DateTimeImmutable $now)
    {
        if (! is_array($dayData) || empty($dayData['enabled'])) {
            return false;
        }

        foreach ((array) ($dayData['ranges'] ?? []) as $range) {
            $start = self::sanitize_time($range['start'] ?? '');
            $end = self::sanitize_time($range['end'] ?? '');
            if ($start === '' || $end === '') {
                continue;
            }

            [$sh, $sm] = array_map('intval', explode(':', $start));
            [$eh, $em] = array_map('intval', explode(':', $end));
            $startDt = $now->setTime($sh, $sm, 0);
            $endDt = $now->setTime($eh, $em, 0);
            if ($endDt <= $startDt) {
                $endDt = $endDt->modify('+1 day');
                $nowCmp = $now < $startDt ? $now->modify('+1 day') : $now;
            } else {
                $nowCmp = $now;
            }

            if ($nowCmp >= $startDt && $nowCmp < $endDt) {
                return true;
            }
        }

        return false;
    }

    private static function resolve_now($timestamp = null)
    {
        $tz = wp_timezone();
        if ($timestamp) {
            return (new DateTimeImmutable('@' . (int) $timestamp))->setTimezone($tz);
        }

        return new DateTimeImmutable('now', $tz);
    }

    private static function day_key_from_date(DateTimeImmutable $date)
    {
        $map = [1 => 'mon', 2 => 'tue', 3 => 'wed', 4 => 'thu', 5 => 'fri', 6 => 'sat', 7 => 'sun'];
        return $map[(int) $date->format('N')] ?? 'mon';
    }

    private static function log_issue($tag, $data = [])
    {
        if (! defined('WP_DEBUG') || ! WP_DEBUG) {
            return;
        }

        if (class_exists('Rop_Logger') && method_exists('Rop_Logger', 'log')) {
            Rop_Logger::log($tag, $data);
            return;
        }

        error_log('rop ' . sanitize_key((string) $tag) . ' ' . wp_json_encode($data));
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
