import { getFirebaseAuth } from '../config/firebase';
import { buildWeekNotEligibleResult, classifyWeekAggregation, type WeekClassificationResult } from '../../../c50/src/services/condition/weekClassificationPipeline';
import { getWeekAggregationForDate } from './weekAggregationService';

/**
 * HOME-owned handoff to PMT-13. Classification is in memory only; this service
 * deliberately does not write Firestore, create reports, or dispatch notifications.
 */
export async function classifyWeekForDate(userId: string, date: string): Promise<WeekClassificationResult> {
  const authUid = getFirebaseAuth()?.currentUser?.uid;
  if (!authUid || authUid !== userId) {
    return buildWeekNotEligibleResult({ uid: userId, weekStart: '', weekEnd: '', status: 'UID_MISMATCH_REJECTED', error: 'Authenticated UID is required for WEEK classification.' });
  }
  const aggregation = await getWeekAggregationForDate(userId, date);
  if (aggregation.status !== 'WEEK_READY' || !aggregation.input) {
    return buildWeekNotEligibleResult({ uid: userId, weekStart: aggregation.weekStart, weekEnd: aggregation.weekEnd, error: aggregation.error || 'WEEK is not ready for classification.' });
  }
  return classifyWeekAggregation(aggregation.input);
}

export { buildWeekNotEligibleResult, classifyWeekAggregation } from '../../../c50/src/services/condition/weekClassificationPipeline';
export type { WeekClassificationResult } from '../../../c50/src/services/condition/weekClassificationPipeline';
