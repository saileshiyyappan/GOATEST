import {
  PhbDocument,
  NormalizedPhbDocument,
  NormalizedPhbFeature,
  NormalizedDeviationStage,
  NormalizedDeviationProfile,
  PhbDeviationConfigItem,
  SynchronizedPhbJson,
  PhysiologicalCategory,
} from '../../types/compare';
import {
  CANONICAL_PARAMETER_DEFINITIONS,
  CANONICAL_PARAMETER_LIST,
  CanonicalParameterKey,
  resolveToCanonicalKey,
} from '../../types/physiologicalRegistry';

export {
  CANONICAL_PARAMETER_DEFINITIONS,
  CANONICAL_PARAMETER_LIST,
  resolveToCanonicalKey,
};
export type { CanonicalParameterKey };

export interface CanonicalParameterDef {
  secNo: number;
  canonicalKey: CanonicalParameterKey;
  parameter: string;
  unit: string;
  category: PhysiologicalCategory;
}

export const CANONICAL_COMPARE_PARAMETERS: CanonicalParameterDef[] = CANONICAL_PARAMETER_LIST.map((def) => ({
  secNo: def.secNo,
  canonicalKey: def.key,
  parameter: def.name,
  unit: def.unit,
  category: def.category,
}));

export const createSynchronizedPhbJson = buildSynchronizedPhbJson;

/**
 * Checks whether a given raw unit is compatible with the canonical physiological parameter unit.
 */
export function isUnitCompatible(canonicalKey: CanonicalParameterKey, unit: string | undefined | null): boolean {
  if (!unit) return true; // Default to true if not specified
  const norm = unit.toLowerCase().trim();
  switch (canonicalKey) {
    case 'heartRate':
      return norm === 'bpm' || norm === 'beats/min' || norm === 'beats/minute' || norm === '1/min' || norm === 'hz';
    case 'spo2':
      return norm === '%' || norm === 'percent' || norm === 'percentage' || norm === 'ratio';
    case 'ppi':
      return norm === 'ms' || norm === 'msec' || norm === 'milliseconds' || norm === 's' || norm === 'seconds' || norm === '%';
    case 'rmssd':
    case 'sdnn':
      return norm === 'ms' || norm === 'msec' || norm === 'milliseconds';
    case 'respiratoryRate':
      return norm === 'breaths/min' || norm === 'rpm' || norm === 'bpm' || norm === '1/min' || norm === 'br/min' || norm === 'breaths/minute' || norm === 'respirations/min';
    case 'activityIntensity':
      return norm === 'a.u.' || norm === 'g' || norm === 'm/s2' || norm === 'm/s^2' || norm === 'mg' || norm === 'index';
    case 'ambientTemperature':
      return norm === '°c' || norm === 'c' || norm === 'degc' || norm === 'celsius' || norm === '°f' || norm === 'f';
    case 'relativeHumidity':
      return norm === '%' || norm === 'percent' || norm === 'percentage';
    case 'atmosphericPressure':
      return norm === 'hpa' || norm === 'pa' || norm === 'mbar' || norm === 'atm' || norm === 'mmhg';
    case 'altitude':
      return norm === 'm' || norm === 'meters' || norm === 'metre' || norm === 'ft' || norm === 'feet';
    default:
      return true;
  }
}

export function normalizeKey(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[\s\-_]/g, '');
}

/**
 * Universal canonical key resolution function.
 */
export function toCanonicalKey(rawKey: string | undefined | null): CanonicalParameterKey | null {
  if (!rawKey || typeof rawKey !== 'string') return null;
  return resolveToCanonicalKey(rawKey);
}

export function matchesCanonicalKey(rawKey: string | undefined | null, canonicalKey: CanonicalParameterKey): boolean {
  return toCanonicalKey(rawKey) === canonicalKey;
}

/**
 * Helper to validate whether a candidate number is a strictly valid finite number.
 * Explicitly rejects NaN, Infinity, -Infinity, null, undefined.
 */
export function isValidFiniteNumber(val: any): val is number {
  return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val);
}

