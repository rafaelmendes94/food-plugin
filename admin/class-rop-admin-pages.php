<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Admin_Pages
{
    public static function render_dashboard_page()
    {
        echo '<div class="wrap"><h1>Restaurant Ops</h1><p>Use o menu Extras para gerenciar presets globais.</p></div>';
    }

    public static function render_extras_page()
    {
        if (! current_user_can('manage_options')) {
            wp_die(esc_html__('Você não tem permissão para acessar esta página.', 'restaurant-ops-pro'));
        }

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
                add_settings_error('rop_extras', 'rop_extras_duplicated', __('Preset duplicado.', 'restaurant-ops-pro'), 'updated');
                break;
            }
        }
    }
}
