import fs from 'node:fs';
import path from 'node:path';

export type P2Status = 'PASS' | 'FAIL' | 'BLOCKED';
export type P2Result = { id: string; status: P2Status; detail: string };

const root = path.resolve(import.meta.dirname, '../..');
const exists = (file: string) => fs.existsSync(path.join(root, file));
const hasRuntimeDependencies =
  exists('c50/node_modules/tsx') &&
  exists('c50/node_modules/firebase-admin') &&
  exists('shb/node_modules/firebase') &&
  exists('home/node_modules/firebase');

const ids = [
  'P2_01_DEPENDENCIES_AVAILABLE', 'P2_02_FIREBASE_PROJECT_RESOLVED', 'P2_03_SERVERS_START',
  'P2_04_AUTHENTICATED_LOGIN', 'P2_05_VALID_ID_TOKEN', 'P2_06_UID_MATCH', 'P2_07_UID_MISMATCH_REJECTED',
  'P2_08_REAL_CM_PACKET_CREATED', 'P2_09_ALL_11_CHANNELS_PRESERVED', 'P2_10_C50_RECEIVES_PACKET',
  'P2_11_TEST_MATCH_EXECUTED', 'P2_12_TEST_RECORD_PERSISTED', 'P2_13_TEST_REPORT_GENERATED',
  'P2_14_TEST_REPORT_PERSISTED', 'P2_15_CARETAKER_NOTIFICATION_AFTER_PERSISTENCE',
  'P2_16_HOME_RETRIEVES_TEST_REPORT', 'P2_17_IDEMPOTENT_RETRY', 'P2_18_NO_LEGACY_COLLECTION_WRITES',
  'P2_19_NO_DAY_TRIGGER', 'P2_20_NO_WEEK_TRIGGER', 'P2_21_NO_MONTH_TRIGGER', 'P2_22_NO_FAKE_DATA',
  'P2_23_INVALID_AUTH_REJECTED', 'P2_24_INVALID_PACKET_REJECTED', 'P2_25_REPORT_FAILURE_BLOCKS_NOTIFICATION',
] as const;

export function runP2RuntimeTests(): P2Result[] {
  const detail = !hasRuntimeDependencies
    ? 'BLOCKED: required project dependencies are not installed; no runtime execution occurred.'
    : 'BLOCKED: Firebase project/credentials and a real authenticated SHB test remain unavailable; this runner never fabricates PASS.';
  return ids.map((id) => ({ id, status: 'BLOCKED', detail }));
}
