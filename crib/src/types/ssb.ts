/**
 * SSB (Stranger / Second Bystander) Emergency Mode Types
 * GOATEST - CRIB PMT-5
 */

export type SSBState =
  | 'SSB_IDLE'
  | 'SSB_STARTING'
  | 'SSB_ACTIVE'
  | 'STRANGER_PROMPT'
  | 'STRANGER_RESPONDED'
  | 'STRANGER_TIMEOUT'
  | 'GUIDANCE_ACTIVE'
  | 'SSB_CONTINUING'
  | 'SSB_ESCALATION'
  | 'SSB_MANUAL_OVERRIDE'
  | 'SSB_EXITED';

export type SSBEventType =
  | 'SDCU_ESCALATION'
  | 'MANUAL_START'
  | 'PROMPT_STRANGER'
  | 'STRANGER_RESPONSE'
  | 'STRANGER_TIMEOUT_TRIGGER'
  | 'CONTINUE_SSB'
  | 'MANUAL_OVERRIDE'
  | 'CONDITION_UPDATE'
  | 'FALL_EVENT'
  | 'RESET'
  | 'EXIT';

export interface SSBEvent<T = unknown> {
  type: SSBEventType;
  timestamp: number;
  source: 'SDCU' | 'UI' | 'HELPER' | 'CONDITION' | 'FALL_SENSOR' | 'USER' | 'INTERNAL' | string;
  payload?: T;
}

export interface SSBQuestion {
  id: string;
  text: string;
  guidanceMap: {
    YES: string[];
    NO: string[];
  };
}

export interface SSBHelperResponsePayload {
  questionId: string;
  questionText: string;
  response: 'YES' | 'NO';
  timestamp: number;
}

export interface SSBGuidanceContract {
  mode: 'SSB';
  audience: 'HELPER' | 'RESPONDER';
  directive: string;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  timestamp: number;
}

export interface SSBSnapshot {
  state: SSBState;
  currentStrangerQuestion: SSBQuestion | null;
  lastHelperResponse: SSBHelperResponsePayload | null;
  guidanceDirectives: string[];
  primaryGuidance: SSBGuidanceContract | null;
  isContinuing: boolean;
  escalationReason: string | null;
  isOverrideActive: boolean;
}
