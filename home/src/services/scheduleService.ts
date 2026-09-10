/**
 * GOATEST Schedule Service
 * 
 * Manages daily assessment schedules in Firestore database.
 * ZERO fake or fabricated scheduled items.
 */

import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';
import { collection, query, where, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { validateFirestoreReadAuth, handleFirestoreReadError } from './firestoreAuthGuard';
import type { AssessmentScheduleItem } from '../types';
import { androidNotificationService } from './androidNotificationService';
import { notificationService } from './notificationService';
import { getAssessmentEventId } from './notificationContract';

const LOCAL_STORAGE_KEY_PREFIX = 'goatest_schedule_';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeDailyStatus(item: AssessmentScheduleItem, date = getTodayString()): AssessmentScheduleItem {
  return item.completionDate === date ? item : { ...item, status: item.status === 'Cancelled' ? 'Cancelled' : 'Pending' };
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (match[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
  return { hour, minute: Number(match[2]) };
}

function nextOccurrence(item: AssessmentScheduleItem, from = new Date()): Date | null {
  const parsed = parseTime(item.time);
  if (!parsed || item.enabled === false) return null;
  const occurrence = new Date(from);
  if (item.scheduledDate && item.recurrence !== 'DAILY') {
    const [year, month, day] = item.scheduledDate.split('-').map(Number);
    if (year && month && day) occurrence.setFullYear(year, month - 1, day);
  }
  occurrence.setHours(parsed.hour, parsed.minute, 0, 0);
  if (occurrence.getTime() <= from.getTime()) occurrence.setDate(occurrence.getDate() + 1);
  return occurrence;
}

async function syncNativeSchedule(item: AssessmentScheduleItem): Promise<void> {
  if (item.status === 'Completed' && item.completionDate === getTodayString()) {
    await androidNotificationService.cancelAssessment({ id: item.id });
    return;
  }
  if (item.missedNotifiedAt?.slice(0, 10) === getTodayString()) {
    await androidNotificationService.cancelAssessment({ id: item.id });
    return;
  }
  // A prior app version could have left a missed alarm behind. Missed is
  // emitted by reconciliation only after the completion window expires.
  await androidNotificationService.cancelMissedAssessment({ id: item.id });
  const from = item.status === 'Completed' && item.completionDate === getTodayString()
    ? new Date(Date.now() + 24 * 60 * 60 * 1000)
    : new Date();
  const due = nextOccurrence(item, from);
  if (!due) return;
  const date = due.toISOString().slice(0, 10);
  await androidNotificationService.scheduleAssessmentDue({ id: item.id, title: item.title, at: due, eventId: getAssessmentEventId({ type: 'ASSESSMENT_DUE', scheduleId: item.id, date }) });
  // Missed is a lifecycle transition, not a second alarm scheduled at startup.
}

function getValidAuthUid(): string | null {
  try {
    const auth = getFirebaseAuth();
    return auth?.currentUser?.uid || null;
  } catch {
    return null;
  }
}

function getCanonicalScheduleUserId(requestUserId?: string | null): string | null {
  const authUid = getValidAuthUid();
  if (!authUid) return requestUserId || null;
  if (!requestUserId || requestUserId === 'guest_user' || requestUserId.startsWith('guest_')) {
    return authUid;
  }
  if (requestUserId !== authUid) {
    console.warn('[Schedule] Replaced stale request userId with authenticated Firestore UID.', {
      requestUserId,
      authUid,
    });
  }
  return authUid;
}

export const scheduleService = {
  /**
   * Fetch today's real assessment schedule for the authenticated user from Firestore.
   */
  async getTodaySchedule(userId: string): Promise<AssessmentScheduleItem[]> {
    const effectiveUserId = getCanonicalScheduleUserId(userId);
    if (!effectiveUserId) return [];

    const today = getTodayString();
    const authCheck = validateFirestoreReadAuth('schedules', effectiveUserId, 'userId');
    const db = getFirebaseDb();

    // 1. If Firestore is initialized and authenticated, fetch from Firestore
    if (db && authCheck.allowed) {
      try {
        const schedulesRef = collection(db, 'schedules');
        const q = query(
          schedulesRef,
          where('userId', '==', effectiveUserId)
        );
        const snapshot = await getDocs(q);

        const items: AssessmentScheduleItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as Omit<AssessmentScheduleItem, 'id'>) });
        });
        // A successful empty query is authoritative; never resurrect deleted local data.
        return items.filter((item) => item.enabled !== false && (item.recurrence === 'DAILY' || item.scheduledDate === today)).map((item) => normalizeDailyStatus(item, today)).sort((a, b) => (parseTime(a.time)?.hour || 0) * 60 + (parseTime(a.time)?.minute || 0) - ((parseTime(b.time)?.hour || 0) * 60 + (parseTime(b.time)?.minute || 0)));
      } catch (err) {
        handleFirestoreReadError(err, 'schedules', effectiveUserId);
      }
    }

    // 2. Safe local store fallback (for offline or local session without inventing data)
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${effectiveUserId}`);
      if (stored) {
        const parsed: AssessmentScheduleItem[] = JSON.parse(stored);
        return parsed.filter((item) => item.enabled !== false && (item.recurrence === 'DAILY' || item.scheduledDate === today)).map((item) => normalizeDailyStatus(item, today));
      }
    } catch {
      // ignore JSON parse error
    }

    return [];
  },

  /**
   * Schedule a new assessment for the user with optional custom scheduledDate.
   */
  async createScheduleItem(
    userId: string,
    item: { title: string; time: string; organTarget?: string; scheduledDate?: string }
  ): Promise<AssessmentScheduleItem> {
    const authUid = getCanonicalScheduleUserId(userId);
    const effectiveUserId = authUid || userId;
    const scheduledDate = item.scheduledDate || getTodayString();
    const newItem: AssessmentScheduleItem = {
      id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: effectiveUserId,
      title: item.title,
      time: item.time,
      scheduledDate,
      recurrence: 'DAILY',
      enabled: true,
      nextScheduledAt: null,
      missedNotifiedAt: null,
      status: 'Pending',
      organTarget: item.organTarget || 'Full Assessment',
      createdAt: new Date().toISOString(),
    };

    const db = getFirebaseDb();
    if (db && authUid && effectiveUserId !== 'guest_user') {
      try {
        await setDoc(doc(db, 'schedules', newItem.id), newItem);
      } catch (err) {
        console.warn('Could not write schedule to Firestore:', err);
      }
    }

    await syncNativeSchedule(newItem).catch((error) => console.warn('[Schedule] Native schedule unavailable:', error));

    // Update local cache
    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${effectiveUserId}`;
      const stored = localStorage.getItem(key);
      const list: AssessmentScheduleItem[] = stored ? JSON.parse(stored) : [];
      list.push(newItem);
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // ignore
    }

    return newItem;
  },

  /**
   * Fetch all assessment schedules for a user.
   */
  async getAllSchedules(userId: string): Promise<AssessmentScheduleItem[]> {
    const effectiveUserId = getCanonicalScheduleUserId(userId);
    if (!effectiveUserId) return [];

    const authCheck = validateFirestoreReadAuth('schedules', effectiveUserId, 'userId');
    const db = getFirebaseDb();
    if (db && authCheck.allowed) {
      try {
        const schedulesRef = collection(db, 'schedules');
        const q = query(schedulesRef, where('userId', '==', effectiveUserId));
        const snapshot = await getDocs(q);

        const items: AssessmentScheduleItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as Omit<AssessmentScheduleItem, 'id'>) });
        });
        return items.filter((item) => item.enabled !== false).sort((a, b) => a.time.localeCompare(b.time));
      } catch (err) {
        handleFirestoreReadError(err, 'schedules', effectiveUserId);
      }
    }

    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${effectiveUserId}`);
      if (stored) {
        const parsed: AssessmentScheduleItem[] = JSON.parse(stored);
        return parsed.filter((item) => item.enabled !== false).sort((a, b) => a.time.localeCompare(b.time));
      }
    } catch {
      // ignore
    }

    return [];
  },

  /**
   * Deletes a scheduled assessment item.
   */
  async deleteScheduleItem(userId: string, scheduleId: string): Promise<void> {
    if (!scheduleId) return;

    const authUid = getCanonicalScheduleUserId(userId);
    if (!authUid) {
      console.error('DELETE_SCHEDULE_FIRESTORE_ERROR', { code: 'SCHEDULE_DELETE_AUTHORIZATION_FAILED', uid: null, scheduleId, requestUserId: userId });
      throw new Error('SCHEDULE_DELETE_AUTHORIZATION_FAILED');
    }

    const db = getFirebaseDb();
    if (db) {
      const scheduleRef = doc(db, 'schedules', scheduleId);
      console.info('DELETE_SCHEDULE_START', {
        uid: authUid,
        requestedUserId: userId,
        scheduleId,
        firestorePath: `schedules/${scheduleId}`,
      });
      try {
        const snapshot = await getDoc(scheduleRef);
        const documentOwnerUid = snapshot.exists() ? (snapshot.data()?.userId as string | undefined) || authUid : authUid;
        if (documentOwnerUid !== authUid) {
          console.error('DELETE_SCHEDULE_FIRESTORE_ERROR', {
            code: 'SCHEDULE_DELETE_AUTHORIZATION_FAILED',
            uid: authUid,
            requestedUserId: userId,
            scheduleId,
            documentOwnerUid,
            firestorePath: `schedules/${scheduleId}`,
          });
          throw new Error('SCHEDULE_DELETE_AUTHORIZATION_FAILED');
        }

        if (!snapshot.exists()) {
          console.info('DELETE_SCHEDULE_FIRESTORE_SUCCESS', {
            uid: authUid,
            scheduleId,
            firestorePath: `schedules/${scheduleId}`,
            alreadyAbsent: true,
          });
        } else {
          await deleteDoc(scheduleRef);
          // A successful delete is authoritative. Firestore may reject a follow-up
          // read of the now-missing document under rules that inspect resource.data.
          try {
            const remaining = await getDocs(query(collection(db, 'schedules'), where('userId', '==', authUid)));
            if (remaining.docs.some((schedule) => schedule.id === scheduleId)) {
              throw Object.assign(new Error('SCHEDULE_DELETE_VERIFICATION_FAILED'), { code: 'SCHEDULE_DELETE_VERIFICATION_FAILED' });
            }
          } catch (verificationError) {
            const firebaseError = verificationError as { code?: string; message?: string };
            if (firebaseError.code === 'SCHEDULE_DELETE_VERIFICATION_FAILED') throw verificationError;
            console.warn('DELETE_SCHEDULE_VERIFICATION_UNAVAILABLE', {
              code: firebaseError.code || 'UNKNOWN',
              message: firebaseError.message || String(verificationError),
              uid: authUid,
              scheduleId,
              firestorePath: `schedules/${scheduleId}`,
            });
          }
        }
      } catch (error) {
        const firebaseError = error as { code?: string; message?: string };
        console.error('DELETE_SCHEDULE_FIRESTORE_ERROR', {
          code: firebaseError.code || 'UNKNOWN',
          message: firebaseError.message || String(error),
          uid: authUid,
          requestedUserId: userId,
          scheduleId,
          firestorePath: `schedules/${scheduleId}`,
        });
        throw error;
      }
      console.info('DELETE_SCHEDULE_FIRESTORE_SUCCESS', { uid: authUid, scheduleId, firestorePath: `schedules/${scheduleId}` });
    }
    try {
      await androidNotificationService.cancelAssessment({ id: scheduleId });
    } catch (error) {
      console.warn('[Schedule] native cancellation unavailable after Firestore delete:', { scheduleId, error });
    }

    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${authUid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: AssessmentScheduleItem[] = JSON.parse(stored);
        const filtered = list.filter((i) => i.id !== scheduleId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
      if (userId && userId !== authUid) {
        const staleKey = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
        const staleStored = localStorage.getItem(staleKey);
        if (staleStored) {
          const staleList: AssessmentScheduleItem[] = JSON.parse(staleStored);
          const filteredStaleList = staleList.filter((i) => i.id !== scheduleId);
          localStorage.setItem(staleKey, JSON.stringify(filteredStaleList));
        }
      }
    } catch {
      // ignore
    }
  },

  async syncNativeSchedules(userId: string): Promise<void> {
    const schedules = await this.getAllSchedules(userId);
    await androidNotificationService.clearAssessmentNotificationsBeforeSync();
    const today = getTodayString();
    const activeSchedules = schedules.filter((item) => item.enabled !== false
      && (item.recurrence === 'DAILY' || item.scheduledDate === today));
    await androidNotificationService.cancelAssessmentSchedulesExcept(new Set(activeSchedules.map((item) => item.id)));
    await Promise.all(activeSchedules.map(syncNativeSchedule));
  },

  async reconcileMissedAssessments(userId: string): Promise<void> {
    const schedules = await this.getAllSchedules(userId);
    const now = new Date();
    const { reportDatabaseService } = await import('./reportDatabaseService');
    const reports = await reportDatabaseService.getUserConditionReports(userId, 'TEST').catch(() => []);
    for (const item of schedules) {
      const parsed = parseTime(item.time);
      if (!parsed || item.enabled === false) continue;
      const due = new Date(now);
      due.setHours(parsed.hour, parsed.minute, 0, 0);
      if (due.getTime() > now.getTime() || now.getTime() - due.getTime() < 60 * 60 * 1000 || item.missedNotifiedAt?.slice(0, 10) === getTodayString()) continue;
      const completed = reports.some((report) => report.status === 'COMPLETED' && report.generatedAt && new Date(report.generatedAt).getTime() >= due.getTime() && new Date(report.generatedAt).getTime() < due.getTime() + 60 * 60 * 1000);
      if (completed) continue;
      const date = getTodayString();
      await androidNotificationService.cancelAssessment({ id: item.id });
      await notificationService.createAssessmentNotification(userId, { type: 'ASSESSMENT_MISSED', title: 'Assessment Missed', body: `You missed your scheduled ${item.title}.`, date, observationId: item.id, scheduleId: item.id, metadata: { scheduleId: item.id, eventId: getAssessmentEventId({ type: 'ASSESSMENT_MISSED', scheduleId: item.id, date }) } });
      await notificationService.fanOutMissedAssessmentToCaretakers(userId, { ...item, date });
      const missedAt = now.toISOString();
      const db = getFirebaseDb();
      if (db) await setDoc(doc(db, 'schedules', item.id), { missedNotifiedAt: missedAt }, { merge: true });
      try { const key = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`; const list: AssessmentScheduleItem[] = JSON.parse(localStorage.getItem(key) || '[]'); localStorage.setItem(key, JSON.stringify(list.map((entry) => entry.id === item.id ? { ...entry, missedNotifiedAt: missedAt } : entry))); } catch { /* best effort */ }
    }
  },

  async cancelMissedForCompletedAssessment(userId: string, completedAt: string): Promise<void> {
    const completed = new Date(completedAt).getTime();
    if (!Number.isFinite(completed)) return;
    const schedules = await this.getAllSchedules(userId);
    await Promise.all(schedules.filter((item) => {
      const parsed = parseTime(item.time); if (!parsed) return false;
      const due = new Date(completed); due.setHours(parsed.hour, parsed.minute, 0, 0);
      return completed >= due.getTime() && completed < due.getTime() + 60 * 60 * 1000;
    }).map(async (item) => {
      await androidNotificationService.cancelAssessment({ id: item.id });
      await this.updateScheduleStatus(userId, item.id, 'Completed');
    }));
  },

  /**
   * Update schedule item status (e.g. 'Completed')
   */
  async updateScheduleStatus(
    userId: string,
    scheduleId: string,
    status: 'Pending' | 'Completed' | 'In Progress' | 'Cancelled'
  ): Promise<void> {
    const db = getFirebaseDb();
    if (db) {
      await setDoc(doc(db, 'schedules', scheduleId), {
        status,
        completionDate: status === 'Completed' ? getTodayString() : null,
      }, { merge: true });
    }

    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: AssessmentScheduleItem[] = JSON.parse(stored);
        const updated = list.map((item) =>
          item.id === scheduleId ? { ...item, status, completionDate: status === 'Completed' ? getTodayString() : item.completionDate } : item
        );
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  },
};
