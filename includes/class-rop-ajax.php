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

        add_action('wp_ajax_rop_get_product', [self::class, 'get_product']);
        add_action('wp_ajax_nopriv_rop_get_product', [self::class, 'get_product']);
        add_action('wp_ajax_rop_add_to_cart', [self::class, 'add_to_cart']);
        add_action('wp_ajax_nopriv_rop_add_to_cart', [self::class, 'add_to_cart']);
        add_action('wp_ajax_rop_get_cart_summary', [self::class, 'get_cart_summary']);
        add_action('wp_ajax_nopriv_rop_get_cart_summary', [self::class, 'get_cart_summary']);
        add_action('wp_ajax_rop_cart_get', [self::class, 'cart_get']);
        add_action('wp_ajax_nopriv_rop_cart_get', [self::class, 'cart_get']);
        add_action('wp_ajax_rop_cart_set_qty', [self::class, 'cart_set_qty']);
        add_action('wp_ajax_nopriv_rop_cart_set_qty', [self::class, 'cart_set_qty']);
        add_action('wp_ajax_rop_cart_remove', [self::class, 'cart_remove']);
        add_action('wp_ajax_nopriv_rop_cart_remove', [self::class, 'cart_remove']);
        add_action('wp_ajax_rop_cart_apply_coupon', [self::class, 'cart_apply_coupon']);
        add_action('wp_ajax_nopriv_rop_cart_apply_coupon', [self::class, 'cart_apply_coupon']);
        add_action('wp_ajax_rop_cart_summary', [self::class, 'cart_summary']);
        add_action('wp_ajax_nopriv_rop_cart_summary', [self::class, 'cart_summary']);
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
            if ($price_tier === '$') {
                $args['meta_query'] = [[
                    'key' => '_price',
                    'value' => [0, 25],
                    'compare' => 'BETWEEN',
                    'type' => 'NUMERIC',
                ]];
            } elseif ($price_tier === '$$') {
                $args['meta_query'] = [[
                    'key' => '_price',
                    'value' => [25, 50],
                    'compare' => 'BETWEEN',
                    'type' => 'NUMERIC',
                ]];
            } else {
                $args['meta_query'] = [[
                    'key' => '_price',
                    'value' => 50,
                    'compare' => '>=',
                    'type' => 'NUMERIC',
                ]];
            }
        }

        $cache_key = '';

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

        if ($page === 1 && $cache_key !== '') {
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

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_success([
                'items' => [],
                'count' => 0,
                'subtotal_html' => 'R$ 0,00',
                'shipping_html' => '—',
                'total_html' => 'R$ 0,00',
                'coupon' => '',
            ]);
        }

        $items = [];
        foreach (WC()->cart->get_cart() as $cart_item_key => $item) {
            $product = isset($item['data']) && $item['data'] instanceof WC_Product ? $item['data'] : null;
            if (! $product) {
                continue;
            }

            $image = $product->get_image_id() ? wp_get_attachment_image_url($product->get_image_id(), 'woocommerce_thumbnail') : '';
            if (! $image) {
                $image = wc_placeholder_img_src('woocommerce_thumbnail');
            }

            $extras = $item['rop_extras'] ?? ($item['rop_barn2_raw'] ?? []);
            $extras_list = [];
            if (is_array($extras)) {
                foreach ($extras as $value) {
                    if (is_array($value)) {
                        foreach ($value as $nested) {
                            $txt = sanitize_text_field((string) $nested);
                            if ($txt !== '') {
                                $extras_list[] = $txt;
                            }
                        }
                    } else {
                        $txt = sanitize_text_field((string) $value);
                        if ($txt !== '') {
                            $extras_list[] = $txt;
                        }
                    }
                }
            }

            $line_total = isset($item['line_total']) ? (float) $item['line_total'] : (float) $product->get_price() * (int) ($item['quantity'] ?? 1);

            $items[] = [
                'cart_item_key' => sanitize_text_field($cart_item_key),
                'product_id' => (int) ($item['product_id'] ?? 0),
                'name' => sanitize_text_field($product->get_name()),
                'qty' => max(1, (int) ($item['quantity'] ?? 1)),
                'image' => esc_url_raw($image),
                'price_html' => wp_strip_all_tags(wc_price((float) $product->get_price())),
                'line_total_html' => wp_strip_all_tags(wc_price($line_total)),
                'extras_text' => implode(', ', array_values(array_unique($extras_list))),
            ];
        }

        $coupon = '';
        $applied = WC()->cart->get_applied_coupons();
        if (! empty($applied)) {
            $coupon = sanitize_text_field((string) $applied[0]);
        }

        wp_send_json_success([
            'items' => $items,
            'count' => (int) WC()->cart->get_cart_contents_count(),
            'subtotal_html' => wp_strip_all_tags(wc_price((float) WC()->cart->get_subtotal())),
            'shipping_html' => wp_strip_all_tags(WC()->cart->get_cart_shipping_total() ?: 'Grátis'),
            'total_html' => wp_strip_all_tags(WC()->cart->get_total()),
            'coupon' => $coupon,
        ]);
    }

    public static function cart_set_qty()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $key = sanitize_text_field(wp_unslash($_POST['cart_item_key'] ?? ''));
        $qty = max(0, absint($_POST['qty'] ?? 1));

        if ($key === '') {
            wp_send_json_error(['message' => 'Item inválido.'], 400);
        }

        if ($qty === 0) {
            WC()->cart->remove_cart_item($key);
        } else {
            WC()->cart->set_quantity($key, $qty, true);
        }

        self::cart_get();
    }

    public static function cart_remove()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $key = sanitize_text_field(wp_unslash($_POST['cart_item_key'] ?? ''));
        if ($key === '') {
            wp_send_json_error(['message' => 'Item inválido.'], 400);
        }

        WC()->cart->remove_cart_item($key);
        self::cart_get();
    }

    public static function cart_apply_coupon()
    {
        check_ajax_referer('rop_ajax', 'nonce');
        self::ensure_cart_loaded();

        if (! function_exists('WC') || ! WC()->cart) {
            wp_send_json_error(['message' => 'Carrinho indisponível.'], 500);
        }

        $code = sanitize_text_field(wp_unslash($_POST['code'] ?? ''));
        if ($code === '') {
            wp_send_json_error(['message' => 'Informe um cupom.'], 400);
        }

        $ok = WC()->cart->apply_coupon($code);
        if (! $ok) {
            wp_send_json_error(['message' => 'Cupom inválido.'], 400);
        }

        self::cart_get();
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

    private static function ensure_cart_loaded()
    {
        if (function_exists('WC')) {
            if (null === WC()->session && method_exists(WC(), 'initialize_session')) {
                WC()->initialize_session();
            }
            if (null === WC()->cart) {
                wc_load_cart();
            }
        }
    }
}
