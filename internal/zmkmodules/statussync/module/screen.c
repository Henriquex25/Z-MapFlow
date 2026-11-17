/* SPDX-License-Identifier: MIT
 * Receiver screen updates run on ZMK's display queue, never in Bluetooth RX.
 */
#include <zephyr/kernel.h>
#include <lvgl.h>
#include <zmk/display.h>
#include <zmk/battery.h>
#include <zmk/events/battery_state_changed.h>
#include <zmapflow/status.h>
#include <stdio.h>

static lv_obj_t *layer_label, *output_label, *battery_label;
struct screen_state { struct zms_snapshot remote; int battery; };
static struct screen_state get_state(const zmk_event_t *eh) {
    struct screen_state state = {.remote=zms_get_snapshot(), .battery=-1};
#if IS_ENABLED(CONFIG_ZMK_BATTERY_REPORTING)
    state.battery = zmk_battery_state_of_charge();
#endif
    return state;
}
static void render(struct screen_state state) {
    if (!layer_label || !output_label) return;
    char layer[40], battery[8], route[20];
    const struct zms_packet *p = &state.remote.packet;
    if (!state.remote.valid) {
        snprintf(layer, sizeof(layer), "Waiting for dongle");
        snprintf(route, sizeof(route), "No sync");
    } else {
        snprintf(layer, sizeof(layer), "%u: %s", p->layer, p->name);
        if (p->output == ZMS_OUTPUT_USB) snprintf(route,sizeof(route),"USB / B%u", p->profile+1);
        else if (p->output == ZMS_OUTPUT_BLE) snprintf(route,sizeof(route),"BT %u online", p->profile+1);
        else snprintf(route,sizeof(route),"BT %u offline", p->profile+1);
    }
    if (state.battery >= 0) snprintf(battery,sizeof(battery),"%d%%",state.battery);
    else snprintf(battery,sizeof(battery),"--");
    lv_label_set_text(layer_label,layer);
    lv_label_set_text(output_label,route);
    lv_label_set_text(battery_label,battery);
}
ZMK_DISPLAY_WIDGET_LISTENER(zms_screen, struct screen_state, render, get_state)
ZMK_SUBSCRIPTION(zms_screen, zms_status_changed);
#if IS_ENABLED(CONFIG_ZMK_BATTERY_REPORTING)
ZMK_SUBSCRIPTION(zms_screen, zmk_battery_state_changed);
#endif

lv_obj_t *zmk_display_status_screen(void) {
    lv_obj_t *root = lv_obj_create(NULL);
    lv_obj_set_style_pad_all(root,0,0);
    lv_obj_set_style_bg_color(root,lv_color_black(),0);
    lv_obj_set_style_bg_opa(root,LV_OPA_COVER,0);
    lv_obj_set_style_text_color(root,lv_color_white(),0);
    lv_obj_set_style_border_width(root,0,0);
    layer_label = lv_label_create(root);
    output_label = lv_label_create(root);
    battery_label = lv_label_create(root);
    lv_obj_set_width(layer_label,lv_pct(100));
    lv_obj_set_width(output_label,lv_pct(75));
    lv_label_set_long_mode(layer_label,LV_LABEL_LONG_MODE_CLIP);
    lv_label_set_long_mode(output_label,LV_LABEL_LONG_MODE_CLIP);
    lv_obj_align(layer_label,LV_ALIGN_TOP_LEFT,0,0);
    lv_obj_align(output_label,LV_ALIGN_BOTTOM_LEFT,0,0);
    lv_obj_align(battery_label,LV_ALIGN_BOTTOM_RIGHT,0,0);
    zms_screen_init();
    return root;
}
