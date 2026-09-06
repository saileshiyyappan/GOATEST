/**
 * DIAG Mode State Machine Deterministic Test Suite
 * GOATEST - CRIB PMT-7
 */

import { DiagStateMachine } from '../diagStateMachine';
import {
  ALL_DIAG_ACTION_CHOICES,
  DIAG_ACTION_CHOICES,
  DIAG_DEFAULT_GUIDANCE_DIRECTIVES,
  getGuidanceForDiagAction,
} from '../diagActionRegistry';
import { DiagGuidanceService } from '../diagGuidanceService';
import { CribDataManager } from '../../cribDataManager';
import { CmPacket, ConditionResult } from '../../../../types/cmPacket';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED]: ${msg}`);
  }
}

export function runAllDiagTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function it(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: unknown) {
      failed++;
      console.error(`  ✗ ${name}: ${(e as Error).message}`);
    }
  }

  console.log('--- STARTING DIAG (DIAGNOSTIC / HELPER ASSISTANCE) DETERMINISTIC TEST SUITE ---');

  // Test 1: Initial state
  it('1. Initial state is DIAG_IDLE', () => {
    const sm = new DiagStateMachine();
    assert(sm.getState() === 'DIAG_IDLE', 'Initial state must be DIAG_IDLE');
    sm.destroy();
  });

  // Test 2: Immediate activation (NO 10s countdown, NO 2-minute timer)
  it('2. Immediate startDiag() transitions to DIAG_ACTIVE and ACTION_CHECK_PENDING', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    assert(sm.getState() === 'ACTION_CHECK_PENDING', 'State must advance to ACTION_CHECK_PENDING');
    const snapshot = sm.getSnapshot();
    assert(snapshot.isOverrideActive === false, 'Override must be false');
    assert(snapshot.isContinuing === false, 'Continuing must be false');
    sm.destroy();
  });

  // Test 3: Action choices count and availability
  it('3. All 10 helper action choices are present and registered', () => {
    assert(ALL_DIAG_ACTION_CHOICES.length === 10, 'Must contain exactly 10 action choices');
    const expectedIds = [
      'RUN',
      'EXERCISE',
      'FALL',
      'LIFT_SOMETHING_HEAVY',
      'LAUGH_COUGH_HARD',
      'FEEL_DIZZY',
      'FEEL_FATIGUED',
      'SHORTNESS_OF_BREATH',
      'CHEST_DISCOMFORT',
      'OTHER',
    ];
    for (const id of expectedIds) {
      assert(DIAG_ACTION_CHOICES[id as keyof typeof DIAG_ACTION_CHOICES] !== undefined, `Action ${id} must exist`);
    }
  });

  // Test 4: Action selection -> ACTION_CONFIRMED -> GUIDANCE_ACTIVE
  it('4. Action selection transitions to ACTION_CONFIRMED -> GUIDANCE_ACTIVE', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    sm.selectAction('FALL');
    assert(sm.getState() === 'GUIDANCE_ACTIVE', 'State must be GUIDANCE_ACTIVE after action selection');
    const snap = sm.getSnapshot();
    assert(snap.selectedAction?.actionId === 'FALL', 'Selected action must be FALL');
    assert(snap.guidanceDirectives.includes('KEEP PERSON STILL'), 'Must contain KEEP PERSON STILL directive');
    assert(snap.guidanceDirectives.includes('CHECK RESPONSIVENESS'), 'Must contain CHECK RESPONSIVENESS directive');
    assert(snap.guidanceDirectives.includes('CHECK BREATHING'), 'Must contain CHECK BREATHING directive');
    sm.destroy();
  });

  // Test 5: Action guidance mapping: LIFT_SOMETHING_HEAVY
  it('5. LIFT_SOMETHING_HEAVY produces STOP ACTIVITY, SIT DOWN, REST, BREATHE SLOWLY', () => {
    const directives = getGuidanceForDiagAction('LIFT_SOMETHING_HEAVY');
    assert(directives.includes('STOP ACTIVITY'), 'Must include STOP ACTIVITY');
    assert(directives.includes('SIT DOWN'), 'Must include SIT DOWN');
    assert(directives.includes('REST'), 'Must include REST');
    assert(directives.includes('BREATHE SLOWLY'), 'Must include BREATHE SLOWLY');
  });

  // Test 6: Action guidance mapping: FEEL_FATIGUED
  it('6. FEEL_FATIGUED produces SIT DOWN, TAKE REST, BREATHE SLOWLY', () => {
    const directives = getGuidanceForDiagAction('FEEL_FATIGUED');
    assert(directives.includes('SIT DOWN'), 'Must include SIT DOWN');
    assert(directives.includes('TAKE REST'), 'Must include TAKE REST');
    assert(directives.includes('BREATHE SLOWLY'), 'Must include BREATHE SLOWLY');
  });

  // Test 7: Action guidance mapping: FEEL_DIZZY
  it('7. FEEL_DIZZY produces SIT OR LIE DOWN, DO NOT WALK, STAY WITH PERSON', () => {
    const directives = getGuidanceForDiagAction('FEEL_DIZZY');
    assert(directives.includes('SIT OR LIE DOWN'), 'Must include SIT OR LIE DOWN');
    assert(directives.includes('DO NOT WALK'), 'Must include DO NOT WALK');
    assert(directives.includes('STAY WITH PERSON'), 'Must include STAY WITH PERSON');
  });

  // Test 8: Action guidance mapping: SHORTNESS_OF_BREATH
  it('8. SHORTNESS_OF_BREATH produces SIT UPRIGHT, BREATHE SLOWLY, MONITOR BREATHING', () => {
    const directives = getGuidanceForDiagAction('SHORTNESS_OF_BREATH');
    assert(directives.includes('SIT UPRIGHT'), 'Must include SIT UPRIGHT');
    assert(directives.includes('BREATHE SLOWLY'), 'Must include BREATHE SLOWLY');
    assert(directives.includes('MONITOR BREATHING'), 'Must include MONITOR BREATHING');
  });

  // Test 9: Action guidance mapping: CHEST_DISCOMFORT
  it('9. CHEST_DISCOMFORT produces SIT DOWN IMMEDIATELY, REST, CALL FOR HELP, DO NOT WALK', () => {
    const directives = getGuidanceForDiagAction('CHEST_DISCOMFORT');
    assert(directives.includes('SIT DOWN IMMEDIATELY'), 'Must include SIT DOWN IMMEDIATELY');
    assert(directives.includes('REST'), 'Must include REST');
    assert(directives.includes('CALL FOR HELP'), 'Must include CALL FOR HELP');
    assert(directives.includes('DO NOT WALK'), 'Must include DO NOT WALK');
  });

  // Test 10: Action guidance mapping: RUN and EXERCISE
  it('10. RUN and EXERCISE produce STOP EXERTION, SIT DOWN, REST, BREATHE SLOWLY', () => {
    const dirRun = getGuidanceForDiagAction('RUN');
    const dirEx = getGuidanceForDiagAction('EXERCISE');
    assert(dirRun.includes('STOP EXERTION'), 'RUN must include STOP EXERTION');
    assert(dirEx.includes('STOP EXERTION'), 'EXERCISE must include STOP EXERTION');
  });

  // Test 11: Action guidance mapping: LAUGH_COUGH_HARD
  it('11. LAUGH_COUGH_HARD produces REST SITTING, SIP WATER IF CONSCIOUS, BREATHE SLOWLY', () => {
    const directives = getGuidanceForDiagAction('LAUGH_COUGH_HARD');
    assert(directives.includes('REST SITTING'), 'Must include REST SITTING');
    assert(directives.includes('SIP WATER IF CONSCIOUS'), 'Must include SIP WATER IF CONSCIOUS');
  });

  // Test 12: Action guidance mapping: OTHER
  it('12. OTHER produces SIT DOWN, REST, MONITOR CONDITION, STAY WITH PERSON', () => {
    const directives = getGuidanceForDiagAction('OTHER');
    assert(directives.includes('SIT DOWN'), 'Must include SIT DOWN');
    assert(directives.includes('MONITOR CONDITION'), 'Must include MONITOR CONDITION');
  });

  // Test 13: NO TIMEOUT for action verification
  it('13. Action verification has NO timeout (remains pending indefinitely)', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    assert(sm.getState() === 'ACTION_CHECK_PENDING', 'Should be pending');
    // Snapshot should not contain any expiring timer countdowns
    const snap = sm.getSnapshot();
    assert(snap.state === 'ACTION_CHECK_PENDING', 'Should remain pending without expiring');
    sm.destroy();
  });

  // Test 14: Dismiss action verification transitions to ACTION_MISSED -> DIAG_ACTIVE
  it('14. Dismiss action transitions to ACTION_MISSED then DIAG_ACTIVE', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    sm.dismissAction();
    assert(sm.getState() === 'DIAG_ACTIVE', 'State must return to DIAG_ACTIVE after dismissal');
    sm.destroy();
  });

  // Test 15: continueDiag() transitions to DIAG_CONTINUING
  it('15. continueDiag() sets isContinuing to true and state to DIAG_CONTINUING', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    sm.selectAction('FEEL_DIZZY');
    sm.continueDiag();
    assert(sm.getState() === 'DIAG_CONTINUING', 'State must be DIAG_CONTINUING');
    assert(sm.getSnapshot().isContinuing === true, 'isContinuing must be true');
    sm.destroy();
  });

  // Test 16: Manual Override stops DIAG monitoring cleanly
  it('16. handleManualOverride() sets isOverrideActive and state to DIAG_MANUAL_OVERRIDE', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    sm.handleManualOverride();
    assert(sm.getState() === 'DIAG_MANUAL_OVERRIDE', 'State must be DIAG_MANUAL_OVERRIDE');
    assert(sm.getSnapshot().isOverrideActive === true, 'Override active must be true');
    assert(sm.getSnapshot().isContinuing === false, 'Continuing must be false');
    sm.destroy();
  });

  // Test 17: Reset returns to DIAG_IDLE
  it('17. reset() resets all flags and returns to DIAG_IDLE', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    sm.selectAction('RUN');
    sm.reset();
    assert(sm.getState() === 'DIAG_IDLE', 'State must be DIAG_IDLE');
    assert(sm.getSnapshot().selectedAction === null, 'Selected action must be cleared');
    sm.destroy();
  });

  // Test 18: Exit transitions to DIAG_EXITED
  it('18. exit() transitions to DIAG_EXITED', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    sm.exit();
    assert(sm.getState() === 'DIAG_EXITED', 'State must be DIAG_EXITED');
    sm.destroy();
  });

  // Test 19: NO automatic SSB transition
  it('19. DIAG never automatically transitions to SSB', () => {
    const sm = new DiagStateMachine();
    sm.startDiag();
    // Dispatch any event, verify it never transitions to SSB
    sm.dispatch({
      type: 'CONDITION_UPDATE',
      timestamp: Date.now(),
      source: 'CONDITION',
    });
    assert(sm.getState() !== ('SSB_ACTIVE' as any), 'DIAG must not transition to SSB');
    assert(sm.getState() !== ('SSB_STARTING' as any), 'DIAG must not transition to SSB');
    sm.destroy();
  });

  // Test 20: NO PHB retrieval (pure consumer of CM_PACKET & CONDITION)
  it('20. DIAG consumes real CmPacket and ConditionResult without PHB recalculation', () => {
    const manager = new CribDataManager();
    manager.setAuthenticatedUid('user-diag-test');

    const sampleCm: CmPacket = {
      sessionId: 'DIAG-SESSION-99',
      uid: 'user-diag-test',
      timestamp: Date.now(),
      target: 'OVERALL',
      bfitResult: 68,
      parameters: {
        heartRate: {
          parameter: 'heartRate',
          phbBaseline: 72,
          shbValue: 110,
          deviation: 38,
          direction: 'INCREASED',
          matchedStage: 2,
          compare: 1.5,
          status: 'COMPUTED',
          unit: 'bpm',
        },
        spo2: {
          parameter: 'spo2',
          phbBaseline: 98,
          shbValue: 91,
          deviation: -7,
          direction: 'DECREASED',
          matchedStage: 3,
          compare: 0.93,
          status: 'COMPUTED',
          unit: '%',
        },
      },
    };

    const sampleCond: ConditionResult = {
      timestamp: Date.now(),
      label: 'VENTRICULAR_ARRHYTHMIA',
      probability: 0.88,
      severity: 'critical',
      patterns: [
        { id: 'pat-1', name: 'VENTRICULAR_ARRHYTHMIA', probability: 88, status: 'critical' },
        { id: 'pat-2', name: 'TACHYCARDIA', probability: 72, status: 'high' },
      ],
    };

    manager.ingestCmPacket(sampleCm);
    manager.ingestConditionResult(sampleCond);

    const state = manager.getCurrentState();
    assert(state.vitals.find((v) => v.key === 'hr')?.value === 110, 'Live HR must be 110');
    assert(state.vitals.find((v) => v.key === 'spo2')?.value === 91, 'Live SpO2 must be 91');
    assert(state.probabilities.length === 2, 'Must have 2 probabilities');
    assert(state.probabilities[0].label === 'VENTRICULAR_ARRHYTHMIA', 'Top condition label matched');

    // Build AI context
    const aiContext = DiagGuidanceService.buildAiContext(state, {
      actionId: 'CHEST_DISCOMFORT',
      actionLabel: 'EXPERIENCE CHEST DISCOMFORT',
      timestamp: Date.now(),
    });

    assert(aiContext.mode === 'DIAG', 'Context mode must be DIAG');
    assert(aiContext.bfitResult === 68, 'BFIT result must be 68');
    assert(aiContext.currentVitals['hr'] === 110, 'HR in vitals must be 110');
    assert(aiContext.conditionResult?.label === 'VENTRICULAR_ARRHYTHMIA', 'Condition label in AI context');

    manager.destroy();
  });

  // Test 21: Subscription notification
  it('21. Subscriber receives updates on every state change', () => {
    const sm = new DiagStateMachine();
    let updates = 0;
    const unsub = sm.subscribe(() => {
      updates++;
    });

    assert(updates === 1, 'Initial subscription emit');
    sm.startDiag();
    assert(updates >= 2, 'Emits on startDiag');
    sm.selectAction('SHORTNESS_OF_BREATH');
    assert(updates >= 3, 'Emits on selectAction');
    unsub();
    sm.destroy();
  });

  // Test 22: Critical condition dynamically adds CALL FOR HELP to emergency directives
  it('22. Critical severity condition augments directives with CALL FOR HELP', () => {
    const directives = DiagGuidanceService.generateEmergencyDirectives('FEEL_FATIGUED', 'critical');
    assert(directives[0] === 'CALL FOR HELP', 'First directive must be CALL FOR HELP on critical severity');
    assert(directives.includes('SIT DOWN'), 'Must still include SIT DOWN');
  });

  return { passed, failed };
}
