import { BFitStatusCode, BFitStatusDisplay } from '../../types/shb';
import { ParsedSensorData } from './packetParser';

export type BFitSignalQuality = 'GOOD' | 'MODERATE' | 'BAD' | 'WAITING';

export interface BFitEvaluation {
  quality: BFitSignalQuality;
  displayStatus: BFitStatusCode;
  sensorContact: boolean | null;
  motionStability: number | null;
  isInterference: boolean;
  message: string;
  shakeState?: number | null;
  shakeEventCount?: number;
}

/**
 * Rule-based B-FIT prototype signal gate
 * Evaluates real sensor stream quality without fake ML models
 */
export function evaluateBFitSignal(packet: ParsedSensorData | null, bleConnected: boolean): BFitEvaluation {
  const shakeState = packet && packet.shake !== null && packet.shake !== undefined ? packet.shake : null;

  if (!bleConnected || !packet || !packet.isValid) {
    return {
      quality: 'WAITING',
      displayStatus: 'WAITING',
      sensorContact: null,
      motionStability: null,
      isInterference: false,
      message: bleConnected ? 'Awaiting sensor stream stabilization' : 'Peripheral disconnected',
      shakeState,
    };
  }

  // 1. Evaluate Optical PPG Sensor Contact
  // MAX30102 IR baseline: > 5000 indicates skin contact; 0 or < 1000 indicates detached/air
  let sensorContact: boolean | null = null;
  if (packet.ir !== null) {
    sensorContact = packet.ir > 5000;
  } else if (packet.heartRate !== null && packet.heartRate > 0) {
    sensorContact = true;
  }

  // 2. Evaluate IMU Kinematic Stability
  // Motion magnitude (deviation from 1g earth gravity):
  // < 0.15g: Stable (high quality)
  // 0.15g - 0.45g: Moderate motion
  // > 0.45g: High motion artifact / interference
  let motionStability: number | null = null;
  let isHighMotion = false;
  if (packet.motionMagnitude !== null) {
    const mag = packet.motionMagnitude;
    motionStability = Math.max(0, Math.min(1, parseFloat((1 - mag / 0.8).toFixed(2))));
    if (mag > 0.45) {
      isHighMotion = true;
    }
  }

  // 3. Evaluate Direct Vital Validity Range
  const isHrValid = packet.heartRate === null || (packet.heartRate >= 40 && packet.heartRate <= 220);
  const isSpo2Valid = packet.spO2 === null || (packet.spO2 >= 75 && packet.spO2 <= 100);

  // 4. Synthesize B-FIT State
  if (sensorContact === false || isHighMotion || !isHrValid || !isSpo2Valid) {
    return {
      quality: 'BAD',
      displayStatus: 'BAD',
      sensorContact,
      motionStability,
      isInterference: true,
      message: isHighMotion
        ? 'Motion artifact detected — stabilizing'
        : sensorContact === false
        ? 'Poor sensor contact — adjust placement'
        : 'Signal out of physiological range',
      shakeState,
    };
  }

  if (motionStability !== null && motionStability < 0.75) {
    return {
      quality: 'MODERATE',
      displayStatus: 'MID',
      sensorContact,
      motionStability,
      isInterference: false,
      message: 'Moderate signal variation — acquisition proceeding',
      shakeState,
    };
  }

  return {
    quality: 'GOOD',
    displayStatus: 'ALLOW',
    sensorContact: sensorContact ?? true,
    motionStability: motionStability ?? 0.95,
    isInterference: false,
    message: 'Signal stability confirmed · Acquisition nominal',
    shakeState,
  };
}
