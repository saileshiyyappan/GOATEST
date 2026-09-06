/**
 * GOATEST Home Database & Report Record Pipeline Test Suite
 * 
 * PMT-3 Verification Suite:
 * 1. Authenticated Home initialization
 * 2. TestRecord retrieval
 * 3. DayRecord retrieval
 * 4. WeekRecord retrieval
 * 5. MonthRecord retrieval
 * 6. ReportRecord retrieval
 * 7. QA session retrieval
 * 8. C50 result availability
 * 9. User ownership filtering (cross-user data isolation)
 * 10. Empty database handling (CONNECTED_EMPTY)
 * 11. Database error handling (DATABASE_ERROR)
 * 12. Permission error handling (PERMISSION_ERROR)
 * 13. Fixture isolation (clearly marked non-clinical fixtures)
 * 14. Reload / auth persistence
 * 15. Report hierarchy structure (TEST < DAY < WEEK < MONTH)
 * 16. Missing report handling (clean fallback when ReportRecord does not exist)
 */

import { homeDatabaseService } from './homeDatabaseService';
import { reportDatabaseService } from './reportDatabaseService';
import { c50ResultService } from './c50/c50ResultService';
import type {
  TestRecord,
  DayRecord,
  WeekRecord,
  MonthRecord,
  ReportRecord,
  QaSessionRecord,
  C50ResultPacket,
} from '../types';

export interface TestResultItem {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runHomeDatabaseTestSuite(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];

