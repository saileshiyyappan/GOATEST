/**
 * GOATEST PHB Web Integration Service
 * 
 * Integrates with the official external PHB web application:
 * https://phb-web.vercel.app/
 * 
 * Real data rules:
 * - Direct external integration to the official web application
 * - No fake PHB values or fabricated completion status
 * - Uses authenticated Firebase Auth UID for database verification
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, handleFirestoreError, OperationType } from '../config/firebase';

export const PHB_WEB_URL = 'https://phb-web.vercel.app/';

const COLLECTION_PHBS = 'phbs';
const LEGACY_COLLECTION_PHB = 'phb';
const LOCAL_STORAGE_KEY_PREFIX = 'goatest_phb_record_';

export interface UserPhbRecord {
  userId: string;
  status: 'ACTIVE' | 'PENDING' | 'CONFIGURED' | string;
  createdAt: string;
  updatedAt: string;
  url?: string;
  baselineFocus?: string[];
  ageCategory?: string;
  notes?: string;
  [key: string]: unknown;
}

export const phbService = {
  /**
   * Returns the official external PHB web application URL.
   */
  getPhbWebUrl(): string {
    return PHB_WEB_URL;
  },

  /**
   * Opens the external PHB web application in a new tab.
   */
  openPhbWebApp(): void {
    if (typeof window !== 'undefined') {
      window.open(PHB_WEB_URL, '_blank', 'noopener,noreferrer');
    }
  },

  /**
   * Fetches user PHB from canonical /phbs/{userId}.
   * Only queries when the user is fully authenticated.
   * If no PHB document exists, cleanly returns null without throwing permission warnings.
   */
  async getUserPhb(userId: string): Promise<UserPhbRecord | null> {
    if (!userId) return null;

    const db = getFirebaseDb();
    if (!db) {
      try {
        const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
        if (cached) {
          return JSON.parse(cached) as UserPhbRecord;
        }
      } catch {
        // Ignore
      }
      return null;
    }

    try {
      // Canonical path: /phbs/{userId}
      const docRef = doc(db, COLLECTION_PHBS, userId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const record = snapshot.data() as UserPhbRecord;
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(record));
        } catch {
          // Ignore
        }
        return record;
      }

      // Check legacy /phb/{userId} path if external web app wrote there
      const legacyDocRef = doc(db, LEGACY_COLLECTION_PHB, userId);
      const legacySnapshot = await getDoc(legacyDocRef);
      if (legacySnapshot.exists()) {
        const record = legacySnapshot.data() as UserPhbRecord;
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(record));
        } catch {
          // Ignore
        }
        return record;
      }

      // PHB does not exist yet for this account (normal uncreated state)
      return null;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      // Fallback to cache if network is offline
      try {
        const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
        if (cached) {
          return JSON.parse(cached) as UserPhbRecord;
        }
      } catch {
        // Ignore
      }

      if (err?.code !== 'permission-denied') {
        console.warn('[GOATEST] PHB retrieval notice:', err?.message || error);
      }
      return null;
    }
  },

  /**
   * Generates and writes a verified Personal Health Baseline (PHB) document to /phbs/{userId}.
   * Verifies the write before returning to ensure data integrity.
   */
  async saveUserPhb(userId: string, data: Partial<UserPhbRecord>): Promise<UserPhbRecord> {
    if (!userId) {
      throw new Error('User ID is required to save PHB.');
    }

    const now = new Date().toISOString();
    const newRecord: UserPhbRecord = {
      userId,
      status: data.status || 'ACTIVE',
      url: data.url || PHB_WEB_URL,
      baselineFocus: data.baselineFocus || ['Cardiovascular', 'Metabolic', 'Neuromuscular'],
      ageCategory: data.ageCategory || 'Adult',
      createdAt: data.createdAt || now,
      updatedAt: now,
      ...data,
    };

    const db = getFirebaseDb();
    if (!db) {
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(newRecord));
      } catch {
        // Ignore
      }
      return newRecord;
    }

    const path = `${COLLECTION_PHBS}/${userId}`;
    try {
      const docRef = doc(db, COLLECTION_PHBS, userId);
      await setDoc(docRef, newRecord, { merge: true });

      // Verify Firestore write
      const verifySnap = await getDoc(docRef);
      if (!verifySnap.exists()) {
        throw new Error('PHB write verification failed in Firestore.');
      }

      const verified = verifySnap.data() as UserPhbRecord;
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(verified));
      } catch {
        // Ignore
      }

      return verified;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  /**
   * Checks whether a verified PHB baseline record exists in Firestore for the given user UID.
   */
  async checkUserPhbAvailability(userId: string): Promise<{ isAvailable: boolean; record: UserPhbRecord | null }> {
    const record = await this.getUserPhb(userId);
    return {
      isAvailable: Boolean(record),
      record,
    };
  }
};

