import { CribVital, CribProbability, CribGuidanceItem, CribAiMessage } from '../types/crib';
import { CmPacket, ConditionResult } from '../types/cmPacket';

/**
 * QA Telemetry Link Test Packets.
 * STRICT NOTE: Only activated when QA tester explicitly toggles "QA Simulated Telemetry Packet" in Settings.
 * Default application state remains strictly empty/waiting for real telemetry data.
 */

export const SAMPLE_QA_UID = 'user-emergency-primary';

/**
 * Real CM_PACKET example containing 6+ physiological parameters
 * including the exact RR 7.1 test case from Section 27.
 */
export const SAMPLE_QA_CM_PACKET: CmPacket = {
  sessionId: 'SHB-SESSION-QA-001',
  uid: SAMPLE_QA_UID,
  timestamp: Date.now(),
  target: 'OVERALL',
  parameters: {
    heartRate: {
      parameter: 'heartRate',
      phbBaseline: 72,
      shbValue: 95,
      deviation: 23,
      direction: 'INCREASED',
      matchedStage: 1,
      compare: 2.1,
      status: 'COMPUTED',
      unit: 'bpm',
    },
    spo2: {
      parameter: 'spo2',
      phbBaseline: 99,
      shbValue: 100,
      deviation: 1,
      direction: 'STABLE',
      matchedStage: 1,
      compare: 0.1,
      status: 'COMPUTED',
      unit: '%',
    },
    ppi: {
      parameter: 'ppi',
      phbBaseline: 833,
      shbValue: 603,
      deviation: -230,
      direction: 'DECREASED',
      matchedStage: 2,
      compare: -2.3,
      status: 'COMPUTED',
      unit: 'ms',
    },
    rmssd: {
      parameter: 'rmssd',
      phbBaseline: 42,
      shbValue: 97,
      deviation: 55,
      direction: 'INCREASED',
      matchedStage: 2,
      compare: 3.1,
      status: 'COMPUTED',
      unit: 'ms',
    },
    sdnn: {
      parameter: 'sdnn',
      phbBaseline: 55,
      shbValue: 113,
      deviation: 58,
      direction: 'INCREASED',
      matchedStage: 2,
      compare: 2.8,
      status: 'COMPUTED',
      unit: 'ms',
    },
    respiratoryRate: {
      parameter: 'respiratoryRate',
      phbBaseline: 15,
      shbValue: 7.1,
      deviation: -7.9,
      direction: 'DECREASED',
      matchedStage: 2,
      compare: -2.9,
      status: 'COMPUTED',
      unit: '/min',
    },
    skinTemperature: {
      parameter: 'skinTemperature',
      phbBaseline: 36.6,
      shbValue: 36.8,
      deviation: 0.2,
      direction: 'STABLE',
      matchedStage: 1,
      compare: 0.3,
      status: 'COMPUTED',
      unit: '°C',
    },
    motionVector: {
      parameter: 'motionVector',
      phbBaseline: 0.01,
      shbValue: 0.03,
      deviation: 0.02,
      direction: 'STABLE',
      matchedStage: 1,
      compare: 0.2,
      status: 'COMPUTED',
      unit: 'g',
    },
    arterialO2Content: {
      parameter: 'arterialO2Content',
      phbBaseline: 19.8,
      shbValue: 19.4,
      deviation: -0.4,
      direction: 'DECREASED',
      matchedStage: 1,
      compare: -0.5,
      status: 'COMPUTED',
      unit: '',
    },
    metabolicActivityIndex: {
      parameter: 'metabolicActivityIndex',
      phbBaseline: 1.0,
      shbValue: 1.2,
      deviation: 0.2,
      direction: 'STABLE',
      matchedStage: 1,
      compare: 0.2,
      status: 'COMPUTED',
      unit: '',
    },
  },
  compareSummary: {
    totalParameters: 10,
    computedParameters: 10,
    flaggedDeviations: 4,
    matchedStage: 2,
    summaryText: 'STAGE 2 DEVIATION DETECTED ACROSS AUTONOMIC & RESPIRATORY MARKERS',
  },
  bfitResult: {
    score: 89,
    status: 'COMPUTED',
    timestamp: Date.now(),
  },
};

export const SAMPLE_QA_CONDITION_RESULT: ConditionResult = {
  label: 'Cardiac Instability Pattern',
  probability: 90,
  severity: 'critical',
  timestamp: Date.now(),
  patterns: [
    { id: 'p1', name: 'Cardiac Instability Pattern', probability: 90, status: 'critical' },
    { id: 'p2', name: 'Hypoxic Stress Pattern', probability: 30, status: 'low' },
    { id: 'p3', name: 'Autonomic Collapse Pattern', probability: 20, status: 'low' },
  ],
  summary: 'High probability autonomic divergence and cardiac variability elevation.',
};

export const SAMPLE_QA_VITALS: CribVital[] = [
  { key: 'hr', label: 'HR', shortLabel: 'HR', value: 95, unit: 'bpm', status: 'warning' },
  { key: 'spo2', label: 'SpO2', shortLabel: 'SpO2', value: 100, unit: '%', status: 'normal' },
  { key: 'ppi', label: 'PPI', shortLabel: 'PPI', value: 603, unit: 'ms', status: 'warning' },
  { key: 'rmssd', label: 'RMSSD', shortLabel: 'RMSSD', value: 97, unit: 'ms', status: 'critical' },
  { key: 'sdnn', label: 'SDNN', shortLabel: 'SDNN', value: 113, unit: 'ms', status: 'warning' },
  { key: 'rr', label: 'RR', shortLabel: 'RR', value: 7.1, unit: '/min', status: 'warning' },
  { key: 'temp', label: 'TEMP', shortLabel: 'TEMP', value: 36.8, unit: '°C', status: 'normal' },
  { key: 'motion', label: 'MOTION', shortLabel: 'MOTION', value: 0.03, unit: 'g', status: 'normal' },
  { key: 'o2', label: 'O2', shortLabel: 'O2', value: 19.4, unit: '', status: 'normal' },
  { key: 'mai', label: 'MAI', shortLabel: 'MAI', value: 1.2, unit: '', status: 'normal' },
  { key: 'bfit', label: 'B-FIT', shortLabel: 'B-FIT', value: 89, unit: '', status: 'normal' },
];

export const SAMPLE_QA_PROBABILITIES: CribProbability[] = [
  { id: 'p1', label: 'Cardiac Instability Pattern', probability: 90, status: 'critical' },
  { id: 'p2', label: 'Hypoxic Stress Pattern', probability: 30, status: 'low' },
  { id: 'p3', label: 'Autonomic Collapse Pattern', probability: 20, status: 'low' },
];

export const SAMPLE_QA_GUIDANCE: CribGuidanceItem[] = [
  { id: 'g1', text: 'SIT DOWN', level: 'critical' },
  { id: 'g2', text: 'TAKE REST', level: 'warning' },
  { id: 'g3', text: 'BREATHE SLOWLY', level: 'info' },
  { id: 'g4', text: 'DO NOT WALK', level: 'critical' },
];

export const SAMPLE_QA_MESSAGES: CribAiMessage[] = [
  {
    id: 'm1',
    role: 'system',
    message: 'SHB -> COMPARE -> CONDITION pipeline link established.',
    timestamp: Date.now() - 60000,
    priority: 'normal',
  },
  {
    id: 'm2',
    role: 'ai',
    message: 'Protocol SDCU engaged. Sit down immediately, rest your back, and breathe slowly.',
    timestamp: Date.now() - 30000,
    priority: 'urgent',
  },
];
