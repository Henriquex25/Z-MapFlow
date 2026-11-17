/* SPDX-License-Identifier: MIT */
#include <zephyr/kernel.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gatt.h>
#include <zmapflow/status.h>

ZMK_EVENT_IMPL(zms_status_changed);
static struct k_spinlock lock;
static struct zms_snapshot cached;
static struct bt_conn *owner;
static int64_t received_at;

struct zms_snapshot zms_get_snapshot(void) {
    k_spinlock_key_t key = k_spin_lock(&lock);
    struct zms_snapshot value = cached;
    k_spin_unlock(&lock, key);
    return value;
}
static void publish(struct k_work *work) {
    struct zms_snapshot value = zms_get_snapshot();
    raise_zms_status_changed((struct zms_status_changed){.valid=value.valid});
}
K_WORK_DEFINE(changed, publish);
static void expire(struct k_work *work);
K_WORK_DELAYABLE_DEFINE(expiration, expire);
static void expire(struct k_work *work) {
    k_spinlock_key_t key = k_spin_lock(&lock);
    int64_t remaining = received_at + ZMS_EXPIRE_MS - k_uptime_get();
    bool expired = remaining <= 0;
    if (expired) cached.valid = false;
    k_spin_unlock(&lock, key);
    if (expired) k_work_submit(&changed);
    else k_work_reschedule(&expiration, K_MSEC(remaining));
}

static ssize_t receive(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                       const void *data, uint16_t len, uint16_t offset, uint8_t flags) {
    struct bt_conn_info info;
    if (bt_conn_get_info(conn, &info) || info.state != BT_CONN_STATE_CONNECTED || info.role != BT_CONN_ROLE_PERIPHERAL ||
        bt_conn_get_security(conn) < BT_SECURITY_L2)
        return BT_GATT_ERR(BT_ATT_ERR_AUTHORIZATION);
    if (!zms_packet_valid(data, len, offset))
        return BT_GATT_ERR(BT_ATT_ERR_VALUE_NOT_ALLOWED);
    struct zms_packet incoming;
    memcpy(&incoming, data, sizeof(incoming));
    k_spinlock_key_t key = k_spin_lock(&lock);
    if (owner && owner != conn) {
        k_spin_unlock(&lock, key);
        return BT_GATT_ERR(BT_ATT_ERR_AUTHORIZATION);
    }
    if (!owner) owner = bt_conn_ref(conn);
    bool redraw = !cached.valid || memcmp(&cached.packet, &incoming, sizeof(incoming));
    cached.packet = incoming;
    cached.valid = true;
    received_at = k_uptime_get();
    k_spin_unlock(&lock, key);
    k_work_reschedule(&expiration, K_MSEC(ZMS_EXPIRE_MS));
    if (redraw) k_work_submit(&changed);
    return len;
}
static struct bt_uuid_128 service_uuid = BT_UUID_INIT_128(ZMS_SERVICE_UUID);
static struct bt_uuid_128 value_uuid = BT_UUID_INIT_128(ZMS_CHAR_UUID);
BT_GATT_SERVICE_DEFINE(zms_service,
    BT_GATT_PRIMARY_SERVICE(&service_uuid),
    BT_GATT_CHARACTERISTIC(&value_uuid.uuid, BT_GATT_CHRC_WRITE_WITHOUT_RESP,
                           BT_GATT_PERM_WRITE_ENCRYPT, NULL, receive, NULL));

static void disconnected(struct bt_conn *conn, uint8_t reason) {
    struct bt_conn *release = NULL;
    k_spinlock_key_t key = k_spin_lock(&lock);
    if (owner == conn) { release = owner; owner = NULL; cached.valid = false; }
    k_spin_unlock(&lock, key);
    if (release) {
        bt_conn_unref(release);
        k_work_cancel_delayable(&expiration);
        k_work_submit(&changed);
    }
}
BT_CONN_CB_DEFINE(zms_receiver_link) = {.disconnected=disconnected};
