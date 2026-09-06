import { CmPacketV1, validateCmPacketV1 } from '../../../../shared/cmPacketV1';
import { CmPacket } from '../../types/cmPacket';

export function adaptCmPacketV1ToCribPacket(input: unknown): CmPacket {
  const result = validateCmPacketV1(input);
  if (!result.valid) throw new Error(result.errors.map((item) => item.message).join('; '));
  const packet = input as CmPacketV1;
  return { sessionId: packet.session.id, uid: packet.user.firebaseUid, timestamp: packet.timestamp, target: 'OVERALL', parameters: packet.parameters.map((p) => ({ parameter: p.id, phbBaseline: p.phbBaseline, shbValue: p.value, deviation: p.deviation, matchedStage: p.stage, status: 'COMPUTED', unit: p.unit })) };
}
