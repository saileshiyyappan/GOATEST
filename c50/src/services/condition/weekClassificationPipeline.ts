import weekDatasetCsv from '../../../data/week_dataset.csv?raw';
import type { ConditionMatchStatus, WeekConditionResult } from './conditionTypes';

const WEEK_VECTOR_LENGTH = 231;
const DAY_VECTOR_LENGTH = 33;
const DAY_COUNT = 7;

export interface WeekAggregationInputLike {
  uid: string;
  weekStart: string;
  weekEnd: string;
  weekId: string;
  dayObservationIds: string[];
  days: Array<{
    dayObservationId: string;
    uid: string;
    date: string;
    testObservationIds: string[];
    inputStages: number[];
    status: string;
    qaSessionId?: string | null;
    qaCompletionStatus?: string | null;
    c50Result?: Record<string, any> | null;
    source?: Record<string, any>;
  }>;
  weekVector: number[];
}

interface WeekDatasetRow {
  sno: string;
  vector: number[];
  testVectors: number[][];
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: string;
  severity_score: string;
  confidence_score: string;
  confidence_level: string;
  trend_label: string;
}

export interface WeekClassificationResult extends WeekConditionResult {
  uid: string;
  weekId: string;
  weekStart: string;
  weekEnd: string;
  dayObservationIds: string[];
  dayDates: string[];
  testObservationIds: string[];
  weekVector: number[];
  dayProvenance: Array<{
    dayObservationId: string;
    date: string;
    testObservationIds: string[];
    status: string;
    qaSessionId?: string | null;
    qaCompletionStatus?: string | null;
    c50Result?: Record<string, any> | null;
    source?: Record<string, any>;
  }>;
  vectorLength: number;
  source: 'PMT12_WEEK_AGGREGATION';
}

function parseDataset(): WeekDatasetRow[] {
  const lines = weekDatasetCsv.trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(1).map((line) => {
    const columns = line.split(',');
    const vector = columns.slice(1, 232).map(Number);
    return {
      sno: columns[0],
      vector,
      testVectors: Array.from({ length: 21 }, (_, index) => vector.slice(index * 11, (index + 1) * 11)),
      primary_taxonomy: columns[232],
      secondary_taxonomy: columns[233],
      pattern_label: columns[234],
      severity_label: columns[235],
      severity_score: columns[236],
      confidence_score: columns[237],
      confidence_level: columns[238],
      trend_label: columns[239],
    };
  });
}

function invalidInput(input: WeekAggregationInputLike, error: string): WeekClassificationResult {
  return {
    success: false,
    status: 'ERROR',
    temporalLevel: 'WEEK',
    matchStatus: 'NO_ACCEPTABLE_MATCH',
    uid: input?.uid || '',
    weekId: input?.weekId || '',
    weekStart: input?.weekStart || '',
    weekEnd: input?.weekEnd || '',
    dayObservationIds: input?.dayObservationIds || [],
    dayDates: input?.days?.map((day) => day.date) || [],
    testObservationIds: input?.days?.flatMap((day) => day.testObservationIds || []) || [],
    weekVector: input?.weekVector ? [...input.weekVector] : [],
    dayProvenance: input?.days?.map((day) => ({ dayObservationId: day.dayObservationId, date: day.date, testObservationIds: [...(day.testObservationIds || [])], status: day.status, qaSessionId: day.qaSessionId, qaCompletionStatus: day.qaCompletionStatus, c50Result: day.c50Result, source: day.source })) || [],
    vectorLength: input?.weekVector?.length || 0,
    source: 'PMT12_WEEK_AGGREGATION',
    error,
  };
}

export function buildWeekNotEligibleResult(options: {
  uid: string;
  weekStart: string;
  weekEnd: string;
  status?: 'WEEK_NOT_ELIGIBLE' | 'UID_MISMATCH_REJECTED';
  error: string;
}): WeekClassificationResult {
  return {
    success: false,
    status: options.status || 'WEEK_NOT_ELIGIBLE',
    temporalLevel: 'WEEK',
    matchStatus: 'NO_ACCEPTABLE_MATCH',
    uid: options.uid,
    weekId: '',
    weekStart: options.weekStart,
    weekEnd: options.weekEnd,
    dayObservationIds: [],
    dayDates: [],
    testObservationIds: [],
    weekVector: [],
    dayProvenance: [],
    vectorLength: 0,
    source: 'PMT12_WEEK_AGGREGATION',
    error: options.error,
  };
}

