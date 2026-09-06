/**
 * SSB (Stranger Assistance) Emergency State Machine
 * GOATEST - CRIB PMT-5
 *
 * Implements deterministic state transitions for SSB mode following SDCU escalation
 * or direct manual activation.
 */

import {
  SSBState,
  SSBEvent,
  SSBQuestion,
  SSBHelperResponsePayload,
  SSBSnapshot,
} from '../../../types/ssb';
import {
  SSB_DEFAULT_GUIDANCE_DIRECTIVES,
  SSB_STRANGER_QUESTIONS,
  selectStrangerQuestion,
  buildSSBGuidanceContract,
} from './ssbActionRegistry';

export class SsbStateMachine {
  private state: SSBState = 'SSB_IDLE';
  private currentStrangerQuestion: SSBQuestion | null = null;
  private lastHelperResponse: SSBHelperResponsePayload | null = null;
  private guidanceDirectives: string[] = [...SSB_DEFAULT_GUIDANCE_DIRECTIVES];
  private isContinuing: boolean = false;
  private escalationReason: string | null = null;
  private isOverrideActive: boolean = false;

  private listeners: Set<(snapshot: SSBSnapshot) => void> = new Set();

  constructor() {
    this.currentStrangerQuestion = selectStrangerQuestion();
  }

  // ============================================================================
  // PUBLIC QUERY & SUBSCRIPTION
  // ============================================================================

  public getState(): SSBState {
    return this.state;
  }

  public getSnapshot(): SSBSnapshot {
    const primaryDirective = this.guidanceDirectives[0] || 'KEEP THE PERSON STILL';
    return {
      state: this.state,
      currentStrangerQuestion: this.currentStrangerQuestion,
      lastHelperResponse: this.lastHelperResponse,
      guidanceDirectives: [...this.guidanceDirectives],
      primaryGuidance: buildSSBGuidanceContract(primaryDirective, 'HIGH'),
      isContinuing: this.isContinuing,
      escalationReason: this.escalationReason,
      isOverrideActive: this.isOverrideActive,
    };
  }

