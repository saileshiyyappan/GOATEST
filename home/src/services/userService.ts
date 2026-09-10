/**
 * GOATEST User Profile Service
 * Manages user documents in the shared Firestore database.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, handleFirestoreError, OperationType } from '../config/firebase';
import type { UserProfile, EmergencyContact, LocationSettings, NotificationSettings, MonitoredUser, CaretakerConnection } from '../types';
import { getCaretakerConnectionNotificationId } from './notificationContract';

const COLLECTION_USERS = 'users';
const COLLECTION_PUBLIC_USER_IDS = 'public_user_ids';
const LOCAL_STORAGE_KEY_PREFIX = 'goatest_user_profile_';
export const PUBLIC_USER_ID_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

function parseCaretakerConnection(value: unknown): CaretakerConnection {
  if (!value || typeof value !== 'object') throw new Error('CARETAKER_RESPONSE_INVALID');
  const candidate = value as Record<string, unknown>;
  const caretakerUid = typeof candidate.caretakerUid === 'string' ? candidate.caretakerUid.trim() : '';
  const caretakerName = typeof candidate.caretakerName === 'string' ? candidate.caretakerName.trim() : '';
  const caretakerPublicId = typeof candidate.caretakerPublicId === 'string' ? candidate.caretakerPublicId.trim().toUpperCase() : '';
  if (!caretakerUid || !caretakerName || !PUBLIC_USER_ID_PATTERN.test(caretakerPublicId)) throw new Error('CARETAKER_RESPONSE_INVALID');
  return { caretakerUid, caretakerName, caretakerPublicId };
}

function profileName(profile: Partial<UserProfile>): string {
  return (profile.name || profile.displayName || profile.email?.split('@')[0] || 'Name unavailable').trim();
}

export interface PublicAccountIdentity {
  uid: string;
  publicId: string;
  role: 'USER' | 'CARETAKER';
  name: string;
  displayName: string;
}

function mapPublicIdLookupError(error: unknown): never {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code.includes('permission-denied')) throw new Error('PERMISSION_DENIED');
  if (code.includes('unavailable') || code.includes('deadline') || code.includes('network')) {
    throw new Error('NETWORK_ERROR');
  }
  throw error;
}

async function publishPublicIdIndex(profile: UserProfile): Promise<void> {
  const db = getFirebaseDb();
  const publicId = (profile.uniqueId || profile.displayId || '').trim().toUpperCase();
  if (!db || !profile.uid || !PUBLIC_USER_ID_PATTERN.test(publicId)) return;
  const indexRef = doc(db, COLLECTION_PUBLIC_USER_IDS, publicId);
  const existing = await withRetry(() => getDoc(indexRef));
  if (existing.exists() && (existing.data() as Record<string, unknown>).uid !== profile.uid) {
    throw new Error('PUBLIC_ID_MAPPING_CONFLICT');
  }
  await setDoc(indexRef, {
    uid: profile.uid,
    publicId,
    role: profile.role,
    name: profileName(profile),
    displayName: profileName(profile),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function resolvePublicAccountId(publicId: string): Promise<PublicAccountIdentity | null> {
  const cleanId = publicId.trim().toUpperCase();
  if (!PUBLIC_USER_ID_PATTERN.test(cleanId)) throw new Error('INVALID_PUBLIC_ID');
  const db = getFirebaseDb();
  if (!db) return null;
  let snapshot;
  try {
    snapshot = await withRetry(() => getDoc(doc(db, COLLECTION_PUBLIC_USER_IDS, cleanId)));
  } catch (error) {
    mapPublicIdLookupError(error);
  }
  if (!snapshot.exists()) return null;
  const value = snapshot.data() as Record<string, unknown>;
  if (
    typeof value.uid !== 'string' ||
    (value.role !== 'USER' && value.role !== 'CARETAKER') ||
    value.publicId !== cleanId
  ) return null;
  return {
    uid: value.uid,
    publicId: cleanId,
    role: value.role,
    name: typeof value.name === 'string' ? value.name : '',
    displayName: typeof value.displayName === 'string' ? value.displayName : '',
  };
}

export function getCachedUserProfile(uid: string): UserProfile | null {
  if (!uid || typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`);
    return stored ? JSON.parse(stored) as UserProfile : null;
  } catch {
    return null;
  }
}

/**
 * Generates a persistent, unique 6-character alphanumeric Account ID (letters + numbers).
 * E.g., '3UCYLG', 'BUN59Y'
 */
