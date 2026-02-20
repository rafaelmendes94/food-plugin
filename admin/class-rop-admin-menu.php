<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Admin_Menu
{
    public static function register()
    {
        $capability = 'manage_woocommerce';

        add_menu_page(
            __('Restaurant Ops', 'restaurant-ops-pro'),
            __('Restaurant Ops', 'restaurant-ops-pro'),
            $capability,
            'rop-store',
            ['ROP_Admin_Pages', 'render_store_page'],
            'dashicons-store',
            56
        );

        $items = [
            'rop-store' => [__('Loja', 'restaurant-ops-pro'), 'render_store_page'],
            'rop-hours' => [__('Horários', 'restaurant-ops-pro'), 'render_hours_page'],
            'rop-eta' => [__('ETA', 'restaurant-ops-pro'), 'render_eta_page'],
            'rop-checkout' => [__('Checkout', 'restaurant-ops-pro'), 'render_checkout_page'],
            'rop-ops' => [__('Operação', 'restaurant-ops-pro'), 'render_ops_page'],
            'rop-printing' => [__('Impressão', 'restaurant-ops-pro'), 'render_printing_page'],
            'rop-extras' => [__('Extras', 'restaurant-ops-pro'), 'render_extras_page'],
            'rop-kitchen' => [__('Cozinha', 'restaurant-ops-pro'), 'render_kitchen_page'],
            'rop-advanced' => [__('Advanced', 'restaurant-ops-pro'), 'render_advanced_page'],
        ];

        foreach ($items as $slug => [$label, $callback]) {
            add_submenu_page(
                'rop-store',
                $label,
                $label,
                $capability,
                $slug,
                ['ROP_Admin_Pages', $callback]
            );
        }
    }
}
