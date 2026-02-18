<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Admin_Pages
{
    public static function init()
    {
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('update_option_' . ROP_Store_Settings::OPTION_KEY, [self::class, 'clear_runtime_cache'], 10, 0);
        add_action('update_option_' . ROP_Hours::OPTION_KEY, [self::class, 'clear_runtime_cache'], 10, 0);
        add_action('update_option_' . ROP_ETA::OPTION_KEY, [self::class, 'clear_runtime_cache'], 10, 0);
        add_action('update_option_' . ROP_Delivery_Toggle::OPTION_KEY, [self::class, 'clear_runtime_cache'], 10, 0);
        add_action('update_option_rop_ops_settings', [self::class, 'clear_runtime_cache'], 10, 0);
        add_action('update_option_rop_print_settings', [self::class, 'clear_runtime_cache'], 10, 0);
        add_action('update_option_rop_advanced_settings', [self::class, 'clear_runtime_cache'], 10, 0);
    }

    public static function register_settings()
    {
        register_setting('rop_store_group', ROP_Store_Settings::OPTION_KEY, [self::class, 'sanitize_store_settings']);
        register_setting('rop_hours_group', ROP_Hours::OPTION_KEY, [ROP_Hours::class, 'sanitize_settings']);
        register_setting('rop_eta_group', ROP_ETA::OPTION_KEY, [ROP_ETA::class, 'sanitize_settings']);
        register_setting('rop_checkout_group', ROP_Delivery_Toggle::OPTION_KEY, [ROP_Delivery_Toggle::class, 'sanitize_settings']);
        register_setting('rop_ops_group', 'rop_ops_settings', [self::class, 'sanitize_ops_settings']);
        register_setting('rop_print_group', 'rop_print_settings', [self::class, 'sanitize_print_settings']);
        register_setting('rop_advanced_group', 'rop_advanced_settings', [self::class, 'sanitize_advanced_settings']);
    }

    public static function render_store_page()
    {
        self::guard();
        $settings = ROP_Store_Settings::get_all();
        include ROP_PATH . 'views/page-store.php';
    }

    public static function render_hours_page()
    {
        self::guard();
        $settings = ROP_Hours::get_settings();
        $days = self::days_map();
        include ROP_PATH . 'views/page-hours.php';
    }

    public static function render_eta_page()
    {
        self::guard();
        $settings = ROP_ETA::get_settings();
        $days = self::days_map();
        include ROP_PATH . 'views/page-eta.php';
    }

    public static function render_checkout_page()
    {
        self::guard();
        $settings = ROP_Delivery_Toggle::get_settings();
        include ROP_PATH . 'views/page-checkout.php';
    }

    public static function render_ops_page()
    {
        self::guard();
        $settings = wp_parse_args(get_option('rop_ops_settings', []), self::ops_defaults());
        include ROP_PATH . 'views/page-ops.php';
    }

    public static function render_printing_page()
    {
        self::guard();
        $settings = wp_parse_args(get_option('rop_print_settings', []), self::print_defaults());
        include ROP_PATH . 'views/page-printing.php';
    }

    public static function render_kitchen_page()
    {
        self::guard();
        include ROP_PATH . 'views/page-kitchen.php';
    }

    public static function render_advanced_page()
    {
        self::guard();
        if (! empty($_POST['rop_clear_cache']) && check_admin_referer('rop_advanced_clear_cache', 'rop_advanced_nonce')) {
            self::clear_runtime_cache();
            add_settings_error('rop_advanced', 'rop_cache_cleared', __('Caches limpos com sucesso.', 'restaurant-ops-pro'), 'updated');
        }
        $settings = wp_parse_args(get_option('rop_advanced_settings', []), self::advanced_defaults());
        include ROP_PATH . 'views/page-advanced.php';
    }

    public static function render_extras_page()
    {
        self::guard();

        self::handle_extras_actions();

        $presets = ROP_Extras::get_presets();
        $edit_id = sanitize_key(wp_unslash($_GET['edit'] ?? ''));

        $current = [
            'id' => '',
            'name' => '',
            'category_ids' => [],
            'groups' => [],
        ];

        foreach ($presets as $preset) {
            if ($preset['id'] === $edit_id) {
                $current = $preset;
                break;
            }
        }

        $categories = get_terms([
            'taxonomy' => 'product_cat',
            'hide_empty' => false,
            'orderby' => 'name',
            'order' => 'ASC',
        ]);

        if (is_wp_error($categories) || ! is_array($categories)) {
            $categories = [];
        }

        include ROP_PATH . 'views/page-extras.php';
    }

    public static function sanitize_store_settings($input)
    {
        $input = is_array($input) ? $input : [];
        $defaults = ROP_Store_Settings::defaults();

        $output = [
            'store_name' => sanitize_text_field($input['store_name'] ?? $defaults['store_name']),
            'slogan' => sanitize_text_field($input['slogan'] ?? $defaults['slogan']),
            'phone' => sanitize_text_field($input['phone'] ?? ''),
            'whatsapp' => sanitize_text_field($input['whatsapp'] ?? ''),
            'address' => sanitize_textarea_field($input['address'] ?? ''),
            'logo_id' => absint($input['logo_id'] ?? 0),
            'primary_color' => self::sanitize_color($input['primary_color'] ?? $defaults['primary_color'], $defaults['primary_color']),
            'secondary_color' => self::sanitize_color($input['secondary_color'] ?? $defaults['secondary_color'], $defaults['secondary_color']),
            'dark_color' => self::sanitize_color($input['dark_color'] ?? $defaults['dark_color'], $defaults['dark_color']),
            'maps_url' => esc_url_raw($input['maps_url'] ?? ''),
            'instagram_url' => esc_url_raw($input['instagram_url'] ?? ''),
        ];

        self::clear_runtime_cache();

        return $output;
    }

    public static function sanitize_ops_settings($input)
    {
        $input = is_array($input) ? $input : [];
        $defaults = self::ops_defaults();

        return [
            'kitchen_sound_enabled_default' => ! empty($input['kitchen_sound_enabled_default']) ? 1 : 0,
            'kitchen_priority' => in_array(($input['kitchen_priority'] ?? ''), ['pickup_first', 'delivery_first'], true) ? $input['kitchen_priority'] : $defaults['kitchen_priority'],
            'kitchen_poll_interval_sec' => max(2, absint($input['kitchen_poll_interval_sec'] ?? $defaults['kitchen_poll_interval_sec'])),
            'auto_print_on_approve' => ! empty($input['auto_print_on_approve']) ? 1 : 0,
            'default_ticket_format' => in_array(($input['default_ticket_format'] ?? ''), ['80mm', 'a4'], true) ? $input['default_ticket_format'] : $defaults['default_ticket_format'],
        ];
    }

    public static function sanitize_print_settings($input)
    {
        $input = is_array($input) ? $input : [];
        $defaults = self::print_defaults();

        return [
            'default_format' => in_array(($input['default_format'] ?? ''), ['80mm', 'a4'], true) ? $input['default_format'] : $defaults['default_format'],
            'show_print_button_admin' => ! empty($input['show_print_button_admin']) ? 1 : 0,
            'track_print_history' => ! empty($input['track_print_history']) ? 1 : 0,
        ];
    }

    public static function sanitize_advanced_settings($input)
    {
        $input = is_array($input) ? $input : [];

        return [
            'enable_logger' => ! empty($input['enable_logger']) ? 1 : 0,
            'debug_mode' => ! empty($input['debug_mode']) ? 1 : 0,
        ];
    }

    public static function clear_runtime_cache()
    {
        global $wpdb;

        delete_transient('rop_app_bootstrap_v1');
        delete_transient('rop_cats_v1');

        if (isset($wpdb->options)) {
            $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_rop_%' OR option_name LIKE '_transient_timeout_rop_%'"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        }
    }

    private static function handle_extras_actions()
    {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['rop_extras_action']) && $_POST['rop_extras_action'] === 'save_preset') {
            check_admin_referer('rop_save_preset', 'rop_extras_nonce');

            $presets = ROP_Extras::get_presets();
            $preset_id = sanitize_key(wp_unslash($_POST['preset_id'] ?? ''));
            $name = sanitize_text_field(wp_unslash($_POST['preset_name'] ?? ''));
            $groups_json = wp_unslash($_POST['preset_groups_json'] ?? '[]');
            $groups_decoded = json_decode($groups_json, true);
            $groups = ROP_Extras::sanitize_groups(is_array($groups_decoded) ? $groups_decoded : []);
            $category_ids = isset($_POST['preset_category_ids']) && is_array($_POST['preset_category_ids'])
                ? array_values(array_unique(array_map('absint', wp_unslash($_POST['preset_category_ids']))))
                : [];

            if ($name === '' || empty($groups)) {
                add_settings_error('rop_extras', 'rop_extras_invalid', __('Preencha nome e grupos do preset.', 'restaurant-ops-pro'), 'error');
                return;
            }

            if ($preset_id === '') {
                $preset_id = 'preset_' . wp_generate_password(8, false, false);
            }

            $updated = false;
            foreach ($presets as &$preset) {
                if ($preset['id'] === $preset_id) {
                    $preset['name'] = $name;
                    $preset['groups'] = $groups;
                    $preset['category_ids'] = $category_ids;
                    $updated = true;
                    break;
                }
            }
            unset($preset);

            if (! $updated) {
                $presets[] = [
                    'id' => $preset_id,
                    'name' => $name,
                    'category_ids' => $category_ids,
                    'groups' => $groups,
                ];
            }

            ROP_Extras::save_presets($presets);
            self::clear_runtime_cache();
            add_settings_error('rop_extras', 'rop_extras_saved', __('Preset salvo com sucesso.', 'restaurant-ops-pro'), 'updated');
            return;
        }

        $action = sanitize_key(wp_unslash($_GET['rop_action'] ?? ''));
        if ($action === '') {
            return;
        }

        check_admin_referer('rop_extras_action');

        $id = sanitize_key(wp_unslash($_GET['preset_id'] ?? ''));
        if ($id === '') {
            return;
        }

        $presets = ROP_Extras::get_presets();

        if ($action === 'delete') {
            $presets = array_values(array_filter($presets, static function ($preset) use ($id) {
                return ($preset['id'] ?? '') !== $id;
            }));
            ROP_Extras::save_presets($presets);
            self::clear_runtime_cache();
            add_settings_error('rop_extras', 'rop_extras_deleted', __('Preset removido.', 'restaurant-ops-pro'), 'updated');
        }

        if ($action === 'duplicate') {
            foreach ($presets as $preset) {
                if (($preset['id'] ?? '') !== $id) {
                    continue;
                }

                $preset['id'] = 'preset_' . wp_generate_password(8, false, false);
                $preset['name'] = sanitize_text_field(($preset['name'] ?? 'Preset') . ' (Cópia)');
                $presets[] = $preset;
                ROP_Extras::save_presets($presets);
                self::clear_runtime_cache();
                add_settings_error('rop_extras', 'rop_extras_duplicated', __('Preset duplicado.', 'restaurant-ops-pro'), 'updated');
                break;
            }
        }
    }

    private static function guard()
    {
        if (! current_user_can('manage_woocommerce')) {
            wp_die(esc_html__('Você não tem permissão para acessar esta página.', 'restaurant-ops-pro'));
        }
    }

    private static function sanitize_color($color, $fallback)
    {
        $color = sanitize_text_field((string) $color);
        return preg_match('/^#[0-9A-Fa-f]{6}$/', $color) ? strtoupper($color) : $fallback;
    }

    private static function days_map()
    {
        return [
            'mon' => 'Segunda',
            'tue' => 'Terça',
            'wed' => 'Quarta',
            'thu' => 'Quinta',
            'fri' => 'Sexta',
            'sat' => 'Sábado',
            'sun' => 'Domingo',
        ];
    }

    private static function ops_defaults()
    {
        return [
            'kitchen_sound_enabled_default' => 1,
            'kitchen_priority' => 'delivery_first',
            'kitchen_poll_interval_sec' => 5,
            'auto_print_on_approve' => 0,
            'default_ticket_format' => '80mm',
        ];
    }

    private static function print_defaults()
    {
        return [
            'default_format' => '80mm',
            'show_print_button_admin' => 1,
            'track_print_history' => 1,
        ];
    }

    private static function advanced_defaults()
    {
        return [
            'enable_logger' => 0,
            'debug_mode' => 0,
        ];
    }
}
