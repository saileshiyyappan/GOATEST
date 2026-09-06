/**
 * CRIB Emergency Event Engine
 * Orchestrates the full event pipeline for SDCU, SSB, and DIAG modes:
 * SDCU Escalation -> Location Snapshot -> Caretaker Event -> User Notification -> Audio Chime -> AI Guidance Context
 * GOATEST - PMT-9
 */

import {
  CribEmergencyEvent,
  CribEmergencyEventType,
  CaretakerContact,
} from '../../../types/cribEvents';
import { CribMode, CribVital } from '../../../types/crib';
import { ConditionResult } from '../../../types/cmPacket';
import { CribLocationService } from './cribLocationService';
import { CribNotificationService } from './cribNotificationService';
import { CribAudioService } from './cribAudioService';
import { CribCallService } from './cribCallService';

export interface TriggerEscalationParams {
  uid: string;
  sessionId: string;
  conditionResult?: ConditionResult | null;
  vitals?: CribVital[];
  reason: string;
  caretaker?: CaretakerContact | null;
}

export interface TriggerStandardEventParams {
  eventType: CribEmergencyEventType;
  mode: CribMode;
  uid: string;
  sessionId: string;
  conditionResult?: ConditionResult | null;
  vitals?: CribVital[];
  customMessage?: string;
  caretaker?: CaretakerContact | null;
}

class CribEventEngineImpl {
  /**
   * Primary SDCU Escalation Pipeline:
   * SDCU ACTIVE -> 2 MINUTES UNRESOLVED -> SDCU_ESCALATION -> LOCATION SNAPSHOT -> CARETAKER NOTIFIED -> SSB TRANSITION
   */
  public async handleSdcuEscalation(params: TriggerEscalationParams): Promise<CribEmergencyEvent> {
    const { uid, sessionId, conditionResult, vitals, reason, caretaker } = params;

    // 1. Play Emergency Chime
    CribAudioService.playEmergencyChime();

    // 2. Request Location Snapshot (non-blocking / fast async)
    let locationSnapshot = CribLocationService.getLastLocation();
    try {
      const locResult = await CribLocationService.requestCurrentLocation();
      if (locResult.location) {
        locationSnapshot = locResult.location;
      }
    } catch {
      // Keep existing location or null
    }

    // 3. Dispatch Notification to User & Caretaker
    const event = CribNotificationService.dispatchEmergencyEvent({
      eventType: 'SDCU_ESCALATION',
      mode: 'SSB',
      uid,
      sessionId,
      conditionResult,
      vitals,
      location: locationSnapshot,
      caretaker: caretaker || CribCallService.getCaretaker(),
      customMessage: `SDCU Escalation triggered (${reason}). Transitioned to SSB Stranger Assistance Mode.`,
    });

    console.info(`[CRIB_EVENT] SDCU escalated to SSB: eventId=${event.eventId} reason="${reason}" location=${locationSnapshot ? 'AVAILABLE' : 'UNAVAILABLE'}`);
    return event;
  }

  /**
   * Generic Emergency Event Dispatcher (e.g. Critical condition detected, Manual Override, etc.)
   */
  public async dispatchEvent(params: TriggerStandardEventParams): Promise<CribEmergencyEvent> {
    const {
      eventType,
      mode,
      uid,
      sessionId,
      conditionResult,
      vitals,
      customMessage,
      caretaker,
    } = params;

    if (eventType === 'CRITICAL_CONDITION' || eventType === 'SSB_ACTIVATED') {
      CribAudioService.playEmergencyChime();
    } else {
      CribAudioService.playGuidanceTone();
    }

    let locationSnapshot = CribLocationService.getLastLocation();
    if (eventType === 'CRITICAL_CONDITION' || eventType === 'SSB_ACTIVATED') {
      try {
        const locResult = await CribLocationService.requestCurrentLocation();
        if (locResult.location) {
          locationSnapshot = locResult.location;
        }
      } catch {
        // Safe fallback
      }
    }

    return CribNotificationService.dispatchEmergencyEvent({
      eventType,
      mode,
      uid,
      sessionId,
      conditionResult,
      vitals,
      location: locationSnapshot,
      caretaker: caretaker || CribCallService.getCaretaker(),
      customMessage,
    });
  }
}

export const CribEventEngine = new CribEventEngineImpl();
