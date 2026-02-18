<?php if (! defined('ABSPATH')) { exit; } ?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — Advanced', 'restaurant-ops-pro'); ?></h1>
    <?php settings_errors('rop_advanced'); ?>
    <form method="post" action="options.php" class="rop-card">
        <?php settings_fields('rop_advanced_group'); ?>
        <table class="form-table">
            <tr><th>Ativar logger</th><td><input type="checkbox" name="rop_advanced_settings[enable_logger]" value="1" <?php checked(! empty($settings['enable_logger'])); ?> /></td></tr>
            <tr><th>Modo debug</th><td><input type="checkbox" name="rop_advanced_settings[debug_mode]" value="1" <?php checked(! empty($settings['debug_mode'])); ?> /></td></tr>
        </table>
        <?php submit_button(); ?>
    </form>

    <form method="post" class="rop-card" style="margin-top:16px;">
        <?php wp_nonce_field('rop_advanced_clear_cache', 'rop_advanced_nonce'); ?>
        <input type="hidden" name="rop_clear_cache" value="1" />
        <p>Limpa transients do Restaurant Ops (bootstrap/cache de app).</p>
        <?php submit_button('Limpar cache', 'secondary', 'submit', false); ?>
    </form>
</div>
