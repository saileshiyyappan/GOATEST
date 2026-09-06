/**
 * GOATEST Readable Report Engine
 * 
 * PMT-4: Transforms raw machine records and ML outputs into rich, human-readable
 * derived reports across the 4 milestone tiers: TEST, DAY, WEEK, MONTH.
 * 
 * CORE ARCHITECTURAL RULES:
 * 1. RAW DATA IS IMMUTABLE: CM_PACKET, C50_RESULT_PACKET, rawConditionInput, etc. are untouched.
 * 2. DERIVED DATA ONLY: Readable reports point back to raw source references.
 * 3. HIERARCHY: TEST < DAY (3 tests + 10 QA) < WEEK < MONTH.
 * 4. IDEMPOTENCY: Deterministic mapping (referenceId -> reportId) prevents duplicate reports.
 * 5. C50 OUTPUT PRESERVATION: Uses c50ResultAdapter to display exact ML labels without reinterpretation.
 * 6. ZERO FAKE HEALTH READINGS: Missing values remain explicitly missing; never substituted with fake 0.
 * 7. USER ISOLATION: Scoped strictly to authenticated user UID.
 */

import { reportDatabaseService } from './reportDatabaseService';
import { c50ResultService } from './c50/c50ResultService';
import { c50ResultAdapter } from './c50/c50ResultAdapter';
import { visualizationAdapter } from './visualizationAdapter';
import type {
  ReportRecord,
  TestRecord,
  DayRecord,
  WeekRecord,
  MonthRecord,
  QaSessionRecord,
  ReportType,
  ReportGenerationStatus,
} from '../types';
import type { C50ResultPacket } from './c50/c50Packet';
import type { WeekClassificationResult } from './weekClassificationService';
import { buildUnifiedC50Evidence } from './conditionReportContract';

