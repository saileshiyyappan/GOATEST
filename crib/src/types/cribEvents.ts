/**
 * CRIB Emergency Services & Events Type Contracts
 * PMT-9: Unified Permission, Location, Notification, Call, Audio, and Caretaker Event Schema
 */

import { CribMode } from './crib';

export type CribPermissionType = 'CALL' | 'NOTIFICATIONS' | 'LOCATION' | 'AUDIO';

export type CribPermissionStatus = 'NOT_REQUESTED' | 'GRANTED' | 'DENIED' | 'UNAVAILABLE';

export type CribPermissionMap = Record<CribPermissionType, CribPermissionStatus>;

export type CribLocationStatus =
  | 'LOCATION_READY'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'LOCATION_NOT_REQUESTED';

export interface CribLocationState {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export type CribEmergencyEventType =
  | 'CRIB_ACTIVATED'
  | 'ACTION_MISSED'
  | 'SDCU_ESCALATION'
  | 'SSB_ACTIVATED'
  | 'CRITICAL_CONDITION'
  | 'MANUAL_OVERRIDE'
  | 'AI_EMERGENCY_GUIDANCE';

export interface CaretakerContact {
  id: string;
  name: string;
  phone?: string;
  relationship?: string;
  isPrimary?: boolean;
}

export interface CribEmergencyEvent {
  eventId: string;
  uid: string;
  sessionId: string;
  mode: CribMode;
  timestamp: number;
  eventType: CribEmergencyEventType;
  condition: string;
  severity: 'normal' | 'moderate' | 'high' | 'critical';
  location: CribLocationState | null;
  vitalsSummary: Record<string, string | number>;
  isCaretakerNotified: boolean;
  isUserNotified: boolean;
  message?: string;
  caretaker?: CaretakerContact | null;
}

export interface CribCallStatus {
  success: boolean;
  status: 'CALL_INITIATED' | 'CALL_SERVICE_UNAVAILABLE' | 'NO_CARETAKER_CONFIGURED' | 'CALL_DENIED';
  message: string;
  phoneUrl?: string;
}

export interface CribAudioState {
  audioStatus: 'AUDIO_READY' | 'AUDIO_ACTION_REQUIRED' | 'AUDIO_MUTED' | 'AUDIO_UNAVAILABLE';
  isMuted: boolean;
  isAutoplayBlocked: boolean;
}
