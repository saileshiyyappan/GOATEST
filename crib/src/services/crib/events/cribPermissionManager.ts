/**
 * CRIB Permission Manager
 * Centralized device & browser permission coordinator for emergency operations.
 * GOATEST - PMT-9
 *
 * Supported Permissions:
 *  - CALL
 *  - NOTIFICATIONS
 *  - LOCATION
 *  - AUDIO
 *
 * Explicit Permission States:
 *  - NOT_REQUESTED
 *  - GRANTED
 *  - DENIED
 *  - UNAVAILABLE
 */

import {
  CribPermissionType,
  CribPermissionStatus,
  CribPermissionMap,
} from '../../../types/cribEvents';

type PermissionListener = (permissions: CribPermissionMap) => void;

class CribPermissionManagerImpl {
  private permissions: CribPermissionMap = {
    CALL: 'NOT_REQUESTED',
    NOTIFICATIONS: 'NOT_REQUESTED',
    LOCATION: 'NOT_REQUESTED',
    AUDIO: 'NOT_REQUESTED',
  };

  private listeners: Set<PermissionListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.detectInitialCapabilities();
  }

  /**
   * Detects real browser capabilities without forcing popups
   */
  public detectInitialCapabilities(): void {
    // 1. NOTIFICATIONS
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = Notification.permission;
      if (perm === 'granted') {
        this.permissions.NOTIFICATIONS = 'GRANTED';
      } else if (perm === 'denied') {
        this.permissions.NOTIFICATIONS = 'DENIED';
      } else {
        this.permissions.NOTIFICATIONS = 'NOT_REQUESTED';
      }
    } else {
      this.permissions.NOTIFICATIONS = 'UNAVAILABLE';
    }

    // 2. LOCATION
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      if (this.permissions.LOCATION === 'NOT_REQUESTED') {
        // Query permissions API if available
        if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
          try {
            navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((res) => {
              if (res.state === 'granted') {
                this.updatePermission('LOCATION', 'GRANTED');
              } else if (res.state === 'denied') {
                this.updatePermission('LOCATION', 'DENIED');
              } else {
                this.updatePermission('LOCATION', 'NOT_REQUESTED');
              }
            }).catch(() => {
              // Ignore unsupported query permission
            });
          } catch {
            // Geolocation permissions query not supported
          }
        }
      }
    } else {
      this.permissions.LOCATION = 'UNAVAILABLE';
    }

    // 3. AUDIO
    if (
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    ) {
      if (this.permissions.AUDIO === 'NOT_REQUESTED') {
        this.permissions.AUDIO = 'NOT_REQUESTED';
      }
    } else {
      this.permissions.AUDIO = 'UNAVAILABLE';
    }

    // 4. CALL (Platform phone / tel capability detection)
    if (typeof window !== 'undefined') {
      // In web browser, calling is available if tel: links can be dispatched
      this.permissions.CALL = 'NOT_REQUESTED';
    } else {
      this.permissions.CALL = 'UNAVAILABLE';
    }

    this.isInitialized = true;
  }

  /**
   * Returns current snapshot of all permissions
   */
  public getAllPermissions(): CribPermissionMap {
    return { ...this.permissions };
  }

  /**
   * Returns status for a single permission
   */
  public getPermission(type: CribPermissionType): CribPermissionStatus {
    return this.permissions[type];
  }

  /**
   * Explicitly request permission from browser/platform
   */
  public async requestPermission(type: CribPermissionType): Promise<CribPermissionStatus> {
    switch (type) {
      case 'NOTIFICATIONS':
        return this.requestNotificationPermission();

      case 'LOCATION':
        return this.requestLocationPermission();

      case 'AUDIO':
        return this.requestAudioPermission();

      case 'CALL':
        return this.requestCallPermission();

      default:
        return 'UNAVAILABLE';
    }
  }

  private async requestNotificationPermission(): Promise<CribPermissionStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.updatePermission('NOTIFICATIONS', 'UNAVAILABLE');
      return 'UNAVAILABLE';
    }

    try {
      const result = await Notification.requestPermission();
      const status: CribPermissionStatus =
        result === 'granted' ? 'GRANTED' : result === 'denied' ? 'DENIED' : 'NOT_REQUESTED';
      this.updatePermission('NOTIFICATIONS', status);
      return status;
    } catch (err) {
      console.warn('[CRIB_PERMISSION] Notification request error:', err);
      this.updatePermission('NOTIFICATIONS', 'DENIED');
      return 'DENIED';
    }
  }

  private async requestLocationPermission(): Promise<CribPermissionStatus> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.updatePermission('LOCATION', 'UNAVAILABLE');
      return 'UNAVAILABLE';
    }

    return new Promise<CribPermissionStatus>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          this.updatePermission('LOCATION', 'GRANTED');
          resolve('GRANTED');
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            this.updatePermission('LOCATION', 'DENIED');
            resolve('DENIED');
          } else {
            this.updatePermission('LOCATION', 'UNAVAILABLE');
            resolve('UNAVAILABLE');
          }
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  }

  private async requestAudioPermission(): Promise<CribPermissionStatus> {
    if (typeof window === 'undefined') {
      this.updatePermission('AUDIO', 'UNAVAILABLE');
      return 'UNAVAILABLE';
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      this.updatePermission('AUDIO', 'UNAVAILABLE');
      return 'UNAVAILABLE';
    }

    try {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (ctx.state === 'running' || ctx.state === 'suspended') {
        this.updatePermission('AUDIO', 'GRANTED');
        ctx.close().catch(() => {});
        return 'GRANTED';
      }
      this.updatePermission('AUDIO', 'DENIED');
      return 'DENIED';
    } catch {
      this.updatePermission('AUDIO', 'DENIED');
      return 'DENIED';
    }
  }

  private async requestCallPermission(): Promise<CribPermissionStatus> {
    // Calling permission in web apps is determined by user opt-in in CRIB settings
    this.updatePermission('CALL', 'GRANTED');
    return 'GRANTED';
  }

  /**
   * Updates state and notifies subscribers
   */
  public updatePermission(type: CribPermissionType, status: CribPermissionStatus): void {
    if (this.permissions[type] !== status) {
      this.permissions[type] = status;
      console.info(`[CRIB_PERMISSION] ${type}=${status}`);
      this.notifyListeners();
    }
  }

  public subscribe(listener: PermissionListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllPermissions());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const copy = this.getAllPermissions();
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch (err) {
        console.error('[CRIB_ERROR] Error in permission listener:', err);
      }
    }
  }

  /**
   * Reset for test suites
   */
  public resetForTesting(): void {
    this.permissions = {
      CALL: 'NOT_REQUESTED',
      NOTIFICATIONS: 'NOT_REQUESTED',
      LOCATION: 'NOT_REQUESTED',
      AUDIO: 'NOT_REQUESTED',
    };
    this.listeners.clear();
  }
}

export const CribPermissionManager = new CribPermissionManagerImpl();
