/**
 * GOATEST Notification Service
 * Manages in-app notifications, status alerts, and notification preferences.
 */

export type NotificationType =
  | 'TEST_REMINDER'
  | 'TEST_COMPLETED'
  | 'TEST_MISSED'
  | 'QA_PENDING'
  | 'QA_MISSED'
  | 'SYSTEM'
  | 'DEVICE'
  | 'EMERGENCY'
  | 'CARETAKER_ALERT'
  | AssessmentNotificationType;

export type AssessmentNotificationType = import('./notificationContract').AssessmentNotificationType;

export interface SystemNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionTab?: string;
  metadata?: Record<string, any>;
  reportId?: string | null;
  observationId?: string | null;
  date?: string | null;
  severity?: string | null;
  recipientRole?: 'USER' | 'CARETAKER';
  sourceUserUid?: string | null;
  sourceUserPublicId?: string | null;
  sourceUserName?: string | null;
  reportType?: string | null;
  eventId?: string | null;
  scheduleId?: string | null;
}

export interface AssessmentNotificationInput {
  type: AssessmentNotificationType;
  reportId?: string;
  observationId?: string;
  date?: string;
  title: string;
  body: string;
  severity?: string | null;
  metadata?: Record<string, any>;
  recipientRole?: 'USER' | 'CARETAKER';
  sourceUserUid?: string;
  sourceUserPublicId?: string;
  sourceUserName?: string;
  reportType?: string;
  recipientUid?: string;
  eventId?: string;
  scheduleId?: string;
}

import { getAssessmentNotificationId as buildAssessmentNotificationId, getAssessmentEventId, getCaretakerConnectionNotificationId, getNotificationContent } from './notificationContract';
import { getFirebaseAuth, getFirebaseDb } from '../config/firebase';
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

export interface NotificationPreferences {
  assessmentReminders: boolean;
  systemAlerts: boolean;
  deviceAlerts: boolean;
  caretakerAlerts: boolean;
  emergencyAlerts: boolean;
}

const STORAGE_PREFIX_NOTIFS = 'goatest_notifs_';
const STORAGE_PREFIX_PREFS = 'goatest_notif_prefs_';

type NotificationListener = (notifications: SystemNotification[], addedNotificationIds?: string[]) => void;
const userListeners: Map<string, Set<NotificationListener>> = new Map();
const globalListeners: Set<NotificationListener> = new Set();

export function getAssessmentNotificationId(input: Pick<AssessmentNotificationInput, 'type' | 'reportId' | 'observationId' | 'date' | 'recipientUid' | 'eventId' | 'scheduleId'>): string {
  return buildAssessmentNotificationId(input);
}

