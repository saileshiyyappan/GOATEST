/**
 * Condition Frontend State Architecture & Data Contracts
 * 
 * Strict separation:
 * The frontend acts purely as a presentation layer for the Condition Engine.
 * Backend pipeline execution (CM_PACKET ingestion, baseline deviation, 
 * C50 ML classification, Firestore writes) remains in background services.
 */

export type { SeverityLevel, ConfidenceLevel, TrendLabel } from '../../c50/types';
import type { SeverityLevel, ConfidenceLevel, TrendLabel } from '../../c50/types';
import { StageVector } from '../../c50/evaluator';

export type ConditionProcessingState =
  | 'INITIALIZING'
  | 'RECEIVING_DATA'
  | 'ANALYZING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'ERROR';

export type ConditionMatchStatus =
  | 'EXACT'
  | 'EQUIVALENT'
  | 'APPROXIMATE'
  | 'NO_ACCEPTABLE_MATCH';

export type TemporalLevel = 'TEST' | 'DAY' | 'WEEK' | 'MONTH';

export interface ConditionStatePayload {
  state: ConditionProcessingState;
  primaryMessage: string;
  secondaryMessage: string;
  footnote?: string;
  progressPercent?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface MatchedDatasetRecord {
  sno: string;
  matchedVector: StageVector;
  distance: number;
  matchType: ConditionMatchStatus;
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string;
  confidence_score: string;
  confidence_level: ConfidenceLevel;
  trend_label: TrendLabel;
  isLabelInconsistent: boolean;
}

export interface ConditionResult {
  uid?: string;
  sessionId?: string;
  target?: string;
  inputVector: StageVector;
  matchedRecord: MatchedDatasetRecord;
  matchStatus: ConditionMatchStatus;
  distanceScore: number;
  temporalLevel: TemporalLevel;
  temporalObservationsCount: number;
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string;
  confidence_score: string;
  confidence_level: ConfidenceLevel;
  trend_label: TrendLabel;
  labelVerificationStatus: 'VERIFIED_CONSISTENT' | 'INCONSISTENT_FLAGGED';
  reportId: string;
  timestamp: string;
  matchedTestRow?: Record<string, any>;
  sourceCmPacket?: Record<string, any>;
}

export interface ParameterReportItem {
  index: number;
  id: string;
  name: string;
  category: 'DV' | 'IV' | 'CX';
  unit: string;
  inputStage: number;
  matchedStage: number;
  isAbnormal: boolean;
  isMatched: boolean;
  deltaStage: number;
  shbValue?: number;
  phbBaseline?: number;
  stageLabel: string;
  interpretation: string;
}

export interface TemporalObservationSummary {
  observationIndex: number;
  observationId: string;
  name: string; // e.g. "Observation 1 (Morning)", "Observation 2 (Midday)", etc.
  timestamp?: string;
  stageVector: StageVector;
  severity: SeverityLevel;
  severityScore?: number;
  pattern?: string;
}

export interface HomeQASection {
  status: 'AVAILABLE' | 'Q/A_NOT_AVAILABLE';
  displayText: string;
  qaId?: string;
  submittedAt?: string;
  responses?: Record<string, any>;
  notes?: string;
}

export interface ConditionReportDocument {
  reportId: string;
  uid: string;
  sessionId?: string;
  target?: string;
  createdAt: string;
  title: string;
  formattedTitle: string;
  temporalLevel: TemporalLevel;
  temporalObservationsCount: number;
  matchedTestRow?: Record<string, any>;
  sourceCmPacket?: Record<string, any>;
  status: string;

  // Current Condition & Summary
  conditionSummary: string;
  whatWasDetected: string;
  patternInterpretation: string;

  // Classifications & Metrics
  severity: {
    label: SeverityLevel;
    score: string;
    description: string;
    initialSeverity?: SeverityLevel;
    peakSeverity?: SeverityLevel;
    finalSeverity?: SeverityLevel;
    meanSeverity?: number;
  };
  confidence: {
    level: ConfidenceLevel;
    score: string;
    description: string;
  };
  trend: {
    label: TrendLabel;
    description: string;
  };
  taxonomy: {
    primary: string;
    secondary: string;
  };

  // Pattern Match & Evidence
  matchedPattern: {
    inputStages: StageVector | number[];
    matchedDatasetSno: string;
    matchedStages: StageVector | number[];
    matchStatus: ConditionMatchStatus;
    distanceScore: number;
  };
  labelVerificationStatus: string;
  temporalInterpretation: string;

