<?php
/**
 * Customizer: کنترل‌ها از روی schema.json ساخته می‌شوند و در همان گزینه‌ی bazar_settings
 * ذخیره می‌شوند؛ پس اپ و پیشخوان وردپرس همیشه هماهنگ‌اند.
 * فیلدهای تصویری و دارای "store" (نام سایت، لوگو، آیکن) را خود وردپرس مدیریت می‌کند.
 */
if (!defined('ABSPATH')) exit;

add_action('customize_register', 'bazar_customize_register');

function bazar_customize_register($wp_customize) {
  $schema = bazar_schema();
  $labels = array();
  foreach ($schema['groups'] as $g) $labels[$g['id']] = $g['label'];

  $made = array();
  foreach ($schema['fields'] as $f) {
    $type = isset($f['type']) ? $f['type'] : 'text';
    $skip = array('image', 'sections', 'benefits');
    if (!empty($f['store']) || in_array($type, $skip, true)) continue;

    $gid = $f['group'];
    $sec = 'bazar_' . $gid;
    if (!isset($made[$sec])) {
      $wp_customize->add_section($sec, array(
        'title'    => 'بازار: ' . (isset($labels[$gid]) ? $labels[$gid] : $gid),
        'priority' => 30,
      ));
      $made[$sec] = true;
    }

    $id = 'bazar_settings[' . $f['key'] . ']';
    $wp_customize->add_setting($id, array(
      'type'              => 'option',
      'default'           => bazar_default_of($f),
      'sanitize_callback' => function ($v) use ($f) { return bazar_clean($f, $v); },
    ));

    $args = array('label' => $f['label'], 'section' => $sec, 'settings' => $id);
    if (!empty($f['help'])) $args['description'] = $f['help'];

    if ($type === 'color') {
      $wp_customize->add_control(new WP_Customize_Color_Control($wp_customize, $id, $args));
      continue;
    }
    if ($type === 'toggle')   $args['type'] = 'checkbox';
    elseif ($type === 'textarea') $args['type'] = 'textarea';
    elseif ($type === 'number') {
      $args['type'] = 'number';
      $args['input_attrs'] = array('min' => isset($f['min']) ? $f['min'] : 0, 'max' => isset($f['max']) ? $f['max'] : 100, 'step' => isset($f['step']) ? $f['step'] : 1);
    } elseif ($type === 'select') {
      $args['type'] = 'select';
      $choices = array();
      foreach ($f['options'] as $o) $choices[(string) $o[0]] = $o[1];
      $args['choices'] = $choices;
    } else {
      $args['type'] = 'text';
    }
    $wp_customize->add_control($id, $args);
  }
}
