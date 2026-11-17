#include <assert.h>
#include <stdio.h>
#include <zmapflow/protocol.h>

int main(void) {
 struct zms_packet p={.version=ZMS_VERSION,.layer=31,.profile=4,.output=ZMS_OUTPUT_USB};
 zms_copy_name(p.name,"NAV RIGHT");
 assert(zms_packet_valid(&p,sizeof(p),0));
 assert(!zms_packet_valid(&p,sizeof(p)-1,0));
 assert(!zms_packet_valid(&p,sizeof(p)+1,0));
 assert(!zms_packet_valid(&p,sizeof(p),1));
 assert(!zms_packet_valid(NULL,sizeof(p),0));
 p.version=2;assert(!zms_packet_valid(&p,sizeof(p),0));p.version=1;
 p.layer=32;assert(!zms_packet_valid(&p,sizeof(p),0));p.layer=0;
 p.profile=5;assert(!zms_packet_valid(&p,sizeof(p),0));p.profile=0;
 p.output=3;assert(!zms_packet_valid(&p,sizeof(p),0));p.output=0;
 p.flags=0x80;assert(!zms_packet_valid(&p,sizeof(p),0));p.flags=3;
 memset(p.name,'x',sizeof(p.name));assert(!zms_packet_valid(&p,sizeof(p),0));
 zms_copy_name(p.name,"1234567890123ç");
 assert(!strcmp(p.name,"1234567890123")); // Do not split UTF-8 at the 14-byte limit.
 assert(zms_packet_valid(&p,sizeof(p),0));
 zms_copy_name(p.name,"ação");assert(!strcmp(p.name,"ação"));assert(zms_packet_valid(&p,sizeof(p),0));
 zms_copy_name(p.name,"a\nb");assert(!strcmp(p.name,"a?b"));assert(zms_packet_valid(&p,sizeof(p),0));
 zms_copy_name(p.name,NULL);assert(!p.name[0]);
 memcpy(p.name,"\xC0\x80",3);assert(!zms_packet_valid(&p,sizeof(p),0)); // Overlong UTF-8.
 memcpy(p.name,"\xED\xA0\x80",4);assert(!zms_packet_valid(&p,sizeof(p),0)); // Surrogate.
 memcpy(p.name,"\xF4\x90\x80\x80",5);assert(!zms_packet_valid(&p,sizeof(p),0));
 p.name[0]=1;p.name[1]=0;assert(!zms_packet_valid(&p,sizeof(p),0));
 zms_copy_name(p.name,"100% literal");assert(zms_packet_valid(&p,sizeof(p),0));
 puts("status protocol: all malformed packets and UTF-8 boundaries checked");
 return 0;
}
