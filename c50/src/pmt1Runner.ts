import * as fs from 'fs';
import * as path from 'path';
import { firebaseConfig, firebaseStatus, firestoreDb, firebaseAuth } from './services/firebase/firebaseConfig';
import { firestoreDatabaseService, ConditionDatabaseService } from './services/firebase/firestoreService';
import { conditionEngine } from './services/condition/conditionEngine';

interface PMT1TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

async function runPMT1Verification() {
  console.log('============================================================');
  console.log('BAND / GOATEST — PMT-1: FIRESTORE FOUNDATION VERIFICATION');
  console.log('============================================================\n');

  const testResults: PMT1TestResult[] = [];

  // TEST 1: Firebase Project Configuration
  try {
    const isProjectCorrect = firebaseConfig.projectId === 'goatest-2525';
    const isAuthDomainCorrect = firebaseConfig.authDomain === 'goatest-2525.firebaseapp.com';
    const hasAppId = Boolean(firebaseConfig.appId);
    const passed = isProjectCorrect && isAuthDomainCorrect && hasAppId;
    testResults.push({
      id: 'PMT1_01',
      name: 'Firebase Project Configuration',
      passed,
      message: `Project ID: ${firebaseConfig.projectId}, Auth Domain: ${firebaseConfig.authDomain}`,
    });
  } catch (err: any) {
    testResults.push({ id: 'PMT1_01', name: 'Firebase Project Configuration', passed: false, message: err.message });
  }

  // TEST 2: Schema Blueprint Integrity (firebase-blueprint.json)
  try {
    const blueprintRaw = fs.readFileSync(path.join(process.cwd(), 'firebase-blueprint.json'), 'utf-8');
    const blueprint = JSON.parse(blueprintRaw);
    const requiredPaths = [
      '/test/{observationId}',
      '/day/{observationId}',
      '/week/{observationId}',
      '/month/{observationId}',
      '/reports_test/{reportId}',
      '/reports_day/{reportId}',
      '/reports_week/{reportId}',
      '/reports_month/{reportId}',
    ];
    const allPathsPresent = requiredPaths.every((p) => Boolean(blueprint.firestore[p]));
    const allEntitiesPresent = ['TestObservation', 'DayObservation', 'WeekObservation', 'MonthObservation', 'TestReport', 'DayReport', 'WeekReport', 'MonthReport']
      .every((e) => Boolean(blueprint.entities[e]));
    const passed = allPathsPresent && allEntitiesPresent;
    testResults.push({
      id: 'PMT1_02',
      name: 'Schema Blueprint 8-Collection Model',
      passed,
      message: `Verified all 8 collections and entities mapped in firebase-blueprint.json`,
    });
  } catch (err: any) {
    testResults.push({ id: 'PMT1_02', name: 'Schema Blueprint 8-Collection Model', passed: false, message: err.message });
  }

  // TEST 3: Security Rules Hardening (firestore.rules)
  try {
    const rulesContent = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');
    const hasDefaultDeny = rulesContent.includes('match /{document=**}') && rulesContent.includes('allow read, write: if false;');
    const hasUidOwnership = rulesContent.includes('request.resource.data.uid == request.auth.uid') || rulesContent.includes('incoming().uid == request.auth.uid');
    const hasTestCollection = rulesContent.includes('match /test/{observationId}');
    const hasDayCollection = rulesContent.includes('match /day/{observationId}');
    const hasWeekCollection = rulesContent.includes('match /week/{observationId}');
    const hasMonthCollection = rulesContent.includes('match /month/{observationId}');
    const hasReportsTest = rulesContent.includes('match /reports_test/{reportId}');
    const hasReportsDay = rulesContent.includes('match /reports_day/{reportId}');
    const hasReportsWeek = rulesContent.includes('match /reports_week/{reportId}');
    const hasReportsMonth = rulesContent.includes('match /reports_month/{reportId}');
    
    const passed = hasDefaultDeny && hasUidOwnership && hasTestCollection && hasDayCollection && 
                   hasWeekCollection && hasMonthCollection && hasReportsTest && hasReportsDay && 
                   hasReportsWeek && hasReportsMonth;

    testResults.push({
      id: 'PMT1_03',
      name: 'Firestore Security Rules Enforcement',
      passed,
      message: `Verified Default Deny + Authenticated UID Isolation for all 8 collections in firestore.rules`,
    });
  } catch (err: any) {
    testResults.push({ id: 'PMT1_03', name: 'Firestore Security Rules Enforcement', passed: false, message: err.message });
  }

  // TEST 4: Service Interface Completeness
  try {
    const service = firestoreDatabaseService;
    const requiredMethods: (keyof ConditionDatabaseService)[] = [
      'initializeDatabase',
      'getDatabaseStatus',
      'writeTestObservation',
      'writeDayObservation',
      'writeWeekObservation',
      'writeMonthObservation',
      'writeTestReport',
      'writeDayReport',
      'writeWeekReport',
      'writeMonthReport',
      'getTestObservation',
      'getDayObservation',
      'getWeekObservation',
      'getMonthObservation',
      'getTestReport',
      'getDayReport',
      'getWeekReport',
      'getMonthReport',
    ];

    const allMethodsImplemented = requiredMethods.every((m) => typeof service[m] === 'function');
    testResults.push({
      id: 'PMT1_04',
      name: 'Database Service Method Interface',
      passed: allMethodsImplemented,
      message: `All 18 canonical observation & report read/write/status methods implemented`,
    });
  } catch (err: any) {
    testResults.push({ id: 'PMT1_04', name: 'Database Service Method Interface', passed: false, message: err.message });
  }

  // TEST 5: UID Enforcement & Rejection of Unauthenticated Writes
  try {
    // Attempt write with empty UID
    const emptyUidRes = await firestoreDatabaseService.writeTestObservation('', {
      id: 'test_empty_uid',
      inputStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    // Attempt write with anonymous UID
    const anonUidRes = await firestoreDatabaseService.writeTestObservation('anonymous_user', {
      id: 'test_anon_uid',
      inputStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    const passed =
      !emptyUidRes.success &&
      emptyUidRes.status === 'CLOUD_AUTH_REQUIRED' &&
      !anonUidRes.success &&
      anonUidRes.status === 'CLOUD_AUTH_REQUIRED';

    testResults.push({
      id: 'PMT1_05',
      name: 'Authenticated UID Mandatory Validation',
      passed,
      message: `Rejected unauthenticated writes with CLOUD_AUTH_REQUIRED status`,
    });
  } catch (err: any) {
    testResults.push({ id: 'PMT1_05', name: 'Authenticated UID Mandatory Validation', passed: false, message: err.message });
  }

  // TEST 6: Non-Leaking Database Status Report
  try {
    const status = firestoreDatabaseService.getDatabaseStatus();
    const noSecretKeys = !('apiKey' in status) && !('serviceAccount' in status) && !('privateKey' in status);
    const hasAllCollections = 
      status.collections.test &&
      status.collections.day &&
      status.collections.week &&
      status.collections.month &&
      status.collections.reports_test &&
      status.collections.reports_day &&
      status.collections.reports_week &&
      status.collections.reports_month;

    const passed = status.firebaseInitialized && status.projectId === 'goatest-2525' && noSecretKeys && hasAllCollections;
    testResults.push({
      id: 'PMT1_06',
      name: 'Database Status API Diagnostics & Privacy',
      passed,
      message: `Status diagnostics verified: Project: ${status.projectId}, Connection: ${status.connectionStatus}, 8 Collections Active, Zero Secret Exposure`,
    });
  } catch (err: any) {
    testResults.push({ id: 'PMT1_06', name: 'Database Status API Diagnostics & Privacy', passed: false, message: err.message });
  }

  // TEST 7: Local Report Store Safe Isolation & Read Protection
  try {
    const testReport = {
      reportId: 'REP-PMT1-TEST-001',
      uid: 'user_clinical_test_01',
      temporalLevel: 'TEST' as const,
      temporalObservationsCount: 1,
      severity: { score: 0.2, label: 'MILD' as const, color: '#f59e0b' },
      confidence: { score: 0.94, level: 'HIGH' as const },
      trend: { score: 0, label: 'N/A' as const },
      patternInterpretation: 'Normative Baseline',
      matchedPattern: {
        matchedDatasetSno: 1,
        matchStatus: 'EXACT' as const,
        distanceScore: 0,
        inputStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        matchedStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        isLabelInconsistent: false,
      },
      conditionSummary: 'Normal normative baseline state.',
      createdAt: new Date().toISOString(),
    };

    // Save report
    await firestoreDatabaseService.writeTestReport('user_clinical_test_01', testReport);

    // Read by owner
    const ownerRead = await firestoreDatabaseService.getTestReport('user_clinical_test_01', 'REP-PMT1-TEST-001');
    
    // Read attempt by intruder
    let intruderBlocked = false;
    try {
      const intruderRead = await firestoreDatabaseService.getTestReport('user_intruder_99', 'REP-PMT1-TEST-001');
      if (!intruderRead.success || intruderRead.data === null) {
        intruderBlocked = true;
      }
    } catch {
      intruderBlocked = true;
    }

    const passed = Boolean(ownerRead.data) && ownerRead.data.reportId === 'REP-PMT1-TEST-001' && intruderBlocked;
    testResults.push({
      id: 'PMT1_07',
      name: 'Owner Scoped Report Retrieval & Isolation',
      passed,
      message: `Owner successfully retrieved report; unauthorized identity access isolated`,
    });
  } catch (err: any) {
    testResults.push({ id: 'PMT1_07', name: 'Owner Scoped Report Retrieval & Isolation', passed: false, message: err.message });
  }

  // Print Summary
  console.log('--- TEST EXECUTION SUMMARY ---');
  testResults.forEach((t) => {
    console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.id} - ${t.name}: ${t.message}`);
  });

  const allPassed = testResults.every((t) => t.passed);
  console.log(`\nPMT-1 Verification Result: ${allPassed ? 'ALL 7 CRITICAL TESTS PASSED' : 'SOME TESTS FAILED'}`);
}

runPMT1Verification();
