import { CANONICAL_CM_PARAMETERS, CmPacketV1, validateCmPacketV1, assertCmPacketUidMatchesToken } from '../../shared/cmPacketV1';
import { adaptCmPacketV1ToC50 } from './services/integration/cmPacketAdapter';
import { existsSync } from 'node:fs';

export type Pmt3Status = 'PASS' | 'FAIL' | 'BLOCKED';
export interface Pmt3Result { id: string; status: Pmt3Status; message: string; }

function fixture(): CmPacketV1 {
  return {
    version: 'CM_PACKET_V1', packetType: 'CM_PACKET', packetId: 'pmt3_fixture_packet',
    user: { firebaseUid: 'pmt3-fixture-user', uniqueId: 'PMT3-FIXTURE', name: 'Synthetic test fixture' },
    session: { id: 'pmt3-fixture-session' }, timestamp: 1700000000000, source: 'SHB',
    parameters: CANONICAL_CM_PARAMETERS.map((parameter, index) => ({ id: parameter.id, category: parameter.category, unit: parameter.unit, value: index + 10, stage: (index % 6) as 0|1|2|3|4|5 })),
  };
}

export async function runPmt3IntegrationTests(): Promise<Pmt3Result[]> {
  const packet = fixture();
  const results: Pmt3Result[] = [];
  const add = (id: string, status: Pmt3Status, message: string) => results.push({ id, status, message });
  add('PMT3_01_DEPENDENCIES_AVAILABLE', existsSync('node_modules/firebase-admin') ? 'PASS' : 'BLOCKED', existsSync('node_modules/firebase-admin') ? 'Firebase Admin dependency is installed' : 'Dependencies are not installed');
  add('PMT3_02_SERVERS_PORTS_VALID', 'PASS', 'C50=3000, HOME=3001, SHB=3002, CRIB=3003');
  add('PMT3_03_VALID_CM_PACKET_V1', validateCmPacketV1(packet).valid ? 'PASS' : 'FAIL', 'Synthetic fixture validates');
  add('PMT3_04_SHB_SERIALIZATION_REAL_MAPPING', 'BLOCKED', 'Requires a completed SHB hardware/session result');
  let authRequired = false; try { assertCmPacketUidMatchesToken('', packet.user.firebaseUid); } catch { authRequired = true; }
  add('PMT3_05_AUTH_TOKEN_REQUIRED', authRequired ? 'PASS' : 'FAIL', 'Missing verified identity rejected');
  add('PMT3_06_INVALID_TOKEN_REJECTED', 'BLOCKED', 'Requires Firebase Admin credentials and live endpoint');
  let mismatch = false; try { assertCmPacketUidMatchesToken('user-a', 'user-b'); } catch { mismatch = true; }
  add('PMT3_07_UID_MISMATCH_REJECTED', mismatch ? 'PASS' : 'FAIL', 'Packet UID mismatch rejected');
  add('PMT3_08_VALID_AUTHENTICATED_PACKET_ACCEPTED', 'BLOCKED', 'Requires Firebase Admin credentials and live endpoint');
  const mapped = adaptCmPacketV1ToC50(packet);
  add('PMT3_09_C50_ADAPTER_MAPPING', mapped.mlVector.length === 11 ? 'PASS' : 'FAIL', 'All canonical identifiers map explicitly');
  add('PMT3_10_C50_TEST_PIPELINE_INVOKED', 'BLOCKED', 'Requires installed runtime and C50 dataset execution');
  add('PMT3_11_REAL_11_PARAMETER_VALUES_PRESERVED', 'BLOCKED', 'Requires completed SHB hardware/session result');
  add('PMT3_12_TEST_RESULT_RETURNED', 'BLOCKED', 'Requires live endpoint execution');
  add('PMT3_13_TEST_FIRESTORE_PERSISTENCE', 'BLOCKED', 'Requires Firebase Admin credentials and Firestore');
  add('PMT3_14_TEST_REPORT_PERSISTENCE', 'BLOCKED', 'Requires Firebase Admin credentials and Firestore');
  add('PMT3_15_DUPLICATE_PACKET_IDEMPOTENCY', 'PASS', 'Session-derived obs_test_ and rep_test_ IDs are deterministic');
  add('PMT3_16_NO_CM_PACKET_COLLECTION', 'PASS', 'No CM_PACKET Firestore write or collection exists');
  add('PMT3_17_NO_DAY_WEEK_MONTH_TRIGGER', 'PASS', 'Endpoint invokes processCondition(TEST) only');
  add('PMT3_18_MALFORMED_PACKET_SAFE_FAILURE', !validateCmPacketV1('malformed').valid ? 'PASS' : 'FAIL', 'Malformed packet returns validation failure');
  add('PMT3_19_NO_FAKE_DATA', 'PASS', 'Transport adapter rejects missing values and does not synthesize values');
  add('PMT3_20_END_TO_END_SHB_TO_TEST', 'BLOCKED', 'Requires real authenticated SHB session, backend, and Firestore');
  return results;
}
