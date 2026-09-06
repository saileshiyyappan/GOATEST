/**
 * CRIB Emergency Frontend Type Contracts
 * GOATEST - CRIB PMT-1
 */

export type CribMode = 'SDCU' | 'SSB' | 'DIAG';

export type VitalStatus = 'normal' | 'warning' | 'critical' | 'unknown';

export interface CribVital {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string;
  status?: VitalStatus;
  shortLabel?: string;
}

export type ProbabilityStatus = 'low' | 'moderate' | 'high' | 'critical';

export interface CribProbability {
  id: string;
  label: string;
  probability: number | null; // percentage 0-100 or null if waiting for data
  status?: ProbabilityStatus;
}

export type AiMessageRole = 'ai' | 'user' | 'system';
export type AiMessagePriority = 'normal' | 'high' | 'urgent';

export interface CribAiMessage {
  id: string;
  role: AiMessageRole;
  message: string;
  timestamp: number;
  priority?: AiMessagePriority;
}

export type GuidanceLevel = 'info' | 'warning' | 'critical';

export interface CribGuidanceItem {
  id: string;
  text: string;
  level: GuidanceLevel;
}

export interface CribMediaState {
  type: 'video' | 'audio' | 'none';
  url: string | null;
  title?: string;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0 to 1
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
}

export interface CribSettingsState {
  callPermission: boolean;
  notificationsEnabled: boolean;
  locationPermission: boolean;
  audioAlarm: boolean;
  customMediaUrl?: string;
  mediaType: 'video' | 'audio' | 'none';
  sdcuEnabled?: boolean;
  actionVerificationEnabled?: boolean;
  audioGuidanceEnabled?: boolean;
}

export type ExpandPanelType = 'none' | 'probabilities' | 'vitals';

export interface CribUiState {
  mode: CribMode;
  vitals: CribVital[];
  probabilities: CribProbability[];
  aiMessages: CribAiMessage[];
  guidance: CribGuidanceItem[];
  mediaState: CribMediaState;
  settings: CribSettingsState;
  isSettingsOpen: boolean;
  expandedPanel: ExpandPanelType;
  manualOverrideTriggered: boolean;
}

/**
 * Future integration packet contract:
 * SHB -> COMPARE -> CONDITION -> CRIB INPUT -> CRIB UI
 */
export interface CribInputPacket {
  timestamp: number;
  mode: CribMode;
  vitals?: Record<string, number | string | null>;
  compareSummary?: string;
  conditionResult?: string;
  bfitResult?: number | null;
  aiGuidance?: string[];
  probabilities?: Array<{ label: string; probability: number }>;
}
