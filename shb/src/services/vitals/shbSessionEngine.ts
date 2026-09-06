import {
  OrganCategoryId,
  AcquisitionEngineStatus,
  ShbFinalResultPacket,
  DirectVitalItem,
  IndirectVitalItem,
  BFitStatusCode,
  LockedVitalsSnapshot,
} from '../../types/shb';
import { ParsedSensorData } from './packetParser';
import { evaluateBFitSignal, BFitEvaluation } from './bfitEngine';
import {
  SampleBufferState,
  createEmptySampleBuffer,
  addSampleToBuffer,
} from './sampleBuffer';
import { computeRobustVitalLock, RobustAverageResult } from './robustAverager';
import { calculateRmssd, calculateSdnn } from './ivProcessor';
import { calculateRespiratoryRate, RrEstimateResult } from './respiratoryEstimator';

export interface ShbEngineConfig {
  targetDurationSeconds: number; // 65-70s for Normal SHB
  maxInterferenceEvents: number; // 2 for Normal SHB
  minValidSamplesForLock: number;
}

export const DEFAULT_SHB_CONFIG: ShbEngineConfig = {
  targetDurationSeconds: 65,
  maxInterferenceEvents: 2,
  minValidSamplesForLock: 8,
};

export interface ShbEngineState {
  sessionId: string;
  targetOrgan: OrganCategoryId;
  status: AcquisitionEngineStatus;
  elapsedSeconds: number;
  config: ShbEngineConfig;
  bfit: BFitEvaluation;
  interferenceCount: number;
  isInsideBadInterval: boolean;
  sampleBuffer: SampleBufferState;

  // Shake Interruption Pipeline State
  shakeState: number | null;
  lastRawShake: number | null;
  shakeEventCount: number;
  
  // Real-time live values (from latest valid packet)
  liveDv: Record<string, DirectVitalItem>;
  liveIv: Record<string, IndirectVitalItem>;

  // Context Variables
  contextVariables: {
    activityIntensity: number | null;
    ambientTemperature: number | null;
    relativeHumidity: number | null;
    atmosphericPressure: number | null;
    altitude: number | null;
  };

  // Locked values (from robust averaging)
  lockedDv: Record<string, number | null>;
  lockedIv: Record<string, number | null>;
  lockedCx: Record<string, number | null>;

  finalResult: ShbFinalResultPacket | null;
  lockedVitals: LockedVitalsSnapshot | null;
  startedAt: number | null;
  completedAt: number | null;
}

