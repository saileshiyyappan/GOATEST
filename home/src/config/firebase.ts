/**
 * GOATEST Firebase Integration
 * Common Firebase backend for GOATEST ecosystem modules.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  type Firestore,
  doc,
  getDoc,
} from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const STORAGE_KEY_CUSTOM_CONFIG = 'goatest_firebase_config';
const LEGACY_STORAGE_KEY = 'goatest_p25_firebase_config';

/**
 * Retrieves Firebase configuration from environment, applet config, or local runtime override.
 */
export function getFirebaseConfig(): FirebaseConfigOptions | null {
  // 1. Check local storage override first (configured in UI if env vars missing)
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_CONFIG) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  // 2. Check Vite environment variables
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: envStorageBucket || `${envProjectId}.appspot.com`,
      messagingSenderId: envMessagingSenderId || '',
      appId: envAppId || '',
    };
  }

  // 3. Check firebase-applet-config.json if it contains apiKey & projectId
  const jsonConfig = appletConfig as unknown as Partial<FirebaseConfigOptions>;
  if (jsonConfig?.apiKey && jsonConfig?.projectId) {
    return {
      apiKey: jsonConfig.apiKey,
      authDomain: jsonConfig.authDomain || `${jsonConfig.projectId}.firebaseapp.com`,
      projectId: jsonConfig.projectId,
      storageBucket: jsonConfig.storageBucket || `${jsonConfig.projectId}.appspot.com`,
      messagingSenderId: jsonConfig.messagingSenderId || '',
      appId: jsonConfig.appId || '',
    };
  }

  return null;
}

export function saveCustomFirebaseConfig(config: FirebaseConfigOptions): void {
  localStorage.setItem(STORAGE_KEY_CUSTOM_CONFIG, JSON.stringify(config));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function clearCustomFirebaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_CUSTOM_CONFIG);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let authPersistenceReady: Promise<void> = Promise.resolve();

export function initializeFirebase(): { app: FirebaseApp | null; auth: Auth | null; db: Firestore | null; isConfigured: boolean } {
  const config = getFirebaseConfig();

  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, auth: null, db: null, isConfigured: false };
  }

  try {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    // Explicitly configure browser session persistence
    authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[GOATEST] Auth persistence warning:', err);
    });

    try {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
      });
    } catch {
      db = getFirestore(app);
    }

    return { app, auth, db, isConfigured: true };
  } catch (error) {
    console.error('[GOATEST] Firebase initialization error:', error);
    return { app: null, auth: null, db: null, isConfigured: false };
  }
}

export function waitForFirebaseAuthPersistence(): Promise<void> {
  return authPersistenceReady;
}

export const initializeP25Firebase = initializeFirebase;

export const { app: firebaseApp, auth: firebaseAuth, db: firestoreDb, isConfigured: isFirebaseConfigured } = initializeFirebase();
export const p25App = firebaseApp;
export const p25Auth = firebaseAuth;
export const p25Db = firestoreDb;

export function getFirebaseAuth(): Auth | null {
  if (!auth) {
    const res = initializeFirebase();
    auth = res.auth;
  }
  return auth;
}

export const getP25Auth = getFirebaseAuth;

export function getFirebaseDb(): Firestore | null {
  if (!db) {
    const res = initializeFirebase();
    db = res.db;
  }
  return db;
}

export const getP25Db = getFirebaseDb;
export const getP25Firestore = getFirebaseDb;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = getFirebaseAuth();
  const user = currentAuth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
    },
    operationType,
    path,
  };
  console.warn('[GOATEST] Firestore Notice:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirebaseConnection(): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;
  try {
    const docRef = doc(database, 'system', 'connection_test');
    await getDoc(docRef);
    return true;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable'))) {
      console.warn('[GOATEST] Firestore connection in offline/cached mode.');
    }
    return false;
  }
}

export const testP25Connection = testFirebaseConnection;
