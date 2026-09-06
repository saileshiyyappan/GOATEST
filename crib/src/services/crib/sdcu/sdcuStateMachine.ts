/**
 * SDCU Emergency State Machine
 * GOATEST - CRIB PMT-4
 *
 * Responsibilities:
 *   1. SDCU activation with 10-second countdown / instant activate / exit.
 *   2. 120-second active emergency evaluation window.
 *   3. Contextual action verification with 10-second timeout.
 *   4. Deterministic state transitions (IDLE, ACTIVATION_PENDING, SDCU_ACTIVE, ACTION_CHECK_PENDING,
 *      ACTION_CONFIRMED, ACTION_MISSED, EVALUATING, SDCU_SAFE, SDCU_ESCALATION_PENDING, MANUAL_OVERRIDE).
 *   5. Fall event & critical condition escalation boundary (exposing requestedMode = 'SSB').
 *   6. Manual override termination & complete timer cleanup.
 *   7. Read-only consumption of CribInputState (zero recalculation / zero packet mutation).
 *   8. Strict terminal logging: [CRIB_SDCU] and [CRIB_SDCU_ERROR].
 */

import { CribMode } from '../../../types/crib';
import {
  SDCUState,
  SDCUEvent,
  SDCUActionQuestion,
  SDCUActionResponsePayload,
  SDCUGuidanceEvent,
  SDCUSettings,
  SDCUSnapshot,
} from '../../../types/sdcu';
import { CribInputState } from '../../../types/cribInput';
import { SdcuTimerManager } from './sdcuTimerManager';
import {
  SDCU_ACTION_QUESTIONS,
  selectDeterministicQuestion,
  getGuidanceForAction,
} from './sdcuActionRegistry';
import { cribDataManager } from '../cribDataManager';

export type SdcuStateListener = (snapshot: SDCUSnapshot) => void;

export class SdcuStateMachine {
  private state: SDCUState = 'IDLE';
  private previousActiveState: SDCUState = 'IDLE';
  private remainingSeconds: number = 120;
  private activationCountdown: number = 10;
  private actionCountdown: number = 10;
  private currentActionQuestion: SDCUActionQuestion | null = null;
  private requestedMode: CribMode | null = null;
  private lastConfirmedAction: SDCUActionResponsePayload | null = null;
  private guidanceDirectives: string[] = [];
  private guidanceEvent: SDCUGuidanceEvent | null = null;
  private escalationReason: string | null = null;

  private settings: SDCUSettings = {
    sdcuEnabled: true,
    actionVerificationEnabled: true,
    audioGuidanceEnabled: true,
  };

  private timerManager: SdcuTimerManager;
  private listeners: Set<SdcuStateListener> = new Set();
  private cribInputUnsubscribe: (() => void) | null = null;
  private currentCribInput: CribInputState | null = null;

  constructor() {
    this.timerManager = new SdcuTimerManager({
      onActivationTick: (sec) => this.handleActivationTick(sec),
      onActivationExpired: () => this.handleActivationExpired(),
      onSdcuTick: (sec) => this.handleSdcuTick(sec),
      onSdcuExpired: () => this.handleSdcuExpired(),
      onActionTick: (sec) => this.handleActionTick(sec),
      onActionExpired: () => this.handleActionExpired(),
    });

    // Subscribe to CRIB Input Adapter data stream
    this.cribInputUnsubscribe = cribDataManager.subscribe((cribState) => {
      this.handleCribInputUpdate(cribState);
    });
  }

  // ==========================================
  // STATE SNAPSHOT
  // ==========================================

  public getSnapshot(): SDCUSnapshot {
    return {
      state: this.state,
      remainingSeconds: this.remainingSeconds,
      activationCountdown: this.activationCountdown,
      currentActionQuestion: this.currentActionQuestion,
      actionCountdown: this.actionCountdown,
      requestedMode: this.requestedMode,
      lastConfirmedAction: this.lastConfirmedAction,
      guidanceDirectives: [...this.guidanceDirectives],
      guidanceEvent: this.guidanceEvent ? { ...this.guidanceEvent } : null,
      escalationReason: this.escalationReason,
      settings: { ...this.settings },
    };
  }

  public subscribe(listener: SdcuStateListener): () => void {
    this.listeners.add(listener);
    // Immediately emit snapshot
    try {
      listener(this.getSnapshot());
    } catch (err) {
      console.error('[CRIB_SDCU_ERROR] Listener callback error on subscribe:', err);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch (err) {
        console.error('[CRIB_SDCU_ERROR] Error in SDCU subscriber:', err);
      }
    }
  }

  private transition(nextState: SDCUState, logReason?: string): void {
    if (this.state === nextState) return;

    const prevState = this.state;
    this.state = nextState;

    const sessionId = this.currentCribInput?.sessionId || 'SESSION-NONE';
    console.info(`[CRIB_SDCU] state=${nextState} prev=${prevState} session=${sessionId} remaining=${this.remainingSeconds}${logReason ? ` (${logReason})` : ''}`);

    this.notify();
  }

  // ==========================================
  // DISPATCH ENGINE & PUBLIC ACTIONS
  // ==========================================

