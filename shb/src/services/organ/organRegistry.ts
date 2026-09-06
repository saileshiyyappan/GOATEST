/**
 * GOATEST AUTHORITATIVE CENTRAL ORGAN-WISE PHYSIOLOGICAL REGISTRY
 * 
 * Strict Single Source of Truth for Organ-Wise Mappings across:
 * - SHB Test Page
 * - Compare Table View
 * - PHB Normalization & Verification
 * - Downstream Pipelines (Condition, CRIB, Reports)
 * 
 * Exact 11 Organs in Order:
 * 1. OVERALL (11 Parameters: 3 DV, 3 IV, 5 CX)
 * 2. CARDIOVASCULAR (6 Parameters: 3 DV, 3 IV, 0 CX)
 * 3. RESPIRATORY (2 Parameters: 1 DV, 1 IV, 0 CX)
 * 4. BRAIN / NEUROLOGICAL (6 Parameters: 2 DV, 3 IV, 1 CX)
 * 5. MOVEMENT / ACTIVITY (2 Parameters: 1 DV, 0 IV, 1 CX)
 * 6. THERMAL / ENVIRONMENTAL (2 Parameters: 0 DV, 0 IV, 2 CX)
 * 7. ENVIRONMENT / ALTITUDE (4 Parameters: 1 DV, 1 IV, 2 CX)
 * 8. KIDNEYS / RENAL (1 Parameter: 0 DV, 0 IV, 1 CX)
 * 9. LIVER / METABOLIC (1 Parameter: 0 DV, 0 IV, 1 CX)
 * 10. ENDOCRINE / HORMONAL (5 Parameters: 1 DV, 3 IV, 1 CX)
 * 11. BLOOD VESSELS / VASCULAR (5 Parameters: 3 DV, 2 IV, 0 CX)
 * 
 * Strict Ordering Rule: DV → IV → CX for EVERY organ view.
 */

import {
  CanonicalParameterKey,
  CanonicalParameterDefinition,
  CANONICAL_PARAMETER_DEFINITIONS,
} from '../../types/physiologicalRegistry';
import { OrganCategoryId, OrganCategory } from '../../types/shb';
import { CmParameterRow } from '../../types/compare';

export interface OrganDefinition extends OrganCategory {
  id: OrganCategoryId;
  order: number; // 1 to 11
  name: string;
  displayName: string;
  subtitle: string;
  description: string;
  iconName: string;
  dvKeys: CanonicalParameterKey[];
  ivKeys: CanonicalParameterKey[];
  cxKeys: CanonicalParameterKey[];
  parameterKeys: CanonicalParameterKey[]; // Guaranteed in DV -> IV -> CX order
  targetVitals: string[];
  count: number;
}

