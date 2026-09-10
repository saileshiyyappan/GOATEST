import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { AssessmentNotificationInput, SystemNotification } from './notificationService';
import { getNotificationContent } from './notificationContract';

const CHANNEL_ID = 'goatest-alerts-v2';
const CHANNEL_NAME = 'GOATEST Alerts';

let initialized = false;
let initialization: Promise<void> | null = null;
const inFlightNotificationIds = new Set<string>();
const PRESENTED_KEY = 'goatest_presented_notification_ids';
const PRESENTED_LIMIT = 200;
const SCHEDULED_IDS_KEY = 'goatest_scheduled_notification_ids';

function isAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function stableId(logicalId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < logicalId.length; index += 1) {
    hash ^= logicalId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483647 || 1;
}

async function ensureInitialized(): Promise<boolean> {
  if (!isAndroid()) return false;
  if (!initialization) {
    initialization = (async () => {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display === 'prompt') await LocalNotifications.requestPermissions();
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: CHANNEL_NAME,
        description: 'GOATEST assessment and safety notifications',
        importance: 5,
        sound: 'default',
        visibility: 0,
        vibration: true,
      });
      await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        if (notification.extra) {
          window.dispatchEvent(new CustomEvent('goatest:native-notification-click', { detail: notification.extra }));
        }
      });
      initialized = true;
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
  return initialized;
}

function destination(input: Pick<AssessmentNotificationInput, 'type'> | { type: string }) {
  if (input.type === 'QA_REQUIRED' || input.type === 'ASSESSMENT_MISSED') return 'home';
  if (input.type === 'CRITICAL' || input.type === 'EMERGENCY') return 'emergency';
  return 'reports';
}

function wasPresented(id: string): boolean {
  try {
    const values = JSON.parse(localStorage.getItem(PRESENTED_KEY) || '[]');
    return Array.isArray(values) && values.includes(id);
  } catch {
    return false;
  }
}

function rememberPresented(id: string): void {
  try {
    const values = JSON.parse(localStorage.getItem(PRESENTED_KEY) || '[]');
    const next = [id, ...(Array.isArray(values) ? values.filter((value) => value !== id) : [])].slice(0, PRESENTED_LIMIT);
    localStorage.setItem(PRESENTED_KEY, JSON.stringify(next));
  } catch {
    console.warn('[AndroidNotification] unable to persist presentation identity:', id);
  }
}

function rememberScheduled(scheduleId: string, ids: number[]): void {
  try {
    const stored = JSON.parse(localStorage.getItem(SCHEDULED_IDS_KEY) || '{}') as Record<string, number[]>;
    stored[scheduleId] = Array.from(new Set(ids));
    localStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(stored));
  } catch {
    console.warn('[AndroidNotification] unable to persist schedule identity:', scheduleId);
  }
}

function scheduledIds(scheduleId: string): number[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SCHEDULED_IDS_KEY) || '{}') as Record<string, number[]>;
    return Array.isArray(stored[scheduleId]) ? stored[scheduleId] : [];
  } catch {
    return [];
  }
}

function forgetScheduled(scheduleId: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem(SCHEDULED_IDS_KEY) || '{}') as Record<string, number[]>;
    delete stored[scheduleId];
    localStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(stored));
  } catch {
    console.warn('[AndroidNotification] unable to clear schedule identity:', scheduleId);
  }
}

async function cancelNativeAssessmentIds(ids: number[]): Promise<void> {
  const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length === 0) return;
  await LocalNotifications.cancel({ notifications: uniqueIds.map((id) => ({ id })) });
}

