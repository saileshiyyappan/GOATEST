/**
 * CRIB Emergency Call Service
 * Handles platform caretaker emergency calls.
 * GOATEST - PMT-9
 */

import { CaretakerContact, CribCallStatus } from '../../../types/cribEvents';
import { CribPermissionManager } from './cribPermissionManager';

class CribCallServiceImpl {
  private activeCaretaker: CaretakerContact | null = null;

  public setCaretaker(caretaker: CaretakerContact | null): void {
    this.activeCaretaker = caretaker;
  }

  public getCaretaker(): CaretakerContact | null {
    return this.activeCaretaker;
  }

  /**
   * Initiates caretaker emergency call
   */
  public initiateCaretakerCall(): CribCallStatus {
    const permStatus = CribPermissionManager.getPermission('CALL');

    if (!this.activeCaretaker || !this.activeCaretaker.phone) {
      console.info('[CRIB_EVENT] call_status=NO_CARETAKER_CONFIGURED');
      return {
        success: false,
        status: 'NO_CARETAKER_CONFIGURED',
        message: 'No primary emergency caretaker phone number configured.',
      };
    }

    if (permStatus === 'DENIED') {
      console.info('[CRIB_EVENT] call_status=CALL_DENIED');
      return {
        success: false,
        status: 'CALL_DENIED',
        message: 'Call permission is disabled in CRIB settings.',
      };
    }

    const cleanPhone = this.activeCaretaker.phone.replace(/[^0-9+]/g, '');
    const telUrl = `tel:${cleanPhone}`;

    if (typeof window !== 'undefined') {
      try {
        window.location.href = telUrl;
        console.info(`[CRIB_EVENT] call_status=CALL_INITIATED target=${this.activeCaretaker.name}`);
        return {
          success: true,
          status: 'CALL_INITIATED',
          message: `Calling caretaker ${this.activeCaretaker.name} (${cleanPhone})...`,
          phoneUrl: telUrl,
        };
      } catch (err) {
        console.error('[CRIB_ERROR] Call dispatch failed:', err);
        return {
          success: false,
          status: 'CALL_SERVICE_UNAVAILABLE',
          message: 'Unable to open platform call dialer.',
        };
      }
    }

    return {
      success: false,
      status: 'CALL_SERVICE_UNAVAILABLE',
      message: 'Call service is unavailable on this environment.',
    };
  }

  public resetForTesting(): void {
    this.activeCaretaker = null;
  }
}

export const CribCallService = new CribCallServiceImpl();
