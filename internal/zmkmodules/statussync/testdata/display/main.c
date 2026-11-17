/* SPDX-License-Identifier: MIT */
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/display.h>
#include <zephyr/init.h>
#include <lvgl.h>
#include <zmapflow/status.h>
#include <stdio.h>

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
    lv_obj_t *screen = zmk_display_status_screen();
    if (!screen) {
        puts("SCREEN_UNAVAILABLE");
        return 1;
    }
    lv_screen_load(screen);
    lv_timer_handler();
    snapshot.valid = true;
    snapshot.packet = (struct zms_packet){.version=ZMS_VERSION, .profile=1, .output=ZMS_OUTPUT_USB};
    for (int i = 0; i < 100; i++) {
        snapshot.packet.layer = i % 32;
        zms_copy_name(snapshot.packet.name, i % 2 ? "NAV LEFT" : "LONG_LAYER_NAME");
        zms_screen_smoke_update();
        lv_timer_handler();
        k_msleep(10);
    }
    snapshot.valid = false;
    zms_screen_smoke_update();
    lv_timer_handler();
    puts("SCREEN_OK: waiting, state changes and stale state rendered");
    for (;;) k_sleep(K_SECONDS(1));
    return 0;
}
