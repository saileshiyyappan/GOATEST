/**
 * SDCU State Machine and Action Verification Types
 * GOATEST - CRIB PMT-4
 */

import { CribMode } from './crib';

export type SDCUState =
  | 'IDLE'
  | 'ACTIVATION_PENDING'
  | 'SDCU_ACTIVE'
  | 'ACTION_CHECK_PENDING'
  | 'ACTION_CONFIRMED'
  | 'ACTION_MISSED'
  | 'EVALUATING'
  | 'SDCU_SAFE'
  | 'SDCU_ESCALATION_PENDING'
  | 'MANUAL_OVERRIDE';

export type SDCUEventType =
  | 'START_ACTIVATION'
  | 'ACTIVATE_CLICKED'
  | 'EXIT_CLICKED'
  | 'ACTIVATION_TIMEOUT'
  | 'CONDITION_RESULT'
  | 'FALL_DETECTED'
  | 'TRIGGER_ACTION_CHECK'
  | 'ACTION_RESPONSE'
  | 'ACTION_TIMEOUT'
  | 'TIMER_TICK'
  | 'TIMER_EXPIRED'
  | 'MANUAL_OVERRIDE'
  | 'RESET';

export interface SDCUEvent<T = unknown> {
  type: SDCUEventType;
  timestamp: number;
  source: 'UI' | 'TIMER' | 'COMPARE' | 'CONDITION' | 'FALL_SENSOR' | 'USER' | 'INTERNAL' | string;
  payload?: T;
}

export type ActionCategory = 'ACTIVITY' | 'SYMPTOM' | 'PHYSIOLOGICAL' | 'GENERAL';

export interface SDCUActionQuestion {
  id: string;
  text: string;
  category: ActionCategory;
  timeoutMs: number;
  guidanceKey: string;
}

export interface SDCUActionResponsePayload {
  questionId: string;
  action: string;
  response: 'YES' | 'NO';
  timestamp: number;
}

export interface SDCUGuidanceEvent {
  type: 'GUIDANCE';
  message: string;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  actionKey?: string;
  timestamp: number;
}

export interface SDCUSettings {
  sdcuEnabled: boolean;
  actionVerificationEnabled: boolean;
  audioGuidanceEnabled: boolean;
}

export interface SDCUSnapshot {
  state: SDCUState;
  remainingSeconds: number; // 120s countdown
  activationCountdown: number; // 10s countdown
  currentActionQuestion: SDCUActionQuestion | null;
  actionCountdown: number; // 10s countdown
  requestedMode: CribMode | null; // e.g. 'SSB' on SDCU_ESCALATION_PENDING
  lastConfirmedAction: SDCUActionResponsePayload | null;
  guidanceDirectives: string[];
  guidanceEvent: SDCUGuidanceEvent | null;
  escalationReason: string | null;
  settings: SDCUSettings;
}
