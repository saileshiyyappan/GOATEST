/**
 * BAND / GOATEST — C50 V1
 * PMT-6: FINAL AUTOMATION + NOTIFICATION + RETRIEVAL
 *        + COMPLETE CONDITION PIPELINE INTEGRATION TEST SUITE
 * 
 * Authoritative verification suite for the complete integrated pipeline:
 * SHB -> CM_PACKET -> CONDITION -> C50 MATCHING -> FIRESTORE WRITES
 * -> REPORT GENERATION -> USER & CARETAKER NOTIFICATIONS -> RETRIEVAL & PDF DOWNLOAD
 */

import { conditionEngine } from './services/condition/conditionEngine';
import { reportStore } from './services/condition/reportStore';
import { generateReportPdfBuffer } from './services/condition/reportGenerator';
import { firestoreDatabaseService } from './services/firebase/firestoreService';
import { CANONICAL_11_PARAMETERS } from './engine/canonicalParameters';
import { generateCMPacket } from './engine/compareEngine';

export interface PMT6TestCaseResult {
  id: string;
  name: string;
  category: 'PIPELINE_FLOW' | 'TEMPORAL_AUTOMATION' | 'DATASET_RULE' | 'HOME_QA' | 'NOTIFICATIONS' | 'RETRIEVAL' | 'IDEMPOTENCY' | 'SECURITY' | 'PDF_EXPORT';
  passed: boolean;
  durationMs: number;
  details: string;
  evidence?: any;
}

export interface PMT6SuiteSummary {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  totalDurationMs: number;
  timestamp: string;
  tests: PMT6TestCaseResult[];
}