  public subscribe(listener: (snapshot: SSBSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
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
        console.error('[CRIB_SSB_ERROR] Listener error:', err);
      }
    }
  }

  private logTransition(prevState: SSBState, nextState: SSBState, details?: string): void {
    console.log(
      `[CRIB_SSB] state=${nextState} prev=${prevState} isContinuing=${this.isContinuing}${
        details ? ` (${details})` : ''
      }`
    );
  }

  // ============================================================================
  // STATE MACHINE CORE DISPATCHER
  // ============================================================================

  public dispatch(event: SSBEvent): void {
    const prevState = this.state;

    switch (event.type) {
      case 'SDCU_ESCALATION': {
        if (this.state === 'SSB_MANUAL_OVERRIDE' || this.state === 'SSB_EXITED') return;
        this.escalationReason = (event.payload as string) || 'SDCU_ESCALATION';
        this.isOverrideActive = false;
        this.state = 'SSB_STARTING';
        this.logTransition(prevState, 'SSB_STARTING', `escalated from SDCU: ${this.escalationReason}`);
        
        // Advance to SSB_ACTIVE
        this.state = 'SSB_ACTIVE';
        this.currentStrangerQuestion = selectStrangerQuestion({ reason: this.escalationReason });
        this.logTransition('SSB_STARTING', 'SSB_ACTIVE', 'active monitoring initiated');
        break;
      }

      case 'MANUAL_START': {
        if (this.state === 'SSB_ACTIVE' || this.state === 'SSB_CONTINUING') return;
        this.isOverrideActive = false;
        this.escalationReason = (event.payload as string) || 'MANUAL_SELECTION';
        this.state = 'SSB_STARTING';
        this.logTransition(prevState, 'SSB_STARTING', 'manual mode entry');
        
        this.state = 'SSB_ACTIVE';
        this.currentStrangerQuestion = selectStrangerQuestion({ reason: this.escalationReason });
        this.logTransition('SSB_STARTING', 'SSB_ACTIVE', 'active');
        break;
      }

      case 'PROMPT_STRANGER': {
        if (this.state === 'SSB_MANUAL_OVERRIDE' || this.state === 'SSB_EXITED') return;
        const qId = event.payload as string | undefined;
        if (qId && SSB_STRANGER_QUESTIONS[qId]) {
          this.currentStrangerQuestion = SSB_STRANGER_QUESTIONS[qId];
        } else {
          this.currentStrangerQuestion = selectStrangerQuestion();
        }
        this.state = 'STRANGER_PROMPT';
        this.logTransition(prevState, 'STRANGER_PROMPT', `question=${this.currentStrangerQuestion?.id}`);
        break;
      }

      case 'STRANGER_RESPONSE': {
        if (!this.currentStrangerQuestion) return;
        const resp = event.payload as 'YES' | 'NO';
        this.lastHelperResponse = {
          questionId: this.currentStrangerQuestion.id,
          questionText: this.currentStrangerQuestion.text,
          response: resp,
          timestamp: Date.now(),
        };

        // Update guidance directives from question guidanceMap
        const newDirectives = this.currentStrangerQuestion.guidanceMap[resp] || [];
        if (newDirectives.length > 0) {
          this.guidanceDirectives = [...newDirectives];
        }

        this.state = 'STRANGER_RESPONDED';
        this.logTransition(
          prevState,
          'STRANGER_RESPONDED',
          `q=${this.currentStrangerQuestion.id} resp=${resp}`
        );

        // Transition to GUIDANCE_ACTIVE then back to active/continuing
        this.state = 'GUIDANCE_ACTIVE';
        this.logTransition('STRANGER_RESPONDED', 'GUIDANCE_ACTIVE', 'guidance updated');

        if (this.isContinuing) {
          this.state = 'SSB_CONTINUING';
        } else {
          this.state = 'SSB_ACTIVE';
        }
        break;
      }

      case 'STRANGER_TIMEOUT_TRIGGER': {
        this.state = 'STRANGER_TIMEOUT';
        this.logTransition(prevState, 'STRANGER_TIMEOUT', 'timeout event handled');
        // Return to active without forcing an answer
        this.state = this.isContinuing ? 'SSB_CONTINUING' : 'SSB_ACTIVE';
        break;
      }

      case 'CONTINUE_SSB': {
        if (this.state === 'SSB_MANUAL_OVERRIDE' || this.state === 'SSB_EXITED') return;
        this.isContinuing = true;
        this.state = 'SSB_CONTINUING';
        this.logTransition(prevState, 'SSB_CONTINUING', 'helper confirmed continuous assistance');
        break;
      }

      case 'MANUAL_OVERRIDE': {
        this.isOverrideActive = true;
        this.state = 'SSB_MANUAL_OVERRIDE';
        this.logTransition(prevState, 'SSB_MANUAL_OVERRIDE', 'user triggered manual override');
        break;
      }

      case 'FALL_EVENT': {
        if (this.state === 'SSB_MANUAL_OVERRIDE' || this.state === 'SSB_EXITED') return;
        this.state = 'SSB_ESCALATION';
        this.escalationReason = 'FALL_DETECTED';
        this.guidanceDirectives = [
          'KEEP THE PERSON STILL',
          'DO NOT MOVE INJURED AREA',
          'CALL FOR HELP IMMEDIATELY',
          'MONITOR BREATHING',
        ];
        this.logTransition(prevState, 'SSB_ESCALATION', 'fall event received in SSB');
        this.state = this.isContinuing ? 'SSB_CONTINUING' : 'SSB_ACTIVE';
        break;
      }

      case 'RESET': {
        this.state = 'SSB_IDLE';
        this.isContinuing = false;
        this.isOverrideActive = false;
        this.escalationReason = null;
        this.lastHelperResponse = null;
        this.guidanceDirectives = [...SSB_DEFAULT_GUIDANCE_DIRECTIVES];
        this.currentStrangerQuestion = selectStrangerQuestion();
        this.logTransition(prevState, 'SSB_IDLE', 'reset');
        break;
      }

      case 'EXIT': {
        this.state = 'SSB_EXITED';
        this.logTransition(prevState, 'SSB_EXITED', 'exited');
        break;
      }
    }

    if (prevState !== this.state) {
      this.notify();
    }
  }

  // ============================================================================
  // CONVENIENCE CONTROL METHODS
  // ============================================================================

  public startFromSdcu(reason: string = 'SDCU_ESCALATION'): void {
    this.dispatch({
      type: 'SDCU_ESCALATION',
      timestamp: Date.now(),
      source: 'SDCU',
      payload: reason,
    });
  }

  public manualStart(reason: string = 'MANUAL_SELECTION'): void {
    this.dispatch({
      type: 'MANUAL_START',
      timestamp: Date.now(),
      source: 'UI',
      payload: reason,
    });
  }

  public promptStranger(questionId?: string): void {
    this.dispatch({
      type: 'PROMPT_STRANGER',
      timestamp: Date.now(),
      source: 'UI',
      payload: questionId,
    });
  }

  public respondStranger(response: 'YES' | 'NO'): void {
    this.dispatch({
      type: 'STRANGER_RESPONSE',
      timestamp: Date.now(),
      source: 'HELPER',
      payload: response,
    });
  }

  public continueSsb(): void {
    this.dispatch({
      type: 'CONTINUE_SSB',
      timestamp: Date.now(),
      source: 'HELPER',
    });
  }

  public handleManualOverride(): void {
    this.dispatch({
      type: 'MANUAL_OVERRIDE',
      timestamp: Date.now(),
      source: 'USER',
    });
  }

  public reportFall(): void {
    this.dispatch({
      type: 'FALL_EVENT',
      timestamp: Date.now(),
      source: 'FALL_SENSOR',
    });
  }

  public reset(): void {
    this.dispatch({
      type: 'RESET',
      timestamp: Date.now(),
      source: 'UI',
    });
  }

  public exit(): void {
    this.dispatch({
      type: 'EXIT',
      timestamp: Date.now(),
      source: 'UI',
    });
  }

  public destroy(): void {
    this.listeners.clear();
  }
}

// Global Singleton for SSB State Machine
export const ssbStateMachine = new SsbStateMachine();
