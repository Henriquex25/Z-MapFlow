/* Host-only deterministic runtime for exercising the actual transport sources. */
#pragma once
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <sys/types.h>
#include <errno.h>
#define ARRAY_SIZE(a) (sizeof(a)/sizeof((a)[0]))
#define MIN(a,b) ((a)<(b)?(a):(b))
#define MAX(a,b) ((a)>(b)?(a):(b))
#define CONTAINER_OF(p,t,f) ((t*)((char*)(p)-offsetof(t,f)))
#define CONFIG_BT_MAX_CONN 3
#define CONFIG_APPLICATION_INIT_PRIORITY 90
#define CONFIG_ZMK_BATTERY_REPORTING 1
#define APPLICATION 0
#define SYS_INIT(fn,...) static void *test_init __attribute__((used))=(void*)&fn
#define K_MSEC(n) (n)
static int64_t fake_now;
static inline int64_t k_uptime_get(void){return fake_now;}
struct k_spinlock {int unused;};typedef int k_spinlock_key_t;
static inline int k_spin_lock(struct k_spinlock *l){return 0;}
static inline void k_spin_unlock(struct k_spinlock *l,int key){}
typedef int atomic_t;
static inline int atomic_get(atomic_t *v){return *v;}
static inline void atomic_set(atomic_t *v,int n){*v=n;}
struct k_work {void (*fn)(struct k_work*);};
struct k_work_delayable {struct k_work work;int64_t deadline;};
struct k_work_q {int unused;};
#define K_WORK_DEFINE(n,f) static struct k_work n={.fn=f}
#define K_WORK_DELAYABLE_DEFINE(n,f) static struct k_work_delayable n={.work={.fn=f}}
#define K_THREAD_STACK_DEFINE(n,s) static char n[s]
#define K_THREAD_STACK_SIZEOF(n) sizeof(n)
static int fake_submits;
static inline int k_work_submit(struct k_work*w){fake_submits++;return 0;}
static inline int k_work_reschedule(struct k_work_delayable*w,int64_t d){w->deadline=fake_now+d;return 0;}
static inline int k_work_reschedule_for_queue(struct k_work_q*q,struct k_work_delayable*w,int64_t d){return k_work_reschedule(w,d);}
static inline int k_work_schedule_for_queue(struct k_work_q*q,struct k_work_delayable*w,int64_t d){return k_work_reschedule(w,d);}
static inline int k_work_cancel_delayable(struct k_work_delayable*w){w->deadline=0;return 0;}
static inline void k_work_queue_start(struct k_work_q*q,void*s,size_t size,int prio,void*cfg){}

typedef struct {int unused;} zmk_event_t;
#define ZMK_EV_EVENT_BUBBLE 0
static int fake_events;
#define ZMK_EVENT_DECLARE(t) static inline int raise_##t(struct t value){fake_events++;return 0;}
#define ZMK_EVENT_IMPL(t)
#define ZMK_LISTENER(n,cb) static void*n __attribute__((used))=(void*)&cb
#define ZMK_SUBSCRIPTION(...)

