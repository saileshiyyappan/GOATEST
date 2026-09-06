import * as fs from 'fs';
import * as readline from 'readline';
import { C50CleanRecord, SeverityLevel, ConfidenceLevel, StageValue } from './types';

export interface DatasetStatistics {
  totalRows: number;
  observationDepth: number;
  basePatternCount: number;
  uniquePatterns: number;
  duplicatePatterns: number;
  complexityDistribution: Record<number, number>; // 0 to 11
  stageDistribution: Record<StageValue, number>; // overall counts of stage 0..5 across all 11 features
  parameterStageDistribution: Record<string, Record<StageValue, number>>;
  severityDistribution: Record<SeverityLevel, number>;
  confidenceDistribution: Record<ConfidenceLevel, number>;
  primaryTaxonomyDistribution: Record<string, number>;
  trendDistribution: Record<string, number>;
}

export interface FullDatasetReport {
  patternLibrarySize: number;
  basePatternCount: number;
  temporalObservationDepths: {
    testDepth: number;
    dayDepth: number;
    weekDepth: number;
    monthDepth: number;
    ratio: string;
  };
  test: DatasetStatistics;
  day: DatasetStatistics;
  week: DatasetStatistics;
  month: DatasetStatistics;
}

export const PARAM_NAMES = [
  'HR_stage',
  'SpO2_stage',
  'PPI_stage',
  'RMSSD_stage',
  'SDNN_stage',
  'RespiratoryRate_stage',
  'ActivityIntensity_stage',
  'AmbientTemperature_stage',
  'RelativeHumidity_stage',
  'AtmosphericPressure_stage',
  'Altitude_stage',
] as const;

export function getVectorKey(r: C50CleanRecord): string {
  return [
    r.HR_stage,
    r.SpO2_stage,
    r.PPI_stage,
    r.RMSSD_stage,
    r.SDNN_stage,
    r.RespiratoryRate_stage,
    r.ActivityIntensity_stage,
    r.AmbientTemperature_stage,
    r.RelativeHumidity_stage,
    r.AtmosphericPressure_stage,
    r.Altitude_stage,
  ].join(',');
}

export function computeDatasetDistribution(
  records: C50CleanRecord[],
  observationDepth: number = 1
): DatasetStatistics {
  const uniqueSet = new Set<string>();
  const complexityDist: Record<number, number> = {};
  for (let i = 0; i <= 11; i++) complexityDist[i] = 0;

  const stageDist: Record<StageValue, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  const paramStageDist: Record<string, Record<StageValue, number>> = {};
  PARAM_NAMES.forEach((p) => {
    paramStageDist[p] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  });

  const severityDist: Record<SeverityLevel, number> = {
    NORMAL: 0,
    CONTROL: 0,
    MILD: 0,
    HIGH: 0,
    RISK: 0,
  };

  const confidenceDist: Record<ConfidenceLevel, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  const taxonomyDist: Record<string, number> = {};
  const trendDist: Record<string, number> = {};

  for (const r of records) {
    const key = getVectorKey(r);
    uniqueSet.add(key);

    const stages: StageValue[] = [
      r.HR_stage,
      r.SpO2_stage,
      r.PPI_stage,
      r.RMSSD_stage,
      r.SDNN_stage,
      r.RespiratoryRate_stage,
      r.ActivityIntensity_stage,
      r.AmbientTemperature_stage,
      r.RelativeHumidity_stage,
      r.AtmosphericPressure_stage,
      r.Altitude_stage,
    ];

    const activeCount = stages.filter((s) => s > 0).length;
    complexityDist[activeCount] = (complexityDist[activeCount] || 0) + 1;

    stages.forEach((st, idx) => {
      stageDist[st] = (stageDist[st] || 0) + 1;
      const pName = PARAM_NAMES[idx];
      paramStageDist[pName][st] = (paramStageDist[pName][st] || 0) + 1;
    });

    if (severityDist[r.severity_label] !== undefined) {
      severityDist[r.severity_label]++;
    }

    if (confidenceDist[r.confidence_level] !== undefined) {
      confidenceDist[r.confidence_level]++;
    }

    taxonomyDist[r.primary_taxonomy] = (taxonomyDist[r.primary_taxonomy] || 0) + 1;
    trendDist[r.trend_label] = (trendDist[r.trend_label] || 0) + 1;
  }

  return {
    totalRows: records.length,
    observationDepth,
    basePatternCount: records.length > 0 ? Math.floor(records.length / observationDepth) : 0,
    uniquePatterns: uniqueSet.size,
    duplicatePatterns: records.length - uniqueSet.size,
    complexityDistribution: complexityDist,
    stageDistribution: stageDist,
    parameterStageDistribution: paramStageDist,
    severityDistribution: severityDist,
    confidenceDistribution: confidenceDist,
    primaryTaxonomyDistribution: taxonomyDist,
    trendDistribution: trendDist,
  };
}

