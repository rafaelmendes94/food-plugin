<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Plugin
{
    /** @var ROP_Plugin|null */
    private static $instance = null;

    public static function instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct()
    {
        add_action('plugins_loaded', [$this, 'plugins_loaded']);
        add_action('init', [$this, 'init']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_front_assets']);
        add_action('admin_menu', [$this, 'register_admin_menu']);
    }

    public function plugins_loaded()
    {
    }

    public function init()
    {
        ROP_Pages::init();
    }

    public function enqueue_front_assets()
    {
        ROP_Assets::enqueue_public_assets();
    }

    public function register_admin_menu()
    {
        if (class_exists('ROP_Admin_Menu')) {
            ROP_Admin_Menu::register();
        }
    }
}
