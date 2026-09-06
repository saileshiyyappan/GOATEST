import {
  shbSessionCache,
  validateShbVitalsLock,
  ShbCompletedSessionCache,
} from '../shbSessionCache';
import { LiveVitalsState } from '../../../types/shb';

export function runShbSessionCacheTests() {
  const results: { name: string; passed: boolean; details: string }[] = [];

  // Clear cache first
  shbSessionCache.clear();

  // Test 1: Cache starts empty
  const test1Passed = !shbSessionCache.hasSession() && shbSessionCache.getSession() === null;
  results.push({
    name: 'Initial Cache Empty',
    passed: test1Passed,
    details: `hasSession: ${shbSessionCache.hasSession()}`,
  });

  // Test 2: Setting and retrieving valid session result
  const mockSession: ShbCompletedSessionCache = {
    sessionId: 'test_session_123',
    targetOrgan: 'OVERALL',
    acquisitionDuration: 65,
    completedAt: Date.now(),
    directVitals: {} as any,
    indirectVitals: {} as any,
    lockedDirectVitals: {
      hr: 72,
      spo2: 98,
      ppi: 833,
      heartRate: 72,
    },
    lockedIndirectVitals: {
      rmssd: 35.4,
      sdnn: 42.1,
      rr: 15.0,
      respiratoryRate: 15.0,
    },
    lockedContextVariables: {
      activityIntensity: 0.05,
      ambientTemperature: 24.5,
      relativeHumidity: 45.0,
      atmosphericPressure: 1013.25,
      altitude: 120.0,
    },
    bfit: {
      status: 'ALLOW',
      confidence: 0.95,
      sensorContact: true,
      motionStability: 0.98,
      interferenceCount: 0,
      message: 'Optimal',
    },
    sessionStatus: 'COMPLETED',
    finalResultPacket: null,
  };

  shbSessionCache.setSession(mockSession);
  const cached = shbSessionCache.getSession();
  const test2Passed =
    shbSessionCache.hasSession() &&
    cached?.sessionId === 'test_session_123' &&
    cached?.lockedDirectVitals.hr === 72 &&
    cached?.lockedDirectVitals.spo2 === 98;
  results.push({
    name: 'Set and Retrieve Cache Result',
    passed: test2Passed,
    details: `Cached ID: ${cached?.sessionId}, HR: ${cached?.lockedDirectVitals.hr}`,
  });

  // Test 3: Clear cache
  shbSessionCache.clear();
  const test3Passed = !shbSessionCache.hasSession() && shbSessionCache.getSession() === null;
  results.push({
    name: 'Clear Cache Upon Exit',
    passed: test3Passed,
    details: `hasSession after clear: ${shbSessionCache.hasSession()}`,
  });

  // Test 4: Validation of fully locked vitals state
  const mockValidState: LiveVitalsState = {
    isAcquiring: false,
    engineStatus: 'LOCKED',
    elapsedSeconds: 65,
    targetDurationSeconds: 65,
    directVitals: {
      hr: { id: 'hr', label: 'Heart Rate', shortCode: 'HR', liveValue: 72, lockedValue: 72, sampleCount: 1400, unit: 'BPM', status: 'LOCKED' },
      spo2: { id: 'spo2', label: 'SpO2', shortCode: 'SpO2', liveValue: 98, lockedValue: 98, sampleCount: 1400, unit: '%', status: 'LOCKED' },
      ppi: { id: 'ppi', label: 'PPI', shortCode: 'PPI', liveValue: 833, lockedValue: 833, sampleCount: 1400, unit: 'ms', status: 'LOCKED' },
    },
    indirectVitals: {
      rmssd: { id: 'rmssd', label: 'RMSSD', shortCode: 'RMSSD', value: 35.4, lockedValue: 35.4, unit: 'ms', status: 'LOCKED' },
      sdnn: { id: 'sdnn', label: 'SDNN', shortCode: 'SDNN', value: 42.1, lockedValue: 42.1, unit: 'ms', status: 'LOCKED' },
      rr: { id: 'rr', label: 'Respiratory Rate', shortCode: 'RR', value: 15.0, lockedValue: 15.0, unit: 'breaths/min', status: 'LOCKED' },
    },
    sensors: [],
    bfit: {
      status: 'ALLOW',
      confidence: 0.95,
      sensorContact: true,
      motionStability: 0.98,
      interferenceCount: 0,
      message: 'Optimal signal',
    },
    contextVariables: {
      activityIntensity: 0.05,
      ambientTemperature: 24.5,
      relativeHumidity: 45.0,
      atmosphericPressure: 1013.25,
      altitude: 120.0,
    },
    sampleStats: {
      totalPackets: 1500,
      validSamples: 1480,
      rejectedSamples: 20,
      durationSeconds: 65,
    },
    lockedVitals: {
      sessionId: 'test_session_123',
      lockTimestamp: Date.now(),
      heartRate: 72,
      spo2: 98,
      ppi: 833,
      rmssd: 35.4,
      sdnn: 42.1,
      respiratoryRate: 15,
      activityIntensity: 0.05,
      ambientTemperature: 24.5,
      relativeHumidity: 45,
      atmosphericPressure: 1013.25,
      altitude: 120,
      validSampleCounts: {},
      acceptedSampleCounts: {},
      lockedCount: 11,
      lockComplete: true,
    },
  };

  const validationRes = validateShbVitalsLock(mockValidState, 'OVERALL');
  const test4Passed = validationRes.isValid && validationRes.missingVitals.length === 0;
  results.push({
    name: 'Validation of Valid Locked Vitals',
    passed: test4Passed,
    details: `isValid: ${validationRes.isValid}, missing: [${validationRes.missingVitals.join(', ')}]`,
  });

  // Test 5: Validation of incomplete lock (e.g. SpO2 missing / null)
  const mockIncompleteState: LiveVitalsState = {
    ...mockValidState,
    directVitals: {
      ...mockValidState.directVitals,
      spo2: { ...mockValidState.directVitals.spo2, lockedValue: null, status: 'WAITING' },
    },
  };

  const incompleteRes = validateShbVitalsLock(mockIncompleteState, 'OVERALL');
  const test5Passed = !incompleteRes.isValid && incompleteRes.missingVitals.includes('SpO2');
  results.push({
    name: 'Rejection of Incomplete Direct Vitals Lock',
    passed: test5Passed,
    details: `isValid: ${incompleteRes.isValid}, missing: [${incompleteRes.missingVitals.join(', ')}]`,
  });

  return results;
}
