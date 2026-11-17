/* SPDX-License-Identifier: MIT
 * Display-only state over the already paired/encrypted split BLE connections.
 * Discovery and bounded retries run on a dedicated low-priority queue, so they
 * cannot wait for ATT buffers on the keyboard's event or Bluetooth RX threads.
 */
#include <zephyr/kernel.h>
#include <zephyr/init.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gatt.h>
#include <zmk/ble.h>
#include <zmk/endpoints.h>
#include <zmk/keymap.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/events/endpoint_changed.h>
#include <zmk/events/ble_active_profile_changed.h>
#include <zmk/events/usb_conn_state_changed.h>
#include <zmapflow/status.h>

static struct bt_uuid_128 service_uuid = BT_UUID_INIT_128(ZMS_SERVICE_UUID);
static struct bt_uuid_128 value_uuid = BT_UUID_INIT_128(ZMS_CHAR_UUID);
enum phase { SERVICE, CHARACTERISTIC, READY };
struct peer {
    struct bt_conn *conn;
    struct bt_gatt_discover_params discovery;
    enum phase phase;
    bool busy, sent;
    uint16_t start, end, handle;
    int64_t retry_at, last_sent;
    struct zms_packet previous;
};
static struct peer peers[CONFIG_BT_MAX_CONN];
static struct k_spinlock peer_lock;
static struct k_work_q queue;
K_THREAD_STACK_DEFINE(queue_stack, 2048);
static atomic_t initialized;
static void run(struct k_work *work);
K_WORK_DELAYABLE_DEFINE(update, run);

static void schedule(int delay) {
    if (atomic_get(&initialized))
        k_work_reschedule_for_queue(&queue, &update, K_MSEC(delay));
}

static uint8_t discovered(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                          struct bt_gatt_discover_params *params) {
    struct peer *p = CONTAINER_OF(params, struct peer, discovery);
    k_spinlock_key_t key = k_spin_lock(&peer_lock);
    if (p->conn != conn) { k_spin_unlock(&peer_lock, key); return BT_GATT_ITER_STOP; }
    if (!attr) {
        p->phase = SERVICE;
        p->retry_at = k_uptime_get() + 1000;
    } else if (p->phase == SERVICE) {
        const struct bt_gatt_service_val *service = attr->user_data;
        p->start = attr->handle + 1;
        p->end = service->end_handle;
        p->phase = CHARACTERISTIC;
    } else {
        const struct bt_gatt_chrc *chrc = attr->user_data;
        if ((chrc->properties & BT_GATT_CHRC_WRITE_WITHOUT_RESP) &&
            chrc->value_handle >= p->start && chrc->value_handle <= p->end) {
            p->handle = chrc->value_handle;
            p->phase = READY;
            p->sent = false; // Initial/reconnection snapshot, even without a change.
        } else {
            p->phase = SERVICE;
            p->retry_at = k_uptime_get() + 1000;
        }
    }
    p->busy = false;
    k_spin_unlock(&peer_lock, key);
    schedule(20); // Do not start another discovery from within its callback.
    return BT_GATT_ITER_STOP;
}

static bool connected(struct bt_conn *conn) {
    struct bt_conn_info info;
    return !bt_conn_get_info(conn, &info) && info.state == BT_CONN_STATE_CONNECTED &&
           info.role == BT_CONN_ROLE_CENTRAL;
}

static void adopt(struct bt_conn *conn, void *unused) {
    if (!connected(conn)) return;
    uint8_t index = bt_conn_index(conn);
    if (index >= ARRAY_SIZE(peers)) return;
    k_spinlock_key_t key = k_spin_lock(&peer_lock);
    if (!peers[index].conn) peers[index].conn = bt_conn_ref(conn);
    k_spin_unlock(&peer_lock, key);
}

static struct zms_packet current_state(void) {
    struct zms_packet p = {.version = ZMS_VERSION};
    p.layer = zmk_keymap_highest_layer_active();
    zms_copy_name(p.name, zmk_keymap_layer_name(zmk_keymap_layer_index_to_id(p.layer)));
    p.profile = zmk_ble_active_profile_index();
    if (zmk_ble_active_profile_is_connected()) p.flags |= ZMS_PROFILE_CONNECTED;
    if (!zmk_ble_active_profile_is_open()) p.flags |= ZMS_PROFILE_BONDED;
    /* Actual selected endpoint includes ZMK's USB/BLE fallback behavior. */
    struct zmk_endpoint_instance selected = zmk_endpoint_get_selected();
    switch (selected.transport) {
    case ZMK_TRANSPORT_USB: p.output = ZMS_OUTPUT_USB; break;
    case ZMK_TRANSPORT_BLE: p.output = ZMS_OUTPUT_BLE; p.profile = selected.ble.profile_index; break;
    default: p.output = ZMS_OUTPUT_NONE; break;
    }
    return p;
}

