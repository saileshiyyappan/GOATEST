/**
 * GOATEST C50 Packet Contracts & Types
 * 
 * PMT-2: C50 ML Input/Output Integration & Contract Definitions.
 * 
 * CONTRACT ARCHITECTURE:
 * CM_PACKET -> C50_INPUT_PACKET -> External C50 ML -> C50_RESULT_PACKET -> Firestore / Reports
 * 
 * CORE RULES:
 * 1. Strongly typed, versioned packet contracts.
 * 2. Full milestone support: TEST | DAY | WEEK | MONTH.
 * 3. Preserves all personalized baseline, deviation, stage, and compare metrics.
 * 4. Missing values remain explicitly missing (undefined/null) - never fabricate.
 * 5. Raw input and raw output are retained untouched.
 */

export type MilestoneType = 'TEST' | 'DAY' | 'WEEK' | 'MONTH';

export type C50ServiceState =
  | 'NOT_CONFIGURED'
  | 'CONNECTING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'INVALID_INPUT'
  | 'ML_ERROR'
  | 'TIMEOUT'
  | 'STORAGE_ERROR';

export type C50ResultStatus = 'SUCCESS' | 'ML_NOT_CONFIGURED' | 'FAILED' | 'INVALID_INPUT';

/**
 * Raw CM_PACKET representation produced by the COMPARE pipeline
 */
export interface CmPacketInput {
  packetId?: string;
  id?: string;
  sourceCmPacketId?: string;
  userId: string;
  sessionId: string;
  timestamp: string;
  target: string;
  organ?: string;
  milestone?: MilestoneType;
  source?: string;
  parameters?: Record<string, CmParameterComparison>;
  metrics?: Record<string, any>;
  metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * Single physiological parameter comparison node from COMPARE
 */
export interface CmParameterComparison {
  name?: string;
  phbBaseline?: number | null;
  shbValue?: number | null;
  shbDeviation?: number | null;
  absDeviationDistance?: number | null;
  direction?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | string | null;
  phbRawStageMagnitudes?: number[] | null;
  cumulativePhbBoundaries?: number[] | null;
  matchedStage?: number | string | null;
  phbDevs?: number | null;
  shbDevs?: number | null;
  compareMetrics?: Record<string, any> | null;
  [key: string]: any;
}

/**
 * Deviation feature node inside C50_INPUT_PACKET
 */
export interface C50DeviationFeature {
  phbBaseline?: number | null;
  shbValue?: number | null;
  shbDeviation?: number | null;
  absDeviationDistance?: number | null;
  direction?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | string | null;
  phbRawStageMagnitudes?: number[] | null;
  cumulativePhbBoundaries?: number[] | null;
  matchedStage?: number | string | null;
  phbDevs?: number | null;
  shbDevs?: number | null;
  compareMetrics?: Record<string, any> | null;
  [key: string]: any;
}

/**
 * Stage feature node inside C50_INPUT_PACKET
 */
export interface C50StageFeature {
  matchedStage?: number | string | null;
  stageConfidence?: number | null;
  boundaryProximity?: number | null;
  stageLabel?: string | null;
  [key: string]: any;
}

/**
 * Source metadata for provenance tracking
 */
export interface C50SourceMetadata {
  source: string;
  sourceVersion?: string;
  hardwareVersion?: string;
  firmwareVersion?: string;
  clientAppVersion?: string;
  adapterVersion: string;
  isDevelopmentFixture?: boolean;
  [key: string]: any;
}

/**
 * Strongly typed, versioned C50_INPUT_PACKET
 */
export interface C50InputPacket {
  version: string; // e.g. "1.0.0"
  inputId: string; // Unique ID for this input packet
  sourceCmPacketId: string; // Provenance reference to source CM_PACKET
  userId: string; // Authenticated user UID
  sessionId: string; // Session / Assessment ID
  target: string; // Organ or physiological system target
  timestamp: string; // ISO 8601
  milestone: MilestoneType; // TEST | DAY | WEEK | MONTH
  physiologicalFeatures: Record<string, number | null | undefined>;
  deviationFeatures: Record<string, C50DeviationFeature>;
  stageFeatures: Record<string, C50StageFeature>;
  sourceMetadata: C50SourceMetadata;
  isDevelopmentFixture?: boolean;
}

/**
 * Strongly typed, versioned C50_RESULT_PACKET
 */
export interface C50ResultPacket {
  version: string; // e.g. "1.0.0"
  resultId: string; // Unique ID for this result
  sourceInputId: string; // Links directly back to C50InputPacket.inputId
  sourceCmPacketId: string; // Links directly back to source CM_PACKET ID
  userId: string; // Authenticated user UID
  milestone: MilestoneType; // TEST | DAY | WEEK | MONTH
  timestamp: string; // ISO 8601
  modelVersion: string; // e.g. "C50_V1.0", "C50_DEV_STUB"
  status: C50ResultStatus; // SUCCESS | ML_NOT_CONFIGURED | FAILED | INVALID_INPUT
  predictionPayload?: Record<string, any> | null;
  featureSummary?: Record<string, any> | null;
  trendSummary?: Record<string, any> | null;
  classification?: string | null; // Only if supplied by ML model
  confidence?: number | null; // Only if supplied by ML model
  rawResponse: Record<string, any>; // EXACT raw response untouched
  errorMessage?: string | null;
  isFixture?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Status response for C50 service availability
 */
export interface C50EndpointStatus {
  configured: boolean;
  endpointUrl?: string | null;
  state: C50ServiceState;
  modelVersion?: string;
  message: string;
}
