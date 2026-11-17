#include <stdio.h>
#include "receiver.c"
int main(void){
 struct bt_conn conn={.state=1,.role=1,.security=1};
 struct zms_packet packet={.version=1,.layer=2,.profile=1,.output=ZMS_OUTPUT_USB};
 zms_copy_name(packet.name,"NAV LEFT");
 assert(receive(&conn,NULL,&packet,20,0,0)<0&&!zms_get_snapshot().valid);
 conn.security=2;
 assert(receive(&conn,NULL,&packet,19,0,0)<0);
 assert(receive(&conn,NULL,&packet,20,1,0)<0);
 assert(receive(&conn,NULL,&packet,20,0,0)==20);
 assert(zms_get_snapshot().valid&&conn.refs==1);
 int redraws=fake_submits;
 fake_now=1000;assert(receive(&conn,NULL,&packet,20,0,0)==20);
 assert(fake_submits==redraws); // Heartbeat should not redraw unchanged data.
 struct bt_conn stranger={.state=1,.role=1,.security=2};
 assert(receive(&stranger,NULL,&packet,20,0,0)<0);
 fake_now=15000;expire(NULL);assert(zms_get_snapshot().valid); // Recent heartbeat won a timer race.
 fake_now=16000;expire(NULL);assert(!zms_get_snapshot().valid);
 fake_now=17000;receive(&conn,NULL,&packet,20,0,0);assert(zms_get_snapshot().valid);
 disconnected(&conn,0);assert(!zms_get_snapshot().valid&&!conn.refs);
 assert(receive(&stranger,NULL,&packet,20,0,0)==20); // New secured central after disconnect.
 disconnected(&stranger,0);assert(!stranger.refs);
 puts("receiver: malformed/unsecured writes, ownership, freshness and disconnect verified");
}