export const AUTHORITATIVE_ORGAN_REGISTRY: OrganDefinition[] = [
  // 1. OVERALL
  {
    id: 'OVERALL',
    order: 1,
    name: 'OVERALL',
    displayName: 'Overall',
    subtitle: 'Comprehensive Physiological Assessment',
    description: 'Complete 11-parameter baseline across all Direct Vitals, Indirect Vitals, and Context Variables.',
    iconName: 'Sparkles',
    dvKeys: ['heartRate', 'spo2', 'ppi'],
    ivKeys: ['rmssd', 'sdnn', 'respiratoryRate'],
    cxKeys: ['activityIntensity', 'ambientTemperature', 'relativeHumidity', 'atmosphericPressure', 'altitude'],
    parameterKeys: [
      'heartRate',
      'spo2',
      'ppi',
      'rmssd',
      'sdnn',
      'respiratoryRate',
      'activityIntensity',
      'ambientTemperature',
      'relativeHumidity',
      'atmosphericPressure',
      'altitude',
    ],
    targetVitals: [
      'Heart Rate',
      'SpO2',
      'PPI',
      'RMSSD',
      'SDNN',
      'Respiratory Rate',
      'Activity Intensity',
      'Ambient Temperature',
      'Relative Humidity',
      'Atmospheric Pressure',
      'Altitude',
    ],
    count: 11,
  },

  // 2. CARDIOVASCULAR
  {
    id: 'CARDIOVASCULAR',
    order: 2,
    name: 'Cardiovascular',
    displayName: 'Cardiovascular',
    subtitle: 'Heart & Hemodynamic Rhythms',
    description: 'Cardiac pulsatile dynamics, autonomic interval variations, and derived respiratory modulation.',
    iconName: 'Heart',
    dvKeys: ['heartRate', 'spo2', 'ppi'],
    ivKeys: ['rmssd', 'sdnn', 'respiratoryRate'],
    cxKeys: [],
    parameterKeys: ['heartRate', 'spo2', 'ppi', 'rmssd', 'sdnn', 'respiratoryRate'],
    targetVitals: ['Heart Rate', 'SpO2', 'PPI', 'RMSSD', 'SDNN', 'Respiratory Rate'],
    count: 6,
  },

  // 3. RESPIRATORY
  {
    id: 'RESPIRATORY',
    order: 3,
    name: 'Respiratory',
    displayName: 'Respiratory',
    subtitle: 'Lungs & Oxygenation Dynamics',
    description: 'Dual-wavelength oxyhemoglobin saturation and multi-stage physiological respiratory rate.',
    iconName: 'Wind',
    dvKeys: ['spo2'],
    ivKeys: ['respiratoryRate'],
    cxKeys: [],
    parameterKeys: ['spo2', 'respiratoryRate'],
    targetVitals: ['SpO2', 'Respiratory Rate'],
    count: 2,
  },

  // 4. BRAIN / NEUROLOGICAL
  {
    id: 'NEUROLOGICAL',
    order: 4,
    name: 'Brain / Neurological',
    displayName: 'Brain / Neurological',
    subtitle: 'Autonomic & Neural Regulation',
    description: 'Autonomic nervous system modulation via HRV, cardiac pacing, respiratory feedback, and inertial movement.',
    iconName: 'Brain',
    dvKeys: ['heartRate', 'ppi'],
    ivKeys: ['rmssd', 'sdnn', 'respiratoryRate'],
    cxKeys: ['activityIntensity'],
    parameterKeys: ['heartRate', 'ppi', 'rmssd', 'sdnn', 'respiratoryRate', 'activityIntensity'],
    targetVitals: ['Heart Rate', 'PPI', 'RMSSD', 'SDNN', 'Respiratory Rate', 'Activity Intensity'],
    count: 6,
  },

  // 5. MOVEMENT / ACTIVITY
  {
    id: 'MOVEMENT',
    order: 5,
    name: 'Movement / Activity',
    displayName: 'Movement / Activity',
    subtitle: 'Kinematic & Muscular Vector',
    description: 'Cardiovascular response and 6-DoF inertial kinematic activity intensity.',
    iconName: 'Activity',
    dvKeys: ['heartRate'],
    ivKeys: [],
    cxKeys: ['activityIntensity'],
    parameterKeys: ['heartRate', 'activityIntensity'],
    targetVitals: ['Heart Rate', 'Activity Intensity'],
    count: 2,
  },

  // 6. THERMAL / ENVIRONMENTAL
  {
    id: 'THERMAL',
    order: 6,
    name: 'Thermal / Environmental',
    displayName: 'Thermal / Environmental',
    subtitle: 'Thermoregulation & Ambience',
    description: 'Ambient environmental thermal gradients and relative hygrometric humidity.',
    iconName: 'Thermometer',
    dvKeys: [],
    ivKeys: [],
    cxKeys: ['ambientTemperature', 'relativeHumidity'],
    parameterKeys: ['ambientTemperature', 'relativeHumidity'],
    targetVitals: ['Ambient Temperature', 'Relative Humidity'],
    count: 2,
  },

  // 7. ENVIRONMENT / ALTITUDE
  {
    id: 'ENVIRONMENT',
    order: 7,
    name: 'Environment / Altitude',
    displayName: 'Environment / Altitude',
    subtitle: 'Barometric & Hypobaric Dynamics',
    description: 'Barometric atmospheric pressure, hypsometric altitude, arterial saturation, and respiratory rate.',
    iconName: 'Mountain',
    dvKeys: ['spo2'],
    ivKeys: ['respiratoryRate'],
    cxKeys: ['atmosphericPressure', 'altitude'],
    parameterKeys: ['spo2', 'respiratoryRate', 'atmosphericPressure', 'altitude'],
    targetVitals: ['SpO2', 'Respiratory Rate', 'Atmospheric Pressure', 'Altitude'],
    count: 4,
  },

  // 8. KIDNEYS / RENAL
  {
    id: 'RENAL',
    order: 8,
    name: 'Kidneys / Renal',
    displayName: 'Kidneys / Renal',
    subtitle: 'Fluid Balance Context',
    description: 'Environmental hygrometric humidity context for fluid and hydration status.',
    iconName: 'Droplets',
    dvKeys: [],
    ivKeys: [],
    cxKeys: ['relativeHumidity'],
    parameterKeys: ['relativeHumidity'],
    targetVitals: ['Relative Humidity'],
    count: 1,
  },

  // 9. LIVER / METABOLIC
  {
    id: 'METABOLIC',
    order: 9,
    name: 'Liver / Metabolic',
    displayName: 'Liver / Metabolic',
    subtitle: 'Energy Expenditure Context',
    description: 'Inertial kinematic activity intensity contextualizing baseline metabolic demand.',
    iconName: 'Flame',
    dvKeys: [],
    ivKeys: [],
    cxKeys: ['activityIntensity'],
    parameterKeys: ['activityIntensity'],
    targetVitals: ['Activity Intensity'],
    count: 1,
  },

  // 10. ENDOCRINE / HORMONAL
  {
    id: 'ENDOCRINE',
    order: 10,
    name: 'Endocrine / Hormonal',
    displayName: 'Endocrine / Hormonal',
    subtitle: 'Homeostatic Stress Dynamics',
    description: 'Autonomic tone, cardiac rate response, respiratory variability, and kinematic activity.',
    iconName: 'Zap',
    dvKeys: ['heartRate'],
    ivKeys: ['rmssd', 'sdnn', 'respiratoryRate'],
    cxKeys: ['activityIntensity'],
    parameterKeys: ['heartRate', 'rmssd', 'sdnn', 'respiratoryRate', 'activityIntensity'],
    targetVitals: ['Heart Rate', 'RMSSD', 'SDNN', 'Respiratory Rate', 'Activity Intensity'],
    count: 5,
  },

  // 11. BLOOD VESSELS / VASCULAR
  {
    id: 'VASCULAR',
    order: 11,
    name: 'Blood Vessels / Vascular',
    displayName: 'Blood Vessels / Vascular',
    subtitle: 'Peripheral Vascular Tone',
    description: 'Microvascular pulsatile compliance, pulse interval, arterial saturation, and autonomic variance.',
    iconName: 'Waves',
    dvKeys: ['heartRate', 'spo2', 'ppi'],
    ivKeys: ['rmssd', 'sdnn'],
    cxKeys: [],
    parameterKeys: ['heartRate', 'spo2', 'ppi', 'rmssd', 'sdnn'],
    targetVitals: ['Heart Rate', 'SpO2', 'PPI', 'RMSSD', 'SDNN'],
    count: 5,
  },
];

