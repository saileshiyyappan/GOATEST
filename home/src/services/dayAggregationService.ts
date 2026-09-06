import type { TestRecord } from '../types';
import { getFirebaseAuth } from '../config/firebase';
import { reportDatabaseService } from './reportDatabaseService';

export type DayAggregationStatus = 'DAY_READY' | 'DAY_NOT_READY' | 'UID_MISMATCH_REJECTED';

export interface DayTestObservation {
  observationId: string;
  timestamp: string;
  sessionId: string;
  uid: string;
  stageVector: number[];
  source: TestRecord;
}

export interface DayAggregationInput {
  uid: string;
  date: string;
  dayObservationId: string;
  testObservationIds: string[];
  observations: [DayTestObservation, DayTestObservation, DayTestObservation];
  timestamps: [string, string, string];
  sessionIds: [string, string, string];
  stageVectors: [number[], number[], number[]];
  testVectors: [number[], number[], number[]];
  completionStatus: 'COMPLETED';
}

export interface DayAggregationResult {
  status: DayAggregationStatus;
  uid: string;
  date: string;
  completedTestCount: number;
  input?: DayAggregationInput;
  error?: string;
}

export const localCalendarDate = (timestamp: string | Date): string => {
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const stageVectorFromTest = (test: TestRecord): number[] | null => {
  const raw = test.rawData || {};
  const candidate = raw.rawFeatureArray || raw.conditionResult?.inputVector || raw.stageVector || raw.cmPacket?.parameters?.map((parameter: any) => parameter.compareStage);
  if (!Array.isArray(candidate) || candidate.length !== 11) return null;
  const vector = candidate.map(Number);
  return vector.every((value) => Number.isInteger(value) && value >= 0 && value <= 5) ? vector : null;
};

export function buildDayAggregation(uid: string, date: string, records: TestRecord[]): DayAggregationResult {
  const authenticatedUid = getFirebaseAuth()?.currentUser?.uid;
  if (!authenticatedUid || authenticatedUid !== uid) return { status: 'UID_MISMATCH_REJECTED', uid, date, completedTestCount: 0, error: 'Authenticated UID is required for DAY aggregation.' };
  const eligible = records.filter((record) => record.userId === authenticatedUid && record.status === 'COMPLETED' && localCalendarDate(record.timestamp || record.createdAt) === date)
    .map((record) => ({ record, stageVector: stageVectorFromTest(record) }))
    .filter((item): item is { record: TestRecord; stageVector: number[] } => Boolean(item.stageVector))
    .sort((a, b) => new Date(a.record.timestamp).getTime() - new Date(b.record.timestamp).getTime());
  console.info('[HOME DAY AGGREGATION]', { authenticatedUid, targetDate: date, eligibleTestIds: eligible.map((item) => item.record.testId), eligibleCount: eligible.length });
  if (eligible.length < 3) return { status: 'DAY_NOT_READY', uid: authenticatedUid, date, completedTestCount: eligible.length, error: `DAY requires 3 valid completed TEST observations for ${date}; found ${eligible.length}.` };

  // Existing DAY behavior uses the latest three when more than three exist.
  const selected = eligible.slice(-3);
  const observations = selected.map(({ record, stageVector }) => ({ observationId: record.testId, timestamp: record.timestamp, sessionId: record.sessionId, uid: record.userId, stageVector, source: record })) as [DayTestObservation, DayTestObservation, DayTestObservation];
  const ids = observations.map((observation) => observation.observationId) as [string, string, string];
  const timestamps = observations.map((observation) => observation.timestamp) as [string, string, string];
  const sessionIds = observations.map((observation) => observation.sessionId) as [string, string, string];
  const stageVectors = observations.map((observation) => observation.stageVector) as [number[], number[], number[]];
  const dayObservationId = `day_${authenticatedUid}_${date}_${ids.join('_')}`;
  const input: DayAggregationInput = { uid: authenticatedUid, date, dayObservationId, testObservationIds: ids, observations, timestamps, sessionIds, stageVectors, testVectors: stageVectors, completionStatus: 'COMPLETED' };
  console.info('[HOME DAY AGGREGATION READY]', { authenticatedUid, targetDate: date, testObservationIds: ids, dayObservationId });
  return { status: 'DAY_READY', uid: authenticatedUid, date, completedTestCount: eligible.length, input };
}

export async function getDayAggregationForDate(userId: string, date = localCalendarDate(new Date())): Promise<DayAggregationResult> {
  const authenticatedUid = getFirebaseAuth()?.currentUser?.uid;
  if (!authenticatedUid || authenticatedUid !== userId) return { status: 'UID_MISMATCH_REJECTED', uid: userId, date, completedTestCount: 0, error: 'Authenticated UID is required for DAY aggregation.' };
  const tests = await reportDatabaseService.getCompletedTestsForCalendarDate(authenticatedUid, date);
  return buildDayAggregation(authenticatedUid, date, tests);
}
