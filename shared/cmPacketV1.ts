export const CM_PACKET_V1 = 'CM_PACKET_V1' as const;

export type CmPacketCategory = 'DV' | 'IV' | 'CX';
export type CmPacketStage = 0 | 1 | 2 | 3 | 4 | 5;

export const CANONICAL_CM_PARAMETERS = [
  { id: 'heartRate', category: 'DV', unit: 'bpm' },
  { id: 'spo2', category: 'DV', unit: '%' },
  { id: 'ppi', category: 'DV', unit: 'ms' },
  { id: 'rmssd', category: 'IV', unit: 'ms' },
  { id: 'sdnn', category: 'IV', unit: 'ms' },
  { id: 'respiratoryRate', category: 'IV', unit: 'breaths/min' },
  { id: 'activityIntensity', category: 'CX', unit: 'a.u.' },
  { id: 'ambientTemperature', category: 'CX', unit: '°C' },
  { id: 'relativeHumidity', category: 'CX', unit: '%' },
  { id: 'atmosphericPressure', category: 'CX', unit: 'hPa' },
  { id: 'altitude', category: 'CX', unit: 'm' },
] as const;

export type CanonicalCmParameterId = (typeof CANONICAL_CM_PARAMETERS)[number]['id'];

export interface CmPacketV1Identity {
  firebaseUid: string;
  uniqueId?: string;
  name?: string;
}

export interface CmPacketV1Parameter {
  id: CanonicalCmParameterId;
  category: CmPacketCategory;
  unit: string;
  value: number;
  stage: CmPacketStage;
  phbBaseline?: number;
  deviation?: number;
  direction?: string;
}

export interface CmPacketV1 {
  version: typeof CM_PACKET_V1;
  packetType: 'CM_PACKET';
  packetId: string;
  user: CmPacketV1Identity;
  session: { id: string; testId?: string };
  timestamp: number;
  source: 'SHB';
  parameters: CmPacketV1Parameter[];
}

export interface CmPacketValidationError {
  code: string;
  message: string;
  parameterId?: string;
}

export interface CmPacketValidationResult {
  valid: boolean;
  errors: CmPacketValidationError[];
}

export function assertCmPacketUidMatchesToken(verifiedUid: string, packetUid: unknown): void {
  if (!verifiedUid || typeof packetUid !== 'string' || packetUid !== verifiedUid) {
    throw Object.assign(new Error('Packet identity does not match the verified Firebase UID'), { statusCode: 403, code: 'AUTH_UID_MISMATCH' });
  }
}

const error = (code: string, message: string, parameterId?: string): CmPacketValidationError => ({ code, message, parameterId });

export function validateCmPacketV1(value: unknown): CmPacketValidationResult {
  const errors: CmPacketValidationError[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: [error('PACKET_REQUIRED', 'CM_PACKET_V1 must be a JSON object')] };
  }
  const packet = value as Partial<CmPacketV1>;
  if (packet.version !== CM_PACKET_V1) errors.push(error('INVALID_VERSION', `Expected ${CM_PACKET_V1}`));
  if (packet.packetType !== 'CM_PACKET') errors.push(error('INVALID_PACKET_TYPE', 'packetType must be CM_PACKET'));
  if (!packet.packetId || typeof packet.packetId !== 'string') errors.push(error('PACKET_ID_REQUIRED', 'packetId is required'));
  if (!packet.user || typeof packet.user !== 'object' || typeof packet.user.firebaseUid !== 'string' || !packet.user.firebaseUid.trim()) errors.push(error('AUTH_REQUIRED', 'user.firebaseUid is required'));
  if (!packet.session || typeof packet.session !== 'object' || typeof packet.session.id !== 'string' || !packet.session.id.trim()) errors.push(error('SESSION_REQUIRED', 'session.id is required'));
  if (typeof packet.timestamp !== 'number' || !Number.isFinite(packet.timestamp) || packet.timestamp <= 0) errors.push(error('INVALID_TIMESTAMP', 'timestamp must be a positive Unix millisecond timestamp'));
  if (packet.source !== 'SHB') errors.push(error('INVALID_SOURCE', 'source must be SHB'));
  if (!Array.isArray(packet.parameters)) {
    errors.push(error('PARAMETERS_REQUIRED', 'parameters must be an array'));
  } else {
    if (packet.parameters.length !== CANONICAL_CM_PARAMETERS.length) errors.push(error('PARAMETER_COUNT', 'Exactly 11 canonical parameters are required'));
    const seen = new Set<string>();
    packet.parameters.forEach((p, index) => {
      const expected = CANONICAL_CM_PARAMETERS[index];
      if (!p || typeof p !== 'object') { errors.push(error('INVALID_PARAMETER', `Parameter ${index + 1} is malformed`)); return; }
      if (seen.has(p.id)) errors.push(error('DUPLICATE_PARAMETER', `Duplicate parameter ${p.id}`, p.id));
      seen.add(p.id);
      if (!expected || p.id !== expected.id) errors.push(error('PARAMETER_MAPPING', `Parameter index ${index + 1} must be ${expected?.id || 'a canonical parameter'}`, p.id));
      if (!CANONICAL_CM_PARAMETERS.some((x) => x.id === p.id)) errors.push(error('INVALID_PARAMETER', `Unknown canonical parameter ${p.id}`, p.id));
      if (expected && (p.category !== expected.category || p.unit !== expected.unit)) errors.push(error('PARAMETER_METADATA', `Metadata mismatch for ${expected.id}`, p.id));
      if (typeof p.value !== 'number' || !Number.isFinite(p.value)) errors.push(error('INVALID_VALUE', `value for ${p.id} must be finite`, p.id));
      if (!Number.isInteger(p.stage) || p.stage < 0 || p.stage > 5) errors.push(error('INVALID_STAGE', `stage for ${p.id} must be an integer from 0 to 5`, p.id));
    });
  }
  return { valid: errors.length === 0, errors };
}
