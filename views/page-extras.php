<?php
if (! defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — Presets de Extras', 'restaurant-ops-pro'); ?></h1>

    <?php settings_errors('rop_extras'); ?>

    <div class="rop-admin-grid">
        <div class="rop-card">
            <h2><?php esc_html_e('Presets Cadastrados', 'restaurant-ops-pro'); ?></h2>
            <?php if (empty($presets)) : ?>
                <p><?php esc_html_e('Nenhum preset cadastrado ainda.', 'restaurant-ops-pro'); ?></p>
            <?php else : ?>
                <table class="widefat striped">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Nome', 'restaurant-ops-pro'); ?></th>
                            <th><?php esc_html_e('Grupos', 'restaurant-ops-pro'); ?></th>
                            <th><?php esc_html_e('Ações', 'restaurant-ops-pro'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($presets as $preset) : ?>
                            <tr>
                                <td><?php echo esc_html($preset['name']); ?></td>
                                <td><?php echo esc_html(count($preset['groups'])); ?></td>
                                <td>
                                    <a class="button button-small" href="<?php echo esc_url(admin_url('admin.php?page=rop-extras&edit=' . rawurlencode($preset['id']))); ?>"><?php esc_html_e('Editar', 'restaurant-ops-pro'); ?></a>
                                    <a class="button button-small" href="<?php echo esc_url(wp_nonce_url(admin_url('admin.php?page=rop-extras&rop_action=duplicate&preset_id=' . rawurlencode($preset['id'])), 'rop_extras_action')); ?>"><?php esc_html_e('Duplicar', 'restaurant-ops-pro'); ?></a>
                                    <a class="button button-small" href="<?php echo esc_url(wp_nonce_url(admin_url('admin.php?page=rop-extras&rop_action=delete&preset_id=' . rawurlencode($preset['id'])), 'rop_extras_action')); ?>" onclick="return confirm('<?php echo esc_js(__('Excluir este preset?', 'restaurant-ops-pro')); ?>');"><?php esc_html_e('Excluir', 'restaurant-ops-pro'); ?></a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <div class="rop-card">
            <h2><?php echo $current['id'] ? esc_html__('Editar Preset', 'restaurant-ops-pro') : esc_html__('Novo Preset', 'restaurant-ops-pro'); ?></h2>
            <form method="post" id="rop-preset-form">
                <?php wp_nonce_field('rop_save_preset', 'rop_extras_nonce'); ?>
                <input type="hidden" name="rop_extras_action" value="save_preset" />
                <input type="hidden" name="preset_id" value="<?php echo esc_attr($current['id']); ?>" />
                <input type="hidden" name="preset_groups_json" id="preset_groups_json" value="" />

                <p>
                    <label for="preset_name"><strong><?php esc_html_e('Nome do Preset', 'restaurant-ops-pro'); ?></strong></label><br>
                    <input type="text" id="preset_name" name="preset_name" class="regular-text" value="<?php echo esc_attr($current['name']); ?>" required>
                </p>


                <p><strong><?php esc_html_e('Aplicar automaticamente nestas categorias', 'restaurant-ops-pro'); ?></strong></p>
                <div class="rop-categories-grid">
                    <?php foreach ($categories as $category) : ?>
                        <label>
                            <input type="checkbox" name="preset_category_ids[]" value="<?php echo esc_attr($category->term_id); ?>" <?php checked(in_array((int) $category->term_id, array_map('intval', $current['category_ids'] ?? []), true)); ?> />
                            <?php echo esc_html($category->name); ?>
                        </label>
                    <?php endforeach; ?>
                </div>

                <div id="rop-preset-editor" data-initial="<?php echo esc_attr(wp_json_encode($current['groups'])); ?>"></div>

                <p>
                    <button type="button" class="button" id="rop-add-group"><?php esc_html_e('Adicionar Grupo', 'restaurant-ops-pro'); ?></button>
                </p>

                <p>
                    <button type="submit" class="button button-primary"><?php esc_html_e('Salvar Preset', 'restaurant-ops-pro'); ?></button>
                </p>
            </form>
        </div>
    </div>
</div>
