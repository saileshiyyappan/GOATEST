import type { NavigationTab } from '../types';

export type AssessmentNotificationType = 'TEST_REPORT_READY' | 'DAY_REPORT_READY' | 'WEEK_REPORT_READY' | 'MONTH_REPORT_READY' | 'HEALTH_RISK' | 'CRITICAL' | 'QA_REQUIRED' | 'ASSESSMENT_MISSED';

export function getAssessmentNotificationId(input: { type: AssessmentNotificationType; reportId?: string; observationId?: string; date?: string; recipientUid?: string }): string {
  const eventId = input.reportId || input.observationId || input.date;
  if (!eventId) throw new Error('NOTIFICATION_EVENT_ID_REQUIRED');
  return `notification_${input.type}_${eventId}${input.recipientUid ? `_${input.recipientUid}` : ''}`;
}

export function getNotificationDestination(type: AssessmentNotificationType): NavigationTab {
  return type === 'QA_REQUIRED' || type === 'ASSESSMENT_MISSED' ? 'home' : type === 'CRITICAL' ? 'emergency' : 'reports';
}
