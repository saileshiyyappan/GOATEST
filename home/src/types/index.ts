/**
 * GOATEST Universal Type Definitions
 * Health-Monitoring Web Platform
 */

export type UserRole = 'USER' | 'CARETAKER';

export type AuthState = 'AUTH_LOADING' | 'AUTHENTICATED' | 'AUTH_SIGNED_OUT';

export type FirestoreConnectionStatus = 'CONNECTING' | 'ONLINE' | 'OFFLINE' | 'ERROR';

export type ThemeMode = 'DEFAULT' | 'WHITE' | 'DARK';

export interface CustomColorConfig {
  primary: string;
  secondary: string;
  accent: string;
  surface?: string;
  textAccent?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: 'Spouse' | 'Parent' | 'Child' | 'Doctor' | 'Caretaker' | 'Friend' | 'Other' | string;
  isPrimary?: boolean;
  notifyOnAlert?: boolean;
  notes?: string;
  createdAt: string;
}

export type GeolocationPermissionState = 'GRANTED' | 'DENIED' | 'PROMPT' | 'UNSUPPORTED';

export interface LocationSettings {
  sharingEnabled: boolean;
  permissionStatus: GeolocationPermissionState;
  lastKnownCoordinates?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    timestamp: string;
  } | null;
  updatedAt?: string;
}

export interface NotificationSettings {
  assessmentReminders: boolean;
  testCompletedAlerts: boolean;
  reportReadyAlerts: boolean;
  c50ConditionAlerts: boolean;
  caretakerNotifications: boolean;
  emergencyAlerts: boolean;
  browserPermission: 'default' | 'granted' | 'denied' | 'unsupported';
}

export interface MonitoredUser {
  name: string;
  uniqueId: string; // 6-character user ID (e.g. BUN5Y9)
  firebaseUid: string; // actual Firebase UID for security & Firestore queries
  linkedAt?: string;
  relationshipName?: string;
}

/** Canonical caretaker connection returned by the bond and links APIs. */
export interface CaretakerConnection {
  caretakerUid: string;
  caretakerName: string;
  caretakerPublicId: string;
}

export interface UserProfile {
  uid: string; // Firebase UID (authoritative security identifier)
  displayId?: string; // 6-character user ID (e.g. A7K29Q / BUN5Y9)
  uniqueId?: string; // 6-character unique ID (e.g. BUN5Y9)
  name?: string; // User Name (e.g. Sailesh)
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  monitoredUserIds?: string[]; // Caretaker linked user Firebase UIDs (for fast Firestore security rule evaluation)
  monitoredUsers?: MonitoredUser[]; // Full monitored user objects { name, uniqueId, firebaseUid }
  emergencyContacts?: EmergencyContact[]; // Up to 5 emergency contacts
  locationSettings?: LocationSettings;
  notificationSettings?: NotificationSettings;
  createdAt: string;
  updatedAt: string;
  themePreference?: ThemeMode;
  accentColorPreference?: string;
}

export type NavigationTab = 'home' | 'test' | 'shb' | 'condition' | 'medic' | 'reports' | 'ai' | 'settings' | 'profile' | 'phb' | 'emergency';

export type AppStateStatus = 
  | 'INITIALIZING'
  | 'AUTHENTICATING'
  | 'READY'
  | 'NOT_CONFIGURED'
  | 'ERROR'
  | 'OFFLINE';

export type SystemServiceStatus = 
  | 'READY' 
  | 'STANDBY'
  | 'NOT_CONFIGURED' 
  | 'DEVICE_NOT_CONNECTED' 
  | 'PIPELINE_STANDBY' 
  | 'INITIALIZING' 
  | 'OFFLINE'
  | 'ERROR';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export type DeviceConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'NOT_AVAILABLE';

export interface DeviceInfo {
  connected: boolean;
  status: DeviceConnectionStatus;
  deviceName: string | null;
  batteryLevel: number | null;
  lastConnectedAt?: string | null;
}

