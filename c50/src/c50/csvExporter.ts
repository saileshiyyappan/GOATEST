import * as fs from 'fs';
import * as path from 'path';
import { C50CleanRecord, C50WideRecord, STAGE_FEATURE_NAMES, LABEL_HEADER_NAMES } from './types';

export const BASE_STAGE_HEADERS = [...STAGE_FEATURE_NAMES];
export const LABEL_HEADERS = [...LABEL_HEADER_NAMES];

/**
 * Builds the CSV header string for a given temporal depth (1 for TEST, 3 for DAY, 21 for WEEK, 84 for MONTH).
 * Pattern: SNO, [11 stages] * depth, primary_taxonomy, ..., trend_label
 */
export function buildDatasetHeader(depth: number): string {
  const stageHeaders: string[] = [];
  for (let i = 0; i < depth; i++) {
    stageHeaders.push(...BASE_STAGE_HEADERS);
  }
  return ['SNO', ...stageHeaders, ...LABEL_HEADERS].join(',');
}

export const C50_TEST_HEADER_STRING = buildDatasetHeader(1);
export const C50_DAY_HEADER_STRING = buildDatasetHeader(3);
export const C50_WEEK_HEADER_STRING = buildDatasetHeader(21);
export const C50_MONTH_HEADER_STRING = buildDatasetHeader(84);

// Backwards compatibility alias
export const C50_CSV_HEADER_STRING = C50_TEST_HEADER_STRING;

export function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatWideRecordToCsvLine(rec: C50WideRecord): string {
  return [
    rec.SNO,
    ...rec.stageValues,
    rec.primary_taxonomy,
    escapeCsvField(rec.secondary_taxonomy),
    escapeCsvField(rec.pattern_label),
    rec.severity_label,
    rec.severity_score,
    rec.confidence_score,
    rec.confidence_level,
    rec.trend_label,
  ].join(',');
}

export function formatRecordToCsvLine(rec: C50CleanRecord): string {
  return [
    rec.SNO,
    rec.HR_stage,
    rec.SpO2_stage,
    rec.PPI_stage,
    rec.RMSSD_stage,
    rec.SDNN_stage,
    rec.RespiratoryRate_stage,
    rec.ActivityIntensity_stage,
    rec.AmbientTemperature_stage,
    rec.RelativeHumidity_stage,
    rec.AtmosphericPressure_stage,
    rec.Altitude_stage,
    rec.primary_taxonomy,
    escapeCsvField(rec.secondary_taxonomy),
    escapeCsvField(rec.pattern_label),
    rec.severity_label,
    rec.severity_score,
    rec.confidence_score,
    rec.confidence_level,
    rec.trend_label,
  ].join(',');
}

export interface DatasetFilePaths {
  datasetRootDir: string;
  testCsvPath: string;
  dayCsvPath: string;
  weekCsvPath: string;
  monthCsvPath: string;
}

/**
 * Returns dataset file paths in the standard 'data/' directory.
 */
export function getDatasetPaths(rootDir: string = process.cwd()): DatasetFilePaths {
  const dataRootDir = path.join(rootDir, 'data');
  return {
    datasetRootDir: dataRootDir,
    testCsvPath: path.join(dataRootDir, 'test_dataset.csv'),
    dayCsvPath: path.join(dataRootDir, 'day_dataset.csv'),
    weekCsvPath: path.join(dataRootDir, 'week_dataset.csv'),
    monthCsvPath: path.join(dataRootDir, 'month_dataset.csv'),
  };
}

export function ensureDatasetDirectories(paths: DatasetFilePaths) {
  const dirs = [
    paths.datasetRootDir,
    path.dirname(paths.testCsvPath),
    path.dirname(paths.dayCsvPath),
    path.dirname(paths.weekCsvPath),
    path.dirname(paths.monthCsvPath),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

