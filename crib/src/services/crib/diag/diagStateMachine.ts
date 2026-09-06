/**
 * DIAG Emergency State Machine
 * GOATEST - CRIB PMT-7
 *
 * Implements deterministic state transitions for DIAG (Diagnostic / Helper Assistance) mode.
 *
 * Architectural Invariants:
 *   1. Starts IMMEDIATELY upon user selection (NO 10-second countdown, NO 2-minute timer).
 *   2. NO automatic SSB escalation (DIAG remains in DIAG until manual override / mode change / exit).
 *   3. NO PHB retrieval or deviation calculation (pure consumer of CM_PACKET & CONDITION pipeline).
 *   4. Action verification has NO timeout (remains active until user/helper selects or dismisses).
 *   5. Action selection produces concise emergency keyword guidance.
 *   6. Manual override stops DIAG monitoring cleanly.
 *   7. Minimal structured logging: [CRIB_DIAG] and [CRIB_DIAG_ERROR].
 */

import {
  DiagState,
  DiagEvent,
  DiagActionId,
  DiagActionResponsePayload,
  DiagSnapshot,
} from '../../../types/diag';
import { CribInputState } from '../../../types/cribInput';
import {
  DIAG_ACTION_CHOICES,
  ALL_DIAG_ACTION_CHOICES,
  DIAG_DEFAULT_GUIDANCE_DIRECTIVES,
  getGuidanceForDiagAction,
  buildDiagGuidanceContract,
} from './diagActionRegistry';
import { DiagGuidanceService } from './diagGuidanceService';
import { cribDataManager } from '../cribDataManager';

export type DiagStateListener = (snapshot: DiagSnapshot) => void;

export class DiagStateMachine {
  private state: DiagState = 'DIAG_IDLE';
  private selectedAction: DiagActionResponsePayload | null = null;
  private guidanceDirectives: string[] = [...DIAG_DEFAULT_GUIDANCE_DIRECTIVES];
  private isContinuing: boolean = false;
  private isOverrideActive: boolean = false;

  private listeners: Set<DiagStateListener> = new Set();
  private cribInputUnsubscribe: (() => void) | null = null;
  private currentCribInput: CribInputState | null = null;

  constructor() {
    // Subscribe to CRIB Input Adapter data stream (read-only)
    this.cribInputUnsubscribe = cribDataManager.subscribe((inputState) => {
      this.handleCribInputUpdate(inputState);
    });
  }

  // ============================================================================
  // PUBLIC QUERY & SNAPSHOT
  // ============================================================================

  public getState(): DiagState {
    return this.state;
  }

  public getSnapshot(): DiagSnapshot {
    const primary = this.guidanceDirectives[0] || 'SIT DOWN';
    return {
      state: this.state,
      selectedAction: this.selectedAction ? { ...this.selectedAction } : null,
      guidanceDirectives: [...this.guidanceDirectives],
      primaryGuidance: buildDiagGuidanceContract(primary, this.guidanceDirectives, 'HIGH'),
      isContinuing: this.isContinuing,
      isOverrideActive: this.isOverrideActive,
      availableActions: [...ALL_DIAG_ACTION_CHOICES],
    };
  }

