/**
 * GOATEST Authentication Service
 * Integrates Firebase Authentication with verified profile persistence.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, waitForFirebaseAuthPersistence } from '../config/firebase';
import { userService, generateDisplayId } from './userService';
import type { UserProfile, UserRole, MonitoredUser } from '../types';

export const authService = {
  /**
   * Signs in with email and password using Firebase Authentication.
   */
  async signIn(email: string, pass: string): Promise<User> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Authentication service is not configured.');
    }
    await waitForFirebaseAuthPersistence();
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return cred.user;
  },

  /**
   * Registers a new user (USER or CARETAKER) and verifies that their Firestore profile is persisted.
   * Flow: Firebase Auth user created -> Obtain UID -> Generate displayId -> Create /users/{uid} -> Verify -> Complete
   */
  async signUp(
    email: string,
    pass: string,
    role: UserRole,
    displayName?: string,
    monitoredUserIds?: string[],
    monitoredUsers?: MonitoredUser[]
  ): Promise<{ user: User; profile: UserProfile }> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Authentication service is not configured.');
    }
    await waitForFirebaseAuthPersistence();

    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const user = cred.user;

    const now = new Date().toISOString();
    const resolvedName = displayName?.trim() || email.split('@')[0];
    const generatedUniqueId = generateDisplayId();
    const initialProfile: UserProfile = {
      uid: user.uid,
      uniqueId: generatedUniqueId,
      displayId: generatedUniqueId,
      name: resolvedName,
      displayName: resolvedName,
      email: user.email || email.trim(),
      role,
      monitoredUserIds: role === 'CARETAKER' ? (monitoredUserIds || []) : undefined,
      monitoredUsers: role === 'CARETAKER' ? (monitoredUsers || []) : undefined,
      createdAt: now,
      updatedAt: now,
      themePreference: 'DEFAULT',
    };

    // Save profile to Firestore with verification
    const verifiedProfile = await userService.createUserProfile(initialProfile);

    return { user, profile: verifiedProfile };
  },

  /**
   * Signs out current user from Firebase.
   */
  async signOut(): Promise<void> {
    const auth = getFirebaseAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
  },

  /**
   * Sends password reset email via Firebase.
   */
  async sendPasswordReset(email: string): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Authentication service is not configured.');
    }
    await sendPasswordResetEmail(auth, email.trim());
  },

  /**
   * Listens for Firebase Auth state changes.
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    const auth = getFirebaseAuth();
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Returns current authenticated Firebase User.
   */
  getCurrentUser(): User | null {
    const auth = getFirebaseAuth();
    return auth ? auth.currentUser : null;
  },

  /**
   * Updates display name and photoURL in Firebase Auth and Firestore.
   */
  async updateUserProfile(
    uid: string,
    updates: { displayName?: string; photoURL?: string }
  ): Promise<void> {
    const auth = getFirebaseAuth();
    if (auth && auth.currentUser) {
      try {
        // Firebase Auth rejects emoji/sticker values as photoURL (HTTP 400).
        // Those values are intentionally stored in Firestore and rendered by the UI.
        const authUpdates: { displayName?: string; photoURL?: string | null } = {};
        if (updates.displayName !== undefined) authUpdates.displayName = updates.displayName;
        if (updates.photoURL && /^https?:\/\//i.test(updates.photoURL)) authUpdates.photoURL = updates.photoURL;
        if (Object.keys(authUpdates).length > 0) await firebaseUpdateProfile(auth.currentUser, authUpdates);
      } catch (err) {
        console.warn('[authService] Firebase Auth profile update unavailable; Firestore profile will still be saved:', err);
      }
    }

    // Persist to Firestore
    await userService.updateUserProfile(uid, updates);
  }
};
