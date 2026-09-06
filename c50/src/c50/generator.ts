import * as fs from 'fs';
import * as path from 'path';
import {
  C50CleanRecord,
  C50WideRecord,
  StageValue,
  TrendLabel,
} from './types';
import { evaluateStageVector, evaluateTrajectory, StageVector } from './evaluator';
import { buildPatternLibrary, PatternLibrary, vectorToKey } from './patternLibrary';
import { PRNG } from './prng';
import {
  C50_TEST_HEADER_STRING,
  C50_DAY_HEADER_STRING,
  C50_WEEK_HEADER_STRING,
  C50_MONTH_HEADER_STRING,
  formatWideRecordToCsvLine,
  formatRecordToCsvLine,
  getDatasetPaths,
  ensureDatasetDirectories,
  DatasetFilePaths,
} from './csvExporter';

export interface GeneratorOptions {
  seed?: number;
  basePatternCount?: number; // Base trajectories N (default 5,000)
  rootDir?: string;
}

export const DEFAULT_OPTIONS: Required<GeneratorOptions> = {
  seed: 42,
  basePatternCount: 5000,
  rootDir: process.cwd(),
};

export type TrajectoryArchetype =
  | 'STABLE_NORMAL'
  | 'STABLE_CONTROL'
  | 'MILD_PROGRESSION'
  | 'PROGRESSIVE_DETERIORATION'
  | 'RECOVERY'
  | 'FLUCTUATING'
  | 'PERSISTENT_ABNORMALITY'
  | 'MIXED_PHYSIOLOGICAL';

export function calculateSequenceTrend(severities: number[]): TrendLabel {
  const n = severities.length;
  if (n <= 1) return 'STABLE';

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = severities[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  const meanY = sumY / n;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += Math.pow(severities[i] - meanY, 2);
  }
  variance /= n;

  if (meanY < 0.05) return 'STABLE';
  if (meanY >= 0.50 && Math.abs(slope) < 0.025 && variance < 0.02) {
    return 'PERSISTENT_ABNORMALITY';
  }
  if (slope > 0.025) return 'DETERIORATING';
  if (slope < -0.025) {
    return severities[0] >= 0.45 ? 'RECOVERING' : 'IMPROVING';
  }
  if (variance > 0.02) return 'FLUCTUATING';
  return 'STABLE';
}

/**
 * Generates an 84-step temporal trajectory from an initial base pattern V0.
 */
export function generateTrajectoryVectors(
  v0: StageVector,
  archetype: TrajectoryArchetype,
  prng: PRNG
): StageVector[] {
  const vectors: StageVector[] = [v0];
  let current = [...v0] as StageVector;

  const clamp = (val: number): StageValue => {
    return Math.max(0, Math.min(5, Math.round(val))) as StageValue;
  };

  for (let step = 1; step < 84; step++) {
    const next = [...current] as StageVector;

    if (archetype === 'STABLE_NORMAL') {
      // Keep at 0 or minor transient fluctuation (<= 1 on max 1 parameter)
      if (prng.next() < 0.08) {
        const paramIdx = prng.nextInt(0, 10);
        next[paramIdx] = (prng.next() < 0.5 ? 1 : 0) as StageValue;
      } else {
        for (let i = 0; i < 11; i++) next[i] = 0;
      }
    } else if (archetype === 'STABLE_CONTROL') {
      // Subtle variations around stages 0..2
      if (prng.next() < 0.35) {
        const paramIdx = prng.nextInt(0, 10);
        const shift = prng.pick([-1, 1]);
        next[paramIdx] = clamp(next[paramIdx] + shift);
        if (next[paramIdx] > 2) next[paramIdx] = 2;
      }
    } else if (archetype === 'PROGRESSIVE_DETERIORATION') {
      // Upward trend in stages
      const progress = step / 84;
      const targetMin = Math.floor(progress * 4);
      for (let i = 0; i < 11; i++) {
        if (v0[i] > 0 || prng.next() < progress * 0.5) {
          const shift = prng.pick([0, 1, 1]);
          next[i] = clamp(Math.max(targetMin, next[i] + shift));
        }
      }
    } else if (archetype === 'RECOVERY') {
      // Downward trend toward baseline
      const progress = step / 84;
      for (let i = 0; i < 11; i++) {
        if (next[i] > 0 && prng.next() < 0.15 + progress * 0.45) {
          next[i] = clamp(next[i] - 1);
        }
      }
    } else if (archetype === 'MILD_PROGRESSION') {
      if (prng.next() < 0.25) {
        const paramIdx = prng.nextInt(0, 10);
        next[paramIdx] = clamp(next[paramIdx] + 1);
        if (next[paramIdx] > 3) next[paramIdx] = 3;
      }
    } else if (archetype === 'FLUCTUATING') {
      const activeIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((idx) => v0[idx] > 0);
      if (activeIndices.length === 0) activeIndices.push(prng.nextInt(0, 10));
      const targetParam = prng.pick(activeIndices);
      const delta = prng.pick([-2, -1, 0, 1, 2]);
      next[targetParam] = clamp(v0[targetParam] + delta);
    } else if (archetype === 'PERSISTENT_ABNORMALITY') {
      for (let i = 0; i < 11; i++) {
        if (v0[i] >= 3) {
          next[i] = clamp(v0[i] + prng.pick([-1, 0, 1]));
          if (next[i] < 3) next[i] = 3;
        } else if (v0[i] > 0 && prng.next() < 0.2) {
          next[i] = clamp(v0[i] + prng.pick([-1, 0, 1]));
        }
      }
    } else {
      // MIXED_PHYSIOLOGICAL
      if (prng.next() < 0.4) {
        const p1 = prng.nextInt(0, 10);
        next[p1] = clamp(next[p1] + prng.pick([-1, 1]));
      }
    }

    current = next;
    vectors.push(current);
  }

  return vectors;
}