  public subscribe(listener: DiagStateListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getSnapshot());
    } catch (err) {
      console.error('[CRIB_DIAG_ERROR] Listener error on subscribe:', err);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[CRIB_DIAG_ERROR] Listener notification error:', err);
      }
    }
  }

  private logTransition(prevState: DiagState, nextState: DiagState, details?: string): void {
    console.log(
      `[CRIB_DIAG] state=${nextState} prev=${prevState} continuing=${this.isContinuing}${
        details ? ` (${details})` : ''
      }`
    );
  }

  private transition(nextState: DiagState, details?: string): void {
    if (this.state === nextState) return;
    const prevState = this.state;
    this.state = nextState;
    this.logTransition(prevState, nextState, details);
    this.notify();
  }

  // ============================================================================
  // EVENT DISPATCHER
  // ============================================================================

  public dispatch(event: DiagEvent): void {
    switch (event.type) {
      case 'START_DIAG':
        this.startDiag(event.payload as string | undefined);
        break;
      case 'TRIGGER_ACTION_CHECK':
        this.triggerActionCheck();
        break;
      case 'SELECT_ACTION':
        this.selectAction(event.payload as DiagActionId);
        break;
      case 'DISMISS_ACTION':
        this.dismissAction();
        break;
      case 'CONTINUE_DIAG':
        this.continueDiag();
        break;
      case 'MANUAL_OVERRIDE':
        this.handleManualOverride();
        break;
      case 'RESET':
        this.reset();
        break;
      case 'EXIT':
        this.exit();
        break;
      case 'CONDITION_UPDATE':
        this.handleConditionUpdate();
        break;
      default:
        break;
    }
  }

  // ============================================================================
  // PUBLIC CONTROL METHODS
  // ============================================================================

  /**
   * Start DIAG mode immediately without any 10-second or 2-minute countdowns.
   */
  public startDiag(reason?: string): void {
    if (this.state === 'DIAG_ACTIVE' || this.state === 'ACTION_CHECK_PENDING') return;

    this.isOverrideActive = false;
    this.isContinuing = false;
    this.selectedAction = null;
    this.guidanceDirectives = [...DIAG_DEFAULT_GUIDANCE_DIRECTIVES];

    const prevState = this.state;
    this.state = 'DIAG_ACTIVE';
    this.logTransition(prevState, 'DIAG_ACTIVE', reason || 'immediate DIAG activation');
    
    // Automatically make action check available in active mode
    this.state = 'ACTION_CHECK_PENDING';
    this.logTransition('DIAG_ACTIVE', 'ACTION_CHECK_PENDING', 'action verification ready');
    this.notify();
  }

  /**
   * Trigger action verification popup/panel
   */
  public triggerActionCheck(): void {
    if (this.state === 'DIAG_MANUAL_OVERRIDE' || this.state === 'DIAG_EXITED') return;
    this.transition('ACTION_CHECK_PENDING', 'action verification requested');
  }

  /**
   * Select helper action choice (NO timeout)
   */
  public selectAction(actionId: DiagActionId): void {
    if (this.state === 'DIAG_MANUAL_OVERRIDE' || this.state === 'DIAG_EXITED') return;

    const action = DIAG_ACTION_CHOICES[actionId];
    if (!action) {
      console.error(`[CRIB_DIAG_ERROR] Unknown actionId: ${actionId}`);
      return;
    }

    this.selectedAction = {
      actionId,
      actionLabel: action.label,
      timestamp: Date.now(),
    };

    // Transition to ACTION_CONFIRMED
    const prevState = this.state;
    this.state = 'ACTION_CONFIRMED';
    this.logTransition(prevState, 'ACTION_CONFIRMED', `action=${actionId}`);

    // Update guidance directives based on chosen action
    const newDirectives = DiagGuidanceService.generateEmergencyDirectives(
      actionId,
      this.currentCribInput?.conditionResult?.severity
    );
    this.guidanceDirectives = [...newDirectives];

    // Transition immediately to GUIDANCE_ACTIVE
    this.state = 'GUIDANCE_ACTIVE';
    this.logTransition('ACTION_CONFIRMED', 'GUIDANCE_ACTIVE', 'guidance directives active');
    this.notify();
  }

  /**
   * Dismiss action popup without selecting an action
   */
  public dismissAction(): void {
    if (this.state === 'ACTION_CHECK_PENDING') {
      const prevState = this.state;
      this.state = 'ACTION_MISSED';
      this.logTransition(prevState, 'ACTION_MISSED', 'action verification dismissed');
      
      this.state = 'DIAG_ACTIVE';
      this.logTransition('ACTION_MISSED', 'DIAG_ACTIVE', 'returned to active monitoring');
      this.notify();
    }
  }

  /**
   * Confirm continued helper assistance in DIAG mode
   */
  public continueDiag(): void {
    if (this.state === 'DIAG_MANUAL_OVERRIDE' || this.state === 'DIAG_EXITED') return;

    this.isContinuing = true;
    this.transition('DIAG_CONTINUING', 'helper confirmed continued DIAG assistance');
  }

  /**
   * Manual override: stop DIAG monitoring and return to normal/non-emergency state
   */
  public handleManualOverride(): void {
    this.isOverrideActive = true;
    this.isContinuing = false;
    const prevState = this.state;
    this.state = 'DIAG_MANUAL_OVERRIDE';
    this.logTransition(prevState, 'DIAG_MANUAL_OVERRIDE', 'manual override triggered');
    this.notify();
  }

  /**
   * Reset DIAG state machine back to DIAG_IDLE
   */
  public reset(): void {
    this.isOverrideActive = false;
    this.isContinuing = false;
    this.selectedAction = null;
    this.guidanceDirectives = [...DIAG_DEFAULT_GUIDANCE_DIRECTIVES];
    this.transition('DIAG_IDLE', 'state machine reset');
  }

  /**
   * Exit DIAG state machine
   */
  public exit(): void {
    this.isContinuing = false;
    this.transition('DIAG_EXITED', 'DIAG mode exited');
  }

  // ============================================================================
  // CRIB INPUT ADAPTER INTEGRATION (Read-Only Consumer)
  // ============================================================================

  private handleCribInputUpdate(inputState: CribInputState): void {
    this.currentCribInput = inputState;

    if (this.state === 'DIAG_ACTIVE' || this.state === 'GUIDANCE_ACTIVE' || this.state === 'DIAG_CONTINUING') {
      if (inputState.conditionResult && inputState.conditionResult.severity === 'critical') {
        // Critical severity updates guidance while preserving selected action
        this.guidanceDirectives = DiagGuidanceService.generateEmergencyDirectives(
          this.selectedAction?.actionId || null,
          'critical'
        );
        this.notify();
      }
    }
  }

  private handleConditionUpdate(): void {
    if (this.currentCribInput?.conditionResult) {
      this.guidanceDirectives = DiagGuidanceService.generateEmergencyDirectives(
        this.selectedAction?.actionId || null,
        this.currentCribInput.conditionResult.severity
      );
      this.notify();
    }
  }

  /**
   * Cleanup method on state machine destruction
   */
  public destroy(): void {
    if (this.cribInputUnsubscribe) {
      this.cribInputUnsubscribe();
      this.cribInputUnsubscribe = null;
    }
    this.listeners.clear();
  }
}

// Global Singleton for DIAG State Machine
export const diagStateMachine = new DiagStateMachine();