export function createInitialEngineState(
  targetOrgan: OrganCategoryId = 'OVERALL',
  config: ShbEngineConfig = DEFAULT_SHB_CONFIG
): ShbEngineState {
  const sessionId = 'shb_' + Date.now().toString(36);

  return {
    sessionId,
    targetOrgan,
    status: 'IDLE',
    elapsedSeconds: 0,
    config,
    bfit: {
      quality: 'WAITING',
      displayStatus: 'WAITING',
      sensorContact: null,
      motionStability: null,
      isInterference: false,
      message: 'Awaiting sensor stream initialization',
      shakeState: null,
      shakeEventCount: 0,
    },
    interferenceCount: 0,
    isInsideBadInterval: false,
    shakeState: null,
    lastRawShake: null,
    shakeEventCount: 0,
    sampleBuffer: createEmptySampleBuffer(),
    liveDv: {
      hr: { id: 'hr', label: 'Heart Rate', shortCode: 'HR', unit: 'bpm', liveValue: null, lockedValue: null, sampleCount: 0, status: 'WAITING', normalRange: '60 - 100' },
      spo2: { id: 'spo2', label: 'Oxygen Saturation', shortCode: 'SpO2', unit: '%', liveValue: null, lockedValue: null, sampleCount: 0, status: 'WAITING', normalRange: '95 - 100' },
      ppi: { id: 'ppi', label: 'Pulse Interval', shortCode: 'PPI', unit: 'ms', liveValue: null, lockedValue: null, sampleCount: 0, status: 'WAITING', normalRange: '600 - 1000' },
    },
    liveIv: {
      rmssd: { id: 'rmssd', label: 'Heart Rate Variability', shortCode: 'RMSSD', unit: 'ms', liveValue: null, value: null, lockedValue: null, status: 'WAITING', formulaNote: 'Root Mean Square of Successive PPI Differences' },
      sdnn: { id: 'sdnn', label: 'NN Interval Std Dev', shortCode: 'SDNN', unit: 'ms', liveValue: null, value: null, lockedValue: null, status: 'WAITING', formulaNote: 'Standard Deviation of Normal-to-Normal PPI Sequence' },
      rr: { id: 'rr', label: 'Respiratory Rate', shortCode: 'RR', unit: 'breaths/min', liveValue: null, value: null, lockedValue: null, status: 'WAITING', formulaNote: 'Authoritative Multi-Stage Physiological & Context Estimator' },
    },
    contextVariables: {
      activityIntensity: null,
      ambientTemperature: null,
      relativeHumidity: null,
      atmosphericPressure: null,
      altitude: null,
    },
    lockedDv: { hr: null, spo2: null, ppi: null },
    lockedIv: { rmssd: null, sdnn: null, rr: null, respiratoryRate: null },
    lockedCx: { activityIntensity: null, ambientTemperature: null, relativeHumidity: null, atmosphericPressure: null, altitude: null },
    finalResult: null,
    lockedVitals: null,
    startedAt: null,
    completedAt: null,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finalizeLockedVitals(state: ShbEngineState): ShbEngineState {
  const buffers = state.sampleBuffer.buffers;
  const minSamples = state.config.minValidSamplesForLock;

  const hrResult = computeRobustVitalLock(buffers.hr, { isInteger: true, minSamples, maxCv: 0.18, minAbsoluteCutoff: 3.0 });
  const spo2Result = computeRobustVitalLock(buffers.spo2, { isInteger: true, minSamples, maxCv: 0.06, minAbsoluteCutoff: 2.0 });
  const ppiResult = computeRobustVitalLock(buffers.ppi, { isInteger: true, minSamples, maxCv: 0.20, minAbsoluteCutoff: 25.0 });

  const actResult = computeRobustVitalLock(buffers.activity, { isInteger: false, minSamples: 2, maxCv: 0.50, decimals: 1, minAbsoluteCutoff: 0.1 });
  const tempResult = computeRobustVitalLock(buffers.temp, { isInteger: false, minSamples: 2, maxCv: 0.10, decimals: 1, minAbsoluteCutoff: 0.5 });
  const humResult = computeRobustVitalLock(buffers.humidity, { isInteger: true, minSamples: 1, maxCv: 0.20, decimals: 0, minAbsoluteCutoff: 2.0 });
  const presResult = computeRobustVitalLock(buffers.pressure, { isInteger: false, minSamples: 1, maxCv: 0.05, decimals: 1, minAbsoluteCutoff: 1.0 });
  const altResult = computeRobustVitalLock(buffers.altitude, { isInteger: true, minSamples: 1, maxCv: 0.15, decimals: 0, minAbsoluteCutoff: 5.0 });

  const lockedDv = {
    hr: hrResult.lockedValue,
    spo2: spo2Result.lockedValue,
    ppi: ppiResult.lockedValue,
  };

  const lockedCx = {
    activityIntensity: actResult.lockedValue,
    ambientTemperature: tempResult.lockedValue,
    relativeHumidity: humResult.lockedValue,
    atmosphericPressure: presResult.lockedValue,
    altitude: altResult.lockedValue,
  };

  const rmssdVal = calculateRmssd(buffers.ppi);
  const sdnnVal = calculateSdnn(buffers.ppi);
  const rrEstimate = calculateRespiratoryRate({
    heartRate: lockedDv.hr,
    spo2: lockedDv.spo2,
    rmssd: rmssdVal,
    sdnn: sdnnVal,
    activityIntensity: lockedCx.activityIntensity,
    ambientTemperature: lockedCx.ambientTemperature,
    relativeHumidity: lockedCx.relativeHumidity,
    atmosphericPressure: lockedCx.atmosphericPressure,
    altitude: lockedCx.altitude,
  });

  const finalRr = rrEstimate.isValid ? rrEstimate.respiratoryRate : null;
  const lockedIv = {
    rmssd: rmssdVal,
    sdnn: sdnnVal,
    rr: finalRr,
    respiratoryRate: finalRr,
  };

  const values = {
    heartRate: lockedDv.hr,
    spo2: lockedDv.spo2,
    ppi: lockedDv.ppi,
    rmssd: lockedIv.rmssd,
    sdnn: lockedIv.sdnn,
    respiratoryRate: lockedIv.respiratoryRate ?? lockedIv.rr,
    activityIntensity: lockedCx.activityIntensity,
    ambientTemperature: lockedCx.ambientTemperature,
    relativeHumidity: lockedCx.relativeHumidity,
    atmosphericPressure: lockedCx.atmosphericPressure,
    altitude: lockedCx.altitude,
  };

  const allValid = Object.values(values).every((value) => typeof value === 'number' && Number.isFinite(value));
  if (!allValid) {
    return {
      ...state,
      status: 'ABORTED',
      lockedDv: { hr: null, spo2: null, ppi: null },
      lockedIv: { rmssd: null, sdnn: null, rr: null, respiratoryRate: null },
      lockedCx: { activityIntensity: null, ambientTemperature: null, relativeHumidity: null, atmosphericPressure: null, altitude: null },
      lockedVitals: null,
      finalResult: null,
    };
  }

  const nextDvItems = { ...state.liveDv };
  nextDvItems.hr = { ...nextDvItems.hr, liveValue: lockedDv.hr, lockedValue: lockedDv.hr, status: 'LOCKED', sampleCount: buffers.hr.length };
  nextDvItems.spo2 = { ...nextDvItems.spo2, liveValue: lockedDv.spo2, lockedValue: lockedDv.spo2, status: 'LOCKED', sampleCount: buffers.spo2.length };
  nextDvItems.ppi = { ...nextDvItems.ppi, liveValue: lockedDv.ppi, lockedValue: lockedDv.ppi, status: 'LOCKED', sampleCount: buffers.ppi.length };

  const nextIvItems = { ...state.liveIv };
  nextIvItems.rmssd = { ...nextIvItems.rmssd, value: lockedIv.rmssd, liveValue: lockedIv.rmssd, lockedValue: lockedIv.rmssd, status: 'LOCKED' };
  nextIvItems.sdnn = { ...nextIvItems.sdnn, value: lockedIv.sdnn, liveValue: lockedIv.sdnn, lockedValue: lockedIv.sdnn, status: 'LOCKED' };
  nextIvItems.rr = { ...nextIvItems.rr, value: lockedIv.rr, liveValue: lockedIv.rr, lockedValue: lockedIv.rr, status: 'LOCKED' };

  const completedAt = Date.now();
  const lockedVitals: LockedVitalsSnapshot = Object.freeze({
    sessionId: state.sessionId,
    lockTimestamp: completedAt,
    ...values,
    validSampleCounts: Object.freeze({
      heartRate: buffers.hr.length,
      spo2: buffers.spo2.length,
      ppi: buffers.ppi.length,
      rmssd: buffers.ppi.length,
      sdnn: buffers.ppi.length,
      respiratoryRate: buffers.rrEstimates.length,
      activityIntensity: buffers.activity.length,
      ambientTemperature: buffers.temp.length,
      relativeHumidity: buffers.humidity.length,
      atmosphericPressure: buffers.pressure.length,
      altitude: buffers.altitude.length,
    }),
    acceptedSampleCounts: Object.freeze({
      heartRate: hrResult.validCount,
      spo2: spo2Result.validCount,
      ppi: ppiResult.validCount,
      rmssd: ppiResult.validCount,
      sdnn: ppiResult.validCount,
      respiratoryRate: rrEstimate.isValid && finalRr !== null ? buffers.rrEstimates.length : 0,
      activityIntensity: actResult.validCount,
      ambientTemperature: tempResult.validCount,
      relativeHumidity: humResult.validCount,
      atmosphericPressure: presResult.validCount,
      altitude: altResult.validCount,
    }),
    lockedCount: 11,
    lockComplete: true,
  });

  const finalResult: ShbFinalResultPacket = Object.freeze({
    sessionId: state.sessionId,
    userId: 'default_user',
    deviceId: 'M_BAND_BLE',
    targetScope: state.targetOrgan,
    mode: 'NORMAL',
    acquisition: {
      startedAt: state.startedAt || completedAt - state.elapsedSeconds * 1000,
      completedAt,
      durationSeconds: state.elapsedSeconds,
      validSampleCount: state.sampleBuffer.validSamples,
      rejectedSampleCount: state.sampleBuffer.rejectedSamples,
    },
    bfit: {
      finalStatus: state.bfit.displayStatus,
      interferenceCount: state.interferenceCount,
    },
    directVitals: {
      heartRate: lockedDv.hr,
      spo2: lockedDv.spo2,
      ppi: lockedDv.ppi,
    },
    indirectVitals: {
      rmssd: lockedIv.rmssd,
      sdnn: lockedIv.sdnn,
      respiratoryRate: lockedIv.rr,
      rr: lockedIv.rr,
    },
    contextVariables: {
      activityIntensity: lockedCx.activityIntensity,
      ambientTemperature: lockedCx.ambientTemperature,
      relativeHumidity: lockedCx.relativeHumidity,
      atmosphericPressure: lockedCx.atmosphericPressure,
      altitude: lockedCx.altitude,
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
    } as Record<string, 'LOCKED' | 'NOT_LOCKED' | 'WAITING'>,
    completionStatus: 'COMPLETED',
  });

  return {
    ...state,
    status: 'LOCKED',
    completedAt,
    lockedDv,
    lockedIv,
    lockedCx,
    liveDv: nextDvItems,
    liveIv: nextIvItems,
    contextVariables: {
      activityIntensity: lockedCx.activityIntensity,
      ambientTemperature: lockedCx.ambientTemperature,
      relativeHumidity: lockedCx.relativeHumidity,
      atmosphericPressure: lockedCx.atmosphericPressure,
      altitude: lockedCx.altitude,
    },
    lockedVitals,
    finalResult,
  };
}

/**
 * Executes robust averaging at the 65s acquisition endpoint and locks the complete SHB result only when all 11 canonical values validate.
 */
export function lockAllVitals(state: ShbEngineState): ShbEngineState {
  if (state.lockedVitals?.lockComplete) return state;
  return finalizeLockedVitals(state);
}

/**
 * Ingests a new sensor packet into the SHB Session Engine
 */
export function ingestPacketToEngine(
  state: ShbEngineState,
  packet: ParsedSensorData,
  bleConnected: boolean
): ShbEngineState {
  if (
    state.status !== 'ACQUIRING' &&
    state.status !== 'PAUSED' &&
    state.status !== 'PAUSED_BY_SHAKE'
  ) {
    return state;
  }

  // 1. Evaluate B-FIT Signal Gate
  const bfit = evaluateBFitSignal(packet, bleConnected);

  // 2. Shake Interruption State Machine (0->1 is Event 1 -> PAUSE; 1->0 re-arms; 0->1 is Event 2 -> TERMINATE)
  let shakeState = packet.shake !== null && packet.shake !== undefined ? packet.shake : state.shakeState;
  let lastRawShake = state.lastRawShake;
  let shakeEventCount = state.shakeEventCount;
  let nextStatus: AcquisitionEngineStatus = state.status;

  if (packet.shake !== null && packet.shake !== undefined) {
    const rawShake = packet.shake === 1 ? 1 : packet.shake === 0 ? 0 : Math.round(packet.shake);
    shakeState = rawShake;

    // Detect 0 -> 1 transition during active acquisition
    if (state.status === 'ACQUIRING') {
      const isShakeEdge = (lastRawShake === 0 || lastRawShake === null) && rawShake === 1;
      if (isShakeEdge) {
        shakeEventCount += 1;
        if (shakeEventCount === 1) {
          nextStatus = 'PAUSED_BY_SHAKE';
        } else if (shakeEventCount >= 2) {
          nextStatus = 'TERMINATED_BY_SHAKE';
        }
      }
    }
    // Update edge detector memory
    lastRawShake = rawShake;
  }

  const updatedBfit: BFitEvaluation = {
    ...bfit,
    shakeState,
    shakeEventCount,
  };

  // Immediate Termination by Shake Event 2
  if (nextStatus === 'TERMINATED_BY_SHAKE') {
    return {
      ...state,
      status: 'TERMINATED_BY_SHAKE',
      shakeState,
      lastRawShake,
      shakeEventCount,
      bfit: updatedBfit,
      completedAt: Date.now(),
    };
  }

  // Immediate Pause by Shake Event 1
  if (nextStatus === 'PAUSED_BY_SHAKE') {
    return {
      ...state,
      status: 'PAUSED_BY_SHAKE',
      shakeState,
      lastRawShake,
      shakeEventCount,
      bfit: updatedBfit,
    };
  }

  // If currently paused (by shake or manual), update shake telemetry but do not accumulate vital samples
  if (state.status === 'PAUSED' || state.status === 'PAUSED_BY_SHAKE') {
    return {
      ...state,
      shakeState,
      lastRawShake,
      shakeEventCount,
      bfit: updatedBfit,
    };
  }

  // 3. Handle Interference State Machine (0/2, 1/2, 2/2)
  let interferenceCount = state.interferenceCount;
  let isInsideBadInterval = state.isInsideBadInterval;

  if (bfit.quality === 'BAD') {
    if (!isInsideBadInterval) {
      interferenceCount += 1;
      isInsideBadInterval = true;

      if (interferenceCount >= state.config.maxInterferenceEvents) {
        return {
          ...state,
          status: 'TERMINATED_INTERFERENCE',
          bfit: updatedBfit,
          shakeState,
          lastRawShake,
          shakeEventCount,
          interferenceCount,
          isInsideBadInterval: true,
          completedAt: Date.now(),
        };
      }
    }
  } else {
    isInsideBadInterval = false;
  }

  // 4. Accumulate Valid Samples into Buffer
  const nextBuffer = addSampleToBuffer(state.sampleBuffer, packet, bfit);

  // 4. Update Live DV Display. Values stay live/acquiring during the 65s capture window; final lock happens only at the 65s endpoint.
  const nextDvItems = { ...state.liveDv };

  if (packet.heartRate !== null) {
    nextDvItems.hr = {
      ...nextDvItems.hr,
      liveValue: packet.heartRate,
      status: 'ACQUIRING',
      lockedValue: null,
    };
  }

  if (packet.spO2 !== null) {
    nextDvItems.spo2 = { ...nextDvItems.spo2, liveValue: packet.spO2, status: 'ACQUIRING', lockedValue: null };
  }

  if (packet.ppi !== null) {
    nextDvItems.ppi = { ...nextDvItems.ppi, liveValue: packet.ppi, status: 'ACQUIRING', lockedValue: null };
  }

  // Context Variables
  const nextContext = {
    activityIntensity: packet.motionMagnitude !== null ? packet.motionMagnitude : state.contextVariables.activityIntensity,
    ambientTemperature: packet.ambientTemp !== null ? packet.ambientTemp : packet.skinTemp !== null ? packet.skinTemp : state.contextVariables.ambientTemperature,
    relativeHumidity: packet.humidity !== null ? packet.humidity : state.contextVariables.relativeHumidity,
    atmosphericPressure: packet.pressure !== null ? (packet.pressure > 2000 ? parseFloat((packet.pressure / 100).toFixed(1)) : packet.pressure) : state.contextVariables.atmosphericPressure,
    altitude: packet.altitude !== null ? packet.altitude : state.contextVariables.altitude,
  };

  // 5. Update Live IV Display while acquisition is running. Final locking remains deferred until the 65s endpoint.
  const nextIvItems = { ...state.liveIv };
  const currentPpiBuffer = nextBuffer.buffers.ppi;
  let liveRmssd: number | null = null;
  let liveSdnn: number | null = null;

  if (currentPpiBuffer.length >= 2) {
    liveRmssd = calculateRmssd(currentPpiBuffer.slice(-10));
    liveSdnn = calculateSdnn(currentPpiBuffer.slice(-10));
    nextIvItems.rmssd = { ...nextIvItems.rmssd, liveValue: liveRmssd, value: liveRmssd, status: 'ACQUIRING', lockedValue: null };
    nextIvItems.sdnn = { ...nextIvItems.sdnn, liveValue: liveSdnn, value: liveSdnn, status: 'ACQUIRING', lockedValue: null };
  }

  const curHr = (nextDvItems.hr.liveValue as number) ?? packet.heartRate ?? null;
  const curSpo2 = (nextDvItems.spo2.liveValue as number) ?? packet.spO2 ?? 98;

  if (curHr !== null && curHr >= 30) {
    const rrEst = calculateRespiratoryRate({
      heartRate: curHr,
      spo2: curSpo2,
      rmssd: liveRmssd,
      sdnn: liveSdnn,
      activityIntensity: nextContext.activityIntensity,
      ambientTemperature: nextContext.ambientTemperature,
      relativeHumidity: nextContext.relativeHumidity,
      atmosphericPressure: nextContext.atmosphericPressure,
      altitude: nextContext.altitude,
    });

    if (rrEst.isValid && rrEst.respiratoryRate !== null) {
      nextBuffer.buffers.rrEstimates.push(rrEst.respiratoryRate);
      if (nextBuffer.buffers.rrEstimates.length > 50) {
        nextBuffer.buffers.rrEstimates.shift();
      }

      nextIvItems.rr = {
        ...(nextIvItems.rr || {
          id: 'rr',
          label: 'Respiratory Rate',
          shortCode: 'RR',
          unit: 'breaths/min',
          liveValue: null,
          value: null,
          lockedValue: null,
          status: 'WAITING',
          formulaNote: 'Authoritative Multi-Stage Physiological & Context Estimator',
        }),
        liveValue: rrEst.respiratoryRate,
        value: rrEst.respiratoryRate,
        lockedValue: null,
        status: rrEst.status || 'ESTIMATING',
      };
    }
  }

  return {
    ...state,
    status: state.status,
    bfit,
    interferenceCount,
    isInsideBadInterval,
    sampleBuffer: nextBuffer,
    liveDv: nextDvItems,
    liveIv: nextIvItems,
    contextVariables: nextContext,
  };
}