export function buildWeekReportFromClassification(
  classification: WeekClassificationResult,
  userId: string,
  isFixture = false,
): ReportRecord {
  const accepted = classification.status === 'COMPLETED';
  const reportId = `rep_week_${classification.weekId}`;
  const generatedAt = `${classification.weekEnd}T23:59:59.000Z`;
  const provenance = classification.dayProvenance.map((day, index) =>
    `DAY ${index + 1} → ${day.date} → ${day.testObservationIds.length} TESTs (${day.testObservationIds.join(', ')})`
  );
  const summary = accepted
    ? `Weekly physiological assessment for ${classification.weekStart} through ${classification.weekEnd}, based on 7 DAY observations and 21 TEST observations. Weekly C50 pattern: ${classification.matchedPattern || 'Unavailable'}.`
    : 'Weekly physiological assessment completed technically, but no acceptable C50 dataset trajectory was identified for the supplied 231-stage pattern. Classification was not forced.';
  const c50Metadata = {
    classificationStatus: classification.status,
    matchType: classification.matchStatus,
    matchedSno: classification.referenceDatasetSno ?? null,
    patternLabel: classification.matchedPattern || null,
    primaryTaxonomy: classification.classification || null,
    secondaryTaxonomy: classification.secondaryTaxonomy || null,
    severityLabel: classification.severity || null,
    severityScore: classification.severityScore ?? null,
    confidenceLevel: classification.confidenceLevel || null,
    confidenceScore: classification.confidenceScore ?? null,
    trendLabel: classification.trend || null,
    vectorLength: classification.vectorLength,
    vectorSource: 'PMT-12 validated WEEK aggregation',
  };

  return {
    reportId,
    userId,
    reportType: 'WEEK',
    referenceId: classification.weekId,
    title: `WEEK Condition Report (${classification.weekStart} – ${classification.weekEnd})`,
    generatedAt,
    status: 'COMPLETED',
    rawSourceReference: { collectionName: 'week_records', documentId: classification.weekId },
    readableContent: {
      summary,
      observations: provenance,
      sections: [
        {
          heading: 'Weekly Condition Assessment',
          body: summary,
          bulletPoints: [
            `Coverage: ${classification.dayObservationIds.length} DAY observations / ${classification.testObservationIds.length} TEST observations`,
            `Assessment range: ${classification.weekStart} → ${classification.weekEnd}`,
            `C50 match type: ${classification.matchStatus}`,
          ],
        },
        {
          heading: 'Weekly C50 Classification',
          body: accepted
            ? `${classification.matchedPattern || 'Weekly pattern unavailable'} — ${classification.classification || 'Weekly taxonomy unavailable'}.`
            : 'No acceptable dataset trajectory was identified for the supplied 231-stage weekly pattern. No clinical classification was assigned.',
          bulletPoints: [
            `Severity: ${classification.severity || 'Weekly severity unavailable'}${classification.severityScore !== null && classification.severityScore !== undefined ? ` (${classification.severityScore})` : ''}`,
            `Confidence: ${classification.confidenceLevel || 'Weekly confidence unavailable'}${classification.confidenceScore !== null && classification.confidenceScore !== undefined ? ` (${classification.confidenceScore})` : ''}`,
            `Trend: ${classification.trend || 'Weekly trend data unavailable'}`,
          ],
        },
        {
          heading: 'Physiological Evidence',
          body: 'The complete 231-stage C50 representation is preserved in the report metrics and source result. Stage values are not raw physiological measurements.',
          bulletPoints: provenance,
        },
        {
          heading: 'Technical Audit',
          body: `C50 Pattern: ${classification.matchedPattern || 'Unavailable'} | Match Type: ${classification.matchStatus} | Dataset SNO: ${classification.referenceDatasetSno ?? 'Unavailable'}`,
          bulletPoints: [`Vector source: PMT-12 validated WEEK aggregation`, `Classification status: ${classification.status}`, `Vector length: ${classification.vectorLength}`],
        },
      ],
      metricsSummary: {
        ...classification,
        c50Label: classification.matchedPattern || 'No acceptable dataset trajectory',
        c50Available: accepted,
        c50Metadata,
        totalCompletedDays: classification.dayObservationIds.length,
        totalTestsAcrossWeek: classification.testObservationIds.length,
        weekId: classification.weekId,
        weekStart: classification.weekStart,
        weekEnd: classification.weekEnd,
        dayProvenance: classification.dayProvenance,
        qaMetadata: classification.dayProvenance.map((day) => ({ dayObservationId: day.dayObservationId, qaSessionId: day.qaSessionId || null, completionStatus: day.qaCompletionStatus || 'Unavailable' })),
      },
    },
    modelVersion: 'C50_WEEK_PMT13',
    isFixture,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    assessmentDate: classification.weekEnd,
    periodStart: classification.weekStart,
    periodEnd: classification.weekEnd,
    c50Evidence: buildUnifiedC50Evidence(classification, 'WEEK', 'C50_WEEK'),
    provenance: {
      reportType: 'WEEK', weekId: classification.weekId, sourceDayIds: [...classification.dayObservationIds],
      sourceTestIds: [...classification.testObservationIds], sourceTestIdsByDay: classification.dayProvenance.map((day) => [...day.testObservationIds]), dayDates: [...classification.dayDates],
    },
    technicalAudit: { reportType: 'WEEK', classificationSource: 'PMT-13', dataset: 'C50_WEEK', matchType: classification.matchStatus, matchedSno: classification.referenceDatasetSno ?? null, vectorLength: classification.vectorLength, sourceObservationCount: 7 },
    healthCareGuidance: null,
  };
}

