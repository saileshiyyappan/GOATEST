/**
 * GOATEST CANONICAL PHYSIOLOGICAL PARAMETER REGISTRY
 * Authoritative Single Source of Truth for all 11 Parameters across SHB, Compare, and Telemetry.
 *
 * Categorization:
 * - DV (Direct Vitals): Exactly 3
 * - IV (Indirect Vitals): Exactly 3
 * - CX (Context Variables): Exactly 5
 * Total: Exactly 11 Parameters
 */

export type PhysiologicalCategory = 'DV' | 'IV' | 'CX';

export type CanonicalParameterKey =
  // Direct Vitals (DV) - 3
  | 'heartRate'
  | 'spo2'
  | 'ppi'
  // Indirect Vitals (IV) - 3
  | 'rmssd'
  | 'sdnn'
  | 'respiratoryRate'
  // Context Variables (CX) - 5
  | 'activityIntensity'
  | 'ambientTemperature'
  | 'relativeHumidity'
  | 'atmosphericPressure'
  | 'altitude';

export interface CanonicalParameterDefinition {
  secNo: number; // 1 to 11 deterministic order
  key: CanonicalParameterKey;
  code: string;
  name: string;
  category: PhysiologicalCategory;
  unit: string;
  description: string;
  normalRange: string;
  decimals: number;
  aliases: string[];
}

export const CANONICAL_PARAMETER_DEFINITIONS: Record<CanonicalParameterKey, CanonicalParameterDefinition> = {
  // --- DIRECT VITALS (DV) ---
  heartRate: {
    secNo: 1,
    key: 'heartRate',
    code: 'HR',
    name: 'Heart Rate',
    category: 'DV',
    unit: 'bpm',
    description: 'Direct optical / electrical cardiac pulsatile rate',
    normalRange: '60 - 100',
    decimals: 0,
    aliases: ['hr', 'heart_rate', 'pulse', 'pulseRate', 'pulse_rate', 'heartrate'],
  },
  spo2: {
    secNo: 2,
    key: 'spo2',
    code: 'SpO2',
    name: 'Oxygen Saturation',
    category: 'DV',
    unit: '%',
    description: 'Dual-wavelength optical photoplethysmography fractional oxyhemoglobin',
    normalRange: '95 - 100',
    decimals: 0,
    aliases: ['spO2', 'o2_sat', 'sat', 'oxygenSaturation', 'oxygen_saturation', 'sats'],
  },
  ppi: {
    secNo: 3,
    key: 'ppi',
    code: 'PPI',
    name: 'Pulse Interval',
    category: 'DV',
    unit: 'ms',
    description: 'Peak-to-peak inter-beat interval time series',
    normalRange: '600 - 1000',
    decimals: 0,
    aliases: ['ibi', 'rr_interval', 'interBeatInterval', 'pulse_interval', 'pulseInterval', 'nn_interval'],
  },

  // --- INDIRECT VITALS (IV) ---
  rmssd: {
    secNo: 4,
    key: 'rmssd',
    code: 'RMSSD',
    name: 'Heart Rate Variability',
    category: 'IV',
    unit: 'ms',
    description: 'Root mean square of successive difference in pulse intervals',
    normalRange: '20 - 90',
    decimals: 1,
    aliases: ['hrv_rmssd', 'rmssd_ms', 'hrv', 'rootMeanSquareOfSuccessiveDifferences'],
  },
  sdnn: {
    secNo: 5,
    key: 'sdnn',
    code: 'SDNN',
    name: 'NN Interval Std Dev',
    category: 'IV',
    unit: 'ms',
    description: 'Standard deviation of normal-to-normal pulse intervals',
    normalRange: '30 - 100',
    decimals: 1,
    aliases: ['sdnn_ms', 'standardDeviationOfNN', 'sdnnInterval'],
  },
  respiratoryRate: {
    secNo: 6,
    key: 'respiratoryRate',
    code: 'RR',
    name: 'Respiratory Rate',
    category: 'IV',
    unit: 'breaths/min',
    description: 'Derived respiratory rate from cardiac, autonomic, and contextual integration',
    normalRange: '12 - 20',
    decimals: 1,
    aliases: ['rr', 'resp_rate', 'respiration', 'respirationRate', 'breathingRate', 'breathsPerMinute'],
  },

  // --- CONTEXT VARIABLES (CX) ---
  activityIntensity: {
    secNo: 7,
    key: 'activityIntensity',
    code: 'ACT',
    name: 'Activity Intensity',
    category: 'CX',
    unit: 'a.u.',
    description: '6-DoF inertial kinematic motion vector magnitude',
    normalRange: '< 20',
    decimals: 1,
    aliases: ['motionVector', 'accel', 'motion', 'motionMagnitude', 'motion_magnitude', 'activity', 'activity_intensity'],
  },
  ambientTemperature: {
    secNo: 8,
    key: 'ambientTemperature',
    code: 'TEMP',
    name: 'Ambient Temperature',
    category: 'CX',
    unit: '°C',
    description: 'Environmental thermal sensor measurement',
    normalRange: '18.0 - 28.0',
    decimals: 1,
    aliases: ['skinTemp', 'skinTemperature', 'temp', 'temperature', 'ambient_temp', 'env_temp'],
  },
  relativeHumidity: {
    secNo: 9,
    key: 'relativeHumidity',
    code: 'HUM',
    name: 'Relative Humidity',
    category: 'CX',
    unit: '%',
    description: 'Ambient hygrometric relative humidity percentage',
    normalRange: '30 - 60',
    decimals: 0,
    aliases: ['humidity', 'hum', 'relative_humidity', 'rel_hum'],
  },
  atmosphericPressure: {
    secNo: 10,
    key: 'atmosphericPressure',
    code: 'PRES',
    name: 'Atmospheric Pressure',
    category: 'CX',
    unit: 'hPa',
    description: 'Barometric atmospheric pressure',
    normalRange: '980 - 1030',
    decimals: 1,
    aliases: ['pressure', 'pres', 'barometricPressure', 'baro_pressure', 'atm_pressure'],
  },
  altitude: {
    secNo: 11,
    key: 'altitude',
    code: 'ALT',
    name: 'Altitude',
    category: 'CX',
    unit: 'm',
    description: 'Barometric hypsometric altitude relative to standard sea level',
    normalRange: '0 - 2000',
    decimals: 0,
    aliases: ['alt', 'elevation', 'baro_altitude'],
  },
};

