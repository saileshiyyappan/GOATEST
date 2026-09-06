import { buildWeekReportFromClassification } from './reportEngineService';
import type { WeekClassificationResult } from './weekClassificationService';

const baseClassification = (overrides: Partial<WeekClassificationResult> = {}): WeekClassificationResult => ({
  success: true,
  status: 'COMPLETED',
  temporalLevel: 'WEEK',
  matchStatus: 'EXACT',
  uid: 'uid_test',
  weekId: 'week_uid_test_2026-08-24_2026-08-30',
  weekStart: '2026-08-24',
  weekEnd: '2026-08-30',
  dayObservationIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'],
  dayDates: ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
  testObservationIds: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't19', 't20', 't21'],
  dayProvenance: Array.from({ length: 7 }, (_, index) => ({ dayObservationId: `d${index + 1}`, date: `2026-08-${String(24 + index).padStart(2, '0')}`, testObservationIds: [`t${index * 3 + 1}`, `t${index * 3 + 2}`, `t${index * 3 + 3}`], status: 'COMPLETED', qaSessionId: `qa${index + 1}`, qaCompletionStatus: 'COMPLETED' })),
  inputStages: Array(231).fill(0),
  matchedStages: Array(231).fill(0),
  vectorLength: 231,
  matchedPattern: 'Cardiorespiratory Load',
  classification: 'CARDIORESPIRATORY_PATTERN',
  secondaryTaxonomy: 'CARDIAC_LOAD',
  severity: 'RISK',
  severityScore: 0.8,
  confidenceScore: 0.95,
  confidenceLevel: 'HIGH',
  trend: 'STABLE',
  referenceDatasetSno: 1,
  distanceScore: 0,
  source: 'PMT12_WEEK_AGGREGATION',
  ...overrides,
} as WeekClassificationResult);

export function runWeekReportProjectionTests(): void {
  const exact = buildWeekReportFromClassification(baseClassification(), 'uid_test');
  if (exact.reportId !== 'rep_week_week_uid_test_2026-08-24_2026-08-30') throw new Error('WEEK report ID is not deterministic');
  if (exact.readableContent.metricsSummary?.weekVector?.length !== 231) throw new Error('WEEK vector was not preserved');
  if (exact.readableContent.metricsSummary?.matchStatus !== 'EXACT' || exact.readableContent.metricsSummary?.referenceDatasetSno !== 1) throw new Error('PMT-13 match metadata was not preserved');
  if (exact.readableContent.metricsSummary?.severity !== 'RISK' || exact.readableContent.metricsSummary?.confidenceLevel !== 'HIGH' || exact.readableContent.metricsSummary?.trend !== 'STABLE') throw new Error('PMT-13 classification labels were changed');
  if (exact.c50Evidence?.matchType !== 'EXACT' || exact.c50Evidence?.vectorLength !== 231 || exact.provenance?.sourceDayIds?.length !== 7 || exact.provenance?.sourceTestIds?.length !== 21) throw new Error('Unified C50/provenance contract is incomplete');
  if (!exact.readableContent.observations || exact.readableContent.observations.length !== 7) throw new Error('DAY provenance was not preserved');
  if (!exact.readableContent.sections?.some((section) => section.body.includes('Cardiorespiratory Load'))) throw new Error('PMT-13 pattern was not preserved');

  const noMatch = buildWeekReportFromClassification(baseClassification({ success: false, status: 'NO_ACCEPTABLE_MATCH', matchStatus: 'NO_ACCEPTABLE_MATCH', matchedPattern: null, classification: null, secondaryTaxonomy: undefined, severity: null, severityScore: null, confidenceLevel: null, confidenceScore: null, trend: null, referenceDatasetSno: null, matchedStages: null }), 'uid_test');
  if (noMatch.readableContent.metricsSummary?.c50Available !== false) throw new Error('NO_ACCEPTABLE_MATCH was marked available');
  if (!noMatch.readableContent.summary.includes('no acceptable C50 dataset trajectory')) throw new Error('NO_ACCEPTABLE_MATCH summary is missing');
}
