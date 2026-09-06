import type { ReportType } from '../types';

export interface UnifiedC50Evidence {
  source: string;
  dataset?: string | null;
  matchType?: 'EXACT' | 'EQUIVALENT' | 'APPROXIMATE' | 'NO_ACCEPTABLE_MATCH' | null;
  matchedSno?: number | string | null;
  primaryTaxonomy?: string | null;
  secondaryTaxonomy?: string | null;
  patternLabel?: string | null;
  severityLabel?: string | null;
  severityScore?: number | string | null;
  confidenceScore?: number | string | null;
  confidenceLevel?: string | null;
  trendLabel?: string | null;
  inputStages?: number[] | null;
  matchedStages?: number[] | null;
  vectorLength?: number | null;
  classificationStatus?: string | null;
}

export interface UnifiedReportProvenance {
  reportType: ReportType;
  testId?: string | null;
  sessionId?: string | null;
  dayId?: string | null;
  sourceTestIds?: string[];
  weekId?: string | null;
  sourceDayIds?: string[];
  sourceTestIdsByDay?: string[][];
  dayDates?: string[];
  qaSessionId?: string | null;
  qaCompletionStatus?: string | null;
  qaCompletedAt?: string | null;
}

function first(source: any, ...keys: string[]): any {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  }
  return null;
}

export function buildUnifiedC50Evidence(source: any, reportType: ReportType, dataset = 'C50'): UnifiedC50Evidence {
  const inputStages = Array.isArray(source?.weekVector)
    ? source.weekVector
    : Array.isArray(source?.inputStages) ? source.inputStages : null;
  const matchedStages = Array.isArray(source?.matchedStages) ? source.matchedStages : null;
  return {
    source: `PMT-${reportType} authoritative classification`,
    dataset,
    matchType: first(source, 'matchType', 'matchStatus'),
    matchedSno: first(source, 'matchedSno', 'referenceDatasetSno'),
    primaryTaxonomy: first(source, 'primaryTaxonomy', 'primary_taxonomy', 'classification'),
    secondaryTaxonomy: first(source, 'secondaryTaxonomy', 'secondary_taxonomy'),
    patternLabel: first(source, 'patternLabel', 'pattern_label', 'matchedPattern'),
    severityLabel: first(source, 'severityLabel', 'severity'),
    severityScore: first(source, 'severityScore'),
    confidenceScore: first(source, 'confidenceScore'),
    confidenceLevel: first(source, 'confidenceLevel'),
    trendLabel: first(source, 'trendLabel', 'trend'),
    inputStages,
    matchedStages,
    vectorLength: first(source, 'vectorLength') ?? inputStages?.length ?? null,
    classificationStatus: first(source, 'classificationStatus', 'status'),
  };
}
