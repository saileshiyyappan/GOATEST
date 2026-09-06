import { getAssessmentNotificationId, getNotificationDestination } from './notificationContract';

export function runNotificationContractTests(): void {
  if (getAssessmentNotificationId({ type: 'TEST_REPORT_READY', reportId: 'rep_test_1' }) !== 'notification_TEST_REPORT_READY_rep_test_1') throw new Error('TEST notification ID mismatch');
  if (getAssessmentNotificationId({ type: 'DAY_REPORT_READY', reportId: 'rep_day_1', observationId: 'day_1' }) !== 'notification_DAY_REPORT_READY_rep_day_1') throw new Error('DAY notification did not prioritize report identity');
  if (getAssessmentNotificationId({ type: 'QA_REQUIRED', observationId: 'day_1' }) !== 'notification_QA_REQUIRED_day_1') throw new Error('Q/A notification ID mismatch');
  if (getNotificationDestination('QA_REQUIRED') !== 'home' || getNotificationDestination('TEST_REPORT_READY') !== 'reports' || getNotificationDestination('DAY_REPORT_READY') !== 'reports' || getNotificationDestination('HEALTH_RISK') !== 'reports' || getNotificationDestination('CRITICAL') !== 'emergency') throw new Error('Notification destination matrix mismatch');
  if (getAssessmentNotificationId({ type: 'TEST_REPORT_READY', reportId: 'rep_test_1' }) !== getAssessmentNotificationId({ type: 'TEST_REPORT_READY', reportId: 'rep_test_1' })) throw new Error('Notification ID is not deterministic');
  const caretakerA = getAssessmentNotificationId({ type: 'TEST_REPORT_READY', reportId: 'rep_test_1', recipientUid: 'caretaker_a' });
  const caretakerB = getAssessmentNotificationId({ type: 'TEST_REPORT_READY', reportId: 'rep_test_1', recipientUid: 'caretaker_b' });
  if (caretakerA === caretakerB || caretakerA === getAssessmentNotificationId({ type: 'TEST_REPORT_READY', reportId: 'rep_test_1' })) throw new Error('Recipient-scoped notification IDs collide');
}
