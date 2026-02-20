<?php if (! defined('ABSPATH')) { exit; } ?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — Impressão', 'restaurant-ops-pro'); ?></h1>
    <form method="post" action="options.php" class="rop-card">
        <?php settings_fields('rop_print_group'); ?>
        <table class="form-table">
            <tr><th>Formato padrão</th><td><select name="rop_print_settings[default_format]"><option value="80mm" <?php selected($settings['default_format'], '80mm'); ?>>80mm</option><option value="a4" <?php selected($settings['default_format'], 'a4'); ?>>A4</option></select></td></tr>
            <tr><th>Mostrar botão imprimir no admin</th><td><input type="checkbox" name="rop_print_settings[show_print_button_admin]" value="1" <?php checked(! empty($settings['show_print_button_admin'])); ?> /></td></tr>
            <tr><th>Rastrear histórico de impressão</th><td><input type="checkbox" name="rop_print_settings[track_print_history]" value="1" <?php checked(! empty($settings['track_print_history'])); ?> /></td></tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
