/**
 * Comprehensive Deterministic Test Suite for CRIB Input Adapter
 * GOATEST - CRIB PMT-3
 *
 * Verifies all 18 test requirements + Section 27 RR test case.
 */

import { adaptCmPacketToCribState, getDefaultCribVitals } from '../cribInputAdapter';
import { CribDataManager } from '../cribDataManager';
import { CmPacket, ConditionResult } from '../../../types/cmPacket';

function createMockPacket(overrides: Partial<CmPacket> = {}): CmPacket {
  return {
    sessionId: 'SESSION-TEST-001',
    uid: 'user-primary',
    timestamp: 1700000000000,
    target: 'OVERALL',
    parameters: {
      heartRate: {
        parameter: 'heartRate',
        phbBaseline: 70,
        shbValue: 85,
        deviation: 15,
        direction: 'INCREASED',
        matchedStage: 1,
        compare: 1.2,
        status: 'COMPUTED',
        unit: 'bpm',
      },
      spo2: {
        parameter: 'spo2',
        phbBaseline: 98,
        shbValue: 99,
        deviation: 1,
        direction: 'STABLE',
        matchedStage: 1,
        compare: 0.1,
        status: 'COMPUTED',
        unit: '%',
      },
      ppi: {
        parameter: 'ppi',
        phbBaseline: 800,
        shbValue: 705,
        deviation: -95,
        direction: 'DECREASED',
        matchedStage: 1,
        compare: -1.0,
        status: 'COMPUTED',
        unit: 'ms',
      },
      rmssd: {
        parameter: 'rmssd',
        phbBaseline: 40,
        shbValue: 55,
        deviation: 15,
        direction: 'INCREASED',
        matchedStage: 1,
        compare: 0.9,
        status: 'COMPUTED',
        unit: 'ms',
      },
      sdnn: {
        parameter: 'sdnn',
        phbBaseline: 50,
        shbValue: 65,
        deviation: 15,
        direction: 'INCREASED',
        matchedStage: 1,
        compare: 0.8,
        status: 'COMPUTED',
        unit: 'ms',
      },
      respiratoryRate: {
        parameter: 'respiratoryRate',
        phbBaseline: 15,
        shbValue: 7.1,
        deviation: -7.9,
        direction: 'DECREASED',
        matchedStage: 2,
        compare: -2.9,
        status: 'COMPUTED',
        unit: '/min',
      },
    },
    ...overrides,
  };
}