  // Canonical 11-Parameter Breakdown
  parameters: ParameterReportItem[];
  abnormalParameters: ParameterReportItem[];
  parameterSpecificInterpretation: string;

  // Actions & Clinical Guidance
  whatShouldIDoNow: string;
  wellnessMonitoringGuidance: string;
  caretakerTechnicalEvidence: {
    primaryTaxonomy: string;
    secondaryTaxonomy: string;
    referenceDatasetSno: string;
    distanceScore: number;
    stageVectorString: string;
    matchedVectorString: string;
    verificationStatus: string;
    evidenceNotes: string;
  };
  limitationsDisclaimer: string;

  // Temporal Longitudinal Specifics (DAY / WEEK / MONTH)
  temporalObservations?: TemporalObservationSummary[];
  dominantPattern?: string;
  patternPersistence?: number;
  parameterChanges?: string[];
  homeQA?: HomeQASection;
}

export interface MatchedDayDatasetRecord {
  sno: string;
  matchedVector: number[];
  testVectors: [StageVector, StageVector, StageVector];
  distance: number;
  matchType: ConditionMatchStatus;
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string;
  confidence_score: string;
  confidence_level: ConfidenceLevel;
  trend_label: TrendLabel;
  isLabelInconsistent: boolean;
}

export interface HomeQAPayload {
  qaId?: string;
  uid?: string;
  dayAssessmentId?: string;
  responses?: Record<string, any>;
  notes?: string;
  submittedAt?: string;
  status?: 'SUBMITTED' | 'PROCESSED' | 'NOT_AVAILABLE';
}

export interface DayConditionResult {
  success: boolean;
  status: 'COMPLETED' | 'DAY_NOT_ELIGIBLE' | 'NO_ACCEPTABLE_MATCH' | 'UID_MISMATCH_REJECTED' | 'ERROR';
  temporalLevel: 'DAY';
  observationId?: string | null;
  reportId?: string | null;
  observationCount?: number;
  testObservationIds?: string[];
  inputStages?: number[];
  matchedStages?: number[] | null;
  matchedPattern?: string | null;
  matchStatus: ConditionMatchStatus;
  classification?: string | null;
  severity?: SeverityLevel | null;
  severityScore?: number | null;
  confidence?: number;
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
  trend?: TrendLabel | null;
  initialSeverity?: SeverityLevel | null;
  peakSeverity?: SeverityLevel | null;
  finalSeverity?: SeverityLevel | null;
  meanSeverity?: number | null;
  patternPersistence?: number;
  dominantPattern?: string;
  referenceDatasetSno?: number | null;
  distanceScore?: number;
  qaStatus: 'AVAILABLE' | 'Q/A_NOT_AVAILABLE';
  qaData?: any;
  conditionSummary?: string;
  persisted?: {
    observation: any;
    report: any;
  } | null;
  notifications?: DayNotificationPayload[];
  error?: string;
}

export interface DayNotificationPayload {
  notificationId: string;
  reportId: string;
  dayObservationId: string;
  uid: string;
  recipient: 'USER' | 'CARETAKER';
  temporalLevel: 'DAY';
  classification: string;
  severity: string;
  trend: string;
  reportStatus: string;
  timestamp: string;
  delivered: boolean;
}

export interface MatchedWeekDatasetRecord {
  sno: string;
  matchedVector: number[];
  testVectors: StageVector[];
  distance: number;
  matchType: ConditionMatchStatus;
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string;
  confidence_score: string;
  confidence_level: ConfidenceLevel;
  trend_label: TrendLabel;
  isLabelInconsistent: boolean;
}

export interface WeekNotificationPayload {
  notificationId: string;
  reportId: string;
  weekObservationId: string;
  uid: string;
  recipient: 'USER' | 'CARETAKER';
  temporalLevel: 'WEEK';
  classification: string;
  severity: string;
  trend: string;
  reportStatus: string;
  timestamp: string;
  delivered: boolean;
}

export interface WeekConditionResult {
  success: boolean;
  status: 'COMPLETED' | 'WEEK_NOT_ELIGIBLE' | 'NO_ACCEPTABLE_MATCH' | 'UID_MISMATCH_REJECTED' | 'WAITING_FOR_AUTHENTICATION' | 'ERROR';
  temporalLevel: 'WEEK';
  observationId?: string | null;
  reportId?: string | null;
  observationCount?: number;
  dayObservationIds?: string[];
  inputStages?: number[];
  matchedStages?: number[] | null;
  matchedPattern?: string | null;
  matchStatus: ConditionMatchStatus;
  classification?: string | null;
  secondaryTaxonomy?: string;
  severity?: SeverityLevel | null;
  severityScore?: number | null;
  confidence?: number;
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
  trend?: TrendLabel | null;
  initialSeverity?: SeverityLevel | null;
  peakSeverity?: SeverityLevel | null;
  finalSeverity?: SeverityLevel | null;
  meanSeverity?: number | null;
  patternPersistence?: number;
  dominantPattern?: string;
  referenceDatasetSno?: number | null;
  distanceScore?: number;
  conditionSummary?: string;
  persisted?: {
    observation: any;
    report: any;
  } | null;
  notifications?: WeekNotificationPayload[];
  error?: string;
}

export interface MatchedMonthDatasetRecord {
  sno: string;
  matchedVector: number[];
  testVectors: StageVector[];
  distance: number;
  matchType: ConditionMatchStatus;
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string;
  confidence_score: string;
  confidence_level: ConfidenceLevel;
  trend_label: TrendLabel;
  isLabelInconsistent: boolean;
}

export interface MonthNotificationPayload {
  notificationId: string;
  reportId: string;
  monthObservationId: string;
  uid: string;
  recipient: 'USER' | 'CARETAKER';
  temporalLevel: 'MONTH';
  classification: string;
  severity: string;
  trend: string;
  reportStatus: string;
  timestamp: string;
  delivered: boolean;
}

export interface MonthConditionResult {
  success: boolean;
  status: 'COMPLETED' | 'MONTH_NOT_ELIGIBLE' | 'NO_ACCEPTABLE_MATCH' | 'UID_MISMATCH_REJECTED' | 'WAITING_FOR_AUTHENTICATION' | 'ERROR';
  temporalLevel: 'MONTH';
  observationId?: string | null;
  reportId?: string | null;
  observationCount?: number;
  weekObservationIds?: string[];
  inputStages?: number[];
  matchedStages?: number[] | null;
  matchedPattern?: string | null;
  matchStatus: ConditionMatchStatus;
  classification?: string | null;
  secondaryTaxonomy?: string;
  severity?: SeverityLevel | null;
  severityScore?: number | null;
  confidence?: number;
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
  trend?: TrendLabel | null;
  initialSeverity?: SeverityLevel | null;
  peakSeverity?: SeverityLevel | null;
  finalSeverity?: SeverityLevel | null;
  meanSeverity?: number | null;
  patternPersistence?: number;
  dominantPattern?: string;
  referenceDatasetSno?: number | null;
  distanceScore?: number;
  conditionSummary?: string;
  persisted?: {
    observation: any;
    report: any;
  } | null;
  notifications?: MonthNotificationPayload[];
  error?: string;
}

export interface FullPipelineAutomationResult {
  success: boolean;
  uid: string;
  testResult?: any;
  dayResult?: DayConditionResult;
  weekResult?: WeekConditionResult;
  monthResult?: MonthConditionResult;
  reportsGenerated: {
    test?: string;
    day?: string;
    week?: string;
    month?: string;
  };
  notificationsDispatched: Array<DayNotificationPayload | WeekNotificationPayload | MonthNotificationPayload | any>;
  timestamp: string;
  status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
  error?: string;
}

/**
 * Standardized status dictionary for clean UI display
 */
export const CONDITION_STATE_CONFIG: Record<
  ConditionProcessingState,
  { primary: string; secondary: string; footnote: string }
> = {
  INITIALIZING: {
    primary: 'INITIALIZING',
    secondary: 'PREPARING CONDITION PIPELINE',
    footnote: 'PLEASE WAIT',
  },
  RECEIVING_DATA: {
    primary: 'RECEIVING DATA',
    secondary: 'VALIDATING PHYSIOLOGICAL STREAM',
    footnote: 'PLEASE WAIT',
  },
  ANALYZING: {
    primary: 'ANALYZING DATA',
    secondary: 'PROCESSING',
    footnote: 'PLEASE WAIT',
  },
  PROCESSING: {
    primary: 'PROCESSING',
    secondary: 'EVALUATING MULTI-SYSTEM STAGES',
    footnote: 'PLEASE WAIT',
  },
  COMPLETED: {
    primary: 'PROCESSING COMPLETE',
    secondary: 'CONDITION STAGE EVALUATION READY',
    footnote: 'RESULT READY',
  },
  ERROR: {
    primary: 'PIPELINE ERROR',
    secondary: 'DATA TRANSMISSION INTERRUPTED',
    footnote: 'PLEASE CHECK CONNECTION',
  },
};
