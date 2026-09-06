/**
 * DIAG (Diagnostic / Emergency Assistance) Mode Types
 * GOATEST - CRIB PMT-7
 */

export type DiagState =
  | 'DIAG_IDLE'
  | 'DIAG_ACTIVE'
  | 'ACTION_CHECK_PENDING'
  | 'ACTION_CONFIRMED'
  | 'ACTION_MISSED'
  | 'GUIDANCE_ACTIVE'
  | 'DIAG_CONTINUING'
  | 'DIAG_MANUAL_OVERRIDE'
  | 'DIAG_EXITED';

export type DiagActionId =
  | 'RUN'
  | 'EXERCISE'
  | 'FALL'
  | 'LIFT_SOMETHING_HEAVY'
  | 'LAUGH_COUGH_HARD'
  | 'FEEL_DIZZY'
  | 'FEEL_FATIGUED'
  | 'SHORTNESS_OF_BREATH'
  | 'CHEST_DISCOMFORT'
  | 'OTHER';

export interface DiagActionChoice {
  id: DiagActionId;
  label: string;
  shortLabel: string;
  guidanceDirectives: string[];
}

export type DiagEventType =
  | 'START_DIAG'
  | 'TRIGGER_ACTION_CHECK'
  | 'SELECT_ACTION'
  | 'DISMISS_ACTION'
  | 'CONTINUE_DIAG'
  | 'MANUAL_OVERRIDE'
  | 'CONDITION_UPDATE'
  | 'RESET'
  | 'EXIT';

export interface DiagEvent<T = unknown> {
  type: DiagEventType;
  timestamp: number;
  source: 'UI' | 'HELPER' | 'CONDITION' | 'USER' | 'INTERNAL' | string;
  payload?: T;
}

export interface DiagActionResponsePayload {
  actionId: DiagActionId;
  actionLabel: string;
  timestamp: number;
}

export interface DiagGuidanceContract {
  mode: 'DIAG';
  directive: string;
  directives: string[];
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  timestamp: number;
}

export interface DiagSnapshot {
  state: DiagState;
  selectedAction: DiagActionResponsePayload | null;
  guidanceDirectives: string[];
  primaryGuidance: DiagGuidanceContract | null;
  isContinuing: boolean;
  isOverrideActive: boolean;
  availableActions: DiagActionChoice[];
}
