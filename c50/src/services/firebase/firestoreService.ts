import { firebaseStatus, firestoreDb, firebaseAuth, getAuthenticatedUserUid } from './firebaseConfig';
import { reportStore } from '../condition/reportStore';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, limit, query } from 'firebase/firestore';

export type ConnectionStatusType =
  | 'CLOUD_CONNECTED'
  | 'CLOUD_AUTH_REQUIRED'
  | 'CLOUD_PERMISSION_DENIED'
  | 'CLOUD_UNAVAILABLE'
  | 'CLOUD_AUTH_REQUIRED'
  | 'LOCAL_ONLY';

export interface DatabaseWriteResult {
  success: boolean;
  status: ConnectionStatusType;
  persistedLocation: 'FIRESTORE' | 'LOCAL_SECURE_STORAGE' | 'NONE';
  collection: string;
  documentId: string;
  uid: string;
  error?: string;
}

export interface DatabaseReadResult<T = any> {
  success: boolean;
  status: ConnectionStatusType;
  location: 'FIRESTORE' | 'LOCAL_SECURE_STORAGE' | 'NOT_FOUND';
  collection: string;
  documentId: string;
  uid: string;
  data?: T | null;
  error?: string;
}

export interface DatabaseStatusReport {
  firebaseInitialized: boolean;
  projectId: string;
  authDomain: string;
  authenticated: boolean;
  uid: string | null;
  firestoreInitialized: boolean;
  firestoreReachable: boolean;
  connectionStatus: ConnectionStatusType;
  collections: {
    test: boolean;
    day: boolean;
    week: boolean;
    month: boolean;
    reports_test: boolean;
    reports_day: boolean;
    reports_week: boolean;
    reports_month: boolean;
  };
  capabilities: {
    read: boolean;
    write: boolean;
  };
}

export class ConditionDatabaseService {
  private observationCache: Map<string, any> = new Map();
  private qaCache: Map<string, any> = new Map();
  private notificationCache: Map<string, any> = new Map();
  private dayObservationCache: Map<string, any> = new Map();
  private dayReportCache: Map<string, any> = new Map();
  private weekObservationCache: Map<string, any> = new Map();
  private weekReportCache: Map<string, any> = new Map();

  /**
   * Initializes the Firestore database connection and verifies readiness.
   */
  async initializeDatabase(): Promise<boolean> {
    if (!firebaseStatus.isConfigured || !firestoreDb) {
      console.warn('[ConditionDatabaseService] Firebase/Firestore not configured.');
      return false;
    }
    return true;
  }

  /**
   * Ensures Firebase Auth is initialized and returns active UID.
   */
  async ensureAuthenticated(targetUid?: string): Promise<string> {
    if (firebaseAuth.currentUser && (!targetUid || firebaseAuth.currentUser.uid === targetUid)) {
      return firebaseAuth.currentUser.uid;
    }
    return getAuthenticatedUserUid();
  }

  /**
   * Validates authenticated UID ownership before performing any write.
   * Rejects missing, empty, foreign, or unauthenticated writes.
   */
  public validateAuthenticatedOwnership(suppliedUid: string): { isValid: boolean; authUid: string | null; error?: string; status: ConnectionStatusType } {
    if (
      !suppliedUid ||
      typeof suppliedUid !== 'string' ||
      !suppliedUid.trim() ||
      suppliedUid === 'anonymous_user' ||
      suppliedUid === 'guest_user' ||
      suppliedUid.startsWith('guest_') ||
      suppliedUid === 'anonymous' ||
      suppliedUid === 'placeholder_uid'
    ) {
      return {
        isValid: false,
        authUid: null,
        status: 'CLOUD_AUTH_REQUIRED',
        error: 'Authenticated Firebase UID is required. Anonymous or empty UID cannot write user-owned documents.',
      };
    }

    const runtimeHasActiveClientAuth = typeof window !== 'undefined' && !!firebaseAuth?.currentUser && !!firestoreDb;
    if (!runtimeHasActiveClientAuth) {
      return {
        isValid: false,
        authUid: null,
        status: 'CLOUD_PERMISSION_DENIED',
        error: 'Authenticated Firebase browser session is required before persisting V1 health data. Server-only or synthetic UID values are not permitted.',
      };
    }

    const currentAuthUser = firebaseAuth.currentUser;
    if (currentAuthUser) {
      if (currentAuthUser.uid !== suppliedUid.trim()) {
        return {
          isValid: false,
          authUid: currentAuthUser.uid,
          status: 'CLOUD_PERMISSION_DENIED',
          error: `UID mismatch: Supplied UID (${suppliedUid}) does not match authenticated Firebase UID (${currentAuthUser.uid}).`,
        };
      }
      return {
        isValid: true,
        authUid: currentAuthUser.uid,
        status: 'CLOUD_CONNECTED',
      };
    }

    return {
      isValid: false,
      authUid: null,
      status: 'CLOUD_AUTH_REQUIRED',
      error: 'Authenticated Firebase user session is unavailable.',
    };
  }

