import dayDatasetCsv from '../../../c50/data/day_dataset.csv?raw';
import { evaluateStageVector, evaluateTrajectory, type StageVector } from '../../../c50/src/c50/evaluator';
import type { DayConditionResult, ConditionMatchStatus } from '../../../c50/src/services/condition/conditionTypes';
import type { DayAggregationInput } from './dayAggregationService';
import type { QaSessionRecord, ReportRecord } from '../types';
import { buildUnifiedC50Evidence } from './conditionReportContract';

interface DayDatasetRow {
  sno: string;
  vector: number[];
  testVectors: [StageVector, StageVector, StageVector];
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: any;
  severity_score: string;
  confidence_score: string;
  confidence_level: any;
  trend_label: any;
}

export interface ValidatedDayInput extends DayAggregationInput {
  qaSessionId: string;
  qaCompletionStatus: 'COMPLETED';
  qaCompletedAt?: string;
  qaSession: QaSessionRecord;
}

export interface HomeDayConditionResult extends DayConditionResult {
  uid: string;
  date: string;
  dayObservationId: string;
  qaSessionId: string;
  qaCompletionStatus: 'COMPLETED';
  qaCompletedAt?: string;
}

let datasetCache: DayDatasetRow[] | null = null;

function loadDayDataset(): DayDatasetRow[] {
  if (datasetCache) return datasetCache;
  const lines = dayDatasetCsv.trim().split(/\r?\n/);
  datasetCache = lines.slice(1).filter(Boolean).map((line) => {
    const columns = line.split(',');
    const vector = columns.slice(1, 34).map((value) => Number.parseInt(value, 10));
    return {
      sno: columns[0],
      vector,
      testVectors: [vector.slice(0, 11), vector.slice(11, 22), vector.slice(22, 33)] as [StageVector, StageVector, StageVector],
      primary_taxonomy: columns[34],
      secondary_taxonomy: columns[35],
      pattern_label: columns[36],
      severity_label: columns[37],
      severity_score: columns[38],
      confidence_score: columns[39],
      confidence_level: columns[40],
      trend_label: columns[41],
    };
  });
  return datasetCache;
}

function matchDayPattern(vector: number[], testVectors: [StageVector, StageVector, StageVector]): DayDatasetRow & { distance: number; matchType: ConditionMatchStatus } {
  const dataset = loadDayDataset();
  const trajectory = evaluateTrajectory(testVectors);
  const exact = dataset.find((row) => row.vector.every((value, index) => value === vector[index]));
  if (exact) return { ...exact, distance: 0, matchType: 'EXACT' };

  let best: DayDatasetRow | null = null;
  let minDistance = Number.POSITIVE_INFINITY;
  for (const row of dataset) {
    const distance = Math.sqrt(row.vector.reduce((sum, value, index) => sum + (value - vector[index]) ** 2, 0));
    if (distance < minDistance) { minDistance = distance; best = row; }
  }
  if (!best) throw new Error('Failed to evaluate nearest DAY pattern from dataset');
  if (minDistance > 7) return { ...best, distance: Number(minDistance.toFixed(3)), matchType: 'NO_ACCEPTABLE_MATCH' };
  const matchType: ConditionMatchStatus = trajectory.primary_taxonomy === best.primary_taxonomy && Math.abs(Number(trajectory.severity_score) - Number(best.severity_score)) <= 0.08 ? 'EQUIVALENT' : 'APPROXIMATE';
  return { ...best, distance: Number(minDistance.toFixed(3)), matchType };
}

export function isValidatedDayInput(input: ValidatedDayInput): boolean {
  return input.observations.length === 3 && input.stageVectors.length === 3 && input.stageVectors.every((vector) => vector.length === 11) && input.qaCompletionStatus === 'COMPLETED' && input.qaSession.completionStatus === 'COMPLETED';
}