static void run(struct k_work *work) {
    /* Release disconnected peers before adopting new ones. Hold a reference until
     * outstanding discovery has been cancelled; a new connection cannot reuse it. */
    for (size_t i = 0; i < ARRAY_SIZE(peers); i++) {
        struct peer *p = &peers[i];
        if (!p->conn || connected(p->conn)) continue;
        struct bt_conn *old = p->conn;
        bt_gatt_cancel(old, &p->discovery);
        k_spinlock_key_t key = k_spin_lock(&peer_lock);
        memset(p, 0, sizeof(*p));
        k_spin_unlock(&peer_lock, key);
        bt_conn_unref(old);
    }
    bt_conn_foreach(BT_CONN_TYPE_LE, adopt, NULL);
    struct zms_packet packet = current_state();
    int next = ZMS_HEARTBEAT_MS;
    int64_t now = k_uptime_get();
    for (size_t i = 0; i < ARRAY_SIZE(peers); i++) {
        struct peer *p = &peers[i];
        if (!p->conn) continue;
        if (bt_conn_get_security(p->conn) < BT_SECURITY_L2) { next = MIN(next, 500); continue; }
        k_spinlock_key_t key = k_spin_lock(&peer_lock);
        bool busy = p->busy;
        enum phase phase = p->phase;
        uint16_t handle = p->handle;
        int64_t retry_at = p->retry_at;
        k_spin_unlock(&peer_lock, key);
        if (busy) { next = MIN(next, 500); continue; }
        if (retry_at > now) { next = MIN(next, (int)(retry_at - now)); continue; }
        if (phase != READY) {
            key = k_spin_lock(&peer_lock);
            p->discovery = (struct bt_gatt_discover_params){
                .uuid = phase == SERVICE ? &service_uuid.uuid : &value_uuid.uuid,
                .func = discovered,
                .start_handle = phase == SERVICE ? BT_ATT_FIRST_ATTRIBUTE_HANDLE : p->start,
                .end_handle = phase == SERVICE ? BT_ATT_LAST_ATTRIBUTE_HANDLE : p->end,
                .type = phase == SERVICE ? BT_GATT_DISCOVER_PRIMARY : BT_GATT_DISCOVER_CHARACTERISTIC,
            };
            p->busy = true;
            k_spin_unlock(&peer_lock, key);
            int err = bt_gatt_discover(p->conn, &p->discovery);
            if (err) {
                key = k_spin_lock(&peer_lock);
                p->busy = false;
                p->retry_at = now + 250;
                k_spin_unlock(&peer_lock, key);
            }
            next = MIN(next, 250);
            continue;
        }
        if (!p->sent || memcmp(&p->previous, &packet, sizeof(packet)) ||
            now - p->last_sent >= ZMS_HEARTBEAT_MS) {
            int err = bt_gatt_write_without_response(p->conn, handle, &packet, sizeof(packet), false);
            if (!err) { p->previous = packet; p->last_sent = now; p->sent = true; }
            else { next = MIN(next, 250); }
        }
    }
    /* Periodic snapshots also refresh names changed through Studio. No keycode,
     * WPM or modifier stream is subscribed to by this module. */
    k_work_schedule_for_queue(&queue, &update, K_MSEC(MAX(next, 20)));
}

static void link_connected(struct bt_conn *conn, uint8_t err) { if (!err) schedule(20); }
static void link_disconnected(struct bt_conn *conn, uint8_t reason) { schedule(20); }
static void secured(struct bt_conn *conn, bt_security_t level, enum bt_security_err err) { schedule(20); }
BT_CONN_CB_DEFINE(zms_links) = {.connected=link_connected, .disconnected=link_disconnected, .security_changed=secured};
static int state_event(const zmk_event_t *eh) { schedule(20); return ZMK_EV_EVENT_BUBBLE; }
ZMK_LISTENER(zms_sender, state_event);
ZMK_SUBSCRIPTION(zms_sender, zmk_layer_state_changed);
ZMK_SUBSCRIPTION(zms_sender, zmk_endpoint_changed);
ZMK_SUBSCRIPTION(zms_sender, zmk_ble_active_profile_changed);
ZMK_SUBSCRIPTION(zms_sender, zmk_usb_conn_state_changed);

static int initialize(void) {
    k_work_queue_start(&queue, queue_stack, K_THREAD_STACK_SIZEOF(queue_stack), 10, NULL);
    atomic_set(&initialized, 1);
    schedule(100);
    return 0;
}
SYS_INIT(initialize, APPLICATION, CONFIG_APPLICATION_INIT_PRIORITY);
