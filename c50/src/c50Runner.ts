import * as fs from 'fs';
import * as path from 'path';
import { generateC50DatasetsToDisk, DEFAULT_OPTIONS } from './c50/generator';
import { getDatasetPaths } from './c50/csvExporter';
import { computeCsvFileStatistics } from './c50/distributionReporter';
import { runAllC50DiskTests } from './c50/automatedTests';

export async function runC50Pipeline() {
  console.log('===============================================================');
  console.log('C50 V1 FINAL ML DATASET GENERATION & DISK VALIDATION REBUILD');
  console.log('===============================================================');

  const rootDir = process.cwd();
  console.log(`\n[STEP 1] Generating and Streaming Clean CSVs to disk in data/...`);
  const summary = generateC50DatasetsToDisk({
    seed: DEFAULT_OPTIONS.seed,
    basePatternCount: DEFAULT_OPTIONS.basePatternCount,
    rootDir,
  });

  console.log(`\n[SUCCESS] Generated 4 Clean Physical CSV Datasets in 'data/':`);
  console.log(`- Core Pattern Library: ${summary.corePatternLibrarySize} unique 11-stage vectors`);
  console.log(`- Base Pattern Trajectories: N = ${summary.basePatternCount}`);
  console.log(`- TEST CSV:  ${summary.testRowCount} rows, 20 columns (1x [] stage features: data/test_dataset.csv)`);
  console.log(`- DAY CSV:   ${summary.dayRowCount} rows, 42 columns (3x [] stage features: data/day_dataset.csv)`);
  console.log(`- WEEK CSV:  ${summary.weekRowCount} rows, 240 columns (21x [] stage features: data/week_dataset.csv)`);
  console.log(`- MONTH CSV: ${summary.monthRowCount} rows, 933 columns (84x [] stage features: data/month_dataset.csv)`);

  console.log('\n--- [STEP 2] EXECUTING DISK-BASED AUTOMATED VALIDATION TESTS ---');
  const testSuiteResults = await runAllC50DiskTests(rootDir);
  testSuiteResults.results.forEach((t) => {
    console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.id}: ${t.name} -> ${t.message}`);
  });
  console.log(
    `\nAutomated Test Suite Summary: ${testSuiteResults.passed}/${testSuiteResults.total} PASSED (${testSuiteResults.failed} failed)`
  );

  console.log('\n--- [STEP 3] INDEPENDENT DISK CSV STATISTICAL RECALCULATION ---');
  const paths = getDatasetPaths(rootDir);
  const testStats = await computeCsvFileStatistics(paths.testCsvPath, 1);
  const dayStats = await computeCsvFileStatistics(paths.dayCsvPath, 3);
  const weekStats = await computeCsvFileStatistics(paths.weekCsvPath, 21);
  const monthStats = await computeCsvFileStatistics(paths.monthCsvPath, 84);

  console.log(`\nTEST Stats (Depth=1, 1x[]): Rows=${testStats.totalRows}, Unique Base=${testStats.uniquePatterns}`);
  console.log(`DAY Stats  (Depth=3, 3x[]): Rows=${dayStats.totalRows}, Unique Base=${dayStats.uniquePatterns}`);
  console.log(`WEEK Stats (Depth=21, 21x[]): Rows=${weekStats.totalRows}, Unique Base=${weekStats.uniquePatterns}`);
  console.log(`MONTH Stats (Depth=84, 84x[]): Rows=${monthStats.totalRows}, Unique Base=${monthStats.uniquePatterns}`);

  return {
    summary,
    testSuiteResults,
    testStats,
    dayStats,
    weekStats,
    monthStats,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runC50Pipeline()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Pipeline Error:', err);
      process.exit(1);
    });
}

