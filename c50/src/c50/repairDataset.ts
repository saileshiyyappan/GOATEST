import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { evaluateStageVector, evaluateTrajectory, StageVector } from './evaluator';
import { StageValue } from './types';
import {
  C50_TEST_HEADER_STRING,
  C50_DAY_HEADER_STRING,
  C50_WEEK_HEADER_STRING,
  C50_MONTH_HEADER_STRING,
  escapeCsvField,
} from './csvExporter';

interface RepairVerificationReport {
  dataset: string;
  depth: number;
  totalRows: number;
  stageHashPre: string;
  stageHashPost: string;
  isStageIdentical: boolean;
}

async function repairCsvFile(
  filePath: string,
  depth: number,
  headerString: string
): Promise<RepairVerificationReport> {
  const fullPath = path.resolve(filePath);
  
  // 1. Read entire CSV and extract existing stages and baseline hash
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  const lines = fileContent.split('\n').filter((l) => l.trim().length > 0);
  
  const stageColCount = depth * 11;
  const preStageLines: string[] = [];
  const parsedRows: { sno: number; stages: StageValue[]; stageStr: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const sno = parseInt(cols[0], 10);
    const rawStages = cols.slice(1, 1 + stageColCount);
    const stageStr = rawStages.join(',');
    preStageLines.push(stageStr);
    
    const stages = rawStages.map((s) => parseInt(s, 10) as StageValue);
    parsedRows.push({ sno, stages, stageStr });
  }

  const stageHashPre = crypto.createHash('sha256').update(preStageLines.join('\n')).digest('hex');

  // 2. Perform Longitudinal Repair on Labels
  const newLines: string[] = [headerString];
  const postStageLines: string[] = [];

  for (const row of parsedRows) {
    // Partition stage values into N StageVectors of length 11
    const vectors: StageVector[] = [];
    for (let d = 0; d < depth; d++) {
      const v = row.stages.slice(d * 11, (d + 1) * 11) as StageVector;
      vectors.push(v);
    }

    const evalResult = evaluateTrajectory(vectors);

    // Build repaired line
    const repairedCols = [
      row.sno,
      ...row.stages,
      evalResult.primary_taxonomy,
      escapeCsvField(evalResult.secondary_taxonomy),
      escapeCsvField(evalResult.pattern_label),
      evalResult.severity_label,
      evalResult.severity_score,
      evalResult.confidence_score,
      evalResult.confidence_level,
      depth === 1 ? 'N/A' : evalResult.trend_label,
    ];

    newLines.push(repairedCols.join(','));
    postStageLines.push(row.stages.join(','));
  }

  // 3. Write back repaired dataset
  fs.writeFileSync(fullPath, newLines.join('\n') + '\n', 'utf-8');

  // 4. Verify post-repair stage hash
  const stageHashPost = crypto.createHash('sha256').update(postStageLines.join('\n')).digest('hex');
  const isStageIdentical = stageHashPre === stageHashPost;

  if (!isStageIdentical) {
    throw new Error(`CRITICAL INTEGRITY FAILURE in ${filePath}: Stage values mutated!`);
  }

  return {
    dataset: filePath,
    depth,
    totalRows: parsedRows.length,
    stageHashPre,
    stageHashPost,
    isStageIdentical,
  };
}

export async function runFullRepair() {
  console.log('--- STARTING C50 V1 CLINICAL LABEL REPAIR ---');
  
  const testReport = await repairCsvFile('data/test_dataset.csv', 1, C50_TEST_HEADER_STRING);
  console.log('TEST REPAIRED:', testReport);

  const dayReport = await repairCsvFile('data/day_dataset.csv', 3, C50_DAY_HEADER_STRING);
  console.log('DAY REPAIRED:', dayReport);

  const weekReport = await repairCsvFile('data/week_dataset.csv', 21, C50_WEEK_HEADER_STRING);
  console.log('WEEK REPAIRED:', weekReport);

  const monthReport = await repairCsvFile('data/month_dataset.csv', 84, C50_MONTH_HEADER_STRING);
  console.log('MONTH REPAIRED:', monthReport);

  console.log('--- REPAIR COMPLETED WITH 100% STAGE INTEGRITY PRESERVED ---');
}

runFullRepair();
