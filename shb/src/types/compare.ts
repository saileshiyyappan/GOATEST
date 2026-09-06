/**
 * Authoritative Types for GOATEST Compare Pipeline
 * Scope: PHB -> SHB -> DEV -> PHB_DEVS -> COMPARE -> CM_PACKET
 * Standardized across 11 Canonical Parameters (DV: 3, IV: 3, CX: 5)
 */

import { CanonicalParameterKey, PhysiologicalCategory } from './physiologicalRegistry';
export type { CanonicalParameterKey, PhysiologicalCategory };

export type CompareConnectionState =
  | 'DATABASE_DISCONNECTED'
  | 'DATABASE_CONNECTING'
  | 'DATABASE_CONNECTED'
  | 'AUTH_REQUIRED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'PHB_FETCHING'
  | 'PHB_READY'
  | 'PHB_NOT_FOUND'
  | 'CONNECTION_ERROR'
  | 'AUTH_ERROR'
  | 'PHB_FETCH_ERROR';

export type ParameterStatus =
  | 'VALID'
  | 'MISSING_SHB_VALUE'
  | 'NO_PHB_REFERENCE'
  | 'MISSING_PHB_VALUE'
  | 'UNIT_MISMATCH'
  | 'PHB_DEVIATION_MODEL_INVALID'
  | 'INVALID_PHB_MODEL'
  | 'INVALID_SHB_VALUE'
  | 'COMPUTED'
  | 'NOT_AVAILABLE';

export interface PhbPhysiologicalItem {
  name: string;
  value?: number;
  baseline?: number;
  val?: number;
  reading?: number;
  numericValue?: number;
  unit?: string;
  [key: string]: any;
}

export interface DeviationStageDef {
  stage: number | string;
  lowerBound: number;
  upperBound: number;
  magnitude: number;
  severity: string;
  [key: string]: any;
}

export interface PhbDeviationProfile {
  stage1?: DeviationStageDef;
  stage2?: DeviationStageDef;
  stage3?: DeviationStageDef;
  stage4?: DeviationStageDef;
  stage5?: DeviationStageDef;
  stages?: DeviationStageDef[];
  [key: string]: any;
}

export interface PhbDeviationConfigItem {
  featureName: string;
  baseline?: number;
  comparisonType?: string;
  directionality?: 'BIDIRECTIONAL' | 'UPWARD_ONLY' | 'DOWNWARD_ONLY' | 'UPWARD' | 'DOWNWARD' | string;
  deviationProfile?: PhbDeviationProfile | DeviationStageDef[];
  deviationThreshold?: number;
  deviation?: number;
  dev?: number;
  threshold?: number;
  magnitude?: number;
  value?: number;
  stages?: DeviationStageDef[];
  [key: string]: any;
}

export interface NormalizedDeviationStage {
  stage: number;
  lowerBound: number;
  upperBound: number;
  magnitude: number;
  severity: string;
}

export interface NormalizedDeviationProfile {
  stage1: NormalizedDeviationStage;
  stage2: NormalizedDeviationStage;
  stage3: NormalizedDeviationStage;
  stage4: NormalizedDeviationStage;
  stage5: NormalizedDeviationStage;
}

export interface NormalizedPhbFeature {
  featureKey: CanonicalParameterKey | string;
  parameterName: string;
  unit: string;
  category: PhysiologicalCategory | 'DIRECT' | 'INDIRECT' | 'CONTEXT';
  phbValue: number;
  baseline: number;
  comparisonType: 'ABSOLUTE' | 'PERCENTAGE' | string;
  directionality: 'BIDIRECTIONAL' | 'DOWNWARD_ONLY' | 'UPWARD_ONLY' | 'DOWNWARD' | 'UPWARD' | string;
  deviationProfile: NormalizedDeviationProfile;
  rawStageMagnitudes: number[];
  cumulativeBoundaries: number[];
}

export interface NormalizedPhbDocument {
  uid?: string;
  version?: string;
  features: Map<string, NormalizedPhbFeature>;
  discoveredDirectKeys: string[];
  discoveredIndirectKeys: string[];
  discoveredContextKeys: string[];
  discoveredConfigKeys: string[];
  rawDocument: PhbDocument;
}

/**
 * Complete normalized in-memory PHB JSON representing the entire Firestore PHB
 */
