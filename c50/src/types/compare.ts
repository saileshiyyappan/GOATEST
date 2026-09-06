export type ParameterCategory = 'DV' | 'IV' | 'CX';

export type Direction = 'UPWARD' | 'DOWNWARD' | 'NORMAL';

export type StageValue = 0 | 1 | 2 | 3 | 4 | 5;

export interface CanonicalParameterConfig {
  id: string;
  name: string;
  category: ParameterCategory;
  unit: string;
  defaultPHB: number;
  rawStageMagnitudes: [number, number, number, number, number];
  cumulativeBoundaries: [number, number, number, number, number];
}

export interface ParameterCompareResult {
  parameterId: string;
  parameterName: string;
  category: ParameterCategory;
  unit: string;
  phbBaseline: number;
  shbValue: number;
  deviation: number;
  deviationDistance: number;
  direction: Direction;
  cumulativeBoundaries: [number, number, number, number, number];
  matchedStage: StageValue;
  matchedBoundary: number;
  beyondBoundary: boolean;
  phbDevs: number;
  shbDevs: number;
  compare: number;
  compareStage: StageValue;
  status: 'VALID' | 'INVALID';
  consistencyChecks: {
    rule1_matchedEqualsCompareStage: boolean;
    rule2_boundaryMatchesStage: boolean;
    rule3_shbDevsEqualsDeviation: boolean;
    rule4_deviationDistanceIsAbs: boolean;
    rule5_compareMathValid: boolean;
    rule6_stageWithin0to5: boolean;
    rule7_stageUsesAbsDeviation: boolean;
    rule8_directionPreserved: boolean;
    rule9_noStage6: boolean;
    rule10_ownBoundariesApplied: boolean;
  };
}

export interface CMPacket {
  timestamp: string;
  results: ParameterCompareResult[];
  mlVector: [
    StageValue,
    StageValue,
    StageValue,
    StageValue,
    StageValue,
    StageValue,
    StageValue,
    StageValue,
    StageValue,
    StageValue,
    StageValue
  ];
  isAllValid: boolean;
}

export interface TestCaseResult {
  id: string;
  name: string;
  description: string;
  input: {
    phb: number;
    shb: number;
    cumulativeBoundaries: [number, number, number, number, number];
  };
  expected: {
    deviation: number;
    deviationDistance: number;
    stage: StageValue;
    matchedBoundary: number;
    direction: Direction;
    beyondBoundary?: boolean;
    compare?: number;
  };
  actual: {
    deviation: number;
    deviationDistance: number;
    stage: StageValue;
    matchedBoundary: number;
    direction: Direction;
    beyondBoundary: boolean;
    compare: number;
  };
  passed: boolean;
  failureReason?: string;
}
