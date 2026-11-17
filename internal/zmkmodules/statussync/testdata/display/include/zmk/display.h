/* SPDX-License-Identifier: MIT
 * Only the ZMK event dispatcher is simulated. LVGL/Zephyr and screen.c are real.
 */
typedef void zmk_event_t;
#define ZMK_DISPLAY_WIDGET_LISTENER(name, type, update, state) \
    void name##_smoke_update(void) { update(state(NULL)); } \
    static void name##_init(void) { name##_smoke_update(); }
#define ZMK_SUBSCRIPTION(...)