export interface AssessmentScheduleItem {
  id: string;
  userId: string;
  title: string;
  time: string; // e.g. "08:00 AM" or "02:00 PM"
  scheduledDate: string; // YYYY-MM-DD creation/legacy date
  recurrence?: 'DAILY';
  enabled?: boolean;
  nextScheduledAt?: string;
  missedNotifiedAt?: string | null;
  completionDate?: string | null;
  status: 'Pending' | 'Completed' | 'In Progress' | 'Cancelled';
  organTarget?: string;
  createdAt: string;
}

export interface AssessmentStatusSummary {
  status: 'Not started' | 'Scheduled' | 'In progress' | 'Completed';
  todayScheduledCount: number;
  todayCompletedCount: number;
  lastCompletedAt?: string | null;
}

export interface ReportItem {
  id: string;
  userId: string;
  timestamp: string;
  category: 'Recent Test' | "Today's Report" | 'Weekly Report' | 'Monthly Report' | string;
  summary: string;
  organTested?: string;
  durationSeconds?: number;
  status: 'COMPLETED' | 'ARCHIVED';
  reportType?: 'TEST' | 'DAY' | 'WEEK' | 'MONTH';
  referenceId?: string;
  isFixture?: boolean;
}

// ==========================================
// PMT-1: REPORT DATABASE FOUNDATION CONTRACTS
// ==========================================

export type ReportType = 'TEST' | 'DAY' | 'WEEK' | 'MONTH';
export type ReportStatus = 'DRAFT' | 'COMPLETED' | 'ARCHIVED';
export type RecordProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

/**
 * 1. TEST RECORD CONTRACT
 * Holds original untouched machine/test payload (raw CM_PACKET / DV / IV / session telemetry).
 */
