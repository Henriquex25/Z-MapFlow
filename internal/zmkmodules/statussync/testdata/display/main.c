/* SPDX-License-Identifier: MIT */
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/display.h>
#include <zephyr/init.h>
#include <lvgl.h>
#include <zmapflow/status.h>
#include <stdio.h>
#include <string.h>

#define CHECK(condition) do { if (!(condition)) { \
    printf("SCREEN_FAILED: line %d: %s\n", __LINE__, #condition); return 1; \
} } while (0)

lv_obj_t *zmk_display_status_screen(void);
void zms_screen_smoke_update(void);
static struct zms_snapshot snapshot;
struct zms_snapshot zms_get_snapshot(void) { return snapshot; }
static int set_mono(void) {
    return display_set_pixel_format(DEVICE_DT_GET(DT_CHOSEN(zephyr_display)), PIXEL_FORMAT_MONO10);
}
SYS_INIT(set_mono, APPLICATION, 0);

int main(void) {
    printf("POOL=%d DISPLAY_READY=%d\n", CONFIG_LV_Z_MEM_POOL_SIZE, lv_display_get_default() != NULL);
    lv_display_t *display = lv_display_get_default();
    lv_theme_t *theme = lv_theme_mono_init(display, false, CONFIG_LV_FONT_DEFAULT,
                                          &lv_font_montserrat_12, CONFIG_LV_FONT_DEFAULT);
    lv_display_set_theme(display, theme);
    /* Compare to a plain screen, just as ZMK's built-in screen is created. */
    lv_obj_t *reference = lv_obj_create(NULL);
    lv_color_t background = lv_obj_get_style_bg_color(reference, LV_PART_MAIN);
    lv_color_t foreground = lv_obj_get_style_text_color(reference, LV_PART_MAIN);
    lv_obj_delete(reference);
    lv_obj_t *screen = zmk_display_status_screen();
    if (!screen) {
        puts("SCREEN_UNAVAILABLE");
        return 1;
    }
    lv_screen_load(screen);
    lv_timer_handler();
    lv_obj_t *layer = lv_obj_get_child(screen, 0);
    lv_obj_t *output = lv_obj_get_child(screen, 1);
    lv_obj_t *battery = lv_obj_get_child(screen, 2);
    CHECK(lv_color_eq(lv_obj_get_style_bg_color(screen, 0), background));
    CHECK(lv_color_eq(lv_obj_get_style_text_color(screen, 0), foreground));
    CHECK(lv_obj_get_style_text_font(output, 0) == &lv_font_montserrat_16);
    CHECK(lv_obj_get_style_text_font(battery, 0) == &lv_font_montserrat_16);
    CHECK(lv_obj_get_style_text_font(layer, 0) == &lv_font_montserrat_12);
    CHECK(strcmp(lv_label_get_text(layer), "Waiting for dongle") == 0);
    CHECK(strcmp(lv_label_get_text(battery), "85%") == 0);
    snapshot.valid = true;
    snapshot.packet = (struct zms_packet){.version=ZMS_VERSION, .profile=1, .output=ZMS_OUTPUT_USB};
    for (int i = 0; i < 100; i++) {
        snapshot.packet.layer = i % 32;
        zms_copy_name(snapshot.packet.name, i % 2 ? "NAV LEFT" : "LONG_LAYER_NAME");
        zms_screen_smoke_update();
        lv_timer_handler();
        k_msleep(10);
    }
    CHECK(strcmp(lv_label_get_text(output), LV_SYMBOL_USB) == 0);
    CHECK(lv_obj_get_y(output) == 0 && lv_obj_get_y(battery) == 0);
    CHECK(lv_obj_get_x(battery) + lv_obj_get_width(battery) <= 128);
    CHECK(lv_obj_get_x(output) + lv_obj_get_width(output) < lv_obj_get_x(battery));
    CHECK(lv_obj_get_y(layer) >= 16 && lv_obj_get_y(layer) + lv_obj_get_height(layer) <= 32);
    snapshot.packet.output = ZMS_OUTPUT_BLE;
    snapshot.packet.flags = ZMS_PROFILE_BONDED | ZMS_PROFILE_CONNECTED;
    zms_screen_smoke_update();
    CHECK(strcmp(lv_label_get_text(output), LV_SYMBOL_WIFI " 2 " LV_SYMBOL_OK) == 0);
    snapshot.packet.output = ZMS_OUTPUT_NONE;
    zms_screen_smoke_update();
    CHECK(strcmp(lv_label_get_text(output), LV_SYMBOL_WIFI " 2 " LV_SYMBOL_CLOSE) == 0);
    snapshot.packet.flags = 0;
    zms_screen_smoke_update();
    CHECK(strcmp(lv_label_get_text(output), LV_SYMBOL_WIFI " 2 " LV_SYMBOL_SETTINGS) == 0);
    snapshot.packet.name[0] = '\0';
    zms_screen_smoke_update();
    CHECK(strcmp(lv_label_get_text(layer), LV_SYMBOL_KEYBOARD " 3") == 0);
    snapshot.valid = false;
    zms_screen_smoke_update();
    lv_timer_handler();
    CHECK(strcmp(lv_label_get_text(layer), "Waiting for dongle") == 0);
    /* An explicit inversion must still follow the same native theme. */
    theme = lv_theme_mono_init(display, true, CONFIG_LV_FONT_DEFAULT,
                               &lv_font_montserrat_12, CONFIG_LV_FONT_DEFAULT);
    lv_display_set_theme(display, theme);
    lv_obj_report_style_change(NULL);
    CHECK(!lv_color_eq(lv_obj_get_style_bg_color(screen, 0), background));
    puts("SCREEN_OK: native theme/inversion, fonts, symbols, layout, 100 updates and stale state");
    for (;;) k_sleep(K_SECONDS(1));
    return 0;
}
