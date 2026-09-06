import { getFirebaseAuth } from '../config/firebase';
import { getDayAggregationForDate, localCalendarDate, type DayAggregationInput } from './dayAggregationService';
import { dynamicQaService } from './dynamicQaService';
import type { QaSessionRecord } from '../types';
import { notificationService } from './notificationService';

export type DailyQaGateStatus = 'DAY_NOT_READY' | 'Q/A_REQUIRED' | 'Q/A_COMPLETED' | 'UID_MISMATCH_REJECTED';
export interface DailyQaGateState {
  status: DailyQaGateStatus; uid: string; date: string; dayObservationId?: string; testObservationIds?: string[];
  qaSessionId?: string; qaCompletionStatus?: QaSessionRecord['completionStatus']; qaCompletedAt?: string;
  qaSession?: QaSessionRecord; dayInput?: DayAggregationInput; error?: string;
}

export async function getDailyQaGate(userId: string, date?: string): Promise<DailyQaGateState> {
  const authenticatedUid = getFirebaseAuth()?.currentUser?.uid;
  const targetDate = date || localCalendarDate(new Date());
  if (!authenticatedUid || authenticatedUid !== userId) return { status: 'UID_MISMATCH_REJECTED', uid: userId, date: targetDate, error: 'Authenticated UID is required for the daily Q/A gate.' };
  const day = await getDayAggregationForDate(authenticatedUid, targetDate);
  if (day.status !== 'DAY_READY' || !day.input) return { status: 'DAY_NOT_READY', uid: authenticatedUid, date: targetDate, error: day.error };
  const notifyQaRequired = (qaInput: Parameters<typeof notificationService.createAssessmentNotification>[1]) => {
    void notificationService.createAssessmentNotification(authenticatedUid, qaInput)
      .then(() => notificationService.fanOutAssessmentNotificationToCaretakers(authenticatedUid, qaInput))
      .catch((error) => console.warn('[QA_REQUIRED notification] persistence unavailable:', error));
  };
  let session: QaSessionRecord;
  try {
    session = await dynamicQaService.getOrCreateDailyQaSession({ userId: authenticatedUid, dayId: day.input.dayObservationId, dayDate: targetDate });
  } catch (error) {
    notifyQaRequired({ type: 'QA_REQUIRED', observationId: day.input.dayObservationId, date: targetDate, title: 'Q/A Required', body: "Please complete today's health questions.", metadata: { dayId: day.input.dayObservationId } });
    return { status: 'Q/A_REQUIRED', uid: authenticatedUid, date: targetDate, dayObservationId: day.input.dayObservationId, testObservationIds: day.input.testObservationIds, dayInput: day.input, error: error instanceof Error ? error.message : 'AI Q/A is temporarily unavailable. Please retry.' };
  }
  const completed = session.completionStatus === 'COMPLETED';
  if (!completed) {
    notifyQaRequired({ type: 'QA_REQUIRED', observationId: day.input.dayObservationId, date: targetDate, title: 'Q/A Required', body: "Please complete today's health questions.", metadata: { dayId: day.input.dayObservationId, qaSessionId: session.qaSessionId } });
  }
  const state: DailyQaGateState = { status: completed ? 'Q/A_COMPLETED' : 'Q/A_REQUIRED', uid: authenticatedUid, date: targetDate, dayObservationId: day.input.dayObservationId, testObservationIds: day.input.testObservationIds, qaSessionId: session.qaSessionId, qaCompletionStatus: session.completionStatus, qaCompletedAt: session.completedAt, qaSession: session, dayInput: day.input };
  console.info(completed ? '[DAY Q/A COMPLETE]' : '[DAY Q/A GATE]', state);
  return state;
}
