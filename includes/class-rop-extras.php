<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Extras
{
    const OPTION_PRESETS = 'rop_extras_presets';
    const META_SCHEMA = '_rop_extras_schema';
    const META_PRESET_IDS = '_rop_extras_preset_ids';
    const META_MODE = '_rop_extras_mode';

    public static function init()
    {
        add_action('add_meta_boxes', [self::class, 'register_product_metabox']);
        add_action('save_post_product', [self::class, 'save_product_metabox']);
    }

    public static function allowed_modes()
    {
        return [
            'presets_only',
            'custom_only',
            'presets_plus_custom',
        ];
    }

    public static function get_presets()
    {
        $presets = get_option(self::OPTION_PRESETS, []);
        if (! is_array($presets)) {
            return [];
        }

        $clean = [];
        foreach ($presets as $preset) {
            if (! is_array($preset)) {
                continue;
            }

            $id = sanitize_key((string) ($preset['id'] ?? ''));
            $name = sanitize_text_field((string) ($preset['name'] ?? ''));

            if ($id === '' || $name === '') {
                continue;
            }

            $groups = self::sanitize_groups($preset['groups'] ?? []);
            if (empty($groups)) {
                continue;
            }

            $clean[] = [
                'id' => $id,
                'name' => $name,
                'groups' => $groups,
            ];
        }

        return $clean;
    }

    public static function save_presets($presets)
    {
        $clean = [];
        if (is_array($presets)) {
            foreach ($presets as $preset) {
                if (! is_array($preset)) {
                    continue;
                }

                $id = sanitize_key((string) ($preset['id'] ?? ''));
                if ($id === '') {
                    $id = 'preset_' . wp_generate_password(8, false, false);
                }

                $name = sanitize_text_field((string) ($preset['name'] ?? ''));
                $groups = self::sanitize_groups($preset['groups'] ?? []);

                if ($name === '' || empty($groups)) {
                    continue;
                }

                $clean[] = [
                    'id' => $id,
                    'name' => $name,
                    'groups' => $groups,
                ];
            }
        }

        update_option(self::OPTION_PRESETS, $clean, false);

        return $clean;
    }

    public static function get_schema($product_id)
    {
        $raw = get_post_meta($product_id, self::META_SCHEMA, true);

        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $raw = $decoded;
            }
        }

        return self::sanitize_groups($raw);
    }

    public static function get_effective_schema($product_id)
    {
        $mode = get_post_meta($product_id, self::META_MODE, true);
        $mode = in_array($mode, self::allowed_modes(), true) ? $mode : 'presets_plus_custom';

        $preset_ids = get_post_meta($product_id, self::META_PRESET_IDS, true);
        $preset_ids = is_array($preset_ids) ? array_map('sanitize_key', $preset_ids) : [];

        $presets_all = self::get_presets();
        $preset_groups = [];
        foreach ($presets_all as $preset) {
            if (in_array($preset['id'], $preset_ids, true)) {
                foreach ((array) $preset['groups'] as $group) {
                    if (! empty($group['title'])) {
                        $group['title'] = sanitize_text_field($group['title']);
                    }
                    $preset_groups[] = $group;
                }
            }
        }

        $custom_groups = self::get_schema($product_id);

        if ($mode === 'presets_only') {
            return $preset_groups;
        }

        if ($mode === 'custom_only') {
            return $custom_groups;
        }

        $existing_titles = [];
        foreach ($preset_groups as $group) {
            $existing_titles[] = mb_strtolower((string) ($group['title'] ?? ''));
        }

        foreach ($custom_groups as &$group) {
            $title = (string) ($group['title'] ?? '');
            if ($title !== '' && in_array(mb_strtolower($title), $existing_titles, true)) {
                $group['title'] = $title . ' (Produto)';
            }
        }
        unset($group);

        return array_merge($preset_groups, $custom_groups);
    }

    public static function validate_selection($product_id, $extras)
    {
        $schema = self::get_effective_schema($product_id);
        if (empty($schema)) {
            return true;
        }

        if (! is_array($extras) || empty($extras)) {
            return true;
        }

        $allowed = [];
        foreach ($schema as $group) {
            foreach ((array) ($group['options'] ?? []) as $option) {
                $label = sanitize_text_field((string) ($option['label'] ?? ''));
                if ($label !== '') {
                    $allowed[] = mb_strtolower($label);
                }
            }
        }

        if (empty($allowed)) {
            return true;
        }

        foreach ($extras as $key => $value) {
            $k = mb_strtolower(sanitize_text_field((string) $key));
            if (strpos($k, 'rop_extra') === false && strpos($k, 'extra') === false) {
                continue;
            }

            $values = is_array($value) ? $value : [$value];
            foreach ($values as $single) {
                $candidate = mb_strtolower(sanitize_text_field((string) $single));
                if ($candidate !== '' && ! in_array($candidate, $allowed, true)) {
                    return false;
                }
            }
        }

        return true;
    }

    public static function register_product_metabox()
    {
        add_meta_box(
            'rop-product-extras',
            __('Restaurant Ops — Extras', 'restaurant-ops-pro'),
            [self::class, 'render_product_metabox'],
            'product',
            'normal',
            'default'
        );
    }

    public static function render_product_metabox($post)
    {
        wp_nonce_field('rop_product_extras_save', 'rop_product_extras_nonce');

        $presets = self::get_presets();
        $selected_presets = get_post_meta($post->ID, self::META_PRESET_IDS, true);
        $selected_presets = is_array($selected_presets) ? array_map('sanitize_key', $selected_presets) : [];

        $mode = get_post_meta($post->ID, self::META_MODE, true);
        $mode = in_array($mode, self::allowed_modes(), true) ? $mode : 'presets_plus_custom';

        $schema = self::get_schema($post->ID);
        ?>
        <p><strong><?php esc_html_e('Presets Globais', 'restaurant-ops-pro'); ?></strong></p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px;">
            <?php if (empty($presets)) : ?>
                <em><?php esc_html_e('Nenhum preset cadastrado ainda.', 'restaurant-ops-pro'); ?></em>
            <?php else : ?>
                <?php foreach ($presets as $preset) : ?>
                    <label>
                        <input type="checkbox" name="rop_extras_preset_ids[]" value="<?php echo esc_attr($preset['id']); ?>" <?php checked(in_array($preset['id'], $selected_presets, true)); ?> />
                        <?php echo esc_html($preset['name']); ?>
                    </label>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <p><strong><?php esc_html_e('Modo de Extras', 'restaurant-ops-pro'); ?></strong></p>
        <label><input type="radio" name="rop_extras_mode" value="presets_only" <?php checked($mode, 'presets_only'); ?> /> <?php esc_html_e('Usar apenas presets', 'restaurant-ops-pro'); ?></label><br>
        <label><input type="radio" name="rop_extras_mode" value="custom_only" <?php checked($mode, 'custom_only'); ?> /> <?php esc_html_e('Usar apenas extras personalizados', 'restaurant-ops-pro'); ?></label><br>
        <label><input type="radio" name="rop_extras_mode" value="presets_plus_custom" <?php checked($mode, 'presets_plus_custom'); ?> /> <?php esc_html_e('Presets + personalizados', 'restaurant-ops-pro'); ?></label>

        <p style="margin-top:14px;"><strong><?php esc_html_e('Extras personalizados do produto', 'restaurant-ops-pro'); ?></strong></p>
        <textarea name="rop_extras_schema_json" rows="10" style="width:100%;font-family:monospace;"><?php echo esc_textarea(wp_json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></textarea>
        <p class="description"><?php esc_html_e('Formato: array de grupos com title, type, min, max e options[{label,price}].', 'restaurant-ops-pro'); ?></p>
        <?php
    }

    public static function save_product_metabox($post_id)
    {
        if (! isset($_POST['rop_product_extras_nonce']) || ! wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['rop_product_extras_nonce'])), 'rop_product_extras_save')) {
            return;
        }

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (! current_user_can('edit_post', $post_id)) {
            return;
        }

        $preset_ids = isset($_POST['rop_extras_preset_ids']) && is_array($_POST['rop_extras_preset_ids'])
            ? array_values(array_unique(array_map('sanitize_key', wp_unslash($_POST['rop_extras_preset_ids']))))
            : [];
        update_post_meta($post_id, self::META_PRESET_IDS, $preset_ids);

        $mode = sanitize_key(wp_unslash($_POST['rop_extras_mode'] ?? 'presets_plus_custom'));
        if (! in_array($mode, self::allowed_modes(), true)) {
            $mode = 'presets_plus_custom';
        }
        update_post_meta($post_id, self::META_MODE, $mode);

        $raw_schema = wp_unslash($_POST['rop_extras_schema_json'] ?? '');
        $schema = [];

        if (is_string($raw_schema) && $raw_schema !== '') {
            $decoded = json_decode($raw_schema, true);
            if (is_array($decoded)) {
                $schema = self::sanitize_groups($decoded);
            }
        }

        update_post_meta($post_id, self::META_SCHEMA, $schema);
    }

    public static function sanitize_groups($groups)
    {
        if (! is_array($groups)) {
            return [];
        }

        $clean = [];
        foreach ($groups as $group) {
            if (! is_array($group)) {
                continue;
            }

            $title = sanitize_text_field((string) ($group['title'] ?? ''));
            $type = sanitize_key((string) ($group['type'] ?? 'checkbox'));
            if (! in_array($type, ['checkbox', 'radio', 'select'], true)) {
                $type = 'checkbox';
            }

            $min = max(0, absint($group['min'] ?? 0));
            $max = max($min, absint($group['max'] ?? 0));

            $options = [];
            foreach ((array) ($group['options'] ?? []) as $option) {
                if (! is_array($option)) {
                    continue;
                }
                $label = sanitize_text_field((string) ($option['label'] ?? ''));
                if ($label === '') {
                    continue;
                }

                $price = wc_format_decimal($option['price'] ?? '0', 2);
                $options[] = [
                    'label' => $label,
                    'price' => (string) $price,
                ];
            }

            if ($title === '' || empty($options)) {
                continue;
            }

            $clean[] = [
                'title' => $title,
                'type' => $type,
                'min' => $min,
                'max' => $max,
                'options' => $options,
            ];
        }

        return $clean;
    }
}
