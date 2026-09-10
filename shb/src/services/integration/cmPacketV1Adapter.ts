import {
  CANONICAL_CM_PARAMETERS,
  CmPacketV1,
  CmPacketV1Parameter,
  validateCmPacketV1,
} from '../../../../shared/cmPacketV1';
import { CmPacket, CmParameterRow } from '../../types/compare';

/**
 * Serializes the authoritative SHB CM_PACKET into the shared transport contract.
 * This is an adapter only; comparison and stage calculation remain in compareEngine.
 */
export function toCmPacketV1(packet: CmPacket): CmPacketV1 {
  if (!packet || packet.packetType !== 'CM_PACKET') {
    throw new Error('CM_PACKET_REQUIRED');
  }

  const rows = packet.parameters ?? [];
  const parameters: CmPacketV1Parameter[] = CANONICAL_CM_PARAMETERS.map((definition, index) => {
    const row = rows[index] as CmParameterRow | undefined;
    if (!row || row.key !== definition.id || row.unit !== definition.unit) {
      throw new Error(`CM_PACKET_PARAMETER_MAPPING_INVALID:${definition.id}`);
    }
    if (!Number.isFinite(row.shbValue) || !Number.isInteger(row.compareStage) || row.compareStage < 0 || row.compareStage > 5) {
      throw new Error(`CM_PACKET_PARAMETER_VALUE_INVALID:${definition.id}`);
    }

    return {
      id: definition.id,
      category: definition.category,
      unit: definition.unit,
      value: row.shbValue as number,
      stage: row.compareStage as 0 | 1 | 2 | 3 | 4 | 5,
      phbBaseline: row.phbBaseline ?? undefined,
      deviation: row.deviation ?? undefined,
      direction: row.direction ?? undefined,
    };
  });

  const adapted: CmPacketV1 = {
    version: 'CM_PACKET_V1',
    packetType: 'CM_PACKET',
    packetId: `${packet.sessionId}:${packet.timestamp}`,
    user: { firebaseUid: packet.uid },
    session: { id: packet.sessionId },
    timestamp: packet.timestamp,
    source: 'SHB',
    parameters,
  };

  const validation = validateCmPacketV1(adapted);
  if (!validation.valid) {
    throw new Error(`CM_PACKET_V1_INVALID:${validation.errors.map((item) => item.code).join(',')}`);
  }
  return adapted;
}

export const serializeCmPacketV1 = toCmPacketV1;
