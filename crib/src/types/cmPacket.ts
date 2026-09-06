/**
 * CM_PACKET & Physiological Pipeline Type Definitions
 * Source of Truth: SHB -> COMPARE -> CM_PACKET
 * GOATEST - CRIB PMT-3
 */

export type CmParameterKey =
  | 'heartRate'
  | 'spo2'
  | 'ppi'
  | 'rmssd'
  | 'sdnn'
  | 'respiratoryRate'
  | 'skinTemperature'
  | 'motionVector'
  | 'arterialO2Content'
  | 'metabolicActivityIndex'
  | string;

export type CmParameterStatus =
  | 'COMPUTED'
  | 'MISSING_SHB_VALUE'
  | 'MISSING_PHB'
  | 'OUT_OF_RANGE'
  | 'ERROR'
  | string;

export type CmDeviationDirection =
  | 'INCREASED'
  | 'DECREASED'
  | 'STABLE'
  | 'UNKNOWN'
  | string;

export interface CmPacketParameterRow {
  parameter: CmParameterKey;
  phbBaseline?: number | null;
  shbValue?: number | null;
  deviation?: number | null;
  direction?: CmDeviationDirection;
  matchedStage?: number | string | null;
  compare?: number | null;
  status: CmParameterStatus;
  unit?: string;
  label?: string;
}

export interface CmCompareSummary {
  totalParameters?: number;
  computedParameters?: number;
  flaggedDeviations?: number;
  matchedStage?: number | string | null;
  summaryText?: string;
}

export interface CmBfitResult {
  score: number | null;
  status?: string;
  timestamp?: number;
}

export interface ConditionPatternItem {
  id: string;
  name: string;
  probability: number;
  status?: 'low' | 'moderate' | 'high' | 'critical' | string;
}

export interface ConditionResult {
  label: string;
  probability: number | null;
  patterns?: ConditionPatternItem[];
  severity?: 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
  timestamp: number;
  summary?: string;
}

/**
 * CM_PACKET Structure
 * Emitted by COMPARE Engine
 */
export interface CmPacket {
  sessionId: string;
  uid: string;
  timestamp: number;
  target?: string; // e.g., 'OVERALL', 'CARDIOVASCULAR', 'RESPIRATORY', 'BRAIN_NEUROLOGICAL', etc.
  parameters: Record<string, CmPacketParameterRow> | CmPacketParameterRow[];
  compareSummary?: CmCompareSummary;
  bfitResult?: CmBfitResult | number | null;
  shbLockedValues?: Record<string, number | null>;
  metadata?: Record<string, unknown>;
}
