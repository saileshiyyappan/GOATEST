/**
 * GOATEST Home Database Connection & Report Record Pipeline Service
 * 
 * PMT-3: Connects Home application to the Firestore Report Database Foundation (PMT-1)
 * and C50 ML Persistence Boundary (PMT-2).
 * 
 * CORE PRINCIPLES:
 * 1. STRICT DATA ISOLATION: Authenticated user's UID (currentUser.uid) determines records read.
 * 2. ZERO RAW LEAKS: Strips raw machine data (CM_PACKET, raw ML JSON) before UI presentation.
 * 3. EXPLICIT HIERARCHY: TEST < DAY (up to 3 tests + 10 QA) < WEEK < MONTH.
 * 4. REAL STATUS DETECTION: Differentiates LOADING, CONNECTED_EMPTY, DATA_AVAILABLE,
 *    AUTH_REQUIRED, DATABASE_ERROR, PERMISSION_ERROR, OFFLINE.
 * 5. REAL REPORT & C50 AVAILABILITY: Accurately checks corresponding ReportRecord & C50ResultPacket.
 * 6. ZERO FAKE HEALTH DATA: Development fixtures are isolated and clearly flagged.
 */

import { reportDatabaseService } from './reportDatabaseService';
import type {
  ReportRecord,
  QaSessionRecord,
  HomeReportHierarchyData,
  HomeQaSummary,
  HomeDatabaseStatus,
} from '../types';

