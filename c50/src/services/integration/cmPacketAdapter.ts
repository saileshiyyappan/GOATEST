import { CANONICAL_CM_PARAMETERS, CmPacketV1, validateCmPacketV1 } from '../../../../shared/cmPacketV1';

export interface C50ConditionInput { mlVector: number[]; sessionId: string; packetId: string; timestamp: string; }

export function adaptCmPacketV1ToC50(packet: unknown): C50ConditionInput {
  const validation = validateCmPacketV1(packet);
  if (!validation.valid) throw new Error(validation.errors.map((item) => item.message).join('; '));
  const value = packet as CmPacketV1;
  const byId = new Map(value.parameters.map((parameter) => [parameter.id, parameter]));
  const mlVector = CANONICAL_CM_PARAMETERS.map((definition) => {
    const parameter = byId.get(definition.id);
    if (!parameter) throw new Error(`Missing canonical parameter ${definition.id}`);
    return parameter.stage;
  });
  return { mlVector, sessionId: value.session.id, packetId: value.packetId, timestamp: new Date(value.timestamp).toISOString() };
}
