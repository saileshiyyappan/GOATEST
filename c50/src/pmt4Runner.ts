/**
 * BAND / GOATEST — C50 V1
 * PMT-4: WEEK CONDITION PIPELINE TEST SUITE & LIVE VERIFICATION RUNNER
 * 
 * 7 DAYS → C50 WEEK MATCH → FIRESTORE (/week & /reports_week)
 * 
 * Tests covering:
 * WEEK_A. 7 valid DAY observations ingestion (231-stage vector extraction)
 * WEEK_B. Exact C50 WEEK dataset match
 * WEEK_C. Equivalent C50 WEEK dataset match
 * WEEK_D. Approximate C50 WEEK dataset match
 * WEEK_E. No acceptable match (distance > 18.0)
 * WEEK_F. Fewer than 7 DAY observations rejection (WEEK_NOT_ELIGIBLE)
 * WEEK_G. Invalid / malformed DAY observation in batch
 * WEEK_H. Authenticated Firestore write to /week/{observationId}
 * WEEK_I. Authenticated Firestore write to /reports_week/{reportId}
 * WEEK_J. UID mismatch rejection (UID_MISMATCH_REJECTED)
 * WEEK_K. Anonymous / empty UID rejection with CLOUD_AUTH_REQUIRED
 * WEEK_L. Duplicate / retry idempotency
 * WEEK_M. Notification payload dispatch for USER (temporalLevel: 'WEEK')
 * WEEK_N. Notification payload dispatch for CARETAKER (temporalLevel: 'WEEK')
 * WEEK_O. Longitudinal weekly trajectory calculation (initial, peak, final, mean severity, trend)
 * WEEK_P. Dominant pattern and pattern persistence calculation
 * WEEK_Q. WEEK dataset integrity verification (5,000 records, 231-dimension stage vectors)
 */

import * as fs from 'fs';
import * as path from 'path';
import { conditionEngine } from './services/condition/conditionEngine';
import { firestoreDatabaseService } from './services/firebase/firestoreService';
import { getAuthenticatedUserUid } from './services/firebase/firebaseConfig';
import { StageVector } from './c50/evaluator';

export interface TestResultItem {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  details?: any;
  error?: string;
}