#define BT_CONN_STATE_CONNECTED 1
#define BT_CONN_ROLE_CENTRAL 0
#define BT_CONN_ROLE_PERIPHERAL 1
#define BT_CONN_TYPE_LE 0
#define BT_SECURITY_L2 2
typedef int bt_security_t;enum bt_security_err {SEC_OK};
struct bt_conn {int state,role,security,index,refs;};
struct bt_conn_info {int state,role;};
static struct bt_conn fake_connections[CONFIG_BT_MAX_CONN];
static inline int bt_conn_get_info(struct bt_conn*c,struct bt_conn_info*i){i->state=c->state;i->role=c->role;return 0;}
static inline int bt_conn_get_security(struct bt_conn*c){return c->security;}
static inline uint8_t bt_conn_index(struct bt_conn*c){return c->index;}
static inline struct bt_conn *bt_conn_ref(struct bt_conn*c){c->refs++;return c;}
static inline void bt_conn_unref(struct bt_conn*c){assert(c->refs>0);c->refs--;}
static inline void bt_conn_foreach(int type,void(*cb)(struct bt_conn*,void*),void*data){for(size_t i=0;i<ARRAY_SIZE(fake_connections);i++)if(fake_connections[i].state)cb(&fake_connections[i],data);}
struct bt_conn_cb {void(*connected)(struct bt_conn*,uint8_t);void(*disconnected)(struct bt_conn*,uint8_t);void(*security_changed)(struct bt_conn*,bt_security_t,enum bt_security_err);};
#define BT_CONN_CB_DEFINE(n) static struct bt_conn_cb n __attribute__((used))
struct bt_uuid {int type;};struct bt_uuid_128 {struct bt_uuid uuid;};
#define BT_UUID_128_ENCODE(...) 0
#define BT_UUID_INIT_128(...) {.uuid={.type=1}}
struct bt_gatt_attr {uint16_t handle;void*user_data;void*uuid;ssize_t(*write)(struct bt_conn*,const struct bt_gatt_attr*,const void*,uint16_t,uint16_t,uint8_t);};
struct bt_gatt_discover_params {struct bt_uuid*uuid;uint8_t(*func)(struct bt_conn*,const struct bt_gatt_attr*,struct bt_gatt_discover_params*);uint16_t start_handle,end_handle;int type;};
struct bt_gatt_service_val {uint16_t end_handle;};
struct bt_gatt_chrc {uint8_t properties;uint16_t value_handle;};
#define BT_GATT_ITER_STOP 0
#define BT_GATT_CHRC_WRITE_WITHOUT_RESP 4
#define BT_GATT_PERM_WRITE_ENCRYPT 8
#define BT_GATT_DISCOVER_PRIMARY 1
#define BT_GATT_DISCOVER_CHARACTERISTIC 2
#define BT_ATT_FIRST_ATTRIBUTE_HANDLE 1
#define BT_ATT_LAST_ATTRIBUTE_HANDLE 65535
#define BT_ATT_ERR_AUTHORIZATION 8
#define BT_ATT_ERR_VALUE_NOT_ALLOWED 19
#define BT_GATT_ERR(n) (-(n))
#define BT_GATT_PRIMARY_SERVICE(v) {.user_data=(void*)(v)}
#define BT_GATT_CHARACTERISTIC(u,p,a,r,w,d) {.uuid=(void*)(u),.write=w}
#define BT_GATT_SERVICE_DEFINE(n,...) static struct bt_gatt_attr n[] __attribute__((used))={__VA_ARGS__}
static int fake_discovers,fake_discover_error,fake_writes,fake_write_error,fake_cancels,fake_destinations;
static struct bt_gatt_discover_params *fake_discovery;
static uint8_t fake_packet[20];
static inline int bt_gatt_discover(struct bt_conn*c,struct bt_gatt_discover_params*p){fake_discovers++;fake_discovery=p;return fake_discover_error;}
static inline int bt_gatt_write_without_response(struct bt_conn*c,uint16_t h,const void*data,size_t len,bool sign){assert(c->security>=2);assert(len==20);fake_writes++;fake_destinations|=1<<c->index;memcpy(fake_packet,data,len);return fake_write_error;}
static inline void bt_gatt_cancel(struct bt_conn*c,void*p){fake_cancels++;}

enum zmk_transport {ZMK_TRANSPORT_NONE,ZMK_TRANSPORT_USB,ZMK_TRANSPORT_BLE};
struct zmk_endpoint_instance {enum zmk_transport transport;struct {int profile_index;}ble;};
static struct zmk_endpoint_instance fake_endpoint;
static uint8_t fake_layer,fake_profile;
static const char *fake_layer_name="NAV LEFT";
static inline uint8_t zmk_keymap_highest_layer_active(void){return fake_layer;}
static inline uint8_t zmk_keymap_layer_index_to_id(uint8_t i){return i;}
static inline const char*zmk_keymap_layer_name(uint8_t i){return fake_layer_name;}
static inline uint8_t zmk_ble_active_profile_index(void){return fake_profile;}
static inline bool zmk_ble_active_profile_is_connected(void){return true;}
static inline bool zmk_ble_active_profile_is_open(void){return false;}
static inline struct zmk_endpoint_instance zmk_endpoint_get_selected(void){return fake_endpoint;}
