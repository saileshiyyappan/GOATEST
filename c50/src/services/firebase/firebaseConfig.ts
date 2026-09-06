import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const clientEnv: Record<string, string | undefined> = typeof import.meta !== 'undefined'
  ? ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {})
  : {};
const serverEnv: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {};

export interface FirebaseConnectionStatus {
  isConfigured: boolean;
  projectId: string | null;
  authDomain: string | null;
  authConfigured: boolean;
  firestoreConfigured: boolean;
  missingConfig: string[];
}

export const firebaseConfig = {
  apiKey: clientEnv.VITE_FIREBASE_API_KEY || serverEnv.VITE_FIREBASE_API_KEY || 'AIzaSyCCni4MCHaH-n3Cw5z_3W4avHtggO8k6mY',
  authDomain: clientEnv.VITE_FIREBASE_AUTH_DOMAIN || serverEnv.VITE_FIREBASE_AUTH_DOMAIN || 'goatest-2525.firebaseapp.com',
  projectId: clientEnv.VITE_FIREBASE_PROJECT_ID || serverEnv.VITE_FIREBASE_PROJECT_ID || 'goatest-2525',
  storageBucket: clientEnv.VITE_FIREBASE_STORAGE_BUCKET || serverEnv.VITE_FIREBASE_STORAGE_BUCKET || 'goatest-2525.firebasestorage.app',
  messagingSenderId: clientEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || serverEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '130097609402',
  appId: clientEnv.VITE_FIREBASE_APP_ID || serverEnv.VITE_FIREBASE_APP_ID || '1:130097609402:web:f7492a4363bda7c06e2083',
};

// C50 is server-owned in the unified HOME architecture. Do not initialize a
// browser Firebase client while this module is loaded by HOME's server.
const isBrowserRuntime = typeof window !== 'undefined';
export const firebaseApp = (isBrowserRuntime
  ? (!getApps().length ? initializeApp(firebaseConfig) : getApp())
  : null) as FirebaseApp;

// Initialize Auth and Firestore
export const firebaseAuth = (isBrowserRuntime ? getAuth(firebaseApp) : null) as any;
export const firestoreDb: Firestore = (isBrowserRuntime ? getFirestore(firebaseApp) : null) as any;

export const firebaseStatus: FirebaseConnectionStatus = {
  isConfigured: true,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  authConfigured: true,
  firestoreConfigured: true,
  missingConfig: []
};

/**
 * Returns the currently authenticated Firebase UID.
 * No fallback default account is allowed for V1 health-data writes.
 */
export async function getAuthenticatedUserUid(): Promise<string> {
  if (firebaseAuth?.currentUser?.uid) {
    return firebaseAuth.currentUser.uid;
  }

  throw new Error('A signed-in Firebase user is required. No default or guest account is allowed for V1 health-data writes.');
}

/** Returns a real Firebase ID token for browser-to-server requests. */
export async function getAuthenticatedIdToken(): Promise<string> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('A signed-in Firebase user is required');
  return user.getIdToken();
}

/**
 * Initializes and listens for authenticated user session with real Firebase credentials.
 */
export function initializeAuthSession(onUser: (uid: string | null) => void): () => void {
  if (!firebaseAuth) {
    onUser(null);
    return () => undefined;
  }
  const unsubscribe = onAuthStateChanged(firebaseAuth, (user: User | null) => {
    onUser(user?.uid ?? null);
  });

  return unsubscribe;
}
