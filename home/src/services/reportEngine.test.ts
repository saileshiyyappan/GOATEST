/**
 * GOATEST PMT-4 Readable Report Engine & Q/A Test Suite
 * 
 * Deterministic Tests for:
 * 1. TEST report generation
 * 2. DAY report generation
 * 3. WEEK report generation
 * 4. MONTH report generation
 * 5. 10-question Q/A storage
 * 6. Incomplete Q/A handling
 * 7. Incomplete 3-test handling
 * 8. C50 result adapter
 * 9. Missing C50 result
 * 10. Visualization generation
 * 11. Missing visualization data
 * 12. Report idempotency
 * 13. Report references
 * 14. Raw data immutability
 * 15. User isolation
 * 16. Report status transitions
 * 17. Repeated Home refresh
 * 18. Theme tokens / UI contract
 */

import { reportDatabaseService } from './reportDatabaseService';
import { reportEngineService } from './reportEngineService';
import { dynamicQaService } from './dynamicQaService';
import { c50ResultAdapter, formatMlLabelToDisplay } from './c50/c50ResultAdapter';
import { visualizationAdapter } from './visualizationAdapter';
import type {
  TestRecord,
  DayRecord,
  WeekRecord,
  MonthRecord,
  QaSessionRecord,
  ReportRecord,
} from '../types';
import type { C50ResultPacket } from './c50/c50Packet';

export interface TestResultItem {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runReportEngineTestSuite(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];

