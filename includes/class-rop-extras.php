<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Extras
{
    const OPTION_PRESETS = 'rop_extras_presets';
    const OPTION_CACHE_BUSTER = 'rop_extras_schema_cache_buster';

    const META_SCHEMA = '_rop_extras_schema';
    const META_PRESET_IDS = '_rop_extras_preset_ids';
    const META_USE_CATEGORY = '_rop_extras_use_category_presets';

    public static function init()
    {
        add_action('add_meta_boxes', [self::class, 'register_product_metabox']);
        add_action('save_post_product', [self::class, 'save_product_metabox']);
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
        $use_category_presets = absint(get_post_meta($post->ID, self::META_USE_CATEGORY, true)) === 1;

        $schema = self::get_schema($post->ID);
        ?>
        <div class="rop-product-extras-metabox">
            <p><strong><?php esc_html_e('Padrão por categoria', 'restaurant-ops-pro'); ?></strong></p>
            <label>
                <input type="checkbox" name="rop_extras_use_category_presets" value="1" <?php checked($use_category_presets); ?> />
                <?php esc_html_e('Usar presets automáticos da(s) categoria(s) do produto.', 'restaurant-ops-pro'); ?>
            </label>
            <p class="description"><?php esc_html_e('Quando ativo, busca presets vinculados às categorias do produto.', 'restaurant-ops-pro'); ?></p>

            <hr />

            <p><strong><?php esc_html_e('Presets manuais', 'restaurant-ops-pro'); ?></strong></p>
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

            <hr />

            <p><strong><?php esc_html_e('Extras personalizados do produto', 'restaurant-ops-pro'); ?></strong></p>
            <input type="hidden" name="rop_extras_schema_json" id="rop_product_extras_schema_json" value="" />
            <div id="rop-product-extras-editor" data-initial="<?php echo esc_attr(wp_json_encode($schema)); ?>"></div>
            <p>
                <button type="button" class="button" id="rop-product-add-group"><?php esc_html_e('Adicionar Grupo', 'restaurant-ops-pro'); ?></button>
            </p>
        </div>
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

        $use_category = ! empty($_POST['rop_extras_use_category_presets']) ? 1 : 0;
        update_post_meta($post_id, self::META_USE_CATEGORY, $use_category);

        $preset_ids = isset($_POST['rop_extras_preset_ids']) && is_array($_POST['rop_extras_preset_ids'])
            ? array_values(array_unique(array_map('sanitize_key', wp_unslash($_POST['rop_extras_preset_ids']))))
            : [];
        update_post_meta($post_id, self::META_PRESET_IDS, $preset_ids);

        $raw_schema = wp_unslash($_POST['rop_extras_schema_json'] ?? '');
        $schema = [];

        if (is_string($raw_schema) && $raw_schema !== '') {
            $decoded = json_decode($raw_schema, true);
            if (is_array($decoded)) {
                $schema = self::sanitize_groups($decoded);
            }
        }

        update_post_meta($post_id, self::META_SCHEMA, $schema);
        self::clear_product_schema_cache($post_id);
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

            $category_ids = [];
            foreach ((array) ($preset['category_ids'] ?? []) as $category_id) {
                $value = absint($category_id);
                if ($value > 0) {
                    $category_ids[] = $value;
                }
            }

            $groups = self::sanitize_groups($preset['groups'] ?? []);
            if (empty($groups)) {
                continue;
            }

            $clean[] = [
                'id' => $id,
                'name' => $name,
                'category_ids' => array_values(array_unique($category_ids)),
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
                $category_ids = [];

                foreach ((array) ($preset['category_ids'] ?? []) as $category_id) {
                    $value = absint($category_id);
                    if ($value > 0) {
                        $category_ids[] = $value;
                    }
                }

                if ($name === '' || empty($groups)) {
                    continue;
                }

                $clean[] = [
                    'id' => $id,
                    'name' => $name,
                    'category_ids' => array_values(array_unique($category_ids)),
                    'groups' => $groups,
                ];
            }
        }

        update_option(self::OPTION_PRESETS, $clean, false);
        update_option(self::OPTION_CACHE_BUSTER, time(), false);

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
        $cache_key = self::get_product_cache_key($product_id);
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return $cached;
        }

        $presets = self::get_presets();
        $selected_preset_ids = get_post_meta($product_id, self::META_PRESET_IDS, true);
        $selected_preset_ids = is_array($selected_preset_ids) ? array_map('sanitize_key', $selected_preset_ids) : [];

        $use_category = absint(get_post_meta($product_id, self::META_USE_CATEGORY, true)) === 1;
        $product_term_ids = [];
        if ($use_category) {
            $terms = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'ids']);
            if (! is_wp_error($terms) && is_array($terms)) {
                $product_term_ids = array_map('absint', $terms);
            }
        }

        $used_preset_ids = [];
        $preset_groups = [];

        foreach ($presets as $preset) {
            $by_category = $use_category && ! empty(array_intersect($product_term_ids, (array) ($preset['category_ids'] ?? [])));
            $by_manual = in_array($preset['id'], $selected_preset_ids, true);

            if (! $by_category && ! $by_manual) {
                continue;
            }

            if (in_array($preset['id'], $used_preset_ids, true)) {
                continue;
            }

            $used_preset_ids[] = $preset['id'];
            foreach ((array) $preset['groups'] as $group) {
                $group['__source'] = 'preset';
                $preset_groups[] = $group;
            }
        }

        $custom_groups = self::get_schema($product_id);
        foreach ($custom_groups as &$group) {
            $group['__source'] = 'product';
        }
        unset($group);

        $merged = array_merge($preset_groups, $custom_groups);

        $title_count = [];
        foreach ($merged as $group) {
            $key = mb_strtolower(sanitize_text_field((string) ($group['title'] ?? '')));
            if ($key === '') {
                continue;
            }
            if (! isset($title_count[$key])) {
                $title_count[$key] = 0;
            }
            $title_count[$key]++;
        }

        foreach ($merged as &$group) {
            $title = sanitize_text_field((string) ($group['title'] ?? ''));
            $source = (string) ($group['__source'] ?? 'product');
            $key = mb_strtolower($title);

            if ($title !== '' && ($title_count[$key] ?? 0) > 1) {
                $group['title'] = $title . ($source === 'preset' ? ' (Padrão)' : ' (Produto)');
            }

            unset($group['__source']);
        }
        unset($group);

        set_transient($cache_key, $merged, 10 * MINUTE_IN_SECONDS);

        return $merged;
    }

    public static function validate_selection($product_id, $extras)
    {
        if (! is_array($extras)) {
            return true;
        }

        $schema = self::get_effective_schema($product_id);
        if (empty($schema)) {
            return true;
        }

        $allowed_labels = [];
        foreach ($schema as $group) {
            foreach ((array) ($group['options'] ?? []) as $option) {
                $label = mb_strtolower(sanitize_text_field((string) ($option['label'] ?? '')));
                if ($label !== '') {
                    $allowed_labels[] = $label;
                }
            }
        }

        if (empty($allowed_labels)) {
            return true;
        }

        foreach ($extras as $value) {
            $values = is_array($value) ? $value : [$value];
            foreach ($values as $single) {
                $normalized = mb_strtolower(sanitize_text_field((string) $single));
                if ($normalized === '') {
                    continue;
                }

                if (! in_array($normalized, $allowed_labels, true)) {
                    return false;
                }
            }
        }

        return true;
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

                $price = function_exists('wc_format_decimal')
                    ? wc_format_decimal($option['price'] ?? '0', 2)
                    : number_format((float) ($option['price'] ?? 0), 2, '.', '');

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

    public static function clear_product_schema_cache($product_id)
    {
        delete_transient(self::get_product_cache_key($product_id));
    }

    private static function get_product_cache_key($product_id)
    {
        $buster = (string) get_option(self::OPTION_CACHE_BUSTER, '0');
        return 'rop_effective_schema_' . absint($product_id) . '_' . md5($buster);
    }
}