export interface SynchronizedPhbJson {
  uid: string;
  owner?: string;
  userReference?: string;
  version?: string;
  generatedAt?: string | number;
  updatedAt?: string | number;
  assessmentScopes?: any;
  demographicProfile?: any;
  monitoringPreferences?: any;
  physiological: {
    direct: PhbPhysiologicalItem[];
    indirect: PhbPhysiologicalItem[];
    context?: PhbPhysiologicalItem[];
    [key: string]: any;
  };
  context?: any;
  deviationConfiguration: PhbDeviationConfigItem[];
  metadata?: any;
  engineVersion?: string;
  ruleVersion?: string;
  deviationModelVersion?: string;
  deviationEvidenceVersion?: string;
  features: Map<string, NormalizedPhbFeature>;
  discoveredDirectKeys: string[];
  discoveredIndirectKeys: string[];
  discoveredContextKeys: string[];
  discoveredConfigKeys: string[];
  rawDocument: any;
}

export interface AccountScopedPhbCache {
  uid: string;
  phb: SynchronizedPhbJson;
  fetchedAt: number;
  sourcePath: string;
}

/**
 * Standard PHB Document Schema as stored in Firestore /phbs/{uid}
 */
export interface PhbDocument {
  uid?: string;
  userId?: string;
  createdAt?: string | number | any;
  updatedAt?: string | number | any;
  version?: string;
  physiological?: {
    direct?: PhbPhysiologicalItem[] | Record<string, any>;
    indirect?: PhbPhysiologicalItem[] | Record<string, any>;
    context?: PhbPhysiologicalItem[] | Record<string, any>;
    [key: string]: any;
  };
  context?: {
    [key: string]: any;
  };
  deviationConfiguration?: PhbDeviationConfigItem[] | Record<string, any>;
  deviationConfigurations?: PhbDeviationConfigItem[];
  // Direct Vitals Baseline
  heartRate?: number;
  hr?: number;
  spO2?: number;
  spo2?: number;
  perfusionIndex?: number;
  ppi?: number;
  // Derived / Indirect Vitals Baseline
  rmssd?: number;
  sdnn?: number;
  respiratoryRate?: number;
  rr?: number;
  // Context Variables Baseline
  activityIntensity?: number;
  motionVector?: number;
  accel?: number;
  ambientTemperature?: number;
  skinTemperature?: number;
  temp?: number;
  relativeHumidity?: number;
  humidity?: number;
  hum?: number;
  atmosphericPressure?: number;
  pressure?: number;
  pres?: number;
  altitude?: number;
  alt?: number;
  vitals?: {
    [key: string]: any;
  };
  baselines?: {
    [key: string]: any;
  };
  deviations?: Record<string, any>;
  [key: string]: any;
}

export interface PhbFetchResult {
  success: boolean;
  state: CompareConnectionState;
  uid: string | null;
  path: string | null;
  phb: SynchronizedPhbJson | null;
  error?: string;
}

/**
 * Authoritative Parameter Schema within CM_PACKET (10-Column Format)
 */
export interface CmParameterRow {
  secNo: number; // 1 to 11
  key: CanonicalParameterKey | string;
  name: string;
  type: PhysiologicalCategory | 'DV' | 'IV' | 'CX';
  unit: string;

  phbBaseline: number | null;
  shbValue: number | null;

  deviation: number | null;
  deviationDistance: number | null;
  direction: string | null;

  rawStageMagnitudes: number[] | null;
  cumulativeBoundaries: number[] | null;

  matchedStage: number | null;
  matchedBoundary: number | null;
  beyondBoundary?: boolean;

  phbDevs: number | null;
  shbDevs: number | null;
  compare: number | null;

  directionality: string;
  status: ParameterStatus;
  compareStage: number | null;

  // Convenience aliases for table rendering
  paramKey: string;
  parameter: string;
  category: 'DIRECT' | 'INDIRECT' | 'CONTEXT';
  phb: number | null;
  shb: number | null;
  dev: number | null;
  severity: string;
  stage: number | string;
}

/**
 * Authoritative CM_PACKET Schema
 */
export interface CmPacket {
  version: string;
  packetType: 'CM_PACKET';
  sessionId: string;
  uid: string;
  target: string;
  targetOrgan?: string;
  timestamp: number;

  parameters: CmParameterRow[];

  validParameterCount: number;
  missingShbParameters: string[];
  missingPhbParameters: string[];
  status: 'COMPUTED' | 'INCOMPLETE' | 'FAILED';
  error?: string;

  // Table rendering compatibility aliases
  rows?: CmParameterRow[];
  totalRows?: number;
  matchedCount?: number;
  missingShbCount?: number;
  shbOnlyCount?: number;
  missingParameters?: string[];
}

export interface CompareComputationResult {
  success: boolean;
  cmPacket: CmPacket | null;
  validParameterCount: number;
  missingParameters: string[];
  invalidParameters: string[];
  error?: string;
}