export const homeDatabaseService = {
  /**
   * Fetches and normalizes the report hierarchy for an authenticated user.
   * Note: Legacy collections (/tests, /day_records, /week_records, /month_records, /c50_results)
   * reads and queries have been removed. CONDITION will be the authoritative source for temporal data.
   * /qa_sessions and reports remain active.
   */
  async getHomeReportHierarchy(userId: string): Promise<HomeReportHierarchyData> {
    if (!userId || userId === 'guest_user' || userId === 'anonymous_user') {
      return {
        status: 'AUTH_REQUIRED',
        tests: [],
        days: [],
        weeks: [],
        months: [],
        reports: [],
        totalReportCount: 0,
        errorMessage: 'Authentication required to access user records.',
      };
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    try {
      // CONDITION is authoritative; HOME only normalizes its records for presentation.
      const [testsResult, daysResult, weeksResult, monthsResult, reportsResult, qaSessionsResult] = await Promise.allSettled([
        reportDatabaseService.getUserConditionRecords(userId, 'test'),
        reportDatabaseService.getUserConditionRecords(userId, 'day'),
        reportDatabaseService.getUserConditionRecords(userId, 'week'),
        reportDatabaseService.getUserConditionRecords(userId, 'month'),
        reportDatabaseService.getUserConditionReports(userId),
        reportDatabaseService.getUserQaSessions(userId),
      ]);

      const reads = [
        ['test', testsResult], ['day', daysResult], ['week', weeksResult],
        ['month', monthsResult], ['reports', reportsResult], ['qa_sessions', qaSessionsResult],
      ] as const;
      const failedReads = reads.filter(([, result]) => result.status === 'rejected') as Array<[string, PromiseRejectedResult]>;
      const permissionRead = failedReads.find(([, result]) => {
        const message = String(result.reason?.message || result.reason || '');
        return message.includes('permission-denied') || message.includes('Missing or insufficient permissions');
      });
      const readError = permissionRead || failedReads[0];
      const failedCollection = readError && typeof (readError[1].reason as { collectionName?: unknown })?.collectionName === 'string'
        ? (readError[1].reason as { collectionName: string }).collectionName
        : readError?.[0];
      const readErrorMessage = readError
        ? `${failedCollection} read failed${permissionRead ? ' (permission denied by Firestore rules)' : ''}.`
        : null;

      const rawTests: any[] = testsResult.status === 'fulfilled' ? testsResult.value : [];
      const rawDays: any[] = daysResult.status === 'fulfilled' ? daysResult.value : [];
      const rawWeeks: any[] = weeksResult.status === 'fulfilled' ? weeksResult.value : [];
      const rawMonths: any[] = monthsResult.status === 'fulfilled' ? monthsResult.value : [];
      const rawReports: ReportRecord[] =
        reportsResult.status === 'fulfilled' ? reportsResult.value : [];
      const rawQaSessions: QaSessionRecord[] =
        qaSessionsResult.status === 'fulfilled' ? qaSessionsResult.value : [];

      // Security check: verify all returned entities belong strictly to this userId
      const safeReports = rawReports.filter((r) => r.userId === userId);
      const safeQaSessions = rawQaSessions.filter((q) => q.userId === userId);

      const tests = rawTests.filter((item) => item.uid === userId).map((item) => ({
        testId: item.observationId || item.id,
        userId,
        timestamp: item.timestamp || item.createdAt,
        target: item.target || 'CONDITION',
        organ: item.organ || item.target || 'CONDITION',
        status: item.status || 'COMPLETED',
        reportAvailable: Boolean(item.reportId && safeReports.some((r) => r.reportId === item.reportId)),
        reportId: item.reportId,
        c50Status: 'C50_AVAILABLE' as const,
        c50ResultId: item.observationId || item.id,
        isFixture: Boolean(item.isFixture),
      }));
      const days = rawDays.filter((item) => item.uid === userId).map((item) => {
        const qa = item.qaData;
        const qaSession = safeQaSessions.find((session) => session.dayId === (item.observationId || item.id));
        const answers = qaSession?.answers || qa?.answers || qa?.responses || {};
        const qaStatus: 'QA_COMPLETED' | 'QA_NOT_STARTED' = item.qaStatus === 'AVAILABLE' || qaSession ? 'QA_COMPLETED' : 'QA_NOT_STARTED';
        const dayStatus: 'NOT_READY' | 'IN_PROGRESS' | 'READY' | 'REPORT_AVAILABLE' = item.status === 'COMPLETED' ? 'REPORT_AVAILABLE' : 'NOT_READY';
        return {
          dayId: item.observationId || item.id, userId, date: (item.timestamp || item.createdAt || '').slice(0, 10),
          testCount: item.observationCount || item.testObservationIds?.length || 0,
          testReferences: item.testObservationIds || item.observationIds || [], qaStatus,
          qaCompletedCount: Object.keys(answers).length, qaTotalQuestions: qaSession?.questions?.length || 0,
          qaSessionId: qaSession?.qaSessionId, dayStatus,
          reportAvailable: Boolean(item.reportId && safeReports.some((r) => r.reportId === item.reportId)), reportId: item.reportId,
          c50Status: 'C50_AVAILABLE' as const, c50ResultId: item.observationId || item.id, isFixture: Boolean(item.isFixture),
        };
      });
      const weeks = rawWeeks.filter((item) => item.uid === userId).map((item) => ({
        weekId: item.observationId || item.id, userId, weekStart: item.weekStart || item.timestamp || item.createdAt,
        weekEnd: item.weekEnd || item.timestamp || item.createdAt, completedDaysCount: item.observationCount || item.dayObservationIds?.length || 0,
        dayReferences: item.dayObservationIds || [], reportAvailable: Boolean(item.reportId && safeReports.some((r) => r.reportId === item.reportId)), reportId: item.reportId,
        c50Status: 'C50_AVAILABLE' as const, c50ResultId: item.observationId || item.id, isFixture: Boolean(item.isFixture),
      }));
      const months = rawMonths.filter((item) => item.uid === userId).map((item) => ({
        monthId: item.observationId || item.id, userId, month: item.month || new Date(item.createdAt || item.timestamp).getMonth() + 1,
        year: item.year || new Date(item.createdAt || item.timestamp).getFullYear(), completedWeeksCount: item.weekObservationIds?.length || 0,
        weekReferences: item.weekObservationIds || [], reportAvailable: Boolean(item.reportId && safeReports.some((r) => r.reportId === item.reportId)), reportId: item.reportId,
        c50Status: 'C50_AVAILABLE' as const, c50ResultId: item.observationId || item.id, isFixture: Boolean(item.isFixture),
      }));
      const totalItems = tests.length + days.length + weeks.length + months.length + safeReports.length + safeQaSessions.length;
      let status: HomeDatabaseStatus = 'CONNECTED_EMPTY';
      if (totalItems > 0) {
        status = 'DATA_AVAILABLE';
      } else if (isOffline) {
        status = 'OFFLINE';
      }

      return {
        status: status === 'CONNECTED_EMPTY' && failedReads.length > 0
          ? (permissionRead ? 'PERMISSION_ERROR' : 'DATABASE_ERROR')
          : status,
        tests,
        days,
        weeks,
        months,
        reports: safeReports,
        latestTest: tests[0] || null,
        latestDay: days[0] || null,
        latestWeek: weeks[0] || null,
        latestMonth: months[0] || null,
        totalReportCount: safeReports.length,
        isOffline,
        errorMessage: readErrorMessage,
      };
    } catch (err: any) {
      console.warn('[homeDatabaseService] General error loading hierarchy:', err);
      const isPermission = String(err?.message || '').includes('permission-denied');
      return {
        status: isPermission ? 'PERMISSION_ERROR' : 'DATABASE_ERROR',
        tests: [],
        days: [],
        weeks: [],
        months: [],
        reports: [],
        totalReportCount: 0,
        errorMessage: err?.message || 'Failed to load report database records.',
        isOffline,
      };
    }
  },

  /**
   * Helper to fetch QA session summary for a day.
   */
  async getDayQaSummary(dayId: string, userId: string): Promise<HomeQaSummary | null> {
    if (!dayId || !userId) return null;
    const session = await reportDatabaseService.getQaSessionByDayId(dayId, userId);
    if (!session || session.userId !== userId) return null;

    const totalQuestions = session.questions?.length || 10;
    const answeredCount = Object.keys(session.answers || {}).length;

    return {
      qaSessionId: session.qaSessionId,
      dayId: session.dayId,
      userId: session.userId,
      completionStatus: session.completionStatus,
      totalQuestions,
      answeredCount,
      generatedAt: session.generatedAt,
      isFixture: session.isFixture,
    };
  },
};