/**
 * Fast lookup map supporting both exact ID, lowercase ID, and common alias strings
 */
const ORGAN_LOOKUP_MAP = new Map<string, OrganDefinition>();

AUTHORITATIVE_ORGAN_REGISTRY.forEach((def) => {
  ORGAN_LOOKUP_MAP.set(def.id, def);
  ORGAN_LOOKUP_MAP.set(def.id.toLowerCase(), def);
  ORGAN_LOOKUP_MAP.set(def.name.toLowerCase(), def);
  ORGAN_LOOKUP_MAP.set(def.displayName.toLowerCase(), def);
});

// Register aliases
ORGAN_LOOKUP_MAP.set('brain_neurological', AUTHORITATIVE_ORGAN_REGISTRY[3]);
ORGAN_LOOKUP_MAP.set('brain', AUTHORITATIVE_ORGAN_REGISTRY[3]);
ORGAN_LOOKUP_MAP.set('movement_activity', AUTHORITATIVE_ORGAN_REGISTRY[4]);
ORGAN_LOOKUP_MAP.set('thermal_environmental', AUTHORITATIVE_ORGAN_REGISTRY[5]);
ORGAN_LOOKUP_MAP.set('environment_altitude', AUTHORITATIVE_ORGAN_REGISTRY[6]);
ORGAN_LOOKUP_MAP.set('kidneys_renal', AUTHORITATIVE_ORGAN_REGISTRY[7]);
ORGAN_LOOKUP_MAP.set('kidneys', AUTHORITATIVE_ORGAN_REGISTRY[7]);
ORGAN_LOOKUP_MAP.set('liver_metabolic', AUTHORITATIVE_ORGAN_REGISTRY[8]);
ORGAN_LOOKUP_MAP.set('liver', AUTHORITATIVE_ORGAN_REGISTRY[8]);
ORGAN_LOOKUP_MAP.set('endocrine_hormonal', AUTHORITATIVE_ORGAN_REGISTRY[9]);
ORGAN_LOOKUP_MAP.set('blood_vessels_vascular', AUTHORITATIVE_ORGAN_REGISTRY[10]);
ORGAN_LOOKUP_MAP.set('blood_vessels', AUTHORITATIVE_ORGAN_REGISTRY[10]);
ORGAN_LOOKUP_MAP.set('vascular', AUTHORITATIVE_ORGAN_REGISTRY[10]);

