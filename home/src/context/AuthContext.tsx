/**
 * GOATEST Global Authentication Context
 * Manages Firebase Authentication state, Firestore user profile persistence, and connection lifecycle.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import { authService } from '../services/authService';
import { userService, getCachedUserProfile } from '../services/userService';
import { phbService, type UserPhbRecord } from '../services/phbService';
import { getFirebaseConfig } from '../config/firebase';
import type { UserProfile, UserRole, AuthState, FirestoreConnectionStatus, MonitoredUser } from '../types';

export type ConnectionStatus = FirestoreConnectionStatus;

interface AuthContextType {
  authState: AuthState;
  currentUser: User | null;
  userProfile: UserProfile | null;
  phbRecord: UserPhbRecord | null;
  isFirebaseReady: boolean;
  isLoading: boolean;
  isProfileLoading: boolean;
  isPhbLoading: boolean;
  hasCheckedPhb: boolean;
  isPhbSkipped: boolean;
  connectionStatus: ConnectionStatus;
  profileError: string | null;
  phbError: string | null;
  role: UserRole;
  isConfigured: boolean;
  setPhbSkipped: (skipped: boolean) => void;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (
    email: string,
    pass: string,
    role: UserRole,
    displayName?: string,
    monitoredUserIds?: string[],
    monitoredUsers?: MonitoredUser[]
  ) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  reloadProfile: () => Promise<void>;
  retryLoadProfile: () => Promise<void>;
  refreshPhb: () => Promise<UserPhbRecord | null>;
  savePhb: (phbData: Partial<UserPhbRecord>) => Promise<UserPhbRecord>;
  updateUserProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>('AUTH_LOADING');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [phbRecord, setPhbRecord] = useState<UserPhbRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);
  const [isPhbLoading, setIsPhbLoading] = useState<boolean>(false);
  const [hasCheckedPhb, setHasCheckedPhb] = useState<boolean>(false);
  const [isPhbSkipped, setIsPhbSkipped] = useState<boolean>(false);
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [phbError, setPhbError] = useState<string | null>(null);

  const userProfileRef = React.useRef<UserProfile | null>(null);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const config = getFirebaseConfig();
  const configured = Boolean(config && config.apiKey && config.projectId);

  const loadProfileForUser = useCallback(async (user: User): Promise<UserProfile | null> => {
    const cachedProfile = getCachedUserProfile(user.uid);
    if (cachedProfile) {
      setUserProfile(cachedProfile);
      setConnectionStatus('ONLINE');
    }
    setIsProfileLoading(true);
    setConnectionStatus('CONNECTING');
    setProfileError(null);

    try {
      const profile = await userService.getUserProfile(user.uid, {
        email: user.email || '',
        displayName: user.displayName || undefined,
      });

      if (profile) {
        setUserProfile(profile);
        setConnectionStatus('ONLINE');
        setProfileError(null);
        return profile;
      } else {
        setConnectionStatus('ONLINE');
        setProfileError(null);
        return null;
      }
    } catch (err: unknown) {
      const isOffline =
        err instanceof Error &&
        (err.message === 'OFFLINE' ||
          err.message.includes('offline') ||
          err.message.includes('backend'));

      if (isOffline) {
        setConnectionStatus('OFFLINE');
        if (!userProfileRef.current) {
          setProfileError('Unable to connect to database. Please check your connection.');
        }
      } else {
        setConnectionStatus('ERROR');
        setProfileError('Unable to load account.');
      }
      return null;
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const loadPhbForUser = useCallback(async (user: User): Promise<UserPhbRecord | null> => {
    setIsPhbLoading(true);
    setPhbError(null);
    try {
      const record = await phbService.getUserPhb(user.uid);
      setPhbRecord(record);
      setPhbError(null);
      setHasCheckedPhb(true);
      return record;
    } catch (err) {
      console.warn('[GOATEST] PHB check notice:', err);
      setPhbError('Unable to load PHB');
      setHasCheckedPhb(true);
      return null;
    } finally {
      setIsPhbLoading(false);
    }
  }, []);

  // Track if listener is already registered to prevent duplicate listeners
  const listenerRegistered = useRef(false);

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      setIsFirebaseReady(false);
      setConnectionStatus('OFFLINE');
      setAuthState('AUTH_SIGNED_OUT');
      return;
    }

    // Prevent duplicate listener registration
    if (listenerRegistered.current) {
      return;
    }
    listenerRegistered.current = true;

    setIsFirebaseReady(true);
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        setAuthState('AUTHENTICATED');
        // Concurrently resolve profile and canonical PHB
        await Promise.allSettled([
          loadProfileForUser(user),
          loadPhbForUser(user),
        ]);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setPhbRecord(null);
        setHasCheckedPhb(false);
        setIsPhbSkipped(false);
        setProfileError(null);
        setAuthState('AUTH_SIGNED_OUT');
        setConnectionStatus('ONLINE');
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      listenerRegistered.current = false;
    };
  }, [configured, loadProfileForUser, loadPhbForUser]);

  const signIn = async (email: string, pass: string) => {
    setIsLoading(true);
    setProfileError(null);
    try {
      const user = await authService.signIn(email, pass);
      setCurrentUser(user);
      setAuthState('AUTHENTICATED');
      await Promise.allSettled([
        loadProfileForUser(user),
        loadPhbForUser(user),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    pass: string,
    role: UserRole,
    displayName?: string,
    monitoredUserIds?: string[],
    monitoredUsers?: MonitoredUser[]
  ) => {
    setIsLoading(true);
    setProfileError(null);
    try {
      const res = await authService.signUp(email, pass, role, displayName, monitoredUserIds, monitoredUsers);
      setCurrentUser(res.user);
      setUserProfile(res.profile);
      setPhbRecord(null);
      setHasCheckedPhb(true);
      setIsPhbSkipped(false);
      setAuthState('AUTHENTICATED');
      setConnectionStatus('ONLINE');
      setProfileError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setCurrentUser(null);
      setUserProfile(null);
      setPhbRecord(null);
      setHasCheckedPhb(false);
      setIsPhbSkipped(false);
      setProfileError(null);
      setAuthState('AUTH_SIGNED_OUT');
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await authService.sendPasswordReset(email);
  };

  const reloadProfile = async () => {
    if (currentUser) {
      await Promise.allSettled([
        loadProfileForUser(currentUser),
        loadPhbForUser(currentUser),
      ]);
    }
  };

  const retryLoadProfile = async () => {
    if (currentUser) {
      await Promise.allSettled([
        loadProfileForUser(currentUser),
        loadPhbForUser(currentUser),
      ]);
    }
  };

  const refreshPhb = async (): Promise<UserPhbRecord | null> => {
    if (currentUser) {
      return await loadPhbForUser(currentUser);
    }
    return null;
  };

  const savePhb = async (phbData: Partial<UserPhbRecord>): Promise<UserPhbRecord> => {
    if (!currentUser) {
      throw new Error('Authentication is required to save PHB.');
    }
    setIsPhbLoading(true);
    try {
      const saved = await phbService.saveUserPhb(currentUser.uid, phbData);
      setPhbRecord(saved);
      setHasCheckedPhb(true);
      return saved;
    } finally {
      setIsPhbLoading(false);
    }
  };

  const updateUserProfile = async (updates: { displayName?: string; photoURL?: string }): Promise<void> => {
    if (!currentUser) {
      throw new Error('User must be authenticated to update profile.');
    }
    await authService.updateUserProfile(currentUser.uid, updates);
    setUserProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const effectiveRole: UserRole = userProfile?.role || 'USER';

  return (
    <AuthContext.Provider
      value={{
        authState,
        currentUser,
        userProfile,
        phbRecord,
        isFirebaseReady,
        isLoading,
        isProfileLoading,
        isPhbLoading,
        hasCheckedPhb,
        isPhbSkipped,
        connectionStatus,
        profileError,
        phbError,
        role: effectiveRole,
        isConfigured: configured,
        setPhbSkipped: setIsPhbSkipped,
        signIn,
        signUp,
        signOut,
        sendPasswordReset,
        reloadProfile,
        retryLoadProfile,
        refreshPhb,
        savePhb,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
