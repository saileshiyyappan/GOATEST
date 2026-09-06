/**
 * GOATEST Home Data Composition Service
 * 
 * Orchestrates real data fetching across schedule, reports, device,
 * notifications, and external health news feeds.
 * Guarantees zero fake health metrics and fault-tolerant progressive loading.
 */

import { deviceService } from './deviceService';
import { scheduleService } from './scheduleService';
import { reportService } from './reportService';
import { notificationService } from './notificationService';
import { healthNewsService } from './healthNewsService';
import { homeDatabaseService } from './homeDatabaseService';
import { classifyWeekForDate } from './weekClassificationService';
import { reportEngineService } from './reportEngineService';
import type {
  HomeDashboardData,
  UserProfile,
  PendingActionItem,
  AssessmentStatusSummary,
  AssessmentScheduleItem,
  ReportItem,
  HealthNewsArticle,
  HomeReportHierarchyData,
} from '../types';

export const homeService = {
  /**
   * Fetch all aggregated home data for the current user.
   */
  async getHomeDashboardData(
    userId: string,
    userProfile: UserProfile | null
  ): Promise<HomeDashboardData> {
    // 1. Device Info (Synchronous/Live)
    const deviceInfo = deviceService.getStatus();

    // 2. Fetch Schedule, Reports, Hierarchy, and Health News in parallel with fault tolerance
    const localToday = (() => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();
    const [scheduleResult, reportsResult, newsResult, hierarchyResult, weekClassificationResult] = await Promise.allSettled([
      scheduleService.getTodaySchedule(userId),
      reportService.getReports(userId),
      healthNewsService.fetchHealthNews(),
      homeDatabaseService.getHomeReportHierarchy(userId),
      classifyWeekForDate(userId, localToday),
    ]);

    const todaySchedule: AssessmentScheduleItem[] =
      scheduleResult.status === 'fulfilled' ? scheduleResult.value : [];

    const allReports: ReportItem[] =
      reportsResult.status === 'fulfilled' ? reportsResult.value : [];
    const reportsError = reportsResult.status === 'rejected'
      ? (reportsResult.reason instanceof Error ? reportsResult.reason.message : 'Could not sync reports from Firebase.')
      : null;
    const recentReports = allReports.slice(0, 5);

    const hierarchyData: HomeReportHierarchyData | undefined =
      hierarchyResult.status === 'fulfilled' ? hierarchyResult.value : undefined;
    const weekClassification = weekClassificationResult.status === 'fulfilled' ? weekClassificationResult.value : undefined;
    if (weekClassification && (weekClassification.status === 'COMPLETED' || weekClassification.status === 'NO_ACCEPTABLE_MATCH')) {
      try {
        await reportEngineService.generateWeekReport(weekClassification.weekId, userId, { weekClassification });
      } catch (error) {
        console.warn('[homeService] WEEK report projection unavailable:', error);
      }
    }

    let newsArticles: HealthNewsArticle[] = [];
    let newsError: string | null = null;
    if (newsResult.status === 'fulfilled') {
      newsArticles = newsResult.value;
    } else {
      newsError = 'Health news feed temporarily unavailable';
    }

    // 3. Compute Assessment Status Summary from real data
    const completedToday = todaySchedule.filter((s) => s.status === 'Completed').length;
    let computedStatus: AssessmentStatusSummary['status'] = 'Not started';
    if (todaySchedule.length > 0) {
      if (completedToday === todaySchedule.length) {
        computedStatus = 'Completed';
      } else if (completedToday > 0) {
        computedStatus = 'In progress';
      } else {
        computedStatus = 'Scheduled';
      }
    }

    const lastCompletedReport = allReports[0];
    const assessmentStatus: AssessmentStatusSummary = {
      status: computedStatus,
      todayScheduledCount: todaySchedule.length,
      todayCompletedCount: completedToday,
      lastCompletedAt: lastCompletedReport ? lastCompletedReport.timestamp : null,
    };

    // 4. Compute Real State-Backed Pending Actions
    const pendingActions: PendingActionItem[] = [];

    if (!deviceInfo.connected) {
      pendingActions.push({
        id: 'act-device',
        title: 'Sensor Hardware Standby',
        description: 'Pair or connect your BLE health sensor prior to testing.',
        actionType: 'CONNECT_DEVICE',
        priority: 'high',
      });
    }

    if (todaySchedule.length === 0) {
      pendingActions.push({
        id: 'act-sched',
        title: 'No Schedule Configured',
        description: 'Add a scheduled assessment time slot for daily monitoring.',
        actionType: 'SCHEDULE_TEST',
        priority: 'normal',
      });
    }

    // Day QA action if today's day record has pending QA
    if (hierarchyData?.latestDay && hierarchyData.latestDay.qaStatus === 'QA_IN_PROGRESS') {
      pendingActions.push({
        id: 'act-qa',
        title: 'Daily QA Session In Progress',
        description: `${hierarchyData.latestDay.qaCompletedCount} of ${hierarchyData.latestDay.qaTotalQuestions} daily questions answered.`,
        actionType: 'START_TEST',
        priority: 'high',
      });
    }

    pendingActions.push({
      id: 'act-phb',
      title: 'PHB Integration Status',
      description: 'Personal Health Baseline web service integration is on standby.',
      actionType: 'CONFIGURE_PHB',
      priority: 'low',
    });

    if (userProfile?.role === 'CARETAKER' && (userProfile.monitoredUserIds?.length || 0) > 0) {
      pendingActions.push({
        id: 'act-caretaker',
        title: 'Review Patient Records',
        description: `Inspect telemetry links for ${userProfile.monitoredUserIds?.length} monitored patients.`,
        actionType: 'CARETAKER_REVIEW',
        priority: 'normal',
        targetTab: 'settings',
      });
    }

    // 5. Notifications
    // A notification permission failure must not discard otherwise valid HOME data.
    // The bell can show its own error state while reports and schedule remain visible.
    let notifications: Awaited<ReturnType<typeof notificationService.getFirestoreNotifications>> = [];
    try {
      notifications = await notificationService.getFirestoreNotifications(userId);
    } catch (error) {
      console.warn('[homeService] Notifications unavailable:', error);
    }
    const notificationCount = notifications.filter((n) => !n.read).length;

    return {
      deviceInfo,
      todaySchedule,
      assessmentStatus,
      recentReports,
      pendingActions,
      notificationCount,
      newsArticles,
      newsError,
      reportsError,
      hierarchyData,
      weekClassification,
    };
  },
};
