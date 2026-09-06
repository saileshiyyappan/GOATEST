import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { getFirebaseAuth } from '../config/firebase';
import { apiUrl } from '../config/api';
import type { AssessmentNotificationInput, SystemNotification } from './notificationService';

const CHANNEL_ID = 'goatest-alerts-v2';
const CHANNEL_NAME = 'GOATEST Alerts';

let initialized = false;
let initialization: Promise<void> | null = null;

async function registerFcmDevice(tokenValue: string): Promise<void> {
  const authUid = getFirebaseAuth()?.currentUser?.uid;
  if (!authUid) {
    console.warn('[FCM] token received before Firebase Auth user was available');
    return;
  }
  try {
    const token = await getFirebaseAuth()!.currentUser!.getIdToken();
    const response = await fetch(apiUrl('/api/devices'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: tokenValue, platform: 'android', deviceId: tokenValue.slice(-24) }),
    });
    console.info('[FCM] device registration', { status: response.status, success: response.ok });
    if (!response.ok) throw new Error(`FCM device registration failed with HTTP ${response.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'API_BASE_URL_NOT_CONFIGURED') {
      console.error('[FCM] API_BASE_URL_NOT_CONFIGURED; native push registration cannot continue.');
    } else {
      console.warn('[FCM] device registration failed', { message });
    }
  }
}

function isAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function isNativeFirebaseConfigured(): boolean {
  if (!isAndroid()) return false;
  try {
    const bridge = (window as Window & {
      GoatestSystemBars?: { isNativeFirebaseConfigured?: () => boolean };
    }).GoatestSystemBars;
    return bridge?.isNativeFirebaseConfigured?.() === true;
  } catch (error) {
    console.warn('[FCM] Native Firebase capability check failed; push registration skipped:', error);
    return false;
  }
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
      if (isNativeFirebaseConfigured()) {
        await PushNotifications.addListener('registration', ({ value }) => {
          void registerFcmDevice(value);
        });
        await PushNotifications.addListener('registrationError', (error) => console.warn('[FCM] registration unavailable:', error));
        await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          if (notification.data) window.dispatchEvent(new CustomEvent('goatest:native-notification-click', { detail: notification.data }));
        });
        const pushPermission = await PushNotifications.checkPermissions();
        if (pushPermission.receive === 'prompt') await PushNotifications.requestPermissions();
        if ((await PushNotifications.checkPermissions()).receive === 'granted') await PushNotifications.register();
      } else {
        console.warn('[FCM] Native Firebase configuration is absent; push registration skipped safely.');
      }
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
  return initialized;
}

function destination(input: Pick<AssessmentNotificationInput, 'type'> | { type: string }) {
  if (input.type === 'QA_REQUIRED') return 'home';
  if (input.type === 'CRITICAL' || input.type === 'EMERGENCY') return 'emergency';
  return 'reports';
}

export const androidNotificationService = {
  async initialize(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (!isAndroid()) return 'unsupported';
    await ensureInitialized();
    return (await LocalNotifications.checkPermissions()).display as 'granted' | 'denied' | 'prompt';
  },
  async scheduleAssessmentDue(input: { id: string; title: string; at: Date }): Promise<boolean> {
    if (!(await ensureInitialized())) return false;
    const id = stableId(`due:${input.id}`);
    try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* no pending notification */ }
    await LocalNotifications.schedule({ notifications: [{ id, title: 'Assessment Due', body: `${input.title} is scheduled now.`, channelId: CHANNEL_ID, smallIcon: 'ic_stat_goatest', iconColor: '#0F172A', autoCancel: true, schedule: { at: input.at, every: 'day', repeats: true, allowWhileIdle: true }, extra: { scheduleId: input.id, destination: 'home', type: 'ASSESSMENT_DUE' } }] });
    return true;
  },
  async scheduleAssessmentMissed(input: { id: string; title: string; at: Date }): Promise<boolean> {
    if (!(await ensureInitialized())) return false;
    const id = stableId(`missed:${input.id}`);
    try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* no pending notification */ }
    await LocalNotifications.schedule({ notifications: [{ id, title: 'Assessment Missed', body: `You missed your scheduled ${input.title}.`, channelId: CHANNEL_ID, smallIcon: 'ic_stat_goatest', iconColor: '#0F172A', autoCancel: true, schedule: { at: input.at, every: 'day', repeats: true, allowWhileIdle: true }, extra: { scheduleId: input.id, destination: 'home', type: 'ASSESSMENT_MISSED' } }] });
    return true;
  },
  async cancelAssessment(input: { id: string }): Promise<void> {
    if (!isAndroid()) return;
    const ids = [stableId(`due:${input.id}`), stableId(`missed:${input.id}`)];
    try { await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }); } catch { /* already cancelled */ }
  },
  async cancelMissedAssessment(input: { id: string }): Promise<void> {
    if (!isAndroid()) return;
    try { await LocalNotifications.cancel({ notifications: [{ id: stableId(`missed:${input.id}`) }] }); } catch { /* already cancelled */ }
  },
  async show(notification: Pick<SystemNotification, 'id' | 'title' | 'body' | 'type' | 'reportId' | 'observationId' | 'actionTab'>): Promise<boolean> {
    if (!(await ensureInitialized())) return false;
    const authUid = getFirebaseAuth()?.currentUser?.uid;
    if (!authUid) return false;
    const id = stableId(notification.id);
    const extra = { type: notification.type, reportId: notification.reportId || null, observationId: notification.observationId || null, destination: notification.actionTab || destination(notification) };
    const payload: LocalNotificationSchema = {
      id,
      title: notification.title,
      body: notification.body,
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_goatest',
      iconColor: '#0F172A',
      autoCancel: true,
      extra,
    };
    try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* no pending notification is fine */ }
    await LocalNotifications.schedule({ notifications: [payload] });
    return true;
  },
  async getPermission() {
    if (!isAndroid()) return 'unsupported' as const;
    return (await LocalNotifications.checkPermissions()).display;
  },
};
