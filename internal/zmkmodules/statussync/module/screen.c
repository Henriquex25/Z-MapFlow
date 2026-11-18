/* SPDX-License-Identifier: MIT
 * Receiver screen updates run on ZMK's display queue, never in Bluetooth RX.
 */
#include <zephyr/kernel.h>
#include <lvgl.h>
#include <zmk/display.h>
#include <zmk/battery.h>
#include <zmk/events/battery_state_changed.h>
#if IS_ENABLED(CONFIG_USB_DEVICE_STACK)
#include <zmk/usb.h>
#include <zmk/events/usb_conn_state_changed.h>
#endif
#include <zmapflow/status.h>
#include <stdio.h>

static lv_obj_t *layer_label, *output_label, *battery_label;
struct screen_state { struct zms_snapshot remote; int battery; bool usb_powered; };
static struct screen_state get_state(const zmk_event_t *eh) {
    struct screen_state state = {.remote=zms_get_snapshot(), .battery=-1};
#if IS_ENABLED(CONFIG_ZMK_BATTERY_REPORTING)
    state.battery = zmk_battery_state_of_charge();
#endif
#if IS_ENABLED(CONFIG_USB_DEVICE_STACK)
    state.usb_powered = zmk_usb_is_powered();
#endif
    return state;
}
static void render(struct screen_state state) {
    if (!layer_label || !output_label || !battery_label) return;
    char layer[48], battery[16], route[24];
    const struct zms_packet *p = &state.remote.packet;
    if (!state.remote.valid) {
        snprintf(layer, sizeof(layer), "Waiting for dongle");
        snprintf(route, sizeof(route), LV_SYMBOL_WIFI " " LV_SYMBOL_CLOSE);
    } else {
        if (p->name[0]) snprintf(layer, sizeof(layer), LV_SYMBOL_KEYBOARD " %s", p->name);
        else snprintf(layer, sizeof(layer), LV_SYMBOL_KEYBOARD " %u", p->layer);
        if (p->output == ZMS_OUTPUT_USB) snprintf(route, sizeof(route), LV_SYMBOL_USB);
        else snprintf(route, sizeof(route), LV_SYMBOL_WIFI " %u %s", p->profile+1,
                      !(p->flags & ZMS_PROFILE_BONDED) ? LV_SYMBOL_SETTINGS :
                      p->output == ZMS_OUTPUT_BLE ? LV_SYMBOL_OK : LV_SYMBOL_CLOSE);
    }
    const char *charge = state.usb_powered ? LV_SYMBOL_CHARGE " " : "";
    if (state.battery >= 0) snprintf(battery,sizeof(battery),"%s%d%%",charge,state.battery);
    else snprintf(battery,sizeof(battery),"%s--",charge);
    lv_label_set_text(layer_label,layer);
    lv_label_set_text(output_label,route);
    lv_label_set_text(battery_label,battery);
}
ZMK_DISPLAY_WIDGET_LISTENER(zms_screen, struct screen_state, render, get_state)
ZMK_SUBSCRIPTION(zms_screen, zms_status_changed);
#if IS_ENABLED(CONFIG_ZMK_BATTERY_REPORTING)
ZMK_SUBSCRIPTION(zms_screen, zmk_battery_state_changed);
#endif
#if IS_ENABLED(CONFIG_USB_DEVICE_STACK)
ZMK_SUBSCRIPTION(zms_screen, zmk_usb_conn_state_changed);
#endif

lv_obj_t *zmk_display_status_screen(void) {
    lv_obj_t *root = lv_obj_create(NULL);
    if (!root) return NULL;
    /* Inherit ZMK's monochrome theme, inversion and fonts exactly as its
     * built-in status screen does. Logical black/white need not match the
     * physical OLED's on/off pixels; forcing colors reverses some drivers. */
    layer_label = lv_label_create(root);
    output_label = lv_label_create(root);
    battery_label = lv_label_create(root);
    if (!layer_label || !output_label || !battery_label) {
        lv_obj_delete(root);
        layer_label = output_label = battery_label = NULL;
        return NULL;
    }
    lv_obj_set_width(layer_label,lv_pct(100));
    lv_obj_set_style_text_font(layer_label,lv_theme_get_font_small(root),LV_PART_MAIN);
    lv_label_set_long_mode(layer_label,LV_LABEL_LONG_MODE_SCROLL_CIRCULAR);
    lv_label_set_long_mode(output_label,LV_LABEL_LONG_MODE_CLIP);
    lv_obj_align(layer_label,LV_ALIGN_BOTTOM_LEFT,0,0);
    lv_obj_align(output_label,LV_ALIGN_TOP_LEFT,0,0);
    lv_obj_align(battery_label,LV_ALIGN_TOP_RIGHT,0,0);
    zms_screen_init();
    return root;
}
