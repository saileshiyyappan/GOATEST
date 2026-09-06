import { buildWeekAggregation, getCalendarWeekRange } from './weekAggregationCore';

const uid = 'week_test_user';
const days = Array.from({ length: 7 }, (_, index) => {
  const date = `2026-08-${String(24 + index).padStart(2, '0')}`;
  return {
    id: `day_${index + 1}`,
    uid,
    date,
    status: 'COMPLETED',
    dayObservationIds: [`test_${index}_1`, `test_${index}_2`, `test_${index}_3`],
    inputStages: Array.from({ length: 33 }, () => index % 6),
    matchedStages: Array.from({ length: 33 }, () => index % 6),
    severity: 'NORMAL',
    confidence: 0.9,
    trend: 'STABLE',
    patternPersistence: 1,
    dominantPattern: 'Known test pattern',
    qaCompletionStatus: 'COMPLETED',
  };
});

export function runWeekAggregationTests(): void {
  const range = getCalendarWeekRange('2026-08-27');
  if (!range || range.weekStart !== '2026-08-24' || range.weekEnd !== '2026-08-30') throw new Error('ISO Monday-Sunday calendar week failed');
  const ready = buildWeekAggregation(uid, range.weekStart, range.weekEnd, days);
  if (ready.status !== 'WEEK_READY' || ready.input?.dayObservationIds.length !== 7 || ready.input.weekVector.length !== 231) throw new Error('Seven valid DAY observations did not produce a complete WEEK input');
  const incomplete = buildWeekAggregation(uid, range.weekStart, range.weekEnd, days.slice(0, 6));
  if (incomplete.status !== 'WEEK_NOT_READY') throw new Error('Incomplete WEEK input was accepted');
  const otherUser = buildWeekAggregation(uid, range.weekStart, range.weekEnd, [...days.slice(0, 6), { ...days[6], uid: 'other_user' }]);
  if (otherUser.status !== 'WEEK_NOT_READY') throw new Error('Cross-user DAY observation was accepted');
}
