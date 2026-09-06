/**
 * CRIB Location Service
 * Acquires real browser/device coordinates on emergency escalation.
 * Strictly avoids fake maps or fake mock coordinates.
 * GOATEST - PMT-9
 */

import {
  CribLocationState,
  CribLocationStatus,
} from '../../../types/cribEvents';
import { CribPermissionManager } from './cribPermissionManager';

export interface LocationResult {
  location: CribLocationState | null;
  status: CribLocationStatus;
  errorMessage?: string;
}

class CribLocationServiceImpl {
  private cachedLocation: CribLocationState | null = null;
  private lastStatus: CribLocationStatus = 'LOCATION_NOT_REQUESTED';

  /**
   * Returns the most recent cached location snapshot
   */
  public getLastLocation(): CribLocationState | null {
    return this.cachedLocation;
  }

  public getLastStatus(): CribLocationStatus {
    return this.lastStatus;
  }

  /**
   * Requests single location snapshot on emergency escalation
   */
  public async requestCurrentLocation(): Promise<LocationResult> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.lastStatus = 'LOCATION_UNAVAILABLE';
      CribPermissionManager.updatePermission('LOCATION', 'UNAVAILABLE');
      console.info('[CRIB_EVENT] location_status=LOCATION_UNAVAILABLE');
      return {
        location: null,
        status: 'LOCATION_UNAVAILABLE',
        errorMessage: 'Geolocation API is not available on this device/platform.',
      };
    }

    return new Promise<LocationResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const locationState: CribLocationState = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp || Date.now(),
          };
          this.cachedLocation = locationState;
          this.lastStatus = 'LOCATION_READY';
          CribPermissionManager.updatePermission('LOCATION', 'GRANTED');
          console.info('[CRIB_EVENT] location_status=LOCATION_READY');
          resolve({
            location: locationState,
            status: 'LOCATION_READY',
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            this.lastStatus = 'LOCATION_PERMISSION_DENIED';
            CribPermissionManager.updatePermission('LOCATION', 'DENIED');
            console.info('[CRIB_EVENT] location_status=LOCATION_PERMISSION_DENIED');
            resolve({
              location: null,
              status: 'LOCATION_PERMISSION_DENIED',
              errorMessage: 'Location permission was denied by the user or browser.',
            });
          } else {
            this.lastStatus = 'LOCATION_UNAVAILABLE';
            CribPermissionManager.updatePermission('LOCATION', 'UNAVAILABLE');
            console.info('[CRIB_EVENT] location_status=LOCATION_UNAVAILABLE');
            resolve({
              location: null,
              status: 'LOCATION_UNAVAILABLE',
              errorMessage: 'Location signal timed out or is unavailable.',
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 30000,
        }
      );
    });
  }

  /**
   * Reset for test suites
   */
  public resetForTesting(): void {
    this.cachedLocation = null;
    this.lastStatus = 'LOCATION_NOT_REQUESTED';
  }
}

export const CribLocationService = new CribLocationServiceImpl();
