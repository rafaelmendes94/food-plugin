<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Ajax
{
    public static function register()
    {
        add_action('wp_ajax_rop_get_store_settings', [self::class, 'get_store_settings']);
        add_action('wp_ajax_nopriv_rop_get_store_settings', [self::class, 'get_store_settings']);
        add_action('wp_ajax_rop_get_store_status', [self::class, 'get_store_status']);
        add_action('wp_ajax_nopriv_rop_get_store_status', [self::class, 'get_store_status']);

        add_action('wp_ajax_rop_app_bootstrap', [self::class, 'app_bootstrap']);
        add_action('wp_ajax_nopriv_rop_app_bootstrap', [self::class, 'app_bootstrap']);

        add_action('wp_ajax_rop_list_categories', [self::class, 'list_categories']);
        add_action('wp_ajax_nopriv_rop_list_categories', [self::class, 'list_categories']);
        add_action('wp_ajax_rop_list_products', [self::class, 'list_products']);
        add_action('wp_ajax_nopriv_rop_list_products', [self::class, 'list_products']);
        add_action('wp_ajax_rop_products_list', [self::class, 'products_list']);
        add_action('wp_ajax_nopriv_rop_products_list', [self::class, 'products_list']);
        add_action('wp_ajax_rop_search_suggestions', [self::class, 'search_suggestions']);
        add_action('wp_ajax_nopriv_rop_search_suggestions', [self::class, 'search_suggestions']);
        add_action('wp_ajax_rop_add_to_cart_simple', [self::class, 'add_to_cart_simple']);
        add_action('wp_ajax_nopriv_rop_add_to_cart_simple', [self::class, 'add_to_cart_simple']);

        add_action('wp_ajax_rop_get_product', [self::class, 'get_product']);
        add_action('wp_ajax_nopriv_rop_get_product', [self::class, 'get_product']);
        add_action('wp_ajax_rop_add_to_cart', [self::class, 'add_to_cart']);
        add_action('wp_ajax_nopriv_rop_add_to_cart', [self::class, 'add_to_cart']);
        add_action('wp_ajax_rop_get_cart_summary', [self::class, 'get_cart_summary']);
        add_action('wp_ajax_nopriv_rop_get_cart_summary', [self::class, 'get_cart_summary']);
        add_action('wp_ajax_rop_cart_get', [self::class, 'cart_get']);
        add_action('wp_ajax_nopriv_rop_cart_get', [self::class, 'cart_get']);
        add_action('wp_ajax_rop_cart_add', [self::class, 'cart_add']);
        add_action('wp_ajax_nopriv_rop_cart_add', [self::class, 'cart_add']);
        add_action('wp_ajax_rop_cart_set_qty', [self::class, 'cart_set_qty']);
        add_action('wp_ajax_nopriv_rop_cart_set_qty', [self::class, 'cart_set_qty']);
        add_action('wp_ajax_rop_cart_remove', [self::class, 'cart_remove']);
        add_action('wp_ajax_nopriv_rop_cart_remove', [self::class, 'cart_remove']);
        add_action('wp_ajax_rop_cart_apply_coupon', [self::class, 'cart_apply_coupon']);
        add_action('wp_ajax_nopriv_rop_cart_apply_coupon', [self::class, 'cart_apply_coupon']);
        add_action('wp_ajax_rop_cart_remove_coupon', [self::class, 'cart_remove_coupon']);
        add_action('wp_ajax_nopriv_rop_cart_remove_coupon', [self::class, 'cart_remove_coupon']);
        add_action('wp_ajax_rop_cart_summary', [self::class, 'cart_summary']);
        add_action('wp_ajax_nopriv_rop_cart_summary', [self::class, 'cart_summary']);
        add_action('wp_ajax_rop_cart_clear', [self::class, 'cart_clear']);
        add_action('wp_ajax_nopriv_rop_cart_clear', [self::class, 'cart_clear']);
        add_action('wp_ajax_rop_checkout_html', [self::class, 'checkout_html']);
        add_action('wp_ajax_nopriv_rop_checkout_html', [self::class, 'checkout_html']);
        add_action('wp_ajax_rop_place_order', [self::class, 'place_order']);
        add_action('wp_ajax_nopriv_rop_place_order', [self::class, 'place_order']);
        add_action('wp_ajax_rop_orders_list', [self::class, 'orders_list']);
        add_action('wp_ajax_nopriv_rop_orders_list', [self::class, 'orders_list']);
        add_action('wp_ajax_rop_account_get', [self::class, 'account_get']);
        add_action('wp_ajax_nopriv_rop_account_get', [self::class, 'account_get']);
        add_action('wp_ajax_rop_account_update', [self::class, 'account_update']);
        add_action('wp_ajax_rop_account_change_password', [self::class, 'account_change_password']);
        add_action('wp_ajax_rop_order_details', [self::class, 'order_details']);
        add_action('wp_ajax_rop_render_single_product', [self::class, 'render_single_product']);
        add_action('wp_ajax_nopriv_rop_render_single_product', [self::class, 'render_single_product']);
        add_action('wp_ajax_rop_add_to_cart_from_form', [self::class, 'add_to_cart_from_form']);
        add_action('wp_ajax_nopriv_rop_add_to_cart_from_form', [self::class, 'add_to_cart_from_form']);
    }

    public static function get_store_settings()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        wp_send_json_success([
            'store' => ROP_Store_Settings::get_all(),
        ]);
    }

    public static function get_store_status()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        wp_send_json_success([
            'is_open' => (bool) ROP_Hours::is_open(),
            'human_status' => sanitize_text_field(ROP_Hours::human_status()),
            'next_open_time' => sanitize_text_field(ROP_Hours::next_open_time()),
        ]);
    }

    public static function app_bootstrap()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        $cache_key = 'rop_app_bootstrap_v1';
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            wp_send_json_success($cached);
        }

        $store = ROP_Store_Settings::get_all();
        $store['logo_url'] = esc_url_raw($store['logo_url'] ?? '');
        $store['has_logo'] = ! empty($store['logo_url']);
        $hours = [
            'is_open' => (bool) ROP_Hours::is_open(),
            'human_status' => sanitize_text_field(ROP_Hours::human_status()),
            'next_open_time' => sanitize_text_field(ROP_Hours::next_open_time()),
            'schedule' => ROP_Hours::schedule_for_display(),
        ];
        [$eta_min, $eta_max] = ROP_ETA::get_eta_range();

        $checkout_settings = ROP_Delivery_Toggle::get_settings();
        $ops = wp_parse_args(get_option('rop_ops_settings', []), [
            'kitchen_priority' => 'delivery_first',
            'kitchen_sound_enabled_default' => 1,
            'kitchen_poll_interval_sec' => 5,
            'auto_print_on_approve' => 0,
            'default_ticket_format' => '80mm',
        ]);

        $payload = [
            'store' => $store,
            'hours' => $hours,
            'eta' => [
                'min' => (int) $eta_min,
                'max' => (int) $eta_max,
                'text' => sanitize_text_field(ROP_ETA::get_eta_text()),
            ],
            'checkout' => [
                'pickup_enabled' => (int) $checkout_settings['pickup_enabled'],
                'labels' => [
                    'delivery' => sanitize_text_field($checkout_settings['label_delivery']),
                    'pickup' => sanitize_text_field($checkout_settings['label_pickup']),
                ],
                'default_fulfillment' => sanitize_key($checkout_settings['default_fulfillment']),
            ],
            'ops' => [
                'priority' => sanitize_key($ops['kitchen_priority']),
                'kitchen_poll_interval_sec' => (int) $ops['kitchen_poll_interval_sec'],
                'auto_print_on_approve' => ! empty($ops['auto_print_on_approve']) ? 1 : 0,
                'default_ticket_format' => sanitize_text_field($ops['default_ticket_format']),
            ],
        ];

        set_transient($cache_key, $payload, MINUTE_IN_SECONDS);

        wp_send_json_success($payload);
    }

    public static function list_categories()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_success(['categories' => []]);
        }

        $cache_key = 'rop_cats_v1';
        $cached = get_transient($cache_key);

        if (is_array($cached)) {
            wp_send_json_success(['categories' => $cached]);
        }

        $terms = get_terms([
            'taxonomy' => 'product_cat',
            'hide_empty' => true,
            'orderby' => 'name',
            'order' => 'ASC',
        ]);

        if (is_wp_error($terms) || ! is_array($terms)) {
            wp_send_json_success(['categories' => []]);
        }

        $categories = [];

        foreach ($terms as $term) {
            if (! $term instanceof WP_Term) {
                continue;
            }

            $categories[] = [
                'id' => (int) $term->term_id,
                'name' => sanitize_text_field($term->name),
                'slug' => sanitize_title($term->slug),
                'count' => (int) $term->count,
            ];
        }

        set_transient($cache_key, $categories, 10 * MINUTE_IN_SECONDS);

        wp_send_json_success(['categories' => $categories]);
    }

    public static function products_list()
    {
        self::list_products();
    }

    public static function list_products()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_success([
                'products' => [],
                'page' => 1,
                'has_more' => false,
            ]);
        }

        $page = max(1, absint($_POST['page'] ?? 1));
        $per_page = max(1, min(20, absint($_POST['per_page'] ?? 10)));

        $raw_category = wp_unslash($_POST['category'] ?? '');
        $category = '';
        if (is_numeric($raw_category)) {
            $term = get_term(absint($raw_category), 'product_cat');
            if ($term && ! is_wp_error($term)) {
                $category = (string) $term->slug;
            }
        } else {
            $category = sanitize_title((string) $raw_category);
        }

        $search = sanitize_text_field(wp_unslash($_POST['search'] ?? ($_POST['q'] ?? '')));
        $orderby = sanitize_key(wp_unslash($_POST['orderby'] ?? 'recommended'));
        $price_bucket = sanitize_text_field(wp_unslash($_POST['price_bucket'] ?? ($_POST['price_tier'] ?? '')));

        $args = [
            'status' => 'publish',
            'limit' => $per_page,
            'page' => $page,
            'paginate' => true,
            'return' => 'objects',
            'catalog_visibility' => 'visible',
        ];

        if ($category !== '') {
            $args['category'] = [$category];
        }

        if ($search !== '') {
            $args['s'] = $search;
        }

        switch ($orderby) {
            case 'rating':
                $args['orderby'] = 'rating';
                $args['order'] = 'DESC';
                break;
            case 'price_asc':
                $args['orderby'] = 'price';
                $args['order'] = 'ASC';
                break;
            case 'price_desc':
                $args['orderby'] = 'price';
                $args['order'] = 'DESC';
                break;
            case 'date':
            case 'newest':
                $args['orderby'] = 'date';
                $args['order'] = 'DESC';
                break;
            case 'sale':
                $args['on_sale'] = true;
                $args['orderby'] = 'menu_order';
                $args['order'] = 'ASC';
                break;
            case 'recommended':
            default:
                $args['orderby'] = 'menu_order';
                $args['order'] = 'ASC';
                break;
        }

        if (in_array($price_bucket, ['$', '$$', '$$$'], true)) {
            if ($price_bucket === '$') {
                $args['meta_query'] = [[
                    'key' => '_price',
                    'value' => [0, 19.99],
                    'compare' => 'BETWEEN',
                    'type' => 'DECIMAL(10,2)',
                ]];
            } elseif ($price_bucket === '$$') {
                $args['meta_query'] = [[
                    'key' => '_price',
                    'value' => [20, 39.99],
                    'compare' => 'BETWEEN',
                    'type' => 'DECIMAL(10,2)',
                ]];
            } else {
                $args['meta_query'] = [[
                    'key' => '_price',
                    'value' => 40,
                    'compare' => '>=',
                    'type' => 'DECIMAL(10,2)',
                ]];
            }
        }

        $query = new WC_Product_Query($args);
        $result = $query->get_products();

        $items = [];
        $max_pages = 1;
        if (is_object($result) && isset($result->products, $result->max_num_pages)) {
            $items = is_array($result->products) ? $result->products : [];
            $max_pages = max(1, (int) $result->max_num_pages);
        } elseif (is_array($result)) {
            $items = $result;
            $max_pages = count($items) < $per_page ? $page : $page + 1;
        }

        $products = [];
        foreach ($items as $product) {
            $card = ROP_Woo::get_product_card_data($product);
            if (! empty($card)) {
                $products[] = $card;
            }
        }

        wp_send_json_success([
            'products' => $products,
            'page' => $page,
            'has_more' => $page < $max_pages,
        ]);
    }

    public static function search_suggestions()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_success(['suggestions' => []]);
        }

        $q = sanitize_text_field(wp_unslash($_POST['q'] ?? ''));

        if (strlen($q) < 2) {
            wp_send_json_success(['suggestions' => []]);
        }

        $cache_key = 'rop_suggest_v1_' . md5(strtolower($q));
        $cached = get_transient($cache_key);

        if (is_array($cached)) {
            wp_send_json_success(['suggestions' => $cached]);
        }

        $query = new WP_Query([
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => 8,
            's' => $q,
            'fields' => 'ids',
            'no_found_rows' => true,
        ]);

        $suggestions = [];

        if (! empty($query->posts)) {
            foreach ($query->posts as $product_id) {
                $name = get_the_title($product_id);

                if (! $name) {
                    continue;
                }

                $suggestions[] = [
                    'id' => (int) $product_id,
                    'name' => sanitize_text_field($name),
                ];
            }
        }

        wp_reset_postdata();

        set_transient($cache_key, $suggestions, MINUTE_IN_SECONDS);

        wp_send_json_success(['suggestions' => $suggestions]);
    }

    public static function get_product()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_error(['message' => 'WooCommerce não está ativo.'], 400);
        }

        $product_id = absint($_POST['product_id'] ?? 0);
        $product = $product_id ? wc_get_product($product_id) : false;

        if (! $product || 'publish' !== get_post_status($product_id)) {
            wp_send_json_error(['message' => 'Produto não encontrado.'], 404);
        }

        $image = '';
        $image_id = $product->get_image_id();

        if ($image_id) {
            $image = wp_get_attachment_image_url($image_id, 'woocommerce_single');
            if (! $image) {
                $image = wp_get_attachment_image_url($image_id, 'full');
            }
        }

        if (! $image) {
            $image = wc_placeholder_img_src('woocommerce_single');
        }

        $gallery = [];
        foreach ((array) $product->get_gallery_image_ids() as $gid) {
            $url = wp_get_attachment_image_url((int) $gid, 'woocommerce_single');
            if (! $url) {
                $url = wp_get_attachment_image_url((int) $gid, 'full');
            }
            if ($url) {
                $gallery[] = esc_url_raw($url);
            }
        }

        $card_data = ROP_Woo::get_product_card_data($product);

        $short_description = trim(wp_strip_all_tags((string) $product->get_short_description()));
        $description = trim(wp_strip_all_tags((string) $product->get_description()));

        $barn2_html = ROP_Compat_Barn2::render_options_html($product_id);

        $is_variable = $product->is_type('variable');
        $variable_attributes = [];
        $variations = [];

        if ($is_variable) {
            $attr_map = $product->get_variation_attributes();
            $wc_attrs = $product->get_attributes();

            foreach ($attr_map as $attr_key => $options) {
                $slug = sanitize_key((string) $attr_key);
                $label = $slug;

                if (isset($wc_attrs[$attr_key]) && $wc_attrs[$attr_key] instanceof WC_Product_Attribute) {
                    $label = $wc_attrs[$attr_key]->get_name();
                }

                $pretty = wc_attribute_label($label, $product);

                $formatted_options = [];
                foreach ((array) $options as $opt) {
                    $opt_slug = sanitize_title($opt);
                    $opt_name = sanitize_text_field($opt);

                    if (taxonomy_exists($attr_key)) {
                        $term = get_term_by('slug', $opt_slug, $attr_key);
                        if ($term && ! is_wp_error($term)) {
                            $opt_name = sanitize_text_field($term->name);
                        }
                    }

                    $formatted_options[] = [
                        'slug' => $opt_slug,
                        'name' => $opt_name,
                    ];
                }

                $variable_attributes[] = [
                    'name' => sanitize_text_field($pretty),
                    'slug' => $slug,
                    'options' => $formatted_options,
                ];
            }

            foreach ((array) $product->get_available_variations() as $row) {
                $attrs = [];
                foreach ((array) ($row['attributes'] ?? []) as $k => $v) {
                    $attrs[sanitize_key((string) $k)] = sanitize_title((string) $v);
                }

                $variations[] = [
                    'variation_id' => (int) ($row['variation_id'] ?? 0),
                    'is_in_stock' => (bool) ($row['is_in_stock'] ?? false),
                    'price' => (float) ($row['display_price'] ?? 0),
                    'price_html' => wp_kses_post((string) ($row['price_html'] ?? '')),
                    'attributes' => $attrs,
                ];
            }
        }

        $payload = [
            'id' => (int) $product_id,
            'type' => sanitize_text_field($product->get_type()),
            'name' => wp_strip_all_tags($product->get_name()),
            'description' => $short_description ?: $description,
            'short_description' => $short_description,
            'formatted_price' => wp_strip_all_tags(wc_price((float) $product->get_price())),
            'price' => (float) $product->get_price(),
            'price_html' => wp_kses_post($product->get_price_html()),
            'permalink' => esc_url_raw(get_permalink($product_id)),
            'image' => esc_url_raw($image),
            'gallery' => $gallery,
            'rating' => (float) $product->get_average_rating(),
            'rating_count' => (int) $product->get_rating_count(),
            'on_sale' => (bool) $product->is_on_sale(),
            'category_name' => sanitize_text_field($card_data['category_name'] ?? ''),
            'category_slug' => sanitize_title($card_data['category_slug'] ?? ''),
            'is_simple' => $product->is_type('simple'),
            'is_variable' => $is_variable,
            'variable_attributes' => $variable_attributes,
            'variations' => $variations,
            'has_addons' => ROP_Compat_Barn2::is_active() && trim($barn2_html) !== '',
            'barn2_active' => (bool) ROP_Compat_Barn2::is_active(),
            'barn2_html' => wp_kses_post($barn2_html),
            'rop_extras_schema' => class_exists('ROP_Extras') ? ROP_Extras::get_effective_schema($product_id) : [],
        ];

        wp_send_json_success([
            'product' => $payload,
        ]);
    }

    public static function get_cart_summary()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_success([
                'count' => 0,
                'total_html' => 'R$ 0,00',
                'total_raw' => 0,
            ]);
        }

        self::ensure_cart_loaded();

        if (! WC()->cart) {
            wp_send_json_success([
                'count' => 0,
                'total_html' => 'R$ 0,00',
                'total_raw' => 0,
            ]);
        }

        $total_html = WC()->cart->get_total();
        $total_raw = method_exists(WC()->cart, 'get_total')
            ? (float) WC()->cart->get_total('edit')
            : (float) WC()->cart->total;

        wp_send_json_success([
            'count' => (int) WC()->cart->get_cart_contents_count(),
            'total_html' => wp_kses_post($total_html),
            'total_raw' => $total_raw,
        ]);
    }


    public static function cart_summary()
    {
        self::get_cart_summary();
    }

    public static function cart_get()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();
        self::debug_cart_context('cart_get');

        WC()->cart->calculate_totals();
        WC()->cart->set_session();

        wp_send_json_success(self::build_cart_payload());
    }

    public static function cart_add()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();
        self::debug_cart_context('cart_add');

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $product_id = absint($_POST['product_id'] ?? 0);
        $qty = max(1, absint($_POST['qty'] ?? 1));
        $variation_id = absint($_POST['variation_id'] ?? 0);

        $raw_variations = wp_unslash($_POST['variations'] ?? ($_POST['attributes'] ?? ''));
        if (is_string($raw_variations) && $raw_variations !== '') {
            $decoded = json_decode($raw_variations, true);
            if (is_array($decoded)) {
                $raw_variations = $decoded;
            }
        }

        $variations = [];
        if (is_array($raw_variations)) {
            foreach ($raw_variations as $k => $v) {
                $variations[sanitize_key((string) $k)] = sanitize_text_field((string) $v);
            }
        }

        $raw_extras = wp_unslash($_POST['extras'] ?? '');
        $extras = [];
        if (is_string($raw_extras) && $raw_extras !== '') {
            $decoded = json_decode($raw_extras, true);
            if (is_array($decoded)) {
                $extras = $decoded;
            }
        } elseif (is_array($_POST['extras'] ?? null)) {
            $extras = $_POST['extras'];
        }

        $result = self::add_product_to_cart($product_id, $qty, $variation_id, $variations, $extras);
        if (! $result['success']) {
            wp_send_json_error(['message' => $result['message']], $result['status']);
        }

        WC()->cart->calculate_totals();
        WC()->cart->set_session();

        wp_send_json_success(self::build_cart_payload());
    }

    public static function cart_set_qty()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();
        self::debug_cart_context('cart_set_qty');
        wc_clear_notices();

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $key = sanitize_text_field(wp_unslash($_POST['key'] ?? ''));
        $qty = max(1, absint($_POST['qty'] ?? 1));

        $cart_items = WC()->cart->get_cart();
        if ($key === '' || ! isset($cart_items[$key])) {
            wp_send_json_error(['message' => 'Item inválido.'], 400);
        }

        WC()->cart->set_quantity($key, $qty, true);
        WC()->cart->calculate_totals();
        WC()->cart->set_session();

        wp_send_json_success(self::build_cart_payload());
    }

    public static function cart_remove()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();
        self::debug_cart_context('cart_remove');
        wc_clear_notices();

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $key = sanitize_text_field(wp_unslash($_POST['key'] ?? ''));
        $cart_items = WC()->cart->get_cart();
        if ($key === '' || ! isset($cart_items[$key])) {
            wp_send_json_error(['message' => 'Item inválido.'], 400);
        }

        WC()->cart->remove_cart_item($key);
        WC()->cart->calculate_totals();
        WC()->cart->set_session();

        wp_send_json_success(self::build_cart_payload());
    }

    public static function cart_apply_coupon()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();
        self::debug_cart_context('cart_apply_coupon');

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $code = sanitize_text_field(wp_unslash($_POST['code'] ?? ''));
        if ($code === '') {
            wp_send_json_error(['message' => 'Informe um cupom.'], 400);
        }

        wc_clear_notices();
        WC()->cart->apply_coupon($code);
        WC()->cart->calculate_totals();
        WC()->cart->set_session();

        wp_send_json_success(self::build_cart_payload());
    }

    public static function cart_remove_coupon()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();
        self::debug_cart_context('cart_remove_coupon');

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $code = sanitize_text_field(wp_unslash($_POST['code'] ?? ''));
        if ($code === '') {
            wp_send_json_error(['message' => 'Cupom inválido.'], 400);
        }

        wc_clear_notices();
        WC()->cart->remove_coupon($code);
        WC()->cart->calculate_totals();
        WC()->cart->set_session();

        wp_send_json_success(self::build_cart_payload());
    }

    public static function cart_clear()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();

        if (function_exists('WC') && WC()->cart) {
            WC()->cart->empty_cart();
            WC()->cart->calculate_totals();
            WC()->cart->set_session();
        }

        wp_send_json_success(['ok' => true]);
    }

    public static function checkout_html()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! function_exists('is_checkout')) {
            wp_send_json_error(['message' => 'WooCommerce indisponível.'], 400);
        }

        ob_start();
        echo do_shortcode('[woocommerce_checkout]');
        $html = ob_get_clean();

        wp_send_json_success([
            'html' => is_string($html) ? $html : '',
        ]);
    }

    public static function place_order()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Hours::is_open()) {
            wp_send_json_error(['message' => 'Loja fechada no momento.'], 400);
        }

        $form_json = wp_unslash($_POST['form'] ?? '');
        $fields = is_string($form_json) ? json_decode($form_json, true) : [];
        $fields = is_array($fields) ? $fields : [];

        $cookies = [];
        foreach ($_COOKIE as $name => $value) {
            $cookies[] = sanitize_text_field((string) $name) . '=' . rawurlencode((string) $value);
        }

        $response = wp_remote_post(home_url('/?wc-ajax=checkout'), [
            'timeout' => 20,
            'headers' => [
                'Content-Type' => 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie' => implode('; ', $cookies),
            ],
            'body' => http_build_query($fields),
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error(['message' => 'Erro ao finalizar pedido.'], 500);
        }

        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);
        if (! is_array($decoded)) {
            wp_send_json_error(['message' => 'Resposta inválida do checkout.'], 500);
        }

        $is_success = ! empty($decoded['result']) && $decoded['result'] === 'success';
        $redirect = sanitize_text_field((string) ($decoded['redirect'] ?? ''));
        $order_id = 0;
        if ($redirect && preg_match('#order-received/(\d+)#', $redirect, $m)) {
            $order_id = absint($m[1]);
        }

        if (! $is_success) {
            $messages = wp_kses_post((string) ($decoded['messages'] ?? 'Não foi possível finalizar o pedido.'));
            wp_send_json_error(['message' => $messages], 400);
        }

        wp_send_json_success([
            'order_id' => $order_id,
            'redirect' => esc_url_raw($redirect),
        ]);
    }

    public static function orders_list()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        $customer_id = get_current_user_id();
        if (! $customer_id) {
            wp_send_json_success(['orders' => []]);
        }

        $orders = wc_get_orders([
            'customer_id' => $customer_id,
            'limit' => 10,
            'orderby' => 'date',
            'order' => 'DESC',
        ]);

        $payload = [];
        foreach ($orders as $order) {
            if (! $order instanceof WC_Order) {
                continue;
            }

            $payload[] = [
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => sanitize_text_field($order->get_status()),
                'total_html' => wp_strip_all_tags($order->get_formatted_order_total()),
                'date' => $order->get_date_created() ? $order->get_date_created()->date_i18n('d/m H:i') : '',
            ];
        }

        wp_send_json_success(['orders' => $payload]);
    }

    public static function render_single_product()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_error(['message' => 'WooCommerce não está ativo.'], 400);
        }

        $product_id = absint($_POST['product_id'] ?? 0);
        $post = $product_id ? get_post($product_id) : null;

        if (! $post instanceof WP_Post || $post->post_type !== 'product') {
            wp_send_json_error(['message' => 'Produto inválido.'], 404);
        }

        $product = wc_get_product($product_id);
        if (! $product || 'publish' !== get_post_status($product_id)) {
            wp_send_json_error(['message' => 'Produto não encontrado.'], 404);
        }

        $old_post = $GLOBALS['post'] ?? null;
        $old_product = $GLOBALS['product'] ?? null;

        $GLOBALS['post'] = $post;
        $GLOBALS['product'] = $product;
        setup_postdata($post);

        ob_start();
        echo '<div class="rop-woo-single-inner woocommerce rop-woo-shortcode">';
        echo do_shortcode('[product_page id="' . $product_id . '"]');
        echo '</div>';
        $html = ob_get_clean();

        wp_reset_postdata();

        if ($old_post instanceof WP_Post) {
            $GLOBALS['post'] = $old_post;
        } else {
            unset($GLOBALS['post']);
        }

        if ($old_product instanceof WC_Product) {
            $GLOBALS['product'] = $old_product;
        } else {
            unset($GLOBALS['product']);
        }

        wp_send_json_success([
            'html' => is_string($html) ? $html : '',
        ]);
    }

    public static function add_to_cart_from_form()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        $product_id = absint($_POST['product_id'] ?? 0);
        $form_json = wp_unslash($_POST['form'] ?? '');
        $raw_form = is_string($form_json) ? json_decode($form_json, true) : [];
        $raw_form = is_array($raw_form) ? $raw_form : [];

        $posted = [];
        foreach ($raw_form as $k => $v) {
            $key = sanitize_text_field((string) $k);
            if ($key === '') {
                continue;
            }

            if (is_array($v)) {
                $posted[$key] = array_values(array_map(static function ($item) {
                    return sanitize_text_field((string) $item);
                }, $v));
            } else {
                $posted[$key] = sanitize_text_field((string) $v);
            }
        }

        $qty = max(1, absint($posted['quantity'] ?? 1));
        $variation_id = absint($posted['variation_id'] ?? 0);
        $attributes = [];

        foreach ($posted as $key => $value) {
            if (strpos($key, 'attribute_') === 0) {
                $attributes[sanitize_key($key)] = sanitize_title((string) $value);
            }
        }

        $result = self::add_product_to_cart($product_id, $qty, $variation_id, $attributes, $posted);

        if (! $result['success']) {
            wp_send_json_error(['message' => $result['message']], $result['status']);
        }

        wp_send_json_success($result['data']);
    }

    public static function add_to_cart_simple()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        $product_id = absint($_POST['product_id'] ?? 0);
        $qty = max(1, absint($_POST['qty'] ?? 1));

        $result = self::add_product_to_cart($product_id, $qty, 0, [], []);

        if (! $result['success']) {
            wp_send_json_error(['message' => $result['message']], $result['status']);
        }

        wp_send_json_success($result['data']);
    }

    public static function add_to_cart()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        $product_id = absint($_POST['product_id'] ?? 0);
        $qty = max(1, absint($_POST['qty'] ?? 1));
        $variation_id = absint($_POST['variation_id'] ?? 0);

        $raw_attrs = $_POST['attributes'] ?? [];
        if (is_string($raw_attrs) && $raw_attrs !== '') {
            $decoded_attrs = json_decode(wp_unslash($raw_attrs), true);
            if (is_array($decoded_attrs)) {
                $raw_attrs = $decoded_attrs;
            }
        }

        $attributes = [];
        if (is_array($raw_attrs)) {
            foreach ($raw_attrs as $k => $v) {
                $attributes[sanitize_key((string) $k)] = sanitize_title((string) $v);
            }
        }

        $extras_json = wp_unslash($_POST['extras'] ?? '');
        $extras_arr = [];

        if (is_string($extras_json) && $extras_json !== '') {
            $decoded_extras = json_decode($extras_json, true);
            if (is_array($decoded_extras)) {
                $extras_arr = $decoded_extras;
            }
        } elseif (is_array($_POST['extras'] ?? null)) {
            $extras_arr = $_POST['extras'];
        }

        $extras = ROP_Compat_Barn2::parse_posted_options($extras_arr);

        $result = self::add_product_to_cart($product_id, $qty, $variation_id, $attributes, $extras);

        if (! $result['success']) {
            wp_send_json_error(['message' => $result['message']], $result['status']);
        }

        wp_send_json_success($result['data']);
    }

    private static function add_product_to_cart($product_id, $qty, $variation_id, $variation, $extras)
    {
        if (! ROP_Woo::is_woo_active()) {
            return ['success' => false, 'status' => 400, 'message' => 'WooCommerce não está ativo.', 'data' => []];
        }

        if (! $product_id) {
            return ['success' => false, 'status' => 400, 'message' => 'Produto inválido.', 'data' => []];
        }

        $product = wc_get_product($product_id);

        if (! $product || 'publish' !== get_post_status($product_id)) {
            return ['success' => false, 'status' => 404, 'message' => 'Produto não encontrado.', 'data' => []];
        }

        if (! $product->is_purchasable() || ! $product->is_in_stock()) {
            return ['success' => false, 'status' => 400, 'message' => 'Produto indisponível.', 'data' => []];
        }

        self::ensure_cart_loaded();

        if (! WC()->cart) {
            return ['success' => false, 'status' => 500, 'message' => 'Carrinho indisponível.', 'data' => []];
        }

        $cart_item_data = [];
        $base_price = (float) wc_format_decimal((float) $product->get_price(), 2);
        $extras_total = class_exists('ROP_Extras') ? (float) ROP_Extras::calculate_extras_total($product_id, $extras) : 0.0;

        $cart_item_data['rop_base_price'] = $base_price;
        $cart_item_data['rop_extras_total'] = $extras_total;
        $cart_item_data['rop_line_unit_price'] = (float) wc_format_decimal($base_price + $extras_total, 2);

        if (! empty($extras)) {
            $cart_item_data['rop_barn2_raw'] = $extras;
            $cart_item_data['rop_barn2_key'] = md5(wp_json_encode($extras));
            $cart_item_data['rop_extras'] = $extras;
        }

        if (class_exists('ROP_Extras') && ! ROP_Extras::validate_selection($product_id, $extras)) {
            return ['success' => false, 'status' => 400, 'message' => 'Seleção de extras inválida.', 'data' => []];
        }

        $original_post = $_POST;
        $posted_extras = [];

        if (! empty($extras) && ROP_Compat_Barn2::is_active()) {
            $posted_extras = ROP_Compat_Barn2::build_post_from_extras($extras);
            $_POST = array_merge($_POST, $posted_extras);
        }

        if ($product->is_type('variable')) {
            if (! $variation_id || empty($variation)) {
                $_POST = $original_post;
                return ['success' => false, 'status' => 400, 'message' => 'Selecione opções.', 'data' => []];
            }

            $variation_product = wc_get_product($variation_id);
            if (! $variation_product || (int) $variation_product->get_parent_id() !== (int) $product_id || ! $variation_product->is_in_stock()) {
                $_POST = $original_post;
                return ['success' => false, 'status' => 400, 'message' => 'Variação inválida.', 'data' => []];
            }

            $added = WC()->cart->add_to_cart($product_id, $qty, $variation_id, $variation, $cart_item_data);
        } elseif ($product->is_type('simple')) {
            $added = WC()->cart->add_to_cart($product_id, $qty, 0, [], $cart_item_data);
        } else {
            $_POST = $original_post;
            return ['success' => false, 'status' => 400, 'message' => 'Este item exige seleção de opções.', 'data' => []];
        }

        $_POST = $original_post;

        if (! $added) {
            return ['success' => false, 'status' => 400, 'message' => 'Não foi possível adicionar ao carrinho.', 'data' => []];
        }

        return [
            'success' => true,
            'status' => 200,
            'message' => 'Adicionado ao carrinho.',
            'data' => [
                'message' => 'Adicionado ao carrinho.',
                'cart_count' => (int) WC()->cart->get_cart_contents_count(),
                'total_html' => wp_kses_post(WC()->cart->get_total()),
            ],
        ];
    }

    public static function account_get()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! is_user_logged_in()) {
            wp_send_json_success(['logged_in' => false]);
        }

        $user = wp_get_current_user();
        $uid = (int) $user->ID;

        $billing = [];
        foreach (['first_name', 'last_name', 'phone', 'address_1', 'address_2', 'city', 'state', 'postcode'] as $field) {
            $billing['billing_' . $field] = sanitize_text_field(get_user_meta($uid, 'billing_' . $field, true));
        }

        $shipping = [];
        foreach (['first_name', 'last_name', 'address_1', 'address_2', 'city', 'state', 'postcode'] as $field) {
            $shipping['shipping_' . $field] = sanitize_text_field(get_user_meta($uid, 'shipping_' . $field, true));
        }

        wp_send_json_success([
            'logged_in' => true,
            'user' => [
                'first_name' => sanitize_text_field($user->first_name),
                'last_name' => sanitize_text_field($user->last_name),
                'display_name' => sanitize_text_field($user->display_name),
                'user_email' => sanitize_email($user->user_email),
            ],
            'billing' => $billing,
            'shipping' => $shipping,
        ]);
    }

    public static function account_update()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! is_user_logged_in()) {
            wp_send_json_error(['message' => 'Faça login para salvar seus dados.'], 401);
        }

        $user_id = get_current_user_id();
        $meta_fields = [
            'billing_first_name', 'billing_last_name', 'billing_phone', 'billing_address_1', 'billing_address_2', 'billing_city', 'billing_state', 'billing_postcode',
            'shipping_first_name', 'shipping_last_name', 'shipping_address_1', 'shipping_address_2', 'shipping_city', 'shipping_state', 'shipping_postcode',
        ];

        foreach ($meta_fields as $field) {
            $value = sanitize_text_field(wp_unslash($_POST[$field] ?? ''));
            update_user_meta($user_id, $field, $value);
        }

        $first_name = sanitize_text_field(wp_unslash($_POST['first_name'] ?? ''));
        $last_name = sanitize_text_field(wp_unslash($_POST['last_name'] ?? ''));
        if ($first_name !== '' || $last_name !== '') {
            wp_update_user([
                'ID' => $user_id,
                'first_name' => $first_name,
                'last_name' => $last_name,
                'display_name' => trim($first_name . ' ' . $last_name),
            ]);
        }

        wp_send_json_success(['message' => 'Salvo com sucesso.']);
    }


    public static function account_change_password()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! is_user_logged_in()) {
            wp_send_json_error(['message' => 'Faça login para alterar senha.'], 401);
        }

        $user = wp_get_current_user();
        $current = (string) wp_unslash($_POST['current_password'] ?? '');
        $new_password = (string) wp_unslash($_POST['new_password'] ?? '');

        if ($current === '' || $new_password === '' || strlen($new_password) < 6) {
            wp_send_json_error(['message' => 'Senha inválida.'], 400);
        }

        if (! wp_check_password($current, $user->user_pass, $user->ID)) {
            wp_send_json_error(['message' => 'Senha atual incorreta.'], 400);
        }

        wp_set_password($new_password, $user->ID);
        wp_set_auth_cookie($user->ID, true);
        wp_set_current_user($user->ID);

        wp_send_json_success(['message' => 'Senha atualizada com sucesso.']);
    }

    public static function order_details()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! is_user_logged_in()) {
            wp_send_json_error(['message' => 'Faça login para ver pedidos.'], 401);
        }

        $order_id = absint($_POST['order_id'] ?? 0);
        $order = $order_id ? wc_get_order($order_id) : false;

        if (! $order instanceof WC_Order || (int) $order->get_customer_id() !== (int) get_current_user_id()) {
            wp_send_json_error(['message' => 'Pedido não encontrado.'], 404);
        }

        $items = [];
        foreach ($order->get_items() as $item) {
            if (! $item instanceof WC_Order_Item_Product) {
                continue;
            }
            $items[] = [
                'name' => sanitize_text_field($item->get_name()),
                'qty' => (int) $item->get_quantity(),
                'total_html' => wp_strip_all_tags(wc_price((float) $item->get_total())),
            ];
        }

        wp_send_json_success([
            'order' => [
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => sanitize_text_field($order->get_status()),
                'date' => $order->get_date_created() ? $order->get_date_created()->date_i18n('d/m H:i') : '',
                'total_html' => wp_strip_all_tags($order->get_formatted_order_total()),
                'address' => wp_kses_post($order->get_formatted_billing_address()),
                'items' => $items,
            ],
        ]);
    }


    private static function build_cart_payload()
    {
        if (! function_exists('WC') || ! WC()->cart) {
            return [
                'count' => 0,
                'items' => [],
                'coupons' => [],
                'totals' => [
                    'subtotal_raw' => 0,
                    'shipping_raw' => 0,
                    'discount_raw' => 0,
                    'total_raw' => 0,
                    'subtotal_html' => 'R$ 0,00',
                    'shipping_html' => 'Grátis',
                    'discount_html' => 'R$ 0,00',
                    'total_html' => 'R$ 0,00',
                ],
                'free_shipping_threshold_raw' => 0,
                'free_shipping_remaining_raw' => 0,
                'free_shipping_progress' => 0,
                'free_shipping_message' => '',
                'notices_html' => '',
            ];
        }

        WC()->cart->calculate_totals();
        WC()->cart->set_session();

        $items = [];
        foreach (WC()->cart->get_cart() as $key => $item) {
            $product = isset($item['data']) && $item['data'] instanceof WC_Product ? $item['data'] : null;
            if (! $product) {
                continue;
            }

            $image_url = $product->get_image_id() ? wp_get_attachment_image_url($product->get_image_id(), 'woocommerce_thumbnail') : '';
            if (! $image_url) {
                $image_url = wc_placeholder_img_src('woocommerce_thumbnail');
            }

            $extras = [];
            if (! empty($item['rop_extras']) && is_array($item['rop_extras'])) {
                foreach ($item['rop_extras'] as $extra) {
                    if (is_array($extra)) {
                        foreach ($extra as $e) {
                            $extras[] = sanitize_text_field((string) $e);
                        }
                    } else {
                        $extras[] = sanitize_text_field((string) $extra);
                    }
                }
            }

            $qty = (int) ($item['quantity'] ?? 1);
            $items[] = [
                'key' => sanitize_text_field((string) $key),
                'product_id' => (int) ($item['product_id'] ?? 0),
                'name' => sanitize_text_field($product->get_name()),
                'image_url' => esc_url_raw($image_url),
                'qty' => $qty,
                'unit_price_html' => wp_strip_all_tags(WC()->cart->get_product_price($product)),
                'line_total_html' => wp_strip_all_tags(WC()->cart->get_product_subtotal($product, $qty)),
                'extras_text' => implode(', ', array_values(array_filter(array_unique($extras)))),
            ];
        }

        $subtotal_raw = (float) WC()->cart->get_subtotal();
        $shipping_raw = (float) WC()->cart->get_shipping_total();
        $discount_raw = (float) WC()->cart->get_discount_total();
        $total_raw = method_exists(WC()->cart, 'get_total') ? (float) WC()->cart->get_total('edit') : (float) WC()->cart->total;

        $threshold = self::get_free_shipping_threshold();
        $base_for_free_shipping = max(0, $subtotal_raw - $discount_raw);
        $remaining = $threshold > 0 ? max(0, $threshold - $base_for_free_shipping) : 0;
        $progress = $threshold > 0 ? min(1, $base_for_free_shipping / $threshold) : 0;

        $has_free_shipping_coupon = false;
        foreach (WC()->cart->get_applied_coupons() as $coupon_code) {
            $coupon = new WC_Coupon($coupon_code);
            if ($coupon instanceof WC_Coupon && method_exists($coupon, 'get_free_shipping') && $coupon->get_free_shipping()) {
                $has_free_shipping_coupon = true;
                break;
            }
        }

        $free_shipping_message = '';
        if ($has_free_shipping_coupon) {
            $progress = 1;
            $remaining = 0;
            $free_shipping_message = 'Cupom de frete grátis aplicado';
        } elseif ($threshold > 0 && $remaining > 0) {
            $free_shipping_message = sprintf('Falta %s para frete grátis', wp_strip_all_tags(wc_price($remaining)));
        } elseif ($threshold > 0) {
            $progress = 1;
            $free_shipping_message = 'Você já desbloqueou frete grátis';
        }

        ob_start();
        if (function_exists('wc_print_notices')) {
            wc_print_notices();
        }
        $notices_html = (string) ob_get_clean();

        return [
            'count' => (int) WC()->cart->get_cart_contents_count(),
            'items' => $items,
            'coupons' => array_values(array_map('sanitize_text_field', WC()->cart->get_applied_coupons())),
            'totals' => [
                'subtotal_raw' => $subtotal_raw,
                'shipping_raw' => $shipping_raw,
                'discount_raw' => $discount_raw,
                'total_raw' => $total_raw,
                'subtotal_html' => wp_strip_all_tags(wc_price($subtotal_raw)),
                'shipping_html' => $shipping_raw > 0 ? wp_strip_all_tags(wc_price($shipping_raw)) : 'Grátis',
                'discount_html' => $discount_raw > 0 ? '- ' . wp_strip_all_tags(wc_price($discount_raw)) : wp_strip_all_tags(wc_price(0)),
                'total_html' => wp_strip_all_tags(wc_price($total_raw)),
            ],
            'free_shipping_threshold_raw' => $threshold,
            'free_shipping_remaining_raw' => $remaining,
            'free_shipping_progress' => $progress,
            'free_shipping_message' => sanitize_text_field($free_shipping_message),
            'notices_html' => wp_kses_post($notices_html),
        ];
    }

    private static function get_free_shipping_threshold()
    {
        if (! class_exists('WC_Shipping_Zones')) {
            return 0;
        }

        $threshold = 0;
        $zones = WC_Shipping_Zones::get_zones();
        foreach ($zones as $zone) {
            $methods = isset($zone['shipping_methods']) && is_array($zone['shipping_methods']) ? $zone['shipping_methods'] : [];
            foreach ($methods as $method) {
                if (! $method instanceof WC_Shipping_Method || $method->id !== 'free_shipping' || $method->enabled !== 'yes') {
                    continue;
                }
                $min_amount = isset($method->min_amount) ? (float) $method->min_amount : 0;
                if ($min_amount > 0 && ($threshold <= 0 || $min_amount < $threshold)) {
                    $threshold = $min_amount;
                }
            }
        }

        return $threshold;
    }

    private static function debug_cart_context($action)
    {
        if (! defined('WP_DEBUG') || ! WP_DEBUG || ! class_exists('ROP_Logger') || ! method_exists('ROP_Logger', 'info')) {
            return;
        }

        $cookie_key = '';
        foreach (array_keys($_COOKIE) as $cookie_name) {
            if (strpos((string) $cookie_name, 'wp_woocommerce_session_') === 0) {
                $cookie_key = sanitize_text_field((string) $cookie_name);
                break;
            }
        }

        ROP_Logger::info('cart_debug', [
            'action' => sanitize_text_field((string) $action),
            'session_id' => function_exists('WC') && WC()->session && method_exists(WC()->session, 'get_customer_id') ? WC()->session->get_customer_id() : '',
            'cart_count' => function_exists('WC') && WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0,
            'session_cookie_key' => $cookie_key,
        ]);
    }

    private static function ensure_cart_loaded()
    {
        if (! function_exists('WC')) {
            return;
        }

        if (function_exists('wc_load_cart')) {
            wc_load_cart();
        }

        if (null === WC()->session && method_exists(WC(), 'initialize_session')) {
            WC()->initialize_session();
        }

        if (null === WC()->customer && method_exists(WC(), 'initialize_customer')) {
            WC()->initialize_customer(get_current_user_id(), true);
        }

        if (null === WC()->cart && method_exists(WC(), 'initialize_cart')) {
            WC()->initialize_cart();
        }

        if (null === WC()->cart && function_exists('wc_load_cart')) {
            wc_load_cart();
        }

        if (WC()->cart && method_exists(WC()->cart, 'get_cart')) {
            WC()->cart->get_cart();
        }
    }
}
