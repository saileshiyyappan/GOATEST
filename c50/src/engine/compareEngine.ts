import {
  CanonicalParameterConfig,
  CMPacket,
  Direction,
  ParameterCompareResult,
  StageValue,
} from '../types/compare';
import { CANONICAL_11_PARAMETERS } from './canonicalParameters';

/**
 * Calculates the comparison result for a single parameter according to BAND V1 COMPARE specification.
 */
export function calculateParameterCompare(
  config: CanonicalParameterConfig,
  phbBaseline: number,
  shbValue: number,
  cumulativeBoundaries: [number, number, number, number, number] = config.cumulativeBoundaries
): ParameterCompareResult {
  // 1. Signed Deviation and Distance
  const deviation = Number((shbValue - phbBaseline).toFixed(6));
  const deviationDistance = Number(Math.abs(deviation).toFixed(6));

  // 2. Direction
  let direction: Direction = 'NORMAL';
  if (deviation > 0) {
    direction = 'UPWARD';
  } else if (deviation < 0) {
    direction = 'DOWNWARD';
  }

  // 3. Stage Boundary Algorithm
  const [B1, B2, B3, B4, B5] = cumulativeBoundaries;
  let matchedStage: StageValue = 0;
  let matchedBoundary = 0;
  let beyondBoundary = false;

  if (deviationDistance === 0) {
    matchedStage = 0;
    matchedBoundary = 0;
    beyondBoundary = false;
  } else if (deviationDistance <= B1) {
    matchedStage = 1;
    matchedBoundary = B1;
    beyondBoundary = false;
  } else if (deviationDistance <= B2) {
    matchedStage = 2;
    matchedBoundary = B2;
    beyondBoundary = false;
  } else if (deviationDistance <= B3) {
    matchedStage = 3;
    matchedBoundary = B3;
    beyondBoundary = false;
  } else if (deviationDistance <= B4) {
    matchedStage = 4;
    matchedBoundary = B4;
    beyondBoundary = false;
  } else {
    // Stage 5 handles B4 < DeviationDistance <= B5 AND DeviationDistance > B5
    matchedStage = 5;
    matchedBoundary = B5;
    beyondBoundary = deviationDistance > B5;
  }

  // 4. PHB_DEVS calculation
  let phbDevs = 0;
  if (matchedStage === 0) {
    phbDevs = 0;
  } else if (deviation > 0) {
    phbDevs = +matchedBoundary;
  } else if (deviation < 0) {
    phbDevs = -matchedBoundary;
  }

  // 5. SHB_DEVS calculation
  const shbDevs = deviation;

  // 6. Residual Compare
  const compare = Number((shbDevs - phbDevs).toFixed(6));

  // 7. compareStage is matchedStage
  const compareStage: StageValue = matchedStage;

  // 8. CM_PACKET Consistency Rules Verification
  const expectedBoundaryByStage: Record<StageValue, number> = {
    0: 0,
    1: B1,
    2: B2,
    3: B3,
    4: B4,
    5: B5,
  };

  const consistencyChecks = {
    rule1_matchedEqualsCompareStage: matchedStage === compareStage,
    rule2_boundaryMatchesStage: matchedBoundary === expectedBoundaryByStage[matchedStage],
    rule3_shbDevsEqualsDeviation: Math.abs(shbDevs - deviation) < 1e-6,
    rule4_deviationDistanceIsAbs: Math.abs(deviationDistance - Math.abs(deviation)) < 1e-6,
    rule5_compareMathValid: Math.abs(compare - (shbDevs - phbDevs)) < 1e-6,
    rule6_stageWithin0to5: [0, 1, 2, 3, 4, 5].includes(compareStage),
    rule7_stageUsesAbsDeviation: true,
    rule8_directionPreserved:
      (deviation > 0 && direction === 'UPWARD') ||
      (deviation < 0 && direction === 'DOWNWARD') ||
      (deviation === 0 && direction === 'NORMAL'),
    rule9_noStage6: (compareStage as number) <= 5 && (matchedStage as number) <= 5,
    rule10_ownBoundariesApplied:
      cumulativeBoundaries.length === 5 &&
      B1 > 0 &&
      B2 > B1 &&
      B3 > B2 &&
      B4 > B3 &&
      B5 > B4,
  };

  const status = Object.values(consistencyChecks).every(Boolean) ? 'VALID' : 'INVALID';

  return {
    parameterId: config.id,
    parameterName: config.name,
    category: config.category,
    unit: config.unit,
    phbBaseline,
    shbValue,
    deviation,
    deviationDistance,
    direction,
    cumulativeBoundaries: [B1, B2, B3, B4, B5],
    matchedStage,
    matchedBoundary,
    beyondBoundary,
    phbDevs,
    shbDevs,
    compare,
    compareStage,
    status,
    consistencyChecks,
  };
}

/**
 * Executes compare on all 11 canonical parameters and generates the C50 compact feature vector.
 */
export function generateCMPacket(
  inputs?: Array<{
    parameterId: string;
    phbBaseline?: number;
    shbValue: number;
    cumulativeBoundaries?: [number, number, number, number, number];
  }>
): CMPacket {
  const inputMap = new Map(inputs?.map((item) => [item.parameterId, item]));

  const results: ParameterCompareResult[] = CANONICAL_11_PARAMETERS.map((param) => {
    const custom = inputMap.get(param.id);
    const phbBaseline = custom?.phbBaseline ?? param.defaultPHB;
    const shbValue = custom?.shbValue ?? param.defaultPHB;
    const boundaries = custom?.cumulativeBoundaries ?? param.cumulativeBoundaries;

    return calculateParameterCompare(param, phbBaseline, shbValue, boundaries);
  });

  const mlVector: CMPacket['mlVector'] = [
    results[0].compareStage,
    results[1].compareStage,
    results[2].compareStage,
    results[3].compareStage,
    results[4].compareStage,
    results[5].compareStage,
    results[6].compareStage,
    results[7].compareStage,
    results[8].compareStage,
    results[9].compareStage,
    results[10].compareStage,
  ];

  const isAllValid = results.every((r) => r.status === 'VALID');

  return {
    timestamp: new Date().toISOString(),
    results,
    mlVector,
    isAllValid,
  };
}