  public dispatch(event: SDCUEvent): void {
    switch (event.type) {
      case 'START_ACTIVATION':
        this.startActivation();
        break;
      case 'ACTIVATE_CLICKED':
        this.activate();
        break;
      case 'EXIT_CLICKED':
        this.exitActivation();
        break;
      case 'ACTIVATION_TIMEOUT':
        this.activate('10s activation countdown expired');
        break;
      case 'FALL_DETECTED':
        this.reportFallEvent(event.source);
        break;
      case 'TRIGGER_ACTION_CHECK':
        this.triggerActionCheck(event.payload as string | undefined);
        break;
      case 'ACTION_RESPONSE': {
        const payload = event.payload as { response: 'YES' | 'NO' } | undefined;
        if (payload?.response) {
          this.respondAction(payload.response);
        }
        break;
      }
      case 'ACTION_TIMEOUT':
        this.handleActionExpired();
        break;
      case 'TIMER_EXPIRED':
        this.handleSdcuExpired();
        break;
      case 'MANUAL_OVERRIDE':
        this.handleManualOverride();
        break;
      case 'RESET':
        this.reset();
        break;
      default:
        break;
    }
  }

  /**
   * 1. Entry Point: Start CRIB 10-Second Activation Countdown Dialog
   */
  public startActivation(): void {
    if (this.state === 'ACTIVATION_PENDING' || this.state === 'SDCU_ACTIVE' || this.state === 'EVALUATING') return;

    this.timerManager.resetAll();
    this.activationCountdown = 10;
    this.requestedMode = null;
    this.escalationReason = null;
    this.transition('ACTIVATION_PENDING', 'entry dialog opened');
    this.timerManager.startActivationTimer(10);
  }

  /**
   * 2. User Clicks [ACTIVATE CRIB] or 10-second countdown expires
   */
  public activate(reason: string = 'activated'): void {
    if (this.state === 'SDCU_ACTIVE' || this.state === 'EVALUATING') return;

    this.timerManager.stopActivationTimer();
    this.activationCountdown = 0;
    this.remainingSeconds = 120;
    this.requestedMode = null;
    this.escalationReason = null;
    this.previousActiveState = 'SDCU_ACTIVE';

    this.transition('SDCU_ACTIVE', reason);
    this.timerManager.startSdcuMonitoringTimer(120);
  }

  /**
   * 3. User Clicks [EXIT]
   */
  public exitActivation(): void {
    this.timerManager.resetAll();
    this.activationCountdown = 10;
    this.transition('IDLE', 'user exited activation');
  }

  // ==========================================
  // ACTION VERIFICATION SYSTEM
  // ==========================================

  /**
   * Triggers an Action Verification question popup with 10-second timeout
   */
  public triggerActionCheck(forcedQuestionKey?: string): void {
    if (this.state !== 'SDCU_ACTIVE' && this.state !== 'EVALUATING') {
      return;
    }
    if (!this.settings.actionVerificationEnabled) {
      return;
    }

    const question = selectDeterministicQuestion({
      conditionLabel: this.currentCribInput?.conditionResult?.label,
      cribState: this.currentCribInput,
      forcedQuestionKey,
    });

    this.currentActionQuestion = question;
    this.actionCountdown = 10;
    this.previousActiveState = this.state;
    this.transition('ACTION_CHECK_PENDING', `question=${question.id}`);
    this.timerManager.startActionTimer(10);
  }

  /**
   * User Responds [YES] or [NO] to Action Verification Popup
   */
  public respondAction(response: 'YES' | 'NO'): void {
    if (this.state !== 'ACTION_CHECK_PENDING' || !this.currentActionQuestion) {
      return;
    }

    this.timerManager.stopActionTimer();
    const question = this.currentActionQuestion;
    const actionPayload: SDCUActionResponsePayload = {
      questionId: question.id,
      action: question.guidanceKey,
      response,
      timestamp: Date.now(),
    };
    this.lastConfirmedAction = actionPayload;

    if (response === 'YES') {
      // Resolve predefined guidance directives
      const directives = getGuidanceForAction(question.guidanceKey);
      this.guidanceDirectives = directives;

      const guidanceEvt: SDCUGuidanceEvent = {
        type: 'GUIDANCE',
        message: directives[0] || 'REST',
        priority: 'HIGH',
        actionKey: question.guidanceKey,
        timestamp: Date.now(),
      };
      this.guidanceEvent = guidanceEvt;

      this.transition('ACTION_CONFIRMED', `response=YES action=${question.guidanceKey}`);
    } else {
      this.transition('ACTION_CONFIRMED', `response=NO action=${question.guidanceKey}`);
    }

    // Auto-close popup and resume monitoring
    this.currentActionQuestion = null;
    this.actionCountdown = 0;

    // Resume SDCU evaluation state
    setTimeout(() => {
      if (this.state === 'ACTION_CONFIRMED') {
        this.transition('EVALUATING', 'resumed after action confirmed');
      }
    }, 1200);
  }

  // ==========================================
  // REAL FALL EVENT & ESCALATION BOUNDARY
  // ==========================================

