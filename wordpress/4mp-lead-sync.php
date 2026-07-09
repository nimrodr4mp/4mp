<?php
/**
 * Plugin Name: 4MP Lead Sync
 * Description: Forwards every Elementor Pro form submission to the 4MP CRM webhook.
 * Version: 1.0.0
 *
 * INSTALL (pick one):
 *   A) Upload this file to wp-content/mu-plugins/ (create the folder if missing) — auto-active.
 *   B) Or zip it and install via Plugins → Add New → Upload Plugin, then Activate.
 *   C) Or paste the body (without the <?php header) into a WPCode / Code Snippets "PHP snippet".
 *
 * Then set the two constants below to match your Vercel deployment.
 */

if (!defined('ABSPATH')) exit;

// ── CONFIG ───────────────────────────────────────────────────────────────────
define('FOURMP_WEBHOOK_URL', 'https://4mp.vercel.app/api/lead-webhook');
define('FOURMP_WEBHOOK_SECRET', 'PASTE_THE_SAME_SECRET_AS_IN_VERCEL');
// ─────────────────────────────────────────────────────────────────────────────

add_action('elementor_pro/forms/new_record', function ($record, $handler) {
    if (!FOURMP_WEBHOOK_SECRET || FOURMP_WEBHOOK_SECRET === 'PASTE_THE_SAME_SECRET_AS_IN_VERCEL') {
        return; // not configured yet
    }

    $raw_fields = $record->get('fields');
    $fields = array();
    foreach ($raw_fields as $field) {
        // Key by human label so the CRM can map them (name/phone/email/city…).
        $label = isset($field['title']) && $field['title'] !== '' ? $field['title'] : $field['id'];
        $fields[$label] = $field['value'];
    }

    $form_settings = $record->get('form_settings');
    $form_name = isset($form_settings['form_name']) ? $form_settings['form_name'] : '';

    $referer = wp_get_referer();
    $page_url = $referer ? $referer : (isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '');

    $payload = array(
        'secret'    => FOURMP_WEBHOOK_SECRET,
        'form_name' => $form_name,
        'page_url'  => $page_url,
        'fields'    => $fields,
    );

    // Fire-and-forget so we never slow down / block the visitor's form submit.
    wp_remote_post(FOURMP_WEBHOOK_URL, array(
        'timeout'   => 8,
        'blocking'  => false,
        'headers'   => array('Content-Type' => 'application/json; charset=utf-8'),
        'body'      => wp_json_encode($payload),
    ));
}, 10, 2);