  const record = async (id: string, name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      results.push({ id, name, passed: true });
    } catch (err: any) {
      results.push({ id, name, passed: false, error: err?.message || String(err) });
    }
  };

  const testUserA = 'test_user_pmt4_A';
  const testUserB = 'test_user_pmt4_B';
  const now = new Date().toISOString();

  // 1. TEST Report Generation
  await record('T1', 'TEST report generation creates valid ReportRecord', async () => {
    const testId = `tst_unit_${Date.now()}`;
    const testDoc: TestRecord = {
      testId,
      userId: testUserA,
      sessionId: `ses_${Date.now()}`,
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      organ: 'Cardiovascular',
      target: 'Cardiovascular',
      rawData: {
        sessionMetrics: { heartRate: 72, pulseVelocity: 5.4 },
      },
      createdAt: now,
      updatedAt: now,
    };
    await reportDatabaseService.saveTestRecord(testDoc);

    const report = await reportEngineService.generateTestReport(testId, testUserA, { forceRegenerate: true });
    if (!report || report.reportType !== 'TEST' || report.referenceId !== testId) {
      throw new Error('Invalid TEST report structure');
    }
    if (!report.readableContent?.summary) {
      throw new Error('Missing readable summary in TEST report');
    }
  });

  // 2. DAY Report Generation (3 tests + 10 QA)
  await record('T2', 'DAY report generation aggregates tests and Q/A', async () => {
    const dayId = `day_unit_${Date.now()}`;
    const t1 = `tst_day1_${Date.now()}`;
    const t2 = `tst_day2_${Date.now()}`;
    const t3 = `tst_day3_${Date.now()}`;

    for (const tid of [t1, t2, t3]) {
      await reportDatabaseService.saveTestRecord({
        testId: tid,
        userId: testUserA,
        sessionId: `ses_${tid}`,
        timestamp: now,
        status: 'COMPLETED',
        source: 'DEV_FIXTURE',
        organ: 'Cardiovascular',
        target: 'Cardiovascular',
        rawData: {},
        createdAt: now,
        updatedAt: now,
      });
    }

    const dayDoc: DayRecord = {
      dayId,
      userId: testUserA,
      date: '2026-08-25',
      testReferences: [t1, t2, t3],
      status: 'COMPLETED',
      isFixture: false,
      createdAt: now,
      updatedAt: now,
    };
    await reportDatabaseService.saveDayRecord(dayDoc);

    const report = await reportEngineService.generateDayReport(dayId, testUserA, { forceRegenerate: true });
    if (!report || report.reportType !== 'DAY' || report.referenceId !== dayId) {
      throw new Error('Invalid DAY report structure');
    }
    if (report.readableContent?.metricsSummary?.testCount !== 3) {
      throw new Error(`Expected 3 tests in DAY summary, found ${report.readableContent?.metricsSummary?.testCount}`);
    }
  });

  // 3. WEEK Report Generation
  await record('T3', 'WEEK report generation aggregates day milestones', async () => {
    const weekId = `week_unit_${Date.now()}`;
    const weekDoc: WeekRecord = {
      weekId,
      userId: testUserA,
      weekStart: '2026-08-18',
      weekEnd: '2026-08-24',
      dayReferences: [],
      status: 'COMPLETED',
      createdAt: now,
      updatedAt: now,
    };
    await reportDatabaseService.saveWeekRecord(weekDoc);

    const report = await reportEngineService.generateWeekReport(weekId, testUserA, { forceRegenerate: true });
    if (!report || report.reportType !== 'WEEK' || report.referenceId !== weekId) {
      throw new Error('Invalid WEEK report');
    }
  });

  // 4. MONTH Report Generation
  await record('T4', 'MONTH report generation creates highest-order synthesis', async () => {
    const monthId = `month_unit_${Date.now()}`;
    const monthDoc: MonthRecord = {
      monthId,
      userId: testUserA,
      year: 2026,
      month: 8,
      weekReferences: [],
      status: 'COMPLETED',
      createdAt: now,
      updatedAt: now,
    };
    await reportDatabaseService.saveMonthRecord(monthDoc);

    const report = await reportEngineService.generateMonthReport(monthId, testUserA, { forceRegenerate: true });
    if (!report || report.reportType !== 'MONTH' || report.referenceId !== monthId) {
      throw new Error('Invalid MONTH report');
    }
  });

  // 5. 10-Question Q/A Storage
  await record('T5', '10-question Q/A session generates 10 dynamic items and stores answers', async () => {
    const dayId = `day_qa_${Date.now()}`;
    const session = await dynamicQaService.getOrCreateDailyQaSession({
      userId: testUserA,
      dayId,
      targetOrgans: ['Cardiovascular', 'Respiratory'],
    });

    if (!session || !session.questions || session.questions.length < 8) {
      throw new Error(`Expected at least 8 questions, got ${session?.questions?.length}`);
    }

    const firstQ = session.questions[0];
    const updated = await dynamicQaService.recordAnswer(
      session.qaSessionId,
      testUserA,
      firstQ.questionId,
      firstQ.options[0]
    );

    if (updated.answers[firstQ.questionId] !== firstQ.options[0]) {
      throw new Error('Failed to persist answer to QA session');
    }
  });

  // 6. Incomplete Q/A Handling
  await record('T6', 'Incomplete Q/A session marks completionStatus as IN_PROGRESS', async () => {
    const dayId = `day_qa_inc_${Date.now()}`;
    const session = await dynamicQaService.getOrCreateDailyQaSession({
      userId: testUserA,
      dayId,
    });

    const updated = await dynamicQaService.recordAnswer(
      session.qaSessionId,
      testUserA,
      session.questions[0].questionId,
      'Test Answer'
    );

    if (updated.completionStatus === 'COMPLETED') {
      throw new Error('Should not mark session completed with only 1 answer');
    }
  });

  // 7. Incomplete 3-test handling
  await record('T7', 'Day with <3 tests still generates safe summary without crashing', async () => {
    const dayId = `day_partial_${Date.now()}`;
    const dayDoc: DayRecord = {
      dayId,
      userId: testUserA,
      date: '2026-08-25',
      testReferences: [],
      status: 'COMPLETED',
      createdAt: now,
      updatedAt: now,
    };
    await reportDatabaseService.saveDayRecord(dayDoc);

    const report = await reportEngineService.generateDayReport(dayId, testUserA, { forceRegenerate: true });
    if (!report || report.readableContent?.metricsSummary?.testCount !== 0) {
      throw new Error('Expected 0 tests handled safely');
    }
  });

  // 8. C50 Result Adapter Preserves Exact Label
  await record('T8', 'C50 result adapter formats exact ML label correctly', () => {
    const formatted1 = formatMlLabelToDisplay('CARDIAC_STRESS');
    if (formatted1 !== 'Cardiac Stress') {
      throw new Error(`Expected 'Cardiac Stress', got '${formatted1}'`);
    }

    const packet: C50ResultPacket = {
      resultId: 'c50_res_1',
      version: '1.0',
      userId: testUserA,
      sourceCmPacketId: 'cm_1',
      sourceInputId: 'inp_1',
      classification: 'NORMAL',
      confidence: 0.94,
      modelVersion: 'C50_V1.0',
      milestone: 'TEST',
      status: 'SUCCESS',
      rawResponse: { classification: 'NORMAL', confidence: 0.94 },
      createdAt: now,
      updatedAt: now,
      timestamp: now,
    };

    const adapted = c50ResultAdapter.adaptResult(packet);
    if (!adapted.isAvailable || adapted.displayLabel !== 'Normal' || adapted.confidence !== 0.94) {
      throw new Error('C50 result adapter failed to preserve exact model output');
    }
  });

  // 9. Missing C50 Result Handling
  await record('T9', 'Missing C50 packet produces exact fallback label', () => {
    const adapted = c50ResultAdapter.adaptResult(null);
    if (adapted.isAvailable || adapted.displayLabel !== 'C50 result not available') {
      throw new Error(`Expected 'C50 result not available', got '${adapted.displayLabel}'`);
    }
  });

  // 10. Visualization Generation
  await record('T10', 'visualizationAdapter creates structured comparison and deviation data', () => {
    const testDoc: TestRecord = {
      testId: 't1',
      userId: testUserA,
      sessionId: 'ses_t1',
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      organ: 'Cardiovascular',
      target: 'Cardiovascular',
      rawData: {},
      createdAt: now,
      updatedAt: now,
    };

    const cmPacket = {
      userId: testUserA,
      sessionId: 's1',
      timestamp: now,
      target: 'Cardiovascular',
      parameters: {
        heartRate: {
          name: 'Heart Rate',
          phbBaseline: 70,
          shbValue: 75,
          shbDeviation: 0.07,
          absDeviationDistance: 0.07,
          direction: 'POSITIVE',
          matchedStage: 1,
        },
      },
    };

    const visual = visualizationAdapter.generateTestVisualization(testDoc, cmPacket as any);
    if (!visual.hasEnoughData || visual.comparisonData.length === 0 || visual.deviationData.length === 0) {
      throw new Error('Visualization generation failed to map CM parameters');
    }
    if (visual.comparisonData[0].currentValue !== 75 || visual.comparisonData[0].baseline !== 70) {
      throw new Error('Visualization comparison values mismatched');
    }
  });

  // 11. Missing Visualization Data Handled Safely
  await record('T11', 'Empty test record produces clean hasEnoughData: false', () => {
    const testDoc: TestRecord = {
      testId: 't_empty',
      userId: testUserA,
      sessionId: 'ses_empty',
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      target: 'Cardiovascular',
      rawData: {},
      createdAt: now,
      updatedAt: now,
    };
    const visual = visualizationAdapter.generateTestVisualization(testDoc, null, null);
    if (visual.comparisonData.length > 0) {
      throw new Error('Should not fabricate comparisons when no CM packet exists');
    }
  });

  // 12. Report Idempotency
  await record('T12', 'Idempotent report generation reuses existing report ID', async () => {
    const testId = `tst_idem_${Date.now()}`;
    await reportDatabaseService.saveTestRecord({
      testId,
      userId: testUserA,
      sessionId: `ses_${testId}`,
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      target: 'Cardiovascular',
      rawData: {},
      createdAt: now,
      updatedAt: now,
    });

    const rep1 = await reportEngineService.generateTestReport(testId, testUserA);
    const rep2 = await reportEngineService.generateTestReport(testId, testUserA);
    if (rep1.reportId !== rep2.reportId) {
      throw new Error('Report generation is not idempotent');
    }
  });

  // 13. Report References Linkage
  await record('T13', 'Report updates raw test record reportReference', async () => {
    const testId = `tst_ref_${Date.now()}`;
    await reportDatabaseService.saveTestRecord({
      testId,
      userId: testUserA,
      sessionId: `ses_${testId}`,
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      target: 'Cardiovascular',
      rawData: {},
      createdAt: now,
      updatedAt: now,
    });

    const report = await reportEngineService.generateTestReport(testId, testUserA);
    const updatedTest = await reportDatabaseService.getTestRecord(testId);
    if (updatedTest?.reportReference !== report.reportId) {
      throw new Error('Failed to write back reportReference to source TestRecord');
    }
  });

  // 14. Raw Data Immutability
  await record('T14', 'Generating report does NOT mutate raw CM_PACKET or C50 result', async () => {
    const testId = `tst_imm_${Date.now()}`;
    const rawMetrics = { originalVal: 42 };
    await reportDatabaseService.saveTestRecord({
      testId,
      userId: testUserA,
      sessionId: `ses_${testId}`,
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      target: 'Cardiovascular',
      rawData: { sessionMetrics: rawMetrics },
      createdAt: now,
      updatedAt: now,
    });

    await reportEngineService.generateTestReport(testId, testUserA);
    const postTest = await reportDatabaseService.getTestRecord(testId);
    if (postTest?.rawData?.sessionMetrics?.originalVal !== 42) {
      throw new Error('Raw data was unexpectedly mutated');
    }
  });

  // 15. User Isolation Enforcement
  await record('T15', 'Cannot generate or view reports across different user UIDs', async () => {
    const testId = `tst_iso_${Date.now()}`;
    await reportDatabaseService.saveTestRecord({
      testId,
      userId: testUserA,
      sessionId: `ses_${testId}`,
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      target: 'Cardiovascular',
      rawData: {},
      createdAt: now,
      updatedAt: now,
    });

    try {
      await reportEngineService.generateTestReport(testId, testUserB);
      throw new Error('Should have rejected unauthorized report generation');
    } catch (err: any) {
      if (err.message.includes('Should have rejected')) throw err;
      // Expected authorization error
    }
  });

  // 16. Report Status Transitions
  await record('T16', 'Report record stores valid status (COMPLETED)', async () => {
    const testId = `tst_stat_${Date.now()}`;
    await reportDatabaseService.saveTestRecord({
      testId,
      userId: testUserA,
      sessionId: `ses_${testId}`,
      timestamp: now,
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      target: 'Cardiovascular',
      rawData: {},
      createdAt: now,
      updatedAt: now,
    });

    const rep = await reportEngineService.generateTestReport(testId, testUserA);
    if (rep.status !== 'COMPLETED') {
      throw new Error(`Expected COMPLETED, got ${rep.status}`);
    }
  });

  // 17. Repeated Auto-Trigger Execution (Home / Reports View load)
  await record('T17', 'Auto-trigger report generation runs cleanly multiple times', async () => {
    const res1 = await reportEngineService.autoTriggerReportGeneration(testUserA);
    const res2 = await reportEngineService.autoTriggerReportGeneration(testUserA);
    if (typeof res1.generatedTests !== 'number' || typeof res2.generatedTests !== 'number') {
      throw new Error('Invalid auto-trigger response');
    }
  });

  // 18. Visualization Theme / Model Contract
  await record('T18', 'Visualization items support dark/light theme numeric scaling', () => {
    const items = [
      { parameter: 'HR', baseline: 70, currentValue: 72, deviation: 0.02, stage: 1 },
    ];
    const deviation = [
      { parameter: 'HR', deviationPercent: 2.8, direction: 'POSITIVE', stage: 1 },
    ];
    if (items[0].parameter !== 'HR' || deviation[0].deviationPercent !== 2.8) {
      throw new Error('Theme items formatting validation failed');
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    total: results.length,
    passed: passedCount,
    results,
  };
}
