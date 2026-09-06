/**
 * CRIB Input Adapter Type Definitions
 * Responsibility: CM_PACKET -> CribInputState
 * GOATEST - CRIB PMT-3
 */

import { CribVital, CribProbability } from './crib';
import { CmPacket, ConditionResult } from './cmPacket';

export type CribAdapterStatus =
  | 'INITIALIZING'
  | 'WAITING_FOR_AUTHENTICATION'
  | 'WAITING_FOR_SHB'
  | 'WAITING_FOR_COMPARE'
  | 'CM_PACKET_READY'
  | 'CONDITION_PENDING'
  | 'CONDITION_READY'
  | 'STALE_DATA'
  | 'ERROR';

export type CribFreshnessStatus = 'LIVE' | 'RECENT' | 'STALE' | 'UNAVAILABLE';

export interface CribCompareParameterSummary {
  parameter: string;
  label: string;
  phbBaseline: number | null;
  shbValue: number | null;
  deviation: number | null;
  direction: string;
  matchedStage: number | string | null;
  compare: number | null;
  status: string;
  unit: string;
}

export interface CribCompareSummaryState {
  parameters: CribCompareParameterSummary[];
  computedCount: number;
  totalCount: number;
  matchedStage: number | string | null;
  summaryText?: string;
}

export interface CribInputState {
  sessionId: string | null;
  uid: string | null;
  timestamp: number | null;
  target: string; // e.g. 'OVERALL', 'CARDIOVASCULAR', etc.
  vitals: CribVital[];
  compareSummary: CribCompareSummaryState | null;
  conditionResult: ConditionResult | null;
  probabilities: CribProbability[];
  bfitResult: number | null;
  status: CribAdapterStatus;
  freshness: CribFreshnessStatus;
  errorMessage?: string;
}

export interface AdaptCmPacketOptions {
  packet?: CmPacket | null;
  conditionResult?: ConditionResult | null;
  authenticatedUid?: string | null;
  maxStaleAgeMs?: number; // default 60_000 (1 minute)
  currentTime?: number;
  allowDevTesting?: boolean;
}