/**
 * Resolves an organ ID or name to its authoritative OrganDefinition.
 * Falls back to OVERALL if unrecognized.
 */
export function getOrganDefinition(idOrName?: string | null): OrganDefinition {
  if (!idOrName) return AUTHORITATIVE_ORGAN_REGISTRY[0];
  const clean = idOrName.trim().toLowerCase();
  return ORGAN_LOOKUP_MAP.get(clean) || AUTHORITATIVE_ORGAN_REGISTRY[0];
}

/**
 * Returns canonical parameter definitions for the selected organ strictly ordered DV -> IV -> CX.
 */
export function getOrganParameters(idOrName?: string | null): CanonicalParameterDefinition[] {
  const organ = getOrganDefinition(idOrName);
  return organ.parameterKeys.map((key) => CANONICAL_PARAMETER_DEFINITIONS[key]);
}

/**
 * Returns canonical parameter keys for the selected organ strictly ordered DV -> IV -> CX.
 */
export function getOrganParameterKeys(idOrName?: string | null): CanonicalParameterKey[] {
  const organ = getOrganDefinition(idOrName);
  return [...organ.parameterKeys];
}

/**
 * Filters CM_PACKET rows for presentation in Compare Table according to the selected organ.
 * CM_PACKET itself remains complete with 11 parameters; this is purely a view filter.
 * Preserves strict DV -> IV -> CX ordering.
 */
export function filterCompareRows(rows: CmParameterRow[], idOrName?: string | null): CmParameterRow[] {
  const organ = getOrganDefinition(idOrName);
  const targetKeys = new Set(organ.parameterKeys);

  // Filter rows matching target organ
  const filtered = (rows || []).filter((r) => {
    const key = (r.key || r.paramKey) as CanonicalParameterKey;
    return targetKeys.has(key);
  });

  // Sort strictly by organ parameter order (DV -> IV -> CX)
  const keyOrderIndex = new Map<string, number>();
  organ.parameterKeys.forEach((k, idx) => keyOrderIndex.set(k, idx));

  return filtered.sort((a, b) => {
    const keyA = (a.key || a.paramKey) as string;
    const keyB = (b.key || b.paramKey) as string;
    const idxA = keyOrderIndex.get(keyA) ?? 999;
    const idxB = keyOrderIndex.get(keyB) ?? 999;
    return idxA - idxB;
  });
}
