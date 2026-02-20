<?php if (! defined('ABSPATH')) { exit; } ?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — ETA', 'restaurant-ops-pro'); ?></h1>
    <form method="post" action="options.php" class="rop-card">
        <?php settings_fields('rop_eta_group'); ?>
        <table class="form-table">
            <tr><th>ETA base mínimo (min)</th><td><input type="number" min="1" name="rop_eta_settings[eta_base_min]" value="<?php echo esc_attr((int) $settings['eta_base_min']); ?>" /></td></tr>
            <tr><th>ETA base máximo (min)</th><td><input type="number" min="1" name="rop_eta_settings[eta_base_max]" value="<?php echo esc_attr((int) $settings['eta_base_max']); ?>" /></td></tr>
            <tr><th>Ajuste por pico</th><td><label><input type="checkbox" name="rop_eta_settings[peak_enabled]" value="1" <?php checked(! empty($settings['peak_enabled'])); ?> /> Ativar</label></td></tr>
        </table>
        <h2>Grade de pico (até 2 faixas por dia)</h2>
        <table class="widefat striped rop-hours-table">
            <thead><tr><th>Dia</th><th>Faixa 1</th><th>Faixa 2</th></tr></thead>
            <tbody>
            <?php foreach ($days as $key => $label) : ?>
                <tr>
                    <td><?php echo esc_html($label); ?></td>
                    <?php for ($i=0;$i<2;$i++): $r = $settings['peak'][$key][$i] ?? ['start'=>'','end'=>'','add_min'=>0,'add_max'=>0]; ?>
                    <td>
                        <input type="time" step="900" name="rop_eta_settings[peak][<?php echo esc_attr($key); ?>][<?php echo (int)$i; ?>][start]" value="<?php echo esc_attr($r['start']); ?>" />
                        —
                        <input type="time" step="900" name="rop_eta_settings[peak][<?php echo esc_attr($key); ?>][<?php echo (int)$i; ?>][end]" value="<?php echo esc_attr($r['end']); ?>" /><br>
                        +<input type="number" min="0" style="width:70px" name="rop_eta_settings[peak][<?php echo esc_attr($key); ?>][<?php echo (int)$i; ?>][add_min]" value="<?php echo esc_attr((int)$r['add_min']); ?>" /> min
                        / +<input type="number" min="0" style="width:70px" name="rop_eta_settings[peak][<?php echo esc_attr($key); ?>][<?php echo (int)$i; ?>][add_max]" value="<?php echo esc_attr((int)$r['add_max']); ?>" /> max
                    </td>
                    <?php endfor; ?>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
