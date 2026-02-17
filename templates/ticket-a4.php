<?php

if (! defined('ABSPATH')) {
    exit;
}

if (! function_exists('rop_ticket_render_extras_html')) {
    function rop_ticket_render_extras_html($item)
    {
        if (! function_exists('rop_ticket_collect_item_meta_lines')) {
            return '';
        }

        $lines = rop_ticket_collect_item_meta_lines($item);
        if (empty($lines)) {
            return '';
        }

        $html = '<ul class="rop-ticket-item-extras">';
        foreach ($lines as $line) {
            $html .= '<li>• ' . esc_html($line) . '</li>';
        }
        $html .= '</ul>';

        return $html;
    }
}