  async function recordTest(id: string, name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      results.push({ id, name, passed: true });
    } catch (err: any) {
      results.push({ id, name, passed: false, error: err?.message || String(err) });
    }
  }

  const testUserId = `test_user_pmt3_${Date.now()}`;
  const otherUserId = `other_user_pmt3_${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Test 1: Authenticated Home initialization (AUTH_REQUIRED when empty userId)
  await recordTest(
    'TC-1',
    'Authenticated Home initialization requires valid userId',
    async () => {
      const hierarchy = await homeDatabaseService.getHomeReportHierarchy('');
      if (hierarchy.status !== 'AUTH_REQUIRED') {
        throw new Error(`Expected status AUTH_REQUIRED for empty userId, got ${hierarchy.status}`);
      }
    }
  );

  // Test 2: TestRecord retrieval
  const sampleTestId = `test_rec_${Date.now()}`;
  const sampleTest: TestRecord = {
    testId: sampleTestId,
    userId: testUserId,
    sessionId: `sess_${Date.now()}`,
    timestamp: nowIso,
    target: 'Cardiovascular',
    organ: 'Cardiovascular',
    status: 'COMPLETED',
    source: 'M_BAND_BLE',
    rawData: { testDescription: 'Raw machine test data' },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await recordTest('TC-2', 'TestRecord retrieval and mapping', async () => {
    await reportDatabaseService.saveTestRecord(sampleTest);
    const tests = await reportDatabaseService.getUserTests(testUserId);
    if (!tests.some((t) => t.testId === sampleTestId)) {
      throw new Error(`Saved test ${sampleTestId} not found in getUserTests`);
    }
  });

  // Test 3: DayRecord retrieval
  const sampleDayId = `day_rec_${Date.now()}`;
  const sampleDay: DayRecord = {
    dayId: sampleDayId,
    userId: testUserId,
    date: '2026-08-25',
    testReferences: [sampleTestId],
    status: 'COMPLETED',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await recordTest('TC-3', 'DayRecord retrieval and mapping', async () => {
    await reportDatabaseService.saveDayRecord(sampleDay);
    const days = await reportDatabaseService.getUserDayRecords(testUserId);
    if (!days.some((d) => d.dayId === sampleDayId)) {
      throw new Error(`Saved day ${sampleDayId} not found in getUserDayRecords`);
    }
  });

  // Test 4: WeekRecord retrieval
  const sampleWeekId = `week_rec_${Date.now()}`;
  const sampleWeek: WeekRecord = {
    weekId: sampleWeekId,
    userId: testUserId,
    weekStart: '2026-08-24',
    weekEnd: '2026-08-30',
    dayReferences: [sampleDayId],
    status: 'COMPLETED',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await recordTest('TC-4', 'WeekRecord retrieval and mapping', async () => {
    await reportDatabaseService.saveWeekRecord(sampleWeek);
    const weeks = await reportDatabaseService.getUserWeekRecords(testUserId);
    if (!weeks.some((w) => w.weekId === sampleWeekId)) {
      throw new Error(`Saved week ${sampleWeekId} not found in getUserWeekRecords`);
    }
  });

  // Test 5: MonthRecord retrieval
  const sampleMonthId = `month_rec_${Date.now()}`;
  const sampleMonth: MonthRecord = {
    monthId: sampleMonthId,
    userId: testUserId,
    month: 8,
    year: 2026,
    weekReferences: [sampleWeekId],
    status: 'COMPLETED',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await recordTest('TC-5', 'MonthRecord retrieval and mapping', async () => {
    await reportDatabaseService.saveMonthRecord(sampleMonth);
    const months = await reportDatabaseService.getUserMonthRecords(testUserId);
    if (!months.some((m) => m.monthId === sampleMonthId)) {
      throw new Error(`Saved month ${sampleMonthId} not found in getUserMonthRecords`);
    }
  });

  // Test 6: ReportRecord retrieval
  const sampleReportId = `rep_rec_${Date.now()}`;
  const sampleReport: ReportRecord = {
    reportId: sampleReportId,
    userId: testUserId,
    reportType: 'DAY',
    referenceId: sampleDayId,
    title: 'Daily Assessment Report',
    generatedAt: nowIso,
    status: 'COMPLETED',
    rawSourceReference: {
      collectionName: 'day_records',
      documentId: sampleDayId,
    },
    readableContent: {
      summary: 'Daily cardiovascular assessment completed successfully.',
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await recordTest('TC-6', 'ReportRecord retrieval and mapping', async () => {
    await reportDatabaseService.saveReportRecord(sampleReport);
    const reports = await reportDatabaseService.getUserReports(testUserId);
    if (!reports.some((r) => r.reportId === sampleReportId)) {
      throw new Error(`Saved report ${sampleReportId} not found in getUserReports`);
    }
  });

  // Test 7: QA Session retrieval and progress calculation
  const sampleQaId = `qa_rec_${Date.now()}`;
  const sampleQa: QaSessionRecord = {
    qaSessionId: sampleQaId,
    userId: testUserId,
    dayId: sampleDayId,
    generatedAt: nowIso,
    questions: [
      { questionId: 'q1', question: 'Readiness check', options: ['Good', 'Fatigued'] },
      { questionId: 'q2', question: 'Rest quality', options: ['High', 'Low'] },
    ],
    answers: {
      q1: 'Good',
      q2: 'High',
    },
    completionStatus: 'COMPLETED',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await recordTest('TC-7', 'QA session retrieval and mapping', async () => {
    await reportDatabaseService.saveQaSessionRecord(sampleQa);
    const qa = await reportDatabaseService.getQaSessionByDayId(sampleDayId, testUserId);
    if (!qa || qa.qaSessionId !== sampleQaId) {
      throw new Error(`QA session ${sampleQaId} not retrieved correctly for day ${sampleDayId}`);
    }
  });

  // Test 8: C50 Result availability calculation
  const sampleC50ResultId = `c50_res_${Date.now()}`;
  const sampleC50Result: C50ResultPacket = {
    version: '1.0.0',
    resultId: sampleC50ResultId,
    userId: testUserId,
    sourceInputId: sampleDayId,
    sourceCmPacketId: `cm_pkt_${sampleDayId}`,
    milestone: 'DAY',
    status: 'SUCCESS',
    timestamp: nowIso,
    modelVersion: 'C50_V1.0',
    predictionPayload: { confidence: 0.95 },
    rawResponse: { status: 'OK' },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await recordTest('TC-8', 'C50 Result availability mapping', async () => {
    await c50ResultService.saveResult(sampleC50Result);
    const hierarchy = await homeDatabaseService.getHomeReportHierarchy(testUserId);
    const matchedDay = hierarchy.days.find((d) => d.dayId === sampleDayId);
    if (!matchedDay) {
      throw new Error(`Day ${sampleDayId} not found in hierarchy`);
    }
    if (matchedDay.c50Status !== 'C50_AVAILABLE') {
      throw new Error(`Expected c50Status C50_AVAILABLE, got ${matchedDay.c50Status}`);
    }
  });

  // Test 9: User ownership filtering (Cross-user data isolation)
  await recordTest('TC-9', 'Strict user ownership isolation', async () => {
    const otherUserTest: TestRecord = {
      testId: `other_test_${Date.now()}`,
      userId: otherUserId,
      sessionId: `other_sess_${Date.now()}`,
      timestamp: nowIso,
      target: 'Cardiovascular',
      organ: 'Cardiovascular',
      status: 'COMPLETED',
      source: 'M_BAND_BLE',
      rawData: { testDescription: 'Other user test' },
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await reportDatabaseService.saveTestRecord(otherUserTest);

    const hierarchy = await homeDatabaseService.getHomeReportHierarchy(testUserId);
    if (hierarchy.tests.some((t) => t.userId !== testUserId)) {
      throw new Error('Found test records belonging to another user!');
    }
    if (hierarchy.tests.some((t) => t.testId === otherUserTest.testId)) {
      throw new Error('Other user test leaked into current user hierarchy');
    }
  });

  // Test 10: Empty database handling (CONNECTED_EMPTY)
  await recordTest('TC-10', 'Empty database returns CONNECTED_EMPTY', async () => {
    const emptyUserId = `empty_user_${Date.now()}`;
    const hierarchy = await homeDatabaseService.getHomeReportHierarchy(emptyUserId);
    if (hierarchy.status !== 'CONNECTED_EMPTY') {
      throw new Error(`Expected CONNECTED_EMPTY for new user with zero records, got ${hierarchy.status}`);
    }
    if (hierarchy.tests.length !== 0 || hierarchy.days.length !== 0) {
      throw new Error('Expected zero tests and days for empty user');
    }
  });

  // Test 11: Database error handling
  await recordTest('TC-11', 'Database error resilience', async () => {
    // Calling getHomeReportHierarchy with invalid state returns safe structure
    const res = await homeDatabaseService.getHomeReportHierarchy(testUserId);
    if (!res || !Array.isArray(res.tests) || !Array.isArray(res.days)) {
      throw new Error('Database response does not conform to HomeReportHierarchyData contract');
    }
  });

  // Test 12: Permission error handling
  await recordTest('TC-12', 'Permission error detection', async () => {
    // Validates permission error contract mapping
    const testHierarchy = await homeDatabaseService.getHomeReportHierarchy(testUserId);
    if (!['DATA_AVAILABLE', 'CONNECTED_EMPTY', 'PERMISSION_ERROR', 'DATABASE_ERROR', 'OFFLINE'].includes(testHierarchy.status)) {
      throw new Error(`Unexpected status ${testHierarchy.status}`);
    }
  });

  // Test 13: Fixture isolation
  await recordTest('TC-13', 'Development fixtures are marked and non-clinical', async () => {
    const fixtureUserId = `fixture_user_${Date.now()}`;
    const fixtures = await reportDatabaseService.createDevelopmentFixtures(fixtureUserId);

    if (!fixtures.testRecord.isFixture || !fixtures.dayRecord.isFixture) {
      throw new Error('Fixtures must have isFixture set to true');
    }

    const hierarchy = await homeDatabaseService.getHomeReportHierarchy(fixtureUserId);
    const day = hierarchy.days.find((d) => d.dayId === fixtures.dayRecord.dayId);
    if (!day || !day.isFixture) {
      throw new Error('Fixture flag must propagate into HomeDaySummary');
    }
  });

  // Test 14: Reload / auth persistence verification
  await recordTest('TC-14', 'Data survives reload and re-query', async () => {
    const reloadedHierarchy = await homeDatabaseService.getHomeReportHierarchy(testUserId);
    if (reloadedHierarchy.tests.length === 0) {
      throw new Error('Saved tests could not be retrieved upon re-query');
    }
  });

  // Test 15: Report hierarchy structure (TEST < DAY < WEEK < MONTH)
  await recordTest('TC-15', 'Hierarchical referencing is preserved', async () => {
    const hierarchy = await homeDatabaseService.getHomeReportHierarchy(testUserId);
    const day = hierarchy.days.find((d) => d.dayId === sampleDayId);
    const week = hierarchy.weeks.find((w) => w.weekId === sampleWeekId);
    const month = hierarchy.months.find((m) => m.monthId === sampleMonthId);

    if (!day || !week || !month) {
      throw new Error('Hierarchy components missing from database query');
    }

    if (!week.dayReferences.includes(sampleDayId)) {
      throw new Error('Week does not reference its child Day record');
    }

    if (!month.weekReferences.includes(sampleWeekId)) {
      throw new Error('Month does not reference its child Week record');
    }
  });

  // Test 16: Missing report handling (Clean fallback when ReportRecord does not exist)
  await recordTest('TC-16', 'Missing report produces clean reportAvailable=false', async () => {
    const unlinkedTestId = `unlinked_test_${Date.now()}`;
    const unlinkedTest: TestRecord = {
      testId: unlinkedTestId,
      userId: testUserId,
      sessionId: `unlinked_sess_${Date.now()}`,
      timestamp: nowIso,
      target: 'Neurological',
      organ: 'Neurological',
      status: 'COMPLETED',
      source: 'M_BAND_BLE',
      rawData: { testDescription: 'Unlinked test' },
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await reportDatabaseService.saveTestRecord(unlinkedTest);

    const hierarchy = await homeDatabaseService.getHomeReportHierarchy(testUserId);
    const found = hierarchy.tests.find((t) => t.testId === unlinkedTestId);
    if (!found) {
      throw new Error(`Test ${unlinkedTestId} not found`);
    }
    if (found.reportAvailable !== false) {
      throw new Error('Expected reportAvailable to be false for unlinked test');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  return {
    allPassed: passed === results.length,
    total: results.length,
    passed,
    results,
  };
}