export interface TestRecord {
  testId: string;
  userId: string;
  sessionId: string;
  timestamp: string; // ISO 8601
  target: string; // Target organ or physiological system (e.g. Cardiovascular, Respiratory, Liver, Kidney, Brain)
  organ?: string; // Optional organ alias
  status: 'COMPLETED' | 'PENDING' | 'IN_PROGRESS' | 'FAILED';
  source: 'SHB' | 'M_BAND' | 'DEV_FIXTURE' | string;
  rawData: {
    description?: string;
    isDevelopmentFixture?: boolean;
    cmPacket?: Record<string, any>;
    sessionMetrics?: Record<string, any>;
    rawFeatureArray?: number[];
    [key: string]: any;
  };
  reportReference?: string | null;
  isFixture?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 2. DAY RECORD CONTRACT
 * Aggregates 3 completed tests + 10 daily Q/A questions.
 * Holds raw condition input, raw C50 ML input, and raw C50 ML output.
 */
export interface DayRecord {
  dayId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  testReferences: string[]; // Array of testId references (3 completed tests required in full day workflow)
  qaSessionReference?: string | null; // References qaSessionId
  rawConditionInput?: {
    numericalFeatures?: Record<string, number>;
    deviationFeatures?: Record<string, number>;
    stageValues?: Record<string, any>;
    longitudinalValues?: Record<string, any>;
    sourceReferences?: string[];
    isDevelopmentFixture?: boolean;
    description?: string;
    [key: string]: any;
  } | null;
  rawMLInput?: {
    exactInputPacket?: Record<string, any>;
    featureVector?: number[];
    modelVersion?: string;
    isDevelopmentFixture?: boolean;
    description?: string;
    [key: string]: any;
  } | null;
  rawMLOutput?: {
    exactOutputPacket?: Record<string, any>;
    predictionValues?: Record<string, any>;
    scores?: Record<string, any>;
    stageValues?: Record<string, any>;
    isDevelopmentFixture?: boolean;
    description?: string;
    [key: string]: any;
  } | null;
  readableReportReference?: string | null; // References reportId
  status: RecordProcessStatus;
  isFixture?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 3. WEEK RECORD CONTRACT
 * Aggregates days and provides longitudinal information.
 */
export interface WeekRecord {
  weekId: string;
  userId: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  dayReferences: string[]; // Array of dayId references
  rawMLInput?: {
    exactInputPacket?: Record<string, any>;
    isDevelopmentFixture?: boolean;
    description?: string;
    [key: string]: any;
  } | null;
  rawMLOutput?: {
    exactOutputPacket?: Record<string, any>;
    predictionValues?: Record<string, any>;
    isDevelopmentFixture?: boolean;
    description?: string;
    [key: string]: any;
  } | null;
  readableReportReference?: string | null; // References reportId
  status: RecordProcessStatus;
  isFixture?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** PMT-12: validated HOME input for the existing C50 WEEK consumer. */
export interface WeekDayObservation {
  dayObservationId: string;
  uid: string;
  date: string;
  testObservationIds: string[];
  inputStages: number[];
  matchedStages: number[] | null;
  c50Result?: Record<string, any> | null;
  severity?: string | null;
  severityScore?: number | null;
  confidence?: number | null;
  confidenceScore?: number | null;
  confidenceLevel?: string | null;
  trend?: string | null;
  patternPersistence?: number | null;
  dominantPattern?: string | null;
  qaSessionId?: string | null;
  qaCompletionStatus?: string | null;
  status: string;
  source: Record<string, any>;
}

export interface WeekAggregationInput {
  uid: string;
  weekStart: string;
  weekEnd: string;
  weekId: string;
  dayObservationIds: string[];
  days: WeekDayObservation[];
  weekVector: number[];
}

export type WeekAggregationStatus = 'WEEK_READY' | 'WEEK_NOT_READY' | 'UID_MISMATCH_REJECTED';

export interface WeekAggregationResult {
  status: WeekAggregationStatus;
  uid: string;
  weekStart: string;
  weekEnd: string;
  validDayCount: number;
  input?: WeekAggregationInput;
  rejectedDayIds?: string[];
  error?: string;
}

/**
 * 4. MONTH RECORD CONTRACT
 * Aggregates weeks for broader longitudinal trend history.
 */
export interface MonthRecord {
  monthId: string;
  userId: string;
  month: number; // 1 - 12
  year: number; // e.g. 2026
  weekReferences: string[]; // Array of weekId references
  rawMLInput?: {
    exactInputPacket?: Record<string, any>;
    isDevelopmentFixture?: boolean;
    description?: string;
    [key: string]: any;
  } | null;
  rawMLOutput?: {
    exactOutputPacket?: Record<string, any>;
    predictionValues?: Record<string, any>;
    isDevelopmentFixture?: boolean;
    description?: string;
    [key: string]: any;
  } | null;
  readableReportReference?: string | null; // References reportId
  status: RecordProcessStatus;
  isFixture?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 5. READABLE REPORT CONTRACT
 * Human-readable representation derived from raw records for Home / Report Home.
 * Points back immutably to original raw source.
 */
export interface ReportRecord {
  reportId: string;
  userId: string;
  sessionId?: string;
  target?: string;
  reportType: ReportType; // 'TEST' | 'DAY' | 'WEEK' | 'MONTH'
  referenceId: string; // testId | dayId | weekId | monthId
  title: string;
  generatedAt: string; // ISO 8601
  status: ReportStatus;
  rawSourceReference: {
    collectionName: 'tests' | 'day_records' | 'week_records' | 'month_records' | string;
    documentId: string;
  } | string;
  readableContent: {
    summary: string;
    observations?: string[];
    sections?: Array<{
      heading: string;
      body: string;
      bulletPoints?: string[];
    }>;
    organTested?: string;
    metricsSummary?: Record<string, any>;
  };
  visualizationData?: ReportVisualizationData & {
    tables?: Array<{
      title: string;
      headers: string[];
      rows: Array<Array<string | number>>;
    }>;
  };
  modelVersion?: string;
  isFixture?: boolean;
  createdAt: string;
  updatedAt: string;
  date?: string;
  dayObservationId?: string;
  qaSessionId?: string;
  qaCompletionStatus?: 'COMPLETED';
  qaCompletedAt?: string;
  testObservationIds?: string[];
  c50Result?: any;
  trajectoryResult?: any;
  /** Common report metadata; report-type-specific fields remain in metricsSummary. */
  assessmentDate?: string;
  periodStart?: string;
  periodEnd?: string;
  c50Evidence?: import('../services/conditionReportContract').UnifiedC50Evidence;
  provenance?: import('../services/conditionReportContract').UnifiedReportProvenance;
  technicalAudit?: Record<string, any>;
  healthCareGuidance?: string | null;
}

/**
 * 6. QA SESSION CONTRACT
 * Holds daily 10-question session belonging to DAY record.
 */
export interface QaQuestionItem {
  questionId: string;
  semanticCategory?: string;
  question: string;
  options: string[];
  selectedAnswer?: string | number | null;
  expectedAnswer?: string | number | null;
  feedback?: string | null;
  organ?: string;
  topic?: string;
  timestamp?: string;
}

export interface QaSessionRecord {
  qaSessionId: string;
  userId: string;
  dayId: string;
  generatedAt: string;
  questions: QaQuestionItem[];
  answers: Record<string, string | number>;
  completionStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: string;
  isFixture?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HealthNewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
}

export interface PendingActionItem {
  id: string;
  title: string;
  description: string;
  actionType: 'CONNECT_DEVICE' | 'CONFIGURE_PHB' | 'SCHEDULE_TEST' | 'START_TEST' | 'VIEW_REPORT' | 'CARETAKER_REVIEW';
  priority: 'high' | 'normal' | 'low';
  targetTab?: NavigationTab;
}

export interface HomeDashboardData {
  deviceInfo: DeviceInfo;
  todaySchedule: AssessmentScheduleItem[];
  assessmentStatus: AssessmentStatusSummary;
  recentReports: ReportItem[];
  pendingActions: PendingActionItem[];
  notificationCount: number;
  newsArticles: HealthNewsArticle[];
  newsError?: string | null;
  reportsError?: string | null;
  hierarchyData?: HomeReportHierarchyData;
  /** In-memory PMT-13 result; never a persisted/report/notification source. */
  weekClassification?: import('../../../c50/src/services/condition/weekClassificationPipeline').WeekClassificationResult;
}

// ==========================================
// PMT-2: C50 ML INTEGRATION CONTRACTS
// ==========================================
export type {
  MilestoneType,
  C50ServiceState,
  C50ResultStatus,
  CmPacketInput,
  CmParameterComparison,
  C50DeviationFeature,
  C50StageFeature,
  C50SourceMetadata,
  C50InputPacket,
  C50ResultPacket,
  C50EndpointStatus,
} from '../services/c50/c50Packet';

// ==========================================
// PMT-3: HOME DATABASE & REPORT RECORD CONTRACTS
// ==========================================
export type HomeDatabaseStatus =
  | 'LOADING'
  | 'CONNECTED_EMPTY'
  | 'DATA_AVAILABLE'
  | 'AUTH_REQUIRED'
  | 'DATABASE_ERROR'
  | 'PERMISSION_ERROR'
  | 'OFFLINE';

export type DayStatus =
  | 'NOT_READY'
  | 'IN_PROGRESS'
  | 'READY'
  | 'REPORT_AVAILABLE';

export type QaStatus =
  | 'QA_NOT_STARTED'
  | 'QA_IN_PROGRESS'
  | 'QA_COMPLETED';

export type C50AvailabilityStatus =
  | 'C50_NOT_AVAILABLE'
  | 'C50_STANDBY'
  | 'C50_PROCESSING'
  | 'C50_AVAILABLE'
  | 'C50_ERROR';

export interface HomeTestSummary {
  testId: string;
  userId: string;
  timestamp: string;
  target: string;
  organ: string;
  status: string;
  reportAvailable: boolean;
  reportId?: string;
  c50Status: C50AvailabilityStatus;
  c50ResultId?: string;
  isFixture?: boolean;
}

export interface HomeDaySummary {
  dayId: string;
  userId: string;
  date: string;
  testCount: number;
  testReferences: string[];
  qaStatus: QaStatus;
  qaCompletedCount: number;
  qaTotalQuestions: number;
  qaSessionId?: string;
  dayStatus: DayStatus;
  reportAvailable: boolean;
  reportId?: string;
  c50Status: C50AvailabilityStatus;
  c50ResultId?: string;
  isFixture?: boolean;
}

export interface HomeWeekSummary {
  weekId: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  completedDaysCount: number;
  dayReferences: string[];
  reportAvailable: boolean;
  reportId?: string;
  c50Status: C50AvailabilityStatus;
  c50ResultId?: string;
  isFixture?: boolean;
}

export interface HomeMonthSummary {
  monthId: string;
  userId: string;
  month: number;
  year: number;
  completedWeeksCount: number;
  weekReferences: string[];
  reportAvailable: boolean;
  reportId?: string;
  c50Status: C50AvailabilityStatus;
  c50ResultId?: string;
  isFixture?: boolean;
}

export interface HomeQaSummary {
  qaSessionId: string;
  dayId: string;
  userId: string;
  completionStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  totalQuestions: number;
  answeredCount: number;
  generatedAt: string;
  isFixture?: boolean;
}

export interface HomeReportHierarchyData {
  status: HomeDatabaseStatus;
  tests: HomeTestSummary[];
  days: HomeDaySummary[];
  weeks: HomeWeekSummary[];
  months: HomeMonthSummary[];
  reports: ReportRecord[];
  latestDay?: HomeDaySummary | null;
  latestTest?: HomeTestSummary | null;
  latestWeek?: HomeWeekSummary | null;
  latestMonth?: HomeMonthSummary | null;
  totalReportCount: number;
  errorMessage?: string | null;
  isOffline?: boolean;
}

// ==========================================
// PMT-4: READABLE REPORT ENGINE & VISUALIZATION CONTRACTS
// ==========================================

export type ReportGenerationStatus =
  | 'REPORT_PENDING'
  | 'REPORT_GENERATING'
  | 'REPORT_AVAILABLE'
  | 'REPORT_ERROR';

/**
 * Adapter model mapping raw C50_RESULT_PACKET to human readable summary
 */
export interface ReportSummaryModel {
  isAvailable: boolean;
  status: 'SUCCESS' | 'ML_NOT_CONFIGURED' | 'FAILED' | 'INVALID_INPUT' | 'UNAVAILABLE';
  rawLabel: string | null;
  displayLabel: string; // e.g. "Normal", "Cardiac Stress" (or "C50 result not available")
  confidence: number | null; // 0.0 - 1.0 (or null)
  severity?: string | null;
  features?: Record<string, any> | null;
  modelVersion: string;
  timestamp: string;
  description?: string;
  classificationMetadata?: Record<string, any>;
}

export interface VisualizationComparisonItem {
  parameter: string;
  baseline: number | string | null;
  currentValue: number | string | null;
  deviation?: number | null;
  absDeviationDistance?: number | null;
  direction?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | string | null;
  stage?: string | number | null;
  unit?: string;
}

export interface VisualizationDeviationItem {
  parameter: string;
  deviationPercent: number | null;
  direction: string | null;
  stage: string | number | null;
}

export interface VisualizationTrendItem {
  timestamp: string;
  label: string;
  value?: number | null;
  score?: number | null;
  stage?: string | number | null;
  trend?: 'IMPROVING' | 'STABLE' | 'ELEVATED' | string | null;
  organ?: string;
}

export interface VisualizationStageItem {
  stage: string | number;
  count: number;
  percentage: number;
  label: string;
}

export interface ReportVisualizationData {
  hasEnoughData?: boolean;
  comparisonData?: VisualizationComparisonItem[];
  deviationData?: VisualizationDeviationItem[];
  trendData?: VisualizationTrendItem[];
  stageDistribution?: VisualizationStageItem[];
  charts?: Array<{
    type: 'line' | 'bar' | 'radar' | 'area';
    title: string;
    dataPoints: Array<Record<string, any>>;
  }>;
}
