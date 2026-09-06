import type { WeekAggregationResult, WeekDayObservation } from '../types';

const DAY_COUNT_REQUIRED = 7;
const DAY_VECTOR_LENGTH = 33;

function dateFromIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Canonical HOME calendar: ISO Monday through Sunday, in the browser's local calendar. */
export function getCalendarWeekRange(date: string): { weekStart: string; weekEnd: string } | null {
  const parsed = dateFromIso(date);
  if (!parsed) return null;
  const day = parsed.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(parsed);
  start.setDate(parsed.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const format = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { weekStart: format(start), weekEnd: format(end) };
}

function isValidDayObservation(uid: string, weekStart: string, weekEnd: string, day: any): boolean {
  const dayId = day.dayObservationId || day.observationId || day.id;
  const date = String(day.date || '').slice(0, 10);
  return day.uid === uid && Boolean(dayId) && Boolean(dateFromIso(date)) && date >= weekStart && date <= weekEnd
    && date <= new Date().toISOString().slice(0, 10) && day.status === 'COMPLETED'
    && Array.isArray(day.inputStages) && day.inputStages.length === DAY_VECTOR_LENGTH
    && day.inputStages.every((stage: unknown) => Number.isInteger(Number(stage)) && Number(stage) >= 0 && Number(stage) <= 5)
    && Array.isArray(day.dayObservationIds || day.testObservationIds)
    && (day.dayObservationIds || day.testObservationIds).length === 3;
}

export function buildWeekAggregation(uid: string, weekStart: string, weekEnd: string, candidates: any[]): WeekAggregationResult {
  if (!uid) return { status: 'UID_MISMATCH_REJECTED', uid, weekStart, weekEnd, validDayCount: 0, error: 'Authenticated UID is required for WEEK aggregation.' };
  const valid = candidates.filter((day) => isValidDayObservation(uid, weekStart, weekEnd, day)).map((day): WeekDayObservation => ({
    dayObservationId: day.dayObservationId || day.observationId || day.id,
    uid: day.uid,
    date: String(day.date).slice(0, 10),
    testObservationIds: [...(day.dayObservationIds || day.testObservationIds)],
    inputStages: day.inputStages.map(Number),
    matchedStages: Array.isArray(day.matchedStages) ? day.matchedStages.map(Number) : null,
    c50Result: day.c50Result || null,
    severity: day.severity || null,
    severityScore: day.severityScore ?? null,
    confidence: day.confidence ?? null,
    confidenceScore: day.confidenceScore ?? null,
    confidenceLevel: day.confidenceLevel || null,
    trend: day.trend || null,
    patternPersistence: day.patternPersistence ?? null,
    dominantPattern: day.dominantPattern || null,
    qaSessionId: day.qaSessionId || day.qaSessionReference || null,
    qaCompletionStatus: day.qaCompletionStatus || (day.qaStatus === 'COMPLETED' ? 'COMPLETED' : null),
    status: day.status,
    source: day,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.dayObservationId.localeCompare(b.dayObservationId));
  const uniqueByDate = new Map<string, WeekDayObservation>();
  const rejectedDayIds: string[] = [];
  for (const day of valid) {
    if (uniqueByDate.has(day.date)) rejectedDayIds.push(day.dayObservationId);
    else uniqueByDate.set(day.date, day);
  }
  const days = Array.from(uniqueByDate.values());
  if (days.length !== DAY_COUNT_REQUIRED) return { status: 'WEEK_NOT_READY', uid, weekStart, weekEnd, validDayCount: days.length, rejectedDayIds, error: `WEEK requires 7 valid DAY observations from ${weekStart} through ${weekEnd}; found ${days.length}.` };
  return { status: 'WEEK_READY', uid, weekStart, weekEnd, validDayCount: days.length, rejectedDayIds, input: { uid, weekStart, weekEnd, weekId: `week_${uid}_${weekStart}_${weekEnd}`, dayObservationIds: days.map((day) => day.dayObservationId), days, weekVector: days.flatMap((day) => day.inputStages) } };
}
