<?php
/**
 * Plugin Name: Restaurant Ops Pro
 * Description: Restaurant operations companion plugin.
 * Version: 1.3.0
 * Author: Restaurant Ops Team
 * Text Domain: restaurant-ops-pro
 */

if (! defined('ABSPATH')) {
    exit;
}

define('ROP_VERSION', '1.3.0');
define('ROP_PLUGIN_FILE', __FILE__);
define('ROP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ROP_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once ROP_PLUGIN_DIR . 'includes/class-rop-woo.php';
require_once ROP_PLUGIN_DIR . 'includes/class-rop-ajax.php';

add_action('init', static function () {
    ROP_Ajax::init();
});
