<?php

if (! defined('ABSPATH')) {
    exit;
}

class ROP_Ajax
{
    private const NONCE_ACTION = 'rop_nonce';

    public static function init(): void
    {
        $actions = [
            'rop_list_categories'   => 'list_categories',
            'rop_list_products'     => 'list_products',
            'rop_search_suggestions'=> 'search_suggestions',
            'rop_add_to_cart_simple'=> 'add_to_cart_simple',
        ];

        foreach ($actions as $action => $method) {
            add_action("wp_ajax_{$action}", [self::class, $method]);
            add_action("wp_ajax_nopriv_{$action}", [self::class, $method]);
        }
    }

    private static function verify_nonce(): void
    {
        $nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';

        if (! wp_verify_nonce($nonce, self::NONCE_ACTION)) {
            wp_send_json_error(['message' => __('Nonce inválido.', 'restaurant-ops-pro')], 403);
        }
    }

    public static function list_categories(): void
    {
        self::verify_nonce();

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_error(['message' => __('WooCommerce não está ativo.', 'restaurant-ops-pro')], 400);
        }

        $cache_key = 'rop_cats_v1';
        $categories = get_transient($cache_key);

        if (false === $categories) {
            $terms = get_terms([
                'taxonomy'   => 'product_cat',
                'hide_empty' => true,
                'orderby'    => 'name',
                'order'      => 'ASC',
                'number'     => 50,
            ]);

            $categories = [];

            if (! is_wp_error($terms)) {
                foreach ($terms as $term) {
                    $categories[] = [
                        'id'    => (int) $term->term_id,
                        'name'  => wp_strip_all_tags((string) $term->name),
                        'slug'  => sanitize_title((string) $term->slug),
                        'count' => (int) $term->count,
                    ];
                }
            }

            set_transient($cache_key, $categories, 10 * MINUTE_IN_SECONDS);
        }