/**
 * Computes dataset statistics directly from a disk CSV file via fast streaming.
 */
export async function computeCsvFileStatistics(
  csvFilePath: string,
  observationDepth: number
): Promise<DatasetStatistics> {
  const uniqueSet = new Set<string>();
  const complexityDist: Record<number, number> = {};
  for (let i = 0; i <= 11; i++) complexityDist[i] = 0;

  const stageDist: Record<StageValue, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  const paramStageDist: Record<string, Record<StageValue, number>> = {};
  PARAM_NAMES.forEach((p) => {
    paramStageDist[p] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  });

  const severityDist: Record<SeverityLevel, number> = {
    NORMAL: 0,
    CONTROL: 0,
    MILD: 0,
    HIGH: 0,
    RISK: 0,
  };

  const confidenceDist: Record<ConfidenceLevel, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  const taxonomyDist: Record<string, number> = {};
  const trendDist: Record<string, number> = {};

  let totalRows = 0;

  const fileStream = fs.createReadStream(csvFilePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isHeader = true;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      isHeader = false;
      continue;
    }

    totalRows++;
    const cols = line.split(',');
    const stageCount = 11 * observationDepth;
    if (cols.length < stageCount + 9) continue;

    // First vector (v0)
    const stages: StageValue[] = [];
    for (let s = 1; s <= 11; s++) {
      stages.push(parseInt(cols[s], 10) as StageValue);
    }

    const vecKey = cols.slice(1, 12).join(',');
    uniqueSet.add(vecKey);

    const activeCount = stages.filter((s) => s > 0).length;
    complexityDist[activeCount] = (complexityDist[activeCount] || 0) + 1;

    // Collect stage distribution across all stages in the row
    for (let i = 1; i <= stageCount; i++) {
      const st = parseInt(cols[i], 10) as StageValue;
      stageDist[st] = (stageDist[st] || 0) + 1;
      const pIdx = (i - 1) % 11;
      const pName = PARAM_NAMES[pIdx];
      paramStageDist[pName][st] = (paramStageDist[pName][st] || 0) + 1;
    }

    const primTax = cols[stageCount + 1];
    const sevLabel = cols[stageCount + 4] as SeverityLevel;
    const confLevel = cols[stageCount + 7] as ConfidenceLevel;
    const trendLabel = cols[stageCount + 8];

    if (severityDist[sevLabel] !== undefined) severityDist[sevLabel]++;
    if (confidenceDist[confLevel] !== undefined) confidenceDist[confLevel]++;
    if (primTax) taxonomyDist[primTax] = (taxonomyDist[primTax] || 0) + 1;
    if (trendLabel) trendDist[trendLabel] = (trendDist[trendLabel] || 0) + 1;
  }

  return {
    totalRows,
    observationDepth,
    basePatternCount: totalRows,
    uniquePatterns: uniqueSet.size,
    duplicatePatterns: totalRows - uniqueSet.size,
    complexityDistribution: complexityDist,
    stageDistribution: stageDist,
    parameterStageDistribution: paramStageDist,
    severityDistribution: severityDist,
    confidenceDistribution: confidenceDist,
    primaryTaxonomyDistribution: taxonomyDist,
    trendDistribution: trendDist,
  };
}