  // -------------------------------------------------------------
  // OBSERVATION WRITERS (/test, /day, /week, /month)
  // -------------------------------------------------------------

  async writeTestObservation(uid: string, data: any): Promise<DatabaseWriteResult> {
    const docId = data.id || data.observationId || (data.reportId ? `obs_test_${data.reportId}` : `obs_test_${Date.now()}`);
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'test',
        documentId: docId,
        uid: authUid,
        error: validation.error,
      };
    }

    const payload = {
      id: docId,
      observationId: docId,
      uid: validation.authUid!,
      userId: validation.authUid!,
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      temporalLevel: 'TEST',
      inputStages: data.inputStages || data.inputVector || [],
      matchedStages: data.matchedStages || data.matchedVector || [],
      matchedPattern: data.matchedPattern || data.pattern_label || data.patternInterpretation || '',
      classification: data.classification || data.primary_taxonomy || data.taxonomy?.primary || 'HEALTHY_NORMATIVE',
      severity: data.severity || data.severity_label || 'NORMAL',
      severityScore: typeof data.severityScore === 'number' ? data.severityScore : (parseFloat(data.severity_score) || 0),
      confidence: typeof data.confidence === 'number' ? data.confidence : (parseFloat(data.confidence_score) || 0.95),
      confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : (typeof data.confidence === 'number' ? data.confidence : (parseFloat(data.confidence_score) || 0.95)),
      matchStatus: data.matchStatus || data.matchType || 'EXACT',
      referenceDatasetSno: data.referenceDatasetSno ?? data.matchedSno ?? (typeof data.sno === 'string' ? parseInt(data.sno, 10) : data.sno) ?? 0,
      distanceScore: typeof data.distanceScore === 'number' ? data.distanceScore : (data.distance || 0),
      createdAt: data.createdAt || new Date().toISOString(),
      isFixture: Boolean(data.isFixture),
    };

    this.observationCache.set(docId, payload);

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return {
        success: false,
        status: 'CLOUD_PERMISSION_DENIED',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'test',
        documentId: docId,
        uid: validation.authUid!,
        error: 'Authenticated Firestore client is required before persisting test observations.',
      };
    }

    try {
      const docRef = doc(firestoreDb, 'test', docId);
      await setDoc(docRef, payload, { merge: true });

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        persistedLocation: 'FIRESTORE',
        collection: 'test',
        documentId: docId,
        uid: validation.authUid!,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'test',
        documentId: docId,
        uid: authUid,
        error: err.message,
      };
    }
  }

  async writeDayObservation(uid: string, data: any): Promise<DatabaseWriteResult> {
    const docId = data.id || data.observationId || (data.reportId ? `obs_day_${data.reportId}` : `obs_day_${Date.now()}`);
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'day',
        documentId: docId,
        uid: authUid,
        error: validation.error,
      };
    }

    const payload = {
      id: docId,
      observationId: docId,
      uid: validation.authUid!,
      userId: validation.authUid!,
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      temporalLevel: 'DAY',
      observationCount: data.observationCount || 3,
      observationIds: data.observationIds || data.testObservationIds || [],
      testObservationIds: data.testObservationIds || data.observationIds || [],
      testObservations: data.testObservations || [],
      inputStages: data.inputStages || [],
      matchedStages: data.matchedStages || [],
      matchedPattern: data.matchedPattern || '',
      classification: data.classification || 'NORMAL_BASELINE',
      secondaryTaxonomy: data.secondaryTaxonomy || '',
      severity: data.severity || 'NORMAL',
      severityScore: typeof data.severityScore === 'number' ? data.severityScore : 0,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.95,
      confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 0.95,
      confidenceLevel: data.confidenceLevel || 'HIGH',
      initialSeverity: data.initialSeverity || 'NORMAL',
      peakSeverity: data.peakSeverity || 'NORMAL',
      finalSeverity: data.finalSeverity || 'NORMAL',
      meanSeverity: typeof data.meanSeverity === 'number' ? data.meanSeverity : 0,
      trend: data.trend || 'STABLE',
      dominantPattern: data.dominantPattern || '',
      patternPersistence: typeof data.patternPersistence === 'number' ? data.patternPersistence : 1.0,
      matchStatus: data.matchStatus || 'EXACT',
      referenceDatasetSno: data.referenceDatasetSno ?? 0,
      distanceScore: typeof data.distanceScore === 'number' ? data.distanceScore : 0,
      qaStatus: data.qaStatus || 'Q/A_NOT_AVAILABLE',
      qaData: data.qaData || null,
      status: data.status || 'COMPLETED',
      isFixture: Boolean(data.isFixture),
      createdAt: data.createdAt || new Date().toISOString(),
    };

    this.observationCache.set(docId, payload);

    if (firebaseAuth?.currentUser?.uid === validation.authUid) {
      try {
        const docRef = doc(firestoreDb, 'day', docId);
        await setDoc(docRef, payload, { merge: true });

        return {
          success: true,
          status: 'CLOUD_CONNECTED',
          persistedLocation: 'FIRESTORE',
          collection: 'day',
          documentId: docId,
          uid: validation.authUid!,
        };
      } catch (err: any) {
        return {
          success: false,
          status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
          persistedLocation: 'LOCAL_SECURE_STORAGE',
          collection: 'day',
          documentId: docId,
          uid: authUid,
          error: err.message,
        };
      }
    }

    return {
      success: true,
      status: 'CLOUD_CONNECTED',
      persistedLocation: 'LOCAL_SECURE_STORAGE',
      collection: 'day',
      documentId: docId,
      uid: validation.authUid!,
    };
  }

  async writeWeekObservation(uid: string, data: any): Promise<DatabaseWriteResult> {
    const docId = data.id || data.observationId || (data.reportId ? `obs_week_${data.reportId}` : `obs_week_${Date.now()}`);
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'week',
        documentId: docId,
        uid: authUid,
        error: validation.error,
      };
    }

    const payload = {
      id: docId,
      observationId: docId,
      reportId: data.reportId || '',
      uid: validation.authUid!,
      userId: validation.authUid!,
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      temporalLevel: 'WEEK',
      observationCount: data.observationCount || 7,
      dayObservationIds: data.dayObservationIds || data.observationIds || [],
      dayObservations: data.dayObservations || [],
      inputStages: data.inputStages || [],
      matchedStages: data.matchedStages || [],
      matchedPattern: data.matchedPattern || '',
      classification: data.classification || 'NORMAL_BASELINE',
      secondaryTaxonomy: data.secondaryTaxonomy || '',
      severity: data.severity || 'NORMAL',
      severityScore: typeof data.severityScore === 'number' ? data.severityScore : 0,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.95,
      confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 0.95,
      confidenceLevel: data.confidenceLevel || 'HIGH',
      initialSeverity: data.initialSeverity || 'NORMAL',
      peakSeverity: data.peakSeverity || 'NORMAL',
      finalSeverity: data.finalSeverity || 'NORMAL',
      meanSeverity: typeof data.meanSeverity === 'number' ? data.meanSeverity : 0,
      trend: data.trend || 'STABLE',
      dominantPattern: data.dominantPattern || '',
      patternPersistence: typeof data.patternPersistence === 'number' ? data.patternPersistence : 1.0,
      matchStatus: data.matchStatus || 'EXACT',
      referenceDatasetSno: data.referenceDatasetSno ?? 0,
      distanceScore: typeof data.distanceScore === 'number' ? data.distanceScore : 0,
      conditionSummary: data.conditionSummary || '',
      status: data.status || 'COMPLETED',
      isFixture: Boolean(data.isFixture),
      createdAt: data.createdAt || new Date().toISOString(),
    };

    this.observationCache.set(docId, payload);

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return {
        success: false,
        status: 'CLOUD_PERMISSION_DENIED',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'week',
        documentId: docId,
        uid: validation.authUid!,
        error: 'Authenticated Firestore client is required before persisting week observations.',
      };
    }

    try {
      const docRef = doc(firestoreDb, 'week', docId);
      await setDoc(docRef, payload, { merge: true });

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        persistedLocation: 'FIRESTORE',
        collection: 'week',
        documentId: docId,
        uid: validation.authUid!,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'week',
        documentId: docId,
        uid: authUid,
        error: err.message,
      };
    }
  }

  async writeMonthObservation(uid: string, data: any): Promise<DatabaseWriteResult> {
    const docId = data.id || `obs_month_${Date.now()}`;
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'month',
        documentId: docId,
        uid: authUid,
        error: validation.error,
      };
    }

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return {
        success: false,
        status: 'CLOUD_PERMISSION_DENIED',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'month',
        documentId: docId,
        uid: validation.authUid!,
        error: 'Authenticated Firestore client is required before persisting month observations.',
      };
    }

    try {
      const docRef = doc(firestoreDb, 'month', docId);
      const payload = {
        id: docId,
        uid: validation.authUid!,
        userId: validation.authUid!,
        timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
        temporalLevel: 'MONTH',
        observationCount: data.observationCount || 84,
        trend: data.trend || 'STABLE',
        createdAt: data.createdAt || new Date().toISOString(),
      };

      await setDoc(docRef, payload, { merge: true });

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        persistedLocation: 'FIRESTORE',
        collection: 'month',
        documentId: docId,
        uid: validation.authUid!,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'month',
        documentId: docId,
        uid: authUid,
        error: err.message,
      };
    }
  }

  // -------------------------------------------------------------
  // REPORT WRITERS (/reports_test, /reports_day, /reports_week, /reports_month)
  // -------------------------------------------------------------

  async writeTestReport(uid: string, report: any): Promise<DatabaseWriteResult> {
    const reportId = report.reportId || `rep_test_${Date.now()}`;
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const cleanReport = {
      ...report,
      reportId,
      uid: authUid,
    };
    try {
      reportStore.saveReport(cleanReport);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);
    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_test',
        documentId: reportId,
        uid: authUid,
        error: validation.error,
      };
    }

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return {
        success: false,
        status: 'CLOUD_AUTH_REQUIRED',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_test',
        documentId: reportId,
        uid: validation.authUid!,
        error: 'Authenticated Firestore client is required before persisting test reports.',
      };
    }

    try {
      const reportRef = doc(firestoreDb, 'reports_test', reportId);
      const payload = {
        ...report,
        reportId,
        uid: validation.authUid!,
        userId: validation.authUid!,
        temporalLevel: report.temporalLevel || 'TEST',
        temporalObservationsCount: report.temporalObservationsCount || report.observationCount || 1,
        observationCount: report.observationCount || report.temporalObservationsCount || 1,
        formattedTitle: report.formattedTitle || report.title || `BAND REPORT — TEST`,
        classification: report.classification || report.taxonomy?.primary || report.severity?.label || 'NORMAL',
        severity: report.severity?.label || report.severity || 'NORMAL',
        severityScore: typeof report.severity?.score === 'number' ? report.severity.score : (parseFloat(report.severity?.score) || report.severityScore || 0),
        confidenceLevel: report.confidence?.level || report.confidenceLevel || 'HIGH',
        confidence: typeof report.confidence?.score === 'number' ? report.confidence.score : (parseFloat(report.confidence?.score) || report.confidenceScore || 0.95),
        confidenceScore: typeof report.confidence?.score === 'number' ? report.confidence.score : (parseFloat(report.confidence?.score) || report.confidenceScore || 0.95),
        trend: report.trend?.label || report.trend || 'N/A',
        matchStatus: report.matchedPattern?.matchStatus || report.matchStatus || 'EXACT',
        primaryPattern: report.patternInterpretation || report.primaryPattern || report.matchedPattern?.pattern_label || '',
        inputStages: report.matchedPattern?.inputStages || report.inputStages || [],
        matchedStages: report.matchedPattern?.matchedStages || report.matchedStages || [],
        referenceDatasetSno: report.matchedPattern?.matchedDatasetSno ?? report.referenceDatasetSno ?? 0,
        distanceScore: typeof report.matchedPattern?.distanceScore === 'number' ? report.matchedPattern.distanceScore : (report.distanceScore || 0),
        conditionSummary: report.conditionSummary || '',
        status: report.status || 'COMPLETED',
        createdAt: report.createdAt || new Date().toISOString(),
        isFixture: Boolean(report.isFixture),
      };

      await setDoc(reportRef, payload, { merge: true });

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        persistedLocation: 'FIRESTORE',
        collection: 'reports_test',
        documentId: reportId,
        uid: validation.authUid!,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_test',
        documentId: reportId,
        uid: authUid,
        error: err.message,
      };
    }
  }

  async writeDayReport(uid: string, report: any): Promise<DatabaseWriteResult> {
    const reportId = report.reportId || `rep_day_${Date.now()}`;
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);
    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_day',
        documentId: reportId,
        uid: authUid,
        error: validation.error,
      };
    }

    const payload = {
      ...report,
      reportId,
      uid: validation.authUid!,
      userId: validation.authUid!,
      temporalLevel: 'DAY',
      formattedTitle: report.formattedTitle || report.title || `BAND REPORT — DAY`,
      observationCount: report.observationCount || 3,
      testObservationIds: report.testObservationIds || report.observationIds || [],
      dayObservationId: report.dayObservationId || report.observationId || '',
      initialSeverity: report.initialSeverity || report.severity?.initialSeverity || 'NORMAL',
      peakSeverity: report.peakSeverity || report.severity?.peakSeverity || 'NORMAL',
      finalSeverity: report.finalSeverity || report.severity?.finalSeverity || 'NORMAL',
      meanSeverity: typeof report.meanSeverity === 'number' ? report.meanSeverity : typeof report.severity?.meanSeverity === 'number' ? report.severity.meanSeverity : 0.0,
      trend: report.trend?.label || report.trend || 'STABLE',
      confidence: typeof report.confidence?.score === 'number' ? report.confidence.score : (parseFloat(report.confidence?.score) || report.confidence || 0.90),
      confidenceScore: typeof report.confidenceScore === 'number' ? report.confidenceScore : 0.90,
      confidenceLevel: report.confidence?.level || report.confidenceLevel || 'HIGH',
      patternPersistence: typeof report.patternPersistence === 'number' ? report.patternPersistence : 1.0,
      dominantPattern: report.dominantPattern || 'Normative',
      matchStatus: report.matchedPattern?.matchStatus || report.matchStatus || 'EXACT',
      referenceDatasetSno: report.matchedPattern?.matchedDatasetSno ?? report.referenceDatasetSno ?? 0,
      distanceScore: typeof report.matchedPattern?.distanceScore === 'number' ? report.matchedPattern.distanceScore : (report.distanceScore || 0),
      qaStatus: report.homeQA?.status || report.qaStatus || 'Q/A_NOT_AVAILABLE',
      conditionSummary: report.conditionSummary || '',
      status: report.status || 'COMPLETED',
      createdAt: report.createdAt || new Date().toISOString(),
      isFixture: Boolean(report.isFixture),
    };

    reportStore.saveReport(payload as any);
    this.dayReportCache.set(reportId, payload);

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return {
        success: false,
        status: 'CLOUD_AUTH_REQUIRED',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_day',
        documentId: reportId,
        uid: validation.authUid!,
        error: 'Authenticated Firestore client is required before persisting day reports.',
      };
    }

    try {
      const reportRef = doc(firestoreDb, 'reports_day', reportId);
      await setDoc(reportRef, payload, { merge: true });

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        persistedLocation: 'FIRESTORE',
        collection: 'reports_day',
        documentId: reportId,
        uid: validation.authUid!,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_day',
        documentId: reportId,
        uid: authUid,
        error: err.message,
      };
    }
  }

  // -------------------------------------------------------------
  // HOME WEB Q/A WRITER & READER (/qa_sessions/{qaSessionId})
  // -------------------------------------------------------------

  async writeQA(uid: string, qaData: any): Promise<DatabaseWriteResult> {
    const docId = qaData.qaSessionId || qaData.qaId || qaData.id;
    if (!docId) throw new Error('qaSessionId is required for deterministic Q/A persistence');
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'qa',
        documentId: docId,
        uid: authUid,
        error: validation.error,
      };
    }

    const payload = {
      qaSessionId: docId,
      qaId: docId,
      id: docId,
      uid: validation.authUid!,
      userId: validation.authUid!,
      dayId: qaData.dayId || qaData.dayAssessmentId || '',
      questions: qaData.questions || [],
      answers: qaData.answers || qaData.responses || {},
      timestamp: qaData.timestamp || new Date().toISOString(),
      submittedAt: qaData.submittedAt || new Date().toISOString(),
      dayAssessmentId: qaData.dayAssessmentId || null,
      responses: qaData.responses || qaData.answers || {},
      notes: qaData.notes || '',
      status: qaData.status || 'SUBMITTED',
      createdAt: qaData.createdAt || new Date().toISOString(),
      expiresAt: qaData.expiresAt || new Date(new Date(qaData.createdAt || Date.now()).getTime() + 60 * 60 * 1000).toISOString(),
      answeredAt: qaData.answeredAt || null,
    };

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return { success: false, status: 'CLOUD_AUTH_REQUIRED', persistedLocation: 'NONE', collection: 'qa_sessions', documentId: docId, uid: validation.authUid!, error: 'An authenticated Firebase user is required for Q/A persistence.' };
    }
    try {
      await setDoc(doc(firestoreDb, 'qa_sessions', docId), payload, { merge: true });
      this.qaCache.set(docId, payload);
    } catch (err: any) {
      return { success: false, status: 'CLOUD_UNAVAILABLE', persistedLocation: 'NONE', collection: 'qa_sessions', documentId: docId, uid: validation.authUid!, error: err.message };
    }

    return {
      success: true,
      status: 'CLOUD_CONNECTED',
      persistedLocation: 'FIRESTORE',
      collection: 'qa_sessions',
      documentId: docId,
      uid: validation.authUid!,
    };
  }

  async getQA(uid: string, qaId: string): Promise<DatabaseReadResult> {
    const cloudRes = await this.readDocument('qa_sessions', qaId, uid);
    if (cloudRes.success && cloudRes.data) {
      return cloudRes;
    }
    const cached = this.qaCache.get(qaId);
    if (cached) {
      if (cached.uid !== uid) {
        return {
          success: false,
          status: 'CLOUD_PERMISSION_DENIED',
          location: 'NOT_FOUND',
          collection: 'qa_sessions',
          documentId: qaId,
          uid,
          error: 'Security rule violation: Authenticated user does not own this Q/A document.',
        };
      }
      return {
        success: true,
        status: 'LOCAL_ONLY',
        location: 'LOCAL_SECURE_STORAGE',
        collection: 'qa_sessions',
        documentId: qaId,
        uid,
        data: cached,
      };
    }
    return cloudRes;
  }

  // -------------------------------------------------------------
  // NOTIFICATION DISPATCHER & READER (/notifications/{notificationId})
  // -------------------------------------------------------------

  async writeNotification(uid: string, notificationData: any): Promise<DatabaseWriteResult> {
    const docId = notificationData.notificationId || notificationData.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'notifications',
        documentId: docId,
        uid: authUid,
        error: validation.error,
      };
    }

    const payload = {
      notificationId: docId,
      id: docId,
      uid: validation.authUid!,
      userId: validation.authUid!,
      reportId: notificationData.reportId || '',
      dayObservationId: notificationData.dayObservationId || '',
      weekObservationId: notificationData.weekObservationId || '',
      recipient: notificationData.recipient || 'USER',
      temporalLevel: notificationData.temporalLevel || 'DAY',
      classification: notificationData.classification || '',
      severity: notificationData.severity || 'NORMAL',
      trend: notificationData.trend || 'STABLE',
      reportStatus: notificationData.reportStatus || notificationData.status || 'COMPLETED',
      timestamp: notificationData.timestamp || new Date().toISOString(),
      delivered: notificationData.delivered ?? true,
      createdAt: notificationData.createdAt || new Date().toISOString(),
    };

    this.notificationCache.set(docId, payload);

    return {
      success: true,
      status: 'LOCAL_ONLY',
      persistedLocation: 'LOCAL_SECURE_STORAGE',
      collection: 'notifications',
      documentId: docId,
      uid: validation.authUid!,
    };
  }

  async getNotifications(uid: string): Promise<any[]> {
    const userNotifications: any[] = [];
    for (const notif of this.notificationCache.values()) {
      if (notif.uid === uid) {
        userNotifications.push(notif);
      }
    }
    return userNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // -------------------------------------------------------------
  // TEST & DAY OBSERVATION BATCH RETRIEVAL WITH SECURITY VALIDATION
  // -------------------------------------------------------------

  async getTestObservationsByIds(
    uid: string,
    testIds: string[]
  ): Promise<{ success: boolean; data?: any[]; error?: string; status: string }> {
    const validation = this.validateAuthenticatedOwnership(uid);
    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        error: validation.error,
      };
    }

    const observations: any[] = [];
    for (const testId of testIds) {
      const res = await this.getTestObservation(uid, testId);
      if (res.success && res.data) {
        if (res.data.uid !== validation.authUid) {
          return {
            success: false,
            status: 'UID_MISMATCH_REJECTED',
            error: `Security violation: Test observation ${testId} belongs to user ${res.data.uid}, not authenticated ${validation.authUid}`,
          };
        }
        observations.push(res.data);
      } else {
        // Check in-memory fallback
        const local = this.observationCache.get(testId);
        if (local) {
          if (local.uid !== validation.authUid) {
            return {
              success: false,
              status: 'UID_MISMATCH_REJECTED',
              error: `Security violation: Test observation ${testId} belongs to user ${local.uid}, not authenticated ${validation.authUid}`,
            };
          }
          observations.push(local);
        } else {
          return {
            success: false,
            status: 'NOT_FOUND',
            error: `TEST observation ${testId} not found in database`,
          };
        }
      }
    }

    return {
      success: true,
      status: 'CLOUD_CONNECTED',
      data: observations,
    };
  }

  async getTestObservationsByUid(uid: string, limitCount: number = 3): Promise<any[]> {
    const userTests: any[] = [];
    for (const obs of this.observationCache.values()) {
      if (obs.uid === uid && obs.temporalLevel === 'TEST') {
        userTests.push(obs);
      }
    }
    return userTests
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limitCount);
  }

  async getDayObservationsByIds(
    uid: string,
    dayIds: string[]
  ): Promise<{ success: boolean; data?: any[]; error?: string; status: string }> {
    const validation = this.validateAuthenticatedOwnership(uid);
    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        error: validation.error,
      };
    }

    const observations: any[] = [];
    for (const dayId of dayIds) {
      const res = await this.getDayObservation(uid, dayId);
      if (res.success && res.data) {
        if (res.data.uid !== validation.authUid) {
          return {
            success: false,
            status: 'UID_MISMATCH_REJECTED',
            error: `Security violation: Day observation ${dayId} belongs to user ${res.data.uid}, not authenticated ${validation.authUid}`,
          };
        }
        observations.push(res.data);
      } else {
        const local = this.observationCache.get(dayId);
        if (local) {
          if (local.uid !== validation.authUid) {
            return {
              success: false,
              status: 'UID_MISMATCH_REJECTED',
              error: `Security violation: Day observation ${dayId} belongs to user ${local.uid}, not authenticated ${validation.authUid}`,
            };
          }
          observations.push(local);
        } else {
          return {
            success: false,
            status: 'NOT_FOUND',
            error: `DAY observation ${dayId} not found in database`,
          };
        }
      }
    }

    return {
      success: true,
      status: 'CLOUD_CONNECTED',
      data: observations,
    };
  }

  async getWeekObservationsByIds(
    uid: string,
    weekIds: string[]
  ): Promise<{ success: boolean; data?: any[]; error?: string; status: string }> {
    const validation = this.validateAuthenticatedOwnership(uid);
    if (!validation.isValid) return { success: false, status: validation.status, error: validation.error };
    const observations: any[] = [];
    for (const weekId of weekIds) {
      const res = await this.getWeekObservation(uid, weekId);
      if (!res.success || !res.data) return { success: false, status: 'NOT_FOUND', error: `WEEK observation ${weekId} not found in database` };
      if (res.data.uid !== validation.authUid) return { success: false, status: 'UID_MISMATCH_REJECTED', error: `Security violation: WEEK observation ${weekId} belongs to another user` };
      observations.push(res.data);
    }
    return { success: true, status: 'CLOUD_CONNECTED', data: observations };
  }

  async getDayObservationsByUid(uid: string, limitCount: number = 7): Promise<any[]> {
    const userDays: any[] = [];
    for (const obs of this.observationCache.values()) {
      if (obs.uid === uid && obs.temporalLevel === 'DAY') {
        userDays.push(obs);
      }
    }
    return userDays
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limitCount);
  }

  async writeWeekReport(uid: string, report: any): Promise<DatabaseWriteResult> {
    const reportId = report.reportId || `rep_week_${Date.now()}`;
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_week',
        documentId: reportId,
        uid: authUid,
        error: validation.error,
      };
    }

    const payload = {
      ...report,
      reportId,
      weekObservationId: report.weekObservationId || report.observationId || '',
      uid: validation.authUid!,
      userId: validation.authUid!,
      temporalLevel: 'WEEK',
      formattedTitle: report.formattedTitle || report.title || `BAND REPORT — WEEK`,
      observationCount: report.observationCount || 7,
      dayObservationIds: report.dayObservationIds || report.observationIds || [],
      initialSeverity: report.initialSeverity || report.severity?.initialSeverity || 'NORMAL',
      peakSeverity: report.peakSeverity || report.severity?.peakSeverity || 'NORMAL',
      finalSeverity: report.finalSeverity || report.severity?.finalSeverity || 'NORMAL',
      meanSeverity: typeof report.meanSeverity === 'number' ? report.meanSeverity : typeof report.severity?.meanSeverity === 'number' ? report.severity.meanSeverity : 0.0,
      trend: report.trend?.label || report.trend || 'STABLE',
      confidence: typeof report.confidence?.score === 'number' ? report.confidence.score : (parseFloat(report.confidence?.score) || report.confidence || 0.95),
      confidenceScore: typeof report.confidenceScore === 'number' ? report.confidenceScore : 0.95,
      confidenceLevel: report.confidence?.level || report.confidenceLevel || 'HIGH',
      patternPersistence: typeof report.patternPersistence === 'number' ? report.patternPersistence : 1.0,
      dominantPattern: report.dominantPattern || 'Normative',
      matchStatus: report.matchedPattern?.matchStatus || report.matchStatus || 'EXACT',
      referenceDatasetSno: report.matchedPattern?.matchedDatasetSno ?? report.referenceDatasetSno ?? 0,
      distanceScore: typeof report.matchedPattern?.distanceScore === 'number' ? report.matchedPattern.distanceScore : (report.distanceScore || 0),
      conditionSummary: report.conditionSummary || '',
      status: report.status || 'COMPLETED',
      createdAt: report.createdAt || new Date().toISOString(),
      isFixture: Boolean(report.isFixture),
    };

    reportStore.saveReport(payload as any);
    this.weekReportCache.set(reportId, payload);

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return {
        success: false,
        status: 'CLOUD_AUTH_REQUIRED',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_week',
        documentId: reportId,
        uid: validation.authUid!,
        error: 'Authenticated Firestore client is required before persisting week reports.',
      };
    }

    try {
      const reportRef = doc(firestoreDb, 'reports_week', reportId);
      await setDoc(reportRef, payload, { merge: true });

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        persistedLocation: 'FIRESTORE',
        collection: 'reports_week',
        documentId: reportId,
        uid: validation.authUid!,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_week',
        documentId: reportId,
        uid: authUid,
        error: err.message,
      };
    }
  }

  async writeMonthReport(uid: string, report: any): Promise<DatabaseWriteResult> {
    const reportId = report.reportId || `rep_month_${Date.now()}`;
    
    // Ensure active authenticated Firebase session
    let authUid = uid;
    try {
      authUid = await this.ensureAuthenticated(uid);
    } catch {}

    const validation = this.validateAuthenticatedOwnership(authUid);

    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_month',
        documentId: reportId,
        uid: authUid,
        error: validation.error,
      };
    }

    if (!firestoreDb || firebaseAuth?.currentUser?.uid !== validation.authUid) {
      return {
        success: false,
        status: 'CLOUD_AUTH_REQUIRED',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_month',
        documentId: reportId,
        uid: validation.authUid!,
        error: 'Authenticated Firestore client is required before persisting month reports.',
      };
    }

    try {
      const reportRef = doc(firestoreDb, 'reports_month', reportId);
      const payload = {
        reportId,
        uid: validation.authUid!,
        userId: validation.authUid!,
        temporalLevel: 'MONTH',
        observationCount: report.observationCount || 84,
        trend: report.trend || 'STABLE',
        status: report.status || 'COMPLETED',
        createdAt: report.createdAt || new Date().toISOString(),
      };

      await setDoc(reportRef, payload, { merge: true });

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        persistedLocation: 'FIRESTORE',
        collection: 'reports_month',
        documentId: reportId,
        uid: validation.authUid!,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        persistedLocation: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_month',
        documentId: reportId,
        uid: authUid,
        error: err.message,
      };
    }
  }

  // -------------------------------------------------------------
  // OBSERVATION READERS (/test, /day, /week, /month)
  // -------------------------------------------------------------

  async getTestObservation(uid: string, id: string): Promise<DatabaseReadResult> {
    return this.readDocument('test', id, uid);
  }

  async getDayObservation(uid: string, id: string): Promise<DatabaseReadResult> {
    return this.readDocument('day', id, uid);
  }

  async getWeekObservation(uid: string, id: string): Promise<DatabaseReadResult> {
    return this.readDocument('week', id, uid);
  }

  async getMonthObservation(uid: string, id: string): Promise<DatabaseReadResult> {
    return this.readDocument('month', id, uid);
  }

  // -------------------------------------------------------------
  // REPORT READERS (/reports_test, /reports_day, /reports_week, /reports_month)
  // -------------------------------------------------------------

  async getTestReport(uid: string, id: string): Promise<DatabaseReadResult> {
    const cloudRes = await this.readDocument('reports_test', id, uid);
    if (cloudRes.success && cloudRes.data) {
      return cloudRes;
    }
    // Check local durable store fallback
    const localRep = reportStore.getReport(id, uid);
    if (localRep) {
      return {
        success: true,
        status: 'LOCAL_ONLY',
        location: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_test',
        documentId: id,
        uid,
        data: localRep,
      };
    }
    return cloudRes;
  }

  async getDayReport(uid: string, id: string): Promise<DatabaseReadResult> {
    const cloudRes = await this.readDocument('reports_day', id, uid);
    if (cloudRes.success && cloudRes.data) {
      return cloudRes;
    }
    const localRep = reportStore.getReport(id, uid);
    if (localRep) {
      return {
        success: true,
        status: 'LOCAL_ONLY',
        location: 'LOCAL_SECURE_STORAGE',
        collection: 'reports_day',
        documentId: id,
        uid,
        data: localRep,
      };
    }
    return cloudRes;
  }

  async getWeekReport(uid: string, id: string): Promise<DatabaseReadResult> {
    return this.readDocument('reports_week', id, uid);
  }

  async getMonthReport(uid: string, id: string): Promise<DatabaseReadResult> {
    return this.readDocument('reports_month', id, uid);
  }

  private async readDocument(collectionName: string, docId: string, uid: string): Promise<DatabaseReadResult> {
    const validation = this.validateAuthenticatedOwnership(uid);
    if (!validation.isValid) {
      return {
        success: false,
        status: validation.status,
        location: 'NOT_FOUND',
        collection: collectionName,
        documentId: docId,
        uid,
        error: validation.error,
      };
    }

    try {
      const docRef = doc(firestoreDb, collectionName, docId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        return {
          success: false,
          status: 'CLOUD_CONNECTED',
          location: 'NOT_FOUND',
          collection: collectionName,
          documentId: docId,
          uid,
          error: 'Document does not exist.',
        };
      }

      const data = snap.data();
      if (data.uid !== validation.authUid) {
        return {
          success: false,
          status: 'CLOUD_PERMISSION_DENIED',
          location: 'NOT_FOUND',
          collection: collectionName,
          documentId: docId,
          uid,
          error: 'Security rule violation: Authenticated user does not own this document.',
        };
      }

      return {
        success: true,
        status: 'CLOUD_CONNECTED',
        location: 'FIRESTORE',
        collection: collectionName,
        documentId: docId,
        uid: validation.authUid!,
        data,
      };
    } catch (err: any) {
      return {
        success: false,
        status: err.code === 'permission-denied' ? 'CLOUD_PERMISSION_DENIED' : 'CLOUD_UNAVAILABLE',
        location: 'NOT_FOUND',
        collection: collectionName,
        documentId: docId,
        uid,
        error: err.message,
      };
    }
  }

  // -------------------------------------------------------------
  // BACKWARDS COMPATIBILITY METHODS
  // -------------------------------------------------------------

  async saveTestReport(uid: string, report: any): Promise<DatabaseWriteResult> {
    return this.writeTestReport(uid, report);
  }

  async saveTestObservation(uid: string, result: any): Promise<DatabaseWriteResult> {
    return this.writeTestObservation(uid, result);
  }

  getStatus() {
    return this.getDatabaseStatus();
  }

  /**
   * Diagnostic Database Status API
   */
  getDatabaseStatus(): DatabaseStatusReport {
    const currentAuth = firebaseAuth?.currentUser;
    const isAuth = Boolean(currentAuth && currentAuth.uid);

    return {
      firebaseInitialized: Boolean(firebaseStatus.isConfigured),
      projectId: firebaseStatus.projectId || 'goatest-2525',
      authDomain: firebaseStatus.authDomain || 'goatest-2525.firebaseapp.com',
      authenticated: isAuth,
      uid: isAuth ? currentAuth!.uid : null,
      firestoreInitialized: Boolean(firestoreDb),
      firestoreReachable: Boolean(firebaseStatus.isConfigured && firestoreDb),
      connectionStatus: isAuth ? 'CLOUD_CONNECTED' : 'CLOUD_AUTH_REQUIRED',
      collections: {
        test: true,
        day: true,
        week: true,
        month: true,
        reports_test: true,
        reports_day: true,
        reports_week: true,
        reports_month: true,
      },
      capabilities: {
        read: true,
        write: isAuth,
      },
    };
  }
}

export const firestoreDatabaseService = new ConditionDatabaseService();
