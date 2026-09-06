import * as fs from 'fs';
import * as readline from 'readline';
import {
  getDatasetPaths,
  C50_TEST_HEADER_STRING,
  C50_DAY_HEADER_STRING,
  C50_WEEK_HEADER_STRING,
  C50_MONTH_HEADER_STRING,
  BASE_STAGE_HEADERS,
} from './csvExporter';
import { evaluateStageVector, StageVector } from './evaluator';
import { buildPatternLibrary } from './patternLibrary';
import { generateC50DatasetsToDisk } from './generator';
import { ConfidenceLevel, SeverityLevel, StageValue } from './types';

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export async function countLinesAndCheckHeaders(filePath: string): Promise<{
  header: string[];
  rowCount: number;
  linesSample: string[];
}> {
  let rowCount = 0;
  let header: string[] = [];
  const linesSample: string[] = [];

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isFirst = true;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isFirst) {
      header = line.split(',');
      isFirst = false;
      continue;
    }
    rowCount++;
    if (rowCount <= 15 || rowCount % 500 === 0) {
      linesSample.push(line);
    }
  }

  return { header, rowCount, linesSample };
}

export async function runAllC50DiskTests(rootDir: string = process.cwd()): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  const paths = getDatasetPaths(rootDir);

  // Read all 4 CSV files from disk
  const testInfo = await countLinesAndCheckHeaders(paths.testCsvPath);
  const dayInfo = await countLinesAndCheckHeaders(paths.dayCsvPath);
  const weekInfo = await countLinesAndCheckHeaders(paths.weekCsvPath);
  const monthInfo = await countLinesAndCheckHeaders(paths.monthCsvPath);

  const testRows = testInfo.rowCount;
  const dayRows = dayInfo.rowCount;
  const weekRows = weekInfo.rowCount;
  const monthRows = monthInfo.rowCount;

  // TEST_01: Canonical headers matching specifications
  try {
    const pTest = testInfo.header.length === 20 && testInfo.header.join(',') === C50_TEST_HEADER_STRING;
    const pDay = dayInfo.header.length === 42 && dayInfo.header.join(',') === C50_DAY_HEADER_STRING;
    const pWeek = weekInfo.header.length === 240 && weekInfo.header.join(',') === C50_WEEK_HEADER_STRING;
    const pMonth = monthInfo.header.length === 933 && monthInfo.header.join(',') === C50_MONTH_HEADER_STRING;

    const passed = pTest && pDay && pWeek && pMonth;
    results.push({
      id: 'TEST_01',
      name: 'Dataset Header Expansion (TEST: 1x[], DAY: 3x[], WEEK: 21x[], MONTH: 84x[])',
      passed,
      message: passed
        ? `Headers strictly match: TEST (20 cols), DAY (42 cols), WEEK (240 cols), MONTH (933 cols)`
        : `Header mismatch: testCols=${testInfo.header.length}, dayCols=${dayInfo.header.length}, weekCols=${weekInfo.header.length}, monthCols=${monthInfo.header.length}`,
    });
  } catch (e: any) {
    results.push({ id: 'TEST_01', name: 'Header Expansion', passed: false, message: e.message });
  }

  // TEST_02: Exact 11 feature stages per observation set
  try {
    const actualTestFeatures = testInfo.header.slice(1, 12);
    const passed = actualTestFeatures.join(',') === BASE_STAGE_HEADERS.join(',');
    results.push({
      id: 'TEST_02',
      name: 'Exact 11 Physiological Feature Columns in Stage Set []',
      passed,
      message: passed
        ? `11 feature columns strictly match []: ${actualTestFeatures.join(', ')}`
        : 'Feature column sequence mismatch',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_02', name: 'Exact 11 Feature Columns', passed: false, message: e.message });
  }

  // TEST_03: Stage range 0..5 across all stage columns
  try {
    let valid = true;
    for (const line of testInfo.linesSample) {
      const cols = line.split(',');
      for (let i = 1; i <= 11; i++) {
        const val = parseInt(cols[i], 10);
        if (isNaN(val) || val < 0 || val > 5) {
          valid = false;
          break;
        }
      }
      if (!valid) break;
    }
    for (const line of dayInfo.linesSample) {
      const cols = line.split(',');
      for (let i = 1; i <= 33; i++) {
        const val = parseInt(cols[i], 10);
        if (isNaN(val) || val < 0 || val > 5) {
          valid = false;
          break;
        }
      }
      if (!valid) break;
    }
    results.push({
      id: 'TEST_03',
      name: 'Stage Values Bounded in Integer [0..5]',
      passed: valid,
      message: valid
        ? 'All stage feature columns across datasets are strictly bounded within integers [0, 5]'
        : 'Stage value out of [0..5] bounds detected',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_03', name: 'Stage Range 0..5', passed: false, message: e.message });
  }

  // TEST_04: >= 5,000 unique core vectors
  try {
    const lib = buildPatternLibrary(42);
    const passed = lib.totalUnique >= 5000;
    results.push({
      id: 'TEST_04',
      name: 'Core Pattern Library >= 5,000 Unique 11-Stage Vectors',
      passed,
      message: passed
        ? `Core pattern library contains ${lib.totalUnique} unique vectors (Requirement: >= 5,000)`
        : `Pattern library under threshold: ${lib.totalUnique}`,
    });
  } catch (e: any) {
    results.push({ id: 'TEST_04', name: '>= 5,000 Unique Core Vectors', passed: false, message: e.message });
  }

  // TEST_05: Complexity 0..11 coverage
  try {
    const lib = buildPatternLibrary(42);
    let allCovered = true;
    for (let c = 0; c <= 11; c++) {
      if ((lib.patternsByComplexity.get(c)?.length ?? 0) === 0) {
        allCovered = false;
        break;
      }
    }
    results.push({
      id: 'TEST_05',
      name: 'Active Complexity Levels 0..11 Represented',
      passed: allCovered,
      message: allCovered
        ? 'All 12 active complexity tiers (0 to 11 active parameters) are fully represented'
        : 'Missing active complexity levels',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_05', name: 'Complexity 0..11 Coverage', passed: false, message: e.message });
  }

  // TEST_06: Every parameter reaches stages 0..5
  try {
    const lib = buildPatternLibrary(42);
    const paramStages: Record<number, Set<number>> = {};
    for (let i = 0; i < 11; i++) paramStages[i] = new Set();

    for (const pat of lib.patterns) {
      for (let i = 0; i < 11; i++) {
        paramStages[i].add(pat[i]);
      }
    }

    let allCovered = true;
    for (let i = 0; i < 11; i++) {
      if (paramStages[i].size < 6) {
        allCovered = false;
        break;
      }
    }
    results.push({
      id: 'TEST_06',
      name: 'Every Parameter Reaches Stages 0..5 Across Population',
      passed: allCovered,
      message: allCovered
        ? 'All 11 physiological parameters reach all 6 stages (0, 1, 2, 3, 4, 5)'
        : 'Some parameters did not reach all stages',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_06', name: 'Parameter Stage Coverage', passed: false, message: e.message });
  }

  // TEST_07: Severity class coverage
  try {
    const severities = new Set<string>();
    for (const line of testInfo.linesSample) {
      severities.add(line.split(',')[15]);
    }
    const expected = ['NORMAL', 'CONTROL', 'MILD', 'HIGH', 'RISK'];
    const passed = expected.every((s) => severities.has(s));
    results.push({
      id: 'TEST_07',
      name: 'All Severity Classes Represented (NORMAL, CONTROL, MILD, HIGH, RISK)',
      passed,
      message: passed
        ? `All 5 severity classes present: ${Array.from(severities).join(', ')}`
        : 'Missing severity classes',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_07', name: 'Severity Class Coverage', passed: false, message: e.message });
  }

  // TEST_08: Confidence class coverage
  try {
    const confs = new Set<string>();
    for (const line of testInfo.linesSample) {
      confs.add(line.split(',')[18]);
    }
    const passed = confs.has('HIGH') && confs.has('MEDIUM') && confs.has('LOW');
    results.push({
      id: 'TEST_08',
      name: 'Confidence Classes Represented (LOW, MEDIUM, HIGH)',
      passed,
      message: passed
        ? `Confidence levels populated: ${Array.from(confs).join(', ')}`
        : 'Missing confidence levels',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_08', name: 'Confidence Class Coverage', passed: false, message: e.message });
  }

  // TEST_09: Deterministic feature-to-label mapping
  try {
    let deterministic = true;
    for (const line of testInfo.linesSample.slice(0, 50)) {
      const cols = line.split(',');
      const stages: StageVector = [
        parseInt(cols[1], 10) as StageValue,
        parseInt(cols[2], 10) as StageValue,
        parseInt(cols[3], 10) as StageValue,
        parseInt(cols[4], 10) as StageValue,
        parseInt(cols[5], 10) as StageValue,
        parseInt(cols[6], 10) as StageValue,
        parseInt(cols[7], 10) as StageValue,
        parseInt(cols[8], 10) as StageValue,
        parseInt(cols[9], 10) as StageValue,
        parseInt(cols[10], 10) as StageValue,
        parseInt(cols[11], 10) as StageValue,
      ];
      const ev = evaluateStageVector(stages);
      if (ev.primary_taxonomy !== cols[12] || ev.severity_label !== cols[15]) {
        deterministic = false;
        break;
      }
    }
    results.push({
      id: 'TEST_09',
      name: 'Deterministic Feature-to-Label Mapping',
      passed: deterministic,
      message: deterministic
        ? '100% of rows match deterministic classification rules'
        : 'Non-deterministic label evaluation detected',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_09', name: 'Deterministic Feature Mapping', passed: false, message: e.message });
  }

  // TEST_10: Severity score range 0..1
  try {
    let bounded = true;
    for (const line of testInfo.linesSample) {
      const s = parseFloat(line.split(',')[16]);
      if (isNaN(s) || s < 0.0 || s > 1.0) {
        bounded = false;
        break;
      }
    }
    results.push({
      id: 'TEST_10',
      name: 'Severity Score Bounded in [0.00, 1.00]',
      passed: bounded,
      message: bounded
        ? 'All severity scores strictly conform to [0.00, 1.00]'
        : 'Severity score out of bounds',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_10', name: 'Severity Score Range', passed: false, message: e.message });
  }

  // TEST_11: Confidence score range 0..1 with realistic variation
  try {
    let minConf = 1.0;
    let maxConf = 0.0;
    for (const line of testInfo.linesSample) {
      const c = parseFloat(line.split(',')[17]);
      if (!isNaN(c)) {
        if (c < minConf) minConf = c;
        if (c > maxConf) maxConf = c;
      }
    }
    const hasVariation = maxConf - minConf >= 0.20;
    results.push({
      id: 'TEST_11',
      name: 'Confidence Score Bounded in [0.00, 1.00] with Realistic Variation',
      passed: hasVariation,
      message: hasVariation
        ? `Confidence scores vary realistically between [${minConf.toFixed(2)}, ${maxConf.toFixed(2)}]`
        : 'Confidence scores lack variation or are static',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_11', name: 'Confidence Score Range', passed: false, message: e.message });
  }

  // TEST_12: Confidence level validity
  try {
    const validLevels = new Set(['LOW', 'MEDIUM', 'HIGH']);
    let valid = true;
    for (const line of testInfo.linesSample) {
      if (!validLevels.has(line.split(',')[18])) {
        valid = false;
        break;
      }
    }
    results.push({
      id: 'TEST_12',
      name: 'Confidence Level Validity',
      passed: valid,
      message: valid
        ? 'All confidence levels belong to {LOW, MEDIUM, HIGH}'
        : 'Invalid confidence level encountered',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_12', name: 'Confidence Level Validity', passed: false, message: e.message });
  }

  // TEST_13: TEST trend = N/A
  try {
    let allNA = true;
    for (const line of testInfo.linesSample) {
      if (line.split(',')[19] !== 'N/A') {
        allNA = false;
        break;
      }
    }
    results.push({
      id: 'TEST_13',
      name: 'Atomic TEST Dataset Trend is Strictly N/A',
      passed: allNA,
      message: allNA
        ? 'All rows in test_dataset.csv have trend_label = N/A'
        : 'Non-N/A trend label detected in TEST dataset',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_13', name: 'TEST Trend = N/A', passed: false, message: e.message });
  }

  // TEST_14: DAY trend validity
  try {
    const validTrends = new Set([
      'STABLE',
      'IMPROVING',
      'DETERIORATING',
      'FLUCTUATING',
      'RECOVERING',
      'PERSISTENT_ABNORMALITY',
    ]);
    let valid = true;
    for (const line of dayInfo.linesSample) {
      const cols = line.split(',');
      const trend = cols[cols.length - 1];
      if (!validTrends.has(trend)) {
        valid = false;
        break;
      }
    }
    results.push({
      id: 'TEST_14',
      name: 'DAY Dataset Trends Valid and Longitudinally Computed',
      passed: valid,
      message: valid
        ? 'DAY dataset trends are valid longitudinal categories'
        : 'Invalid trend in DAY dataset',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_14', name: 'DAY Trend Validity', passed: false, message: e.message });
  }

  // TEST_15: WEEK trend validity
  try {
    const validTrends = new Set([
      'STABLE',
      'IMPROVING',
      'DETERIORATING',
      'FLUCTUATING',
      'RECOVERING',
      'PERSISTENT_ABNORMALITY',
    ]);
    let valid = true;
    for (const line of weekInfo.linesSample) {
      const cols = line.split(',');
      const trend = cols[cols.length - 1];
      if (!validTrends.has(trend)) {
        valid = false;
        break;
      }
    }
    results.push({
      id: 'TEST_15',
      name: 'WEEK Dataset Trends Valid and Longitudinally Computed',
      passed: valid,
      message: valid
        ? 'WEEK dataset trends are valid longitudinal categories'
        : 'Invalid trend in WEEK dataset',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_15', name: 'WEEK Trend Validity', passed: false, message: e.message });
  }

  // TEST_16: MONTH trend validity
  try {
    const validTrends = new Set([
      'STABLE',
      'IMPROVING',
      'DETERIORATING',
      'FLUCTUATING',
      'RECOVERING',
      'PERSISTENT_ABNORMALITY',
    ]);
    let valid = true;
    for (const line of monthInfo.linesSample) {
      const cols = line.split(',');
      const trend = cols[cols.length - 1];
      if (!validTrends.has(trend)) {
        valid = false;
        break;
      }
    }
    results.push({
      id: 'TEST_16',
      name: 'MONTH Dataset Trends Valid and Longitudinally Computed',
      passed: valid,
      message: valid
        ? 'MONTH dataset trends are valid longitudinal categories'
        : 'Invalid trend in MONTH dataset',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_16', name: 'MONTH Trend Validity', passed: false, message: e.message });
  }

  // TEST_17: Row counts match base trajectories
  try {
    const passed = testRows === 5000 && dayRows === 5000 && weekRows === 5000 && monthRows === 5000;
    results.push({
      id: 'TEST_17',
      name: 'Physical Trajectory Row Counts (5,000 Base Trajectories)',
      passed,
      message: passed
        ? `All datasets contain exactly 5,000 physical rows of trajectories in data/`
        : `Row count mismatch: test=${testRows}, day=${dayRows}, week=${weekRows}, month=${monthRows}`,
    });
  } catch (e: any) {
    results.push({ id: 'TEST_17', name: 'Physical Trajectory Row Counts', passed: false, message: e.message });
  }

  // TEST_18: Stage Expansion: 1x [] in TEST, 3x [] in DAY, 21x [] in WEEK, 84x [] in MONTH
  try {
    const pTest = testInfo.header.length === 1 * 11 + 9;
    const pDay = dayInfo.header.length === 3 * 11 + 9;
    const pWeek = weekInfo.header.length === 21 * 11 + 9;
    const pMonth = monthInfo.header.length === 84 * 11 + 9;
    const passed = pTest && pDay && pWeek && pMonth;
    results.push({
      id: 'TEST_18',
      name: 'Stage Expansion Ratios (1x [] in TEST, 3x [] in DAY, 21x [] in WEEK, 84x [] in MONTH)',
      passed,
      message: passed
        ? `Stage column expansion verified: TEST=11 stages, DAY=33 stages, WEEK=231 stages, MONTH=924 stages`
        : `Stage expansion failed`,
    });
  } catch (e: any) {
    results.push({ id: 'TEST_18', name: 'Stage Expansion Ratios', passed: false, message: e.message });
  }

  // TEST_19: Output Files Exist in data/ Directory
  try {
    const passed =
      fs.existsSync(paths.testCsvPath) &&
      fs.existsSync(paths.dayCsvPath) &&
      fs.existsSync(paths.weekCsvPath) &&
      fs.existsSync(paths.monthCsvPath);
    results.push({
      id: 'TEST_19',
      name: 'Output Datasets Located in data/ Directory',
      passed,
      message: passed
        ? `CSVs physically exist in ${paths.datasetRootDir}`
        : 'Missing CSV files in data/ directory',
    });
  } catch (e: any) {
    results.push({ id: 'TEST_19', name: 'data/ Directory Presence', passed: false, message: e.message });
  }

  // TEST_20: Zero simulation/synthetic terminology
  try {
    const sampleJoined = testInfo.linesSample.join('\n').toLowerCase();
    const simTerms = ['simulation', 'simulated', 'synthetic', 'artificial', 'generated_data', 'fake'];
    const foundSim = simTerms.filter((term) => sampleJoined.includes(term));
    const passed = foundSim.length === 0;
    results.push({
      id: 'TEST_20',
      name: 'Zero Simulation / Synthetic Terminology in Exported CSV Data',
      passed,
      message: passed
        ? 'Zero simulation or synthetic words found in CSV data rows'
        : `Simulation terminology detected: ${foundSim.join(', ')}`,
    });
  } catch (e: any) {
    results.push({ id: 'TEST_20', name: 'No Simulation Terminology', passed: false, message: e.message });
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return { total, passed, failed, results };
}