export function extractNumberFromItem(item: any): number | null {
  if (item === null || item === undefined) return null;
  if (isValidFiniteNumber(item)) return item;
  if (typeof item === 'object') {
    const candidate =
      item.value ??
      item.baseline ??
      item.val ??
      item.reading ??
      item.numericValue ??
      item.mean ??
      item.median ??
      item.lockedValue;
    if (isValidFiniteNumber(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Generic algorithm to convert incremental raw deviation stages into cumulative boundaries.
 * 
 * Example:
 * raw: [5, 8, 10, 13, 15]
 * output: [5, 13, 23, 36, 51]
 */
export function buildCumulativeDeviationBoundaries(rawStages: number[]): number[] {
  let running = 0;
  return rawStages.map((mag) => {
    running += Math.abs(Number(mag) || 0);
    return running;
  });
}

/**
 * Extracts raw incremental stage magnitudes [s1, s2, s3, s4, s5] from PHB deviation configuration.
 */
export function extractRawStageMagnitudes(
  configItem: PhbDeviationConfigItem | null | undefined,
  baseline: number,
  parameterKey: CanonicalParameterKey
): number[] {
  const profile = configItem?.deviationProfile;

  // Case 1: Object with stage1..stage5
  if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
    const s1 = profile.stage1 || (profile as any).Stage1 || (profile as any).stage_1;
    const s2 = profile.stage2 || (profile as any).Stage2 || (profile as any).stage_2;
    const s3 = profile.stage3 || (profile as any).Stage3 || (profile as any).stage_3;
    const s4 = profile.stage4 || (profile as any).Stage4 || (profile as any).stage_4;
    const s5 = profile.stage5 || (profile as any).Stage5 || (profile as any).stage_5;

    if (s1 && s2 && s3 && s4 && s5) {
      const defaultFirstMag = parameterKey === 'spo2' ? 1.0 : 5.0;
      const m1 = isValidFiniteNumber(s1.magnitude) ? s1.magnitude : (isValidFiniteNumber(s1.upperBound) ? s1.upperBound : defaultFirstMag);
      const m2 = isValidFiniteNumber(s2.magnitude) ? s2.magnitude : (parameterKey === 'spo2' ? 1.0 : 8.0);
      const m3 = isValidFiniteNumber(s3.magnitude) ? s3.magnitude : (parameterKey === 'spo2' ? 1.0 : 10.0);
      const m4 = isValidFiniteNumber(s4.magnitude) ? s4.magnitude : (parameterKey === 'spo2' ? 1.0 : 13.0);
      const m5 = isValidFiniteNumber(s5.magnitude) ? s5.magnitude : (parameterKey === 'spo2' ? 1.0 : 15.0);

      return [
        Math.abs(Number(m1)),
        Math.abs(Number(m2)),
        Math.abs(Number(m3)),
        Math.abs(Number(m4)),
        Math.abs(Number(m5)),
      ];
    }
  }

  // Case 2: Array of stages
  const stageArray = Array.isArray(profile)
    ? profile
    : Array.isArray(profile?.stages)
    ? profile.stages
    : Array.isArray(configItem?.stages)
    ? configItem.stages
    : null;

  if (stageArray && stageArray.length >= 5) {
    const defaultFirstMag = parameterKey === 'spo2' ? 1.0 : 5.0;
    const m1 = isValidFiniteNumber(stageArray[0]?.magnitude) ? stageArray[0].magnitude : (isValidFiniteNumber(stageArray[0]?.upperBound) ? stageArray[0].upperBound : defaultFirstMag);
    const m2 = isValidFiniteNumber(stageArray[1]?.magnitude) ? stageArray[1].magnitude : (parameterKey === 'spo2' ? 1.0 : 8.0);
    const m3 = isValidFiniteNumber(stageArray[2]?.magnitude) ? stageArray[2].magnitude : (parameterKey === 'spo2' ? 1.0 : 10.0);
    const m4 = isValidFiniteNumber(stageArray[3]?.magnitude) ? stageArray[3].magnitude : (parameterKey === 'spo2' ? 1.0 : 13.0);
    const m5 = isValidFiniteNumber(stageArray[4]?.magnitude) ? stageArray[4].magnitude : (parameterKey === 'spo2' ? 1.0 : 15.0);

    return [
      Math.abs(Number(m1)),
      Math.abs(Number(m2)),
      Math.abs(Number(m3)),
      Math.abs(Number(m4)),
      Math.abs(Number(m5)),
    ];
  }

  // Case 3: Threshold-based derivation
  const threshold =
    configItem?.deviationThreshold ??
    configItem?.deviation ??
    configItem?.dev ??
    configItem?.threshold ??
    configItem?.magnitude ??
    configItem?.value;

  if (isValidFiniteNumber(threshold) && threshold > 0) {
    return [threshold * 0.5, threshold * 0.5, threshold, threshold, threshold * 1.5];
  }

  // Case 4: Default physiological parameter baseline fallback
  if (parameterKey === 'spo2') {
    return [1.0, 1.0, 1.0, 1.0, 1.0];
  } else if (parameterKey === 'rmssd') {
    return [10.0, 15.0, 20.0, 25.0, 30.0];
  } else if (parameterKey === 'sdnn') {
    return [13.0, 20.0, 26.0, 33.0, 39.0];
  } else if (parameterKey === 'ppi') {
    return [67.0, 108.0, 137.0, 181.0, 211.0];
  } else if (parameterKey === 'respiratoryRate') {
    return [2.0, 3.0, 4.0, 5.0, 6.0];
  }

  const baseDev = Math.max(1, Math.round(baseline * 0.05));
  return [baseDev, baseDev, baseDev, baseDev, baseDev];
}

/**
 * Validates and normalizes 5-stage deviation profile using cumulative boundaries.
 */
export function normalizeDeviationProfile(
  configItem: PhbDeviationConfigItem | null | undefined,
  baseline: number,
  parameterKey: CanonicalParameterKey
): NormalizedDeviationProfile {
  const rawStageMagnitudes = extractRawStageMagnitudes(configItem, baseline, parameterKey);
  const cumBounds = buildCumulativeDeviationBoundaries(rawStageMagnitudes);

  const profile = configItem?.deviationProfile;
  const isProfileArray = Array.isArray(profile);
  const s1 = isProfileArray ? profile[0] : (profile as any)?.stage1 || (profile as any)?.Stage1 || (profile as any)?.stage_1;
  const s2 = isProfileArray ? profile[1] : (profile as any)?.stage2 || (profile as any)?.Stage2 || (profile as any)?.stage_2;
  const s3 = isProfileArray ? profile[2] : (profile as any)?.stage3 || (profile as any)?.Stage3 || (profile as any)?.stage_3;
  const s4 = isProfileArray ? profile[3] : (profile as any)?.stage4 || (profile as any)?.Stage4 || (profile as any)?.stage_4;
  const s5 = isProfileArray ? profile[4] : (profile as any)?.stage5 || (profile as any)?.Stage5 || (profile as any)?.stage_5;

  return {
    stage1: {
      stage: 1,
      lowerBound: 0,
      upperBound: cumBounds[0],
      magnitude: rawStageMagnitudes[0],
      severity: String(s1?.severity ?? 'NORMAL'),
    },
    stage2: {
      stage: 2,
      lowerBound: cumBounds[0],
      upperBound: cumBounds[1],
      magnitude: rawStageMagnitudes[1],
      severity: String(s2?.severity ?? 'MILD'),
    },
    stage3: {
      stage: 3,
      lowerBound: cumBounds[1],
      upperBound: cumBounds[2],
      magnitude: rawStageMagnitudes[2],
      severity: String(s3?.severity ?? 'MODERATE'),
    },
    stage4: {
      stage: 4,
      lowerBound: cumBounds[2],
      upperBound: cumBounds[3],
      magnitude: rawStageMagnitudes[3],
      severity: String(s4?.severity ?? 'SEVERE'),
    },
    stage5: {
      stage: 5,
      lowerBound: cumBounds[3],
      upperBound: cumBounds[4],
      magnitude: rawStageMagnitudes[4],
      severity: String(s5?.severity ?? 'CRITICAL'),
    },
  };
}

/**
 * Generic schema-driven function to resolve a complete deviation model for a parameter key.
 */
export function resolveDeviationModelFromPhb(
  parameterKey: CanonicalParameterKey,
  phbDocument: PhbDocument | any
): NormalizedPhbFeature | null {
  if (!phbDocument || typeof phbDocument !== 'object') return null;

  const normalized = normalizePhbDocument(phbDocument);
  return normalized.features.get(parameterKey) ?? null;
}

/**
 * Normalizes the complete PHB document into a strongly typed, validated representation.
 * 
 * Supports:
 * - DV (Direct Vitals): 3
 * - IV (Indirect Vitals): 3
 * - CX (Context Variables): 5
 */
export function normalizePhbDocument(phbDocument: PhbDocument | any): NormalizedPhbDocument {
  const features = new Map<string, NormalizedPhbFeature>();
  const discoveredDirectKeys: string[] = [];
  const discoveredIndirectKeys: string[] = [];
  const discoveredContextKeys: string[] = [];
  const discoveredConfigKeys: string[] = [];

  if (!phbDocument || typeof phbDocument !== 'object') {
    return {
      features,
      discoveredDirectKeys,
      discoveredIndirectKeys,
      discoveredContextKeys,
      discoveredConfigKeys,
      rawDocument: phbDocument || {},
    };
  }

  // Intermediary maps keyed by CanonicalParameterKey
  const valueMap = new Map<CanonicalParameterKey, { value: number; unit?: string; rawName: string; category: PhysiologicalCategory }>();
  const configMap = new Map<CanonicalParameterKey, PhbDeviationConfigItem>();

  // 1. Discover and extract Source A (physiological.direct)
  const directList = Array.isArray(phbDocument.physiological?.direct)
    ? phbDocument.physiological.direct
    : Array.isArray(phbDocument.direct)
    ? phbDocument.direct
    : [];

  for (const item of directList) {
    const rawName = item?.name ?? item?.featureName ?? item?.key ?? item?.id;
    const canonicalKey = toCanonicalKey(rawName);
    const num = extractNumberFromItem(item);
    if (rawName) {
      discoveredDirectKeys.push(rawName);
    }
    if (canonicalKey && num !== null && isValidFiniteNumber(num)) {
      const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
      valueMap.set(canonicalKey, { value: num, unit: item?.unit || def.unit, rawName: String(rawName), category: def.category });
    }
  }

  // Also support direct as object map: { heartRate: 67, spo2: 99, ... }
  if (phbDocument.physiological?.direct && !Array.isArray(phbDocument.physiological.direct) && typeof phbDocument.physiological.direct === 'object') {
    for (const [prop, val] of Object.entries(phbDocument.physiological.direct)) {
      discoveredDirectKeys.push(prop);
      const canonicalKey = toCanonicalKey(prop);
      const num = extractNumberFromItem(val);
      if (canonicalKey && num !== null && isValidFiniteNumber(num)) {
        const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
        const unit = typeof val === 'object' ? (val as any)?.unit : def.unit;
        valueMap.set(canonicalKey, { value: num, unit, rawName: prop, category: def.category });
      }
    }
  }

  // 2. Discover and extract Source A (physiological.indirect)
  const indirectList = Array.isArray(phbDocument.physiological?.indirect)
    ? phbDocument.physiological.indirect
    : Array.isArray(phbDocument.indirect)
    ? phbDocument.indirect
    : [];

  for (const item of indirectList) {
    const rawName = item?.name ?? item?.featureName ?? item?.key ?? item?.id;
    const canonicalKey = toCanonicalKey(rawName);
    const num = extractNumberFromItem(item);
    if (rawName) {
      discoveredIndirectKeys.push(rawName);
    }
    if (canonicalKey && num !== null && isValidFiniteNumber(num)) {
      const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
      valueMap.set(canonicalKey, { value: num, unit: item?.unit || def.unit, rawName: String(rawName), category: def.category });
    }
  }

  // Also support indirect as object map: { rmssd: 50, sdnn: 70, respiratoryRate: 15, ... }
  if (phbDocument.physiological?.indirect && !Array.isArray(phbDocument.physiological.indirect) && typeof phbDocument.physiological.indirect === 'object') {
    for (const [prop, val] of Object.entries(phbDocument.physiological.indirect)) {
      discoveredIndirectKeys.push(prop);
      const canonicalKey = toCanonicalKey(prop);
      const num = extractNumberFromItem(val);
      if (canonicalKey && num !== null && isValidFiniteNumber(num)) {
        const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
        const unit = typeof val === 'object' ? (val as any)?.unit : def.unit;
        valueMap.set(canonicalKey, { value: num, unit, rawName: prop, category: def.category });
      }
    }
  }

  // 3. Discover and extract Context Variables (physiological.context or phbDocument.context)
  const contextList = Array.isArray(phbDocument.physiological?.context)
    ? phbDocument.physiological.context
    : Array.isArray(phbDocument.context)
    ? phbDocument.context
    : [];

  for (const item of contextList) {
    const rawName = item?.name ?? item?.featureName ?? item?.key ?? item?.id;
    const canonicalKey = toCanonicalKey(rawName);
    const num = extractNumberFromItem(item);
    if (rawName) {
      discoveredContextKeys.push(rawName);
    }
    if (canonicalKey && num !== null && isValidFiniteNumber(num)) {
      const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
      valueMap.set(canonicalKey, { value: num, unit: item?.unit || def.unit, rawName: String(rawName), category: def.category });
    }
  }

  if (phbDocument.context && !Array.isArray(phbDocument.context) && typeof phbDocument.context === 'object') {
    for (const [prop, val] of Object.entries(phbDocument.context)) {
      discoveredContextKeys.push(prop);
      const canonicalKey = toCanonicalKey(prop);
      const num = extractNumberFromItem(val);
      if (canonicalKey && num !== null && isValidFiniteNumber(num)) {
        const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
        const unit = typeof val === 'object' ? (val as any)?.unit : def.unit;
        valueMap.set(canonicalKey, { value: num, unit, rawName: prop, category: def.category });
      }
    }
  }

  // Top-level / baselines / vitals extraction if not nested
  if (phbDocument.vitals && typeof phbDocument.vitals === 'object') {
    for (const [prop, val] of Object.entries(phbDocument.vitals)) {
      const canonicalKey = toCanonicalKey(prop);
      const num = extractNumberFromItem(val);
      if (canonicalKey && num !== null && isValidFiniteNumber(num) && !valueMap.has(canonicalKey)) {
        const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
        valueMap.set(canonicalKey, { value: num, rawName: prop, category: def.category });
      }
    }
  }

  if (phbDocument.baselines && typeof phbDocument.baselines === 'object') {
    for (const [prop, val] of Object.entries(phbDocument.baselines)) {
      const canonicalKey = toCanonicalKey(prop);
      const num = extractNumberFromItem(val);
      if (canonicalKey && num !== null && isValidFiniteNumber(num) && !valueMap.has(canonicalKey)) {
        const def = CANONICAL_PARAMETER_DEFINITIONS[canonicalKey];
        valueMap.set(canonicalKey, { value: num, rawName: prop, category: def.category });
      }
    }
  }

  // Check top-level properties (e.g. phbDocument.heartRate, phbDocument.rmssd, phbDocument.respiratoryRate, etc.)
  for (const def of CANONICAL_PARAMETER_LIST) {
    if (!valueMap.has(def.key)) {
      const topNum = extractNumberFromItem(phbDocument[def.key]);
      if (topNum !== null && isValidFiniteNumber(topNum)) {
        valueMap.set(def.key, { value: topNum, rawName: def.key, unit: def.unit, category: def.category });
      } else {
        for (const alias of def.aliases) {
          const aliasNum = extractNumberFromItem(phbDocument[alias]);
          if (aliasNum !== null && isValidFiniteNumber(aliasNum)) {
            valueMap.set(def.key, { value: aliasNum, rawName: alias, unit: def.unit, category: def.category });
            break;
          }
        }
      }
    }
  }

  // 4. Discover and extract Source B (deviationConfiguration)
  const configList = Array.isArray(phbDocument.deviationConfiguration)
    ? phbDocument.deviationConfiguration
    : Array.isArray(phbDocument.deviationConfigurations)
    ? phbDocument.deviationConfigurations
    : [];

  for (const cfg of configList) {
    const rawName = cfg?.featureName ?? cfg?.name ?? cfg?.parameterName ?? cfg?.key;
    const canonicalKey = toCanonicalKey(rawName);
    if (rawName) {
      discoveredConfigKeys.push(rawName);
    }
    if (canonicalKey) {
      configMap.set(canonicalKey, cfg);
    }
  }

  // Also support map-form deviationConfiguration: { heartRate: {...}, spo2: {...} }
  if (phbDocument.deviationConfiguration && !Array.isArray(phbDocument.deviationConfiguration) && typeof phbDocument.deviationConfiguration === 'object') {
    for (const [prop, val] of Object.entries(phbDocument.deviationConfiguration)) {
      discoveredConfigKeys.push(prop);
      const canonicalKey = toCanonicalKey(prop);
      if (canonicalKey && typeof val === 'object') {
        configMap.set(canonicalKey, { ...(val as any), featureName: prop });
      }
    }
  }

  // 5. Join Source A and Source B for all 11 canonical parameters
  for (const def of CANONICAL_PARAMETER_LIST) {
    const canonicalKey = def.key;
    const directOrIndirect = valueMap.get(canonicalKey);
    const configItem = configMap.get(canonicalKey);

    let baseline = directOrIndirect?.value ?? (isValidFiniteNumber(configItem?.baseline) ? (configItem!.baseline as number) : null);
    if (baseline === null) continue;

    const unit = directOrIndirect?.unit || configItem?.unit || def.unit;
    const comparisonType = configItem?.comparisonType || 'ABSOLUTE';
    const directionality = configItem?.directionality || (canonicalKey === 'spo2' ? 'DOWNWARD_ONLY' : 'BIDIRECTIONAL');

    const deviationProfile = normalizeDeviationProfile(configItem, baseline, canonicalKey);
    const rawStageMagnitudes = extractRawStageMagnitudes(configItem, baseline, canonicalKey);
    const cumulativeBoundaries = buildCumulativeDeviationBoundaries(rawStageMagnitudes);

    features.set(canonicalKey, {
      featureKey: canonicalKey,
      parameterName: def.name,
      unit,
      category: def.category,
      phbValue: baseline,
      baseline,
      comparisonType,
      directionality,
      deviationProfile,
      rawStageMagnitudes,
      cumulativeBoundaries,
    });
  }

  return {
    uid: phbDocument.uid ?? phbDocument.userId,
    version: phbDocument.version,
    features,
    discoveredDirectKeys,
    discoveredIndirectKeys,
    discoveredContextKeys,
    discoveredConfigKeys,
    rawDocument: phbDocument,
  };
}

/**
 * Builds a complete SynchronizedPhbJson structure from any raw Firestore PHB document.
 */
export function buildSynchronizedPhbJson(phbDocument: PhbDocument | any, uid: string): SynchronizedPhbJson {
  const normalized = normalizePhbDocument(phbDocument);

  const directList: any[] = [];
  const indirectList: any[] = [];
  const contextList: any[] = [];

  for (const [key, feat] of normalized.features.entries()) {
    const def = CANONICAL_PARAMETER_DEFINITIONS[key as CanonicalParameterKey];
    const category = def?.category || feat.category;
    const item = {
      name: feat.parameterName,
      key,
      value: feat.baseline,
      baseline: feat.baseline,
      unit: feat.unit,
      category,
    };
    if (category === 'DV') {
      directList.push(item);
    } else if (category === 'IV') {
      indirectList.push(item);
    } else {
      contextList.push(item);
    }
  }

  const deviationConfigList: PhbDeviationConfigItem[] = [];
  for (const [key, feat] of normalized.features.entries()) {
    deviationConfigList.push({
      featureName: feat.parameterName,
      baseline: feat.baseline,
      comparisonType: feat.comparisonType,
      directionality: feat.directionality,
      stages: [
        feat.deviationProfile.stage1,
        feat.deviationProfile.stage2,
        feat.deviationProfile.stage3,
        feat.deviationProfile.stage4,
        feat.deviationProfile.stage5,
      ],
    });
  }

  return {
    uid,
    owner: phbDocument?.owner ?? uid,
    userReference: phbDocument?.userReference,
    version: phbDocument?.version || '2.0.0',
    generatedAt: phbDocument?.generatedAt || Date.now(),
    updatedAt: phbDocument?.updatedAt || Date.now(),
    assessmentScopes: phbDocument?.assessmentScopes || {},
    demographicProfile: phbDocument?.demographicProfile || {},
    monitoringPreferences: phbDocument?.monitoringPreferences || {},
    physiological: {
      direct: directList,
      indirect: indirectList,
      context: contextList,
    },
    context: phbDocument?.context || {},
    deviationConfiguration: deviationConfigList,
    metadata: phbDocument?.metadata || {},
    engineVersion: phbDocument?.engineVersion || '2.0.0',
    ruleVersion: phbDocument?.ruleVersion || '2.0.0',
    deviationModelVersion: phbDocument?.deviationModelVersion || '2.0.0',
    deviationEvidenceVersion: phbDocument?.deviationEvidenceVersion || '2.0.0',
    features: normalized.features,
    discoveredDirectKeys: normalized.discoveredDirectKeys,
    discoveredIndirectKeys: normalized.discoveredIndirectKeys,
    discoveredContextKeys: normalized.discoveredContextKeys,
    discoveredConfigKeys: normalized.discoveredConfigKeys,
    rawDocument: phbDocument,
  };
}
