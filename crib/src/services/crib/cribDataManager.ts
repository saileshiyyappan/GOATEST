/**
 * CRIB Data Subscription Manager
 * GOATEST - CRIB PMT-3
 *
 * Responsibilities:
 *   1. Manages real-time CM_PACKET and CONDITION subscriptions for CRIB frontend.
 *   2. Enforces authenticated UID isolation.
 *   3. Tracks packet freshness and triggers STALE_DATA state if packet expires.
 *   4. Guarantees clean unsubscription and prevents duplicate listener leaks.
 *   5. Emits adapted immutable CribInputState to all subscribers.
 */

import { CmPacket, ConditionResult } from '../../types/cmPacket';
import { CribInputState, CribAdapterStatus } from '../../types/cribInput';
import { adaptCmPacketToCribState, getDefaultCribVitals } from './cribInputAdapter';

export type CribDataListener = (state: CribInputState) => void;

export class CribDataManager {
  private authenticatedUid: string | null = 'user-emergency-primary'; // Default authenticated user ID in local session
  private activeSessionId: string | null = null;
  private currentPacket: CmPacket | null = null;
  private currentCondition: ConditionResult | null = null;
  private listeners: Set<CribDataListener> = new Set();
  private staleTimerId: NodeJS.Timeout | number | null = null;
  private staleCheckIntervalMs: number = 5000;
  private maxStaleAgeMs: number = 60000; // 1 minute
  private currentState: CribInputState;

  constructor() {
    this.currentState = this.createInitialState('WAITING_FOR_SHB');
  }

  private createInitialState(status: CribAdapterStatus = 'WAITING_FOR_SHB'): CribInputState {
    return {
      sessionId: this.activeSessionId,
      uid: this.authenticatedUid,
      timestamp: null,
      target: 'OVERALL',
      vitals: getDefaultCribVitals(),
      compareSummary: null,
      conditionResult: null,
      probabilities: [],
      bfitResult: null,
      status,
      freshness: 'UNAVAILABLE',
    };
  }

  /**
   * Sets the authenticated user ID for session binding and security isolation
   */
  public setAuthenticatedUid(uid: string | null): void {
    if (this.authenticatedUid === uid) return;
    this.authenticatedUid = uid;

    if (!uid) {
      this.currentPacket = null;
      this.currentCondition = null;
      this.activeSessionId = null;
      this.recalculateAndNotify();
      return;
    }

    // Re-verify current packet against new UID
    if (this.currentPacket && this.currentPacket.uid !== uid) {
      console.error(`[CRIB_INPUT_ERROR] Dropping current packet due to UID change: packet.uid=${this.currentPacket.uid} newUid=${uid}`);
      this.currentPacket = null;
      this.currentCondition = null;
    }

    this.recalculateAndNotify();
  }

  public getAuthenticatedUid(): string | null {
    return this.authenticatedUid;
  }

  /**
   * Sets the active SHB session ID
   */
  public setActiveSessionId(sessionId: string | null): void {
    this.activeSessionId = sessionId;
    if (!sessionId) {
      this.currentPacket = null;
      this.currentCondition = null;
    }
    this.recalculateAndNotify();
  }

  /**
   * Ingests a new CM_PACKET from the COMPARE engine
   */
  public ingestCmPacket(packet: CmPacket | null): void {
    if (!packet) {
      this.currentPacket = null;
      this.recalculateAndNotify();
      return;
    }

    // Defensive clone to guarantee immutability of the source packet
    const clonedPacket: CmPacket = JSON.parse(JSON.stringify(packet));

    // Update active session if provided
    if (clonedPacket.sessionId) {
      this.activeSessionId = clonedPacket.sessionId;
    }

    this.currentPacket = clonedPacket;
    this.recalculateAndNotify();
    this.restartStaleTimer();
  }

  /**
   * Ingests a new CONDITION result from the CONDITION engine
   */
  public ingestConditionResult(condition: ConditionResult | null): void {
    this.currentCondition = condition ? JSON.parse(JSON.stringify(condition)) : null;
    this.recalculateAndNotify();
  }

  /**
   * Recalculates the adapted CRIB state and notifies all active subscribers
   */
  private recalculateAndNotify(): void {
    if (!this.authenticatedUid) {
      this.currentState = adaptCmPacketToCribState({
        packet: null,
        conditionResult: null,
        authenticatedUid: null,
      });
    } else if (!this.currentPacket) {
      const initialStatus: CribAdapterStatus = this.activeSessionId ? 'WAITING_FOR_COMPARE' : 'WAITING_FOR_SHB';
      this.currentState = {
        sessionId: this.activeSessionId,
        uid: this.authenticatedUid,
        timestamp: null,
        target: 'OVERALL',
        vitals: getDefaultCribVitals(),
        compareSummary: null,
        conditionResult: null,
        probabilities: [],
        bfitResult: null,
        status: initialStatus,
        freshness: 'UNAVAILABLE',
      };
    } else {
      this.currentState = adaptCmPacketToCribState({
        packet: this.currentPacket,
        conditionResult: this.currentCondition,
        authenticatedUid: this.authenticatedUid,
        maxStaleAgeMs: this.maxStaleAgeMs,
        currentTime: Date.now(),
      });
    }

    this.notifySubscribers();
  }

  /**
   * Notifies all registered listeners of the state update
   */
  private notifySubscribers(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('[CRIB_INPUT_ERROR] Error in CRIB data listener callback:', err);
      }
    }
  }

  /**
   * Subscribe to CRIB data updates
   * Returns a cleanup unsubscription function
   */
  public subscribe(listener: CribDataListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state on subscription
    try {
      listener(this.currentState);
    } catch (err) {
      console.error('[CRIB_INPUT_ERROR] Error in initial listener dispatch:', err);
    }

    if (this.listeners.size === 1) {
      this.startStalePolling();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopStalePolling();
      }
    };
  }

  public getCurrentState(): CribInputState {
    return this.currentState;
  }

  private startStalePolling(): void {
    this.stopStalePolling();
    this.staleTimerId = setInterval(() => {
      if (this.currentPacket) {
        this.recalculateAndNotify();
      }
    }, this.staleCheckIntervalMs);
  }

  private stopStalePolling(): void {
    if (this.staleTimerId !== null) {
      clearInterval(this.staleTimerId as any);
      this.staleTimerId = null;
    }
  }

  private restartStaleTimer(): void {
    if (this.listeners.size > 0) {
      this.startStalePolling();
    }
  }

  /**
   * Clean up all internal resources
   */
  public destroy(): void {
    this.stopStalePolling();
    this.listeners.clear();
    this.currentPacket = null;
    this.currentCondition = null;
  }
}

// Global Singleton Instance for application-wide CRIB pipeline
export const cribDataManager = new CribDataManager();
