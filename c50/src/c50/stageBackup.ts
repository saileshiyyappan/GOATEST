import * as fs from 'fs';
import * as crypto from 'crypto';
import * as readline from 'readline';

export interface StageBackup {
  dataset: string;
  rowCount: number;
  stageColCount: number;
  stageHashes: string[]; // SHA256 per row of stage values
  completeStageHash: string;
}

export async function backupAndHashStages(filePath: string, depth: number): Promise<StageBackup> {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  let rowCount = 0;
  const stageColCount = depth * 11;
  const stageHashes: string[] = [];
  const fullStageData: string[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      isHeader = false;
      continue;
    }
    rowCount++;
    const cols = line.split(',');
    const stages = cols.slice(1, 1 + stageColCount);
    const stageStr = stages.join(',');
    fullStageData.push(stageStr);
    const rowHash = crypto.createHash('sha256').update(stageStr).digest('hex');
    stageHashes.push(rowHash);
  }

  const completeStageHash = crypto.createHash('sha256').update(fullStageData.join('\n')).digest('hex');

  return {
    dataset: filePath,
    rowCount,
    stageColCount,
    stageHashes,
    completeStageHash
  };
}

async function runBackup() {
  const test = await backupAndHashStages('data/test_dataset.csv', 1);
  const day = await backupAndHashStages('data/day_dataset.csv', 3);
  const week = await backupAndHashStages('data/week_dataset.csv', 21);
  const month = await backupAndHashStages('data/month_dataset.csv', 84);

  console.log('Stage Data Hashes (Pre-Repair):');
  console.log('TEST:', test.rowCount, 'rows,', test.stageColCount, 'stage cols, Hash:', test.completeStageHash);
  console.log('DAY:', day.rowCount, 'rows,', day.stageColCount, 'stage cols, Hash:', day.completeStageHash);
  console.log('WEEK:', week.rowCount, 'rows,', week.stageColCount, 'stage cols, Hash:', week.completeStageHash);
  console.log('MONTH:', month.rowCount, 'rows,', month.stageColCount, 'stage cols, Hash:', month.completeStageHash);
}

runBackup();
