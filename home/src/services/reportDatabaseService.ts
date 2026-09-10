/**
 * GOATEST Report Database Foundation & Raw/Report Data Service
 * 
 * PMT-1: Comprehensive persistent database layer for the reporting system.
 * 
 * CORE PRINCIPLES:
 * 1. TWO SEPARATE REPRESENTATIONS:
 *    - RAW MACHINE DATA: untouched, immutable machine payload (CM_PACKET, ML input, ML output).
 *    - READABLE REPORT DATA: derived human-readable representation for Home / Report Home.
 * 2. USER DATA ISOLATION: Authenticated user ownership on every document.
 * 3. HIERARCHY: TEST < DAY (3 tests + 10 QA) < WEEK < MONTH.
 * 4. NO USER DELETION: Historical records retained.
 * 5. NO FAKE HEALTH DATA: Development fixtures are strictly non-clinical and clearly marked.
 */

import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { validateFirestoreReadAuth, handleFirestoreReadError, isFirestorePermissionDenied } from './firestoreAuthGuard';
import { offlineSyncService } from './offlineSyncService';
import { notificationService } from './notificationService';
import type {
  TestRecord,
  DayRecord,
  WeekRecord,
  MonthRecord,
  ReportRecord,
  QaSessionRecord,
  ReportType,
} from '../types';

const STORAGE_KEYS = {
  TESTS: 'goatest_raw_tests_',
  DAYS: 'goatest_raw_days_',
  WEEKS: 'goatest_raw_weeks_',
  MONTHS: 'goatest_raw_months_',
  REPORTS: 'goatest_report_records_',
  QA: 'goatest_qa_sessions_',
};

/**
 * Returns the currently authenticated Firebase UID if available.
 */
function getValidAuthUid(): string | null {
  try {
    const auth = getFirebaseAuth();
    return auth?.currentUser?.uid || null;
  } catch {
    return null;
  }
}

/**
 * Local storage helper to store a single entity in a user-scoped array
 */
