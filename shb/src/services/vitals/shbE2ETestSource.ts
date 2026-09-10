import { OrganCategoryId, LockedVitalsSnapshot, ShbFinalResultPacket } from '../../types/shb';
import { ShbEngineState } from './shbSessionEngine';

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

function roundTo(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

export function isShbE2ETestEnabled(): boolean {
  // Synthetic locking is an explicit test fixture, never the production default.
  // Vite exposes `import.meta.env` in the browser; the optional access also keeps
  // the helper safe when imported by Node-based unit runners.
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_SHB_E2E_TEST === 'true' || env?.MODE === 'android-qa';
}

export interface ShbE2ELockInputs {
  shake: number;
  event: number;
}

export type ShbE2EDecision = 'LOCK' | 'UNLOCK';

export function getShbE2EDecision(inputs: ShbE2ELockInputs): ShbE2EDecision {
  return inputs.shake === 2 && inputs.event === 2 ? 'UNLOCK' : 'LOCK';
}

export function createShbE2ETestLockedState(
  state: ShbEngineState,
  inputs: ShbE2ELockInputs = { shake: 0, event: 0 }
): ShbEngineState {
  const now = Date.now();
  const targetOrgan: OrganCategoryId = state.targetOrgan || 'OVERALL';

  const heartRate = Math.round(randomBetween(60, 90));
  const spo2 = roundTo(randomBetween(97, 100), 0);
  const ppi = Math.round(randomBetween(600, 850));
  const rmssd = roundTo(randomBetween(35, 70), 1);
  const sdnn = roundTo(randomBetween(45, 90), 1);
  const respiratoryRate = roundTo(randomBetween(12, 20), 1);
  const activityIntensity = roundTo(randomBetween(0, 30), 1);
  const ambientTemperature = roundTo(randomBetween(24, 32), 1);
  const relativeHumidity = roundTo(randomBetween(40, 70), 0);
  const atmosphericPressure = Math.round(randomBetween(99000, 103000));
  const altitude = roundTo(randomBetween(0, 300), 0);

  const lockedDv = {
    hr: heartRate,
    spo2,
    ppi,
  };

  const lockedIv = {
    rmssd,
    sdnn,
    rr: respiratoryRate,
    respiratoryRate,
  };

  const lockedCx = {
    activityIntensity,
    ambientTemperature,
    relativeHumidity,
    atmosphericPressure,
    altitude,
  };

  const finalResult: ShbFinalResultPacket = Object.freeze({
    sessionId: state.sessionId,
    userId: 'default_user',
    deviceId: 'M_BAND_BLE',
    targetScope: targetOrgan,
    mode: 'NORMAL',
    acquisition: {
      startedAt: state.startedAt ?? now - 3000,
      completedAt: now,
      durationSeconds: 3,
      validSampleCount: 11,
      rejectedSampleCount: 0,
    },
    bfit: {
      finalStatus: 'ALLOW' as const,
      interferenceCount: 0,
    },
    directVitals: {
      heartRate,
      spo2,
      ppi,
    },
    indirectVitals: {
      rmssd,
      sdnn,
      respiratoryRate,
      rr: respiratoryRate,
    },
    contextVariables: {
      activityIntensity,
      ambientTemperature,
      relativeHumidity,
      atmosphericPressure,
      altitude,
    },
    lockState: {
      heartRate: 'LOCKED',
      spo2: 'LOCKED',
      ppi: 'LOCKED',
      rmssd: 'LOCKED',
      sdnn: 'LOCKED',
      respiratoryRate: 'LOCKED',
      activityIntensity: 'LOCKED',
      ambientTemperature: 'LOCKED',
      relativeHumidity: 'LOCKED',
      atmosphericPressure: 'LOCKED',
      altitude: 'LOCKED',
    } as const,
    completionStatus: 'COMPLETED',
  });

  const lockedVitals: LockedVitalsSnapshot = Object.freeze({
    sessionId: state.sessionId,
    lockTimestamp: now,
    heartRate,
    spo2,
    ppi,
    rmssd,
    sdnn,
    respiratoryRate,
    activityIntensity,
    ambientTemperature,
    relativeHumidity,
    atmosphericPressure,
    altitude,
    validSampleCounts: Object.freeze({
      heartRate: 1,
      spo2: 1,
      ppi: 1,
      rmssd: 1,
      sdnn: 1,
      respiratoryRate: 1,
      activityIntensity: 1,
      ambientTemperature: 1,
      relativeHumidity: 1,
      atmosphericPressure: 1,
      altitude: 1,
    }),
    acceptedSampleCounts: Object.freeze({
      heartRate: 1,
      spo2: 1,
      ppi: 1,
      rmssd: 1,
      sdnn: 1,
      respiratoryRate: 1,
      activityIntensity: 1,
      ambientTemperature: 1,
      relativeHumidity: 1,
      atmosphericPressure: 1,
      altitude: 1,
    }),
    lockedCount: 11,
    lockComplete: true,
  });

  const nextDvItems = { ...state.liveDv };
  nextDvItems.hr = { ...nextDvItems.hr, liveValue: heartRate, lockedValue: heartRate, status: 'LOCKED', sampleCount: 1 };
  nextDvItems.spo2 = { ...nextDvItems.spo2, liveValue: spo2, lockedValue: spo2, status: 'LOCKED', sampleCount: 1 };
  nextDvItems.ppi = { ...nextDvItems.ppi, liveValue: ppi, lockedValue: ppi, status: 'LOCKED', sampleCount: 1 };

  const nextIvItems = { ...state.liveIv };
  nextIvItems.rmssd = { ...nextIvItems.rmssd, value: rmssd, liveValue: rmssd, lockedValue: rmssd, status: 'LOCKED' };
  nextIvItems.sdnn = { ...nextIvItems.sdnn, value: sdnn, liveValue: sdnn, lockedValue: sdnn, status: 'LOCKED' };
  nextIvItems.rr = { ...nextIvItems.rr, value: respiratoryRate, liveValue: respiratoryRate, lockedValue: respiratoryRate, status: 'LOCKED' };

  const decision = getShbE2EDecision(inputs);

  return {
    ...state,
    // The UNLOCK branch intentionally reuses the existing termination state so
    // production shake interpretation and UI dialogs remain unchanged.
    status: decision === 'LOCK' ? 'LOCKED' : 'TERMINATED_BY_SHAKE',
    elapsedSeconds: 3,
    startedAt: state.startedAt ?? now - 3000,
    completedAt: now,
    bfit: {
      ...state.bfit,
      quality: 'GOOD',
      displayStatus: 'ALLOW',
      sensorContact: true,
      motionStability: 0.95,
      isInterference: false,
      message: 'E2E test lock injected successfully',
      shakeState: inputs.shake,
      shakeEventCount: inputs.event,
    },
    interferenceCount: 0,
    isInsideBadInterval: false,
    shakeState: null,
    lastRawShake: null,
    shakeEventCount: 0,
    liveDv: nextDvItems,
    liveIv: nextIvItems,
    contextVariables: {
      activityIntensity,
      ambientTemperature,
      relativeHumidity,
      atmosphericPressure,
      altitude,
    },
    lockedDv,
    lockedIv,
    lockedCx,
    finalResult,
    lockedVitals,
  };
}