        wp_send_json_success(['categories' => $categories]);
    }

    public static function list_products(): void
    {
        self::verify_nonce();

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_error(['message' => __('WooCommerce não está ativo.', 'restaurant-ops-pro')], 400);
        }

        $page = isset($_POST['page']) ? max(1, absint($_POST['page'])) : 1;
        $per_page = isset($_POST['per_page']) ? absint($_POST['per_page']) : 10;
        $per_page = max(1, min(20, $per_page));

        $category = isset($_POST['category']) ? sanitize_title(wp_unslash($_POST['category'])) : '';
        $search = isset($_POST['q']) ? sanitize_text_field(wp_unslash($_POST['q'])) : '';
        $orderby = isset($_POST['orderby']) ? sanitize_key(wp_unslash($_POST['orderby'])) : 'recommended';
        $on_sale = isset($_POST['on_sale']) ? absint($_POST['on_sale']) : 0;
        $price_tier = isset($_POST['price_tier']) ? sanitize_text_field(wp_unslash($_POST['price_tier'])) : '';

        $cache_key = '';
        if (1 === $page) {
            $cache_payload = [
                'per_page' => $per_page,
                'category' => $category,
                'q'        => $search,
                'orderby'  => $orderby,
                'on_sale'  => $on_sale,
                'price_tier' => $price_tier,
            ];
            $cache_key = 'rop_products_v1_' . md5(wp_json_encode($cache_payload));
            $cached = get_transient($cache_key);
            if (false !== $cached && is_array($cached)) {
                wp_send_json_success($cached);
            }
        }

        $args = [
            'status'     => 'publish',
            'limit'      => $per_page,
            'paginate'   => true,
            'page'       => $page,
            'return'     => 'objects',
            'visibility' => 'visible',
            'orderby'    => 'menu_order title',
            'order'      => 'ASC',
        ];

        if ('' !== $search) {
            $args['s'] = $search;
        }

        if ('' !== $category) {
            $args['category'] = [$category];
        }

        if (1 === $on_sale) {
            $args['on_sale'] = true;
        }

        switch ($price_tier) {
            case '$':
                $args['min_price'] = 0;
                $args['max_price'] = 25;
                break;
            case '$$':
                $args['min_price'] = 25;
                $args['max_price'] = 50;
                break;
            case '$$$':
                $args['min_price'] = 50;
                break;
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
                $args['orderby'] = 'menu_order date';
                $args['order'] = 'DESC';
                break;
        }

        $query = new WC_Product_Query($args);
        $result = $query->get_products();

        $products = [];
        $items = is_object($result) && isset($result->products) ? $result->products : [];
        $total_pages = is_object($result) && isset($result->max_num_pages) ? (int) $result->max_num_pages : 1;

        foreach ($items as $product) {
            if (! $product instanceof WC_Product) {
                continue;
            }
            $products[] = ROP_Woo::get_product_card_data($product);
        }

        $payload = [
            'products' => $products,
            'page'     => $page,
            'has_more' => $page < $total_pages,
        ];

        if ($cache_key) {
            set_transient($cache_key, $payload, 2 * MINUTE_IN_SECONDS);
        }

        wp_send_json_success($payload);
    }

    public static function search_suggestions(): void
    {
        self::verify_nonce();

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_error(['message' => __('WooCommerce não está ativo.', 'restaurant-ops-pro')], 400);
        }

        $search = isset($_POST['q']) ? sanitize_text_field(wp_unslash($_POST['q'])) : '';
        if (mb_strlen($search) < 2) {
            wp_send_json_success(['suggestions' => []]);
        }

        $cache_key = 'rop_suggest_v1_' . md5($search);
        $suggestions = get_transient($cache_key);

        if (false === $suggestions) {
            $query = new WP_Query([
                'post_type'              => 'product',
                'post_status'            => 'publish',
                'posts_per_page'         => 8,
                's'                      => $search,
                'fields'                 => 'ids',
                'ignore_sticky_posts'    => true,
                'no_found_rows'          => true,
                'update_post_meta_cache' => false,
                'update_post_term_cache' => false,
            ]);

            $suggestions = [];
            foreach ($query->posts as $product_id) {
                $suggestions[] = [
                    'id'   => (int) $product_id,
                    'name' => wp_strip_all_tags(get_the_title($product_id)),
                ];
            }

            set_transient($cache_key, $suggestions, MINUTE_IN_SECONDS);
        }

        wp_send_json_success(['suggestions' => $suggestions]);
    }

    public static function add_to_cart_simple(): void
    {
        self::verify_nonce();

        if (! ROP_Woo::is_woo_active()) {
            wp_send_json_error(['message' => __('WooCommerce não está ativo.', 'restaurant-ops-pro')], 400);
        }

        ROP_Woo::maybe_boot_cart();

        $product_id = isset($_POST['product_id']) ? absint($_POST['product_id']) : 0;
        $qty = isset($_POST['qty']) ? max(1, absint($_POST['qty'])) : 1;

        $product = wc_get_product($product_id);
        if (! $product instanceof WC_Product) {
            wp_send_json_error(['message' => __('Produto inválido.', 'restaurant-ops-pro')], 404);
        }

        if (! $product->is_type('simple')) {
            wp_send_json_error(['message' => __('Produto não é simples.', 'restaurant-ops-pro')], 400);
        }

        if (! $product->is_purchasable() || ! $product->is_in_stock()) {
            wp_send_json_error(['message' => __('Produto indisponível.', 'restaurant-ops-pro')], 400);
        }

        $cart_item_key = WC()->cart ? WC()->cart->add_to_cart($product_id, $qty) : false;

        if (! $cart_item_key) {
            wp_send_json_error(['message' => __('Não foi possível adicionar ao carrinho.', 'restaurant-ops-pro')], 400);
        }

        wp_send_json_success([
            'cart_count' => WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0,
            'message'    => __('Produto adicionado ao carrinho.', 'restaurant-ops-pro'),
        ]);
    }
}