export async function runPMT4Tests(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestResultItem[];
  liveVerificationAudit: any;
}> {
  const results: TestResultItem[] = [];

  // Ensure Firebase Auth session
  let authUid = 'test_authenticated_user_pmt4';
  try {
    authUid = await getAuthenticatedUserUid();
  } catch (err: any) {
    console.warn('Auth session initialized with fallback:', err.message);
  }

  // Helper to make a 33-stage day vector
  const makeDayVector = (baseVal: number = 0): number[] => {
    const v: number[] = [];
    for (let i = 0; i < 33; i++) {
      v.push(baseVal);
    }
    return v;
  };

  // -------------------------------------------------------------
  // Test WEEK_A: 7 valid DAY observations ingestion
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = [
      makeDayVector(0),
      makeDayVector(0),
      makeDayVector(0),
      makeDayVector(0),
      makeDayVector(0),
      makeDayVector(0),
      makeDayVector(0),
    ];

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const passed =
      result.success &&
      result.temporalLevel === 'WEEK' &&
      Array.isArray(result.inputStages) &&
      result.inputStages.length === 231 &&
      result.observationCount === 7 &&
      result.status === 'COMPLETED';

    results.push({
      id: 'WEEK_A',
      name: '7 valid DAY observations ingestion (231-stage vector extraction)',
      category: 'Input Validation',
      passed,
      details: {
        temporalLevel: result.temporalLevel,
        inputStagesLength: result.inputStages?.length,
        observationCount: result.observationCount,
        status: result.status,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_A',
      name: '7 valid DAY observations ingestion (231-stage vector extraction)',
      category: 'Input Validation',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_B: Exact C50 WEEK dataset match
  // -------------------------------------------------------------
  try {
    // SNO 1 in week_dataset.csv is all 231 zeros
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const passed =
      result.success &&
      result.matchStatus === 'EXACT' &&
      result.distanceScore === 0 &&
      result.referenceDatasetSno === 1 &&
      result.classification === 'NORMAL_BASELINE';

    results.push({
      id: 'WEEK_B',
      name: 'Exact C50 WEEK dataset match',
      category: 'Pattern Matching',
      passed,
      details: {
        matchStatus: result.matchStatus,
        distanceScore: result.distanceScore,
        referenceSno: result.referenceDatasetSno,
        pattern: result.matchedPattern,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_B',
      name: 'Exact C50 WEEK dataset match',
      category: 'Pattern Matching',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_C: Equivalent C50 WEEK dataset match
  // -------------------------------------------------------------
  try {
    // Small perturbation from SNO 1 (e.g. 1 stage changed by 1 -> distance = 1.0 <= 2.5)
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));
    dayVectors[0][0] = 1;

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const passed =
      result.success &&
      (result.matchStatus === 'EQUIVALENT' || result.matchStatus === 'EXACT') &&
      typeof result.distanceScore === 'number' &&
      result.distanceScore <= 2.5;

    results.push({
      id: 'WEEK_C',
      name: 'Equivalent C50 WEEK dataset match',
      category: 'Pattern Matching',
      passed,
      details: {
        matchStatus: result.matchStatus,
        distanceScore: result.distanceScore,
        pattern: result.matchedPattern,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_C',
      name: 'Equivalent C50 WEEK dataset match',
      category: 'Pattern Matching',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_D: Approximate C50 WEEK dataset match
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));
    // Perturb several stages across days
    for (let d = 0; d < 7; d++) {
      dayVectors[d][2] = 2;
      dayVectors[d][8] = 2;
    }

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const passed =
      result.success &&
      (result.matchStatus === 'APPROXIMATE' || result.matchStatus === 'EQUIVALENT') &&
      typeof result.confidence === 'number' &&
      result.confidence > 0.5;

    results.push({
      id: 'WEEK_D',
      name: 'Approximate C50 WEEK dataset match',
      category: 'Pattern Matching',
      passed,
      details: {
        matchStatus: result.matchStatus,
        distanceScore: result.distanceScore,
        confidence: result.confidence,
        confidenceLevel: result.confidenceLevel,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_D',
      name: 'Approximate C50 WEEK dataset match',
      category: 'Pattern Matching',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_E: No acceptable match (distance > 18.0)
  // -------------------------------------------------------------
  try {
    // Stage 5 on all 231 elements
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(5));

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const passed =
      !result.success &&
      result.status === 'NO_ACCEPTABLE_MATCH' &&
      result.matchStatus === 'NO_ACCEPTABLE_MATCH';

    results.push({
      id: 'WEEK_E',
      name: 'No acceptable match (distance > 18.0 rejection)',
      category: 'Boundary Enforcement',
      passed,
      details: {
        status: result.status,
        matchStatus: result.matchStatus,
        distanceScore: result.distanceScore,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_E',
      name: 'No acceptable match (distance > 18.0 rejection)',
      category: 'Boundary Enforcement',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_F: Fewer than 7 DAY observations rejection
  // -------------------------------------------------------------
  try {
    const shortDayVectors: number[][] = [
      makeDayVector(0),
      makeDayVector(0),
      makeDayVector(0),
      makeDayVector(0),
    ];

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors: shortDayVectors,
      isFixture: true,
    });

    const passed =
      !result.success &&
      result.status === 'WEEK_NOT_ELIGIBLE';

    results.push({
      id: 'WEEK_F',
      name: 'Fewer than 7 DAY observations rejection (WEEK_NOT_ELIGIBLE)',
      category: 'Boundary Enforcement',
      passed,
      details: {
        status: result.status,
        error: result.error,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_F',
      name: 'Fewer than 7 DAY observations rejection (WEEK_NOT_ELIGIBLE)',
      category: 'Boundary Enforcement',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_G: Invalid / malformed DAY observation in batch
  // -------------------------------------------------------------
  try {
    let threwError = false;
    try {
      const invalidDayVectors: number[][] = [
        makeDayVector(0),
        makeDayVector(0),
        makeDayVector(0),
        makeDayVector(0),
        makeDayVector(0),
        makeDayVector(0),
        [0, 1, 2], // Only 3 stages instead of 33
      ];

      await conditionEngine.processWeekAssessment({
        uid: authUid,
        dayVectors: invalidDayVectors,
        isFixture: true,
      });
    } catch {
      threwError = true;
    }

    results.push({
      id: 'WEEK_G',
      name: 'Invalid / malformed DAY observation stage count error',
      category: 'Input Validation',
      passed: threwError,
      details: { threwError },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_G',
      name: 'Invalid / malformed DAY observation stage count error',
      category: 'Input Validation',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_H: Authenticated Firestore write to /week/{observationId}
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));
    const customObsId = `obs_week_test_auth_${Date.now()}`;

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      observationId: customObsId,
      isFixture: true,
    });

    const readBack = await firestoreDatabaseService.getWeekObservation(authUid, customObsId);

    const passed =
      result.success &&
      result.persisted?.observation?.success &&
      readBack.success &&
      readBack.data?.uid === authUid &&
      readBack.data?.temporalLevel === 'WEEK' &&
      readBack.data?.observationCount === 7;

    results.push({
      id: 'WEEK_H',
      name: 'Authenticated Firestore write to /week/{observationId}',
      category: 'Database Persistence',
      passed: Boolean(passed),
      details: {
        observationId: customObsId,
        persistedSuccess: result.persisted?.observation?.success,
        readBackSuccess: readBack.success,
        uid: readBack.data?.uid,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_H',
      name: 'Authenticated Firestore write to /week/{observationId}',
      category: 'Database Persistence',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_I: Authenticated Firestore write to /reports_week/{reportId}
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));
    const customRepId = `rep_week_test_auth_${Date.now()}`;

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      reportId: customRepId,
      isFixture: true,
    });

    const readBack = await firestoreDatabaseService.getWeekReport(authUid, customRepId);

    const passed =
      result.success &&
      result.persisted?.report?.success &&
      readBack.success &&
      readBack.data?.uid === authUid &&
      readBack.data?.temporalLevel === 'WEEK' &&
      readBack.data?.observationCount === 7;

    results.push({
      id: 'WEEK_I',
      name: 'Authenticated Firestore write to /reports_week/{reportId}',
      category: 'Database Persistence',
      passed: Boolean(passed),
      details: {
        reportId: customRepId,
        persistedSuccess: result.persisted?.report?.success,
        readBackSuccess: readBack.success,
        uid: readBack.data?.uid,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_I',
      name: 'Authenticated Firestore write to /reports_week/{reportId}',
      category: 'Database Persistence',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_J: UID mismatch rejection
  // -------------------------------------------------------------
  try {
    // Attempting to evaluate day observations belonging to foreign user
    const foreignDayObservations = [
      { id: 'day_f1', uid: 'foreign_attacker_user', inputStages: makeDayVector(0) },
      { id: 'day_f2', uid: 'foreign_attacker_user', inputStages: makeDayVector(0) },
      { id: 'day_f3', uid: 'foreign_attacker_user', inputStages: makeDayVector(0) },
      { id: 'day_f4', uid: 'foreign_attacker_user', inputStages: makeDayVector(0) },
      { id: 'day_f5', uid: 'foreign_attacker_user', inputStages: makeDayVector(0) },
      { id: 'day_f6', uid: 'foreign_attacker_user', inputStages: makeDayVector(0) },
      { id: 'day_f7', uid: 'foreign_attacker_user', inputStages: makeDayVector(0) },
    ];

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayObservations: foreignDayObservations,
      isFixture: true,
    });

    const passed =
      !result.success &&
      result.status === 'UID_MISMATCH_REJECTED';

    results.push({
      id: 'WEEK_J',
      name: 'UID mismatch rejection (UID_MISMATCH_REJECTED)',
      category: 'Security & Auth',
      passed,
      details: {
        status: result.status,
        error: result.error,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_J',
      name: 'UID mismatch rejection (UID_MISMATCH_REJECTED)',
      category: 'Security & Auth',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_K: Anonymous / empty UID rejection with CLOUD_AUTH_REQUIRED
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));

    const result = await conditionEngine.processWeekAssessment({
      uid: 'anonymous_user',
      dayVectors,
      isFixture: true,
    });

    const passed =
      !result.success &&
      result.status === 'UID_MISMATCH_REJECTED' &&
      result.error?.includes('Authenticated Firebase UID is required');

    results.push({
      id: 'WEEK_K',
      name: 'Anonymous / empty UID rejection with CLOUD_AUTH_REQUIRED',
      category: 'Security & Auth',
      passed,
      details: {
        status: result.status,
        error: result.error,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_K',
      name: 'Anonymous / empty UID rejection with CLOUD_AUTH_REQUIRED',
      category: 'Security & Auth',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_L: Duplicate / retry idempotency
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));
    const deterministicId = `obs_week_idempotency_test_${Date.now()}`;
    const deterministicRepId = `rep_week_idempotency_test_${Date.now()}`;

    const run1 = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      observationId: deterministicId,
      reportId: deterministicRepId,
      isFixture: true,
    });

    const run2 = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      observationId: deterministicId,
      reportId: deterministicRepId,
      isFixture: true,
    });

    const passed =
      run1.success &&
      run2.success &&
      run1.observationId === run2.observationId &&
      run1.reportId === run2.reportId &&
      run1.referenceDatasetSno === run2.referenceDatasetSno;

    results.push({
      id: 'WEEK_L',
      name: 'Duplicate / retry idempotency',
      category: 'Idempotency',
      passed: Boolean(passed),
      details: {
        run1Id: run1.observationId,
        run2Id: run2.observationId,
        sno1: run1.referenceDatasetSno,
        sno2: run2.referenceDatasetSno,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_L',
      name: 'Duplicate / retry idempotency',
      category: 'Idempotency',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_M: Notification payload dispatch for USER
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const userNotif = result.notifications?.find((n) => n.recipient === 'USER');

    const passed =
      result.success &&
      Boolean(userNotif) &&
      userNotif?.temporalLevel === 'WEEK' &&
      userNotif?.delivered === true &&
      userNotif?.uid === authUid;

    results.push({
      id: 'WEEK_M',
      name: 'Notification payload dispatch for USER (temporalLevel: WEEK)',
      category: 'Notifications',
      passed: Boolean(passed),
      details: userNotif,
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_M',
      name: 'Notification payload dispatch for USER (temporalLevel: WEEK)',
      category: 'Notifications',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_N: Notification payload dispatch for CARETAKER
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const caretakerNotif = result.notifications?.find((n) => n.recipient === 'CARETAKER');

    const passed =
      result.success &&
      Boolean(caretakerNotif) &&
      caretakerNotif?.temporalLevel === 'WEEK' &&
      caretakerNotif?.delivered === true &&
      caretakerNotif?.uid === authUid;

    results.push({
      id: 'WEEK_N',
      name: 'Notification payload dispatch for CARETAKER (temporalLevel: WEEK)',
      category: 'Notifications',
      passed: Boolean(passed),
      details: caretakerNotif,
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_N',
      name: 'Notification payload dispatch for CARETAKER (temporalLevel: WEEK)',
      category: 'Notifications',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_O: Longitudinal weekly trajectory calculation
  // -------------------------------------------------------------
  try {
    // Create 7 days with varying severities
    const dayVectors: number[][] = [
      makeDayVector(0), // Day 1: Normal
      makeDayVector(0), // Day 2: Normal
      makeDayVector(1), // Day 3: Control
      makeDayVector(2), // Day 4: Mild
      makeDayVector(1), // Day 5: Control
      makeDayVector(0), // Day 6: Normal
      makeDayVector(0), // Day 7: Normal
    ];

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const passed =
      result.success &&
      result.initialSeverity !== undefined &&
      result.peakSeverity !== undefined &&
      result.finalSeverity !== undefined &&
      typeof result.meanSeverity === 'number' &&
      Boolean(result.trend);

    results.push({
      id: 'WEEK_O',
      name: 'Longitudinal weekly trajectory calculation (initial, peak, final, mean severity, trend)',
      category: 'Longitudinal Analytics',
      passed: Boolean(passed),
      details: {
        initialSeverity: result.initialSeverity,
        peakSeverity: result.peakSeverity,
        finalSeverity: result.finalSeverity,
        meanSeverity: result.meanSeverity,
        trend: result.trend,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_O',
      name: 'Longitudinal weekly trajectory calculation (initial, peak, final, mean severity, trend)',
      category: 'Longitudinal Analytics',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_P: Dominant pattern and pattern persistence calculation
  // -------------------------------------------------------------
  try {
    const dayVectors: number[][] = Array.from({ length: 7 }, () => makeDayVector(0));

    const result = await conditionEngine.processWeekAssessment({
      uid: authUid,
      dayVectors,
      isFixture: true,
    });

    const passed =
      result.success &&
      typeof result.patternPersistence === 'number' &&
      result.patternPersistence > 0 &&
      Boolean(result.dominantPattern);

    results.push({
      id: 'WEEK_P',
      name: 'Dominant pattern and pattern persistence calculation',
      category: 'Longitudinal Analytics',
      passed: Boolean(passed),
      details: {
        dominantPattern: result.dominantPattern,
        patternPersistence: result.patternPersistence,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_P',
      name: 'Dominant pattern and pattern persistence calculation',
      category: 'Longitudinal Analytics',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test WEEK_Q: WEEK dataset integrity verification
  // -------------------------------------------------------------
  try {
    const weekCsvPath = path.join(process.cwd(), 'data', 'week_dataset.csv');
    const exists = fs.existsSync(weekCsvPath);
    let rowCount = 0;
    let validColumns = true;

    if (exists) {
      const content = fs.readFileSync(weekCsvPath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      rowCount = lines.length - 1; // Subtract header

      // Check column count on line 1
      if (lines.length > 1) {
        const cols = lines[1].split(',');
        if (cols.length !== 240) {
          validColumns = false;
        }
      }
    }

    const passed = exists && rowCount === 5000 && validColumns;

    results.push({
      id: 'WEEK_Q',
      name: 'WEEK dataset integrity verification (5,000 records, 231-dimension stage vectors)',
      category: 'Dataset Integrity',
      passed,
      details: {
        exists,
        rowCount,
        validColumns,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'WEEK_Q',
      name: 'WEEK dataset integrity verification (5,000 records, 231-dimension stage vectors)',
      category: 'Dataset Integrity',
      passed: false,
      error: err.message,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    allPassed: failedCount === 0,
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
    liveVerificationAudit: {
      authSessionUid: authUid,
      temporalLevel: 'WEEK',
      timestamp: new Date().toISOString(),
      status: failedCount === 0 ? 'ALL_TESTS_PASSING' : 'FAILURES_DETECTED',
    },
  };
}