  /**
   * Ingestion of REAL Fall Detection Event
   */
  public reportFallEvent(source: string = 'SENSOR'): void {
    if (this.state === 'SDCU_SAFE' || this.state === 'MANUAL_OVERRIDE') return;

    this.timerManager.stopSdcuMonitoringTimer();
    this.timerManager.stopActionTimer();
    this.currentActionQuestion = null;
    this.requestedMode = 'SSB';
    this.escalationReason = 'FALL_DETECTED';

    this.guidanceDirectives = getGuidanceForAction('FALL');
    this.guidanceEvent = {
      type: 'GUIDANCE',
      message: 'DO NOT MOVE SUDDENLY',
      priority: 'CRITICAL',
      actionKey: 'FALL',
      timestamp: Date.now(),
    };

    this.transition('SDCU_ESCALATION_PENDING', `fall event from ${source}`);
  }

  /**
   * Escalates SDCU to next mode (SSB)
   */
  public triggerEscalation(reason: string = 'EVALUATION_FAILED'): void {
    this.timerManager.stopSdcuMonitoringTimer();
    this.timerManager.stopActionTimer();
    this.currentActionQuestion = null;
    this.requestedMode = 'SSB';
    this.escalationReason = reason;

    this.transition('SDCU_ESCALATION_PENDING', reason);
  }

  // ==========================================
  // MANUAL OVERRIDE
  // ==========================================

  public handleManualOverride(): void {
    this.timerManager.resetAll();
    this.currentActionQuestion = null;
    this.activationCountdown = 10;
    this.remainingSeconds = 120;
    this.requestedMode = null;
    this.escalationReason = null;

    this.transition('MANUAL_OVERRIDE', 'user triggered manual override');
  }

  public reset(): void {
    this.timerManager.resetAll();
    this.state = 'IDLE';
    this.previousActiveState = 'IDLE';
    this.remainingSeconds = 120;
    this.activationCountdown = 10;
    this.actionCountdown = 10;
    this.currentActionQuestion = null;
    this.requestedMode = null;
    this.lastConfirmedAction = null;
    this.guidanceDirectives = [];
    this.guidanceEvent = null;
    this.escalationReason = null;
    this.notify();
  }

  // ==========================================
  // TIMERS CALLBACK HANDLERS
  // ==========================================

  private handleActivationTick(seconds: number): void {
    this.activationCountdown = seconds;
    this.notify();
  }

  private handleActivationExpired(): void {
    if (this.state === 'ACTIVATION_PENDING') {
      this.activate('10s activation timer expired');
    }
  }

  private handleSdcuTick(seconds: number): void {
    this.remainingSeconds = seconds;

    // Transition SDCU_ACTIVE to EVALUATING after initial start
    if (this.state === 'SDCU_ACTIVE' && seconds < 120) {
      this.transition('EVALUATING', 'evaluating window active');
    }

    this.notify();
  }

  private handleSdcuExpired(): void {
    this.timerManager.stopSdcuMonitoringTimer();
    this.remainingSeconds = 0;

    if (this.state === 'SDCU_ACTIVE' || this.state === 'EVALUATING' || this.state === 'ACTION_CONFIRMED' || this.state === 'ACTION_MISSED') {
      // 120 seconds completion without escalation -> SDCU_SAFE
      this.transition('SDCU_SAFE', '120s window completed with no escalation condition');
    }
  }

  private handleActionTick(seconds: number): void {
    this.actionCountdown = seconds;
    this.notify();
  }

  private handleActionExpired(): void {
    this.timerManager.stopActionTimer();
    const question = this.currentActionQuestion;
    this.currentActionQuestion = null;
    this.actionCountdown = 0;

    if (this.state === 'ACTION_CHECK_PENDING') {
      this.transition('ACTION_MISSED', `action missed (question=${question?.id || 'unknown'})`);

      // Automatically continue SDCU evaluation
      setTimeout(() => {
        if (this.state === 'ACTION_MISSED') {
          this.transition('EVALUATING', 'resumed SDCU monitoring after action timeout');
        }
      }, 1000);
    }
  }

  // ==========================================
  // INPUT ADAPTER CONSUMPTION
  // ==========================================

  private handleCribInputUpdate(cribState: CribInputState): void {
    this.currentCribInput = cribState;

    // Check for critical condition result if present
    if (cribState.conditionResult && (this.state === 'SDCU_ACTIVE' || this.state === 'EVALUATING')) {
      const cond = cribState.conditionResult;
      // If critical severity condition and probability is high (>= 90%)
      if (cond.severity === 'critical' && typeof cond.probability === 'number' && cond.probability >= 90) {
        // Optional configured critical escalation rule
        // SDCU consumes condition without recalculating
      }
    }
  }

  public updateSettings(updates: Partial<SDCUSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.notify();
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  public destroy(): void {
    this.timerManager.cleanup();
    if (this.cribInputUnsubscribe) {
      this.cribInputUnsubscribe();
      this.cribInputUnsubscribe = null;
    }
    this.listeners.clear();
    this.currentCribInput = null;
  }
}

// Global Singleton SDCU State Machine
export const sdcuStateMachine = new SdcuStateMachine();
