import { ParsedSensorData } from './packetParser';
import { BFitEvaluation } from './bfitEngine';

export interface VitalSampleBuffers {
  hr: number[];
  spo2: number[];
  ppi: number[];
  activity: number[];
  temp: number[];
  humidity: number[];
  pressure: number[];
  altitude: number[];
  ir: number[];
  red: number[];
  rrEstimates: number[];
  // Compatibility aliases
  accel: number[];
}

export interface SampleBufferState {
  buffers: VitalSampleBuffers;
  totalPackets: number;
  validSamples: number;
  rejectedSamples: number;
}

export function createEmptySampleBuffer(): SampleBufferState {
  return {
    buffers: {
      hr: [],
      spo2: [],
      ppi: [],
      activity: [],
      temp: [],
      humidity: [],
      pressure: [],
      altitude: [],
      ir: [],
      red: [],
      rrEstimates: [],
      accel: [],
    },
    totalPackets: 0,
    validSamples: 0,
    rejectedSamples: 0,
  };
}

/**
 * Ingests a parsed packet into the sample buffer.
 * If B-FIT is BAD or the sample is invalid, rejects it from the accumulation buffer.
 */
export function addSampleToBuffer(
  prevState: SampleBufferState,
  data: ParsedSensorData,
  bfit: BFitEvaluation
): SampleBufferState {
  const nextState: SampleBufferState = {
    buffers: {
      hr: [...prevState.buffers.hr],
      spo2: [...prevState.buffers.spo2],
      ppi: [...prevState.buffers.ppi],
      activity: [...prevState.buffers.activity],
      temp: [...prevState.buffers.temp],
      humidity: [...prevState.buffers.humidity],
      pressure: [...prevState.buffers.pressure],
      altitude: [...prevState.buffers.altitude],
      ir: [...prevState.buffers.ir],
      red: [...prevState.buffers.red],
      rrEstimates: [...prevState.buffers.rrEstimates],
      accel: [...prevState.buffers.accel],
    },
    totalPackets: prevState.totalPackets + 1,
    validSamples: prevState.validSamples,
    rejectedSamples: prevState.rejectedSamples,
  };

  // If B-FIT is BAD or packet is invalid, mark as rejected and DO NOT accumulate
  if (bfit.quality === 'BAD' || !data.isValid) {
    nextState.rejectedSamples += 1;
    return nextState;
  }

  let sampleAccepted = false;

  // 1. Direct Vital: Heart Rate
  if (data.heartRate !== null && data.heartRate >= 40 && data.heartRate <= 220) {
    nextState.buffers.hr.push(data.heartRate);
    sampleAccepted = true;
  }

  // 2. Direct Vital: SpO2
  if (data.spO2 !== null && data.spO2 >= 70 && data.spO2 <= 100) {
    nextState.buffers.spo2.push(data.spO2);
    sampleAccepted = true;
  }

  // 3. Direct Vital: PPI
  if (data.ppi !== null && data.ppi >= 250 && data.ppi <= 2000) {
    nextState.buffers.ppi.push(data.ppi);
    sampleAccepted = true;
  }

  // 4. Context Variable: Activity Intensity / Kinematic Accel
  if (data.motionMagnitude !== null) {
    nextState.buffers.activity.push(data.motionMagnitude);
    nextState.buffers.accel.push(data.motionMagnitude);
    sampleAccepted = true;
  }

  // 5. Context Variable: Ambient Temperature
  const effTemp = data.ambientTemp !== null ? data.ambientTemp : data.skinTemp;
  if (effTemp !== null && effTemp >= -20 && effTemp <= 60) {
    nextState.buffers.temp.push(effTemp);
    sampleAccepted = true;
  }

  // 6. Context Variable: Relative Humidity
  if (data.humidity !== null && data.humidity >= 0 && data.humidity <= 100) {
    nextState.buffers.humidity.push(data.humidity);
    sampleAccepted = true;
  }

  // 7. Context Variable: Atmospheric Pressure
  if (data.pressure !== null) {
    const effPres = data.pressure > 2000 ? parseFloat((data.pressure / 100).toFixed(1)) : data.pressure;
    if (effPres >= 300 && effPres <= 1200) {
      nextState.buffers.pressure.push(effPres);
      sampleAccepted = true;
    }
  }

  // 8. Context Variable: Altitude
  if (data.altitude !== null && data.altitude >= -500 && data.altitude <= 9000) {
    nextState.buffers.altitude.push(data.altitude);
    sampleAccepted = true;
  }

  // Optical Waveform (IR & Red)
  if (typeof data.ir === 'number' && Number.isFinite(data.ir) && data.ir > 0) {
    nextState.buffers.ir.push(data.ir);
    if (nextState.buffers.ir.length > 2000) nextState.buffers.ir.shift();
    sampleAccepted = true;
  }

  if (typeof data.red === 'number' && Number.isFinite(data.red) && data.red > 0) {
    nextState.buffers.red.push(data.red);
    if (nextState.buffers.red.length > 2000) nextState.buffers.red.shift();
    sampleAccepted = true;
  }

  if (sampleAccepted) {
    nextState.validSamples += 1;
  } else {
    nextState.rejectedSamples += 1;
  }

  return nextState;
}
