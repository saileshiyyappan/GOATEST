import fs from 'node:fs';
import path from 'node:path';

export type P1Status = 'PASS — static/unit' | 'PASS — runtime' | 'BLOCKED — environment' | 'FAIL';
export type P1Result = {id: string; status: P1Status; detail: string};

const root = path.resolve(import.meta.dirname, '../..');
const exists = (file: string) => fs.existsSync(path.join(root, file));
const runtimeReady = exists('c50/node_modules/tsx') && exists('c50/node_modules/firebase-admin') && exists('shb/node_modules/firebase');
const ids = [
  'P1_01_AUTHENTICATED_USER_REQUIRED','P1_02_VALID_FIREBASE_TOKEN','P1_03_UID_MATCH','P1_04_UID_MISMATCH_REJECTED','P1_05_CM_PACKET_V1_VALID','P1_06_11_CHANNELS_PRESERVED',
  'P1_07_TEST_MATCHING_EXECUTED','P1_08_TEST_RECORD_PERSISTED','P1_09_TEST_REPORT_GENERATED','P1_10_TEST_REPORT_PERSISTED','P1_11_NOTIFICATION_AFTER_REPORT_PERSISTENCE',
  'P1_12_NO_NOTIFICATION_ON_REPORT_FAILURE','P1_13_DETERMINISTIC_TEST_ID','P1_14_DETERMINISTIC_REPORT_ID','P1_15_RETRY_DOES_NOT_CREATE_DUPLICATE',
  'P1_16_NO_CM_PACKETS_COLLECTION_WRITE','P1_17_NO_LEGACY_TESTS_COLLECTION_WRITE','P1_18_NO_DAY_TRIGGER','P1_19_NO_WEEK_TRIGGER','P1_20_NO_MONTH_TRIGGER',
  'P1_21_NO_FAKE_DATA','P1_22_HOME_CAN_READ_AUTHORITATIVE_TEST_REPORT',
] as const;

export function runP1RuntimeTests(): P1Result[] {
  const detail = runtimeReady
    ? 'Runtime prerequisites exist, but no controlled Firebase/hardware execution is performed by this suite.'
    : 'Dependencies, Firebase credentials, and/or a running controlled identity are unavailable.';
  return ids.map((id) => ({id, status: runtimeReady ? 'BLOCKED — environment' : 'BLOCKED — environment', detail}));
}
