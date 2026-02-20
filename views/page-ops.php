<?php if (! defined('ABSPATH')) { exit; } ?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — Operação', 'restaurant-ops-pro'); ?></h1>
    <form method="post" action="options.php" class="rop-card">
        <?php settings_fields('rop_ops_group'); ?>
        <table class="form-table">
            <tr><th>Som cozinha ativo por padrão</th><td><input type="checkbox" name="rop_ops_settings[kitchen_sound_enabled_default]" value="1" <?php checked(! empty($settings['kitchen_sound_enabled_default'])); ?> /></td></tr>
            <tr><th>Prioridade</th><td><select name="rop_ops_settings[kitchen_priority]"><option value="delivery_first" <?php selected($settings['kitchen_priority'], 'delivery_first'); ?>>Entrega primeiro</option><option value="pickup_first" <?php selected($settings['kitchen_priority'], 'pickup_first'); ?>>Retirada primeiro</option></select></td></tr>
            <tr><th>Polling cozinha (seg)</th><td><input type="number" min="2" name="rop_ops_settings[kitchen_poll_interval_sec]" value="<?php echo esc_attr((int) $settings['kitchen_poll_interval_sec']); ?>" /></td></tr>
            <tr><th>Auto print ao aprovar</th><td><label><input type="checkbox" name="rop_ops_settings[auto_print_on_approve]" value="1" <?php checked(! empty($settings['auto_print_on_approve'])); ?> /> (browser pode bloquear)</label></td></tr>
            <tr><th>Formato padrão ticket</th><td><select name="rop_ops_settings[default_ticket_format]"><option value="80mm" <?php selected($settings['default_ticket_format'], '80mm'); ?>>80mm</option><option value="a4" <?php selected($settings['default_ticket_format'], 'a4'); ?>>A4</option></select></td></tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
