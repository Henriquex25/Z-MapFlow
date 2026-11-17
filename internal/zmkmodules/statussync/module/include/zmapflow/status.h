/* SPDX-License-Identifier: MIT */
#pragma once
#include <zmapflow/protocol.h>
#include <zmk/event_manager.h>
#include <zephyr/bluetooth/uuid.h>
#define ZMS_SERVICE_UUID BT_UUID_128_ENCODE(0x84aa3521, 0x2e8a, 0x47f3, 0xaa70, 0x26a7d40fcb11)
#define ZMS_CHAR_UUID BT_UUID_128_ENCODE(0x84aa3522, 0x2e8a, 0x47f3, 0xaa70, 0x26a7d40fcb11)
struct zms_status_changed { bool valid; };
ZMK_EVENT_DECLARE(zms_status_changed);
struct zms_snapshot { struct zms_packet packet; bool valid; };
struct zms_snapshot zms_get_snapshot(void);
