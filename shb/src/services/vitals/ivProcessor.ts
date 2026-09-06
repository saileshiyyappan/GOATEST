import { IndirectVitalItem } from '../../types/shb';
import { calculateRespiratoryRate, RrEstimatorInputs } from './respiratoryEstimator';

export interface IvProcessorState {
  items: Record<'rmssd' | 'sdnn' | 'rr' | string, IndirectVitalItem>;
}

export function createInitialIvState(): IvProcessorState {
  return {
    items: {
      rmssd: {
        id: 'rmssd',
        label: 'Heart Rate Variability',
        shortCode: 'RMSSD',
        unit: 'ms',
        value: null,
        lockedValue: null,
        status: 'WAITING',
        formulaNote: 'Root Mean Square of Successive PPI Differences',
      },
      sdnn: {
        id: 'sdnn',
        label: 'NN Interval Std Dev',
        shortCode: 'SDNN',
        unit: 'ms',
        value: null,
        lockedValue: null,
        status: 'WAITING',
        formulaNote: 'Standard Deviation of Normal-to-Normal PPI Sequence',
      },
      rr: {
        id: 'rr',
        label: 'Respiratory Rate',
        shortCode: 'RR',
        unit: 'breaths/min',
        liveValue: null,
        value: null,
        lockedValue: null,
        status: 'WAITING',
        formulaNote: 'Authoritative Multi-Stage Physiological & Context Estimator',
      },
    },
  };
}

/**
 * Calculates RMSSD from a sequence of PPI interval values (in ms)
 * Formula: sqrt( (1 / (N - 1)) * sum( (PPI[i+1] - PPI[i])^2 ) )
 */
export function calculateRmssd(ppiSequence: number[]): number | null {
  if (!ppiSequence || ppiSequence.length < 2) return null;

  // Filter physiological PPI bounds (250ms to 2000ms)
  const valid = ppiSequence.filter((p) => p >= 250 && p <= 2000);
  if (valid.length < 2) return null;

  let sumSquares = 0;
  for (let i = 1; i < valid.length; i++) {
    const diff = valid[i] - valid[i - 1];
    sumSquares += diff * diff;
  }

  const meanSquare = sumSquares / (valid.length - 1);
  const rmssd = Math.sqrt(meanSquare);

  return parseFloat(rmssd.toFixed(1));
}

/**
 * Calculates SDNN from a sequence of PPI interval values (in ms)
 * Formula: sqrt( (1 / N) * sum( (PPI[i] - mean(PPI))^2 ) )
 */
export function calculateSdnn(ppiSequence: number[]): number | null {
  if (!ppiSequence || ppiSequence.length < 2) return null;

  const valid = ppiSequence.filter((p) => p >= 250 && p <= 2000);
  if (valid.length < 2) return null;

  const mean = valid.reduce((acc, v) => acc + v, 0) / valid.length;
  const sumSquares = valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const sdnn = Math.sqrt(sumSquares / valid.length);

  return parseFloat(sdnn.toFixed(1));
}

/**
 * Updates IV processor state with latest direct vitals and context
 */
export function processIvState(
  prevState: IvProcessorState,
  ppiBuffer: number[],
  directVitals: {
    hr?: number | null;
    spo2?: number | null;
    ppi?: number | null;
  },
  contextVariables?: {
    activityIntensity?: number | null;
    ambientTemperature?: number | null;
    relativeHumidity?: number | null;
    atmosphericPressure?: number | null;
    altitude?: number | null;
  }
): IvProcessorState {
  const rmssdVal = calculateRmssd(ppiBuffer);
  const sdnnVal = calculateSdnn(ppiBuffer);

  // Compute authoritative Respiratory Rate using canonical inputs
  const rrInputs: RrEstimatorInputs = {
    heartRate: directVitals.hr,
    spo2: directVitals.spo2,
    rmssd: rmssdVal,
    sdnn: sdnnVal,
    activityIntensity: contextVariables?.activityIntensity,
    ambientTemperature: contextVariables?.ambientTemperature,
    relativeHumidity: contextVariables?.relativeHumidity,
    atmosphericPressure: contextVariables?.atmosphericPressure,
    altitude: contextVariables?.altitude,
  };

  const rrResult = calculateRespiratoryRate(rrInputs);

  return {
    items: {
      rmssd: {
        ...prevState.items.rmssd,
        value: rmssdVal,
        liveValue: rmssdVal,
        lockedValue: ppiBuffer.length >= 8 ? rmssdVal : prevState.items.rmssd?.lockedValue ?? null,
        status: ppiBuffer.length >= 8 && rmssdVal !== null ? 'LOCKED' : rmssdVal !== null ? 'ACQUIRING' : 'WAITING',
      },
      sdnn: {
        ...prevState.items.sdnn,
        value: sdnnVal,
        liveValue: sdnnVal,
        lockedValue: ppiBuffer.length >= 8 ? sdnnVal : prevState.items.sdnn?.lockedValue ?? null,
        status: ppiBuffer.length >= 8 && sdnnVal !== null ? 'LOCKED' : sdnnVal !== null ? 'ACQUIRING' : 'WAITING',
      },
      rr: {
        ...prevState.items.rr,
        value: rrResult.respiratoryRate,
        liveValue: rrResult.respiratoryRate,
        lockedValue: ppiBuffer.length >= 8 && rrResult.isValid ? rrResult.respiratoryRate : prevState.items.rr?.lockedValue ?? null,
        status: ppiBuffer.length >= 8 && rrResult.isValid ? 'LOCKED' : rrResult.isValid ? 'ACQUIRING' : 'WAITING',
      },
    },
  };
}
