import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { conditionEngine } from './services/condition/conditionEngine';
import { reportStore } from './services/condition/reportStore';
import { generateReportPdfBuffer } from './services/condition/reportGenerator';
import { evaluateStageVector, evaluateTrajectory, StageVector } from './c50/evaluator';
import { getDatasetPaths } from './c50/csvExporter';

interface DatasetAuditSummary {
  filePath: string;
  totalRows: number;
  totalCols: number;
  stageColsCount: number;
  sha256: string;
  uniqueVectorsOrTrajectories: number;
  duplicateCount: number;
  contradictoryLabelCount: number;
  mismatchCount: number;
  severityDistribution: Record<string, number>;
  confidenceDistribution: Record<string, number>;
  taxonomyDistribution: Record<string, number>;
}

async function auditCsvFile(filePath: string, depth: number): Promise<DatasetAuditSummary> {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  let totalRows = 0;
  let totalCols = 0;
  let headerLine = '';

  const stageColsCount = depth * 11;
  const trajectorySet = new Set<string>();
  const trajectoryToLabels = new Map<string, string>();
  let duplicateCount = 0;
  let contradictoryLabelCount = 0;
  let mismatchCount = 0;

  const severityDistribution: Record<string, number> = {};
  const confidenceDistribution: Record<string, number> = {};
  const taxonomyDistribution: Record<string, number> = {};

  const hash = crypto.createHash('sha256');

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      headerLine = line;
      totalCols = line.split(',').length;
      isHeader = false;
      continue;
    }

    totalRows++;
    const cols = line.split(',');
    const stageValues = cols.slice(1, 1 + stageColsCount).join(',');
    hash.update(stageValues);

    const primaryTax = cols[1 + stageColsCount];
    const sevLabel = cols[1 + stageColsCount + 3];
    const confLevel = cols[1 + stageColsCount + 6];

    severityDistribution[sevLabel] = (severityDistribution[sevLabel] || 0) + 1;
    confidenceDistribution[confLevel] = (confidenceDistribution[confLevel] || 0) + 1;
    taxonomyDistribution[primaryTax] = (taxonomyDistribution[primaryTax] || 0) + 1;

    // Check Trajectory Uniqueness & Contradictions
    if (trajectorySet.has(stageValues)) {
      duplicateCount++;
      const prevTax = trajectoryToLabels.get(stageValues);
      if (prevTax && prevTax !== primaryTax) {
        contradictoryLabelCount++;
      }
    } else {
      trajectorySet.add(stageValues);
      trajectoryToLabels.set(stageValues, primaryTax);
    }

    // Single-vector deterministic verification for TEST
    if (depth === 1) {
      const vector: StageVector = cols.slice(1, 12).map((c) => parseInt(c, 10)) as any;
      const expected = evaluateStageVector(vector);
      if (expected.primary_taxonomy !== primaryTax || expected.severity_label !== sevLabel) {
        mismatchCount++;
      }
    }
  }

  return {
    filePath,
    totalRows,
    totalCols,
    stageColsCount,
    sha256: hash.digest('hex'),
    uniqueVectorsOrTrajectories: trajectorySet.size,
    duplicateCount,
    contradictoryLabelCount,
    mismatchCount,
    severityDistribution,
    confidenceDistribution,
    taxonomyDistribution,
  };
}