function saveLocalEntity<T extends { id?: string; testId?: string; dayId?: string; weekId?: string; monthId?: string; reportId?: string; qaSessionId?: string; userId: string }>(
  prefix: string,
  userId: string,
  keyField: keyof T,
  item: T
): void {
  try {
    const storageKey = `${prefix}${userId}`;
    const raw = localStorage.getItem(storageKey);
    const list: T[] = raw ? JSON.parse(raw) : [];
    const itemKey = item[keyField];
    const index = list.findIndex((x) => x[keyField] === itemKey);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (err) {
    console.warn(`[Local Storage Save Error] ${prefix}:`, err);
  }
}

/**
 * Local storage helper to retrieve entities for a user
 */
function getLocalEntities<T>(prefix: string, userId: string): T[] {
  try {
    const storageKey = `${prefix}${userId}`;
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const reportDatabaseService = {
  // =========================================================================
  // AUTHORITATIVE CONDITION COLLECTIONS (/test, /day, /week, /month)
  // =========================================================================

  async getUserConditionRecords(userId: string, collectionName: 'test' | 'day' | 'week' | 'month'): Promise<any[]> {
    const authCheck = validateFirestoreReadAuth(collectionName, userId, 'uid');
    if (!authCheck.allowed) return [];
    const db = getFirebaseDb();
    const localKey = collectionName === 'test' ? STORAGE_KEYS.TESTS : collectionName === 'day' ? STORAGE_KEYS.DAYS : collectionName === 'week' ? STORAGE_KEYS.WEEKS : STORAGE_KEYS.MONTHS;
    const stagedRows = collectionName === 'test' ? await offlineSyncService.getLocalRecords<any>(userId, 'TEST') : [];
    const localRows = [...getLocalEntities<any>(localKey, userId), ...stagedRows]
      .filter((row, index, list) => list.findIndex((item) => (item.id || item.testId || item.dayId || item.weekId || item.monthId) === (row.id || row.testId || row.dayId || row.weekId || row.monthId)) === index);
    if (!db) return localRows;
    try {
      const snap = await getDocs(query(collection(db, collectionName), where('uid', '==', userId)));
      const rows: any[] = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      return [...rows, ...localRows.filter((local) => !rows.some((remote) => (remote.id || remote.testId || remote.dayId || remote.weekId || remote.monthId) === (local.id || local.testId || local.dayId || local.weekId || local.monthId)))]
        .filter((item) => item.uid === userId)
        .sort((a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime());
    } catch (err) {
      handleFirestoreReadError(err, collectionName, userId);
      if (isFirestorePermissionDenied(err)) throw err;
      return localRows;
    }
  },

  async getUserConditionReports(userId: string, reportType?: ReportType): Promise<ReportRecord[]> {
    const authCheck = validateFirestoreReadAuth('reports_test', userId, 'uid');
    if (!authCheck.allowed) return [];
    const db = getFirebaseDb();
    const localReports = [...getLocalEntities<ReportRecord>(STORAGE_KEYS.REPORTS, userId), ...await offlineSyncService.getLocalRecords<ReportRecord>(userId, 'REPORT')]
      .filter((report, index, list) => list.findIndex((item) => item.reportId === report.reportId) === index)
      .filter((report) => !reportType || report.reportType === reportType);
    if (!db) return localReports;
    const collections: Array<'reports_test' | 'reports_day' | 'reports_week' | 'reports_month'> = reportType
      ? [`reports_${reportType.toLowerCase()}` as 'reports_test' | 'reports_day' | 'reports_week' | 'reports_month']
      : ['reports_test', 'reports_day', 'reports_week', 'reports_month'];
    try {
      const snapshots = await Promise.all(collections.map((name) => getDocs(query(collection(db, name), where('uid', '==', userId))).catch((error) => {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { collectionName: name });
      })));
      const remoteReports = snapshots.flatMap((snap, index) => snap.docs.map((item) => {
        const data: any = item.data();
        const type = (data.reportType || data.temporalLevel || collections[index].replace('reports_', '')).toUpperCase() as ReportType;
        const referenceId = data.referenceId || data[`${type.toLowerCase()}ObservationId`] || data.observationId || item.id;
        return {
          reportId: data.reportId || item.id,
          userId: data.uid || data.userId,
          reportType: type,
          referenceId,
          title: data.title || data.formattedTitle || `${type} Condition Report`,
          generatedAt: data.generatedAt || data.createdAt || data.timestamp,
          status: data.status === 'ARCHIVED' ? 'ARCHIVED' : 'COMPLETED',
          rawSourceReference: { collectionName: type === 'TEST' ? 'test' : type.toLowerCase(), documentId: referenceId },
          readableContent: data.readableContent || { summary: data.conditionSummary || data.summary || data.title || `${type} Condition Report`, metricsSummary: data },
          visualizationData: data.visualizationData,
          date: data.date,
          dayObservationId: data.dayObservationId,
          qaSessionId: data.qaSessionId,
          qaCompletionStatus: data.qaCompletionStatus,
          qaCompletedAt: data.qaCompletedAt,
          testObservationIds: data.testObservationIds,
          c50Result: data.c50Result,
          trajectoryResult: data.trajectoryResult,
          assessmentDate: data.assessmentDate,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          c50Evidence: data.c50Evidence,
          provenance: data.provenance,
          technicalAudit: data.technicalAudit,
          healthCareGuidance: data.healthCareGuidance,
          modelVersion: data.modelVersion,
          isFixture: Boolean(data.isFixture),
          createdAt: data.createdAt || data.generatedAt || data.timestamp,
          updatedAt: data.updatedAt || data.createdAt || data.generatedAt || data.timestamp,
        } as ReportRecord;
      })).filter((report) => report.userId === userId);
      const merged = [...remoteReports, ...localReports.filter((local) => !remoteReports.some((remote) => remote.reportId === local.reportId))];
      return merged
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    } catch (err) {
      const collectionName = typeof (err as { collectionName?: unknown })?.collectionName === 'string'
        ? (err as { collectionName: string }).collectionName
        : 'reports_test';
      handleFirestoreReadError(err, collectionName, userId);
      if (isFirestorePermissionDenied(err)) throw err;
      return localReports;
    }
  },

  subscribeUserConditionReports(userId: string, reportType: ReportType | undefined, onChange: (reports: ReportRecord[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const authCheck = validateFirestoreReadAuth('reports_test', userId, 'uid');
    const db = getFirebaseDb();
    if (!authCheck.allowed || !db) return () => undefined;
    const collections: Array<'reports_test' | 'reports_day' | 'reports_week' | 'reports_month'> = reportType
      ? [`reports_${reportType.toLowerCase()}` as 'reports_test' | 'reports_day' | 'reports_week' | 'reports_month']
      : ['reports_test', 'reports_day', 'reports_week', 'reports_month'];
    const byId = new Map<string, ReportRecord>();
    const emit = () => onChange(Array.from(byId.values()).sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
    const unsubscribers = collections.map((name) => onSnapshot(query(collection(db, name), where('uid', '==', userId)), (snap) => {
      snap.docs.forEach((item) => {
        const data: any = item.data();
        const type = (data.reportType || data.temporalLevel || name.replace('reports_', '')).toUpperCase() as ReportType;
        const report: ReportRecord = { reportId: data.reportId || item.id, userId: data.uid || data.userId, reportType: type, referenceId: data.referenceId || data.observationId || item.id, title: data.title || data.formattedTitle || `${type} Condition Report`, generatedAt: data.generatedAt || data.createdAt || data.timestamp, status: data.status === 'ARCHIVED' ? 'ARCHIVED' : 'COMPLETED', rawSourceReference: { collectionName: type === 'TEST' ? 'test' : type.toLowerCase(), documentId: data.observationId || item.id }, readableContent: data.readableContent || { summary: data.conditionSummary || data.summary || data.title || `${type} Condition Report`, metricsSummary: data }, visualizationData: data.visualizationData, date: data.date, dayObservationId: data.dayObservationId, qaSessionId: data.qaSessionId, qaCompletionStatus: data.qaCompletionStatus, qaCompletedAt: data.qaCompletedAt, testObservationIds: data.testObservationIds, c50Result: data.c50Result, trajectoryResult: data.trajectoryResult, assessmentDate: data.assessmentDate, periodStart: data.periodStart, periodEnd: data.periodEnd, c50Evidence: data.c50Evidence, provenance: data.provenance, technicalAudit: data.technicalAudit, healthCareGuidance: data.healthCareGuidance, modelVersion: data.modelVersion, isFixture: Boolean(data.isFixture), createdAt: data.createdAt || data.generatedAt || data.timestamp, updatedAt: data.updatedAt || data.createdAt || data.generatedAt || data.timestamp };
        if (report.userId === userId) byId.set(report.reportId, report);
      });
      emit();
    }, (error) => onError?.(error instanceof Error ? error : new Error(String(error)))));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },

  // =========================================================================
  // 1. TEST RECORD OPERATIONS (RAW TEST/ASSESSMENT MACHINE DATA)
  // =========================================================================

  /**
   * Saves a raw TestRecord to local backup.
   * Legacy Firestore /tests collection write removed per Home Web PMT.
   */
  async saveTestRecord(record: TestRecord): Promise<void> {
    if (!record.testId || !record.userId) {
      throw new Error('TestRecord requires testId and userId');
    }

    const authUid = getValidAuthUid();
    if (authUid !== record.userId) throw new Error('TEST_PERSISTENCE_FAILED');
    await offlineSyncService.stageRecordAndQueue({
      record: { recordKey: `TEST:${record.userId}:${record.testId}`, uid: record.userId, kind: 'TEST', record: record as unknown as Record<string, unknown>, updatedAt: new Date().toISOString() },
      operation: { operationId: `test:${record.testId}`, uid: record.userId, collection: 'test', documentId: record.testId, payload: { ...record, uid: record.userId } },
    });
    saveLocalEntity(STORAGE_KEYS.TESTS, record.userId, 'testId', record);
  },

  /**
   * Retrieves a single TestRecord by testId from local storage.
   * Legacy Firestore /tests collection read removed per Home Web PMT.
   */
  async getTestRecord(testId: string): Promise<TestRecord | null> {
    if (!testId) return null;

    // Local search across user keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.TESTS)) {
        try {
          const list: TestRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((t) => t.testId === testId);
          if (match) return match;
        } catch {
          // ignore
        }
      }
    }

    return null;
  },

  /**
   * Retrieves all TestRecords for a user from local storage.
   * Legacy Firestore /tests collection query removed per Home Web PMT.
   */
  async getUserTests(userId: string): Promise<TestRecord[]> {
    if (!userId) return [];
    const localList = getLocalEntities<TestRecord>(STORAGE_KEYS.TESTS, userId);
    return localList.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  /**
   * Returns only completed TEST observations belonging to the authenticated
   * owner and the requested local calendar date. This is the HOME-owned DAY
   * aggregation source; reports are deliberately not used as substitutes.
   */
  async getCompletedTestsForCalendarDate(userId: string, date: string): Promise<TestRecord[]> {
    if (!userId || !date) return [];
    const authCheck = validateFirestoreReadAuth('test', userId, 'uid');
    if (!authCheck.allowed || authCheck.authUid !== userId) return [];

    const localDate = (timestamp: string) => {
      const parsed = new Date(timestamp);
      if (!Number.isFinite(parsed.getTime())) return '';
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const eligible = (record: TestRecord) =>
      record.userId === userId &&
      record.status === 'COMPLETED' &&
      localDate(record.timestamp || record.createdAt) === date;

    const db = getFirebaseDb();
    if (db) {
      try {
        const snapshot = await getDocs(query(collection(db, 'test'), where('uid', '==', userId)));
        const records = snapshot.docs.map((item) => {
          const data = item.data() as any;
          return { ...data, testId: data.testId || data.observationId || item.id, userId: data.userId || data.uid } as TestRecord;
        }).filter(eligible);
        return records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      } catch (err) {
        handleFirestoreReadError(err, 'test', userId);
      }
    }

    return getLocalEntities<TestRecord>(STORAGE_KEYS.TESTS, userId)
      .filter(eligible)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  // =========================================================================
  // 2. DAY RECORD OPERATIONS (AGGREGATES 3 TESTS + 10 QA + RAW ML DATA)
  // =========================================================================

  /**
   * Saves a DayRecord to local backup.
   * Legacy Firestore /day_records collection write removed per Home Web PMT.
   */
  async saveDayRecord(record: DayRecord): Promise<void> {
    if (!record.dayId || !record.userId) {
      throw new Error('DayRecord requires dayId and userId');
    }

    saveLocalEntity(STORAGE_KEYS.DAYS, record.userId, 'dayId', record);
  },

  /**
   * Retrieves a single DayRecord by dayId from local storage.
   * Legacy Firestore /day_records collection read removed per Home Web PMT.
   */
  async getDayRecord(dayId: string): Promise<DayRecord | null> {
    if (!dayId) return null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.DAYS)) {
        try {
          const list: DayRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((d) => d.dayId === dayId);
          if (match) return match;
        } catch {
          // ignore
        }
      }
    }

    return null;
  },

  /**
   * Retrieves all DayRecords for an authenticated user from local storage.
   * Legacy Firestore /day_records collection query removed per Home Web PMT.
   */
  async getUserDayRecords(userId: string): Promise<DayRecord[]> {
    if (!userId) return [];
    const localList = getLocalEntities<DayRecord>(STORAGE_KEYS.DAYS, userId);
    return localList.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  /**
   * Retrieves a DayRecord by YYYY-MM-DD date string for a user from local storage.
   */
  async getDayRecordByDate(dateStr: string, userId: string): Promise<DayRecord | null> {
    if (!dateStr || !userId) return null;
    const days = await this.getUserDayRecords(userId);
    return days.find((d) => d.date === dateStr) || null;
  },

  // =========================================================================
  // 3. WEEK RECORD OPERATIONS (AGGREGATES DAYS)
  // =========================================================================

  /**
   * Saves a WeekRecord to local backup.
   * Legacy Firestore /week_records collection write removed per Home Web PMT.
   */
  async saveWeekRecord(record: WeekRecord): Promise<void> {
    if (!record.weekId || !record.userId) {
      throw new Error('WeekRecord requires weekId and userId');
    }

    saveLocalEntity(STORAGE_KEYS.WEEKS, record.userId, 'weekId', record);
  },

  /**
   * Retrieves a single WeekRecord by weekId from local storage.
   * Legacy Firestore /week_records collection read removed per Home Web PMT.
   */
  async getWeekRecord(weekId: string): Promise<WeekRecord | null> {
    if (!weekId) return null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.WEEKS)) {
        try {
          const list: WeekRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((w) => w.weekId === weekId);
          if (match) return match;
        } catch {
          // ignore
        }
      }
    }

    return null;
  },

  /**
   * Retrieves all WeekRecords for an authenticated user from local storage.
   * Legacy Firestore /week_records collection query removed per Home Web PMT.
   */
  async getUserWeekRecords(userId: string): Promise<WeekRecord[]> {
    if (!userId) return [];
    const localList = getLocalEntities<WeekRecord>(STORAGE_KEYS.WEEKS, userId);
    return localList.sort(
      (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
    );
  },

  // =========================================================================
  // 4. MONTH RECORD OPERATIONS (AGGREGATES WEEKS)
  // =========================================================================

  /**
   * Saves a MonthRecord to local backup.
   * Legacy Firestore /month_records collection write removed per Home Web PMT.
   */
  async saveMonthRecord(record: MonthRecord): Promise<void> {
    if (!record.monthId || !record.userId) {
      throw new Error('MonthRecord requires monthId and userId');
    }

    saveLocalEntity(STORAGE_KEYS.MONTHS, record.userId, 'monthId', record);
  },

  /**
   * Retrieves a single MonthRecord by monthId from local storage.
   * Legacy Firestore /month_records collection read removed per Home Web PMT.
   */
  async getMonthRecord(monthId: string): Promise<MonthRecord | null> {
    if (!monthId) return null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.MONTHS)) {
        try {
          const list: MonthRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((m) => m.monthId === monthId);
          if (match) return match;
        } catch {
          // ignore
        }
      }
    }

    return null;
  },

  /**
   * Retrieves all MonthRecords for an authenticated user from local storage.
   * Legacy Firestore /month_records collection query removed per Home Web PMT.
   */
  async getUserMonthRecords(userId: string): Promise<MonthRecord[]> {
    if (!userId) return [];
    const localList = getLocalEntities<MonthRecord>(STORAGE_KEYS.MONTHS, userId);
    return localList.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });
  },

  // =========================================================================
  // 5. REPORT RECORD OPERATIONS (DERIVED READABLE HUMAN REPORTS)
  // =========================================================================

  /**
   * Saves a human-readable ReportRecord to Firestore (and local backup).
   * Immutably points back to the raw source record.
   */
  async saveReportRecord(report: ReportRecord): Promise<void> {
    if (!report.reportId || !report.userId) {
      throw new Error('ReportRecord requires reportId and userId');
    }

    const authUid = getValidAuthUid();
    if (!authUid || authUid !== report.userId) {
      throw new Error('REPORT_UID_MISMATCH_REJECTED');
    }
    const collectionName = `reports_${report.reportType.toLowerCase()}`;
    const syncStatus = await offlineSyncService.stageRecordAndQueue({
      record: { recordKey: `REPORT:${report.userId}:${report.reportId}`, uid: report.userId, kind: 'REPORT', record: report as unknown as Record<string, unknown>, updatedAt: new Date().toISOString() },
      operation: { operationId: `report:${collectionName}:${report.reportId}`, uid: report.userId, collection: collectionName, documentId: report.reportId, payload: { ...report, uid: report.userId } },
    });
    saveLocalEntity(STORAGE_KEYS.REPORTS, report.userId, 'reportId', report);

    // Caretaker notification rules intentionally require the authoritative
    // report document to exist first. If the report is staged offline, defer
    // this exact deterministic fan-out until replay confirms the write.
    const createUserNotification = async () => {
      if (report.isFixture) return;
      const reportType = report.reportType;
      const title = reportType === 'TEST' ? 'Test Report Ready'
        : reportType === 'DAY' ? 'Day Report Ready'
        : reportType === 'WEEK' ? 'Week Report Ready'
        : 'Month Report Ready';
      const body = reportType === 'TEST' ? "Your test report is ready."
        : reportType === 'DAY' ? 'Your day report is ready.'
        : reportType === 'WEEK' ? 'Your week report is ready.'
        : 'Your month report is ready.';
      const notificationType = `${reportType}_REPORT_READY` as 'TEST_REPORT_READY' | 'DAY_REPORT_READY' | 'WEEK_REPORT_READY' | 'MONTH_REPORT_READY';
      const notificationInput = {
        type: notificationType,
        reportId: report.reportId,
        date: report.assessmentDate || report.generatedAt?.slice(0, 10),
        title,
        body,
        reportType,
      };
      await notificationService.createAssessmentNotification(report.userId, notificationInput);
      return notificationInput;
    };
    const fanOutCaretakerNotification = async (notificationInput: Awaited<ReturnType<typeof createUserNotification>>) => {
      if (!notificationInput) return;
      try {
        await notificationService.fanOutAssessmentNotificationToCaretakers(report.userId, {
          ...notificationInput,
          title: `${report.reportType === 'TEST' ? 'Test' : report.reportType[0] + report.reportType.slice(1).toLowerCase()} Report Ready`,
          body: `${report.reportType === 'TEST' ? 'The test' : `The ${report.reportType.toLowerCase()}`} report for the monitored user is ready.`,
          recipientRole: 'CARETAKER',
          reportType: report.reportType,
        });
      } catch (error) {
        console.warn(`[${report.reportType} caretaker notification] fan-out unavailable:`, error);
      }
    };
    const operationId = `report:${collectionName}:${report.reportId}`;
    const notificationInput = await createUserNotification();
    if (!notificationInput) return;
    if (syncStatus === 'SYNCED') {
      await fanOutCaretakerNotification(notificationInput);
    } else {
      offlineSyncService.onSynced(operationId, () => fanOutCaretakerNotification(notificationInput));
    }
  },

  /**
   * Retrieves a single ReportRecord by reportId.
   */
  async getReportRecord(reportId: string): Promise<ReportRecord | null> {
    if (!reportId) return null;

    const authUid = getValidAuthUid();
    const db = getFirebaseDb();
    if (db && authUid) {
      try {
        const types: ReportType[] = ['TEST', 'DAY', 'WEEK', 'MONTH'];
        for (const type of types) {
          const snap = await getDoc(doc(db, `reports_${type.toLowerCase()}`, reportId));
          if (snap.exists()) {
            const report = snap.data() as ReportRecord;
            if (report.userId === authUid) return report;
          }
        }
      } catch (err) {
        handleFirestoreReadError(err, 'reports', reportId);
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.REPORTS)) {
        try {
          const list: ReportRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((r) => r.reportId === reportId && r.userId === authUid);
          if (match) return match;
        } catch {
          // ignore
        }
      }
    }

    return null;
  },

  /**
   * Retrieves all ReportRecords for an authenticated user (optional filter by reportType: TEST, DAY, WEEK, MONTH).
   */
  async getUserReports(userId: string, reportType?: ReportType): Promise<ReportRecord[]> {
    return this.getUserConditionReports(userId, reportType);
  },

  // =========================================================================
  // 6. QA SESSION CONTRACT OPERATIONS (BELONGS TO DAY RECORD)
  // =========================================================================

  /**
   * Saves a QaSessionRecord to Firestore (and local backup).
   */
  async saveQaSessionRecord(qaSession: QaSessionRecord): Promise<void> {
    if (!qaSession.qaSessionId || !qaSession.userId) {
      throw new Error('QaSessionRecord requires qaSessionId and userId');
    }

    const authUid = getValidAuthUid();
    const db = getFirebaseDb();
    if (db && authUid) {
      try {
        await setDoc(doc(db, 'qa_sessions', qaSession.qaSessionId), qaSession);
      } catch (err) {
        console.warn('[ReportDB] Could not save QA session to Firestore:', err);
      }
    }

    saveLocalEntity(STORAGE_KEYS.QA, qaSession.userId, 'qaSessionId', qaSession);
  },

  /**
   * Retrieves a single QaSessionRecord by qaSessionId.
   */
  async getQaSessionRecord(qaSessionId: string): Promise<QaSessionRecord | null> {
    if (!qaSessionId) return null;

    const authUid = getValidAuthUid();
    const db = getFirebaseDb();
    if (db && authUid) {
      try {
        const snap = await getDoc(doc(db, 'qa_sessions', qaSessionId));
        if (snap.exists()) {
          return snap.data() as QaSessionRecord;
        }
      } catch (err) {
        handleFirestoreReadError(err, 'qa_sessions', qaSessionId);
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.QA)) {
        try {
          const list: QaSessionRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((q) => q.qaSessionId === qaSessionId);
          if (match) return match;
        } catch {
          // ignore
        }
      }
    }

    return null;
  },

  /**
   * Retrieves the QaSessionRecord associated with a specific dayId and userId.
   */
  async getQaSessionByDayId(dayId: string, userId: string): Promise<QaSessionRecord | null> {
    const authCheck = validateFirestoreReadAuth('qa_sessions', userId, 'userId');
    if (!authCheck.allowed) {
      const localList = getLocalEntities<QaSessionRecord>(STORAGE_KEYS.QA, userId || 'guest_user');
      return localList.find((q) => q.dayId === dayId) || null;
    }

    const db = getFirebaseDb();
    if (db) {
      try {
        const q = query(
          collection(db, 'qa_sessions'),
          where('userId', '==', userId),
          where('dayId', '==', dayId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data() as QaSessionRecord;
        }
      } catch (err) {
        handleFirestoreReadError(err, 'qa_sessions', userId);
        if (isFirestorePermissionDenied(err)) throw err;
      }
    }

    const localList = getLocalEntities<QaSessionRecord>(STORAGE_KEYS.QA, userId);
    return localList.find((q) => q.dayId === dayId) || null;
  },

  /**
   * Retrieves all QA sessions for a user.
   */
  async getUserQaSessions(userId: string): Promise<QaSessionRecord[]> {
    const authCheck = validateFirestoreReadAuth('qa_sessions', userId, 'userId');
    if (!authCheck.allowed) {
      const localList = getLocalEntities<QaSessionRecord>(STORAGE_KEYS.QA, userId || 'guest_user');
      return localList.sort(
        (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );
    }

    const db = getFirebaseDb();
    if (db) {
      try {
        const q = query(collection(db, 'qa_sessions'), where('userId', '==', userId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const sessions: QaSessionRecord[] = [];
          snap.forEach((d) => sessions.push(d.data() as QaSessionRecord));
          return sessions.sort(
            (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
          );
        }
      } catch (err) {
        handleFirestoreReadError(err, 'qa_sessions', userId);
        if (isFirestorePermissionDenied(err)) throw err;
      }
    }

    const localList = getLocalEntities<QaSessionRecord>(STORAGE_KEYS.QA, userId);
    return localList.sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
  },

  // =========================================================================
  // 7. DEVELOPMENT TEST FIXTURE FACTORY (NON-CLINICAL, MARKED & ISOLATED)
  // =========================================================================

  /**
   * Creates a verified development test fixture pipeline to validate database
   * storage, retrieval, hierarchy, and isolation.
   * 
   * Strict Rule:
   * Uses clearly artificial fixture text:
   * - "This is a raw test record"
   * - "This is a raw DAY ML input fixture"
   * - "This is a raw WEEK ML input fixture"
   * - "This is a raw MONTH ML input fixture"
   * Zero fake physiological measurements or fabricated clinical conclusions.
   */
  async createDevelopmentFixtures(userId: string): Promise<{
    testRecord: TestRecord;
    dayRecord: DayRecord;
    weekRecord: WeekRecord;
    monthRecord: MonthRecord;
    reportRecord: ReportRecord;
    qaSessionRecord: QaSessionRecord;
  }> {
    const now = new Date();
    const isoNow = now.toISOString();
    const todayDate = now.toISOString().split('T')[0];
    const timestampSuffix = Date.now();

    // 1. TEST FIXTURE (Raw Machine Data)
    const testId = `test_fixture_${timestampSuffix}`;
    const testRecord: TestRecord = {
      testId,
      userId,
      sessionId: `session_fixture_${timestampSuffix}`,
      timestamp: isoNow,
      target: 'Cardiovascular',
      organ: 'Cardiovascular',
      status: 'COMPLETED',
      source: 'DEV_FIXTURE',
      rawData: {
        description: 'This is a raw test record',
        isDevelopmentFixture: true,
        fixtureVersion: '1.0.0',
        rawFeatureArray: [0.12, 0.45, 0.78, 0.91],
        sessionMetrics: {
          durationSeconds: 120,
          qualityScore: 98,
        },
      },
      reportReference: `report_test_${timestampSuffix}`,
      isFixture: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    // 2. DAY RECORD FIXTURE
    const dayId = `day_fixture_${todayDate}_${timestampSuffix}`;
    const qaSessionId = `qa_fixture_${todayDate}_${timestampSuffix}`;
    const dayRecord: DayRecord = {
      dayId,
      userId,
      date: todayDate,
      testReferences: [testId],
      qaSessionReference: qaSessionId,
      rawConditionInput: {
        description: 'This is a raw DAY ML input fixture',
        isDevelopmentFixture: true,
        numericalFeatures: { f1: 1.0, f2: 2.0 },
        deviationFeatures: { d1: 0.05 },
        sourceReferences: [testId],
      },
      rawMLInput: {
        description: 'This is a raw DAY ML input fixture',
        isDevelopmentFixture: true,
        modelVersion: 'C50_V1_STUB',
      },
      rawMLOutput: {
        description: 'This is a raw DAY ML output fixture',
        isDevelopmentFixture: true,
        predictionValues: { stage: 1, confidence: 0.99 },
      },
      readableReportReference: `report_day_${timestampSuffix}`,
      status: 'COMPLETED',
      isFixture: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    // 3. WEEK RECORD FIXTURE
    const weekId = `week_fixture_${todayDate}_${timestampSuffix}`;
    const weekRecord: WeekRecord = {
      weekId,
      userId,
      weekStart: todayDate,
      weekEnd: todayDate,
      dayReferences: [dayId],
      rawMLInput: {
        description: 'This is a raw WEEK ML input fixture',
        isDevelopmentFixture: true,
      },
      rawMLOutput: {
        description: 'This is a raw WEEK ML output fixture',
        isDevelopmentFixture: true,
      },
      readableReportReference: `report_week_${timestampSuffix}`,
      status: 'COMPLETED',
      isFixture: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    // 4. MONTH RECORD FIXTURE
    const monthId = `month_fixture_${now.getFullYear()}_${now.getMonth() + 1}_${timestampSuffix}`;
    const monthRecord: MonthRecord = {
      monthId,
      userId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      weekReferences: [weekId],
      rawMLInput: {
        description: 'This is a raw MONTH ML input fixture',
        isDevelopmentFixture: true,
      },
      rawMLOutput: {
        description: 'This is a raw MONTH ML output fixture',
        isDevelopmentFixture: true,
      },
      readableReportReference: `report_month_${timestampSuffix}`,
      status: 'COMPLETED',
      isFixture: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    // 5. READABLE REPORT RECORD (Human-readable representation derived from raw source)
    const reportId = `report_test_${timestampSuffix}`;
    const reportRecord: ReportRecord = {
      reportId,
      userId,
      reportType: 'TEST',
      referenceId: testId,
      title: 'Cardiovascular Assessment Report (Development Fixture)',
      generatedAt: isoNow,
      status: 'COMPLETED',
      rawSourceReference: {
        collectionName: 'tests',
        documentId: testId,
      },
      readableContent: {
        summary: 'Completed Cardiovascular health assessment pipeline fixture.',
        observations: [
          'Signal telemetry captured successfully.',
          'Assessment data stored immutably in test record.',
        ],
        organTested: 'Cardiovascular',
        sections: [
          {
            heading: 'Pipeline Assessment Note',
            body: 'This readable report was derived immutably from raw test record ' + testId,
          },
        ],
      },
      visualizationData: {
        charts: [
          {
            type: 'line',
            title: 'Sample Metric Trend',
            dataPoints: [
              { time: '00:00', value: 10 },
              { time: '01:00', value: 12 },
              { time: '02:00', value: 11 },
            ],
          },
        ],
      },
      modelVersion: '1.0-DEV',
      isFixture: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    // 6. QA SESSION RECORD FIXTURE
    const qaSessionRecord: QaSessionRecord = {
      qaSessionId,
      userId,
      dayId,
      generatedAt: isoNow,
      questions: [
        {
          questionId: 'q_fixture_1',
          question: 'How did you feel during today\'s baseline test?',
          options: ['Normal / Resting', 'Mildly Fatigued', 'Post-Exercise'],
          selectedAnswer: 'Normal / Resting',
          organ: 'General',
          topic: 'Daily Readiness',
        },
      ],
      answers: {
        q_fixture_1: 'Normal / Resting',
      },
      completionStatus: 'COMPLETED',
      isFixture: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    // Persist all fixtures
    await Promise.all([
      this.saveTestRecord(testRecord),
      this.saveDayRecord(dayRecord),
      this.saveWeekRecord(weekRecord),
      this.saveMonthRecord(monthRecord),
      this.saveReportRecord(reportRecord),
      this.saveQaSessionRecord(qaSessionRecord),
    ]);

    return {
      testRecord,
      dayRecord,
      weekRecord,
      monthRecord,
      reportRecord,
      qaSessionRecord,
    };
  },
};
