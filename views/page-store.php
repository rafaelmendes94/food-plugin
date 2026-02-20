<?php

if (! defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — Loja', 'restaurant-ops-pro'); ?></h1>
    <form method="post" action="options.php" class="rop-card">
        <?php settings_fields('rop_store_group'); ?>
        <table class="form-table" role="presentation">
            <tr><th><label for="rop_store_name">Nome da Loja</label></th><td><input id="rop_store_name" class="regular-text" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[store_name]" value="<?php echo esc_attr($settings['store_name']); ?>" /></td></tr>
            <tr><th><label for="rop_slogan">Slogan</label></th><td><input id="rop_slogan" class="regular-text" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[slogan]" value="<?php echo esc_attr($settings['slogan']); ?>" /></td></tr>
            <tr><th><label for="rop_phone">Telefone</label></th><td><input id="rop_phone" class="regular-text" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[phone]" value="<?php echo esc_attr($settings['phone']); ?>" /></td></tr>
            <tr><th><label for="rop_whatsapp">WhatsApp</label></th><td><input id="rop_whatsapp" class="regular-text" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[whatsapp]" value="<?php echo esc_attr($settings['whatsapp']); ?>" /></td></tr>
            <tr><th><label for="rop_address">Endereço</label></th><td><textarea id="rop_address" class="large-text" rows="3" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[address]"><?php echo esc_textarea($settings['address']); ?></textarea></td></tr>
            <tr>
                <th>Logo</th>
                <td>
                    <input type="hidden" id="rop_logo_id" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[logo_id]" value="<?php echo esc_attr((int) $settings['logo_id']); ?>" />
                    <button type="button" class="button" data-rop-media-pick="rop_logo_id"><?php esc_html_e('Selecionar logo', 'restaurant-ops-pro'); ?></button>
                    <button type="button" class="button" data-rop-media-clear="rop_logo_id"><?php esc_html_e('Limpar', 'restaurant-ops-pro'); ?></button>
                    <div class="rop-logo-preview"><?php if (! empty($settings['logo_url'])) : ?><img src="<?php echo esc_url($settings['logo_url']); ?>" alt="logo" /><?php endif; ?></div>
                </td>
            </tr>
            <tr><th><label for="rop_primary">Cor Primária</label></th><td><input type="color" id="rop_primary" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[primary_color]" value="<?php echo esc_attr($settings['primary_color']); ?>" /></td></tr>
            <tr><th><label for="rop_secondary">Cor Secundária</label></th><td><input type="color" id="rop_secondary" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[secondary_color]" value="<?php echo esc_attr($settings['secondary_color']); ?>" /></td></tr>
            <tr><th><label for="rop_dark">Cor Escura</label></th><td><input type="color" id="rop_dark" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[dark_color]" value="<?php echo esc_attr($settings['dark_color']); ?>" /></td></tr>
            <tr><th><label for="rop_maps">URL Google Maps</label></th><td><input id="rop_maps" class="regular-text" type="url" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[maps_url]" value="<?php echo esc_attr($settings['maps_url']); ?>" /></td></tr>
            <tr><th><label for="rop_instagram">Instagram URL</label></th><td><input id="rop_instagram" class="regular-text" type="url" name="<?php echo esc_attr(ROP_Store_Settings::OPTION_KEY); ?>[instagram_url]" value="<?php echo esc_attr($settings['instagram_url']); ?>" /></td></tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
