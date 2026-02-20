<?php if (! defined('ABSPATH')) { exit; } ?>
<div class="wrap rop-admin-wrap">
    <h1><?php esc_html_e('Restaurant Ops — Horários', 'restaurant-ops-pro'); ?></h1>
    <form method="post" action="options.php" class="rop-card">
        <?php settings_fields('rop_hours_group'); ?>
        <table class="widefat striped rop-hours-table">
            <thead><tr><th>Dia</th><th>Aberto</th><th>Faixa 1</th><th>Faixa 2</th></tr></thead>
            <tbody>
            <?php foreach ($days as $key => $label) : $day = $settings[$key]; ?>
                <tr>
                    <td><?php echo esc_html($label); ?></td>
                    <td><input type="checkbox" name="rop_hours_settings[<?php echo esc_attr($key); ?>][enabled]" value="1" <?php checked(! empty($day['enabled'])); ?> /></td>
                    <?php for ($i=0;$i<2;$i++): $r = $day['ranges'][$i] ?? ['start'=>'','end'=>'']; ?>
                        <td>
                            <input type="time" step="900" name="rop_hours_settings[<?php echo esc_attr($key); ?>][ranges][<?php echo (int) $i; ?>][start]" value="<?php echo esc_attr($r['start']); ?>" />
                            —
                            <input type="time" step="900" name="rop_hours_settings[<?php echo esc_attr($key); ?>][ranges][<?php echo (int) $i; ?>][end]" value="<?php echo esc_attr($r['end']); ?>" />
                        </td>
                    <?php endfor; ?>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
