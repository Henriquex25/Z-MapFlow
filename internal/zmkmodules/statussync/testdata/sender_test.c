#include <stdio.h>
#include "sender.c"
static void finish_discovery(struct bt_conn *conn) {
 struct bt_gatt_service_val svc={.end_handle=20};
 struct bt_gatt_attr attr={.handle=2,.user_data=&svc};
 fake_discovery->func(conn,&attr,fake_discovery);
 fake_now+=20;run(NULL);
 struct bt_gatt_chrc chrc={.properties=BT_GATT_CHRC_WRITE_WITHOUT_RESP,.value_handle=5};
 attr.user_data=&chrc;
 fake_discovery->func(conn,&attr,fake_discovery);
 fake_now+=20;run(NULL);
}
int main(void){
 initialize();
 struct bt_conn *c=&fake_connections[0];
 *c=(struct bt_conn){.state=1,.role=0,.security=1,.index=0};
 fake_layer=2;fake_profile=1;fake_endpoint.transport=ZMK_TRANSPORT_USB;
 run(NULL);assert(fake_discovers==0&&fake_writes==0); // Wait for encryption.
 c->security=2;fake_discover_error=-EBUSY;
 run(NULL);assert(fake_discovers==1&&!peers[0].busy);
 fake_now=249;run(NULL);assert(fake_discovers==1);
 fake_now=250;fake_discover_error=0;run(NULL);assert(peers[0].busy);
 finish_discovery(c);
 assert(fake_writes==1);
 struct zms_packet *p=(void*)fake_packet;
 assert(p->output==ZMS_OUTPUT_USB&&p->profile==1&&p->layer==2&&!strcmp(p->name,"NAV LEFT"));
 run(NULL);assert(fake_writes==1); // No continuous event stream.
 fake_now+=ZMS_HEARTBEAT_MS;run(NULL);assert(fake_writes==2);
 fake_endpoint.transport=ZMK_TRANSPORT_BLE;fake_endpoint.ble.profile_index=3;
 run(NULL);assert(fake_writes==3&&p->output==ZMS_OUTPUT_BLE&&p->profile==3);
 fake_endpoint.transport=ZMK_TRANSPORT_NONE;run(NULL);assert(p->output==ZMS_OUTPUT_NONE);
 c->state=0;run(NULL);assert(c->refs==0&&fake_cancels==1);
 int previous=fake_writes;
 c->state=1;c->security=2;run(NULL);finish_discovery(c);
 assert(fake_writes==previous+1); // Snapshot on reconnect with unchanged state.
 assert(c->refs==1);
 c->state=0;run(NULL);assert(!c->refs);

 // Both peripheral halves receive state, while a host BLE link is excluded.
 struct bt_conn *second=&fake_connections[1],*host=&fake_connections[2];
 c->state=1;c->security=2;
 *second=(struct bt_conn){.state=1,.role=0,.security=2,.index=1};
 *host=(struct bt_conn){.state=1,.role=1,.security=2,.index=2};
 fake_destinations=0;run(NULL);
 assert(!peers[2].conn&&!host->refs);
 for(int i=0;i<2;i++) {
  struct bt_gatt_discover_params *params=&peers[i].discovery;
  struct bt_gatt_service_val svc={.end_handle=20};
  struct bt_gatt_attr attr={.handle=2,.user_data=&svc};
  params->func(&fake_connections[i],&attr,params);fake_now+=20;run(NULL);
  struct bt_gatt_chrc chrc={.properties=BT_GATT_CHRC_WRITE_WITHOUT_RESP,.value_handle=5};
  attr.user_data=&chrc;params->func(&fake_connections[i],&attr,params);fake_now+=20;run(NULL);
 }
 assert(fake_destinations==3);
 c->state=0;second->state=0;host->state=0;run(NULL);
 assert(!c->refs&&!second->refs&&!host->refs);
 puts("sender: encryption, busy retry, actual endpoint, heartbeat and reconnect verified");
}
