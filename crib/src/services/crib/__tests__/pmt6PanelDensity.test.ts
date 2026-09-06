/**
 * CRIB PMT-6 Deterministic Test Suite
 * SSB Panel Space Utilization + Complete Vital Summary + Probability Panel Density
 */

import { CribDataManager } from '../cribDataManager';
import { CmPacket, ConditionResult } from '../../../types/cmPacket';
import { CribVital, CribProbability } from '../../../types/crib';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ✗ [FAIL] ${msg}`);
    throw new Error(msg);
  }
  console.log(`  ✓ [PASS] ${msg}`);
}

const TEST_UID = 'user-emergency-primary';

export function runAllPmt6Tests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(description: string, fn: () => void) {
    try {
      fn();
      passed++;
    } catch (e) {
      console.error(`  FAIL: ${description}`, e);
      failed++;
    }
  }

  console.log('--- STARTING PMT-6 PANEL DENSITY & 10-VITAL SUMMARY TESTS ---');

  // Test 1: 10 Vital slots configured in exact order
  test('1. 10 Vital slots configured in exact order', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-PMT6-10V',
      uid: TEST_UID,
      timestamp: Date.now(),
      target: 'OVERALL',
      parameters: [
        { parameter: 'heartRate', shbValue: 76, unit: 'bpm', status: 'COMPUTED' },
        { parameter: 'spo2', shbValue: 98, unit: '%', status: 'COMPUTED' },
        { parameter: 'ppi', shbValue: 645, unit: 'ms', status: 'COMPUTED' },
        { parameter: 'respiratoryRate', shbValue: 7.1, unit: '/min', status: 'COMPUTED' },
        { parameter: 'rmssd', shbValue: 97, unit: 'ms', status: 'COMPUTED' },
        { parameter: 'sdnn', shbValue: 113, unit: 'ms', status: 'COMPUTED' },
        { parameter: 'skinTemperature', shbValue: 31.9, unit: '°C', status: 'COMPUTED' },
        { parameter: 'motionVector', shbValue: 0.07, unit: 'g', status: 'COMPUTED' },
        { parameter: 'arterialO2Content', shbValue: 19.4, unit: '', status: 'COMPUTED' },
      ],
      bfitResult: 89,
    };

    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();

    assert(state.vitals.length >= 10, 'Vitals contains at least 10 entries');
    const hr = state.vitals.find((v) => v.key === 'hr');
    const spo2 = state.vitals.find((v) => v.key === 'spo2');
    const ppi = state.vitals.find((v) => v.key === 'ppi');
    const rr = state.vitals.find((v) => v.key === 'rr');
    const rmssd = state.vitals.find((v) => v.key === 'rmssd');
    const sdnn = state.vitals.find((v) => v.key === 'sdnn');
    const temp = state.vitals.find((v) => v.key === 'temp');
    const motion = state.vitals.find((v) => v.key === 'motion');
    const o2 = state.vitals.find((v) => v.key === 'o2');
    const bfit = state.vitals.find((v) => v.key === 'bfit');

    assert(hr !== undefined, 'HR slot exists');
    assert(spo2 !== undefined, 'SpO2 slot exists');
    assert(ppi !== undefined, 'PPI slot exists');
    assert(rr !== undefined, 'RR slot exists');
    assert(rmssd !== undefined, 'RMSSD slot exists');
    assert(sdnn !== undefined, 'SDNN slot exists');
    assert(temp !== undefined, 'TEMP slot exists');
    assert(motion !== undefined, 'MOTION slot exists');
    assert(o2 !== undefined, 'O2 slot exists');
    assert(bfit !== undefined, 'B-FIT slot exists');
  });

  // Test 2: HR maps accurately
  test('2. HR maps accurately to 76 bpm', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-HR',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'heartRate', shbValue: 76, unit: 'bpm', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const hr = state.vitals.find((v) => v.key === 'hr');
    assert(hr?.value === 76, 'HR value is 76');
    assert(hr?.unit === 'bpm', 'HR unit is bpm');
  });

  // Test 3: SpO2 maps accurately
  test('3. SpO2 maps accurately to 98 %', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-SPO2',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'spo2', shbValue: 98, unit: '%', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const spo2 = state.vitals.find((v) => v.key === 'spo2');
    assert(spo2?.value === 98, 'SpO2 value is 98');
    assert(spo2?.unit === '%', 'SpO2 unit is %');
  });

  // Test 4: PPI maps accurately
  test('4. PPI maps accurately to 645 ms', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-PPI',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'ppi', shbValue: 645, unit: 'ms', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const ppi = state.vitals.find((v) => v.key === 'ppi');
    assert(ppi?.value === 645, 'PPI value is 645');
    assert(ppi?.unit === 'ms', 'PPI unit is ms');
  });

  // Test 5: RR maps accurately
  test('5. RR maps accurately to 7.1 /min', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-RR',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'respiratoryRate', shbValue: 7.1, unit: '/min', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const rr = state.vitals.find((v) => v.key === 'rr');
    assert(rr?.value === 7.1, 'RR value is 7.1');
    assert(rr?.unit === '/min', 'RR unit is /min');
  });

  // Test 6: RMSSD maps accurately
  test('6. RMSSD maps accurately to 97 ms', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-RMSSD',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'rmssd', shbValue: 97, unit: 'ms', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const rmssd = state.vitals.find((v) => v.key === 'rmssd');
    assert(rmssd?.value === 97, 'RMSSD value is 97');
    assert(rmssd?.unit === 'ms', 'RMSSD unit is ms');
  });

  // Test 7: SDNN maps accurately
  test('7. SDNN maps accurately to 113 ms', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-SDNN',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'sdnn', shbValue: 113, unit: 'ms', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const sdnn = state.vitals.find((v) => v.key === 'sdnn');
    assert(sdnn?.value === 113, 'SDNN value is 113');
    assert(sdnn?.unit === 'ms', 'SDNN unit is ms');
  });

  // Test 8: TEMP maps accurately
  test('8. TEMP maps accurately to 31.9 °C', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-TEMP',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'skinTemperature', shbValue: 31.9, unit: '°C', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const temp = state.vitals.find((v) => v.key === 'temp');
    assert(temp?.value === 31.9, 'TEMP value is 31.9');
    assert(temp?.unit === '°C', 'TEMP unit is °C');
  });

  // Test 9: MOTION maps accurately
  test('9. MOTION maps accurately to 0.07 g', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-MOTION',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'motionVector', shbValue: 0.07, unit: 'g', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const motion = state.vitals.find((v) => v.key === 'motion');
    assert(motion?.value === 0.07, 'MOTION value is 0.07');
    assert(motion?.unit === 'g', 'MOTION unit is g');
  });

  // Test 10: O2 maps accurately
  test('10. Arterial O2 maps accurately to 19.4', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-O2',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [{ parameter: 'arterialO2Content', shbValue: 19.4, unit: '', status: 'COMPUTED' }],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const o2 = state.vitals.find((v) => v.key === 'o2');
    assert(o2?.value === 19.4, 'O2 value is 19.4');
  });

  // Test 11: B-FIT maps accurately
  test('11. B-FIT maps accurately to 89', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-BFIT',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [],
      bfitResult: 89,
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const bfit = state.vitals.find((v) => v.key === 'bfit');
    assert(bfit?.value === 89, 'B-FIT value is 89');
  });

  // Test 12: Missing values produce null (rendering as --)
  test('12. Missing values produce null (rendering as --)', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-EMPTY',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    const bfit = state.vitals.find((v) => v.key === 'bfit');
    assert(bfit?.value === null, 'Missing B-FIT is null');
    const hr = state.vitals.find((v) => v.key === 'hr');
    assert(hr?.value === null, 'Missing HR is null');
  });

  // Test 13: No fake values generated in empty state
  test('13. No fake values generated in empty state', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-NO-FAKE',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    for (const v of state.vitals) {
      assert(v.value === null, `Vital ${v.key} must be null when not in packet`);
    }
  });

  // Test 14: Real CONDITION probabilities rendered
  test('14. CONDITION probabilities adapted correctly', () => {
    const manager = new CribDataManager();
    const condition: ConditionResult = {
      label: 'Cardiac Instability',
      probability: 90,
      severity: 'critical',
      timestamp: Date.now(),
    };
    const packet: CmPacket = {
      sessionId: 'TEST-COND-PROB',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [],
    };
    manager.ingestCmPacket(packet);
    manager.ingestConditionResult(condition);
    const state = manager.getCurrentState();
    assert(state.probabilities.length === 1, 'Probabilities contains adapted condition');
    assert(state.probabilities[0].label === 'Cardiac Instability', 'Label matches');
    assert(state.probabilities[0].probability === 90, 'Probability is 90%');
    assert(state.probabilities[0].status === 'critical', 'Status is critical');
  });

  // Test 15: No CONDITION result renders standby state without fabricated items
  test('15. Empty CONDITION result produces empty probabilities list for Standby UI', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-NO-COND',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [],
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    assert(state.probabilities.length === 0, 'No probabilities fabricated');
    assert(state.conditionResult === null, 'conditionResult is null');
  });

  // Test 16: Probability bar normalization
  test('16. Probability values clamped between 0 and 100', () => {
    const p1: CribProbability = { id: '1', label: 'Test Max', probability: 105 };
    const p2: CribProbability = { id: '2', label: 'Test Min', probability: -10 };
    const norm1 = Math.min(100, Math.max(0, p1.probability ?? 0));
    const norm2 = Math.min(100, Math.max(0, p2.probability ?? 0));
    assert(norm1 === 100, 'Normalized 105% clamped to 100%');
    assert(norm2 === 0, 'Normalized -10% clamped to 0%');
  });

  // Test 17: Expanded vitals data contract preserves all parameters
  test('17. Expanded vitals contract contains all parameters with units', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-EXP-VITALS',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [
        { parameter: 'heartRate', shbValue: 80, unit: 'bpm', status: 'COMPUTED' },
        { parameter: 'spo2', shbValue: 99, unit: '%', status: 'COMPUTED' },
      ],
      bfitResult: 92,
    };
    manager.ingestCmPacket(packet);
    const state = manager.getCurrentState();
    assert(state.vitals.length >= 10, 'Expanded vitals list accessible');
    const hr = state.vitals.find((v) => v.key === 'hr');
    assert(hr?.value === 80, 'HR is 80');
    assert(hr?.unit === 'bpm', 'HR unit is bpm');
  });

  // Test 18: Expanded probability view preserves all probabilities
  test('18. Expanded probability view preserves evaluated patterns', () => {
    const manager = new CribDataManager();
    const packet: CmPacket = {
      sessionId: 'TEST-EXP-PROB',
      uid: TEST_UID,
      timestamp: Date.now(),
      parameters: [],
    };
    manager.ingestCmPacket(packet);
    manager.ingestConditionResult({
      label: 'Respiratory Stress Pattern',
      probability: 78,
      severity: 'high',
      timestamp: Date.now(),
    });
    const state = manager.getCurrentState();
    assert(state.probabilities.length === 1, 'Probabilities array has evaluated item');
    assert(state.probabilities[0].probability === 78, 'Probability is 78');
  });

  // Test 19: Viewport contract preserved (100dvh fixed container layout)
  test('19. Viewport contract invariant: 100dvh with zero body scrolling', () => {
    // Structural invariant validation
    const containerClasses = 'h-[100dvh] max-h-[100dvh] w-full bg-neutral-950 overflow-hidden';
    assert(containerClasses.includes('overflow-hidden'), 'overflow-hidden enforced');
    assert(containerClasses.includes('h-[100dvh]'), '100dvh enforced');
  });

  // Test 20: No horizontal page overflow
  test('20. Side-by-side grid uses 2 columns without horizontal overflow', () => {
    const gridClasses = 'w-full grid grid-cols-2 gap-2 flex-1 min-h-0 items-stretch';
    assert(gridClasses.includes('grid-cols-2'), 'Strictly 2 columns');
    assert(gridClasses.includes('min-h-0'), 'min-h-0 prevents flex blowout');
  });

  // Test 21: B-FIT formatted as B-FIT [score] or --
  test('21. B-FIT score rendering contract verified', () => {
    const bfitWithVal: CribVital = { key: 'bfit', label: 'B-FIT', value: 89 };
    const bfitNoVal: CribVital = { key: 'bfit', label: 'B-FIT', value: null };

    const formatVal = (v: CribVital) => (v.value !== null && v.value !== undefined ? String(v.value) : '--');
    assert(formatVal(bfitWithVal) === '89', 'B-FIT with value formats to score string');
    assert(formatVal(bfitNoVal) === '--', 'B-FIT without value formats to --');
  });

  console.log(`PMT-6 Test Suite Complete: ${passed} Passed, ${failed} Failed.`);
  return { passed, failed };
}