/**
 * Deterministic ordered array of all 11 canonical parameters (Sec. No. 1 to 11)
 */
export const CANONICAL_PARAMETER_LIST: CanonicalParameterDefinition[] = [
  CANONICAL_PARAMETER_DEFINITIONS.heartRate,
  CANONICAL_PARAMETER_DEFINITIONS.spo2,
  CANONICAL_PARAMETER_DEFINITIONS.ppi,
  CANONICAL_PARAMETER_DEFINITIONS.rmssd,
  CANONICAL_PARAMETER_DEFINITIONS.sdnn,
  CANONICAL_PARAMETER_DEFINITIONS.respiratoryRate,
  CANONICAL_PARAMETER_DEFINITIONS.activityIntensity,
  CANONICAL_PARAMETER_DEFINITIONS.ambientTemperature,
  CANONICAL_PARAMETER_DEFINITIONS.relativeHumidity,
  CANONICAL_PARAMETER_DEFINITIONS.atmosphericPressure,
  CANONICAL_PARAMETER_DEFINITIONS.altitude,
];

export const CANONICAL_DV_KEYS: CanonicalParameterKey[] = ['heartRate', 'spo2', 'ppi'];
export const CANONICAL_IV_KEYS: CanonicalParameterKey[] = ['rmssd', 'sdnn', 'respiratoryRate'];
export const CANONICAL_CX_KEYS: CanonicalParameterKey[] = [
  'activityIntensity',
  'ambientTemperature',
  'relativeHumidity',
  'atmosphericPressure',
  'altitude',
];

/**
 * Resolves any raw field name or alias to canonical parameter key.
 * Returns null if the key is obsolete (e.g. CaO2, MAI) or unrecognized.
 */
export function resolveToCanonicalKey(rawKey: string): CanonicalParameterKey | null {
  if (!rawKey) return null;
  const clean = rawKey.trim();

  // Explicit check against removed obsolete parameters
  const lower = clean.toLowerCase();
  if (lower === 'cao2' || lower === 'arterialo2content' || lower === 'mai' || lower === 'metabolicactivityindex') {
    return null;
  }

  // Exact canonical match
  if (clean in CANONICAL_PARAMETER_DEFINITIONS) {
    return clean as CanonicalParameterKey;
  }

  // Alias lookup
  for (const def of CANONICAL_PARAMETER_LIST) {
    if (def.key.toLowerCase() === lower || def.code.toLowerCase() === lower) {
      return def.key;
    }
    for (const alias of def.aliases) {
      if (alias.toLowerCase() === lower) {
        return def.key;
      }
    }
  }

  return null;
}

export {
  AUTHORITATIVE_ORGAN_REGISTRY,
  getOrganDefinition,
  getOrganParameters,
  getOrganParameterKeys,
  filterCompareRows,
} from '../services/organ/organRegistry';
export type { OrganDefinition } from '../services/organ/organRegistry';

