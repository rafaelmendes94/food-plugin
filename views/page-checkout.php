<?php if (! defined('ABSPATH')) { exit; } ?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — Checkout', 'restaurant-ops-pro'); ?></h1>
    <form method="post" action="options.php" class="rop-card">
        <?php settings_fields('rop_checkout_group'); ?>
        <table class="form-table">
            <tr><th>Retirada habilitada</th><td><label><input type="checkbox" name="rop_checkout_settings[pickup_enabled]" value="1" <?php checked(! empty($settings['pickup_enabled'])); ?> /> Habilitar Retirada</label></td></tr>
            <tr><th>Label Entrega</th><td><input class="regular-text" name="rop_checkout_settings[label_delivery]" value="<?php echo esc_attr($settings['label_delivery']); ?>" /></td></tr>
            <tr><th>Label Retirada</th><td><input class="regular-text" name="rop_checkout_settings[label_pickup]" value="<?php echo esc_attr($settings['label_pickup']); ?>" /></td></tr>
            <tr><th>Padrão</th><td><select name="rop_checkout_settings[default_fulfillment]"><option value="delivery" <?php selected($settings['default_fulfillment'], 'delivery'); ?>>Entrega</option><option value="pickup" <?php selected($settings['default_fulfillment'], 'pickup'); ?>>Retirada</option></select></td></tr>
            <tr><th>Retirada oculta endereço</th><td><label><input type="checkbox" name="rop_checkout_settings[pickup_hides_shipping]" value="1" <?php checked(! empty($settings['pickup_hides_shipping'])); ?> /> Sim</label></td></tr>
            <tr><th>Retirada zera taxa de entrega</th><td><label><input type="checkbox" name="rop_checkout_settings[pickup_zero_delivery_fee]" value="1" <?php checked(! empty($settings['pickup_zero_delivery_fee'])); ?> /> Sim</label></td></tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
