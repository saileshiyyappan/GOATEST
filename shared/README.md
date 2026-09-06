# CM_PACKET_V1 integration contract

The canonical transport contract is defined in `cmPacketV1.ts`.

Compare and Condition now exchange the canonical CM_PACKET through a direct in-process function call inside HOME. Firebase authentication and persistence begin only after the completed Condition result reaches HOME.

The parameter order is fixed: heartRate, spo2, ppi, rmssd, sdnn, respiratoryRate, activityIntensity, ambientTemperature, relativeHumidity, atmosphericPressure, altitude.

The endpoint validates, adapts the packet into the existing C50 TEST condition input, and invokes the existing TEST pipeline. It does not persist CM_PACKET and does not create a `/cm_packets` collection.

CRIB may later consume the same JSON through its `CM_PACKET_V1 → internal CmPacket → cribInputAdapter → cribDataManager` boundary.
