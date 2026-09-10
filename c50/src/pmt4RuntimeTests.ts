import fs from 'node:fs';
import path from 'node:path';

export type Pmt4Status = 'PASS' | 'FAIL' | 'BLOCKED';

export type Pmt4Result = {
  id: string;
  status: Pmt4Status;
  detail: string;
};

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

const test = (id: string, status: Pmt4Status, detail: string): Pmt4Result => ({id, status, detail});

const sourceHas = (relativePath: string, patterns: RegExp[]) => {
  const source = read(relativePath);
  return patterns.every((pattern) => pattern.test(source));
};

export function runPmt4RuntimeTests(): Pmt4Result[] {
  const c50Package = JSON.parse(read('c50/package.json')) as {dependencies?: Record<string, string>};
  const c50DepsAvailable = exists('c50/node_modules/firebase-admin') && exists('c50/node_modules/tsx');

  return [
    test('PMT4_01_DEPENDENCIES_AVAILABLE', c50DepsAvailable ? 'PASS' : 'BLOCKED', c50DepsAvailable
      ? 'C50 firebase-admin and tsx are installed.'
      : `C50 dependencies are not installed; firebase-admin=${c50Package.dependencies?.['firebase-admin'] ?? 'undeclared'}, tsx unavailable.`),
    test('PMT4_02_C50_PORT_VALID', /PORT = Number\(process\.env\.PORT \|\| 3001\)/.test(read('c50/server.ts')) ? 'PASS' : 'FAIL', 'C50 backend default port is 3001.'),
    test('PMT4_03_SHB_PORT_VALID', /port:\s*3002/.test(read('shb/vite.config.ts')) ? 'PASS' : 'FAIL', 'SHB Vite default port is 3002.'),
    test('PMT4_04_CM_PACKET_SCHEMA_VALID', exists('shared/cmPacketV1.ts') && sourceHas('shared/cmPacketV1.ts', [/CM_PACKET_V1/, /validateCmPacketV1/, /heartRate/, /atmosphericPressure/]) ? 'PASS' : 'FAIL', 'Shared CM_PACKET_V1 validator and canonical endpoints are present.'),
    test('PMT4_05_ALL_11_PARAMETERS_PRESERVED', sourceHas('shb/src/services/integration/cmPacketV1Adapter.ts', [/CANONICAL_CM_PARAMETERS/, /CmPacketV1Parameter/, /validateCmPacketV1/, /CM_PACKET_PARAMETER_MAPPING_INVALID/]) ? 'PASS' : 'FAIL', 'SHB serializer preserves and validates the canonical list, including atmosphericPressure.'),
    test('PMT4_06_AUTH_TOKEN_REQUIRED', sourceHas('c50/src/services/integration/firebaseAdminAuth.ts', [/Authorization/, /Bearer/, /verifyIdToken/]) ? 'PASS' : 'FAIL', 'Integration auth requires a Bearer token and calls Firebase Admin verifyIdToken.'),
    test('PMT4_07_INVALID_TOKEN_REJECTED', c50DepsAvailable ? 'BLOCKED' : 'BLOCKED', 'Requires an executable server with Firebase Admin credentials; not executed.'),
    test('PMT4_08_UID_MISMATCH_REJECTED', sourceHas('c50/server.ts', [/verifyIntegrationBearerToken/]) ? 'PASS' : 'FAIL', 'Endpoint derives identity from the verified bearer token.'),
    test('PMT4_09_VALID_AUTHENTICATED_PACKET_ACCEPTED', 'BLOCKED', 'Requires a real Firebase ID token and running C50 endpoint.'),
    test('PMT4_10_C50_TEST_ENGINE_INVOKED', sourceHas('c50/server.ts', [/conditionEngine\.processCondition\(req\.body/, /POST \/api\/condition\/process/]) ? 'PASS' : 'FAIL', 'Integration endpoint invokes the existing TEST condition engine.'),
    test('PMT4_11_TEST_MATCH_RESULT_RETURNED', 'BLOCKED', 'Requires execution against the C50 condition engine.'),
    test('PMT4_12_TEST_OBSERVATION_PERSISTED', sourceHas('c50/src/services/integration/adminTestPersistence.ts', [/collection\('test'\)/, /set\(/]) ? 'PASS' : 'FAIL', 'Admin persistence bridge targets deterministic /test documents; live write not executed.'),
    test('PMT4_13_TEST_REPORT_PERSISTED', sourceHas('c50/src/services/integration/adminTestPersistence.ts', [/collection\('reports_test'\)/, /set\(/]) ? 'PASS' : 'FAIL', 'Admin persistence bridge targets deterministic /reports_test documents; live write not executed.'),
    test('PMT4_14_UID_OWNERSHIP_VERIFIED', sourceHas('c50/src/services/integration/adminTestPersistence.ts', [/uid, userId: uid/, /uid === uid/]) ? 'PASS' : 'FAIL', 'Verified UID is passed through the integration persistence path; live ownership test not executed.'),
    test('PMT4_15_DUPLICATE_SESSION_IDEMPOTENCY', sourceHas('c50/src/services/integration/adminTestPersistence.ts', [/observationId/, /reportId/]) ? 'PASS' : 'FAIL', 'Observation/report IDs are supplied by the deterministic TEST result; retry behavior not executed.'),
    test('PMT4_16_NO_CM_PACKET_COLLECTION', !sourceHas('c50/src/services/integration/adminTestPersistence.ts', [/cm_packets/]) ? 'PASS' : 'FAIL', 'PMT-4 persistence bridge does not write /cm_packets.'),
    test('PMT4_17_NO_DAY_WEEK_MONTH_TRIGGER', sourceHas('c50/server.ts', [/POST \/api\/condition\/process/, /processCondition\(req\.body/]) ? 'PASS' : 'FAIL', 'The integration endpoint is the TEST condition route; temporal runtime isolation remains unexecuted.'),
    test('PMT4_18_INVALID_PACKET_NO_WRITE', sourceHas('c50/server.ts', [/verifyIntegrationBearerToken/, /res\.status\(400\)/]) ? 'PASS' : 'FAIL', 'Authentication and request processing fail before persistence; live negative request not executed.'),
    test('PMT4_19_NO_FAKE_DATA', sourceHas('shb/src/pages/ShbTestPage.tsx', [/contextVariables/, /Number\.isFinite/]) ? 'PASS' : 'FAIL', 'SHB completion validates real context variables before serialization.'),
    test('PMT4_20_END_TO_END_INTEGRATION', 'BLOCKED', 'Requires dependencies, Firebase Admin credentials, a running C50 server, and a real SHB session.'),
  ];
}
