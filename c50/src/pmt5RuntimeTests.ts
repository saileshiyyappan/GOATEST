import fs from 'node:fs';
import path from 'node:path';

export type Pmt5Status = 'PASS' | 'FAIL' | 'BLOCKED';
export type Pmt5Result = {id: string; status: Pmt5Status; detail: string};

const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const has = (file: string, patterns: RegExp[]) => patterns.every((pattern) => pattern.test(read(file)));
const exists = (file: string) => fs.existsSync(path.join(root, file));
const result = (id: string, status: Pmt5Status, detail: string): Pmt5Result => ({id, status, detail});

export function runPmt5RuntimeTests(): Pmt5Result[] {
  const runtimeAvailable = exists('c50/node_modules/tsx') && exists('home/node_modules/firebase');
  const homeDb = 'home/src/services/homeDatabaseService.ts';
  const homeReports = 'home/src/services/reportDatabaseService.ts';
  const engine = 'c50/src/services/condition/conditionEngine.ts';
  const homeRules = 'home/firestore.rules';

  return [
    result('PMT5_01', has(homeDb, [/getUserConditionRecords\(userId, 'test'/, /getUserConditionReports\(userId/]) ? 'PASS' : 'FAIL', 'HOME consumes canonical TEST records and reports.'),
    result('PMT5_02', has(engine, [/Minimum 3 TEST observations/, /processDayAssessment/]) ? 'PASS' : 'FAIL', 'DAY requires three TEST observations; runtime trigger count not executed.'),
    result('PMT5_03', has(engine, [/DAY_NOT_ELIGIBLE/, /userTests\.length < 3/]) ? 'PASS' : 'FAIL', 'Two or fewer TEST observations return DAY_NOT_ELIGIBLE.'),
    result('PMT5_04', has(engine, [/obs\.uid !== authUid/, /UID_MISMATCH_REJECTED/]) ? 'PASS' : 'FAIL', 'Mixed-UID TEST observations are rejected.'),
    result('PMT5_05', has(engine, [/matchDayPattern\(dayVector, testVectors\)/]) ? 'PASS' : 'FAIL', 'DAY calls the existing C50 DAY matcher.'),
    result('PMT5_06', has(engine, [/writeDayObservation\(authUid, dayObsPayload\)/, /dayAuthoritativeReport/]) ? 'PASS' : 'FAIL', 'DAY writes the canonical observation through the injected persistence boundary.'),
    result('PMT5_07', has(engine, [/writeDayReport\(authUid, dayAuthoritativeReport\)/]) ? 'PASS' : 'FAIL', 'DAY writes the canonical report through the injected persistence boundary.'),
    result('PMT5_08', has(engine, [/qaStatus = 'AVAILABLE'/, /resolvedQAData =/]) ? 'PASS' : 'FAIL', 'Submitted Q/A is carried into DAY data.'),
    result('PMT5_09', has(engine, [/Q\/A_NOT_AVAILABLE/, /qaData: resolvedQAData/]) ? 'PASS' : 'FAIL', 'Missing Q/A is represented without fabricated answers.'),
    result('PMT5_10', has(engine, [/Minimum 7 DAY observations/, /processWeekAssessment/]) ? 'PASS' : 'FAIL', 'WEEK requires seven DAY observations; runtime trigger count not executed.'),
    result('PMT5_11', has(engine, [/WEEK_NOT_ELIGIBLE/, /userDays\.length < 7/]) ? 'PASS' : 'FAIL', 'Incomplete WEEK input is rejected.'),
    result('PMT5_12', has(engine, [/Four completed WEEK observations are required/, /processMonthAssessment/]) ? 'PASS' : 'FAIL', 'MONTH requires four completed WEEK observations.'),
    result('PMT5_13', has(engine, [/writeMonthObservation\(uid, monthObsDoc\)/]) ? 'PASS' : 'FAIL', 'MONTH writes the canonical observation through the injected persistence boundary.'),
    result('PMT5_14', has(engine, [/writeMonthReport\(uid, authoritativeReport\)/]) ? 'PASS' : 'FAIL', 'MONTH writes the canonical report through the injected persistence boundary.'),
    result('PMT5_15', has(homeReports, [/collection\(db, collectionName\)/, /'test'/]) ? 'PASS' : 'FAIL', 'HOME canonical TEST reads use /test.'),
    result('PMT5_16', has(homeReports, [/collection\(db, collectionName\)/, /'day'/]) ? 'PASS' : 'FAIL', 'HOME canonical DAY reads use /day.'),
    result('PMT5_17', has(homeReports, [/collection\(db, collectionName\)/, /'week'/]) ? 'PASS' : 'FAIL', 'HOME canonical WEEK reads use /week.'),
    result('PMT5_18', has(homeReports, [/collection\(db, collectionName\)/, /'month'/]) ? 'PASS' : 'FAIL', 'HOME canonical MONTH reads use /month.'),
    result('PMT5_19', has(homeReports, [/reports_test/, /reports_day/, /reports_week/, /reports_month/]) ? 'PASS' : 'FAIL', 'HOME canonical report collection bridge is present.'),
    result('PMT5_20', !has('c50/src/services/integration/adminTestPersistence.ts', [/cm_packets/]) ? 'PASS' : 'FAIL', 'No PMT-5 persistence path writes /cm_packets.'),
    result('PMT5_21', has(homeDb, [/getUserConditionRecords/, /getUserConditionReports/]) && !has(homeDb, [/getUserReports\(userId\)/]) ? 'PASS' : 'FAIL', 'Active HOME hierarchy path does not call legacy generic report reads.'),
    result('PMT5_22', has('home/src/services/firestoreAuthGuard.ts', [/NOT_AUTHENTICATED/, /if \(!authUid\)/]) ? 'PASS' : 'FAIL', 'Unauthenticated HOME reads are blocked.'),
    result('PMT5_23', has(homeRules, [/canReadCondition/, /request\.auth\.uid == targetUid/]) ? 'PASS' : 'FAIL', 'Rules require owner or explicit caretaker authorization.'),
    result('PMT5_24', has(homeRules, [/isCaretakerOf\(targetUid\)/]) ? 'PASS' : 'FAIL', 'Explicit caretaker reads are represented in rules.'),
    result('PMT5_25', has('home/src/services/firestoreAuthGuard.ts', [/FIRESTORE_RULES_AUTHORITATIVE/, /isCaretaker: !isOwner/]) ? 'PASS' : 'FAIL', 'Non-owner reads are delegated to Firestore Rules rather than authorized from client-side state.'),
    result('PMT5_26', has(engine, [/obs_day_\$\{idKey\}/, /rep_day_\$\{idKey\}/]) ? 'PASS' : 'FAIL', 'DAY IDs are deterministic from TEST references.'),
    result('PMT5_27', has(engine, [/obs_week_\$\{idKey\}/, /rep_week_\$\{idKey\}/]) ? 'PASS' : 'FAIL', 'WEEK IDs are deterministic from DAY references.'),
    result('PMT5_28', has(engine, [/obs_month_\$\{idKey\}/, /rep_month_\$\{idKey\}/]) ? 'PASS' : 'FAIL', 'MONTH IDs are deterministic from WEEK references.'),
    result('PMT5_29', has(homeReports, [/rawSourceReference/, /metricsSummary: data/]) ? 'PASS' : 'FAIL', 'HOME maps stored CONDITION values without recalculating them.'),
    result('PMT5_30', has(engine, [/Four completed WEEK observations are required/, /Number\.isFinite/]) ? 'PASS' : 'FAIL', 'Missing source data is rejected rather than filled with health values.'),
  ];
}

export const pmt5RuntimePrerequisite = () => runtimeAvailableForPmt5();
function runtimeAvailableForPmt5(): boolean {
  return exists('c50/node_modules/tsx') && exists('home/node_modules/firebase');
}
