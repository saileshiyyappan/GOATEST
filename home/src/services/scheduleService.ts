/**
 * GOATEST Schedule Service
 * 
 * Manages daily assessment schedules in Firestore database.
 * ZERO fake or fabricated scheduled items.
 */

import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { validateFirestoreReadAuth, handleFirestoreReadError } from './firestoreAuthGuard';
import type { AssessmentScheduleItem } from '../types';
import { androidNotificationService } from './androidNotificationService';
import { notificationService } from './notificationService';

const LOCAL_STORAGE_KEY_PREFIX = 'goatest_schedule_';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const due = nextOccurrence(item);
  if (!due) return;
  await androidNotificationService.scheduleAssessmentDue({ id: item.id, title: item.title, at: due });
  await androidNotificationService.scheduleAssessmentMissed({ id: item.id, title: item.title, at: new Date(due.getTime() + 60 * 60 * 1000) });
}

function getValidAuthUid(): string | null {
  try {
    const auth = getFirebaseAuth();
    return auth?.currentUser?.uid || null;
  } catch {
    return null;
  }
}

export const scheduleService = {
  /**
   * Fetch today's real assessment schedule for the authenticated user from Firestore.
   */
  async getTodaySchedule(userId: string): Promise<AssessmentScheduleItem[]> {
    if (!userId) return [];

    const today = getTodayString();
    const authCheck = validateFirestoreReadAuth('schedules', userId, 'userId');
    const db = getFirebaseDb();

    // 1. If Firestore is initialized and authenticated, fetch from Firestore
    if (db && authCheck.allowed) {
      try {
        const schedulesRef = collection(db, 'schedules');
        const q = query(
          schedulesRef,
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const items: AssessmentScheduleItem[] = [];
          snapshot.forEach((d) => {
            items.push({ id: d.id, ...(d.data() as Omit<AssessmentScheduleItem, 'id'>) });
          });
          // Sort chronologically by time
           return items.filter((item) => item.enabled !== false && (item.recurrence === 'DAILY' || item.scheduledDate === today)).sort((a, b) => (parseTime(a.time)?.hour || 0) * 60 + (parseTime(a.time)?.minute || 0) - ((parseTime(b.time)?.hour || 0) * 60 + (parseTime(b.time)?.minute || 0)));
        }
      } catch (err) {
        handleFirestoreReadError(err, 'schedules', userId);
      }
    }

    // 2. Safe local store fallback (for offline or local session without inventing data)
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
      if (stored) {
        const parsed: AssessmentScheduleItem[] = JSON.parse(stored);
        return parsed.filter((item) => item.enabled !== false && (item.recurrence === 'DAILY' || item.scheduledDate === today));
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
    const scheduledDate = item.scheduledDate || getTodayString();
    const newItem: AssessmentScheduleItem = {
      id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
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

    const authUid = getValidAuthUid();
    const db = getFirebaseDb();
    if (db && authUid && userId !== 'guest_user') {
      try {
        await setDoc(doc(db, 'schedules', newItem.id), newItem);
      } catch (err) {
        console.warn('Could not write schedule to Firestore:', err);
      }
    }

    await syncNativeSchedule(newItem).catch((error) => console.warn('[Schedule] Native schedule unavailable:', error));

    // Update local cache
    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
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
    if (!userId) return [];

    const authCheck = validateFirestoreReadAuth('schedules', userId, 'userId');
    const db = getFirebaseDb();
    if (db && authCheck.allowed) {
      try {
        const schedulesRef = collection(db, 'schedules');
        const q = query(schedulesRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const items: AssessmentScheduleItem[] = [];
          snapshot.forEach((d) => {
            items.push({ id: d.id, ...(d.data() as Omit<AssessmentScheduleItem, 'id'>) });
          });
          return items.filter((item) => item.enabled !== false).sort((a, b) => a.time.localeCompare(b.time));
        }
      } catch (err) {
        handleFirestoreReadError(err, 'schedules', userId);
      }
    }

    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
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
    if (!userId || !scheduleId) return;

    const db = getFirebaseDb();
    if (db) {
      try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'schedules', scheduleId));
      } catch (err) {
        console.warn('Could not delete schedule from Firestore:', err);
      }
    }
    await androidNotificationService.cancelAssessment({ id: scheduleId });

    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: AssessmentScheduleItem[] = JSON.parse(stored);
        const filtered = list.filter((i) => i.id !== scheduleId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch {
      // ignore
    }
  },

  async syncNativeSchedules(userId: string): Promise<void> {
    const schedules = await this.getAllSchedules(userId);
    await Promise.all(schedules.filter((item) => item.enabled !== false).map(syncNativeSchedule));
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
      await notificationService.createAssessmentNotification(userId, { type: 'ASSESSMENT_MISSED', title: 'Assessment Missed', body: `You missed your scheduled ${item.title}.`, date: getTodayString(), observationId: item.id, metadata: { scheduleId: item.id } });
      await notificationService.fanOutMissedAssessmentToCaretakers(userId, item);
      const missedAt = now.toISOString();
      const db = getFirebaseDb();
      if (db) await setDoc(doc(db, 'schedules', item.id), { missedNotifiedAt: missedAt }, { merge: true }).catch(() => undefined);
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
    }).map((item) => androidNotificationService.cancelMissedAssessment({ id: item.id })));
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
      try {
        await setDoc(doc(db, 'schedules', scheduleId), { status }, { merge: true });
      } catch (err) {
        console.warn('Could not update schedule status in Firestore:', err);
      }
    }

    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: AssessmentScheduleItem[] = JSON.parse(stored);
        const updated = list.map((item) =>
          item.id === scheduleId ? { ...item, status } : item
        );
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  },
};