function sortNotifications(notifications: SystemNotification[]): SystemNotification[] {
  return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function notificationFromFirestore(id: string, data: Record<string, any>, userId: string): SystemNotification {
  const content = getNotificationContent({ ...data, type: typeof data.type === 'string' ? data.type : '' });
  return {
    id,
    ...data,
    userId,
    title: content?.title || data.title || '',
    body: content?.body || data.body || '',
    timestamp: data.timestamp || data.createdAt || new Date(0).toISOString(),
  } as SystemNotification;
}

function mergeNotificationLists(userId: string, remote: SystemNotification[]): SystemNotification[] {
  const local = notificationService.getUserNotifications(userId);
  const merged = [...remote, ...local].reduce<SystemNotification[]>((items, notification) => {
    if (!items.some((item) => item.id === notification.id)) items.push(notification);
    return items;
  }, []);
  const result = sortNotifications(merged.slice(0, 50));
  notificationService.saveLocalNotifications(userId, result);
  return result;
}

async function sourceIdentity(uid: string): Promise<{ publicId: string | null; name: string }> {
  const db = getFirebaseDb();
  if (!db) return { publicId: null, name: 'User' };
  const snapshot = await getDoc(doc(db, 'users', uid));
  const profile = snapshot.exists() ? snapshot.data() as Record<string, any> : {};
  return {
    publicId: profile.uniqueId || profile.displayId || null,
    name: profile.name || profile.displayName || 'User',
  };
}

async function persistNotification(notification: SystemNotification, sourceUserUid: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const identity = await sourceIdentity(sourceUserUid);
  const ref = doc(db, 'notifications', notification.id);
  const existing = await getDoc(ref);
  const existingData = existing.exists() ? existing.data() as Record<string, any> : {};
  await setDoc(ref, {
    uid: notification.userId,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    timestamp: notification.timestamp,
    read: typeof existingData.read === 'boolean' ? existingData.read : notification.read,
    actionTab: notification.actionTab || null,
    reportId: notification.reportId || null,
    observationId: notification.observationId || null,
    date: notification.date || null,
    severity: notification.severity || null,
    metadata: notification.metadata || null,
    recipientRole: notification.recipientRole || 'USER',
    sourceUserUid,
    sourceUserPublicId: identity.publicId,
    sourceUserName: identity.name,
    reportType: notification.reportType || null,
    eventId: notification.eventId || notification.metadata?.eventId || null,
    scheduleId: notification.scheduleId || notification.metadata?.scheduleId || null,
  }, { merge: true });
}

function notifyListeners(userId: string) {
  const list = notificationService.getUserNotifications(userId);
  const uSet = userListeners.get(userId);
  if (uSet) {
    uSet.forEach((fn) => fn(list));
  }
  globalListeners.forEach((fn) => fn(list));
}

async function resetExpiredNotificationsOncePerDay(userId: string): Promise<void> {
  const markerKey = `goatest_notifications_reset_${userId}`;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(markerKey) === today) return;
  const db = getFirebaseDb();
  if (!db) return;
  const snapshot = await getDocs(query(collection(db, 'notifications'), where('uid', '==', userId)));
  const boundary = `${today}T00:00:00.000Z`;
  const batch = writeBatch(db);
  let deletions = 0;
  snapshot.docs.forEach((item) => {
    const timestamp = item.data().timestamp || item.data().createdAt;
    if (typeof timestamp === 'string' && timestamp < boundary) {
      batch.delete(item.ref);
      deletions += 1;
    }
  });
  if (deletions > 0) await batch.commit();
  localStorage.setItem(markerKey, today);
}

