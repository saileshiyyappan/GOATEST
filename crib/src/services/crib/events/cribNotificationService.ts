/**
 * CRIB Emergency Notification Service
 * Dispatches real browser notifications, distinguishes USER vs CARETAKER messages,
 * and builds structured CRIB_EMERGENCY_EVENT payloads.
 * GOATEST - PMT-9
 */

import {
  CribEmergencyEvent,
  CribEmergencyEventType,
  CribLocationState,
  CaretakerContact,
} from '../../../types/cribEvents';
import { CribMode, CribVital } from '../../../types/crib';
import { ConditionResult } from '../../../types/cmPacket';
import { CribPermissionManager } from './cribPermissionManager';

export interface DispatchNotificationOptions {
  eventType: CribEmergencyEventType;
  mode: CribMode;
  uid: string;
  sessionId: string;
  conditionResult?: ConditionResult | null;
  vitals?: CribVital[];
  location?: CribLocationState | null;
  caretaker?: CaretakerContact | null;
  customMessage?: string;
}

class CribNotificationServiceImpl {
  private recentEvents: CribEmergencyEvent[] = [];

  public getRecentEvents(): CribEmergencyEvent[] {
    return [...this.recentEvents];
  }

  /**
   * Summarizes vitals without full raw packet dump
   */
  public summarizeVitals(vitals?: CribVital[]): Record<string, string | number> {
    const summary: Record<string, string | number> = {};
    if (!vitals) return summary;

    for (const v of vitals) {
      if (v.value !== null && v.value !== undefined) {
        summary[v.label] = `${v.value}${v.unit ? ' ' + v.unit : ''}`.trim();
      }
    }
    return summary;
  }

  /**
   * Dispatches emergency notification and logs structured emergency event
   */
  public dispatchEmergencyEvent(options: DispatchNotificationOptions): CribEmergencyEvent {
    const {
      eventType,
      mode,
      uid,
      sessionId,
      conditionResult,
      vitals,
      location = null,
      caretaker = null,
      customMessage,
    } = options;

    const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const condition = conditionResult?.label || 'EVALUATING_PHYSIOLOGICAL_STATE';
    const mapSeverity = (sev?: string): 'normal' | 'moderate' | 'high' | 'critical' => {
      if (sev === 'critical') return 'critical';
      if (sev === 'high') return 'high';
      if (sev === 'moderate') return 'moderate';
      return mode === 'SSB' ? 'critical' : 'high';
    };
    const severity = mapSeverity(conditionResult?.severity);
    const vitalsSummary = this.summarizeVitals(vitals);

    const permStatus = CribPermissionManager.getPermission('NOTIFICATIONS');
    let isUserNotified = false;
    let isCaretakerNotified = false;

    // Distinguish USER vs CARETAKER messages
    const userTitle = `CRIB ALERT: ${mode} ACTIVE`;
    const userBody =
      customMessage ||
      (mode === 'SSB'
        ? 'Unconscious/Stranger assistance protocol engaged. Immediate guidance active.'
        : `Monitoring active. Action verified for ${condition}.`);

    const caretakerTitle = 'CRIB EMERGENCY: USER REQUIRES ATTENTION';
    const caretakerBody = `User ${uid} triggered ${eventType} (${condition}). Severity: ${severity.toUpperCase()}.`;

    if (permStatus === 'GRANTED' && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        // 1. Dispatch User Notification
        new Notification(userTitle, {
          body: userBody,
          tag: `crib-user-${sessionId}`,
          requireInteraction: mode === 'SSB' || severity === 'critical',
        });
        isUserNotified = true;

        // 2. Dispatch Caretaker Notification if configured
        if (caretaker) {
          new Notification(caretakerTitle, {
            body: caretakerBody,
            tag: `crib-caretaker-${sessionId}`,
            requireInteraction: true,
          });
          isCaretakerNotified = true;
        }
      } catch (err) {
        console.warn('[CRIB_ERROR] Notification dispatch error:', err);
      }
    }

    const event: CribEmergencyEvent = {
      eventId,
      uid,
      sessionId,
      mode,
      timestamp: Date.now(),
      eventType,
      condition,
      severity,
      location,
      vitalsSummary,
      isCaretakerNotified,
      isUserNotified,
      message: customMessage || userBody,
      caretaker,
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 50) {
      this.recentEvents.pop();
    }

    console.info(`[CRIB_EVENT] eventId=${eventId} type=${eventType} mode=${mode} severity=${severity}`);
    return event;
  }

  public resetForTesting(): void {
    this.recentEvents = [];
  }
}

export const CribNotificationService = new CribNotificationServiceImpl();
