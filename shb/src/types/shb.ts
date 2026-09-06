import { CanonicalParameterKey, PhysiologicalCategory } from './physiologicalRegistry';

export type OrganCategoryId = 
  | 'OVERALL'
  | 'CARDIOVASCULAR'
  | 'RESPIRATORY'
  | 'NEUROLOGICAL'
  | 'MOVEMENT'
  | 'THERMAL'
  | 'ENVIRONMENT'
  | 'RENAL'
  | 'METABOLIC'
  | 'ENDOCRINE'
  | 'VASCULAR';

export interface OrganCategory {
  id: OrganCategoryId;
  name: string;
  subtitle: string;
  description: string;
  iconName: string;
  targetVitals: string[];
}

export type ShbSessionPhase = 
  | 'ORGAN_SELECTION'
  | 'LIVE_SHB'
  | 'COMPARE_LOADING'
  | 'CONDITION_ANALYSIS'
  | 'REPORT';

export type VitalStatus =
  | 'WAITING'
  | 'ACQUIRING'
  | 'ESTIMATING'
  | 'STABLE'
  | 'STABILIZING'
  | 'LOCKED'
  | 'NOT_AVAILABLE'
  | 'OFFLINE';

export type AcquisitionEngineStatus =
  | 'IDLE'
  | 'ACQUIRING'
  | 'PAUSED'
  | 'PAUSED_BY_SHAKE'
  | 'LOCKING'
  | 'LOCKED'
  | 'TERMINATED_INTERFERENCE'
  | 'TERMINATED_BY_SHAKE'
  | 'ABORTED';

export interface RawSensorPacket {
  timestamp: number;
  temp?: number;
  hum?: number;
  pres?: number;
  alt?: number;
  ax?: number;
  ay?: number;
  az?: number;
  ir?: number;
  red?: number;
  hr?: number;
  spo2?: number;
  ppi?: number;
  ecg?: number;
  shake?: number;
  fall?: number;
  rawString?: string;
}

export interface DirectVitalItem {
  id: 'hr' | 'spo2' | 'ppi' | string;
  label: string;
  shortCode: string;
  unit: string;
  liveValue: number | string | null;
  lockedValue: number | string | null;
  sampleCount: number;
  status: VitalStatus;
  normalRange?: string;
}

export interface IndirectVitalItem {
  id: 'rmssd' | 'sdnn' | 'rr' | 'respiratoryRate' | string;
  label: string;
  shortCode: string;
  unit: string;
  liveValue?: number | string | null;
  value: number | string | null;
  lockedValue?: number | string | null;
  status: VitalStatus;
  formulaNote?: string;
}

export interface ContextVariableItem {
  id: 'activityIntensity' | 'ambientTemperature' | 'relativeHumidity' | 'atmosphericPressure' | 'altitude' | string;
  label: string;
  shortCode: string;
  unit: string;
  liveValue: number | string | null;
  lockedValue?: number | string | null;
  status: VitalStatus;
  description?: string;
}

export type SensorGroupId = 'PPG' | 'MPU' | 'ENV';

export type SensorModuleStatus = 'WAITING' | 'NOT_CONNECTED' | 'CONNECTED' | 'STREAMING' | 'ERROR';

export interface SensorStatusItem {
  id: SensorGroupId;
  name: string;
  fullName: string;
  status: SensorModuleStatus;
  rateHz?: number;
}

export type BFitStatusCode = 'WAITING' | 'NOT_READY' | 'ALLOW' | 'MID' | 'BAD';

export interface BFitStatusDisplay {
  status: BFitStatusCode;
  confidence: number | null;
  sensorContact: boolean | null;
  motionStability: number | null;
  interferenceCount: number;
  message: string;
  shakeState?: number | null;
  shakeEventCount?: number;
}

export interface LiveVitalsState {
  isAcquiring: boolean;
  engineStatus: AcquisitionEngineStatus;
  elapsedSeconds: number;
  targetDurationSeconds: number;
  directVitals: Record<string, DirectVitalItem>;
  indirectVitals: Record<string, IndirectVitalItem>;
  contextVariables: {
    activityIntensity: number | null;
    ambientTemperature: number | null;
    relativeHumidity: number | null;
    atmosphericPressure: number | null;
    altitude: number | null;
    // Compatibility aliases
    ambientTemp?: number | null;
    humidity?: number | null;
    pressure?: number | null;
    motionIntensity?: number | null;
  };
  sensors: SensorStatusItem[];
  bfit: BFitStatusDisplay;
  sampleStats: {
    totalPackets: number;
    validSamples: number;
    rejectedSamples: number;
    durationSeconds: number;
  };
  lockedVitals?: LockedVitalsSnapshot | null;
}

export interface LockedVitalsSnapshot {
  readonly sessionId: string;
  readonly lockTimestamp: number;
  readonly heartRate: number;
  readonly spo2: number;
  readonly ppi: number;
  readonly rmssd: number;
  readonly sdnn: number;
  readonly respiratoryRate: number;
  readonly activityIntensity: number;
  readonly ambientTemperature: number;
  readonly relativeHumidity: number;
  readonly atmosphericPressure: number;
  readonly altitude: number;
  readonly validSampleCounts: Readonly<Record<string, number>>;
  readonly acceptedSampleCounts: Readonly<Record<string, number>>;
  readonly lockedCount: 11;
  readonly lockComplete: true;
}

export interface ShbFinalResultPacket {
  sessionId: string;
  userId: string;
  deviceId: string;
  targetScope: OrganCategoryId;
  mode: 'NORMAL' | 'BGLOOP';
  acquisition: {
    startedAt: number;
    completedAt: number;
    durationSeconds: number;
    validSampleCount: number;
    rejectedSampleCount: number;
  };
  bfit: {
    finalStatus: BFitStatusCode;
    interferenceCount: number;
  };
  // Exactly 3 Canonical Direct Vitals
  directVitals: {
    heartRate: number | null;
    spo2: number | null;
    ppi: number | null;
  };
  // Exactly 3 Canonical Indirect Vitals
  indirectVitals: {
    rmssd: number | null;
    sdnn: number | null;
    respiratoryRate: number | null;
    rr?: number | null; // Compatibility alias
  };
  // Exactly 5 Canonical Context Variables
  contextVariables: {
    activityIntensity: number | null;
    ambientTemperature: number | null;
    relativeHumidity: number | null;
    atmosphericPressure: number | null;
    altitude: number | null;
  };
  lockState: Record<string, 'LOCKED' | 'NOT_LOCKED' | 'WAITING'>;
  completionStatus: 'COMPLETED' | 'TERMINATED_INTERFERENCE' | 'ABORTED';
}
