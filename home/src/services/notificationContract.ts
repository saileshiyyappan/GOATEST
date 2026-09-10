import type { NavigationTab } from '../types';

export type AssessmentNotificationType = 'TEST_REPORT_READY' | 'DAY_REPORT_READY' | 'WEEK_REPORT_READY' | 'MONTH_REPORT_READY' | 'HEALTH_RISK' | 'CRITICAL' | 'QA_REQUIRED' | 'ASSESSMENT_DUE' | 'ASSESSMENT_MISSED';

export interface NotificationContentInput {
  type: string;
  recipientRole?: 'USER' | 'CARETAKER';
  sourceUserName?: string | null;
  reportType?: string | null;
  title?: string | null;
  body?: string | null;
}

export interface NotificationContent {
  title: string;
  body: string;
}

const reportLabels: Record<string, string> = {
  TEST_REPORT_READY: 'TEST',
  DAY_REPORT_READY: 'DAY',
  WEEK_REPORT_READY: 'WEEK',
  MONTH_REPORT_READY: 'MONTH',
};

export function getNotificationContent(input: NotificationContentInput): NotificationContent | null {
  const reportLabel = reportLabels[input.type];
  if (reportLabel) {
    const owner = input.recipientRole === 'CARETAKER'
      ? `${input.sourceUserName || 'Your monitored user'}'s`
      : 'Your';
    return {
      title: `${reportLabel} Report Ready`,
      body: `${owner} ${reportLabel} report has been received and is ready to view.`,
    };
  }
  if (input.type === 'QA_REQUIRED') return { title: 'Q/A Required', body: "Please complete today's health questions." };
  if (input.type === 'ASSESSMENT_MISSED') {
    return { title: 'Assessment Missed', body: input.recipientRole === 'CARETAKER'
      ? `${input.sourceUserName || 'Your monitored user'} missed a scheduled assessment.`
      : 'You missed your scheduled assessment.' };
  }
  if (input.type === 'ASSESSMENT_DUE') {
    return {
      title: 'Assessment Due',
      body: input.body || `${input.title || 'Your assessment'} is due now.`,
    };
  }
  if (input.type === 'EMERGENCY' || input.type === 'CRITICAL') {
    return { title: 'Emergency Alert', body: input.recipientRole === 'CARETAKER'
      ? `An emergency alert was triggered by ${input.sourceUserName || 'your monitored user'}.`
      : 'An emergency alert was triggered.' };
  }
  if (input.type === 'SYSTEM' && input.title === 'Caretaker Connection') {
    return { title: 'Caretaker Connection', body: input.body || 'Your caretaker connection was updated.' };
  }
  if (input.type === 'TEST_COMPLETED') return { title: 'TEST Complete', body: 'Your TEST assessment is complete.' };
  if (input.type === 'TEST_REMINDER') return { title: 'TEST Reminder', body: 'Your scheduled TEST assessment is ready.' };
  if (input.type === 'TEST_MISSED') return { title: 'TEST Missed', body: 'Your scheduled TEST assessment was missed.' };
  if (input.type === 'QA_PENDING') return { title: 'Q/A Required', body: "Please complete today's health questions." };
  if (input.type === 'QA_MISSED') return { title: 'Q/A Missed', body: "Today's health questions were missed." };
  if (input.type === 'DEVICE') return { title: 'Device Update', body: 'Your monitoring device status has changed.' };
  if (input.type === 'CARETAKER_ALERT') return { title: 'Caretaker Alert', body: 'A caretaker alert is available to review.' };
  if (input.type === 'SYSTEM') return { title: 'GOATEST Update', body: input.body || 'A new GOATEST update is available.' };
  if (input.title?.trim() && input.body?.trim()) return { title: input.title.trim(), body: input.body.trim() };
  return null;
}

export function getCaretakerConnectionNotificationId(userUid: string, caretakerUid: string, recipientUid: string): string {
  return `notification_SYSTEM_CARETAKER_CONNECTION_${userUid}_${caretakerUid}_${recipientUid}`;
}

export function getAssessmentEventId(input: { type: AssessmentNotificationType; reportId?: string; observationId?: string; scheduleId?: string; date?: string; eventId?: string }): string {
  if (input.eventId) return input.eventId;
  if (input.reportId) return `${input.type === 'TEST_REPORT_READY' ? 'test_report_ready' : input.type.toLowerCase()}_${input.reportId}`;
  if (input.scheduleId || input.observationId) {
    const scheduleId = input.scheduleId || input.observationId;
    const date = input.date || 'unknown-date';
    return `${input.type.toLowerCase()}_${scheduleId}_${date}`;
  }
  const eventId = input.date;
  if (!eventId) throw new Error('NOTIFICATION_EVENT_ID_REQUIRED');
  return `${input.type.toLowerCase()}_${eventId}`;
}

export function getAssessmentNotificationId(input: { type: AssessmentNotificationType; reportId?: string; observationId?: string; scheduleId?: string; date?: string; eventId?: string; recipientUid?: string }): string {
  const eventId = getAssessmentEventId(input);
  return `notification_${eventId}${input.recipientUid ? `_${input.recipientUid}` : ''}`;
}

export function getNotificationDestination(type: AssessmentNotificationType): NavigationTab {
  return type === 'QA_REQUIRED' || type === 'ASSESSMENT_DUE' || type === 'ASSESSMENT_MISSED' ? 'home' : type === 'CRITICAL' ? 'emergency' : 'reports';
}