export function generateDisplayId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Bounded retry helper for transient network and Firestore connection errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isTransient =
        msg.includes('offline') ||
        msg.includes('unavailable') ||
        msg.includes('network') ||
        msg.includes('backend') ||
        msg.includes('deadline');

      // Do not retry permission denials or schema errors
      if (!isTransient || attempt === retries - 1) {
        throw err;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * Math.pow(1.5, attempt))
      );
    }
  }
  throw lastError;
}

export const userService = {
  /**
   * Fetches user profile from Firestore.
   * Only executes Firestore query when Firebase Auth confirmed an active session.
   * If Firestore is offline, safely falls back to local cached profile.
   * If profile genuinely does not exist and fallback info is provided, recovers/creates it.
   */
  async getUserProfile(
    uid: string,
    fallbackInfo?: { email?: string; displayName?: string }
  ): Promise<UserProfile | null> {
    if (!uid) return null;

    // Check Firebase Auth state first to prevent unauthenticated Firestore calls
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) {
      // Auth session not established yet. Return local cache if available without querying Firestore.
      try {
        const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`);
        if (stored) {
          return JSON.parse(stored) as UserProfile;
        }
      } catch {
        // Ignore
      }
      return null;
    }

    const db = getFirebaseDb();

    if (db) {
      const path = `${COLLECTION_USERS}/${uid}`;
      try {
        const docRef = doc(db, COLLECTION_USERS, uid);
        const snapshot = await withRetry(() => getDoc(docRef));

        if (snapshot.exists()) {
          const profile = snapshot.data() as UserProfile;
          // Ensure uniqueId and displayId are synchronized
          const effectiveUniqueId = profile.uniqueId || profile.displayId || '';
          const effectiveName = profile.name || profile.displayName || profile.email?.split('@')[0] || 'User';
          
          let needsUpdate = false;
          if (effectiveUniqueId && (!profile.uniqueId || !profile.displayId)) {
            profile.uniqueId = effectiveUniqueId;
            profile.displayId = effectiveUniqueId;
            needsUpdate = true;
          }
          if (!profile.name) {
            profile.name = effectiveName;
            profile.displayName = effectiveName;
            needsUpdate = true;
          }

          if (needsUpdate) {
            this.updateUserProfile(uid, {
              uniqueId: profile.uniqueId,
              displayId: profile.displayId,
              name: profile.name,
              displayName: profile.displayName,
            }).catch(() => {});
          }

          // Cache in local storage for offline resilience
          try {
            localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`, JSON.stringify(profile));
          } catch {
            // Ignore storage quota errors
          }
          publishPublicIdIndex(profile).catch(() => {});
          return profile;
        } else if (fallbackInfo && fallbackInfo.email) {
          // Recover missing profile for authenticated user
          const generatedId = generateDisplayId();
          const determinedName = fallbackInfo.displayName || fallbackInfo.email.split('@')[0];
          const newProfile: UserProfile = {
            uid,
            uniqueId: generatedId,
            displayId: generatedId,
            name: determinedName,
            displayName: determinedName,
            email: fallbackInfo.email,
            role: 'USER',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            themePreference: 'DEFAULT',
          };
          return await this.createUserProfile(newProfile);
        }
        return null;
      } catch (error: unknown) {
        // Distinguish offline / network errors
        const isOffline =
          error instanceof Error &&
          (error.message.includes('offline') ||
            error.message.includes('unavailable') ||
            error.message.includes('Could not reach Cloud Firestore backend'));

        if (!isOffline) {
          try {
            handleFirestoreError(error, OperationType.GET, path);
          } catch {
            // Handled
          }
        }

        // Fallback to local storage cached profile
        try {
          const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`);
          if (stored) {
            return JSON.parse(stored) as UserProfile;
          }
        } catch {
          // Ignore parse errors
        }

        // If offline and fallback info is available from authenticated session, build in-memory profile
        if (fallbackInfo && fallbackInfo.email) {
          const fallbackProfile: UserProfile = {
            uid,
            displayId: generateDisplayId(),
            email: fallbackInfo.email,
            displayName: fallbackInfo.displayName || fallbackInfo.email.split('@')[0],
            role: 'USER',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            themePreference: 'DEFAULT',
          };
          try {
            localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`, JSON.stringify(fallbackProfile));
          } catch {
            // Ignore
          }
          return fallbackProfile;
        }

        if (isOffline) {
          return null;
        }
        throw error;
      }
    }

    // No Firestore db instance configured - check local cache
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`);
      if (stored) {
        return JSON.parse(stored) as UserProfile;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  /**
   * Creates a new user profile document in Firestore and verifies write before returning.
   * Throws if write fails to ensure registration state integrity.
   */
  async createUserProfile(profile: UserProfile): Promise<UserProfile> {
    const finalUniqueId = profile.uniqueId || profile.displayId || generateDisplayId();
    const finalName = profile.name || profile.displayName || profile.email?.split('@')[0] || 'User';

    const finalProfile: UserProfile = {
      ...profile,
      uniqueId: finalUniqueId,
      displayId: finalUniqueId,
      name: finalName,
      displayName: finalName,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      themePreference: profile.themePreference || 'DEFAULT',
    };

    if (profile.role === 'CARETAKER') {
      finalProfile.monitoredUserIds = profile.monitoredUserIds || [];
      finalProfile.monitoredUsers = profile.monitoredUsers || [];
    }

    const db = getFirebaseDb();
    if (!db) {
      // Save to local storage for local preview
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${finalProfile.uid}`, JSON.stringify(finalProfile));
      } catch {
        // Ignore
      }
      return finalProfile;
    }

    const path = `${COLLECTION_USERS}/${finalProfile.uid}`;
    try {
      const docRef = doc(db, COLLECTION_USERS, finalProfile.uid);
      
      // Write to Firestore with bounded retry
      await withRetry(() => setDoc(docRef, finalProfile));

      // Verify Firestore write succeeded
      const verifySnap = await withRetry(() => getDoc(docRef));
      if (!verifySnap.exists()) {
        throw new Error('Profile document verification failed in Firestore.');
      }

      const confirmed = verifySnap.data() as UserProfile;

      // Update local storage cache on verified success
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${finalProfile.uid}`, JSON.stringify(confirmed));
      } catch {
        // Ignore storage errors
      }

      await publishPublicIdIndex(confirmed);

      return confirmed;
    } catch (error: unknown) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  /**
   * Updates partial profile attributes in Firestore and local cache.
   */
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    // 1. Update local cache
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`);
      if (stored) {
        const current = JSON.parse(stored);
        const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`, JSON.stringify(updated));
      }
    } catch {
      // Ignore
    }

    const db = getFirebaseDb();
    if (!db) return;

    const path = `${COLLECTION_USERS}/${uid}`;
    try {
      const docRef = doc(db, COLLECTION_USERS, uid);
      await withRetry(() =>
        updateDoc(docRef, {
          ...updates,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } catch {
        // Handled
      }
    }
  },

  /**
   * Finds a user by their persistent 6-character Unique ID / Account ID (uniqueId or displayId).
   */
  async findUserByDisplayId(displayId: string): Promise<UserProfile | null> {
    const cleanId = displayId.trim().toUpperCase();
    if (!cleanId) return null;

    const db = getFirebaseDb();
    if (db) {
      const indexed = await resolvePublicAccountId(cleanId);
      if (indexed) {
        const targetSnapshot = await withRetry(() => getDoc(doc(db, COLLECTION_USERS, indexed.uid)));
        if (targetSnapshot.exists()) {
          const target = targetSnapshot.data() as UserProfile;
          if (target.uid === indexed.uid && target.uniqueId === cleanId && target.role === indexed.role) return target;
        }
      }
      return null;
    }

    // Check local storage cached profiles for offline fallback
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
          const data = localStorage.getItem(key);
          if (data) {
            const profile = JSON.parse(data) as UserProfile;
            if (
              profile.displayId?.toUpperCase() === cleanId ||
              profile.uniqueId?.toUpperCase() === cleanId ||
              profile.uid === cleanId
            ) {
              return profile;
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    return null;
  },

  /** User-initiated direct Firestore caretaker bond. The public ID index resolves
   * the display identifier without exposing a users collection query. */
  async linkCaretakerByPublicId(userUid: string, caretakerPublicId: string, caretakerName: string): Promise<CaretakerConnection> {
    const cleanId = caretakerPublicId.trim().toUpperCase();
    if (!PUBLIC_USER_ID_PATTERN.test(cleanId)) throw new Error('CARETAKER_ID_MUST_BE_SIX_CHARACTERS');
    const auth = getFirebaseAuth();
    if (!auth?.currentUser || auth.currentUser.uid !== userUid) throw new Error('USER_AUTHORIZATION_FAILED');
    const cleanName = caretakerName.trim();
    if (!cleanName || cleanName.length > 80 || /[^\p{L}\p{M}0-9 .,'-]/u.test(cleanName)) throw new Error('CARETAKER_NAME_INVALID');
    const db = getFirebaseDb();
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE');
    const source = await this.getUserProfile(userUid);
    if (!source || source.role !== 'USER') throw new Error('USER_ROLE_REQUIRED');
    const indexed = await resolvePublicAccountId(cleanId);
    if (!indexed) throw new Error('PUBLIC_ID_NOT_FOUND');
    if (indexed.role !== 'CARETAKER') throw new Error('ROLE_MISMATCH');
    if (indexed.uid === userUid) throw new Error('SELF_BOND');

    const caretakerRef = doc(db, COLLECTION_USERS, indexed.uid);
    const caretakerSnapshot = await withRetry(() => getDoc(caretakerRef));
    if (!caretakerSnapshot.exists()) throw new Error('PUBLIC_ID_NOT_FOUND');
    const caretaker = caretakerSnapshot.data() as UserProfile;
    if (caretaker.uid !== indexed.uid || caretaker.uniqueId !== cleanId || caretaker.role !== 'CARETAKER') throw new Error('ROLE_MISMATCH');
    const monitoredIds = caretaker.monitoredUserIds || [];
    if (monitoredIds.includes(userUid)) throw new Error('ALREADY_CONNECTED');

    const sourceName = profileName(source);
    const connection: MonitoredUser = {
      name: sourceName,
      uniqueId: source.uniqueId || source.displayId || userUid,
      firebaseUid: userUid,
      relationshipName: cleanName,
      linkedAt: new Date().toISOString(),
    };
    const monitoredUsers = [...(caretaker.monitoredUsers || []), connection];
    const timestamp = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(caretakerRef, {
      monitoredUserIds: [...monitoredIds, userUid],
      monitoredUsers,
      updatedAt: timestamp,
    });
    batch.set(doc(db, 'notifications', getCaretakerConnectionNotificationId(userUid, indexed.uid, userUid)), {
      uid: userUid,
      userId: userUid,
      type: 'SYSTEM',
      title: 'Caretaker Connection',
      body: `${cleanName} has been added as your caretaker.`,
      read: false,
      timestamp,
      sourceUserUid: userUid,
      sourceUserPublicId: source.uniqueId || source.displayId || null,
      sourceUserName: sourceName,
      recipientRole: 'USER',
      actionTab: 'settings',
    });
    batch.set(doc(db, 'notifications', getCaretakerConnectionNotificationId(userUid, indexed.uid, indexed.uid)), {
      uid: indexed.uid,
      userId: indexed.uid,
      type: 'SYSTEM',
      title: 'Caretaker Connection',
      body: `You are now connected to ${sourceName}.`,
      read: false,
      timestamp,
      sourceUserUid: userUid,
      sourceUserPublicId: source.uniqueId || source.displayId || null,
      sourceUserName: sourceName,
      recipientRole: 'CARETAKER',
      actionTab: 'settings',
    });
    await withRetry(() => batch.commit());

    const verified = await withRetry(() => getDoc(caretakerRef));
    const verifiedData = verified.data() as UserProfile | undefined;
    if (!verified.exists() || !verifiedData?.monitoredUserIds?.includes(userUid)) throw new Error('CARETAKER_BOND_VERIFICATION_FAILED');
    return {
      caretakerUid: indexed.uid,
      caretakerName: profileName(verifiedData),
      caretakerPublicId: (verifiedData.uniqueId || verifiedData.displayId || cleanId).toUpperCase(),
    };
  },

  async unlinkCaretakerByPublicId(userUid: string, caretakerPublicId: string): Promise<void> {
    const cleanId = caretakerPublicId.trim().toUpperCase();
    if (!PUBLIC_USER_ID_PATTERN.test(cleanId)) throw new Error('CARETAKER_ID_MUST_BE_SIX_CHARACTERS');
    const auth = getFirebaseAuth();
    if (!auth?.currentUser || auth.currentUser.uid !== userUid) throw new Error('USER_AUTHORIZATION_FAILED');
    const db = getFirebaseDb();
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE');
    const indexed = await resolvePublicAccountId(cleanId);
    if (!indexed) throw new Error('PUBLIC_ID_NOT_FOUND');
    if (indexed.role !== 'CARETAKER') throw new Error('ROLE_MISMATCH');
    if (indexed.uid === userUid) throw new Error('SELF_BOND');
    const caretakerRef = doc(db, COLLECTION_USERS, indexed.uid);
    const snapshot = await withRetry(() => getDoc(caretakerRef));
    if (!snapshot.exists()) throw new Error('PUBLIC_ID_NOT_FOUND');
    const caretaker = snapshot.data() as UserProfile;
    if (caretaker.uid !== indexed.uid || caretaker.uniqueId !== cleanId || caretaker.role !== 'CARETAKER') throw new Error('ROLE_MISMATCH');
    const updatedIds = (caretaker.monitoredUserIds || []).filter((id) => id !== userUid);
    const updatedUsers = (caretaker.monitoredUsers || []).filter((entry) => entry.firebaseUid !== userUid);
    if (updatedIds.length === (caretaker.monitoredUserIds || []).length) return;
    const batch = writeBatch(db);
    batch.update(caretakerRef, { monitoredUserIds: updatedIds, monitoredUsers: updatedUsers, updatedAt: new Date().toISOString() });
    await withRetry(() => batch.commit());
    const verified = await withRetry(() => getDoc(caretakerRef));
    if ((verified.data() as UserProfile | undefined)?.monitoredUserIds?.includes(userUid)) throw new Error('CARETAKER_UNBOND_VERIFICATION_FAILED');
  },

  async getCaretakerLinks(userUid: string): Promise<CaretakerConnection[]> {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser || auth.currentUser.uid !== userUid) throw new Error('USER_AUTHORIZATION_FAILED');
    const db = getFirebaseDb();
    if (!db) return [];
    const q = query(collection(db, COLLECTION_USERS), where('role', '==', 'CARETAKER'), where('monitoredUserIds', 'array-contains', userUid));
    const snapshot = await withRetry(() => getDocs(q));
    return snapshot.docs.map((item) => {
      const caretaker = item.data() as UserProfile;
      const relation = (caretaker.monitoredUsers || []).find((entry) => entry.firebaseUid === userUid);
      return parseCaretakerConnection({
        caretakerUid: item.id,
        caretakerName: profileName(caretaker),
        caretakerPublicId: caretaker.uniqueId || caretaker.displayId || '',
        relationshipName: relation?.relationshipName,
      });
    });
  },

  /**
   * Links a monitored User (with name, uniqueId, and firebaseUid) to a Caretaker profile.
   */
  async linkMonitoredUser(
    caretakerUid: string,
    target: string | { name?: string; uniqueId: string }
  ): Promise<MonitoredUser | null> {
    if (!caretakerUid) return null;
    const existing = await this.getUserProfile(caretakerUid);
    if (!existing) return null;

    const targetUniqueId = (typeof target === 'string' ? target : target.uniqueId || '').trim().toUpperCase();
    const targetProvidedName = (typeof target === 'string' ? '' : (target.name || '')).trim();

    if (!targetUniqueId) return null;

    // 1. Try to find the target user document to get the authoritative Firebase UID and name
    const foundUser = await this.findUserByDisplayId(targetUniqueId);

    if (!foundUser?.uid) throw new Error('PUBLIC_ID_NOT_FOUND');
    if (foundUser.uid === caretakerUid) throw new Error('SELF_BOND');
    if (foundUser.role !== 'USER') throw new Error('ROLE_MISMATCH');
    const firebaseUid = foundUser.uid;
    if ((existing.monitoredUserIds || []).includes(firebaseUid)) throw new Error('ALREADY_CONNECTED');
    const name = targetProvidedName || foundUser?.name || foundUser?.displayName || 'User';
    const uniqueId = foundUser?.uniqueId || foundUser?.displayId || targetUniqueId;

    const newMonitoredUser: MonitoredUser = {
      name,
      uniqueId,
      firebaseUid,
      linkedAt: new Date().toISOString(),
    };

    // 2. Update monitoredUsers (object array) & monitoredUserIds (string array for security rules)
    const existingList: MonitoredUser[] = (existing.monitoredUsers || []).filter(
      (u) => u.firebaseUid !== firebaseUid && u.uniqueId !== uniqueId
    );
    existingList.push(newMonitoredUser);

    const updatedIds = Array.from(
      new Set([...(existing.monitoredUserIds || []).filter((id) => id !== firebaseUid), firebaseUid])
    );

    const db = getFirebaseDb();
    if (!db) throw new Error('FIRESTORE_UNAVAILABLE');
    const timestamp = new Date().toISOString();
    const targetName = foundUser.name || foundUser.displayName || 'Name unavailable';
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION_USERS, caretakerUid), {
      monitoredUsers: existingList,
      monitoredUserIds: updatedIds,
      updatedAt: timestamp,
    });
    batch.set(doc(db, 'notifications', getCaretakerConnectionNotificationId(firebaseUid, caretakerUid, firebaseUid)), {
      uid: firebaseUid,
      userId: firebaseUid,
      type: 'SYSTEM',
      title: 'Caretaker Connection',
      body: `${profileName(existing)} is now connected to you.`,
      timestamp,
      read: false,
      actionTab: 'settings',
      sourceUserUid: firebaseUid,
      sourceUserPublicId: uniqueId,
      sourceUserName: targetName,
      sourceCaretakerUid: caretakerUid,
      recipientRole: 'USER',
    });
    await withRetry(() => batch.commit());

    return newMonitoredUser;
  },

  /**
   * Unlinks a monitored User from a Caretaker profile by identifier (firebaseUid or uniqueId).
   */
  async unlinkMonitoredUser(caretakerUid: string, targetIdentifier: string): Promise<void> {
    if (!caretakerUid || !targetIdentifier) return;
    const existing = await this.getUserProfile(caretakerUid);
    if (!existing) return;

    const cleanTarget = targetIdentifier.trim();

    const updatedUsers = (existing.monitoredUsers || []).filter(
      (u) => u.firebaseUid !== cleanTarget && u.uniqueId !== cleanTarget && u.uniqueId.toUpperCase() !== cleanTarget.toUpperCase()
    );

    const updatedIds = (existing.monitoredUserIds || []).filter(
      (id) => id !== cleanTarget
    );

    await this.updateUserProfile(caretakerUid, {
      monitoredUsers: updatedUsers,
      monitoredUserIds: updatedIds,
    });
  },

  // =========================================================================
  // EMERGENCY CONTACTS (Max 5, isolated under user UID)
  // =========================================================================

  /**
   * Retrieves emergency contacts for the user.
   */
  async getEmergencyContacts(uid: string): Promise<EmergencyContact[]> {
    if (!uid) return [];
    const profile = await this.getUserProfile(uid);
    return profile?.emergencyContacts || [];
  },

  /**
   * Adds or updates an emergency contact (enforcing max 5 contacts limit).
   */
  async saveEmergencyContact(
    uid: string,
    contactData: Omit<EmergencyContact, 'id' | 'createdAt'> & { id?: string }
  ): Promise<EmergencyContact> {
    if (!uid) throw new Error('User ID required');
    const profile = await this.getUserProfile(uid);
    const existingList = profile?.emergencyContacts ? [...profile.emergencyContacts] : [];

    const isEdit = !!contactData.id;
    let contactId = contactData.id || `emg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    if (!isEdit && existingList.length >= 5) {
      throw new Error('Maximum of 5 emergency contacts permitted.');
    }

    const newContact: EmergencyContact = {
      id: contactId,
      name: contactData.name.trim(),
      phone: contactData.phone.trim(),
      relationship: contactData.relationship || 'Other',
      isPrimary: contactData.isPrimary || (existingList.length === 0),
      notifyOnAlert: contactData.notifyOnAlert !== false,
      notes: contactData.notes?.trim() || '',
      createdAt: isEdit
        ? (existingList.find((c) => c.id === contactId)?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
    };

    let updatedList: EmergencyContact[];
    if (isEdit) {
      updatedList = existingList.map((c) => (c.id === contactId ? newContact : c));
    } else {
      // If marking as primary, demote others
      if (newContact.isPrimary) {
        existingList.forEach((c) => { c.isPrimary = false; });
      }
      updatedList = [...existingList, newContact];
    }

    // If new contact is primary, ensure other contacts are not primary
    if (newContact.isPrimary) {
      updatedList = updatedList.map((c) => (c.id === contactId ? { ...c, isPrimary: true } : { ...c, isPrimary: false }));
    }

    await this.updateUserProfile(uid, { emergencyContacts: updatedList });
    return newContact;
  },

  /**
   * Deletes an emergency contact by ID.
   */
  async deleteEmergencyContact(uid: string, contactId: string): Promise<void> {
    if (!uid || !contactId) return;
    const profile = await this.getUserProfile(uid);
    const existingList = profile?.emergencyContacts || [];
    const updatedList = existingList.filter((c) => c.id !== contactId);

    // If deleted contact was primary and others exist, set first remaining as primary
    if (existingList.find((c) => c.id === contactId)?.isPrimary && updatedList.length > 0) {
      updatedList[0].isPrimary = true;
    }

    await this.updateUserProfile(uid, { emergencyContacts: updatedList });
  },

  /**
   * Sets a specific emergency contact as the primary contact.
   */
  async setPrimaryEmergencyContact(uid: string, contactId: string): Promise<void> {
    if (!uid || !contactId) return;
    const profile = await this.getUserProfile(uid);
    const existingList = profile?.emergencyContacts || [];
    const updatedList = existingList.map((c) => ({
      ...c,
      isPrimary: c.id === contactId,
    }));
    await this.updateUserProfile(uid, { emergencyContacts: updatedList });
  },

  // =========================================================================
  // LOCATION SETTINGS & PERMISSION
  // =========================================================================

  /**
   * Retrieves location settings for a user.
   */
  async getLocationSettings(uid: string): Promise<LocationSettings> {
    if (!uid) {
      return { sharingEnabled: false, permissionStatus: 'PROMPT', lastKnownCoordinates: null };
    }
    const profile = await this.getUserProfile(uid);
    return (
      profile?.locationSettings || {
        sharingEnabled: false,
        permissionStatus: 'PROMPT',
        lastKnownCoordinates: null,
      }
    );
  },

  /**
   * Updates location settings for a user.
   */
  async updateLocationSettings(
    uid: string,
    settings: Partial<LocationSettings>
  ): Promise<LocationSettings> {
    const current = await this.getLocationSettings(uid);
    const updated: LocationSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    await this.updateUserProfile(uid, { locationSettings: updated });
    return updated;
  },

  // =========================================================================
  // NOTIFICATION SETTINGS
  // =========================================================================

  /**
   * Retrieves notification settings for a user.
   */
  async getNotificationSettings(uid: string): Promise<NotificationSettings> {
    if (!uid) {
      return {
        assessmentReminders: true,
        testCompletedAlerts: true,
        reportReadyAlerts: true,
        c50ConditionAlerts: true,
        caretakerNotifications: true,
        emergencyAlerts: true,
        browserPermission: typeof Notification !== 'undefined' ? (Notification.permission as any) : 'unsupported',
      };
    }
    const profile = await this.getUserProfile(uid);
    const defaults: NotificationSettings = {
      assessmentReminders: true,
      testCompletedAlerts: true,
      reportReadyAlerts: true,
      c50ConditionAlerts: true,
      caretakerNotifications: true,
      emergencyAlerts: true,
      browserPermission: typeof Notification !== 'undefined' ? (Notification.permission as any) : 'unsupported',
    };
    return {
      ...defaults,
      ...(profile?.notificationSettings || {}),
      browserPermission: typeof Notification !== 'undefined' ? (Notification.permission as any) : 'unsupported',
    };
  },

  /**
   * Updates notification settings for a user.
   */
  async updateNotificationSettings(
    uid: string,
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const current = await this.getNotificationSettings(uid);
    const updated: NotificationSettings = {
      ...current,
      ...settings,
    };
    await this.updateUserProfile(uid, { notificationSettings: updated });
    return updated;
  },
};
