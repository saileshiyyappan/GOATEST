import { getFirebaseAuth } from '../config/firebase';
import { reportDatabaseService } from './reportDatabaseService';
import { buildWeekAggregation, getCalendarWeekRange } from './weekAggregationCore';

export { buildWeekAggregation, getCalendarWeekRange } from './weekAggregationCore';

export async function getWeekAggregationForDate(userId: string, date: string) {
  const authUid = getFirebaseAuth()?.currentUser?.uid;
  const range = getCalendarWeekRange(date);
  if (!range) return { status: 'WEEK_NOT_READY' as const, uid: userId, weekStart: '', weekEnd: '', validDayCount: 0, error: 'A valid calendar date is required.' };
  if (!authUid || authUid !== userId) return { status: 'UID_MISMATCH_REJECTED' as const, uid: userId, ...range, validDayCount: 0, error: 'Authenticated UID is required for WEEK aggregation.' };
  const candidates = await reportDatabaseService.getUserConditionRecords(authUid, 'day');
  return buildWeekAggregation(authUid, range.weekStart, range.weekEnd, candidates);
}
