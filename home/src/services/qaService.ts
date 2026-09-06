/**
 * GOATEST Q/A Session Service & Pipeline Architecture
 * 
 * Flow:
 * Firebase Auth -> currentUser.uid -> fetch required test/session records -> verify 3 required tests completed -> collect stored results -> Q/A Session pipeline -> Q/A UI
 * 
 * Rules:
 * - REQUIRED COMPLETED TESTS = 3
 * - ZERO fake health readings or fabricated AI conclusions.
 * - Clear pipeline contract ready for future physiological reasoning model integration.
 */

import { getFirebaseDb } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { validateFirestoreReadAuth, handleFirestoreReadError } from './firestoreAuthGuard';
import { reportService } from './reportService';
import { reportDatabaseService } from './reportDatabaseService';

export const REQUIRED_COMPLETED_TESTS = 3;

export interface TestSessionSummary {
  id: string;
  type: string;
  timestamp: string;
  status: 'COMPLETED' | 'PENDING' | 'IN_PROGRESS';
}

export interface QaEligibilityResult {
  isEligible: boolean;
  completedCount: number;
  requiredCount: number;
  remainingCount: number;
  completedSessions: TestSessionSummary[];
}

export interface QaPipelineStatus {
  state: 'INITIALIZING' | 'STANDBY' | 'READY_FOR_REASONING' | 'LOCKED';
  message: string;
  eligibility: QaEligibilityResult;
}

export const qaService = {
  /**
   * Evaluates test completion eligibility for Q/A Session.
   * Reads real completed test records from Firestore / local storage.
   */
  async checkEligibility(userId: string): Promise<QaEligibilityResult> {
    if (!userId || userId === 'guest_user') {
      return {
        isEligible: false,
        completedCount: 0,
        requiredCount: REQUIRED_COMPLETED_TESTS,
        remainingCount: REQUIRED_COMPLETED_TESTS,
        completedSessions: [],
      };
    }

    const sessions: TestSessionSummary[] = [];

    // 1. Check test_sessions collection in Firestore
    const authCheck = validateFirestoreReadAuth('test_sessions', userId, 'userId');
    const db = getFirebaseDb();
    if (db && authCheck.allowed) {
      try {
        const sessionsRef = collection(db, 'test_sessions');
        const q = query(sessionsRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.status === 'COMPLETED') {
            sessions.push({
              id: d.id,
              type: data.type || 'Standard Health Assessment',
              timestamp: data.completedAt || data.timestamp || new Date().toISOString(),
              status: 'COMPLETED',
            });
          }
        });
      } catch (err) {
        handleFirestoreReadError(err, 'test_sessions', userId);
      }
    }

    // 2. Also check tests in reportDatabaseService
    if (sessions.length < REQUIRED_COMPLETED_TESTS) {
      try {
        const rawTests = await reportDatabaseService.getUserTests(userId);
        rawTests.forEach((t) => {
          if (t.status === 'COMPLETED' && !sessions.some((s) => s.id === t.testId)) {
            sessions.push({
              id: t.testId,
              type: t.organ ? `${t.organ} Assessment` : `${t.target} Assessment`,
              timestamp: t.timestamp,
              status: 'COMPLETED',
            });
          }
        });
      } catch {
        // Ignore
      }
    }

    // 3. Also check reports if needed
    if (sessions.length < REQUIRED_COMPLETED_TESTS) {
      try {
        const reports = await reportService.getReports(userId);
        reports.forEach((r) => {
          if (!sessions.some((s) => s.id === r.id)) {
            sessions.push({
              id: r.id,
              type: r.organTested ? `${r.organTested} Assessment` : r.category || 'Completed Assessment',
              timestamp: r.timestamp,
              status: 'COMPLETED',
            });
          }
        });
      } catch {
        // Ignore
      }
    }

    const completedCount = sessions.length;
    const isEligible = completedCount >= REQUIRED_COMPLETED_TESTS;
    const remainingCount = Math.max(0, REQUIRED_COMPLETED_TESTS - completedCount);

    return {
      isEligible,
      completedCount,
      requiredCount: REQUIRED_COMPLETED_TESTS,
      remainingCount,
      completedSessions: sessions,
    };
  },

  /**
   * Initializes the Q/A pipeline contract state.
   */
  async getQaPipelineStatus(userId: string): Promise<QaPipelineStatus> {
    const eligibility = await this.checkEligibility(userId);

    if (!eligibility.isEligible) {
      return {
        state: 'LOCKED',
        message: `Complete all ${REQUIRED_COMPLETED_TESTS} required tests to start Q/A Session. (${eligibility.completedCount}/${REQUIRED_COMPLETED_TESTS} completed)`,
        eligibility,
      };
    }

    return {
      state: 'STANDBY',
      message: 'Q/A Physiological Pipeline Standby. All required test records verified. Ready for reasoning model connection.',
      eligibility,
    };
  },
};