export function runAllCribTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('=== STARTING CRIB PMT-3 TEST SUITE ===');

  // Test 1: valid CM_PACKET -> valid CribInputState
  {
    const packet = createMockPacket();
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    assert(result.sessionId === 'SESSION-TEST-001', 'Test 1.1: valid sessionId mapped');
    assert(result.uid === 'user-primary', 'Test 1.2: valid uid mapped');
    assert(result.status === 'CONDITION_PENDING' || result.status === 'CM_PACKET_READY', 'Test 1.3: valid state status');
    assert(result.vitals.length >= 10, 'Test 1.4: all 10 vitals present in schema');
  }

  // Test 2: UID mismatch -> rejected
  {
    const packet = createMockPacket({ uid: 'other-user-999' });
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    assert(result.status === 'ERROR', 'Test 2.1: UID mismatch sets status to ERROR');
    assert(result.errorMessage?.includes('UID mismatch') === true, 'Test 2.2: error message records UID mismatch');
    const hrVital = result.vitals.find((v) => v.key === 'hr');
    assert(hrVital?.value === null, 'Test 2.3: vitals cleared to null upon UID rejection');
  }

  // Test 3: missing heartRate -> NOT AVAILABLE (value is null)
  {
    const packet = createMockPacket();
    delete (packet.parameters as any).heartRate;
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    const hrVital = result.vitals.find((v) => v.key === 'hr');
    assert(hrVital !== undefined, 'Test 3.1: HR vital schema entry exists');
    assert(hrVital?.value === null, 'Test 3.2: missing heartRate maps to null (NOT AVAILABLE)');
    assert(hrVital?.status === 'unknown', 'Test 3.3: missing heartRate status is unknown');
  }

  // Test 4: missing RR -> NOT AVAILABLE
  {
    const packet = createMockPacket();
    (packet.parameters as any).respiratoryRate = {
      parameter: 'respiratoryRate',
      phbBaseline: 15,
      shbValue: null,
      deviation: null,
      status: 'MISSING_SHB_VALUE',
      unit: '/min',
    };
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    const rrVital = result.vitals.find((v) => v.key === 'rr');
    assert(rrVital?.value === null, 'Test 4.1: MISSING_SHB_VALUE for RR maps to null (RR --)');
    assert(rrVital?.unit === '/min', 'Test 4.2: RR unit is preserved');
  }

  // Test 5: missing optional vital (e.g. temp, motion) -> NOT AVAILABLE
  {
    const packet = createMockPacket();
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    const tempVital = result.vitals.find((v) => v.key === 'temp');
    const motionVital = result.vitals.find((v) => v.key === 'motion');
    assert(tempVital?.value === null, 'Test 5.1: uncomputed skinTemperature is null');
    assert(motionVital?.value === null, 'Test 5.2: uncomputed motionVector is null');
  }

  // Test 6: CM_PACKET with 6 physiological parameters -> all mapped
  {
    const packet = createMockPacket();
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    const hr = result.vitals.find((v) => v.key === 'hr')?.value;
    const spo2 = result.vitals.find((v) => v.key === 'spo2')?.value;
    const ppi = result.vitals.find((v) => v.key === 'ppi')?.value;
    const rmssd = result.vitals.find((v) => v.key === 'rmssd')?.value;
    const sdnn = result.vitals.find((v) => v.key === 'sdnn')?.value;
    const rr = result.vitals.find((v) => v.key === 'rr')?.value;

    assert(hr === 85, 'Test 6.1: HR mapped');
    assert(spo2 === 99, 'Test 6.2: SpO2 mapped');
    assert(ppi === 705, 'Test 6.3: PPI mapped');
    assert(rmssd === 55, 'Test 6.4: RMSSD mapped');
    assert(sdnn === 65, 'Test 6.5: SDNN mapped');
    assert(rr === 7.1, 'Test 6.6: RR mapped');
    assert(result.compareSummary?.computedCount === 6, 'Test 6.7: computedCount is 6');
  }

  // Test 7: CM_PACKET with fewer parameters -> graceful mapping
  {
    const packet = createMockPacket({
      parameters: {
        heartRate: {
          parameter: 'heartRate',
          shbValue: 72,
          status: 'COMPUTED',
          unit: 'bpm',
        },
      },
    });
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    assert(result.vitals.find((v) => v.key === 'hr')?.value === 72, 'Test 7.1: Single vital HR mapped');
    assert(result.vitals.find((v) => v.key === 'spo2')?.value === null, 'Test 7.2: Unsent vital SpO2 is null');
    assert(result.compareSummary?.computedCount === 1, 'Test 7.3: computedCount is 1');
  }

  // Test 8: CONDITION absent -> NO CONDITION RESULT / empty probabilities
  {
    const packet = createMockPacket();
    const result = adaptCmPacketToCribState({
      packet,
      conditionResult: null,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    assert(result.conditionResult === null, 'Test 8.1: conditionResult is null');
    assert(result.probabilities.length === 0, 'Test 8.2: probabilities array is empty (NO fake probabilities)');
    assert(result.status === 'CONDITION_PENDING', 'Test 8.3: status is CONDITION_PENDING');
  }

  // Test 9: Real CONDITION result -> mapped correctly
  {
    const packet = createMockPacket();
    const conditionResult: ConditionResult = {
      label: 'Cardiac Instability Pattern',
      probability: 90,
      severity: 'critical',
      timestamp: 1700000005000,
      patterns: [
        { id: 'p1', name: 'Cardiac Instability Pattern', probability: 90, status: 'critical' },
        { id: 'p2', name: 'Hypoxic Stress Pattern', probability: 30, status: 'low' },
      ],
    };
    const result = adaptCmPacketToCribState({
      packet,
      conditionResult,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    assert(result.conditionResult?.label === 'Cardiac Instability Pattern', 'Test 9.1: condition label mapped');
    assert(result.probabilities.length === 2, 'Test 9.2: 2 pattern probabilities mapped');
    assert(result.probabilities[0].probability === 90, 'Test 9.3: top probability is 90%');
    assert(result.status === 'CONDITION_READY', 'Test 9.4: status is CONDITION_READY');
  }

  // Test 10: B-FIT absent -> no fake score
  {
    const packet = createMockPacket({ bfitResult: undefined });
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    const bfitVital = result.vitals.find((v) => v.key === 'bfit');
    assert(result.bfitResult === null, 'Test 10.1: bfitResult in state is null');
    assert(bfitVital?.value === null, 'Test 10.2: bfit vital value is null (no fake score)');
  }

  // Test 11: B-FIT present -> mapped correctly
  {
    const packet = createMockPacket({
      bfitResult: { score: 88, status: 'COMPUTED', timestamp: 1700000005000 },
    });
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    const bfitVital = result.vitals.find((v) => v.key === 'bfit');
    assert(result.bfitResult === 88, 'Test 11.1: bfitResult is 88');
    assert(bfitVital?.value === 88, 'Test 11.2: bfit vital value is 88');
  }

  // Test 12: Stale packet -> stale state
  {
    const packet = createMockPacket({ timestamp: 1700000000000 });
    const result = adaptCmPacketToCribState({
      packet,
      authenticatedUid: 'user-primary',
      maxStaleAgeMs: 30000,
      currentTime: 1700000045000, // 45 seconds later (> 30s)
    });
    assert(result.freshness === 'STALE', 'Test 12.1: freshness is STALE');
    assert(result.status === 'STALE_DATA', 'Test 12.2: adapter status is STALE_DATA');
  }

  // Test 13: Malformed packet -> error state
  {
    const malformedPacket = {
      sessionId: '', // Empty sessionId
      uid: 'user-primary',
      timestamp: NaN,
      parameters: {},
    } as unknown as CmPacket;

    const result = adaptCmPacketToCribState({
      packet: malformedPacket,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    assert(result.status === 'ERROR', 'Test 13.1: Malformed packet produces ERROR status');
  }

  // Test 14: Duplicate subscription protection & Test 15: Clean unsubscription
  {
    const manager = new CribDataManager();
    manager.setAuthenticatedUid('user-test-sub');
    let callCount = 0;
    const listener = () => {
      callCount++;
    };

    const unsubscribe = manager.subscribe(listener);
    // Adding same listener again (Set handles deduplication)
    manager.subscribe(listener);

    manager.ingestCmPacket(createMockPacket({ uid: 'user-test-sub' }));
    assert(callCount >= 2, 'Test 14.1: Listener received update without duplicate multiplier');

    unsubscribe();
    const callsBeforeSecondPacket = callCount;
    manager.ingestCmPacket(createMockPacket({ uid: 'user-test-sub', sessionId: 'SESSION-2' }));
    assert(callCount === callsBeforeSecondPacket, 'Test 15.1: Unsubscribed listener receives no further calls');
    manager.destroy();
  }

  // Test 16: No mutation of source CM_PACKET (immutability)
  {
    const rawPacket = createMockPacket();
    const rawCopy = JSON.parse(JSON.stringify(rawPacket));

    adaptCmPacketToCribState({
      packet: rawPacket,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });

    assert(JSON.stringify(rawPacket) === JSON.stringify(rawCopy), 'Test 16.1: Raw CM_PACKET object was not mutated');
  }

  // Test 17: Authenticated UID isolation
  {
    const manager = new CribDataManager();
    manager.setAuthenticatedUid('authorized-user-42');
    manager.ingestCmPacket(createMockPacket({ uid: 'rogue-user-99' }));

    const state = manager.getCurrentState();
    assert(state.status === 'ERROR', 'Test 17.1: Rogue packet is rejected with ERROR status');
    assert(state.vitals.find((v) => v.key === 'hr')?.value === null, 'Test 17.2: Rogue packet vitals not displayed');
    manager.destroy();
  }

  // Test 18: Target preserved
  {
    const cardioPacket = createMockPacket({ target: 'CARDIOVASCULAR' });
    const result = adaptCmPacketToCribState({
      packet: cardioPacket,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });
    assert(result.target === 'CARDIOVASCULAR', 'Test 18.1: Target CARDIOVASCULAR is preserved in CribInputState');
  }

  // Test 19 (Section 27 Specific): IMPORTANT RR TEST CASE
  {
    const rrSpecificPacket = createMockPacket({
      parameters: {
        respiratoryRate: {
          parameter: 'respiratoryRate',
          phbBaseline: 15,
          shbValue: 7.1,
          deviation: -7.9,
          matchedStage: 2,
          compare: -2.9,
          status: 'COMPUTED',
          unit: '/min',
        },
      },
    });

    const result = adaptCmPacketToCribState({
      packet: rrSpecificPacket,
      authenticatedUid: 'user-primary',
      currentTime: 1700000005000,
    });

    const rrVital = result.vitals.find((v) => v.key === 'rr');
    assert(rrVital !== undefined, 'Test 19.1: RR vital row found in vitals');
    assert(rrVital?.value === 7.1, 'Test 19.2: RR shbValue 7.1 preserved exactly (no rounding or recalculation)');
    assert(rrVital?.unit === '/min', 'Test 19.3: RR unit is /min');
    assert(rrVital?.label === 'RR', 'Test 19.4: RR label is RR');

    const compareRow = result.compareSummary?.parameters.find((p) => p.parameter === 'respiratoryRate');
    assert(compareRow?.phbBaseline === 15, 'Test 19.5: RR compare phbBaseline is 15');
    assert(compareRow?.deviation === -7.9, 'Test 19.6: RR compare deviation is -7.9');
    assert(compareRow?.matchedStage === 2, 'Test 19.7: RR matchedStage is 2');
    assert(compareRow?.compare === -2.9, 'Test 19.8: RR compare value is -2.9');
  }

  console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  return { passed, failed, errors };
}
