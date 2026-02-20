<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Delivery_Toggle
{
    const OPTION_KEY = 'rop_checkout_settings';

    public static function init()
    {
        add_filter('woocommerce_checkout_fields', [self::class, 'filter_checkout_fields']);
        add_action('woocommerce_cart_calculate_fees', [self::class, 'maybe_zero_delivery_fee'], 20);
        add_action('woocommerce_checkout_create_order', [self::class, 'save_order_fulfillment'], 20, 2);
    }

    public static function defaults()
    {
        return [
            'pickup_enabled' => 1,
            'label_delivery' => 'Entrega',
            'label_pickup' => 'Retirada',
            'default_fulfillment' => 'delivery',
            'pickup_hides_shipping' => 1,
            'pickup_zero_delivery_fee' => 1,
        ];
    }

    public static function get_settings()
    {
        $saved = get_option(self::OPTION_KEY, []);
        if (! is_array($saved)) {
            $saved = [];
        }

        $settings = wp_parse_args($saved, self::defaults());
        $settings['pickup_enabled'] = ! empty($settings['pickup_enabled']) ? 1 : 0;
        $settings['label_delivery'] = sanitize_text_field($settings['label_delivery']);
        $settings['label_pickup'] = sanitize_text_field($settings['label_pickup']);
        $settings['default_fulfillment'] = in_array($settings['default_fulfillment'], ['delivery', 'pickup'], true) ? $settings['default_fulfillment'] : 'delivery';
        $settings['pickup_hides_shipping'] = ! empty($settings['pickup_hides_shipping']) ? 1 : 0;
        $settings['pickup_zero_delivery_fee'] = ! empty($settings['pickup_zero_delivery_fee']) ? 1 : 0;

        return $settings;
    }

    public static function sanitize_settings($input)
    {
        if (! is_array($input)) {
            return self::defaults();
        }

        return [
            'pickup_enabled' => ! empty($input['pickup_enabled']) ? 1 : 0,
            'label_delivery' => sanitize_text_field($input['label_delivery'] ?? 'Entrega'),
            'label_pickup' => sanitize_text_field($input['label_pickup'] ?? 'Retirada'),
            'default_fulfillment' => in_array(($input['default_fulfillment'] ?? 'delivery'), ['delivery', 'pickup'], true) ? $input['default_fulfillment'] : 'delivery',
            'pickup_hides_shipping' => ! empty($input['pickup_hides_shipping']) ? 1 : 0,
            'pickup_zero_delivery_fee' => ! empty($input['pickup_zero_delivery_fee']) ? 1 : 0,
        ];
    }

    public static function current_fulfillment()
    {
        $posted = sanitize_key(wp_unslash($_REQUEST['rop_fulfillment'] ?? ''));
        if (in_array($posted, ['delivery', 'pickup'], true)) {
            return $posted;
        }

        $sessionValue = '';
        if (function_exists('WC') && WC()->session) {
            $sessionValue = sanitize_key((string) WC()->session->get('rop_fulfillment'));
            if (in_array($sessionValue, ['delivery', 'pickup'], true)) {
                return $sessionValue;
            }
        }

        $settings = self::get_settings();
        return $settings['default_fulfillment'];
    }

    public static function filter_checkout_fields($fields)
    {
        $settings = self::get_settings();
        $current = self::current_fulfillment();

        if (! isset($fields['order'])) {
            $fields['order'] = [];
        }

        if (! empty($settings['pickup_enabled'])) {
            $fields['order']['rop_fulfillment'] = [
                'type' => 'radio',
                'label' => __('Tipo de pedido', 'restaurant-ops-pro'),
                'required' => true,
                'class' => ['form-row-wide'],
                'priority' => 10,
                'options' => [
                    'delivery' => $settings['label_delivery'] ?: 'Entrega',
                    'pickup' => $settings['label_pickup'] ?: 'Retirada',
                ],
                'default' => $current,
            ];
        }

        if ($current === 'pickup' && ! empty($settings['pickup_hides_shipping']) && isset($fields['shipping'])) {
            $fields['shipping'] = [];
        }

        if (function_exists('WC') && WC()->session) {
            WC()->session->set('rop_fulfillment', $current);
        }

        return $fields;
    }

    public static function maybe_zero_delivery_fee($cart)
    {
        if (! $cart instanceof WC_Cart || is_admin() && ! wp_doing_ajax()) {
            return;
        }

        $settings = self::get_settings();
        if (empty($settings['pickup_zero_delivery_fee'])) {
            return;
        }

        if (self::current_fulfillment() !== 'pickup') {
            return;
        }

        $fees = $cart->get_fees();
        foreach ($fees as $fee_key => $fee) {
            if (! isset($fee->name)) {
                continue;
            }

            $name = mb_strtolower(wp_strip_all_tags((string) $fee->name));
            if (strpos($name, 'entrega') !== false || strpos($name, 'delivery') !== false || strpos($name, 'shipping') !== false) {
                unset($cart->fees_api()->fees[$fee_key]);
            }
        }
    }

    public static function save_order_fulfillment($order)
    {
        if (! $order instanceof WC_Order) {
            return;
        }

        $fulfillment = self::current_fulfillment();
        $order->update_meta_data('rop_fulfillment', $fulfillment);
    }
}