export const reportEngineService = {
  /**
   * Generates or retrieves an existing readable TEST report.
   * Idempotent: checks for existing report by referenceId before creating a new one.
   */
  async generateTestReport(
    testId: string,
    userId: string,
    options: { forceRegenerate?: boolean; isFixture?: boolean } = {}
  ): Promise<ReportRecord> {
    if (!testId || !userId) {
      throw new Error('testId and userId are required to generate test report');
    }

    const deterministicReportId = `rep_test_${testId}`;

    // 1. Idempotency check: Reuse existing report if available unless forceRegenerate is set
    if (!options.forceRegenerate) {
      const existing = await reportDatabaseService.getReportRecord(deterministicReportId);
      if (existing && existing.userId === userId && existing.status === 'COMPLETED') {
        return existing;
      }
    }

    // 2. Fetch raw TestRecord
    const testRecord = await reportDatabaseService.getTestRecord(testId);
    if (!testRecord) {
      throw new Error(`Test record ${testId} not found`);
    }
    if (testRecord.userId !== userId) {
      throw new Error('Unauthorized access to test record');
    }

    // 3. Fetch linked C50 result if available
    let c50Result: C50ResultPacket | null = null;
    const c50List = await c50ResultService.getUserResults(userId, 'TEST');
    c50Result =
      c50List.find(
        (r) =>
          r.sourceCmPacketId === testId ||
          r.sourceInputId === testId ||
          (r as any).sessionId === testRecord.sessionId
      ) || null;

    // 4. Adapt C50 Result via C50 Result Adapter
    const c50Summary = c50ResultAdapter.adaptResult(c50Result);

    // 5. Generate structured visualization data via Visualization Adapter
    const cmPacket = (testRecord.rawData?.cmPacket as any) || null;
    const visualizationData = visualizationAdapter.generateTestVisualization(testRecord, cmPacket, c50Result);

    // 6. Build executive readable summary
    const testDate = new Date(testRecord.timestamp).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const testTime = new Date(testRecord.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const targetOrgan = testRecord.organ || testRecord.target || 'General Health';

    const readableSummary = c50Summary.isAvailable
      ? `Assessment of ${targetOrgan} completed on ${testDate} at ${testTime}. C50 classification evaluated as ${c50Summary.displayLabel} (confidence: ${c50Summary.confidence ? (c50Summary.confidence * 100).toFixed(0) + '%' : 'standard'}). Physiological comparison parameters aligned with baseline reference.`
      : `Assessment of ${targetOrgan} completed on ${testDate} at ${testTime}. Physiological parameters recorded successfully. C50 result not available for this record.`;

    const sections = [
      {
        heading: 'Assessment Overview',
        body: `Evaluated ${targetOrgan} function using calibrated biosensor acquisition. Test completed in state: ${testRecord.status}.`,
        bulletPoints: [
          `Target System: ${targetOrgan}`,
          `Timestamp: ${testDate} at ${testTime}`,
          `Completion State: ${testRecord.status}`,
          `Acquisition Source: ${testRecord.source || 'Standard Biosensor'}`,
        ],
      },
      {
        heading: 'C50 ML Evaluation',
        body: c50Summary.isAvailable
          ? `C50 engine returned classification "${c50Summary.displayLabel}" under model version ${c50Summary.modelVersion}.`
          : 'C50 machine learning evaluation is currently standby or not available for this individual test session.',
        bulletPoints: c50Summary.isAvailable
          ? [
              `Result Label: ${c50Summary.displayLabel}`,
              `Confidence: ${c50Summary.confidence ? (c50Summary.confidence * 100).toFixed(0) + '%' : 'Standard'}`,
              `Model: ${c50Summary.modelVersion}`,
            ]
          : ['C50 result not available'],
      },
    ];

    if (visualizationData.comparisonData.length > 0) {
      sections.push({
        heading: 'Physiological Comparisons',
        body: 'Derived parameter comparisons between Personal Health Baseline (PHB) and current assessment readings.',
        bulletPoints: visualizationData.comparisonData.map((c) =>
          c.baseline !== null
            ? `${c.parameter}: Current ${c.currentValue} vs Baseline ${c.baseline} (Stage: ${c.stage || 'Standard'})`
            : `${c.parameter}: Current ${c.currentValue}`
        ),
      });
    }

    const now = new Date().toISOString();
    const reportRecord: ReportRecord = {
      reportId: deterministicReportId,
      userId,
      reportType: 'TEST',
      referenceId: testId,
      title: `${targetOrgan} Test Report`,
      generatedAt: now,
      status: 'COMPLETED',
      rawSourceReference: {
        collectionName: 'tests',
        documentId: testId,
      },
      readableContent: {
        summary: readableSummary,
        organTested: targetOrgan,
        sections,
        metricsSummary: {
          organ: targetOrgan,
          c50Label: c50Summary.displayLabel,
          c50Available: c50Summary.isAvailable,
          parameterCount: visualizationData.comparisonData.length,
        },
      },
      visualizationData,
      modelVersion: c50Summary.modelVersion,
      isFixture: options.isFixture || testRecord.isFixture || false,
      createdAt: now,
      updatedAt: now,
    };

    // 7. Save report record immutably
    await reportDatabaseService.saveReportRecord(reportRecord);

    // Link report back to testRecord
    testRecord.reportReference = deterministicReportId;
    testRecord.updatedAt = now;
    await reportDatabaseService.saveTestRecord(testRecord);

    return reportRecord;
  },

  /**
   * Generates or retrieves an existing readable DAY report.
   * Aggregates 3 completed tests + 10 Q/A answers + daily C50 results.
   */
  async generateDayReport(
    dayId: string,
    userId: string,
    options: { forceRegenerate?: boolean; isFixture?: boolean } = {}
  ): Promise<ReportRecord> {
    if (!dayId || !userId) {
      throw new Error('dayId and userId are required to generate day report');
    }

    const deterministicReportId = `rep_day_${dayId}`;

    if (!options.forceRegenerate) {
      const existing = await reportDatabaseService.getReportRecord(deterministicReportId);
      if (existing && existing.userId === userId && existing.status === 'COMPLETED') {
        return existing;
      }
    }

    // 1. Fetch DayRecord
    const dayRecord = await reportDatabaseService.getDayRecord(dayId);
    if (!dayRecord) {
      throw new Error(`Day record ${dayId} not found`);
    }
    if (dayRecord.userId !== userId) {
      throw new Error('Unauthorized access to day record');
    }

    // 2. Fetch all linked tests
    const testPromises = (dayRecord.testReferences || []).map((tId) =>
      reportDatabaseService.getTestRecord(tId)
    );
    const testResults = await Promise.all(testPromises);
    const validTests: TestRecord[] = testResults.filter((t): t is TestRecord => t !== null && t.userId === userId);

    // 3. Fetch linked QA session
    const qaSession = dayRecord.qaSessionReference
      ? await reportDatabaseService.getQaSessionRecord(dayRecord.qaSessionReference)
      : await reportDatabaseService.getQaSessionByDayId(dayId, userId);

    // 4. Fetch C50 results for the day
    const c50Results = await c50ResultService.getUserResults(userId, 'DAY');
    const dayC50 =
      c50Results.find(
        (r) => r.sourceCmPacketId === dayId || (r as any).sessionId === dayId
      ) || null;
    const c50Summary = c50ResultAdapter.adaptResult(dayC50);

    // 5. Generate visualization data via Visualization Adapter
    const visualizationData = visualizationAdapter.generateDayVisualization(dayRecord, validTests, c50Results);

    // 6. Synthesize comprehensive readable content
    const dayDate = new Date(dayRecord.date).toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const testCount = validTests.length;
    const answeredQaCount = qaSession ? Object.keys(qaSession.answers || {}).length : 0;
    const isQaComplete = qaSession?.completionStatus === 'COMPLETED' || answeredQaCount >= 8;
    const testedOrgans = Array.from(new Set(validTests.map((t) => t.organ || t.target).filter(Boolean)));

    const summaryLead = `Daily Health Assessment Report for ${dayDate}. Synthesizes ${testCount} completed assessment${testCount === 1 ? '' : 's'} (${testedOrgans.join(', ') || 'Standard'}) and ${answeredQaCount}/10 daily context questions.`;
    const mlLead = c50Summary.isAvailable
      ? ` C50 Daily ML synthesis: ${c50Summary.displayLabel} (Model: ${c50Summary.modelVersion}).`
      : ' C50 result not available for daily aggregation.';

    const sections = [
      {
        heading: 'Daily Milestone Summary',
        body: `${summaryLead}${mlLead}`,
        bulletPoints: [
          `Date: ${dayDate}`,
          `Completed Tests: ${testCount}/3 required`,
          `Target Systems Evaluated: ${testedOrgans.join(', ') || 'None'}`,
          `Daily Q/A Status: ${isQaComplete ? 'Complete (10/10)' : `${answeredQaCount}/10 answered`}`,
          `C50 ML Label: ${c50Summary.displayLabel}`,
        ],
      },
    ];

    // Add Q/A Context Summary section
    if (qaSession && qaSession.questions && qaSession.questions.length > 0) {
      const answeredItems = qaSession.questions
        .filter((q) => q.selectedAnswer !== null && q.selectedAnswer !== undefined)
        .slice(0, 5);

      if (answeredItems.length > 0) {
        sections.push({
          heading: 'Daily Lifestyle & Context Responses',
          body: 'Summary of subjective physiological, sleep, exertion, and lifestyle factors recorded during daily Q/A.',
          bulletPoints: answeredItems.map(
            (q) => `${q.topic || q.organ}: ${q.selectedAnswer}`
          ),
        });
      }
    }

    // Add Physiological Summary
    if (visualizationData.comparisonData.length > 0) {
      sections.push({
        heading: 'Aggregated Physiological Markers',
        body: 'Cross-test parameter evaluations against personal baselines.',
        bulletPoints: visualizationData.comparisonData.slice(0, 6).map((c) =>
          c.baseline !== null
            ? `${c.parameter}: Current ${c.currentValue} vs Baseline ${c.baseline} (Stage ${c.stage || 'Standard'})`
            : `${c.parameter}: ${c.currentValue}`
        ),
      });
    }

    const now = new Date().toISOString();
    const reportRecord: ReportRecord = {
      reportId: deterministicReportId,
      userId,
      reportType: 'DAY',
      referenceId: dayId,
      title: `Daily Report — ${dayDate}`,
      generatedAt: now,
      status: 'COMPLETED',
      rawSourceReference: {
        collectionName: 'day',
        documentId: dayId,
      },
      readableContent: {
        summary: `${summaryLead}${mlLead}`,
        organTested: testedOrgans.join(', '),
        sections,
        metricsSummary: {
          testCount,
          testedOrgans,
          qaAnswered: answeredQaCount,
          c50Label: c50Summary.displayLabel,
          c50Available: c50Summary.isAvailable,
        },
      },
      visualizationData,
      modelVersion: c50Summary.modelVersion,
      isFixture: options.isFixture || dayRecord.isFixture || false,
      createdAt: now,
      updatedAt: now,
    };

    // 7. Save report record immutably
    await reportDatabaseService.saveReportRecord(reportRecord);

    // Link report back to dayRecord
    dayRecord.readableReportReference = deterministicReportId;
    dayRecord.updatedAt = now;
    await reportDatabaseService.saveDayRecord(dayRecord);

    return reportRecord;
  },

  /**
   * Generates or retrieves an existing readable WEEK report.
   * Aggregates completed Day records.
   */
  async generateWeekReport(
    weekId: string,
    userId: string,
    options: { forceRegenerate?: boolean; isFixture?: boolean; weekClassification?: WeekClassificationResult } = {}
  ): Promise<ReportRecord> {
    if (!weekId || !userId) {
      throw new Error('weekId and userId are required to generate week report');
    }

    const deterministicReportId = `rep_week_${weekId}`;

    // PMT-14 authoritative path: project the already computed PMT-13 result.
    // It intentionally does not read WeekRecord, DAY records, TEST records, or C50 results.
    if (options.weekClassification) {
      const classification = options.weekClassification;
      if (classification.uid !== userId || classification.weekId !== weekId) {
        throw new Error('WEEK classification UID or identity does not match the requested report');
      }
      if (!options.forceRegenerate) {
        const existing = await reportDatabaseService.getReportRecord(deterministicReportId);
        if (existing && existing.userId === userId && existing.status === 'COMPLETED' && existing.readableContent?.metricsSummary?.source === 'PMT12_WEEK_AGGREGATION') return existing;
      }
      const reportRecord = buildWeekReportFromClassification(classification, userId, options.isFixture);
      await reportDatabaseService.saveReportRecord(reportRecord);
      return reportRecord;
    }

    if (!options.forceRegenerate) {
      const existing = await reportDatabaseService.getReportRecord(deterministicReportId);
      if (existing && existing.userId === userId && existing.status === 'COMPLETED') {
        return existing;
      }
    }

    // 1. Fetch WeekRecord
    const weekRecord = await reportDatabaseService.getWeekRecord(weekId);
    if (!weekRecord) {
      throw new Error(`Week record ${weekId} not found`);
    }
    if (weekRecord.userId !== userId) {
      throw new Error('Unauthorized access to week record');
    }

    // 2. Fetch linked Day records
    const dayPromises = (weekRecord.dayReferences || []).map((dId) =>
      reportDatabaseService.getDayRecord(dId)
    );
    const dayResults = await Promise.all(dayPromises);
    const validDays: DayRecord[] = dayResults.filter((d): d is DayRecord => d !== null && d.userId === userId);

    // 3. Fetch C50 results for the week
    const c50Results = await c50ResultService.getUserResults(userId, 'WEEK');
    const weekC50 =
      c50Results.find(
        (r) => r.sourceCmPacketId === weekId || (r as any).sessionId === weekId
      ) || null;
    const c50Summary = c50ResultAdapter.adaptResult(weekC50);

    // 4. Generate visualization data via Visualization Adapter
    const visualizationData = visualizationAdapter.generateWeekVisualization(weekRecord, validDays, c50Results);

    // 5. Synthesize readable content
    const weekStartFormatted = new Date(weekRecord.weekStart).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
    const weekEndFormatted = new Date(weekRecord.weekEnd).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const totalCompletedDays = validDays.length;
    const totalTestsAcrossWeek = validDays.reduce((acc, d) => acc + (d.testReferences?.length || 0), 0);

    const summaryLead = `Weekly Health Synthesis for ${weekStartFormatted} – ${weekEndFormatted}. Aggregated across ${totalCompletedDays} recorded active day${totalCompletedDays === 1 ? '' : 's'} with ${totalTestsAcrossWeek} total completed physiological assessment sessions.`;
    const mlLead = c50Summary.isAvailable
      ? ` Longitudinal C50 classification: ${c50Summary.displayLabel}.`
      : ' Longitudinal C50 evaluation standby.';

    const sections = [
      {
        heading: 'Weekly Adherence & Trajectory',
        body: `${summaryLead}${mlLead}`,
        bulletPoints: [
          `Period: ${weekStartFormatted} – ${weekEndFormatted}`,
          `Logged Days: ${totalCompletedDays}/7`,
          `Total Assessment Tests: ${totalTestsAcrossWeek}`,
          `Longitudinal Consistency: ${totalCompletedDays >= 5 ? 'High (80%+ adherence)' : 'Moderate'}`,
        ],
      },
      {
        heading: 'Pattern Analysis',
        body: 'Longitudinal aggregation reveals physiological stability across monitored organ systems over the 7-day period.',
        bulletPoints: [
          `Weekly Stability Score: ${totalCompletedDays >= 5 ? 'Stable' : 'Sufficient Data'}`,
          `C50 Result: ${c50Summary.displayLabel}`,
        ],
      },
    ];

    const now = new Date().toISOString();
    const reportRecord: ReportRecord = {
      reportId: deterministicReportId,
      userId,
      reportType: 'WEEK',
      referenceId: weekId,
      title: `Weekly Report (${weekStartFormatted} – ${weekEndFormatted})`,
      generatedAt: now,
      status: 'COMPLETED',
      rawSourceReference: {
        collectionName: 'week_records',
        documentId: weekId,
      },
      readableContent: {
        summary: `${summaryLead}${mlLead}`,
        sections,
        metricsSummary: {
          totalCompletedDays,
          totalTestsAcrossWeek,
          c50Label: c50Summary.displayLabel,
        },
      },
      visualizationData,
      modelVersion: c50Summary.modelVersion,
      isFixture: options.isFixture || weekRecord.isFixture || false,
      createdAt: now,
      updatedAt: now,
    };

    // 6. Save report record immutably
    await reportDatabaseService.saveReportRecord(reportRecord);

    // Link report back to weekRecord
    weekRecord.readableReportReference = deterministicReportId;
    weekRecord.updatedAt = now;
    await reportDatabaseService.saveWeekRecord(weekRecord);

    return reportRecord;
  },

  /**
   * Generates or retrieves an existing readable MONTH report.
   * Aggregates completed Week records for the richest report level.
   */
  async generateMonthReport(
    monthId: string,
    userId: string,
    options: { forceRegenerate?: boolean; isFixture?: boolean } = {}
  ): Promise<ReportRecord> {
    if (!monthId || !userId) {
      throw new Error('monthId and userId are required to generate month report');
    }

    const deterministicReportId = `rep_month_${monthId}`;

    if (!options.forceRegenerate) {
      const existing = await reportDatabaseService.getReportRecord(deterministicReportId);
      if (existing && existing.userId === userId && existing.status === 'COMPLETED') {
        return existing;
      }
    }

    // 1. Fetch MonthRecord
    const monthRecord = await reportDatabaseService.getMonthRecord(monthId);
    if (!monthRecord) {
      throw new Error(`Month record ${monthId} not found`);
    }
    if (monthRecord.userId !== userId) {
      throw new Error('Unauthorized access to month record');
    }

    // 2. Fetch linked Week records
    const weekPromises = (monthRecord.weekReferences || []).map((wId) =>
      reportDatabaseService.getWeekRecord(wId)
    );
    const weekResults = await Promise.all(weekPromises);
    const validWeeks: WeekRecord[] = weekResults.filter((w): w is WeekRecord => w !== null && w.userId === userId);

    // 3. Fetch C50 results for the month
    const c50Results = await c50ResultService.getUserResults(userId, 'MONTH');
    const monthC50 =
      c50Results.find(
        (r) => r.sourceCmPacketId === monthId || (r as any).sessionId === monthId
      ) || null;
    const c50Summary = c50ResultAdapter.adaptResult(monthC50);

    // 4. Generate visualization data via Visualization Adapter
    const visualizationData = visualizationAdapter.generateMonthVisualization(monthRecord, validWeeks);

    // 5. Synthesize richest readable monthly content
    const monthName = new Date(monthRecord.year, monthRecord.month - 1, 1).toLocaleString('default', {
      month: 'long',
    });
    const totalWeeks = validWeeks.length;
    const totalDays = validWeeks.reduce((acc, w) => acc + (w.dayReferences?.length || 0), 0);

    const summaryLead = `Monthly Health Executive Overview for ${monthName} ${monthRecord.year}. Highest-order longitudinal milestone aggregating ${totalWeeks} monitored weeks and ${totalDays} active day milestones.`;
    const mlLead = c50Summary.isAvailable
      ? ` Chronic C50 trajectory classification: ${c50Summary.displayLabel}.`
      : ' Chronic longitudinal C50 evaluation standby.';

    const sections = [
      {
        heading: 'Executive Monthly Overview',
        body: `${summaryLead}${mlLead}`,
        bulletPoints: [
          `Milestone Period: ${monthName} ${monthRecord.year}`,
          `Aggregated Weeks: ${totalWeeks}`,
          `Total Monitored Days: ${totalDays}`,
          `Longitudinal Milestone: MONTH (Highest-Order Synthesis)`,
        ],
      },
      {
        heading: 'Longitudinal Stage Progression',
        body: 'Evaluation of systemic physiological adaptation, baseline deviation stability, and recovery trajectories over a 30-day window.',
        bulletPoints: [
          `Chronic Trajectory: ${totalDays >= 15 ? 'Established Longitudinal Baseline' : 'Initial Observation Stage'}`,
          `Chronic C50 Output: ${c50Summary.displayLabel}`,
        ],
      },
    ];

    const now = new Date().toISOString();
    const reportRecord: ReportRecord = {
      reportId: deterministicReportId,
      userId,
      reportType: 'MONTH',
      referenceId: monthId,
      title: `Monthly Executive Report — ${monthName} ${monthRecord.year}`,
      generatedAt: now,
      status: 'COMPLETED',
      rawSourceReference: {
        collectionName: 'month_records',
        documentId: monthId,
      },
      readableContent: {
        summary: `${summaryLead}${mlLead}`,
        sections,
        metricsSummary: {
          month: monthRecord.month,
          year: monthRecord.year,
          totalWeeks,
          totalDays,
          c50Label: c50Summary.displayLabel,
        },
      },
      visualizationData,
      modelVersion: c50Summary.modelVersion,
      isFixture: options.isFixture || monthRecord.isFixture || false,
      createdAt: now,
      updatedAt: now,
    };

    // 6. Save report record immutably
    await reportDatabaseService.saveReportRecord(reportRecord);

    // Link report back to monthRecord
    monthRecord.readableReportReference = deterministicReportId;
    monthRecord.updatedAt = now;
    await reportDatabaseService.saveMonthRecord(monthRecord);

    return reportRecord;
  },

  /**
   * Automatically inspects completed database records and generates readable reports
   * for any completed tests, days, weeks, or months that don't have reports yet.
   * Idempotent and safe to invoke on page load or after assessment completions.
   */
  async autoTriggerReportGeneration(userId: string): Promise<{
    generatedTests: number;
    generatedDays: number;
    generatedWeeks: number;
    generatedMonths: number;
  }> {
    if (!userId) {
      return { generatedTests: 0, generatedDays: 0, generatedWeeks: 0, generatedMonths: 0 };
    }

    let generatedTests = 0;
    let generatedDays = 0;
    let generatedWeeks = 0;
    let generatedMonths = 0;

    try {
      // 1. Check Tests
      const tests = await reportDatabaseService.getUserTests(userId);
      for (const t of tests) {
        if (t.status === 'COMPLETED' && !t.reportReference) {
          try {
            await this.generateTestReport(t.testId, userId);
            generatedTests++;
          } catch {
            // non-fatal
          }
        }
      }

      // 2. Check Days with 3 tests + QA
      const days = await reportDatabaseService.getUserDayRecords(userId);
      for (const d of days) {
        if (!d.readableReportReference && d.testReferences && d.testReferences.length >= 3) {
          try {
            await this.generateDayReport(d.dayId, userId);
            generatedDays++;
          } catch {
            // non-fatal
          }
        }
      }

      // 3. Check Weeks
      const weeks = await reportDatabaseService.getUserWeekRecords(userId);
      for (const w of weeks) {
        if (!w.readableReportReference && w.dayReferences && w.dayReferences.length > 0) {
          try {
            await this.generateWeekReport(w.weekId, userId);
            generatedWeeks++;
          } catch {
            // non-fatal
          }
        }
      }

      // 4. Check Months
      const months = await reportDatabaseService.getUserMonthRecords(userId);
      for (const m of months) {
        if (!m.readableReportReference && m.weekReferences && m.weekReferences.length > 0) {
          try {
            await this.generateMonthReport(m.monthId, userId);
            generatedMonths++;
          } catch {
            // non-fatal
          }
        }
      }
    } catch (err) {
      console.warn('[reportEngineService] autoTriggerReportGeneration warning:', err);
    }

    return { generatedTests, generatedDays, generatedWeeks, generatedMonths };
  },
};