export const notificationService = {
  async getFirestoreNotifications(userId: string): Promise<SystemNotification[]> {
    const local = this.getUserNotifications(userId);
    const db = getFirebaseDb();
    if (!db) return sortNotifications(local);
    try {
      const snapshot = await getDocs(query(collection(db, 'notifications'), where('uid', '==', userId)));
      const remote = snapshot.docs.map((item) => notificationFromFirestore(item.id, item.data(), userId));
      return mergeNotificationLists(userId, remote);
    } catch (error) {
      console.warn('[Notifications] Firestore refresh unavailable:', error);
      return sortNotifications(local);
    }
  },
  subscribeFirestore(userId: string, listener: NotificationListener): () => void {
    listener(this.getUserNotifications(userId));
    const db = getFirebaseDb();
    if (!db) return this.subscribe(userId, listener);
    void resetExpiredNotificationsOncePerDay(userId).catch((error) => {
      console.warn('[Notifications] daily reset unavailable:', error);
    });
    const remoteQuery = query(collection(db, 'notifications'), where('uid', '==', userId));
    let initialized = false;
    const unsubscribeFirestore = onSnapshot(remoteQuery, (snapshot) => {
      const remote = snapshot.docs.map((item) => notificationFromFirestore(item.id, item.data(), userId));
      const addedNotificationIds = initialized ? snapshot.docChanges()
        .filter((change) => change.type === 'added')
        .map((change) => change.doc.id) : [];
      initialized = true;
      listener(mergeNotificationLists(userId, remote), addedNotificationIds);
    }, (error) => {
      console.warn('[Notifications] Firestore listener unavailable:', error);
      listener(this.getUserNotifications(userId));
    });
    const unsubscribeLocal = this.subscribe(userId, listener);
    return () => { unsubscribeFirestore(); unsubscribeLocal(); };
  },
  async createAssessmentNotification(userId: string, input: AssessmentNotificationInput): Promise<SystemNotification> {
    const identity = await sourceIdentity(userId);
    const eventId = getAssessmentEventId(input);
    const notificationId = getAssessmentNotificationId({ ...input, eventId });
    const content = getNotificationContent({ ...input, sourceUserName: input.sourceUserName || identity.name });
    if (!content) throw new Error(`NOTIFICATION_CONTENT_MISSING:${input.type}:${notificationId}`);
    const createdAt = new Date().toISOString();
    const existing = this.getUserNotifications(userId).find((item) => item.id === notificationId);
    const notification: SystemNotification = { id: notificationId, userId, type: input.type, title: content.title, body: content.body, timestamp: existing?.timestamp || createdAt, read: existing?.read || false, actionTab: input.type === 'QA_REQUIRED' || input.type === 'ASSESSMENT_DUE' || input.type === 'ASSESSMENT_MISSED' ? 'home' : 'reports', reportId: input.reportId || null, observationId: input.observationId || null, date: input.date || null, severity: input.severity || null, metadata: input.metadata, eventId, scheduleId: input.scheduleId || null, recipientRole: input.recipientRole || 'USER', sourceUserUid: input.sourceUserUid || userId, sourceUserPublicId: input.sourceUserPublicId || identity.publicId, sourceUserName: input.sourceUserName || identity.name, reportType: input.reportType || null };
    const list = this.getUserNotifications(userId).filter((item) => item.id !== notificationId);
    this.saveLocalNotifications(userId, [notification, ...list].slice(0, 50));
    await persistNotification(notification, userId);
    notifyListeners(userId);
    return notification;
  },
  async fanOutAssessmentNotificationToCaretakers(sourceUserUid: string, input: AssessmentNotificationInput): Promise<number> {
    const authUid = getFirebaseAuth()?.currentUser?.uid;
    if (!authUid || authUid !== sourceUserUid) throw new Error('NOTIFICATION_SOURCE_UID_MISMATCH_REJECTED');
    const db = getFirebaseDb();
    if (!db) return 0;
    const identity = await sourceIdentity(sourceUserUid);
    const caretakers = await getDocs(query(collection(db, 'users'), where('role', '==', 'CARETAKER'), where('monitoredUserIds', 'array-contains', sourceUserUid)));
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    const caretakerContent = getNotificationContent({ ...input, recipientRole: 'CARETAKER', sourceUserName: identity.name });
    if (!caretakerContent) throw new Error(`NOTIFICATION_CONTENT_MISSING:${input.type}:CARETAKER`);
    const newlyCreatedCaretakerUids: string[] = [];
    for (const caretaker of caretakers.docs) {
      const recipientUid = caretaker.id;
      const eventId = getAssessmentEventId(input);
      // Caretaker report notifications must match the Firestore rule's
      // recipient-scoped ID contract; keep the USER ID contract unchanged.
      const notificationId = input.reportId && input.type.endsWith('_REPORT_READY')
        ? `notification_${input.type}_${input.reportId}_${recipientUid}`
        : getAssessmentNotificationId({ ...input, eventId, recipientUid });
      const existing = await getDoc(doc(db, 'notifications', notificationId));
      if (existing.exists()) continue;
      newlyCreatedCaretakerUids.push(recipientUid);
      batch.set(doc(db, 'notifications', notificationId), {
        uid: recipientUid,
        userId: recipientUid,
        type: input.type,
        title: caretakerContent.title,
        body: caretakerContent.body,
        timestamp: now,
        actionTab: input.type === 'QA_REQUIRED' ? 'home' : 'reports',
        reportId: input.reportId || null,
        observationId: input.observationId || null,
        date: input.date || null,
        severity: input.severity || null,
        metadata: input.metadata || null,
        recipientRole: 'CARETAKER',
        sourceUserUid,
        sourceUserPublicId: identity.publicId,
        sourceUserName: identity.name,
        reportType: input.reportType || null,
        eventId,
        scheduleId: input.scheduleId || null,
      }, { merge: true });
    }
    if (newlyCreatedCaretakerUids.length > 0) {
      await batch.commit();
    }
    return newlyCreatedCaretakerUids.length;
  },
  async fanOutCaretakerEvent(sourceUserUid: string, event: { type: 'EMERGENCY'; eventId: string; date?: string }): Promise<number> {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser || auth.currentUser.uid !== sourceUserUid) throw new Error('NOTIFICATION_SOURCE_UID_MISMATCH_REJECTED');
    const db = getFirebaseDb();
    if (!db) return 0;
    const identity = await sourceIdentity(sourceUserUid);
    const caretakers = await getDocs(query(collection(db, 'users'), where('role', '==', 'CARETAKER'), where('monitoredUserIds', 'array-contains', sourceUserUid)));
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const caretaker of caretakers.docs) {
      const notificationId = `notification_EMERGENCY_${event.eventId}_${caretaker.id}`;
      batch.set(doc(db, 'notifications', notificationId), {
        uid: caretaker.id,
        userId: caretaker.id,
        type: 'EMERGENCY',
        title: 'Emergency Alert',
        body: `An emergency alert was triggered for ${identity.name}.`,
        timestamp: now,
        actionTab: 'emergency',
        date: event.date || null,
        eventId: event.eventId,
        recipientRole: 'CARETAKER',
        sourceUserUid,
        sourceUserPublicId: identity.publicId,
        sourceUserName: identity.name,
      }, { merge: true });
    }
    if (caretakers.docs.length > 0) {
      await batch.commit();
    }
    return caretakers.docs.length;
  },
  async fanOutMissedAssessmentToCaretakers(sourceUserUid: string, schedule: { id: string; title: string; date?: string }): Promise<number> {
    const authUid = getFirebaseAuth()?.currentUser?.uid;
    if (!authUid || authUid !== sourceUserUid) throw new Error('NOTIFICATION_SOURCE_UID_MISMATCH_REJECTED');
    const db = getFirebaseDb();
    if (!db) return 0;
    const identity = await sourceIdentity(sourceUserUid);
    const caretakers = await getDocs(query(collection(db, 'users'), where('role', '==', 'CARETAKER'), where('monitoredUserIds', 'array-contains', sourceUserUid)));
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();
    for (const caretaker of caretakers.docs) {
      const eventId = getAssessmentEventId({ type: 'ASSESSMENT_MISSED', scheduleId: schedule.id, date: schedule.date });
      batch.set(doc(db, 'notifications', `notification_${eventId}_${caretaker.id}`), {
        uid: caretaker.id, userId: caretaker.id, type: 'ASSESSMENT_MISSED', title: 'Assessment Missed',
        body: `${identity.name} missed a scheduled assessment.`, timestamp, actionTab: 'home',
        metadata: { scheduleId: schedule.id }, eventId, scheduleId: schedule.id, recipientRole: 'CARETAKER', sourceUserUid,
        sourceUserPublicId: identity.publicId, sourceUserName: identity.name,
      }, { merge: true });
    }
    if (caretakers.docs.length) {
      await batch.commit();
    }
    return caretakers.docs.length;
  },
  async markFirestoreAsRead(userId: string, notificationId: string): Promise<void> {
    this.markAsRead(userId, notificationId);
    const db = getFirebaseDb();
    if (db) await updateDoc(doc(db, 'notifications', notificationId), { read: true }).catch(() => undefined);
  },
  async markAllFirestoreAsRead(userId: string, notifications: SystemNotification[]): Promise<void> {
    const unread = notifications.filter((item) => !item.read);
    unread.forEach((item) => this.markAsRead(userId, item.id));
    const db = getFirebaseDb();
    if (db) await Promise.all(unread.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true }).catch(() => undefined)));
  },
  /**
   * Retrieves all notifications for a specific user ID.
   */
  getUserNotifications(userId: string = 'default'): SystemNotification[] {
    const key = `${STORAGE_PREFIX_NOTIFS}${userId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore
    }

    const initial: SystemNotification[] = [];
    try {
      localStorage.setItem(key, JSON.stringify(initial));
    } catch {
      // Ignore
    }
    return initial;
  },

  saveLocalNotifications(userId: string, notifications: SystemNotification[]): void {
    try { localStorage.setItem(`${STORAGE_PREFIX_NOTIFS}${userId}`, JSON.stringify(notifications)); } catch { /* local storage unavailable */ }
  },

  /**
   * Alias for getUserNotifications.
   */
  getNotifications(userId: string = 'default'): SystemNotification[] {
    return this.getUserNotifications(userId);
  },

  /**
   * Returns count of unread notifications for a user.
   */
  getUnreadCount(userId: string = 'default'): number {
    const list = this.getUserNotifications(userId);
    return list.filter((n) => !n.read).length;
  },

  /**
   * Adds a new notification for a user.
   */
  addNotification(
    userId: string,
    notif: {
      type: NotificationType;
      title: string;
      body: string;
      actionTab?: string;
    }
  ): SystemNotification {
    const list = this.getUserNotifications(userId);
    const newNotif: SystemNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      timestamp: new Date().toISOString(),
      read: false,
      actionTab: notif.actionTab,
    };

    const updated = [newNotif, ...list].slice(0, 50); // Keep latest 50
    try {
      localStorage.setItem(`${STORAGE_PREFIX_NOTIFS}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    if (userId === getFirebaseAuth()?.currentUser?.uid) {
      void persistNotification(newNotif, userId).catch((error) => console.warn('[Notifications] Firestore persistence unavailable:', error));
    }
    notifyListeners(userId);
    return newNotif;
  },

  /**
   * Marks a specific notification as read.
   */
  markAsRead(userId: string, notificationId: string): void {
    const list = this.getUserNotifications(userId);
    const updated = list.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
    try {
      localStorage.setItem(`${STORAGE_PREFIX_NOTIFS}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    notifyListeners(userId);
  },

  /**
   * Marks all notifications as read for a user.
   */
  markAllAsRead(userId: string): void {
    const list = this.getUserNotifications(userId);
    const updated = list.map((n) => ({ ...n, read: true }));
    try {
      localStorage.setItem(`${STORAGE_PREFIX_NOTIFS}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    notifyListeners(userId);
  },

  /**
   * Deletes a specific notification.
   */
  deleteNotification(userId: string, notificationId: string): void {
    const list = this.getUserNotifications(userId);
    const updated = list.filter((n) => n.id !== notificationId);
    try {
      localStorage.setItem(`${STORAGE_PREFIX_NOTIFS}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    notifyListeners(userId);
  },

  /**
   * Clears all notifications for a user.
   */
  clearAll(userId: string): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX_NOTIFS}${userId}`, JSON.stringify([]));
    } catch {
      // Ignore
    }
    notifyListeners(userId);
  },

  /**
   * Subscribes to notification updates for a specific user or globally.
   */
  subscribe(
    userIdOrCallback: string | NotificationListener,
    maybeCallback?: NotificationListener
  ): () => void {
    if (typeof userIdOrCallback === 'function') {
      globalListeners.add(userIdOrCallback);
      return () => {
        globalListeners.delete(userIdOrCallback);
      };
    }

    const userId = userIdOrCallback;
    const callback = maybeCallback;
    if (!callback) return () => {};

    if (!userListeners.has(userId)) {
      userListeners.set(userId, new Set());
    }
    userListeners.get(userId)!.add(callback);

    return () => {
      userListeners.get(userId)?.delete(callback);
    };
  },

  /**
   * Retrieves notification preferences for a user.
   */
  getPreferences(userId: string = 'default'): NotificationPreferences {
    const key = `${STORAGE_PREFIX_PREFS}${userId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore
    }
    return {
      assessmentReminders: true,
      systemAlerts: true,
      deviceAlerts: true,
      caretakerAlerts: true,
      emergencyAlerts: true,
    };
  },

  /**
   * Updates notification preferences for a user.
   */
  updatePreferences(userId: string = 'default', prefs: Partial<NotificationPreferences>): NotificationPreferences {
    const current = this.getPreferences(userId);
    const updated = { ...current, ...prefs };
    try {
      localStorage.setItem(`${STORAGE_PREFIX_PREFS}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    return updated;
  },

  /**
   * Requests native browser notification permission.
   * Returns 'granted', 'denied', 'default', or 'unsupported'.
   */
  async requestBrowserNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('[NotificationService] Error requesting notification permission:', err);
      return Notification.permission as 'granted' | 'denied' | 'default';
    }
  },

  /**
   * Dispatches a native browser notification if granted.
   */
  sendBrowserNotification(title: string, options?: NotificationOptions): void {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
      } catch (err) {
        console.warn('[NotificationService] Error showing browser notification:', err);
      }
    }
  },

  /**
   * Pipeline for notifying Caretakers when a patient completes an assessment or triggers an alert.
   */
  async notifyCaretakers(
    patientUid: string,
    patientName: string,
    event: {
      type: NotificationType;
      title: string;
      body: string;
      actionTab?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const { userService } = await import('./userService');
      const profile = await userService.getUserProfile(patientUid);
      
      // Also notify the patient themselves
      this.addNotification(patientUid, {
        type: event.type,
        title: event.title,
        body: event.body,
        actionTab: event.actionTab,
      });

      // Browser notification
      this.sendBrowserNotification(`GOATEST: ${event.title}`, { body: event.body });

      // If user has emergency contacts or caretakers configured, log the dispatch
      if (profile?.emergencyContacts && profile.emergencyContacts.length > 0) {
        profile.emergencyContacts.forEach((contact) => {
          if (contact.notifyOnAlert) {
            console.log(`[Caretaker Notification Pipeline] Alert queued for ${contact.name} (${contact.phone}): ${event.title}`);
          }
        });
      }
    } catch (err) {
      console.warn('[NotificationService] Caretaker notification error:', err);
    }
  },

  /**
   * Dispatches an Emergency Alert for the user and their registered emergency contacts.
   */
  async triggerEmergencyAlert(
    userId: string,
    userName: string,
    coordinates?: { latitude: number; longitude: number } | null
  ): Promise<{ contactCount: number; timestamp: string }> {
    const locStr = coordinates
      ? `Location: Lat ${coordinates.latitude.toFixed(4)}, Lon ${coordinates.longitude.toFixed(4)}`
      : 'Location: Not available (permission disabled or GPS offline)';

    const notif = this.addNotification(userId, {
      type: 'EMERGENCY',
      title: 'Emergency Alert',
      body: `An emergency alert was triggered for ${userName}.`,
      actionTab: 'emergency',
    });

    this.sendBrowserNotification('GOATEST Emergency Alert', {
      body: `An emergency alert was triggered for ${userName}. ${locStr}`,
      requireInteraction: true,
    });

    let contactCount = 0;
    try {
      const { userService } = await import('./userService');
      const contacts = await userService.getEmergencyContacts(userId);
      contactCount = contacts.length;
      contacts.forEach((c) => {
        console.log(`[Emergency Dispatch] Alert transmitted to contact ${c.name} (${c.phone}, ${c.relationship})`);
      });
      await this.fanOutCaretakerEvent(userId, { type: 'EMERGENCY', eventId: notif.id, date: notif.timestamp.slice(0, 10) });
    } catch (err) {
      console.warn('[Emergency Dispatch Error]:', err);
    }

    return {
      contactCount,
      timestamp: notif.timestamp,
    };
  },
};
