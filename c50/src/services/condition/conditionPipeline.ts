import testDatasetCsv from '../../../data/test_dataset.csv?raw';
import { CANONICAL_11_PARAMETERS } from '../../engine/canonicalParameters';
import { evaluateStageVector, type StageVector } from '../../c50/evaluator';
import { buildConditionReportDocument } from './reportGenerator';
import type { ConditionMatchStatus, ConditionReportDocument, ConditionResult, MatchedDatasetRecord } from './conditionTypes';

export interface ConditionPipelineOutput {
  result: ConditionResult;
  report: ConditionReportDocument;
  matchedTestRow: Record<string, any>;
}

function parseTestDataset(): Record<string, any>[] {
  const lines = testDatasetCsv.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function asStageVector(row: Record<string, any>): StageVector {
  const names = ['HR_stage', 'SpO2_stage', 'PPI_stage', 'RMSSD_stage', 'SDNN_stage', 'RespiratoryRate_stage', 'ActivityIntensity_stage', 'AmbientTemperature_stage', 'RelativeHumidity_stage', 'AtmosphericPressure_stage', 'Altitude_stage'];
  return names.map((name) => {
    const value = Number(row[name]);
    if (!Number.isInteger(value) || value < 0 || value > 5) throw new Error('CM_PACKET_INVALID: TEST pattern contains an invalid stage');
    return value;
  }) as StageVector;
}

function matchTestPattern(
  dataset: Record<string, any>[],
  pattern: StageVector
): { row: Record<string, any>; matchType: ConditionMatchStatus; distance: number } {
  let bestRow: Record<string, any> | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const row of dataset) {
    const candidate = asStageVector(row);
    let sumSquared = 0;
    for (let index = 0; index < pattern.length; index += 1) {
      const delta = candidate[index] - pattern[index];
      sumSquared += delta * delta;
    }

    if (sumSquared === 0) {
      return { row, matchType: 'EXACT', distance: 0 };
    }

    const distance = Math.sqrt(sumSquared);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRow = row;
    }
  }

  if (!bestRow) {
    throw new Error('NO_ACCEPTABLE_MATCH: TEST dataset contains no candidate reference pattern');
  }

  if (bestDistance > 5) {
    throw new Error(`NO_ACCEPTABLE_MATCH: nearest TEST reference distance=${bestDistance.toFixed(3)}`);
  }

  const inputEvaluation = evaluateStageVector(pattern);
  const rowEvaluation = evaluateStageVector(asStageVector(bestRow));
  const isEquivalent =
    inputEvaluation.primary_taxonomy === rowEvaluation.primary_taxonomy &&
    Math.abs(Number(inputEvaluation.severity_score) - Number(rowEvaluation.severity_score)) <= 0.05;

  return {
    row: bestRow,
    matchType: isEquivalent ? 'EQUIVALENT' : 'APPROXIMATE',
    distance: Number(bestDistance.toFixed(3)),
  };
}

export async function runConditionPipeline(cmPacket: any): Promise<ConditionPipelineOutput> {
  if (!cmPacket || cmPacket.packetType !== 'CM_PACKET' || cmPacket.status !== 'COMPUTED' || cmPacket.validParameterCount !== 11 || !Array.isArray(cmPacket.parameters) || cmPacket.parameters.length !== 11 || cmPacket.missingParameters?.length !== 0 || cmPacket.missingShbParameters?.length !== 0 || cmPacket.missingPhbParameters?.length !== 0) {
    throw new Error('CM_PACKET_INVALID: complete COMPUTED 11-parameter packet required');
  }
  const pattern = cmPacket.parameters.map((parameter: any, index: number) => {
    const value = parameter?.compareStage;
    if (!Number.isInteger(value) || value < 0 || value > 5) throw new Error(`PATTERN_GENERATION_FAILED: invalid compareStage at ${CANONICAL_11_PARAMETERS[index].id}`);
    return value;
  }) as StageVector;
  console.info('[C50 DIRECT PIPELINE]', { source: 'compareStage', pattern, order: CANONICAL_11_PARAMETERS.map((parameter) => parameter.id) });

  const dataset = parseTestDataset();
  const matched = matchTestPattern(dataset, pattern);
  const matchedTestRow = matched.row;
  const matchedVector = asStageVector(matchedTestRow);
  const computed = evaluateStageVector(matchedVector);
  const matchedRecord: MatchedDatasetRecord = {
    sno: String(matchedTestRow.SNO), matchedVector, distance: matched.distance, matchType: matched.matchType,
    primary_taxonomy: matchedTestRow.primary_taxonomy, secondary_taxonomy: matchedTestRow.secondary_taxonomy,
    pattern_label: matchedTestRow.pattern_label, severity_label: matchedTestRow.severity_label as any,
    severity_score: matchedTestRow.severity_score, confidence_score: matchedTestRow.confidence_score,
    confidence_level: matchedTestRow.confidence_level as any, trend_label: matchedTestRow.trend_label as any,
    isLabelInconsistent:
      matchedTestRow.primary_taxonomy !== computed.primary_taxonomy ||
      matchedTestRow.severity_label !== computed.severity_label ||
      matchedTestRow.pattern_label !== computed.pattern_label,
  };
  const result: ConditionResult = {
    uid: cmPacket.uid, sessionId: cmPacket.sessionId, target: cmPacket.target, inputVector: pattern,
    matchedRecord, matchStatus: matched.matchType, distanceScore: matched.distance, temporalLevel: 'TEST', temporalObservationsCount: 1,
    primary_taxonomy: matchedRecord.primary_taxonomy, secondary_taxonomy: matchedRecord.secondary_taxonomy,
    pattern_label: matchedRecord.pattern_label, severity_label: matchedRecord.severity_label,
    severity_score: matchedRecord.severity_score, confidence_score: matchedRecord.confidence_score,
    confidence_level: matchedRecord.confidence_level, trend_label: matchedRecord.trend_label,
    labelVerificationStatus: matchedRecord.isLabelInconsistent ? 'INCONSISTENT_FLAGGED' : 'VERIFIED_CONSISTENT', reportId: `rep_test_${cmPacket.sessionId}`,
    timestamp: new Date(typeof cmPacket.timestamp === 'number' ? cmPacket.timestamp : cmPacket.timestamp).toISOString(),
    matchedTestRow, sourceCmPacket: cmPacket,
  };
  const report = buildConditionReportDocument(result, cmPacket.uid, cmPacket.parameters.map((parameter: any, index: number) => ({ parameterId: CANONICAL_11_PARAMETERS[index].id, shbValue: parameter.shbValue, phbBaseline: parameter.phbBaseline })));
  report.sessionId = cmPacket.sessionId; report.target = cmPacket.target; report.matchedTestRow = matchedTestRow; report.sourceCmPacket = cmPacket;
  return { result, report, matchedTestRow };
}
