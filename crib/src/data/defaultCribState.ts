import {
  CribVital,
  CribProbability,
  CribGuidanceItem,
  CribMediaState,
  CribSettingsState,
} from '../types/crib';

/**
 * Standard typed CRIB Vitals model.
 * Per specification: In production/standby, initial values must be null/empty
 * and rendered as '--' or 'NOT AVAILABLE'.
 */
export const DEFAULT_CRIB_VITALS_SCHEMA: CribVital[] = [
  { key: 'hr', label: 'HR', shortLabel: 'HR', value: null, unit: 'bpm', status: 'unknown' },
  { key: 'spo2', label: 'SpO2', shortLabel: 'SpO2', value: null, unit: '%', status: 'unknown' },
  { key: 'ppi', label: 'PPI', shortLabel: 'PPI', value: null, unit: 'ms', status: 'unknown' },
  { key: 'rmssd', label: 'RMSSD', shortLabel: 'RMSSD', value: null, unit: 'ms', status: 'unknown' },
  { key: 'sdnn', label: 'SDNN', shortLabel: 'SDNN', value: null, unit: 'ms', status: 'unknown' },
  { key: 'rr', label: 'RR', shortLabel: 'RR', value: null, unit: '/min', status: 'unknown' },
  { key: 'temp', label: 'TEMP', shortLabel: 'TEMP', value: null, unit: '°C', status: 'unknown' },
  { key: 'motion', label: 'MOTION', shortLabel: 'MOTION', value: null, unit: 'g', status: 'unknown' },
  { key: 'o2', label: 'O2', shortLabel: 'O2', value: null, unit: '', status: 'unknown' },
  { key: 'bfit', label: 'B-FIT', shortLabel: 'B-FIT', value: null, unit: '', status: 'unknown' },
];

/**
 * Initial empty probability state.
 * Real values will be populated once CONDITION subsystem connects.
 */
export const DEFAULT_PROBABILITIES_STATE: CribProbability[] = [];

/**
 * Initial empty guidance state.
 */
export const DEFAULT_GUIDANCE_STATE: CribGuidanceItem[] = [];

/**
 * Initial default media state.
 */
export const DEFAULT_MEDIA_STATE: CribMediaState = {
  type: 'none',
  url: null,
  title: 'NO ACTIVE MEDIA STREAM',
  isPlaying: false,
  isMuted: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  isFullscreen: false,
};

/**
 * Initial default settings state.
 */
export const DEFAULT_SETTINGS_STATE: CribSettingsState = {
  callPermission: false,
  notificationsEnabled: false,
  locationPermission: false,
  audioAlarm: true,
  mediaType: 'none',
  sdcuEnabled: true,
  actionVerificationEnabled: true,
  audioGuidanceEnabled: true,
};
