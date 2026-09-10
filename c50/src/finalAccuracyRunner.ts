import { StageVector } from './c50/evaluator';
import { ConditionEngine } from './services/condition/conditionEngine';

const engine = new ConditionEngine(process.cwd());

const realCase1: StageVector = [3, 0, 3, 3, 3, 2, 3, 5, 3, 2, 2];
const realCase2: StageVector = [2, 0, 2, 1, 2, 1, 3, 5, 1, 2, 2];
const controls: Record<string, StageVector> = {
  NORMAL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  MILD: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  CONTEXT_ONLY: [0, 0, 0, 0, 0, 0, 3, 5, 4, 2, 2],
  HR_PPI: [3, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  HR_PPI_HRV: [3, 0, 3, 3, 3, 0, 0, 0, 0, 0, 0],
  NO_MATCH: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
};

async function evaluate(name: string, vector: StageVector): Promise<void> {
  const result = await engine.processCondition({ stageVector: vector }, { temporalLevel: 'TEST', uid: `final-${name.toLowerCase()}` });
  const match = result.result ?? result;
  const report = result.report ?? result;
  console.log(JSON.stringify({
    name,
    inputVector: vector,
    matchStatus: match.matchStatus,
    reference: match.matchedRecord?.sno ?? 'NONE',
    distance: match.distanceScore,
    taxonomy: match.primary_taxonomy ?? 'NONE',
    severity: match.severity_label ?? 'NONE',
    confidence: match.confidence_score ?? '0',
    pattern: match.pattern_label ?? 'NONE',
    conditionStatus: report.status,
  }));
}

async function main(): Promise<void> {
  console.log(JSON.stringify({ datasetRows: (await engine.loadTestDataset()).length }));
  await evaluate('REAL_CASE_1', realCase1);
  await evaluate('REAL_CASE_2', realCase2);
  for (const [name, vector] of Object.entries(controls)) await evaluate(name, vector);

  const day = await engine.processDayAssessment({
    uid: 'final-day',
    testVectors: [
      controls.NORMAL,
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    ],
    isFixture: true,
  });
  console.log(JSON.stringify({
    name: 'DAY',
    testVectors: [
      controls.NORMAL,
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    ],
    success: day.success,
    temporalLevel: day.temporalLevel,
    inputStagesLength: day.inputStages?.length,
    status: day.status,
    matchStatus: day.matchStatus,
    reference: day.referenceDatasetSno,
    taxonomy: day.classification,
    severity: day.severity,
    confidence: day.confidenceScore,
    trend: day.trend,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