export interface GenerationSummary {
  basePatternCount: number;
  testRowCount: number;
  dayRowCount: number;
  weekRowCount: number;
  monthRowCount: number;
  corePatternLibrarySize: number;
  paths: DatasetFilePaths;
}

/**
 * Generates the clean CSV files in data/ with expanded [] stage columns.
 */
export function generateC50DatasetsToDisk(
  options: GeneratorOptions = {}
): GenerationSummary {
  const seed = options.seed ?? DEFAULT_OPTIONS.seed;
  const N = options.basePatternCount ?? DEFAULT_OPTIONS.basePatternCount;
  const rootDir = options.rootDir ?? DEFAULT_OPTIONS.rootDir;

  const paths = getDatasetPaths(rootDir);
  ensureDatasetDirectories(paths);

  const prng = new PRNG(seed);
  const library = buildPatternLibrary(seed);

  // Select N diverse base patterns from the library
  const selectedBasePatterns: StageVector[] = [];
  const allLibraryPatterns = library.patterns;

  // First pick all unique patterns across complexities to ensure full complexity coverage
  for (let c = 0; c <= 11; c++) {
    const list = library.patternsByComplexity.get(c) || [];
    list.forEach((pat) => {
      if (selectedBasePatterns.length < N) {
        selectedBasePatterns.push(pat);
      }
    });
  }

  // If still need more to reach N, sample from library
  let sampleIdx = 0;
  while (selectedBasePatterns.length < N) {
    const pat = allLibraryPatterns[sampleIdx % allLibraryPatterns.length];
    selectedBasePatterns.push(pat);
    sampleIdx++;
  }

  // Open write streams / file buffers
  const testStream = fs.createWriteStream(paths.testCsvPath, { encoding: 'utf-8' });
  const dayStream = fs.createWriteStream(paths.dayCsvPath, { encoding: 'utf-8' });
  const weekStream = fs.createWriteStream(paths.weekCsvPath, { encoding: 'utf-8' });
  const monthStream = fs.createWriteStream(paths.monthCsvPath, { encoding: 'utf-8' });

  // Write Headers
  testStream.write(C50_TEST_HEADER_STRING + '\n');
  dayStream.write(C50_DAY_HEADER_STRING + '\n');
  weekStream.write(C50_WEEK_HEADER_STRING + '\n');
  monthStream.write(C50_MONTH_HEADER_STRING + '\n');

  const archetypes: TrajectoryArchetype[] = [
    'STABLE_NORMAL',
    'STABLE_CONTROL',
    'MILD_PROGRESSION',
    'PROGRESSIVE_DETERIORATION',
    'RECOVERY',
    'FLUCTUATING',
    'PERSISTENT_ABNORMALITY',
    'MIXED_PHYSIOLOGICAL',
  ];

  for (let i = 0; i < N; i++) {
    const sno = i + 1;
    const v0 = selectedBasePatterns[i];
    const maxV0Stage = Math.max(...v0);

    // Pick archetype conditioned on baseline
    let archetype: TrajectoryArchetype;
    if (maxV0Stage === 0) {
      archetype = prng.pick(['STABLE_NORMAL', 'STABLE_NORMAL', 'MILD_PROGRESSION', 'FLUCTUATING']);
    } else if (maxV0Stage <= 2) {
      archetype = prng.pick(['STABLE_CONTROL', 'MILD_PROGRESSION', 'RECOVERY', 'FLUCTUATING']);
    } else if (maxV0Stage >= 4) {
      archetype = prng.pick(['PERSISTENT_ABNORMALITY', 'PROGRESSIVE_DETERIORATION', 'RECOVERY', 'FLUCTUATING']);
    } else {
      archetype = archetypes[i % archetypes.length];
    }

    const trajectoryVectors = generateTrajectoryVectors(v0, archetype, prng);

    const testEval = evaluateStageVector(v0);

    // 1. TEST: 1 Observation of [] (11 stages)
    const testRecord: C50WideRecord = {
      SNO: sno,
      stageValues: [...v0],
      primary_taxonomy: testEval.primary_taxonomy,
      secondary_taxonomy: testEval.secondary_taxonomy,
      pattern_label: testEval.pattern_label,
      severity_label: testEval.severity_label,
      severity_score: testEval.severity_score,
      confidence_score: testEval.confidence_score,
      confidence_level: testEval.confidence_level,
      trend_label: 'N/A',
    };
    testStream.write(formatWideRecordToCsvLine(testRecord) + '\n');

    // 2. DAY: 3 Observations of [] = 3[] (33 stages)
    const dayVectors = trajectoryVectors.slice(0, 3);
    const dayStages: StageValue[] = [];
    for (let d = 0; d < 3; d++) {
      dayStages.push(...dayVectors[d]);
    }
    const dayEval = evaluateTrajectory(dayVectors);
    const dayRecord: C50WideRecord = {
      SNO: sno,
      stageValues: dayStages,
      primary_taxonomy: dayEval.primary_taxonomy,
      secondary_taxonomy: dayEval.secondary_taxonomy,
      pattern_label: dayEval.pattern_label,
      severity_label: dayEval.severity_label,
      severity_score: dayEval.severity_score,
      confidence_score: dayEval.confidence_score,
      confidence_level: dayEval.confidence_level,
      trend_label: dayEval.trend_label,
    };
    dayStream.write(formatWideRecordToCsvLine(dayRecord) + '\n');

    // 3. WEEK: 21 Observations of [] = 21[] (231 stages)
    const weekVectors = trajectoryVectors.slice(0, 21);
    const weekStages: StageValue[] = [];
    for (let w = 0; w < 21; w++) {
      weekStages.push(...weekVectors[w]);
    }
    const weekEval = evaluateTrajectory(weekVectors);
    const weekRecord: C50WideRecord = {
      SNO: sno,
      stageValues: weekStages,
      primary_taxonomy: weekEval.primary_taxonomy,
      secondary_taxonomy: weekEval.secondary_taxonomy,
      pattern_label: weekEval.pattern_label,
      severity_label: weekEval.severity_label,
      severity_score: weekEval.severity_score,
      confidence_score: weekEval.confidence_score,
      confidence_level: weekEval.confidence_level,
      trend_label: weekEval.trend_label,
    };
    weekStream.write(formatWideRecordToCsvLine(weekRecord) + '\n');

    // 4. MONTH: 84 Observations of [] = 84[] (924 stages)
    const monthVectors = trajectoryVectors.slice(0, 84);
    const monthStages: StageValue[] = [];
    for (let m = 0; m < 84; m++) {
      monthStages.push(...monthVectors[m]);
    }
    const monthEval = evaluateTrajectory(monthVectors);
    const monthRecord: C50WideRecord = {
      SNO: sno,
      stageValues: monthStages,
      primary_taxonomy: monthEval.primary_taxonomy,
      secondary_taxonomy: monthEval.secondary_taxonomy,
      pattern_label: monthEval.pattern_label,
      severity_label: monthEval.severity_label,
      severity_score: monthEval.severity_score,
      confidence_score: monthEval.confidence_score,
      confidence_level: monthEval.confidence_level,
      trend_label: monthEval.trend_label,
    };
    monthStream.write(formatWideRecordToCsvLine(monthRecord) + '\n');
  }

  // Close streams
  testStream.end();
  dayStream.end();
  weekStream.end();
  monthStream.end();

  return {
    basePatternCount: N,
    testRowCount: N,
    dayRowCount: N,
    weekRowCount: N,
    monthRowCount: N,
    corePatternLibrarySize: library.totalUnique,
    paths,
  };
}