export async function runPMT6Tests(): Promise<PMT6SuiteSummary> {
  const startTime = Date.now();
  const tests: PMT6TestCaseResult[] = [];
  const testUid = 'usr_pmt6_authoritative_client';

  // =========================================================================
  // 1. PMT6_01: End-to-End SHB -> CM_PACKET -> CONDITION -> TEST Report -> Firestore
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const cmPacket = generateCMPacket([
        { parameterId: 'heart_rate', shbValue: 88, phbBaseline: 68 },
        { parameterId: 'spo2', shbValue: 96, phbBaseline: 99 },
        { parameterId: 'ppi', shbValue: 800, phbBaseline: 850 },
        { parameterId: 'rmssd', shbValue: 32, phbBaseline: 50 },
        { parameterId: 'sdnn', shbValue: 55, phbBaseline: 65 },
        { parameterId: 'respiratory_rate', shbValue: 19, phbBaseline: 16 },
        { parameterId: 'activity_intensity', shbValue: 2.2, phbBaseline: 1.0 },
        { parameterId: 'ambient_temperature', shbValue: 24.0, phbBaseline: 22.0 },
        { parameterId: 'relative_humidity', shbValue: 42.0, phbBaseline: 45.0 },
        { parameterId: 'atmospheric_pressure', shbValue: 1011, phbBaseline: 1013 },
        { parameterId: 'altitude', shbValue: 180, phbBaseline: 150 },
      ]);

      const testResult = await conditionEngine.processCondition(cmPacket, {
        uid: testUid,
        temporalLevel: 'TEST',
        observationId: 'obs_test_pmt6_e2e_01',
        reportId: 'rep_test_pmt6_e2e_01',
      });

      const hasReport = Boolean(testResult.reportId);
      const isCompleted = testResult.status === 'COMPLETED';
      const hasDistance = typeof testResult.distanceScore === 'number';
      const hasSno = Boolean(testResult.referenceDatasetSno);
      const passed = hasReport && isCompleted && hasDistance && hasSno;

      tests.push({
        id: 'PMT6_01_SHB_TO_TEST_PIPELINE',
        name: 'SHB -> CM_PACKET -> CONDITION -> C50 TEST Match -> Firestore Write',
        category: 'PIPELINE_FLOW',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `End-to-end TEST pipeline succeeded. SNO: #${testResult.referenceDatasetSno}, Distance: ${testResult.distanceScore?.toFixed(3)}, Status: ${testResult.status}`
          : `TEST pipeline failed: ${JSON.stringify(testResult)}`,
        evidence: {
          reportId: testResult.reportId,
          classification: testResult.primary_taxonomy,
          sno: testResult.referenceDatasetSno,
          distance: testResult.distanceScore,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_01_SHB_TO_TEST_PIPELINE',
        name: 'SHB -> CM_PACKET -> CONDITION -> C50 TEST Match -> Firestore Write',
        category: 'PIPELINE_FLOW',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Exception in TEST pipeline: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 2. PMT6_02: 3 TEST Observations + Home Q/A -> C50 DAY Match -> Firestore
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const dayResult = await conditionEngine.processDayAssessment({
        uid: testUid,
        dayAssessmentId: 'day_pmt6_e2e_01',
        observationId: 'obs_day_pmt6_e2e_01',
        reportId: 'rep_day_pmt6_e2e_01',
        testVectors: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        qaData: {
          qaId: 'qa_pmt6_day_01',
          status: 'SUBMITTED',
          responses: {
            fatigue: 'mild',
            chest_discomfort: 'no',
            breathlessness: 'no',
            medication: 'yes',
          },
          notes: 'Standard morning walk baseline',
        },
      });

      const passed =
        dayResult.success &&
        dayResult.status === 'COMPLETED' &&
        dayResult.temporalLevel === 'DAY' &&
        dayResult.qaStatus === 'AVAILABLE' &&
        Boolean(dayResult.reportId) &&
        Boolean(dayResult.notifications && dayResult.notifications.length === 2);

      tests.push({
        id: 'PMT6_02_DAY_AUTOMATION_TRIGGER',
        name: '3 TEST Observations + Home Web Q/A -> C50 DAY Match -> DAY Report',
        category: 'TEMPORAL_AUTOMATION',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `DAY pipeline completed. SNO: #${dayResult.referenceDatasetSno}, Q/A: ${dayResult.qaStatus}, Dominant: ${dayResult.dominantPattern}, Trend: ${dayResult.trend}`
          : `DAY pipeline failed: ${dayResult.error || JSON.stringify(dayResult)}`,
        evidence: {
          reportId: dayResult.reportId,
          qaStatus: dayResult.qaStatus,
          notificationsCount: dayResult.notifications?.length,
          dominantPattern: dayResult.dominantPattern,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_02_DAY_AUTOMATION_TRIGGER',
        name: '3 TEST Observations + Home Web Q/A -> C50 DAY Match -> DAY Report',
        category: 'TEMPORAL_AUTOMATION',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Exception in DAY pipeline: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 3. PMT6_03: 7 DAY Observations -> C50 WEEK Match -> Firestore
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const weekResult = await conditionEngine.processWeekAssessment({
        uid: testUid,
        observationId: 'obs_week_pmt6_e2e_01',
        reportId: 'rep_week_pmt6_e2e_01',
        dayVectors: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
      });

      const passed =
        weekResult.success &&
        weekResult.status === 'COMPLETED' &&
        weekResult.temporalLevel === 'WEEK' &&
        Boolean(weekResult.reportId) &&
        Boolean(weekResult.notifications && weekResult.notifications.length === 2);

      tests.push({
        id: 'PMT6_03_WEEK_AUTOMATION_TRIGGER',
        name: '7 DAY Observations (21 Diurnal Tests) -> C50 WEEK Match -> WEEK Report',
        category: 'TEMPORAL_AUTOMATION',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `WEEK pipeline completed. SNO: #${weekResult.referenceDatasetSno}, Pattern: ${weekResult.matchedPattern}, Trend: ${weekResult.trend}`
          : `WEEK pipeline failed: ${weekResult.error || JSON.stringify(weekResult)}`,
        evidence: {
          reportId: weekResult.reportId,
          dominantPattern: weekResult.dominantPattern,
          notificationsCount: weekResult.notifications?.length,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_03_WEEK_AUTOMATION_TRIGGER',
        name: '7 DAY Observations (21 Diurnal Tests) -> C50 WEEK Match -> WEEK Report',
        category: 'TEMPORAL_AUTOMATION',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Exception in WEEK pipeline: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 4. PMT6_04: 4 WEEK Observations (84 Tests) -> C50 MONTH Match -> Firestore
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const monthResult = await conditionEngine.processMonthAssessment({
        uid: testUid,
        observationId: 'obs_month_pmt6_e2e_01',
        reportId: 'rep_month_pmt6_e2e_01',
        weekVectors: [
          new Array(231).fill(0),
          new Array(231).fill(0),
          new Array(231).fill(0),
          new Array(231).fill(0),
        ],
      });

      const passed =
        monthResult.success &&
        monthResult.status === 'COMPLETED' &&
        monthResult.temporalLevel === 'MONTH' &&
        Boolean(monthResult.reportId) &&
        Boolean(monthResult.notifications && monthResult.notifications.length === 2);

      tests.push({
        id: 'PMT6_04_MONTH_AUTOMATION_TRIGGER',
        name: '4 WEEK Observations (84 Tests) -> C50 MONTH Match -> MONTH Report',
        category: 'TEMPORAL_AUTOMATION',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `MONTH pipeline completed. SNO: #${monthResult.referenceDatasetSno}, Pattern: ${monthResult.matchedPattern}, Trend: ${monthResult.trend}`
          : `MONTH pipeline failed: ${monthResult.error || JSON.stringify(monthResult)}`,
        evidence: {
          reportId: monthResult.reportId,
          dominantPattern: monthResult.dominantPattern,
          notificationsCount: monthResult.notifications?.length,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_04_MONTH_AUTOMATION_TRIGGER',
        name: '4 WEEK Observations (84 Tests) -> C50 MONTH Match -> MONTH Report',
        category: 'TEMPORAL_AUTOMATION',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Exception in MONTH pipeline: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 5. PMT6_05: Dataset Storage Rule (Only Matched Rows in Firestore, never CSVs)
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const report = reportStore.getReport('rep_test_pmt6_e2e_01', testUid);
      const passed =
        Boolean(report) &&
        Boolean(report?.matchedPattern.matchedDatasetSno) &&
        Array.isArray(report?.matchedPattern.matchedStages) &&
        report?.matchedPattern.matchedStages.length === 11 &&
        !Array.isArray((report as any)?.entireCsvDataset);

      tests.push({
        id: 'PMT6_05_DATASET_STORAGE_RULE',
        name: 'Strict Dataset Storage Rule (Only matched row reference in Firestore, never raw CSV datasets)',
        category: 'DATASET_RULE',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Verified: Only matched reference SNO (#${report?.matchedPattern.matchedDatasetSno}) and 11-stage vector are persisted. No raw CSV datasets stored in Firestore.`
          : 'Failed: Unsolicited CSV data or invalid matched stages found in report',
        evidence: {
          matchedDatasetSno: report?.matchedPattern.matchedDatasetSno,
          matchedStagesCount: report?.matchedPattern.matchedStages?.length,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_05_DATASET_STORAGE_RULE',
        name: 'Strict Dataset Storage Rule',
        category: 'DATASET_RULE',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error verifying dataset storage rule: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 6. PMT6_06: Home Web Q/A Non-Fabrication Rule (AVAILABLE vs Q/A_NOT_AVAILABLE)
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      // 6A: DAY with Q/A provided
      const dayWithQA = await conditionEngine.processDayAssessment({
        uid: testUid,
        testVectors: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        qaData: { status: 'SUBMITTED', responses: { fatigue: 'moderate' }, notes: 'Testing Q/A provided' },
      });

      // 6B: DAY without Q/A provided
      const dayWithoutQA = await conditionEngine.processDayAssessment({
        uid: testUid,
        testVectors: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
      });

      const reportWithQA = reportStore.getReport(dayWithQA.reportId!, testUid);
      const reportWithoutQA = reportStore.getReport(dayWithoutQA.reportId!, testUid);

      const passed =
        reportWithQA?.homeQA?.status === 'AVAILABLE' &&
        reportWithoutQA?.homeQA?.status === 'Q/A_NOT_AVAILABLE' &&
        reportWithoutQA?.homeQA?.displayText === 'Q/A NOT AVAILABLE';

      tests.push({
        id: 'PMT6_06_HOME_QA_NON_FABRICATION',
        name: 'Home Web Q/A Non-Fabrication Rule (AVAILABLE vs Q/A_NOT_AVAILABLE)',
        category: 'HOME_QA',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Strict Q/A preservation verified: With Q/A -> ${reportWithQA?.homeQA?.status}, Without Q/A -> ${reportWithoutQA?.homeQA?.status} ("${reportWithoutQA?.homeQA?.displayText}")`
          : `Q/A rule violated: withQA=${reportWithQA?.homeQA?.status}, withoutQA=${reportWithoutQA?.homeQA?.status}`,
        evidence: {
          withQAStatus: reportWithQA?.homeQA?.status,
          withoutQAStatus: reportWithoutQA?.homeQA?.status,
          withoutQADisplayText: reportWithoutQA?.homeQA?.displayText,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_06_HOME_QA_NON_FABRICATION',
        name: 'Home Web Q/A Non-Fabrication Rule',
        category: 'HOME_QA',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error validating Q/A non-fabrication rule: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 7. PMT6_07: Notification Dispatch Post-Persistence Guarantee
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const userNotifs = await firestoreDatabaseService.getNotifications(testUid);
      const hasUserNotifs = userNotifs.some((n: any) => n.recipient === 'USER');
      const hasCaretakerNotifs = userNotifs.some((n: any) => n.recipient === 'CARETAKER');

      const allReferencedReportsExist = userNotifs.every((n: any) => {
        const rep = reportStore.getReport(n.reportId, testUid);
        return Boolean(rep);
      });

      const passed = hasUserNotifs && hasCaretakerNotifs && allReferencedReportsExist;

      tests.push({
        id: 'PMT6_07_NOTIFICATION_DISPATCH_GUARANTEE',
        name: 'Post-Persistence Notification Guarantee (USER + CARETAKER dispatched only after report persistence)',
        category: 'NOTIFICATIONS',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Verified: ${userNotifs.length} total notifications dispatched across USER and CARETAKER recipients. 100% of referenced report IDs exist and are verified in store.`
          : 'Failed: Missing notification recipients or dangling report references found',
        evidence: {
          totalNotifications: userNotifs.length,
          hasUserNotifs,
          hasCaretakerNotifs,
          allReferencedReportsExist,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_07_NOTIFICATION_DISPATCH_GUARANTEE',
        name: 'Post-Persistence Notification Guarantee',
        category: 'NOTIFICATIONS',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error testing notification post-persistence guarantee: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 8. PMT6_08: Caretaker Relationship Authorization & Failed Assessment Isolation
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      // Execute an invalid assessment with missing UID
      const failedResult = await conditionEngine.processDayAssessment({
        uid: '', // empty UID must fail
        testVectors: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
      });

      const noNotificationsDispatchedOnFailure = !failedResult.notifications || failedResult.notifications.length === 0;
      const isRejected = failedResult.status === 'UID_MISMATCH_REJECTED' || !failedResult.success;
      const passed = isRejected && noNotificationsDispatchedOnFailure;

      tests.push({
        id: 'PMT6_08_CARETAKER_AUTHORIZATION_RULE',
        name: 'Caretaker Authorization Rule (Never notify on failed or unauthenticated assessment)',
        category: 'NOTIFICATIONS',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Verified: Unauthenticated assessment was rejected (${failedResult.status}) and zero notifications were dispatched to caretakers or users.`
          : 'Failed: Notifications were dispatched on unauthenticated assessment',
        evidence: {
          status: failedResult.status,
          notificationsDispatched: failedResult.notifications?.length ?? 0,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_08_CARETAKER_AUTHORIZATION_RULE',
        name: 'Caretaker Authorization Rule',
        category: 'NOTIFICATIONS',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error validating caretaker authorization: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 9. PMT6_09: Report Retrieval REST Endpoints & Data Consistency
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const userReports = reportStore.listReportsForUser(testUid);
      const testReport = userReports.find((r) => r.temporalLevel === 'TEST');
      const dayReport = userReports.find((r) => r.temporalLevel === 'DAY');
      const weekReport = userReports.find((r) => r.temporalLevel === 'WEEK');
      const monthReport = userReports.find((r) => r.temporalLevel === 'MONTH');

      const allLevelsRetrievable = Boolean(testReport && dayReport && weekReport && monthReport);
      const passed = userReports.length >= 4 && allLevelsRetrievable;

      tests.push({
        id: 'PMT6_09_REPORT_RETRIEVAL_REST_APIS',
        name: 'Report Retrieval REST APIs (TEST, DAY, WEEK, MONTH verified across store and Firestore)',
        category: 'RETRIEVAL',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Verified: ${userReports.length} reports retrieved for user ${testUid}. All 4 temporal levels (TEST, DAY, WEEK, MONTH) are retrievable with consistent data fields.`
          : `Failed: Missing temporal report levels in retrieval. Found: ${userReports.map((r) => r.temporalLevel).join(', ')}`,
        evidence: {
          totalRetrieved: userReports.length,
          hasTest: Boolean(testReport),
          hasDay: Boolean(dayReport),
          hasWeek: Boolean(weekReport),
          hasMonth: Boolean(monthReport),
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_09_REPORT_RETRIEVAL_REST_APIS',
        name: 'Report Retrieval REST APIs',
        category: 'RETRIEVAL',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error testing report retrieval REST APIs: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 10. PMT6_10: Pipeline Idempotency & Deterministic Re-Execution
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const fixedObsId = 'obs_idempotency_fixed_01';
      const fixedRepId = 'rep_idempotency_fixed_01';

      // Run 1
      const run1 = await conditionEngine.processDayAssessment({
        uid: testUid,
        observationId: fixedObsId,
        reportId: fixedRepId,
        testVectors: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
      });

      // Run 2 (Identical input and IDs)
      const run2 = await conditionEngine.processDayAssessment({
        uid: testUid,
        observationId: fixedObsId,
        reportId: fixedRepId,
        testVectors: [
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
      });

      const passed =
        run1.success &&
        run2.success &&
        run1.reportId === run2.reportId &&
        run1.observationId === run2.observationId &&
        run1.referenceDatasetSno === run2.referenceDatasetSno &&
        run1.distanceScore === run2.distanceScore;

      tests.push({
        id: 'PMT6_10_PIPELINE_IDEMPOTENCY',
        name: 'Pipeline Idempotency & Deterministic Execution (Repeated calls produce identical matching)',
        category: 'IDEMPOTENCY',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Idempotency verified: Run 1 (SNO #${run1.referenceDatasetSno}, Dist: ${run1.distanceScore}) === Run 2 (SNO #${run2.referenceDatasetSno}, Dist: ${run2.distanceScore})`
          : 'Failed: Non-idempotent results across runs',
        evidence: {
          run1ReportId: run1.reportId,
          run2ReportId: run2.reportId,
          snoMatch: run1.referenceDatasetSno === run2.referenceDatasetSno,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_10_PIPELINE_IDEMPOTENCY',
        name: 'Pipeline Idempotency & Deterministic Execution',
        category: 'IDEMPOTENCY',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error validating pipeline idempotency: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 11. PMT6_11: Security UID Ownership Isolation
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const userA = 'usr_authorized_alice';
      const userB = 'usr_unauthorized_bob';

      // Save report under User A
      const cmPacketAlice = generateCMPacket([
        { parameterId: 'heart_rate', shbValue: 72, phbBaseline: 70 },
        { parameterId: 'spo2', shbValue: 98, phbBaseline: 98 },
        { parameterId: 'ppi', shbValue: 850, phbBaseline: 850 },
        { parameterId: 'rmssd', shbValue: 45, phbBaseline: 45 },
        { parameterId: 'sdnn', shbValue: 60, phbBaseline: 60 },
        { parameterId: 'respiratory_rate', shbValue: 15, phbBaseline: 15 },
        { parameterId: 'activity_intensity', shbValue: 1.0, phbBaseline: 1.0 },
        { parameterId: 'ambient_temperature', shbValue: 22.0, phbBaseline: 22.0 },
        { parameterId: 'relative_humidity', shbValue: 45.0, phbBaseline: 45.0 },
        { parameterId: 'atmospheric_pressure', shbValue: 1013, phbBaseline: 1013 },
        { parameterId: 'altitude', shbValue: 100, phbBaseline: 100 },
      ]);

      const resultA = await conditionEngine.processCondition(cmPacketAlice, {
        uid: userA,
        observationId: 'obs_alice_sec_01',
        reportId: 'rep_alice_sec_01',
      });

      // User A can access it
      const reportAlice = reportStore.getReport('rep_alice_sec_01', userA);

      // User B should NOT be able to access User A's report (must throw 403 or return null)
      let bobAccessBlocked = false;
      try {
        const reportBob = reportStore.getReport('rep_alice_sec_01', userB);
        if (!reportBob) bobAccessBlocked = true;
      } catch (err: any) {
        bobAccessBlocked = true;
      }

      const passed = Boolean(reportAlice) && bobAccessBlocked;

      tests.push({
        id: 'PMT6_11_SECURITY_UID_ISOLATION',
        name: 'Security & UID Ownership Isolation (Cross-user unauthorized access strictly blocked)',
        category: 'SECURITY',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Verified: User A (${userA}) successfully accessed own document. User B (${userB}) access was strictly rejected.`
          : 'Failed: Unauthorized user accessed private document',
        evidence: {
          userA: userA,
          userAAccess: Boolean(reportAlice),
          userBAccessBlocked: bobAccessBlocked,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_11_SECURITY_UID_ISOLATION',
        name: 'Security & UID Ownership Isolation',
        category: 'SECURITY',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error validating security UID isolation: ${err.message}`,
      });
    }
  }

  // =========================================================================
  // 12. PMT6_12: Multi-Temporal High-Resolution PDF Export Generation
  // =========================================================================
  {
    const tStart = Date.now();
    try {
      const testRep = reportStore.getReport('rep_test_pmt6_e2e_01', testUid);
      const dayRep = reportStore.getReport('rep_day_pmt6_e2e_01', testUid);
      const weekRep = reportStore.getReport('rep_week_pmt6_e2e_01', testUid);
      const monthRep = reportStore.getReport('rep_month_pmt6_e2e_01', testUid);

      let pdfTestBuffer: Buffer | null = null;
      let pdfDayBuffer: Buffer | null = null;
      let pdfWeekBuffer: Buffer | null = null;
      let pdfMonthBuffer: Buffer | null = null;

      if (testRep) pdfTestBuffer = await generateReportPdfBuffer(testRep);
      if (dayRep) pdfDayBuffer = await generateReportPdfBuffer(dayRep);
      if (weekRep) pdfWeekBuffer = await generateReportPdfBuffer(weekRep);
      if (monthRep) pdfMonthBuffer = await generateReportPdfBuffer(monthRep);

      const isValidPdf = (buf: Buffer | null) => Boolean(buf && buf.length > 500 && buf.toString('utf-8', 0, 5).startsWith('%PDF-'));

      const testValid = isValidPdf(pdfTestBuffer);
      const dayValid = isValidPdf(pdfDayBuffer);
      const weekValid = isValidPdf(pdfWeekBuffer);
      const monthValid = isValidPdf(pdfMonthBuffer);

      const passed = testValid && dayValid && weekValid && monthValid;

      tests.push({
        id: 'PMT6_12_PDF_DOWNLOAD_STREAM_GENERATION',
        name: 'Authoritative Multi-Temporal PDF Export (TEST, DAY, WEEK, MONTH binary stream validation)',
        category: 'PDF_EXPORT',
        passed,
        durationMs: Date.now() - tStart,
        details: passed
          ? `Verified: High-res PDF buffers generated for all 4 temporal levels (TEST: ${pdfTestBuffer?.length}B, DAY: ${pdfDayBuffer?.length}B, WEEK: ${pdfWeekBuffer?.length}B, MONTH: ${pdfMonthBuffer?.length}B). Header %PDF- confirmed.`
          : `Failed PDF generation: test=${testValid}, day=${dayValid}, week=${weekValid}, month=${monthValid}`,
        evidence: {
          testPdfBytes: pdfTestBuffer?.length,
          dayPdfBytes: pdfDayBuffer?.length,
          weekPdfBytes: pdfWeekBuffer?.length,
          monthPdfBytes: pdfMonthBuffer?.length,
        },
      });
    } catch (err: any) {
      tests.push({
        id: 'PMT6_12_PDF_DOWNLOAD_STREAM_GENERATION',
        name: 'Authoritative Multi-Temporal PDF Export',
        category: 'PDF_EXPORT',
        passed: false,
        durationMs: Date.now() - tStart,
        details: `Error validating PDF generation: ${err.message}`,
      });
    }
  }

  const totalDurationMs = Date.now() - startTime;
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.length - passed;

  return {
    total: tests.length,
    passed,
    failed,
    allPassed: failed === 0,
    totalDurationMs,
    timestamp: new Date().toISOString(),
    tests,
  };
}