function validateInput(input: WeekAggregationInputLike): string | null {
  if (!input || !input.uid || !input.weekId || !input.weekStart || !input.weekEnd) return 'PMT-12 WEEK input identity is incomplete.';
  if (!Array.isArray(input.days) || input.days.length !== DAY_COUNT) return 'PMT-12 WEEK input must contain exactly 7 DAY observations.';
  if (!Array.isArray(input.dayObservationIds) || input.dayObservationIds.length !== DAY_COUNT) return 'PMT-12 WEEK day observation IDs are incomplete.';
  if (!Array.isArray(input.weekVector) || input.weekVector.length !== WEEK_VECTOR_LENGTH) return `Invalid WEEK stage vector length: expected ${WEEK_VECTOR_LENGTH} stages.`;
  if (input.days.some((day) => day.uid !== input.uid || day.status !== 'COMPLETED' || !Array.isArray(day.testObservationIds) || day.testObservationIds.length !== 3 || !Array.isArray(day.inputStages) || day.inputStages.length !== DAY_VECTOR_LENGTH)) return 'PMT-12 WEEK input contains an invalid DAY observation.';
  const dates = input.days.map((day) => day.date);
  if (new Set(dates).size !== DAY_COUNT || dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) return 'PMT-12 WEEK input must contain 7 unique ISO calendar dates.';
  if (dates.some((date) => date < input.weekStart || date > input.weekEnd)) return 'PMT-12 WEEK input contains a DAY outside the canonical calendar week.';
  const expectedDates = Array.from({ length: DAY_COUNT }, (_, index) => {
    const date = new Date(`${input.weekStart}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  if (dates.some((date, index) => date !== expectedDates[index])) return 'PMT-12 WEEK input must be ordered Monday through Sunday with no calendar gaps.';
  if (input.days.some((day, index) => day.dayObservationId !== input.dayObservationIds[index])) return 'PMT-12 WEEK day ordering/provenance is inconsistent.';
  const flattenedDays = input.days.flatMap((day) => day.inputStages);
  if (input.weekVector.some((stage, index) => stage !== flattenedDays[index])) return 'PMT-12 WEEK vector does not match the validated DAY observations.';
  if (input.weekVector.some((stage) => !Number.isInteger(stage) || stage < 0 || stage > 5)) return 'PMT-12 WEEK input contains a stage outside the allowed integer range 0..5.';
  return null;
}

function matchWeekPattern(vector: number[]): { row: WeekDatasetRow | null; distance: number; matchType: ConditionMatchStatus } {
  const dataset = parseDataset();
  for (const row of dataset) {
    if (row.vector.every((stage, index) => stage === vector[index])) return { row, distance: 0, matchType: 'EXACT' };
  }
  let bestRow: WeekDatasetRow | null = null;
  let minDistance = Number.POSITIVE_INFINITY;
  for (const row of dataset) {
    const sumSquared = row.vector.reduce((sum, stage, index) => sum + (stage - vector[index]) ** 2, 0);
    const distance = Math.sqrt(sumSquared);
    if (distance < minDistance) { minDistance = distance; bestRow = row; }
  }
  if (minDistance > 18) return { row: null, distance: Number(minDistance.toFixed(3)), matchType: 'NO_ACCEPTABLE_MATCH' };
  return { row: bestRow, distance: Number(minDistance.toFixed(3)), matchType: minDistance <= 2.5 ? 'EQUIVALENT' : 'APPROXIMATE' };
}

/** Browser-safe PMT-13 consumer. It mirrors the existing C50 WEEK matcher and has no side effects. */
export function classifyWeekAggregation(input: WeekAggregationInputLike): WeekClassificationResult {
  const validationError = validateInput(input);
  if (validationError) return invalidInput(input, validationError);
  const matched = matchWeekPattern(input.weekVector);
  const base = {
    uid: input.uid, weekId: input.weekId, weekStart: input.weekStart, weekEnd: input.weekEnd,
    dayObservationIds: [...input.dayObservationIds], dayDates: input.days.map((day) => day.date),
    testObservationIds: input.days.flatMap((day) => day.testObservationIds), vectorLength: input.weekVector.length,
    weekVector: [...input.weekVector],
    dayProvenance: input.days.map((day) => ({ ...day, testObservationIds: [...day.testObservationIds] })),
    source: 'PMT12_WEEK_AGGREGATION' as const, temporalLevel: 'WEEK' as const,
  };
  if (!matched.row) return { ...base, success: false, status: 'NO_ACCEPTABLE_MATCH', matchStatus: matched.matchType, inputStages: [...input.weekVector], matchedStages: null, distanceScore: matched.distance, classification: null, error: `NO_ACCEPTABLE_MATCH: nearest WEEK reference distance=${matched.distance.toFixed(3)}` };
  let confidenceScore = matched.row.confidence_score;
  let confidenceLevel = matched.row.confidence_level;
  if (matched.matchType === 'APPROXIMATE') {
    const adjusted = Math.max(0.5, Number(confidenceScore) - matched.distance * 0.015);
    confidenceScore = adjusted.toFixed(2);
    confidenceLevel = adjusted >= 0.85 ? 'HIGH' : adjusted >= 0.65 ? 'MEDIUM' : 'LOW';
  }
  return {
    ...base, success: true, status: 'COMPLETED', matchStatus: matched.matchType, inputStages: [...input.weekVector], matchedStages: [...matched.row.vector], matchedPattern: matched.row.pattern_label,
    classification: matched.row.primary_taxonomy, secondaryTaxonomy: matched.row.secondary_taxonomy, severity: matched.row.severity_label as any,
    severityScore: Number(matched.row.severity_score), confidence: Number(confidenceScore), confidenceScore: Number(confidenceScore), confidenceLevel: confidenceLevel as any,
    trend: matched.row.trend_label as any, referenceDatasetSno: Number(matched.row.sno), distanceScore: matched.distance,
    conditionSummary: `${matched.row.pattern_label} (${matched.row.primary_taxonomy})`, persisted: null, notifications: [],
  };
}
