export type ParameterCategory = 'DV' | 'IV' | 'CX';
export type StageValue = 0 | 1 | 2 | 3 | 4 | 5;
export type Direction = 'UPWARD' | 'DOWNWARD' | 'NORMAL';

export type TemporalLevel = 'TEST' | 'DAY' | 'WEEK' | 'MONTH';
export type SeverityLevel = 'NORMAL' | 'CONTROL' | 'MILD' | 'HIGH' | 'RISK';
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TrendLabel =
  | 'STABLE'
  | 'IMPROVING'
  | 'DETERIORATING'
  | 'FLUCTUATING'
  | 'RECOVERING'
  | 'PERSISTENT_ABNORMALITY'
  | 'N/A'
  | 'NORMAL';

export type PrimaryTaxonomy =
  | 'NORMAL_BASELINE'
  | 'CONTROLLED_DEVIATION'
  | 'MILD_PHYSIOLOGICAL_CHANGE'
  | 'HIGH_PHYSIOLOGICAL_LOAD'
  | 'CARDIAC_PATTERN'
  | 'OXYGENATION_PATTERN'
  | 'RESPIRATORY_PATTERN'
  | 'AUTONOMIC_HRV_PATTERN'
  | 'ACTIVITY_METABOLIC_PATTERN'
  | 'ACTIVITY_METABOLIC_LOAD'
  | 'THERMAL_ENVIRONMENTAL_PATTERN'
  | 'ENVIRONMENTAL_PRESSURE_ALTITUDE_PATTERN'
  | 'CARDIORESPIRATORY_PATTERN'
  | 'MULTI_PARAMETER_RISK';

export const STAGE_FEATURE_NAMES = [
  'HR_stage',
  'SpO2_stage',
  'PPI_stage',
  'RMSSD_stage',
  'SDNN_stage',
  'RespiratoryRate_stage',
  'ActivityIntensity_stage',
  'AmbientTemperature_stage',
  'RelativeHumidity_stage',
  'AtmosphericPressure_stage',
  'Altitude_stage',
] as const;

export const LABEL_HEADER_NAMES = [
  'primary_taxonomy',
  'secondary_taxonomy',
  'pattern_label',
  'severity_label',
  'severity_score',
  'confidence_score',
  'confidence_level',
  'trend_label',
] as const;

/**
 * Standard C50 Clean ML Record for TEST, DAY, WEEK, MONTH.
 */
export interface C50CleanRecord {
  SNO: number;
  HR_stage: StageValue;
  SpO2_stage: StageValue;
  PPI_stage: StageValue;
  RMSSD_stage: StageValue;
  SDNN_stage: StageValue;
  RespiratoryRate_stage: StageValue;
  ActivityIntensity_stage: StageValue;
  AmbientTemperature_stage: StageValue;
  RelativeHumidity_stage: StageValue;
  AtmosphericPressure_stage: StageValue;
  Altitude_stage: StageValue;
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string; // Formatted as "0.XX" string in CSV
  confidence_score: string; // Formatted as "0.XX" string in CSV
  confidence_level: ConfidenceLevel;
  trend_label: string;
}

export interface C50WideRecord {
  SNO: number;
  stageValues: StageValue[]; // 11 for TEST, 33 for DAY, 231 for WEEK, 924 for MONTH
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string;
  confidence_score: string;
  confidence_level: ConfidenceLevel;
  trend_label: string;
}

export type C50Dataset = C50CleanRecord[];

export interface GeneratedDatasetBundle {
  testRowCount: number;
  dayRowCount: number;
  weekRowCount: number;
  monthRowCount: number;
  patternLibrarySize: number;
  trajectoryCount: number;
}

