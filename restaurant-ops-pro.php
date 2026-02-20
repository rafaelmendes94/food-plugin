<?php
/**
 * Plugin Name: Restaurant Ops Pro
 * Description: Operação de delivery para restaurantes com interface Foodgo.
 * Version: 1.8.5
 * Author: Restaurant Ops Pro
 * Text Domain: restaurant-ops-pro
 */

if (! defined('ABSPATH')) {
    exit;
}

define('ROP_VERSION', '1.8.5');
define('ROP_FILE', __FILE__);
define('ROP_PATH', plugin_dir_path(__FILE__));
define('ROP_URL', plugin_dir_url(__FILE__));

$rop_required_files = [
    'includes/class-rop-plugin.php',
    'includes/class-rop-assets.php',
    'includes/class-rop-pages.php',
    'includes/class-rop-store-settings.php',
    'includes/class-rop-hours.php',
    'includes/class-rop-delivery-toggle.php',
    'includes/class-rop-eta.php',
    'includes/class-rop-ajax.php',
    'includes/class-rop-woo.php',
    'includes/class-rop-extras.php',
    'includes/class-rop-account.php',
    'includes/class-rop-orders.php',
    'includes/class-rop-kitchen.php',
    'includes/class-rop-ticket.php',
    'includes/class-rop-logger.php',
    'includes/class-rop-compat-barn2.php',
    'admin/class-rop-admin-menu.php',
    'admin/class-rop-admin-pages.php',
];

foreach ($rop_required_files as $rop_file) {
    $rop_full_path = ROP_PATH . $rop_file;

    if (file_exists($rop_full_path)) {
        require_once $rop_full_path;
    }
}

register_activation_hook(ROP_FILE, ['ROP_Pages', 'activate']);

ROP_Plugin::instance();