export const androidNotificationService = {
  async initialize(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (!isAndroid()) return 'unsupported';
    await ensureInitialized();
    return (await LocalNotifications.checkPermissions()).display as 'granted' | 'denied' | 'prompt';
  },
  async scheduleAssessmentDue(input: { id: string; title: string; at: Date; eventId?: string }): Promise<boolean> {
    if (!(await ensureInitialized())) return false;
    const id = stableId(`due:${input.eventId || `${input.id}:${input.at.toISOString().slice(0, 10)}`}`);
    const legacyId = stableId(`due:${input.id}`);
    try { await LocalNotifications.cancel({ notifications: [{ id }, ...(legacyId === id ? [] : [{ id: legacyId }])] }); } catch { /* no pending notification */ }
    await LocalNotifications.schedule({ notifications: [{ id, title: 'Assessment Due', body: `${input.title} is scheduled now.`, channelId: CHANNEL_ID, smallIcon: 'ic_stat_goatest', iconColor: '#0F172A', autoCancel: true, schedule: { at: input.at, allowWhileIdle: true }, extra: { scheduleId: input.id, eventId: input.eventId || `assessment_due_${input.id}_${input.at.toISOString().slice(0, 10)}`, destination: 'home', type: 'ASSESSMENT_DUE' } }] });
    rememberScheduled(`${input.id}:due`, [...scheduledIds(`${input.id}:due`), id]);
    return true;
  },
  async scheduleAssessmentMissed(input: { id: string; title: string; at: Date; eventId?: string }): Promise<boolean> {
    if (!(await ensureInitialized())) return false;
    const id = stableId(`missed:${input.eventId || `${input.id}:${input.at.toISOString().slice(0, 10)}`}`);
    const legacyId = stableId(`missed:${input.id}`);
    try { await LocalNotifications.cancel({ notifications: [{ id }, ...(legacyId === id ? [] : [{ id: legacyId }])] }); } catch { /* no pending notification */ }
    await LocalNotifications.schedule({ notifications: [{ id, title: 'Assessment Missed', body: `You missed your scheduled ${input.title}.`, channelId: CHANNEL_ID, smallIcon: 'ic_stat_goatest', iconColor: '#0F172A', autoCancel: true, schedule: { at: input.at, allowWhileIdle: true }, extra: { scheduleId: input.id, eventId: input.eventId || `assessment_missed_${input.id}_${input.at.toISOString().slice(0, 10)}`, destination: 'home', type: 'ASSESSMENT_MISSED' } }] });
    rememberScheduled(`${input.id}:missed`, [...scheduledIds(`${input.id}:missed`), id]);
    return true;
  },
  async cancelAssessment(input: { id: string }): Promise<void> {
    if (!isAndroid()) return;
    const ids = [
      ...scheduledIds(`${input.id}:due`),
      ...scheduledIds(`${input.id}:missed`),
      stableId(`due:${input.id}`),
      stableId(`missed:${input.id}`),
    ];
    try {
      const pending = await LocalNotifications.getPending();
      pending.notifications.forEach((notification) => {
        if (notification.extra?.scheduleId === input.id && (notification.extra?.type === 'ASSESSMENT_DUE' || notification.extra?.type === 'ASSESSMENT_MISSED')) {
          ids.push(notification.id);
        }
      });
      await cancelNativeAssessmentIds(ids);
      if (ids.length > 0) {
        await LocalNotifications.removeDeliveredNotifications({ notifications: Array.from(new Set(ids)).map((id) => ({ id, title: '', body: '' })) });
      }
    } catch (error) {
      console.warn('[AndroidNotification] assessment cancellation failed:', { scheduleId: input.id, error });
    }
    forgetScheduled(`${input.id}:due`);
    forgetScheduled(`${input.id}:missed`);
  },
  async cancelAssessmentSchedulesExcept(activeScheduleIds: Set<string>): Promise<void> {
    if (!isAndroid()) return;
    const pending = await LocalNotifications.getPending();
    const orphaned = pending.notifications
      .filter((notification) => (notification.extra?.type === 'ASSESSMENT_DUE' || notification.extra?.type === 'ASSESSMENT_MISSED')
        && typeof notification.extra?.scheduleId === 'string'
        && !activeScheduleIds.has(notification.extra.scheduleId))
      .map((notification) => notification.id);
    try {
      const stored = JSON.parse(localStorage.getItem(SCHEDULED_IDS_KEY) || '{}') as Record<string, number[]>;
      Object.entries(stored).forEach(([key, ids]) => {
        const scheduleId = key.replace(/:(due|missed)$/, '');
        if (!activeScheduleIds.has(scheduleId) && Array.isArray(ids)) orphaned.push(...ids);
      });
    } catch (error) {
      console.warn('[AndroidNotification] unable to inspect persisted assessment identities:', error);
    }
    if (orphaned.length > 0) await cancelNativeAssessmentIds(orphaned);
  },
  async clearAssessmentNotificationsBeforeSync(): Promise<void> {
    if (!isAndroid()) return;
    const ids: number[] = [];
    try {
      const pending = await LocalNotifications.getPending();
      pending.notifications.forEach((notification) => {
        if (notification.extra?.type === 'ASSESSMENT_DUE' || notification.extra?.type === 'ASSESSMENT_MISSED') ids.push(notification.id);
      });
      const delivered = await LocalNotifications.getDeliveredNotifications();
      delivered.notifications.forEach((notification) => {
        if (notification.title === 'Assessment Due' || notification.title === 'Assessment Missed') ids.push(notification.id);
      });
      const stored = JSON.parse(localStorage.getItem(SCHEDULED_IDS_KEY) || '{}') as Record<string, number[]>;
      Object.values(stored).forEach((scheduleIds) => {
        if (Array.isArray(scheduleIds)) ids.push(...scheduleIds);
      });
    } catch (error) {
      console.warn('[AndroidNotification] assessment cleanup inspection failed:', error);
    }
    if (ids.length === 0) return;
    try {
      const uniqueIds = Array.from(new Set(ids));
      await cancelNativeAssessmentIds(uniqueIds);
      await LocalNotifications.removeDeliveredNotifications({ notifications: uniqueIds.map((id) => ({ id, title: '', body: '' })) });
      localStorage.removeItem(SCHEDULED_IDS_KEY);
    } catch (error) {
      console.warn('[AndroidNotification] assessment cleanup failed:', error);
    }
  },
  async cancelMissedAssessment(input: { id: string }): Promise<void> {
    if (!isAndroid()) return;
    const ids = scheduledIds(`${input.id}:missed`);
    try { await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }); } catch { /* already cancelled */ }
    forgetScheduled(`${input.id}:missed`);
  },
  async show(notification: Pick<SystemNotification, 'id' | 'title' | 'body' | 'type' | 'reportId' | 'observationId' | 'actionTab' | 'sourceUserUid' | 'userId' | 'timestamp'>): Promise<boolean> {
    if (!(await ensureInitialized())) return false;
    const content = getNotificationContent(notification);
    if (!content) {
      console.warn('[AndroidNotification] skipped notification with missing content:', { id: notification.id, type: notification.type });
      return false;
    }
    if (wasPresented(notification.id)) return false;
    if (inFlightNotificationIds.has(notification.id)) return false;
    inFlightNotificationIds.add(notification.id);
    const id = stableId(notification.id);
    const extra = { type: notification.type, notificationId: notification.id, sourceUserUid: notification.sourceUserUid || null, reportId: notification.reportId || null, observationId: notification.observationId || null, destination: notification.actionTab || destination(notification) };
    const payload: LocalNotificationSchema = { id, title: content.title, body: content.body, channelId: CHANNEL_ID, smallIcon: 'ic_stat_goatest_clean', iconColor: '#0F172A', autoCancel: true, extra };
    try {
      try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* no pending notification is fine */ }
      await LocalNotifications.schedule({ notifications: [payload] });
      rememberPresented(notification.id);
      return true;
    } finally {
      inFlightNotificationIds.delete(notification.id);
    }
  },
  async getPermission() {
    if (!isAndroid()) return 'unsupported' as const;
    return (await LocalNotifications.checkPermissions()).display;
  },
};
