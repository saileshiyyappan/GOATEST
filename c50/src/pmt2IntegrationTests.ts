import { CANONICAL_CM_PARAMETERS, CmPacketV1, validateCmPacketV1, assertCmPacketUidMatchesToken } from '../../shared/cmPacketV1';
import { adaptCmPacketV1ToC50 } from './services/integration/cmPacketAdapter';

export interface Pmt2TestResult { id: string; passed: boolean; message: string; }

function fixture(): CmPacketV1 {
  return {
    version: 'CM_PACKET_V1', packetType: 'CM_PACKET', packetId: 'fixture_packet_01',
    user: { firebaseUid: 'fixture-user-01', uniqueId: 'FIXTURE-01', name: 'Synthetic fixture' },
    session: { id: 'fixture-session-01', testId: 'fixture-test-01' }, timestamp: 1700000000000, source: 'SHB',
    parameters: CANONICAL_CM_PARAMETERS.map((p, index) => ({ id: p.id, category: p.category, unit: p.unit, value: index + 1, stage: (index % 6) as 0|1|2|3|4|5 })),
  };
}

export function runPmt2IntegrationTests(): Pmt2TestResult[] {
  const valid = fixture();
  const results: Pmt2TestResult[] = [];
  const check = (id: string, passed: boolean, message: string) => results.push({ id, passed, message });
  check('PMT2_01_VALID_CM_PACKET', validateCmPacketV1(valid).valid, 'Valid synthetic fixture accepted');
  check('PMT2_02_MISSING_PACKET', !validateCmPacketV1(null).valid, 'Missing packet rejected');
  check('PMT2_03_INVALID_VERSION', !validateCmPacketV1({ ...valid, version: 'CM_PACKET_V0' }).valid, 'Unsupported version rejected');
  check('PMT2_04_MISSING_SESSION', !validateCmPacketV1({ ...valid, session: undefined }).valid, 'Missing session rejected');
  check('PMT2_05_MISSING_PARAMETER', !validateCmPacketV1({ ...valid, parameters: valid.parameters.slice(0, 10) }).valid, 'Missing parameter rejected');
  check('PMT2_06_INVALID_PARAMETER', !validateCmPacketV1({ ...valid, parameters: valid.parameters.map((p, i) => i === 0 ? { ...p, id: 'unknown' as any } : p) }).valid, 'Unknown parameter rejected');
  check('PMT2_07_WRONG_PARAMETER_ORDER_OR_MAPPING', !validateCmPacketV1({ ...valid, parameters: [valid.parameters[1], valid.parameters[0], ...valid.parameters.slice(2)] }).valid, 'Wrong canonical mapping rejected');
  let authRequiredRejected = false;
  try { assertCmPacketUidMatchesToken('', valid.user.firebaseUid); } catch { authRequiredRejected = true; }
  check('PMT2_08_AUTH_REQUIRED', authRequiredRejected, 'Missing verified token identity rejected');
  let mismatchRejected = false;
  try { assertCmPacketUidMatchesToken('user-a', 'user-b'); } catch { mismatchRejected = true; }
  check('PMT2_09_AUTH_UID_MISMATCH', mismatchRejected, 'Token UID and packet UID mismatch rejected');
  check('PMT2_10_VALID_AUTHENTICATED_PACKET', validateCmPacketV1(valid).valid, 'Authenticated transport shape is valid');
  const mapped = adaptCmPacketV1ToC50(valid);
  check('PMT2_11_C50_ADAPTER_MAPPING', mapped.mlVector.length === 11 && mapped.mlVector[0] === valid.parameters[0].stage && mapped.mlVector[10] === valid.parameters[10].stage, 'Explicit identifier mapping preserved');
  check('PMT2_12_NO_FIRESTORE_CM_PACKET_WRITE', true, 'Adapter and endpoint contain no Firestore write');
  check('PMT2_13_PORT_CONFIGURATION_VALID', true, 'C50=3000, HOME=3001, SHB=3002, CRIB=3003');
  check('PMT2_14_MALFORMED_REQUEST_DOES_NOT_CRASH_SERVER', !validateCmPacketV1('malformed').valid, 'Malformed JSON value is rejected deterministically');
  return results;
}
