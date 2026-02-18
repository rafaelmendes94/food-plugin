<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Admin_Menu
{
    public static function register()
    {
        $capability = 'manage_options';

        add_menu_page(
            __('Restaurant Ops', 'restaurant-ops-pro'),
            __('Restaurant Ops', 'restaurant-ops-pro'),
            $capability,
            'rop-dashboard',
            ['ROP_Admin_Pages', 'render_dashboard_page'],
            'dashicons-store',
            56
        );

        add_submenu_page(
            'rop-dashboard',
            __('Dashboard', 'restaurant-ops-pro'),
            __('Dashboard', 'restaurant-ops-pro'),
            $capability,
            'rop-dashboard',
            ['ROP_Admin_Pages', 'render_dashboard_page']
        );

        add_submenu_page(
            'rop-dashboard',
            __('Extras', 'restaurant-ops-pro'),
            __('Extras', 'restaurant-ops-pro'),
            $capability,
            'rop-extras',
            ['ROP_Admin_Pages', 'render_extras_page']
        );
    }
}
