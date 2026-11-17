#include <stdbool.h>
#include <zmapflow/protocol.h>
struct zms_snapshot { bool valid; struct zms_packet packet; };
struct zms_snapshot zms_get_snapshot(void);
