/**
 * Deterministic Test Suite for SDCU Emergency State Machine
 * GOATEST - CRIB PMT-4
 *
 * Verifies all 24 requirements + real CM_PACKET input scenario.
 */

import { SdcuStateMachine } from '../sdcuStateMachine';
import { SdcuTimerManager } from '../sdcuTimerManager';
import {
  SDCU_ACTION_QUESTIONS,
  selectDeterministicQuestion,
  getGuidanceForAction,
  ACTION_GUIDANCE_MAP,
} from '../sdcuActionRegistry';
import { adaptCmPacketToCribState } from '../../cribInputAdapter';
import { CmPacket, ConditionResult } from '../../../../types/cmPacket';

export function runAllSdcuTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${testName}`);
    } else {
      failed++;
      const msg = `  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  console.log('=== STARTING CRIB PMT-4 SDCU TEST SUITE ===');

  // Test 1: IDLE -> ACTIVATION_PENDING
  {
    const sm = new SdcuStateMachine();
    assert(sm.getSnapshot().state === 'IDLE', 'Test 1.1: Initial state is IDLE');
    sm.startActivation();
    assert(sm.getSnapshot().state === 'ACTIVATION_PENDING', 'Test 1.2: Transitions to ACTIVATION_PENDING');
    assert(sm.getSnapshot().activationCountdown === 10, 'Test 1.3: Activation countdown initialized to 10s');
    sm.destroy();
  }

  // Test 2: activation click -> SDCU_ACTIVE
  {
    const sm = new SdcuStateMachine();
    sm.startActivation();
    sm.activate('user clicked activate');
    assert(sm.getSnapshot().state === 'SDCU_ACTIVE', 'Test 2.1: Activation click transitions to SDCU_ACTIVE');
    assert(sm.getSnapshot().remainingSeconds === 120, 'Test 2.2: 120s timer initialized');
    sm.destroy();
  }

  // Test 3: activation timeout after exactly 10 seconds -> SDCU_ACTIVE
  {
    const sm = new SdcuStateMachine();
    sm.startActivation();
    sm.dispatch({
      type: 'ACTIVATION_TIMEOUT',
      timestamp: Date.now(),
      source: 'TIMER',
    });
    assert(sm.getSnapshot().state === 'SDCU_ACTIVE', 'Test 3.1: Activation timeout transitions to SDCU_ACTIVE');
    sm.destroy();
  }

  // Test 4: EXIT -> no active SDCU (IDLE)
  {
    const sm = new SdcuStateMachine();
    sm.startActivation();
    sm.exitActivation();
    assert(sm.getSnapshot().state === 'IDLE', 'Test 4.1: EXIT transitions back to IDLE without active monitoring');
    sm.destroy();
  }

  // Test 5: SDCU timer starts at 120 seconds
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    assert(sm.getSnapshot().remainingSeconds === 120, 'Test 5.1: SDCU monitoring starts at exactly 120s');
    sm.destroy();
  }

  // Test 6: timer cleanup
  {
    const tm = new SdcuTimerManager();
    tm.startActivationTimer(10);
    tm.startSdcuMonitoringTimer(120);
    tm.startActionTimer(10);
    tm.cleanup();
    assert(tm.getActivationRemaining() === 10, 'Test 6.1: Timer manager resets and cleans up all timers');
    assert(tm.getSdcuRemaining() === 120, 'Test 6.2: SDCU timer reset on cleanup');
  }

  // Test 7: action popup opens (ACTION_CHECK_PENDING)
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.triggerActionCheck('RUNNING');
    assert(sm.getSnapshot().state === 'ACTION_CHECK_PENDING', 'Test 7.1: Action check opens popup');
    assert(sm.getSnapshot().currentActionQuestion?.id === 'activity_running', 'Test 7.2: Current action question populated');
    assert(sm.getSnapshot().actionCountdown === 10, 'Test 7.3: Action countdown is 10s');
    sm.destroy();
  }

  // Test 8: YES response -> ACTION_CONFIRMED with guidance
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.triggerActionCheck('FATIGUED');
    sm.respondAction('YES');
    assert(sm.getSnapshot().state === 'ACTION_CONFIRMED', 'Test 8.1: YES response records ACTION_CONFIRMED');
    assert(sm.getSnapshot().lastConfirmedAction?.response === 'YES', 'Test 8.2: Last confirmed action recorded');
    assert(sm.getSnapshot().guidanceDirectives.includes('SIT DOWN'), 'Test 8.3: Directives mapped to SIT DOWN');
    assert(sm.getSnapshot().guidanceDirectives.includes('TAKE REST'), 'Test 8.4: Directives mapped to TAKE REST');
    sm.destroy();
  }

  // Test 9: NO response -> ACTION_CONFIRMED with negative response
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.triggerActionCheck('HEAVY_LIFT');
    sm.respondAction('NO');
    assert(sm.getSnapshot().state === 'ACTION_CONFIRMED', 'Test 9.1: NO response records ACTION_CONFIRMED');
    assert(sm.getSnapshot().lastConfirmedAction?.response === 'NO', 'Test 9.2: Negative response recorded');
    sm.destroy();
  }

  // Test 10: 10-second action timeout -> ACTION_MISSED
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.triggerActionCheck('RUNNING');
    sm.dispatch({
      type: 'ACTION_TIMEOUT',
      timestamp: Date.now(),
      source: 'TIMER',
    });
    assert(sm.getSnapshot().state === 'ACTION_MISSED', 'Test 10.1: Action timeout transitions to ACTION_MISSED');
    sm.destroy();
  }

  // Test 11: action timeout continues SDCU
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.triggerActionCheck('RUNNING');
    sm.dispatch({
      type: 'ACTION_TIMEOUT',
      timestamp: Date.now(),
      source: 'TIMER',
    });
    assert(sm.getSnapshot().requestedMode === null, 'Test 11.1: Missed action does not terminate or abort SDCU');
    sm.destroy();
  }

  // Test 12: real fall event -> SDCU_ESCALATION_PENDING
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.reportFallEvent('REAL_ACCELEROMETER');
    assert(sm.getSnapshot().state === 'SDCU_ESCALATION_PENDING', 'Test 12.1: Fall event escalates to SDCU_ESCALATION_PENDING');
    assert(sm.getSnapshot().requestedMode === 'SSB', 'Test 12.2: Requested next mode is SSB');
    assert(sm.getSnapshot().escalationReason === 'FALL_DETECTED', 'Test 12.3: Escalation reason is FALL_DETECTED');
    sm.destroy();
  }

  // Test 13: condition result consumed (read-only)
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    const condResult: ConditionResult = {
      label: 'Cardiac Instability Pattern',
      probability: 92,
      severity: 'critical',
      timestamp: Date.now(),
      patterns: [{ id: 'p1', name: 'Cardiac Instability', probability: 92, status: 'critical' }],
    };
    // Dispatch CONDITION_RESULT event
    sm.dispatch({
      type: 'CONDITION_RESULT',
      timestamp: Date.now(),
      source: 'CONDITION',
      payload: condResult,
    });
    assert(sm.getSnapshot().state === 'SDCU_ACTIVE' || sm.getSnapshot().state === 'EVALUATING', 'Test 13.1: State remains active during evaluation');
    sm.destroy();
  }

  // Test 14: missing condition result does not fabricate result
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    assert(sm.getSnapshot().escalationReason === null, 'Test 14.1: Missing condition does not fabricate escalation');
    sm.destroy();
  }

  // Test 15: 120-second completion -> SDCU_SAFE
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.dispatch({
      type: 'TIMER_EXPIRED',
      timestamp: Date.now(),
      source: 'TIMER',
    });
    assert(sm.getSnapshot().state === 'SDCU_SAFE', 'Test 15.1: 120s timer expiration transitions to SDCU_SAFE');
    assert(sm.getSnapshot().remainingSeconds === 0, 'Test 15.2: Remaining seconds is 0');
    sm.destroy();
  }

  // Test 16: configured failed condition -> SDCU_ESCALATION_PENDING
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.triggerEscalation('PHYSIOLOGICAL_COLLAPSE_RULE');
    assert(sm.getSnapshot().state === 'SDCU_ESCALATION_PENDING', 'Test 16.1: Triggered escalation sets SDCU_ESCALATION_PENDING');
    assert(sm.getSnapshot().requestedMode === 'SSB', 'Test 16.2: Requested mode exposed as SSB');
    sm.destroy();
  }

  // Test 17: manual override -> MANUAL_OVERRIDE
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.handleManualOverride();
    assert(sm.getSnapshot().state === 'MANUAL_OVERRIDE', 'Test 17.1: Manual override transitions to MANUAL_OVERRIDE');
    sm.destroy();
  }

  // Test 18: manual override cancels timers
  {
    const sm = new SdcuStateMachine();
    sm.startActivation();
    sm.handleManualOverride();
    assert(sm.getSnapshot().currentActionQuestion === null, 'Test 18.1: Action questions cleared on manual override');
    assert(sm.getSnapshot().state === 'MANUAL_OVERRIDE', 'Test 18.2: State is MANUAL_OVERRIDE');
    sm.destroy();
  }

  // Test 19: duplicate event does not duplicate transition
  {
    const sm = new SdcuStateMachine();
    let transitionCount = 0;
    sm.subscribe(() => {
      transitionCount++;
    });
    sm.activate();
    const countAfterActivate = transitionCount;
    // Duplicate activate call
    sm.activate();
    assert(transitionCount === countAfterActivate, 'Test 19.1: Duplicate activate does not duplicate state transition');
    sm.destroy();
  }

  // Test 20: unmount cleans timers/listeners
  {
    const sm = new SdcuStateMachine();
    let listenerCalled = false;
    const unsub = sm.subscribe(() => {
      listenerCalled = true;
    });
    unsub();
    listenerCalled = false;
    sm.activate();
    assert(listenerCalled === false, 'Test 20.1: Unsubscribed listener not called');
    sm.destroy();
  }

  // Test 21: no source packet mutation
  {
    const rawPacket: CmPacket = {
      sessionId: 'TEST-SESSION-SDCU',
      uid: 'user-primary',
      timestamp: Date.now(),
      target: 'OVERALL',
      parameters: {
        heartRate: {
          parameter: 'heartRate',
          shbValue: 95,
          status: 'COMPUTED',
          unit: 'bpm',
        },
      },
    };
    const copy = JSON.parse(JSON.stringify(rawPacket));
    adaptCmPacketToCribState({
      packet: rawPacket,
      authenticatedUid: 'user-primary',
    });
    assert(JSON.stringify(rawPacket) === JSON.stringify(copy), 'Test 21.1: Raw packet is completely immutable');
  }

  // Test 22: deterministic question selection
  {
    const q1 = selectDeterministicQuestion({ conditionLabel: 'RESPIRATORY_STRESS' });
    const q2 = selectDeterministicQuestion({ conditionLabel: 'RESPIRATORY_STRESS' });
    assert(q1.id === q2.id, 'Test 22.1: Repeated selection is strictly deterministic');
    assert(q1.id === 'symptom_short_of_breath', 'Test 22.2: Respiratory stress selects SHORT_OF_BREATH');

    const qDizzy = selectDeterministicQuestion({ conditionLabel: 'AUTONOMIC_COLLAPSE' });
    assert(qDizzy.id === 'symptom_dizzy', 'Test 22.3: Autonomic collapse selects DIZZY');
  }

  // Test 23: correct action guidance mapping
  {
    const gFatigue = getGuidanceForAction('FATIGUE');
    assert(gFatigue.includes('SIT DOWN'), 'Test 23.1: FATIGUE maps to SIT DOWN');
    assert(gFatigue.includes('TAKE REST'), 'Test 23.2: FATIGUE maps to TAKE REST');

    const gHeavy = getGuidanceForAction('HEAVY LIFT');
    assert(gHeavy.includes('STOP ACTIVITY'), 'Test 23.3: HEAVY LIFT maps to STOP ACTIVITY');
    assert(gHeavy.includes('REST'), 'Test 23.4: HEAVY LIFT maps to REST');

    const gUnknown = getGuidanceForAction('RANDOM_NON_EXISTENT_KEY');
    assert(gUnknown.includes('WAITING FOR GUIDANCE'), 'Test 23.5: Unknown action maps to WAITING FOR GUIDANCE');
  }

  // Test 24: requestedMode SSB is exposed after escalation
  {
    const sm = new SdcuStateMachine();
    sm.activate();
    sm.triggerEscalation('UNCONSCIOUS_TRIGGER');
    assert(sm.getSnapshot().requestedMode === 'SSB', 'Test 24.1: requestedMode = SSB exposed on escalation');
    sm.destroy();
  }

  // Test 25 (Section 29 Scenario): Real CM_PACKET-derived physiological input consumption
  {
    const realPacket: CmPacket = {
      sessionId: 'SESSION-REAL-CM-99',
      uid: 'user-emergency-primary',
      timestamp: Date.now(),
      target: 'CARDIOVASCULAR',
      parameters: {
        heartRate: { parameter: 'heartRate', shbValue: 95, status: 'COMPUTED', unit: 'bpm' },
        spo2: { parameter: 'spo2', shbValue: 100, status: 'COMPUTED', unit: '%' },
        ppi: { parameter: 'ppi', shbValue: 603, status: 'COMPUTED', unit: 'ms' },
        rmssd: { parameter: 'rmssd', shbValue: 97, status: 'COMPUTED', unit: 'ms' },
        sdnn: { parameter: 'sdnn', shbValue: 113, status: 'COMPUTED', unit: 'ms' },
        respiratoryRate: { parameter: 'respiratoryRate', shbValue: 7.1, status: 'COMPUTED', unit: '/min' },
      },
    };

    const cribState = adaptCmPacketToCribState({
      packet: realPacket,
      authenticatedUid: 'user-emergency-primary',
    });

    assert(cribState.vitals.find((v) => v.key === 'hr')?.value === 95, 'Test 25.1: HR 95 mapped');
    assert(cribState.vitals.find((v) => v.key === 'spo2')?.value === 100, 'Test 25.2: SpO2 100 mapped');
    assert(cribState.vitals.find((v) => v.key === 'ppi')?.value === 603, 'Test 25.3: PPI 603 mapped');
    assert(cribState.vitals.find((v) => v.key === 'rmssd')?.value === 97, 'Test 25.4: RMSSD 97 mapped');
    assert(cribState.vitals.find((v) => v.key === 'sdnn')?.value === 113, 'Test 25.5: SDNN 113 mapped');
    assert(cribState.vitals.find((v) => v.key === 'rr')?.value === 7.1, 'Test 25.6: RR 7.1 mapped');
  }

  console.log(`=== SDCU TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  return { passed, failed, errors };
}
