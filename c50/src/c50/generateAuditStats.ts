import * as fs from 'fs';
import * as readline from 'readline';

interface DatasetStats {
  name: string;
  totalRows: number;
  colCount: number;
  stageColCount: number;
  labelColCount: number;
  taxonomies: Record<string, number>;
  severities: Record<string, number>;
  confidences: Record<string, number>;
  trends: Record<string, number>;
  meanSeverity: number;
  minSeverity: number;
  maxSeverity: number;
  meanConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  sampleRows: any[];
}

async function analyzeDataset(filePath: string, depth: number): Promise<DatasetStats> {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  let totalRows = 0;
  let colCount = 0;
  const stageColCount = depth * 11;
  const taxonomies: Record<string, number> = {};
  const severities: Record<string, number> = {};
  const confidences: Record<string, number> = {};
  const trends: Record<string, number> = {};
  
  let sumSev = 0;
  let minSev = 1.0;
  let maxSev = 0.0;
  let sumConf = 0;
  let minConf = 1.0;
  let maxConf = 0.0;
  const sampleRows: any[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      const headers = line.split(',');
      colCount = headers.length;
      isHeader = false;
      continue;
    }
    totalRows++;
    const cols = line.split(',');
    // Label indices are from cols.length - 8 to cols.length - 1
    const primary_tax = cols[cols.length - 8];
    const secondary_tax = cols[cols.length - 7];
    const pattern_label = cols[cols.length - 6];
    const severity_label = cols[cols.length - 5];
    const severity_score = parseFloat(cols[cols.length - 4]);
    const confidence_score = parseFloat(cols[cols.length - 3]);
    const confidence_level = cols[cols.length - 2];
    const trend_label = cols[cols.length - 1];

    taxonomies[primary_tax] = (taxonomies[primary_tax] || 0) + 1;
    severities[severity_label] = (severities[severity_label] || 0) + 1;
    confidences[confidence_level] = (confidences[confidence_level] || 0) + 1;
    trends[trend_label] = (trends[trend_label] || 0) + 1;

    sumSev += severity_score;
    if (severity_score < minSev) minSev = severity_score;
    if (severity_score > maxSev) maxSev = severity_score;

    sumConf += confidence_score;
    if (confidence_score < minConf) minConf = confidence_score;
    if (confidence_score > maxConf) maxConf = confidence_score;

    if (totalRows <= 5 || totalRows === 100 || totalRows === 500 || totalRows === 1000 || totalRows === 5000) {
      sampleRows.push({
        sno: cols[0],
        primary_tax,
        secondary_tax,
        pattern_label,
        severity_label,
        severity_score,
        confidence_score,
        confidence_level,
        trend_label,
      });
    }
  }

  return {
    name: filePath,
    totalRows,
    colCount,
    stageColCount,
    labelColCount: 8,
    taxonomies,
    severities,
    confidences,
    trends,
    meanSeverity: sumSev / totalRows,
    minSeverity: minSev,
    maxSeverity: maxSev,
    meanConfidence: sumConf / totalRows,
    minConfidence: minConf,
    maxConfidence: maxConf,
    sampleRows,
  };
}

async function runAudit() {
  const testStats = await analyzeDataset('data/test_dataset.csv', 1);
  const dayStats = await analyzeDataset('data/day_dataset.csv', 3);
  const weekStats = await analyzeDataset('data/week_dataset.csv', 21);
  const monthStats = await analyzeDataset('data/month_dataset.csv', 84);

  console.log(JSON.stringify({ testStats, dayStats, weekStats, monthStats }, null, 2));
}

runAudit();