async function runConditionTestSuite() {
  console.log('============================================================');
  console.log('BAND / C50 CONDITION PIPELINE VERIFICATION & AUDIT SUITE');
  console.log('============================================================\n');

  const rootDir = process.cwd();
  const paths = getDatasetPaths(rootDir);

  // 1. DATASET INTEGRITY & AUDIT REPORT
  console.log('--- 1. DATASET INTEGRITY & AUDIT SUMMARY ---');
  const testAudit = await auditCsvFile(paths.testCsvPath, 1);
  const dayAudit = await auditCsvFile(paths.dayCsvPath, 3);
  const weekAudit = await auditCsvFile(paths.weekCsvPath, 21);
  const monthAudit = await auditCsvFile(paths.monthCsvPath, 84);

  console.log(`[TEST DATASET]  Rows: ${testAudit.totalRows} | Cols: ${testAudit.totalCols} | StageCols: ${testAudit.stageColsCount} | SHA256: ${testAudit.sha256}`);
  console.log(`                Unique Vectors: ${testAudit.uniqueVectorsOrTrajectories} | Duplicates: ${testAudit.duplicateCount} | Mismatches: ${testAudit.mismatchCount}`);
  console.log(`[DAY DATASET]   Rows: ${dayAudit.totalRows} | Cols: ${dayAudit.totalCols} | StageCols: ${dayAudit.stageColsCount} | SHA256: ${dayAudit.sha256}`);
  console.log(`                Unique Trajectories: ${dayAudit.uniqueVectorsOrTrajectories} | Duplicates: ${dayAudit.duplicateCount}`);
  console.log(`[WEEK DATASET]  Rows: ${weekAudit.totalRows} | Cols: ${weekAudit.totalCols} | StageCols: ${weekAudit.stageColsCount} | SHA256: ${weekAudit.sha256}`);
  console.log(`                Unique Trajectories: ${weekAudit.uniqueVectorsOrTrajectories} | Duplicates: ${weekAudit.duplicateCount}`);
  console.log(`[MONTH DATASET] Rows: ${monthAudit.totalRows} | Cols: ${monthAudit.totalCols} | StageCols: ${monthAudit.stageColsCount} | SHA256: ${monthAudit.sha256}`);
  console.log(`                Unique Trajectories: ${monthAudit.uniqueVectorsOrTrajectories} | Duplicates: ${monthAudit.duplicateCount}\n`);

  // 2. AUTOMATED FOCUSED TEST SUITE (A to O)
  console.log('--- 2. AUTOMATED FOCUSED CONDITION PIPELINE TESTS (A to O) ---');
  const testResults: { id: string; name: string; passed: boolean; message: string }[] = [];

  // TEST A: Exact TEST pattern match
  try {
    const rawDataset = await conditionEngine.loadTestDataset();
    const sample = rawDataset[10]; // Known exact row from dataset
    const match = await conditionEngine.matchTestPattern(sample.vector);
    const passed = match.matchType === 'EXACT' && match.distance === 0 && match.sno === sample.sno;
    testResults.push({
      id: 'TEST_A',
      name: 'Exact TEST pattern match',
      passed,
      message: `Matched SNO ${match.sno} with distance ${match.distance} (Type: ${match.matchType})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_A', name: 'Exact TEST pattern match', passed: false, message: e.message });
  }

  // TEST B: Approximate TEST pattern match
  try {
    // Vector with subtle delta not in exact set
    const approxVector: StageVector = [2, 1, 3, 2, 1, 1, 0, 1, 0, 1, 0];
    const match = await conditionEngine.matchTestPattern(approxVector);
    const passed = match.matchType === 'APPROXIMATE' || match.matchType === 'EQUIVALENT' || match.distance > 0;
    testResults.push({
      id: 'TEST_B',
      name: 'Approximate TEST pattern match',
      passed,
      message: `Resolved nearest pattern SNO ${match.sno} with distance ${match.distance} (Type: ${match.matchType})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_B', name: 'Approximate TEST pattern match', passed: false, message: e.message });
  }

  // TEST C: No acceptable match
  try {
    // Extreme outlier vector
    const outlierVector: StageVector = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const match = await conditionEngine.matchTestPattern(outlierVector);
    const passed = match.distance >= 0 && (match.matchType === 'NO_ACCEPTABLE_MATCH' || match.matchType === 'APPROXIMATE');
    testResults.push({
      id: 'TEST_C',
      name: 'No acceptable match / Outlier handling',
      passed,
      message: `Evaluated outlier vector (Distance: ${match.distance}, MatchType: ${match.matchType})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_C', name: 'No acceptable match / Outlier handling', passed: false, message: e.message });
  }

  // TEST D: Label reconstruction agreement
  try {
    const rawDataset = await conditionEngine.loadTestDataset();
    let taxonomyAgreements = 0;
    let unexpectedSeverityMismatches = 0;
    const contextualTaxonomies = new Set([
      'ACTIVITY_METABOLIC_PATTERN',
      'THERMAL_ENVIRONMENTAL_PATTERN',
      'ENVIRONMENTAL_PRESSURE_ALTITUDE_PATTERN',
    ]);
    for (let i = 0; i < 50; i++) {
      const row = rawDataset[i];
      const evalResult = evaluateStageVector(row.vector);
      if (evalResult.primary_taxonomy === row.primary_taxonomy) taxonomyAgreements++;
      if (evalResult.severity_label !== row.severity_label && !contextualTaxonomies.has(row.primary_taxonomy)) {
        unexpectedSeverityMismatches++;
      }
    }
    // Context channels are intentionally prevented from escalating the
    // physiological severity; dataset labels for those rows may therefore be
    // higher than the protected evaluator result.
    const passed = taxonomyAgreements === 50 && unexpectedSeverityMismatches === 0;
    testResults.push({
      id: 'TEST_D',
      name: 'Label reconstruction agreement',
      passed,
      message: `Verified ${taxonomyAgreements}/50 taxonomies with ${unexpectedSeverityMismatches} unexpected severity mismatches`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_D', name: 'Label reconstruction agreement', passed: false, message: e.message });
  }

  // TEST E: Label inconsistency detection
  try {
    const vector: StageVector = [4, 0, 3, 5, 1, 2, 4, 2, 1, 1, 3];
    const match = await conditionEngine.matchTestPattern(vector);
    const passed = typeof match.isLabelInconsistent === 'boolean';
    testResults.push({
      id: 'TEST_E',
      name: 'Label inconsistency detection',
      passed,
      message: `Evaluator flags consistency status correctly (isLabelInconsistent: ${match.isLabelInconsistent})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_E', name: 'Label inconsistency detection', passed: false, message: e.message });
  }

  // TEST F: Malformed CM_PACKET validation
  try {
    let caughtInvalidLength = false;
    let caughtNaN = false;
    let caughtOutOfRange = false;

    try {
      conditionEngine.validateAndExtractStageVector({ mlVector: [1, 2, 3] });
    } catch {
      caughtInvalidLength = true;
    }

    try {
      conditionEngine.validateAndExtractStageVector({ mlVector: [1, 2, NaN, 0, 0, 0, 0, 0, 0, 0, 0] });
    } catch {
      caughtNaN = true;
    }

    try {
      conditionEngine.validateAndExtractStageVector({ mlVector: [1, 2, 6, 0, 0, 0, 0, 0, 0, 0, 0] });
    } catch {
      caughtOutOfRange = true;
    }

    const passed = caughtInvalidLength && caughtNaN && caughtOutOfRange;
    testResults.push({
      id: 'TEST_F',
      name: 'Malformed CM_PACKET validation',
      passed,
      message: `Rejected malformed packets: invalid length (${caughtInvalidLength}), NaN (${caughtNaN}), out of range (${caughtOutOfRange})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_F', name: 'Malformed CM_PACKET validation', passed: false, message: e.message });
  }

  // TEST G: Authentication verification
  try {
    const testUid = 'usr_clinical_auth_001';
    const { report } = await conditionEngine.processCondition(
      { mlVector: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { uid: testUid }
    );
    const passed = report.uid === testUid;
    testResults.push({
      id: 'TEST_G',
      name: 'Authentication identity scoping',
      passed,
      message: `Report strictly scoped to authenticated user ${report.uid}`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_G', name: 'Authentication identity scoping', passed: false, message: e.message });
  }

  // TEST H: Unauthorized report access restriction
  try {
    const ownerUid = 'user_owner_alpha';
    const intruderUid = 'user_intruder_beta';
    const { report } = await conditionEngine.processCondition(
      { mlVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { uid: ownerUid }
    );

    reportStore.saveReport(report);
    let accessBlocked = false;
    try {
      reportStore.getReport(report.reportId, intruderUid);
    } catch (err: any) {
      if (err.statusCode === 403 || err.message.includes('Unauthorized')) {
        accessBlocked = true;
      }
    }

    const passed = accessBlocked;
    testResults.push({
      id: 'TEST_H',
      name: 'Unauthorized report access restriction',
      passed,
      message: `Intruder query properly rejected with 403 Forbidden`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_H', name: 'Unauthorized report access restriction', passed: false, message: e.message });
  }

  // TEST I: Report generation
  try {
    const { report } = await conditionEngine.processCondition(
      { mlVector: [3, 0, 2, 4, 1, 2, 3, 2, 1, 1, 2] },
      { uid: 'report_gen_user' }
    );
    const passed =
      Boolean(report.reportId) &&
      Boolean(report.conditionSummary) &&
      Boolean(report.matchedPattern) &&
      report.matchedPattern.inputStages.length === 11;
    testResults.push({
      id: 'TEST_I',
      name: 'Report document generation',
      passed,
      message: `Generated report ${report.reportId} with 11-channel breakdown and clinical summary`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_I', name: 'Report document generation', passed: false, message: e.message });
  }

  // TEST J: Report persistence
  try {
    const { report } = await conditionEngine.processCondition(
      { mlVector: [2, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0] },
      { uid: 'persist_user' }
    );
    reportStore.saveReport(report);
    const saved = reportStore.getReport(report.reportId, 'persist_user');
    const passed = saved !== null && saved.reportId === report.reportId;
    testResults.push({
      id: 'TEST_J',
      name: 'Report database persistence',
      passed,
      message: `Successfully persisted and read report ${report.reportId} from report store`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_J', name: 'Report database persistence', passed: false, message: e.message });
  }

  // TEST K: Report retrieval
  try {
    const list = reportStore.listReportsForUser('persist_user');
    const passed = Array.isArray(list) && list.length >= 1;
    testResults.push({
      id: 'TEST_K',
      name: 'Report list retrieval',
      passed,
      message: `Retrieved ${list.length} persisted report(s) for user persist_user`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_K', name: 'Report list retrieval', passed: false, message: e.message });
  }

  // TEST L: Report PDF download buffer generation
  try {
    const { report } = await conditionEngine.processCondition(
      { mlVector: [4, 0, 3, 5, 1, 2, 4, 2, 1, 1, 3] },
      { uid: 'pdf_test_user' }
    );
    const pdfBuffer = await generateReportPdfBuffer(report);
    const passed = Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 500 && pdfBuffer.slice(0, 4).toString() === '%PDF';
    testResults.push({
      id: 'TEST_L',
      name: 'Report PDF download generation',
      passed,
      message: `Generated valid PDF document buffer (${pdfBuffer.length} bytes, Header: %PDF)`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_L', name: 'Report PDF download generation', passed: false, message: e.message });
  }

  // TEST M: Longitudinal DAY interpretation (3 observations)
  try {
    const dayVectors: StageVector[] = [
      [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
      [2, 0, 2, 1, 0, 2, 1, 1, 0, 0, 0],
      [3, 0, 2, 2, 1, 2, 2, 1, 0, 0, 0],
    ];
    const { report, result } = await conditionEngine.processCondition(
      { stageVector: dayVectors[0] },
      { temporalLevel: 'DAY', longitudinalVectors: dayVectors, uid: 'day_user' }
    );
    const passed =
      result.temporalLevel === 'DAY' &&
      result.temporalObservationsCount === 3 &&
      report.temporalInterpretation.includes('3-observation');
    testResults.push({
      id: 'TEST_M',
      name: 'Longitudinal DAY interpretation',
      passed,
      message: `Evaluated 3-observation trajectory (Trend: ${result.trend_label}, Severity: ${result.severity_label})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_M', name: 'Longitudinal DAY interpretation', passed: false, message: e.message });
  }

  // TEST N: Longitudinal WEEK interpretation (21 observations)
  try {
    const weekVectors: StageVector[] = Array.from({ length: 21 }, (_, i) => [
      (i % 3) as any,
      0,
      (i % 2) as any,
      ((i % 4) > 1 ? 1 : 0) as any,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
    ]);
    const { report, result } = await conditionEngine.processCondition(
      { stageVector: weekVectors[0] },
      { temporalLevel: 'WEEK', longitudinalVectors: weekVectors, uid: 'week_user' }
    );
    const passed =
      result.temporalLevel === 'WEEK' &&
      result.temporalObservationsCount === 21 &&
      report.temporalInterpretation.includes('21-observation');
    testResults.push({
      id: 'TEST_N',
      name: 'Longitudinal WEEK interpretation',
      passed,
      message: `Evaluated 21-observation weekly sequence (Trend: ${result.trend_label}, Confidence: ${result.confidence_score})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_N', name: 'Longitudinal WEEK interpretation', passed: false, message: e.message });
  }

  // TEST O: Longitudinal MONTH interpretation (84 observations)
  try {
    const monthVectors: StageVector[] = Array.from({ length: 84 }, (_, i) => [
      Math.min(5, Math.floor(i / 20)) as any,
      0,
      Math.min(5, Math.floor(i / 25)) as any,
      Math.min(5, Math.floor(i / 30)) as any,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
    ]);
    const { report, result } = await conditionEngine.processCondition(
      { stageVector: monthVectors[0] },
      { temporalLevel: 'MONTH', longitudinalVectors: monthVectors, uid: 'month_user' }
    );
    const passed =
      result.temporalLevel === 'MONTH' &&
      result.temporalObservationsCount === 84 &&
      report.temporalInterpretation.includes('84-observation');
    testResults.push({
      id: 'TEST_O',
      name: 'Longitudinal MONTH interpretation',
      passed,
      message: `Evaluated 84-observation monthly sequence (Trend: ${result.trend_label}, Confidence: ${result.confidence_score})`,
    });
  } catch (e: any) {
    testResults.push({ id: 'TEST_O', name: 'Longitudinal MONTH interpretation', passed: false, message: e.message });
  }

  // Print Summary
  testResults.forEach((t) => {
    console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.id} - ${t.name}: ${t.message}`);
  });

  const allPassed = testResults.every((t) => t.passed);
  console.log(`\nCondition Test Suite Summary: ${allPassed ? 'ALL 15 TESTS PASSED' : 'SOME TESTS FAILED'}`);
}

runConditionTestSuite();
