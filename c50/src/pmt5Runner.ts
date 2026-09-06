/**
 * BAND / GOATEST — C50 V1
 * PMT-5: COMPLETE CONDITION REPORT GENERATOR TEST SUITE & VERIFICATION RUNNER
 *
 * Authoritative Pipeline:
 * C50_RESULT → REPORT_OBJECT → (Web, Firestore, PDF)
 */

import { conditionEngine } from './services/condition/conditionEngine';
import {
  buildAuthoritativeReport,
  buildConditionReportDocument,
  buildDayReportDocument,
  buildWeekReportDocument,
  formatCanonicalReportTitle,
  generateReportPdfBuffer,
  NON_DIAGNOSTIC_DISCLAIMER,
} from './services/condition/reportGenerator';
import { firestoreDatabaseService } from './services/firebase/firestoreService';
import { getAuthenticatedUserUid } from './services/firebase/firebaseConfig';
import { StageVector } from './c50/evaluator';
import { CANONICAL_11_PARAMETERS } from './engine/canonicalParameters';

export interface TestResultItem {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  details?: any;
  error?: string;
}

export async function runPMT5Tests(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestResultItem[];
  liveVerificationAudit: any;
}> {
  const results: TestResultItem[] = [];

  let authUid = 'test_authenticated_user_pmt5';
  try {
    authUid = await getAuthenticatedUserUid();
  } catch (err: any) {
    console.warn('Auth session initialized with fallback:', err.message);
  }

  // -------------------------------------------------------------
  // Test REPORT_A: TEST Report Generation from C50 Result (Single Source of Truth)
  // -------------------------------------------------------------
  try {
    const stageVector: StageVector = [2, 0, 1, 3, 2, 1, 0, 0, 0, 0, 0];
    const testResult = await conditionEngine.processCondition(
      { stageVector },
      { temporalLevel: 'TEST', uid: authUid }
    );

    const report = testResult.report;
    const passed =
      Boolean(report) &&
      report.temporalLevel === 'TEST' &&
      report.reportId === testResult.reportId &&
      report.matchedPattern.matchedDatasetSno === String(testResult.referenceDatasetSno) &&
      report.severity.label === testResult.severity &&
      report.confidence.level === testResult.confidenceLevel;

    results.push({
      id: 'REPORT_A',
      name: 'TEST Report Generation from C50 Result (Single Source of Truth)',
      category: 'AUTHORITATIVE_PIPELINE',
      passed,
      details: {
        reportId: report?.reportId,
        matchedDatasetSno: report?.matchedPattern.matchedDatasetSno,
        severity: report?.severity.label,
        confidence: report?.confidence.level,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_A',
      name: 'TEST Report Generation from C50 Result (Single Source of Truth)',
      category: 'AUTHORITATIVE_PIPELINE',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_B: Canonical 11-Parameter Strict Order & Integrity
  // -------------------------------------------------------------
  try {
    const inputStages: StageVector = [1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5];
    const matchedStages: StageVector = [1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5];

    const report = buildAuthoritativeReport({
      temporalLevel: 'TEST',
      uid: authUid,
      reportId: 'rep_test_canonical_order',
      inputStages,
      matchedStages,
      matchedDatasetSno: '101',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'PHYSICAL_EXERTION',
      patternLabel: 'Sympathetic Activation',
      severityLabel: 'HIGH',
      severityScore: 0.75,
      confidenceScore: 0.95,
      confidenceLevel: 'HIGH',
      trendLabel: 'N/A',
    });

    const expectedOrder = [
      'heart_rate',
      'spo2',
      'ppi',
      'rmssd',
      'sdnn',
      'respiratory_rate',
      'activity_intensity',
      'ambient_temperature',
      'relative_humidity',
      'atmospheric_pressure',
      'altitude',
    ];

    const actualOrder = report.parameters.map((p) => p.id);
    const orderMatches =
      actualOrder.length === 11 &&
      actualOrder.every((id, idx) => id === expectedOrder[idx]);

    results.push({
      id: 'REPORT_B',
      name: 'Canonical 11-Parameter Strict Order and Nomenclature',
      category: 'CANONICAL_PARAMETERS',
      passed: orderMatches,
      details: {
        parameterCount: report.parameters.length,
        actualOrder,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_B',
      name: 'Canonical 11-Parameter Strict Order and Nomenclature',
      category: 'CANONICAL_PARAMETERS',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_C: Abnormal Parameters Filtering (Stage > 0)
  // -------------------------------------------------------------
  try {
    const inputStages: StageVector = [0, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0];
    const matchedStages: StageVector = [0, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0];

    const report = buildAuthoritativeReport({
      temporalLevel: 'TEST',
      uid: authUid,
      reportId: 'rep_test_abnormal_filter',
      inputStages,
      matchedStages,
      matchedDatasetSno: '450',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'AUTONOMIC_REGULATION',
      patternLabel: 'Vagal Attenuation',
      severityLabel: 'MILD',
      severityScore: 0.40,
      confidenceScore: 0.90,
      confidenceLevel: 'HIGH',
      trendLabel: 'N/A',
    });

    const passed =
      report.abnormalParameters.length === 2 &&
      report.abnormalParameters[0].id === 'ppi' &&
      report.abnormalParameters[0].inputStage === 2 &&
      report.abnormalParameters[1].id === 'sdnn' &&
      report.abnormalParameters[1].inputStage === 3;

    results.push({
      id: 'REPORT_C',
      name: 'Abnormal Parameter Isolation & Dynamic Filtering',
      category: 'CANONICAL_PARAMETERS',
      passed,
      details: {
        totalAbnormal: report.abnormalParameters.length,
        abnormalIds: report.abnormalParameters.map((p) => p.id),
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_C',
      name: 'Abnormal Parameter Isolation & Dynamic Filtering',
      category: 'CANONICAL_PARAMETERS',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_D: Formatted Title Format
  // Formatted Title: [DATE] [TIME] — BAND REPORT — GOATEST REPORT — [TEMPORAL LEVEL]
  // -------------------------------------------------------------
  try {
    const fixedDate = new Date('2026-08-29T14:32:00.000Z');
    const title = formatCanonicalReportTitle(fixedDate, 'TEST');
    const expected = '29 AUG 2026 14:32 — BAND REPORT — GOATEST REPORT — TEST';

    const passed = title === expected;

    results.push({
      id: 'REPORT_D',
      name: 'Canonical Formatted Title Convention',
      category: 'METADATA_AND_NAMING',
      passed,
      details: {
        generatedTitle: title,
        expectedTitle: expected,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_D',
      name: 'Canonical Formatted Title Convention',
      category: 'METADATA_AND_NAMING',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_E: DAY Report Generation with Longitudinal Trajectory
  // -------------------------------------------------------------
  try {
    const dayResult = await conditionEngine.processDayAssessment({
      uid: authUid,
      testVectors: [
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
        [3, 0, 2, 2, 1, 0, 0, 0, 0, 0, 0],
      ],
      isFixture: true,
    });

    const dayReport = buildDayReportDocument(dayResult, authUid, [
      { id: 'obs_1', stageVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: 'obs_2', stageVector: [2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0] },
      { id: 'obs_3', stageVector: [3, 0, 2, 2, 1, 0, 0, 0, 0, 0, 0] },
    ]);

    const passed =
      dayReport.temporalLevel === 'DAY' &&
      dayReport.temporalObservationsCount === 3 &&
      Array.isArray(dayReport.temporalObservations) &&
      dayReport.temporalObservations.length === 3 &&
      Boolean(dayReport.dominantPattern) &&
      typeof dayReport.severity.meanSeverity === 'number';

    results.push({
      id: 'REPORT_E',
      name: 'DAY Report Generation with 3 Diurnal Observations and Trajectory',
      category: 'TEMPORAL_ADAPTERS',
      passed,
      details: {
        temporalLevel: dayReport.temporalLevel,
        obsCount: dayReport.temporalObservationsCount,
        meanSeverity: dayReport.severity.meanSeverity,
        dominantPattern: dayReport.dominantPattern,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_E',
      name: 'DAY Report Generation with 3 Diurnal Observations and Trajectory',
      category: 'TEMPORAL_ADAPTERS',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_F: Strict Home Q/A Non-Fabrication Rule
  // -------------------------------------------------------------
  try {
    // 1. When Q/A exists
    const reportWithQA = buildAuthoritativeReport({
      temporalLevel: 'DAY',
      uid: authUid,
      reportId: 'rep_day_with_qa',
      inputStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      matchedStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      matchedDatasetSno: '1',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'NORMAL_BASELINE',
      patternLabel: 'Resting Baseline',
      severityLabel: 'NORMAL',
      severityScore: 0.0,
      confidenceScore: 0.95,
      confidenceLevel: 'HIGH',
      trendLabel: 'STABLE',
      homeQA: {
        status: 'AVAILABLE',
        qaId: 'qa_user_123',
        responses: { sleepQuality: 'Good', perceivedStress: 'Low' },
      },
    });

    // 2. When Q/A does NOT exist
    const reportWithoutQA = buildAuthoritativeReport({
      temporalLevel: 'DAY',
      uid: authUid,
      reportId: 'rep_day_no_qa',
      inputStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      matchedStages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      matchedDatasetSno: '1',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'NORMAL_BASELINE',
      patternLabel: 'Resting Baseline',
      severityLabel: 'NORMAL',
      severityScore: 0.0,
      confidenceScore: 0.95,
      confidenceLevel: 'HIGH',
      trendLabel: 'STABLE',
      homeQA: null,
    });

    const passed =
      reportWithQA.homeQA?.status === 'AVAILABLE' &&
      reportWithQA.homeQA?.qaId === 'qa_user_123' &&
      reportWithoutQA.homeQA?.status === 'Q/A_NOT_AVAILABLE' &&
      reportWithoutQA.homeQA?.displayText === 'Q/A NOT AVAILABLE';

    results.push({
      id: 'REPORT_F',
      name: 'Strict Home Q/A Presence vs Non-Fabrication Rule',
      category: 'TEMPORAL_ADAPTERS',
      passed,
      details: {
        withQAStatus: reportWithQA.homeQA?.status,
        withoutQADisplay: reportWithoutQA.homeQA?.displayText,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_F',
      name: 'Strict Home Q/A Presence vs Non-Fabrication Rule',
      category: 'TEMPORAL_ADAPTERS',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_G: Common Report Object Schema Across Temporal Levels
  // -------------------------------------------------------------
  try {
    const testDoc = buildConditionReportDocument(
      {
        inputVector: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        matchedRecord: { sno: '1', matchedVector: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } as any,
        matchStatus: 'EXACT',
        distanceScore: 0,
        temporalLevel: 'TEST',
        temporalObservationsCount: 1,
        primary_taxonomy: 'NORMAL',
        secondary_taxonomy: '',
        pattern_label: 'Baseline',
        severity_label: 'NORMAL',
        severity_score: '0.0',
        confidence_score: '0.95',
        confidence_level: 'HIGH',
        trend_label: 'N/A',
        labelVerificationStatus: 'VERIFIED_CONSISTENT',
        reportId: 'rep_common_test',
        timestamp: new Date().toISOString(),
      },
      authUid
    );

    const requiredKeys = [
      'reportId',
      'uid',
      'formattedTitle',
      'temporalLevel',
      'conditionSummary',
      'whatWasDetected',
      'severity',
      'confidence',
      'trend',
      'taxonomy',
      'matchedPattern',
      'parameters',
      'abnormalParameters',
      'whatShouldIDoNow',
      'wellnessMonitoringGuidance',
      'caretakerTechnicalEvidence',
      'limitationsDisclaimer',
    ];

    const hasAllKeys = requiredKeys.every((k) => k in testDoc);

    results.push({
      id: 'REPORT_G',
      name: 'Common Authoritative Report Schema Validation',
      category: 'SCHEMA_INTEGRITY',
      passed: hasAllKeys,
      details: {
        checkedKeys: requiredKeys.length,
        hasAllKeys,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_G',
      name: 'Common Authoritative Report Schema Validation',
      category: 'SCHEMA_INTEGRITY',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_H: Non-Diagnostic Disclaimer & Interpretation Safety
  // -------------------------------------------------------------
  try {
    const report = buildAuthoritativeReport({
      temporalLevel: 'TEST',
      uid: authUid,
      reportId: 'rep_safety_check',
      inputStages: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      matchedStages: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      matchedDatasetSno: '999',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'CARDIORESPIRATORY_STRAIN',
      patternLabel: 'Acute Autonomic Strain',
      severityLabel: 'RISK',
      severityScore: 0.95,
      confidenceScore: 0.95,
      confidenceLevel: 'HIGH',
      trendLabel: 'N/A',
    });

    const passed =
      report.limitationsDisclaimer === NON_DIAGNOSTIC_DISCLAIMER &&
      report.limitationsDisclaimer.includes('Not intended as primary clinical or diagnostic medical evaluation') &&
      !report.conditionSummary.toLowerCase().includes('diagnosis');

    results.push({
      id: 'REPORT_H',
      name: 'Non-Diagnostic Disclaimer and Safety Boundaries',
      category: 'SAFETY_AND_ETHICS',
      passed,
      details: {
        disclaimer: report.limitationsDisclaimer,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_H',
      name: 'Non-Diagnostic Disclaimer and Safety Boundaries',
      category: 'SAFETY_AND_ETHICS',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_I: Authoritative PDF Document Generation
  // -------------------------------------------------------------
  try {
    const report = buildAuthoritativeReport({
      temporalLevel: 'TEST',
      uid: authUid,
      reportId: 'rep_pdf_check',
      inputStages: [2, 1, 0, 3, 2, 1, 0, 0, 0, 0, 0],
      matchedStages: [2, 1, 0, 3, 2, 1, 0, 0, 0, 0, 0],
      matchedDatasetSno: '302',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'PHYSICAL_EXERTION',
      patternLabel: 'Exercise Recovery Profile',
      severityLabel: 'HIGH',
      severityScore: 0.72,
      confidenceScore: 0.95,
      confidenceLevel: 'HIGH',
      trendLabel: 'N/A',
    });

    const pdfBuffer = await generateReportPdfBuffer(report);

    // PDF magic byte check: %PDF-
    const headerString = pdfBuffer.slice(0, 5).toString('ascii');
    const isValidPdf = pdfBuffer.length > 500 && headerString === '%PDF-';

    results.push({
      id: 'REPORT_I',
      name: 'Authoritative PDF Generation with 11-Parameter Layout',
      category: 'PDF_GENERATION',
      passed: isValidPdf,
      details: {
        bufferBytes: pdfBuffer.length,
        header: headerString,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_I',
      name: 'Authoritative PDF Generation with 11-Parameter Layout',
      category: 'PDF_GENERATION',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_J: Idempotency Verification
  // -------------------------------------------------------------
  try {
    const inputStages: StageVector = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const rep1 = buildAuthoritativeReport({
      temporalLevel: 'TEST',
      uid: authUid,
      reportId: 'rep_idempotency_1',
      createdAt: '2026-08-29T12:00:00.000Z',
      inputStages,
      matchedStages: inputStages,
      matchedDatasetSno: '55',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'MILD_ADAPTATION',
      patternLabel: 'Low State Load',
      severityLabel: 'MILD',
      severityScore: 0.35,
      confidenceScore: 0.95,
      confidenceLevel: 'HIGH',
      trendLabel: 'N/A',
    });

    const rep2 = buildAuthoritativeReport({
      temporalLevel: 'TEST',
      uid: authUid,
      reportId: 'rep_idempotency_1',
      createdAt: '2026-08-29T12:00:00.000Z',
      inputStages,
      matchedStages: inputStages,
      matchedDatasetSno: '55',
      matchStatus: 'EXACT',
      distanceScore: 0.0,
      primaryTaxonomy: 'MILD_ADAPTATION',
      patternLabel: 'Low State Load',
      severityLabel: 'MILD',
      severityScore: 0.35,
      confidenceScore: 0.95,
      confidenceLevel: 'HIGH',
      trendLabel: 'N/A',
    });

    const passed =
      rep1.formattedTitle === rep2.formattedTitle &&
      rep1.conditionSummary === rep2.conditionSummary &&
      rep1.parameters.length === rep2.parameters.length &&
      rep1.parameters.every((p, idx) => p.inputStage === rep2.parameters[idx].inputStage);

    results.push({
      id: 'REPORT_J',
      name: 'Deterministic Idempotency Across Multiple Generations',
      category: 'IDEMPOTENCY',
      passed,
      details: {
        title1: rep1.formattedTitle,
        title2: rep2.formattedTitle,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_J',
      name: 'Deterministic Idempotency Across Multiple Generations',
      category: 'IDEMPOTENCY',
      passed: false,
      error: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test REPORT_K: Firestore Collection Partitioning (/reports_test, /reports_day, /reports_week)
  // -------------------------------------------------------------
  try {
    const testRepId = `rep_test_col_${Date.now()}`;
    const dayRepId = `rep_day_col_${Date.now()}`;
    const weekRepId = `rep_week_col_${Date.now()}`;

    const testWrite = await firestoreDatabaseService.writeTestReport(authUid, {
      reportId: testRepId,
      temporalLevel: 'TEST',
      formattedTitle: '29 AUG 2026 12:00 — BAND REPORT — GOATEST REPORT — TEST',
    });

    const dayWrite = await firestoreDatabaseService.writeDayReport(authUid, {
      reportId: dayRepId,
      temporalLevel: 'DAY',
      formattedTitle: '29 AUG 2026 12:00 — BAND REPORT — GOATEST REPORT — DAY',
    });

    const weekWrite = await firestoreDatabaseService.writeWeekReport(authUid, {
      reportId: weekRepId,
      temporalLevel: 'WEEK',
      formattedTitle: '29 AUG 2026 12:00 — BAND REPORT — GOATEST REPORT — WEEK',
    });

    const passed =
      testWrite.collection === 'reports_test' &&
      dayWrite.collection === 'reports_day' &&
      weekWrite.collection === 'reports_week';

    results.push({
      id: 'REPORT_K',
      name: 'Firestore Collection Separation by Temporal Level',
      category: 'PERSISTENCE',
      passed,
      details: {
        testCollection: testWrite.collection,
        dayCollection: dayWrite.collection,
        weekCollection: weekWrite.collection,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'REPORT_K',
      name: 'Firestore Collection Separation by Temporal Level',
      category: 'PERSISTENCE',
      passed: false,
      error: err.message,
    });
  }

  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;
  const allPassed = failedCount === 0;

  return {
    allPassed,
    total,
    passed: passedCount,
    failed: failedCount,
    results,
    liveVerificationAudit: {
      generator: 'Authoritative Condition Report Generator (PMT-5)',
      standardTitleConvention: '[DATE] [TIME] — BAND REPORT — GOATEST REPORT — [TEMPORAL LEVEL]',
      pdfRenderer: 'PDFKit Vector Layout Renderer',
      disclaimerBound: NON_DIAGNOSTIC_DISCLAIMER,
      timestamp: new Date().toISOString(),
    },
  };
}
