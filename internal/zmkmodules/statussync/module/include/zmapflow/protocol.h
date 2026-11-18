/* SPDX-License-Identifier: MIT
 * Versioned, bounded display-only payload. Fits the minimum ATT MTU (23).
 * This header is also exercised by host C tests without Zephyr or a keyboard.
 */
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#define ZMS_VERSION 1
#define ZMS_NAME_LEN 15
#define ZMS_HEARTBEAT_MS 5000
#define ZMS_EXPIRE_MS 15000
#define ZMS_OUTPUT_NONE 0
#define ZMS_OUTPUT_USB 1
#define ZMS_OUTPUT_BLE 2
#define ZMS_PROFILE_CONNECTED 1
#define ZMS_PROFILE_BONDED 2

struct zms_packet {
    uint8_t version, layer, profile, output, flags;
    char name[ZMS_NAME_LEN];
};
_Static_assert(sizeof(struct zms_packet) == 20, "Status must fit minimum ATT MTU");

/* Return a complete valid UTF-8 codepoint's length, or zero. */
static inline size_t zms_utf8_size(const unsigned char *p, size_t len) {
    if (!len || !p[0]) return 0;
    if (p[0] < 0x80) return p[0] >= 0x20 ? 1 : 0;
    size_t n = p[0] >= 0xC2 && p[0] <= 0xDF ? 2 :
               p[0] >= 0xE0 && p[0] <= 0xEF ? 3 :
               p[0] >= 0xF0 && p[0] <= 0xF4 ? 4 : 0;
    if (!n || n > len) return 0;
    for (size_t i = 1; i < n; i++) if ((p[i] & 0xC0) != 0x80) return 0;
    if ((p[0] == 0xE0 && p[1] < 0xA0) || (p[0] == 0xED && p[1] >= 0xA0) ||
        (p[0] == 0xF0 && p[1] < 0x90) || (p[0] == 0xF4 && p[1] >= 0x90)) return 0;
    return n;
}

static inline void zms_copy_name(char dest[ZMS_NAME_LEN], const char *source) {
    memset(dest, 0, ZMS_NAME_LEN);
    if (!source) return;
    size_t used = 0;
    while (*source && used < ZMS_NAME_LEN - 1) {
        /* At most four bytes belong to a codepoint; stop at the source NUL. */
        size_t available = 0;
        while (available < 4 && source[available]) available++;
        size_t n = zms_utf8_size((const unsigned char *)source, available);
        if (!n) { dest[used++] = '?'; source++; continue; }
        if (used + n >= ZMS_NAME_LEN) break;
        memcpy(dest + used, source, n); used += n; source += n;
    }
}

static inline bool zms_packet_valid(const void *data, size_t len, size_t offset) {
    if (offset || !data || len != sizeof(struct zms_packet)) return false;
    const struct zms_packet *p = data;
    if (p->version != ZMS_VERSION || p->layer >= 32 || p->profile >= 5 ||
        p->output > ZMS_OUTPUT_BLE || (p->flags & ~(ZMS_PROFILE_CONNECTED | ZMS_PROFILE_BONDED))) return false;
    const char *end = memchr(p->name, 0, sizeof(p->name));
    if (!end) return false;
    size_t i = 0, bytes = (size_t)(end - p->name);
    while (i < bytes) {
        size_t n = zms_utf8_size((const unsigned char *)p->name + i, bytes - i);
        if (!n) return false;
        i += n;
    }
    return true;
}
