import { DirectVitalItem, VitalStatus } from '../../types/shb';
import { ParsedSensorData } from './packetParser';

export interface DvSampleBuffer {
  hr: number[];
  spo2: number[];
  ppi: number[];
}

export interface DvProcessorState {
  items: Record<'hr' | 'spo2' | 'ppi' | string, DirectVitalItem>;
  buffers: DvSampleBuffer;
  totalValidPackets: number;
}

const MIN_SAMPLES_FOR_LOCK = 8;
const MAX_BUFFER_SIZE = 120; // Last 120 samples

export function createInitialDvState(): DvProcessorState {
  return {
    items: {
      hr: {
        id: 'hr',
        label: 'Heart Rate',
        shortCode: 'HR',
        unit: 'bpm',
        liveValue: null,
        lockedValue: null,
        sampleCount: 0,
        status: 'WAITING',
        normalRange: '60 - 100',
      },
      spo2: {
        id: 'spo2',
        label: 'Oxygen Saturation',
        shortCode: 'SpO2',
        unit: '%',
        liveValue: null,
        lockedValue: null,
        sampleCount: 0,
        status: 'WAITING',
        normalRange: '95 - 100',
      },
      ppi: {
        id: 'ppi',
        label: 'Pulse Interval',
        shortCode: 'PPI',
        unit: 'ms',
        liveValue: null,
        lockedValue: null,
        sampleCount: 0,
        status: 'WAITING',
        normalRange: '600 - 1000',
      },
    },
    buffers: {
      hr: [],
      spo2: [],
      ppi: [],
    },
    totalValidPackets: 0,
  };
}

/**
 * Calculates mean of an array of numbers
 */
function calculateMean(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return sum / samples.length;
}

/**
 * Checks if sample buffer is stable enough for locking
 */
function isBufferStable(samples: number[], maxVarianceFraction: number = 0.15): boolean {
  if (samples.length < MIN_SAMPLES_FOR_LOCK) return false;
  const mean = calculateMean(samples);
  if (!mean || mean === 0) return false;

  const variance = samples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / samples.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // Coefficient of variation

  return cv <= maxVarianceFraction;
}

/**
 * Ingests a new parsed sensor packet into the DV processing pipeline
 */
export function processDvPacket(
  prevState: DvProcessorState,
  data: ParsedSensorData
): DvProcessorState {
  const nextBuffers: DvSampleBuffer = {
    hr: [...prevState.buffers.hr],
    spo2: [...prevState.buffers.spo2],
    ppi: [...prevState.buffers.ppi],
  };

  const nextItems: Record<string, DirectVitalItem> = { ...prevState.items };
  let isValidPacket = false;

  // 1. Process Heart Rate
  if (data.heartRate !== null && data.heartRate > 0) {
    isValidPacket = true;
    nextBuffers.hr.push(data.heartRate);
    if (nextBuffers.hr.length > MAX_BUFFER_SIZE) nextBuffers.hr.shift();

    const meanHr = calculateMean(nextBuffers.hr);
    const liveHr = meanHr !== null ? Math.round(meanHr) : null;
    const canLock = isBufferStable(nextBuffers.hr, 0.18);
    const lockedHr = canLock ? liveHr : prevState.items.hr?.lockedValue ?? null;

    nextItems.hr = {
      ...prevState.items.hr,
      liveValue: liveHr,
      lockedValue: lockedHr,
      sampleCount: nextBuffers.hr.length,
      status: lockedHr !== null ? 'LOCKED' : 'ACQUIRING',
    };
  }

  // 2. Process SpO2
  if (data.spO2 !== null && data.spO2 > 0) {
    isValidPacket = true;
    nextBuffers.spo2.push(data.spO2);
    if (nextBuffers.spo2.length > MAX_BUFFER_SIZE) nextBuffers.spo2.shift();

    const meanSpo2 = calculateMean(nextBuffers.spo2);
    const liveSpo2 = meanSpo2 !== null ? Math.round(meanSpo2) : null;
    const canLock = isBufferStable(nextBuffers.spo2, 0.06);
    const lockedSpo2 = canLock ? liveSpo2 : prevState.items.spo2?.lockedValue ?? null;

    nextItems.spo2 = {
      ...prevState.items.spo2,
      liveValue: liveSpo2,
      lockedValue: lockedSpo2,
      sampleCount: nextBuffers.spo2.length,
      status: lockedSpo2 !== null ? 'LOCKED' : 'ACQUIRING',
    };
  }

  // 3. Process PPI
  if (data.ppi !== null && data.ppi > 0) {
    isValidPacket = true;
    nextBuffers.ppi.push(data.ppi);
    if (nextBuffers.ppi.length > MAX_BUFFER_SIZE) nextBuffers.ppi.shift();

    const meanPpi = calculateMean(nextBuffers.ppi);
    const livePpi = meanPpi !== null ? Math.round(meanPpi) : null;
    const canLock = isBufferStable(nextBuffers.ppi, 0.20);
    const lockedPpi = canLock ? livePpi : prevState.items.ppi?.lockedValue ?? null;

    nextItems.ppi = {
      ...prevState.items.ppi,
      liveValue: livePpi,
      lockedValue: lockedPpi,
      sampleCount: nextBuffers.ppi.length,
      status: lockedPpi !== null ? 'LOCKED' : 'ACQUIRING',
    };
  }

  return {
    items: nextItems,
    buffers: nextBuffers,
    totalValidPackets: prevState.totalValidPackets + (isValidPacket ? 1 : 0),
  };
}
