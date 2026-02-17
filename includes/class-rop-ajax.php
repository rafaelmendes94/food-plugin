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

        add_action('wp_ajax_rop_list_categories', [self::class, 'list_categories']);
        add_action('wp_ajax_nopriv_rop_list_categories', [self::class, 'list_categories']);
        add_action('wp_ajax_rop_list_products', [self::class, 'list_products']);
        add_action('wp_ajax_nopriv_rop_list_products', [self::class, 'list_products']);
        add_action('wp_ajax_rop_search_suggestions', [self::class, 'search_suggestions']);
        add_action('wp_ajax_nopriv_rop_search_suggestions', [self::class, 'search_suggestions']);
        add_action('wp_ajax_rop_add_to_cart_simple', [self::class, 'add_to_cart_simple']);
        add_action('wp_ajax_nopriv_rop_add_to_cart_simple', [self::class, 'add_to_cart_simple']);
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
        $category = sanitize_title(wp_unslash($_POST['category'] ?? ''));
        $search = sanitize_text_field(wp_unslash($_POST['q'] ?? ''));
        $orderby = sanitize_key(wp_unslash($_POST['orderby'] ?? 'recommended'));
        $on_sale = isset($_POST['on_sale']) ? absint($_POST['on_sale']) : 0;
        $price_tier = sanitize_text_field(wp_unslash($_POST['price_tier'] ?? ''));

        $args = [
            'status' => 'publish',
            'limit' => $per_page,
            'page' => $page,
            'paginate' => true,
            'return' => 'objects',
            'catalog_visibility' => 'visible',
        ];

        if ($category) {
            $args['category'] = [$category];
        }

        if ($search !== '') {
            $args['s'] = $search;
        }

        if ($on_sale === 1) {
            $args['on_sale'] = true;
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
            case 'newest':
                $args['orderby'] = 'date';
                $args['order'] = 'DESC';
                break;
            case 'recommended':
            default:
                $args['orderby'] = 'menu_order';
                $args['order'] = 'ASC';
                break;
        }

        if (in_array($price_tier, ['$', '$$', '$$$'], true)) {
            $meta_query = [];

            if ($price_tier === '$') {
                $meta_query[] = [
                    'key' => '_price',
                    'value' => [0, 25],
                    'compare' => 'BETWEEN',
                    'type' => 'NUMERIC',
                ];
            } elseif ($price_tier === '$$') {
                $meta_query[] = [
                    'key' => '_price',
                    'value' => [25, 50],
                    'compare' => 'BETWEEN',
                    'type' => 'NUMERIC',
                ];
            } else {
                $meta_query[] = [
                    'key' => '_price',
                    'value' => 50,
                    'compare' => '>=',
                    'type' => 'NUMERIC',
                ];
            }

            $args['meta_query'] = $meta_query;
        }

        if ($page === 1) {
            $cache_key = 'rop_products_v1_' . md5(wp_json_encode($args));
            $cached = get_transient($cache_key);

            if (is_array($cached)) {
                wp_send_json_success($cached);
            }
        }

        $query = new WC_Product_Query($args);
        $result = $query->get_products();

        $products = [];
        $items = [];
        $max_pages = 1;

        if (is_object($result) && isset($result->products, $result->max_num_pages)) {
            $items = is_array($result->products) ? $result->products : [];
            $max_pages = max(1, (int) $result->max_num_pages);
        } elseif (is_array($result)) {
            $items = $result;
            $max_pages = count($items) < $per_page ? $page : $page + 1;
        }

        foreach ($items as $product) {
            $card = ROP_Woo::get_product_card_data($product);
            if (! empty($card)) {
                $products[] = $card;
            }
        }

        $payload = [
            'products' => $products,
            'page' => $page,
            'has_more' => $page < $max_pages,
        ];

        if ($page === 1) {
            set_transient($cache_key, $payload, 2 * MINUTE_IN_SECONDS);
        }

        wp_send_json_success($payload);
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

    public static function add_to_cart_simple()
    {
        check_ajax_referer('rop_ajax', 'nonce');

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_error(['message' => 'WooCommerce não está ativo.'], 400);
        }

        $product_id = absint($_POST['product_id'] ?? 0);
        $qty = max(1, absint($_POST['qty'] ?? 1));

        if (! $product_id) {
            wp_send_json_error(['message' => 'Produto inválido.'], 400);
        }

        $product = wc_get_product($product_id);

        if (! $product) {
            wp_send_json_error(['message' => 'Produto não encontrado.'], 404);
        }

        if (! $product->is_type('simple')) {
            wp_send_json_error(['message' => 'Produto não é simples.'], 400);
        }

        if (! $product->is_purchasable() || ! $product->is_in_stock()) {
            wp_send_json_error(['message' => 'Produto indisponível.'], 400);
        }

        if (function_exists('WC')) {
            if (null === WC()->session && method_exists(WC(), 'initialize_session')) {
                WC()->initialize_session();
            }

            if (null === WC()->cart) {
                wc_load_cart();
            }
        }

        $added = WC()->cart ? WC()->cart->add_to_cart($product_id, $qty) : false;

        if (! $added) {
            wp_send_json_error(['message' => 'Não foi possível adicionar ao carrinho.'], 400);
        }

        wp_send_json_success([
            'message' => 'Adicionado ao carrinho.',
            'cart_count' => (int) WC()->cart->get_cart_contents_count(),
        ]);
    }
}