export function runDayCondition(input: ValidatedDayInput): HomeDayConditionResult {
  if (!isValidatedDayInput(input)) throw new Error('DAY_NOT_READY: three validated TESTs and completed Q/A are required');
  const testVectors = input.stageVectors as [StageVector, StageVector, StageVector];
  const dayVector = testVectors.flat();
  const matched = matchDayPattern(dayVector, testVectors);
  const trajectory = evaluateTrajectory(testVectors);
  const pointEvaluations = testVectors.map((vector) => evaluateStageVector(vector));
  const severityOrder: Record<string, number> = { NORMAL: 0, CONTROL: 1, MILD: 2, HIGH: 3, RISK: 4 };
  const initialSeverity = pointEvaluations[0].severity_label;
  const finalSeverity = pointEvaluations[2].severity_label;
  const peakSeverity = pointEvaluations.reduce((peak, current) => severityOrder[current.severity_label] > severityOrder[peak] ? current.severity_label : peak, initialSeverity);
  const meanSeverity = Number((pointEvaluations.reduce((sum, current) => sum + Number(current.severity_score), 0) / 3).toFixed(2));
  const matchingPatternCount = pointEvaluations.filter((point) => point.pattern_label === matched.pattern_label || point.primary_taxonomy === matched.primary_taxonomy).length;
  const result: HomeDayConditionResult = {
    uid: input.uid, date: input.date, dayObservationId: input.dayObservationId,
    qaSessionId: input.qaSessionId, qaCompletionStatus: 'COMPLETED', qaCompletedAt: input.qaCompletedAt,
    success: matched.matchType !== 'NO_ACCEPTABLE_MATCH', status: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? 'NO_ACCEPTABLE_MATCH' : 'COMPLETED', temporalLevel: 'DAY',
    observationId: input.dayObservationId, reportId: `rep_day_${input.dayObservationId}`, observationCount: 3, testObservationIds: input.testObservationIds,
    inputStages: dayVector, matchedStages: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? null : matched.vector, matchedPattern: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? null : matched.pattern_label,
    matchStatus: matched.matchType, classification: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? null : matched.primary_taxonomy,
    severity: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? null : matched.severity_label, severityScore: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? null : Number(matched.severity_score),
    confidence: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? 0 : Number(matched.confidence_score), confidenceScore: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? 0 : Number(matched.confidence_score), confidenceLevel: matched.confidence_level,
    trend: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? null : matched.trend_label, initialSeverity, peakSeverity, finalSeverity, meanSeverity,
    patternPersistence: Number((matchingPatternCount / 3).toFixed(2)), dominantPattern: matched.pattern_label, referenceDatasetSno: matched.matchType === 'NO_ACCEPTABLE_MATCH' ? null : Number(matched.sno), distanceScore: matched.distance,
    qaStatus: 'AVAILABLE', qaData: input.qaSession, conditionSummary: `${matched.pattern_label} observed across 3 validated diurnal tests.`, persisted: null,
  };
  console.info('[DAY C50]', { uid: input.uid, date: input.date, dayObservationId: input.dayObservationId, testCount: 3, qaStatus: 'COMPLETED', testObservationIds: input.testObservationIds, pattern: result.inputStages, matchType: result.matchStatus, sno: result.referenceDatasetSno, taxonomy: result.classification, severity: result.severity, confidence: result.confidence, trend: result.trend });
  return result;
}

export function buildDayReportRecord(result: HomeDayConditionResult): ReportRecord {
  const generatedAt = result.qaCompletedAt || `${result.date}T00:00:00.000Z`;
  return {
    reportId: result.reportId || `rep_day_${result.dayObservationId}`,
    userId: result.uid,
    reportType: 'DAY',
    referenceId: result.dayObservationId,
    title: `Daily Condition Report — ${result.date}`,
    generatedAt,
    status: result.status === 'COMPLETED' ? 'COMPLETED' : 'ARCHIVED',
    rawSourceReference: { collectionName: 'day', documentId: result.dayObservationId },
    readableContent: {
      summary: result.conditionSummary || 'DAY condition report',
      organTested: 'Daily assessment',
      sections: [{
        heading: 'DAY C50 Result',
        body: result.conditionSummary || '',
        bulletPoints: [
          `Pattern: ${result.matchedPattern || 'NO_ACCEPTABLE_MATCH'}`,
          `Match: ${result.matchStatus}`,
          `Taxonomy: ${result.classification || 'N/A'}`,
          `Severity: ${result.severity || 'N/A'} (${result.severityScore ?? 'N/A'})`,
          `Confidence: ${result.confidenceLevel || 'N/A'} (${result.confidenceScore ?? 'N/A'})`,
          `Trend: ${result.trend || 'N/A'}`,
          `TEST observations: ${result.testObservationIds.join(', ')}`,
          `Q/A session: ${result.qaSessionId} (${result.qaCompletionStatus})`,
        ],
      }],
      metricsSummary: { ...result, c50Evidence: buildUnifiedC50Evidence(result, 'DAY', 'C50_DAY'), c50Label: result.matchedPattern || (result.matchStatus === 'NO_ACCEPTABLE_MATCH' ? 'No acceptable dataset trajectory' : 'C50 result not available'), c50Available: result.matchStatus !== 'NO_ACCEPTABLE_MATCH' },
    },
    modelVersion: 'C50_DAY',
    isFixture: false,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    date: result.date,
    dayObservationId: result.dayObservationId,
    qaSessionId: result.qaSessionId,
    qaCompletionStatus: result.qaCompletionStatus,
    qaCompletedAt: result.qaCompletedAt,
    testObservationIds: result.testObservationIds,
    c50Result: result,
    assessmentDate: result.date,
    c50Evidence: buildUnifiedC50Evidence(result, 'DAY', 'C50_DAY'),
    provenance: {
      reportType: 'DAY', dayId: result.dayObservationId, sourceTestIds: [...result.testObservationIds],
      qaSessionId: result.qaSessionId, qaCompletionStatus: result.qaCompletionStatus, qaCompletedAt: result.qaCompletedAt,
    },
    technicalAudit: { reportType: 'DAY', vectorLength: result.inputStages.length, sourceObservationCount: 3, classificationStatus: result.status },
    healthCareGuidance: null,
    trajectoryResult: {
      initialSeverity: result.initialSeverity,
      peakSeverity: result.peakSeverity,
      finalSeverity: result.finalSeverity,
      meanSeverity: result.meanSeverity,
      trend: result.trend,
      patternPersistence: result.patternPersistence,
      dominantPattern: result.dominantPattern,
    },
  };
}
