import {
  PhbDocument,
  CmParameterRow,
  CmPacket,
  CompareComputationResult,
  NormalizedPhbDocument,
  NormalizedPhbFeature,
  NormalizedDeviationStage,
  SynchronizedPhbJson,
  PhysiologicalCategory,
} from '../../types/compare';
import { ShbCompletedSessionCache } from '../vitals/shbSessionCache';
import { cmPacketCache } from './cmPacketCache';
import {
  CANONICAL_COMPARE_PARAMETERS,
  CanonicalParameterKey,
  normalizePhbDocument,
  resolveDeviationModelFromPhb,
  isValidFiniteNumber,
  buildCumulativeDeviationBoundaries,
  extractRawStageMagnitudes,
  isUnitCompatible,
  CANONICAL_PARAMETER_DEFINITIONS,
  CANONICAL_PARAMETER_LIST,
} from './phbNormalizer';
import { terminalLogger } from '../logging/terminalLogger';

export {
  CANONICAL_COMPARE_PARAMETERS,
  resolveDeviationModelFromPhb,
  normalizePhbDocument,
  buildCumulativeDeviationBoundaries,
  extractRawStageMagnitudes,
  isUnitCompatible,
};
export type { CanonicalParameterKey };

/**
 * Authoritative Canonical Organ Associations Mapping for 11 Parameters
 */
export interface OrganAssociationDef {
  direct: CanonicalParameterKey[];
  indirect: CanonicalParameterKey[];
  context: CanonicalParameterKey[];
}

export const CANONICAL_ORGAN_PARAM_MAP: Record<string, OrganAssociationDef> = {
  OVERALL: {
    direct: ['heartRate', 'spo2', 'ppi'],
    indirect: ['rmssd', 'sdnn', 'respiratoryRate'],
    context: ['activityIntensity', 'ambientTemperature', 'relativeHumidity', 'atmosphericPressure', 'altitude'],
  },
  CARDIOVASCULAR: {
    direct: ['heartRate', 'spo2', 'ppi'],
    indirect: ['rmssd', 'sdnn'],
    context: ['activityIntensity', 'ambientTemperature'],
  },
  RESPIRATORY: {
    direct: ['spo2', 'heartRate', 'ppi'],
    indirect: ['respiratoryRate', 'rmssd'],
    context: ['atmosphericPressure', 'altitude', 'relativeHumidity'],
  },
  NEUROLOGICAL: {
    direct: ['heartRate', 'ppi'],
    indirect: ['rmssd', 'sdnn'],
    context: ['activityIntensity', 'ambientTemperature'],
  },
  MOVEMENT: {
    direct: ['heartRate', 'ppi'],
    indirect: ['sdnn', 'respiratoryRate'],
    context: ['activityIntensity', 'ambientTemperature'],
  },
  THERMAL: {
    direct: ['heartRate', 'ppi'],
    indirect: ['rmssd', 'respiratoryRate'],
    context: ['ambientTemperature', 'relativeHumidity'],
  },
  ENVIRONMENT: {
    direct: ['spo2', 'heartRate', 'ppi'],
    indirect: ['respiratoryRate'],
    context: ['ambientTemperature', 'relativeHumidity', 'atmosphericPressure', 'altitude'],
  },
  RENAL: {
    direct: ['heartRate', 'spo2', 'ppi'],
    indirect: ['rmssd', 'sdnn'],
    context: ['ambientTemperature', 'relativeHumidity'],
  },
  METABOLIC: {
    direct: ['heartRate', 'spo2'],
    indirect: ['respiratoryRate', 'rmssd'],
    context: ['activityIntensity', 'ambientTemperature', 'atmosphericPressure'],
  },
  ENDOCRINE: {
    direct: ['heartRate', 'ppi'],
    indirect: ['sdnn', 'rmssd'],
    context: ['ambientTemperature', 'activityIntensity'],
  },
  VASCULAR: {
    direct: ['spo2', 'heartRate', 'ppi'],
    indirect: ['rmssd', 'sdnn'],
    context: ['ambientTemperature', 'relativeHumidity'],
  },
};

/**
 * Resolves alias to canonical organ key
 */
export function normalizeOrganTarget(target: string | undefined | null): string {
  if (!target) return 'OVERALL';
  const norm = target.toUpperCase().replace(/[\s\-_]/g, '');

  if (norm.includes('CARDIO')) return 'CARDIOVASCULAR';
  if (norm.includes('RESP')) return 'RESPIRATORY';
  if (norm.includes('BRAIN') || norm.includes('NEURO')) return 'NEUROLOGICAL';
  if (norm.includes('VESSEL') || norm.includes('VASCULAR')) return 'VASCULAR';
  if (norm.includes('ENDOCRINE') || norm.includes('HORMON')) return 'ENDOCRINE';
  if (norm.includes('ENVIRON') || norm.includes('ALTITUDE')) return 'ENVIRONMENT';
  if (norm.includes('THERM')) return 'THERMAL';
  if (norm.includes('MOV') || norm.includes('ACTIV')) return 'MOVEMENT';
  if (norm.includes('RENAL') || norm.includes('KIDNEY')) return 'RENAL';
  if (norm.includes('METABOL')) return 'METABOLIC';

  return 'OVERALL';
}

/**
 * Returns human-readable source path for PHB values
 */
export function getPhbSourceDescription(key: CanonicalParameterKey, category: PhysiologicalCategory): string {
  if (category === 'DV') {
    return `physiological.direct[${key}]`;
  }
  if (category === 'IV') {
    return `physiological.indirect[${key}]`;
  }
  return `context[${key}]`;
}

/**
 * Returns human-readable source path for SHB locked values
 */
export function getShbSourceDescription(key: CanonicalParameterKey): string {
  switch (key) {
    case 'heartRate':
      return 'lockedDirectVitals.heartRate';
    case 'spo2':
      return 'lockedDirectVitals.spo2';
    case 'ppi':
      return 'lockedDirectVitals.ppi';
    case 'rmssd':
      return 'lockedIndirectVitals.rmssd';
    case 'sdnn':
      return 'lockedIndirectVitals.sdnn';
    case 'respiratoryRate':
      return 'lockedIndirectVitals.respiratoryRate';
    case 'activityIntensity':
      return 'lockedContextVariables.activityIntensity';
    case 'ambientTemperature':
      return 'lockedContextVariables.ambientTemperature';
    case 'relativeHumidity':
      return 'lockedContextVariables.relativeHumidity';
    case 'atmosphericPressure':
      return 'lockedContextVariables.atmosphericPressure';
    case 'altitude':
      return 'lockedContextVariables.altitude';
    default:
      return 'shbSessionCache';
  }
}

/**
 * Extracts locked SHB session value for a given canonical parameter key.
 */
export function extractShbValue(shb: ShbCompletedSessionCache | null, key: CanonicalParameterKey): number | null {
  if (!shb) return null;

  const snapshotValue = shb.lockedVitals?.[key];
  if (isValidFiniteNumber(snapshotValue)) return snapshotValue;

  switch (key) {
    case 'heartRate': {
      const lockedDirect = shb.lockedDirectVitals?.heartRate ?? shb.lockedDirectVitals?.hr;
      if (isValidFiniteNumber(lockedDirect)) return lockedDirect;
      const lockedDirectObj = shb.directVitals?.hr?.lockedValue;
      if (isValidFiniteNumber(lockedDirectObj)) return lockedDirectObj;
      return null;
    }
    case 'spo2': {
      const lockedDirect = shb.lockedDirectVitals?.spo2;
      if (isValidFiniteNumber(lockedDirect)) return lockedDirect;
      const lockedDirectObj = shb.directVitals?.spo2?.lockedValue;
      if (isValidFiniteNumber(lockedDirectObj)) return lockedDirectObj;
      return null;
    }
    case 'ppi': {
      const lockedDirect = shb.lockedDirectVitals?.ppi;
      if (isValidFiniteNumber(lockedDirect)) return lockedDirect;
      const lockedDirectObj = shb.directVitals?.ppi?.lockedValue;
      if (isValidFiniteNumber(lockedDirectObj)) return lockedDirectObj;
      return null;
    }
    case 'rmssd': {
      const lockedIndirect = shb.lockedIndirectVitals?.rmssd;
      if (isValidFiniteNumber(lockedIndirect)) return lockedIndirect;
      const lockedIndirectObj = shb.indirectVitals?.rmssd?.lockedValue;
      if (isValidFiniteNumber(lockedIndirectObj)) return lockedIndirectObj;
      return null;
    }
    case 'sdnn': {
      const lockedIndirect = shb.lockedIndirectVitals?.sdnn;
      if (isValidFiniteNumber(lockedIndirect)) return lockedIndirect;
      const lockedIndirectObj = shb.indirectVitals?.sdnn?.lockedValue;
      if (isValidFiniteNumber(lockedIndirectObj)) return lockedIndirectObj;
      return null;
    }
    case 'respiratoryRate': {
      const lockedIndirect = shb.lockedIndirectVitals?.respiratoryRate ?? shb.lockedIndirectVitals?.rr;
      if (isValidFiniteNumber(lockedIndirect)) return lockedIndirect;
      const lockedIndirectObj =
        shb.indirectVitals?.rr?.lockedValue ??
        shb.indirectVitals?.respiratoryRate?.lockedValue;
      if (isValidFiniteNumber(lockedIndirectObj)) return lockedIndirectObj;
      return null;
    }
    case 'activityIntensity': {
      const lockedCx = shb.lockedContextVariables?.activityIntensity;
      if (isValidFiniteNumber(lockedCx)) return lockedCx;
      return null;
    }
    case 'ambientTemperature': {
      const lockedCx = shb.lockedContextVariables?.ambientTemperature;
      if (isValidFiniteNumber(lockedCx)) return lockedCx;
      return null;
    }
    case 'relativeHumidity': {
      const lockedCx = shb.lockedContextVariables?.relativeHumidity;
      if (isValidFiniteNumber(lockedCx)) return lockedCx;
      return null;
    }
    case 'atmosphericPressure': {
      const lockedCx = shb.lockedContextVariables?.atmosphericPressure;
      if (isValidFiniteNumber(lockedCx)) return lockedCx;
      return null;
    }
    case 'altitude': {
      const lockedCx = shb.lockedContextVariables?.altitude;
      if (isValidFiniteNumber(lockedCx)) return lockedCx;
      return null;
    }
    default:
      return null;
  }
}

/**
 * Resolves the matched stage using cumulative boundaries.
 */
export function matchApplicableStage(
  distance: number,
  cumulativeBoundaries: number[]
): {
  matchedStage: number;
  compareStage: number;
  stageKey: string;
  boundary: number;
  lowerBound: number;
  upperBound: number;
  residualDistance: number;
  beyondBoundary: boolean;
} {
  const [B1, B2, B3, B4, B5] = cumulativeBoundaries;

  if (distance === 0 || distance < 1e-9) {
    return {
      matchedStage: 0,
      compareStage: 0,
      stageKey: 'stage0',
      boundary: 0,
      lowerBound: 0,
      upperBound: B1,
      residualDistance: 0,
      beyondBoundary: false,
    };
  } else if (distance <= B1) {
    return {
      matchedStage: 1,
      compareStage: 1,
      stageKey: 'stage1',
      boundary: B1,
      lowerBound: 0,
      upperBound: B1,
      residualDistance: distance - B1,
      beyondBoundary: false,
    };
  } else if (distance <= B2) {
    return {
      matchedStage: 2,
      compareStage: 2,
      stageKey: 'stage2',
      boundary: B2,
      lowerBound: B1,
      upperBound: B2,
      residualDistance: distance - B2,
      beyondBoundary: false,
    };
  } else if (distance <= B3) {
    return {
      matchedStage: 3,
      compareStage: 3,
      stageKey: 'stage3',
      boundary: B3,
      lowerBound: B2,
      upperBound: B3,
      residualDistance: distance - B3,
      beyondBoundary: false,
    };
  } else if (distance <= B4) {
    return {
      matchedStage: 4,
      compareStage: 4,
      stageKey: 'stage4',
      boundary: B4,
      lowerBound: B3,
      upperBound: B4,
      residualDistance: distance - B4,
      beyondBoundary: false,
    };
  } else if (distance <= B5) {
    return {
      matchedStage: 5,
      compareStage: 5,
      stageKey: 'stage5',
      boundary: B5,
      lowerBound: B4,
      upperBound: B5,
      residualDistance: distance - B5,
      beyondBoundary: false,
    };
  } else {
    // D > B5 -> Stage 5 with beyondBoundary = true
    return {
      matchedStage: 5,
      compareStage: 5,
      stageKey: 'stage5',
      boundary: B5,
      lowerBound: B5,
      upperBound: Infinity,
      residualDistance: distance - B5,
      beyondBoundary: true,
    };
  }
}

/**
 * Evaluates comparison between a normalized PHB feature and an SHB measurement.
 */
export function evaluateFeatureComparison(
  feature: NormalizedPhbFeature,
  shbValue: number | null
): {
  shb: number | null;
  dev: number | null;
  phbDevs: number | null;
  shbDevs: number | null;
  compare: number | null;
  stage: string | number;
  compareStage: number | null;
  beyondBoundary: boolean;
  severity: string;
  magnitude: number;
  lowerBound: number;
  upperBound: number;
  phbBaseline: number;
  shbValue: number | null;
  shbDeviation: number | null;
  deviationDistance: number | null;
  direction: string | null;
  rawStageMagnitudes: number[];
  cumulativeBoundaries: number[];
  matchedStage: number | string;
  matchedBoundary: number | null;
  residualDistance: number | null;
  status: 'COMPUTED' | 'NOT_AVAILABLE' | 'MISSING_PHB_VALUE' | 'MISSING_SHB_VALUE' | 'UNIT_MISMATCH' | 'PHB_DEVIATION_MODEL_INVALID';
} {
  if (shbValue === null || !isValidFiniteNumber(shbValue)) {
    return {
      shb: null,
      dev: null,
      phbDevs: null,
      shbDevs: null,
      compare: null,
      stage: 'NONE',
      compareStage: null,
      beyondBoundary: false,
      severity: 'UNKNOWN',
      magnitude: feature.rawStageMagnitudes[0] || 0,
      lowerBound: 0,
      upperBound: feature.cumulativeBoundaries[0] || 0,
      phbBaseline: feature.baseline,
      shbValue: null,
      shbDeviation: null,
      deviationDistance: null,
      direction: null,
      rawStageMagnitudes: feature.rawStageMagnitudes,
      cumulativeBoundaries: feature.cumulativeBoundaries,
      matchedStage: 'NONE',
      matchedBoundary: null,
      residualDistance: null,
      status: 'MISSING_SHB_VALUE',
    };
  }

  // Level 1: DEV = SHB - PHB
  const dev = shbValue - feature.phbValue;
  const signedDeviation = dev;
  const rawStageMagnitudes = feature.rawStageMagnitudes;
  const cumulativeBoundaries = feature.cumulativeBoundaries;
  const dir = feature.directionality.toUpperCase();

  let direction: string;
  let distance: number;
  let matchedStage: number;
  let compareStage: number;
  let beyondBoundary: boolean;
  let severity: string;
  let lowerBound: number;
  let upperBound: number;
  let magnitude: number;
  let matchedBoundary: number;
  let residualDistance: number;
  let phbDevs: number;
  let shbDevs: number;
  let compare: number;

  if (dir === 'DOWNWARD' || dir === 'DOWNWARD_ONLY') {
    if (dev >= 0) {
      direction = dev === 0 ? 'NORMAL' : 'UPWARD';
      distance = dev;
      matchedStage = 0;
      compareStage = 0;
      beyondBoundary = false;
      severity = 'NORMAL';
      lowerBound = 0;
      upperBound = cumulativeBoundaries[0];
      magnitude = rawStageMagnitudes[0];
      matchedBoundary = 0;
      residualDistance = 0;
      phbDevs = 0;
      shbDevs = signedDeviation;
      compare = shbDevs - phbDevs;
    } else {
      direction = 'DOWNWARD';
      distance = Math.abs(dev);
      const stageResolution = matchApplicableStage(distance, cumulativeBoundaries);
      matchedStage = stageResolution.matchedStage;
      compareStage = stageResolution.compareStage;
      beyondBoundary = stageResolution.beyondBoundary;
      lowerBound = stageResolution.lowerBound;
      upperBound = stageResolution.upperBound;
      matchedBoundary = stageResolution.boundary;
      residualDistance = stageResolution.residualDistance;
      magnitude = matchedStage === 0 ? rawStageMagnitudes[0] : (rawStageMagnitudes[matchedStage - 1] || rawStageMagnitudes[0]);
      severity = matchedStage === 0
        ? 'NORMAL'
        : (matchedStage === 1
          ? (feature.deviationProfile.stage1?.severity || 'MILD')
          : (matchedStage === 2
            ? (feature.deviationProfile.stage2?.severity || 'MODERATE')
            : (matchedStage === 3
              ? (feature.deviationProfile.stage3?.severity || 'SEVERE')
              : (matchedStage === 4
                ? (feature.deviationProfile.stage4?.severity || 'CRITICAL')
                : (feature.deviationProfile.stage5?.severity || 'CRITICAL')))));

      phbDevs = matchedStage === 0 ? 0 : -matchedBoundary;
      shbDevs = signedDeviation;
      compare = shbDevs - phbDevs;
    }
  } else if (dir === 'UPWARD' || dir === 'UPWARD_ONLY') {
    if (dev <= 0) {
      direction = dev === 0 ? 'NORMAL' : 'DOWNWARD';
      distance = Math.abs(dev);
      matchedStage = 0;
      compareStage = 0;
      beyondBoundary = false;
      severity = 'NORMAL';
      lowerBound = 0;
      upperBound = cumulativeBoundaries[0];
      magnitude = rawStageMagnitudes[0];
      matchedBoundary = 0;
      residualDistance = 0;
      phbDevs = 0;
      shbDevs = signedDeviation;
      compare = shbDevs - phbDevs;
    } else {
      direction = 'UPWARD';
      distance = dev;
      const stageResolution = matchApplicableStage(distance, cumulativeBoundaries);
      matchedStage = stageResolution.matchedStage;
      compareStage = stageResolution.compareStage;
      beyondBoundary = stageResolution.beyondBoundary;
      lowerBound = stageResolution.lowerBound;
      upperBound = stageResolution.upperBound;
      matchedBoundary = stageResolution.boundary;
      residualDistance = stageResolution.residualDistance;
      magnitude = matchedStage === 0 ? rawStageMagnitudes[0] : (rawStageMagnitudes[matchedStage - 1] || rawStageMagnitudes[0]);
      severity = matchedStage === 0
        ? 'NORMAL'
        : (matchedStage === 1
          ? (feature.deviationProfile.stage1?.severity || 'MILD')
          : (matchedStage === 2
            ? (feature.deviationProfile.stage2?.severity || 'MODERATE')
            : (matchedStage === 3
              ? (feature.deviationProfile.stage3?.severity || 'SEVERE')
              : (matchedStage === 4
                ? (feature.deviationProfile.stage4?.severity || 'CRITICAL')
                : (feature.deviationProfile.stage5?.severity || 'CRITICAL')))));

      phbDevs = matchedStage === 0 ? 0 : matchedBoundary;
      shbDevs = signedDeviation;
      compare = shbDevs - phbDevs;
    }
  } else {
    // BIDIRECTIONAL
    if (dev === 0) {
      direction = 'NORMAL';
      distance = 0;
      matchedStage = 0;
      compareStage = 0;
      beyondBoundary = false;
      severity = 'NORMAL';
      lowerBound = 0;
      upperBound = cumulativeBoundaries[0];
      magnitude = rawStageMagnitudes[0];
      matchedBoundary = 0;
      residualDistance = 0;
      phbDevs = 0;
      shbDevs = 0;
      compare = 0;
    } else if (dev > 0) {
      direction = 'UPWARD';
      distance = dev;
      const stageResolution = matchApplicableStage(distance, cumulativeBoundaries);
      matchedStage = stageResolution.matchedStage;
      compareStage = stageResolution.compareStage;
      beyondBoundary = stageResolution.beyondBoundary;
      lowerBound = stageResolution.lowerBound;
      upperBound = stageResolution.upperBound;
      matchedBoundary = stageResolution.boundary;
      residualDistance = stageResolution.residualDistance;
      magnitude = matchedStage === 0 ? rawStageMagnitudes[0] : (rawStageMagnitudes[matchedStage - 1] || rawStageMagnitudes[0]);
      severity = matchedStage === 0
        ? 'NORMAL'
        : (matchedStage === 1
          ? (feature.deviationProfile.stage1?.severity || 'MILD')
          : (matchedStage === 2
            ? (feature.deviationProfile.stage2?.severity || 'MODERATE')
            : (matchedStage === 3
              ? (feature.deviationProfile.stage3?.severity || 'SEVERE')
              : (matchedStage === 4
                ? (feature.deviationProfile.stage4?.severity || 'CRITICAL')
                : (feature.deviationProfile.stage5?.severity || 'CRITICAL')))));

      phbDevs = matchedStage === 0 ? 0 : matchedBoundary;
      shbDevs = signedDeviation;
      compare = shbDevs - phbDevs;
    } else {
      direction = 'DOWNWARD';
      distance = Math.abs(dev);
      const stageResolution = matchApplicableStage(distance, cumulativeBoundaries);
      matchedStage = stageResolution.matchedStage;
      compareStage = stageResolution.compareStage;
      beyondBoundary = stageResolution.beyondBoundary;
      lowerBound = stageResolution.lowerBound;
      upperBound = stageResolution.upperBound;
      matchedBoundary = stageResolution.boundary;
      residualDistance = stageResolution.residualDistance;
      magnitude = matchedStage === 0 ? rawStageMagnitudes[0] : (rawStageMagnitudes[matchedStage - 1] || rawStageMagnitudes[0]);
      severity = matchedStage === 0
        ? 'NORMAL'
        : (matchedStage === 1
          ? (feature.deviationProfile.stage1?.severity || 'MILD')
          : (matchedStage === 2
            ? (feature.deviationProfile.stage2?.severity || 'MODERATE')
            : (matchedStage === 3
              ? (feature.deviationProfile.stage3?.severity || 'SEVERE')
              : (matchedStage === 4
                ? (feature.deviationProfile.stage4?.severity || 'CRITICAL')
                : (feature.deviationProfile.stage5?.severity || 'CRITICAL')))));

      phbDevs = matchedStage === 0 ? 0 : -matchedBoundary;
      shbDevs = signedDeviation;
      compare = shbDevs - phbDevs;
    }
  }

  return {
    shb: shbValue,
    dev,
    phbDevs,
    shbDevs,
    compare,
    stage: matchedStage,
    compareStage,
    beyondBoundary,
    severity,
    magnitude,
    lowerBound,
    upperBound,
    phbBaseline: feature.baseline,
    shbValue,
    shbDeviation: dev,
    deviationDistance: distance,
    direction,
    rawStageMagnitudes,
    cumulativeBoundaries,
    matchedStage,
    matchedBoundary,
    residualDistance,
    status: 'COMPUTED',
  };
}

export class CompareEngine {
  /**
   * Deterministically computes the Compare table and builds the CM_PACKET.
   * Operates purely from the two inputs: Synchronized PHB JSON and Locked SHB Session.
   * 
   * Iterates across all 11 canonical parameters in deterministic Sec No 1..11 order.
   */
  public computeComparison(
    rawPhb: SynchronizedPhbJson | NormalizedPhbDocument | PhbDocument | null,
    shb: ShbCompletedSessionCache | null,
    authenticatedUid?: string | null,
    targetOrganOverride?: string | null
  ): CompareComputationResult {
    if (!rawPhb) {
      return {
        success: false,
        cmPacket: null,
        validParameterCount: 0,
        missingParameters: ['PHB Document'],
        invalidParameters: [],
        error: 'Synchronized PHB document is missing.',
      };
    }

    if (!shb) {
      return {
        success: false,
        cmPacket: null,
        validParameterCount: 0,
        missingParameters: ['SHB Session'],
        invalidParameters: [],
        error: 'SHB locked session result is missing.',
      };
    }

    // Dynamic PHB normalization
    const normalizedPhb: NormalizedPhbDocument =
      'features' in rawPhb && rawPhb.features instanceof Map
        ? (rawPhb as any)
        : normalizePhbDocument(rawPhb);

    const phbUid = (rawPhb as any).uid || (rawPhb as any).userId || authenticatedUid || 'UNKNOWN';

    // Account Safety Check
    if (
      authenticatedUid &&
      phbUid !== 'UNKNOWN' &&
      phbUid !== authenticatedUid
    ) {
      const errorMsg = `PHB_ACCOUNT_MISMATCH: Authenticated user (${authenticatedUid}) does not match PHB cache owner (${phbUid}).`;
      terminalLogger.logPhbSyncError(authenticatedUid, 'PHB_ACCOUNT_MISMATCH', {
        authenticatedUid,
        phbUid,
      });
      return {
        success: false,
        cmPacket: null,
        validParameterCount: 0,
        missingParameters: [],
        invalidParameters: [],
        error: errorMsg,
      };
    }

    const sessionId = shb.sessionId || `session_${Date.now()}`;
    const selectedTargetOrgan = normalizeOrganTarget(targetOrganOverride || shb.targetOrgan || 'OVERALL');

    // Check cache for idempotency
    if (sessionId) {
      const cached = cmPacketCache.getCmPacket(sessionId, selectedTargetOrgan);
      if (cached && (!authenticatedUid || cached.uid === authenticatedUid)) {
        return {
          success: true,
          cmPacket: cached,
          validParameterCount: cached.validParameterCount || cached.matchedCount,
          missingParameters: cached.missingParameters,
          invalidParameters: [],
        };
      }
    }

    // Explicit Logging
    const phbLog: Record<string, number | null | string> = {};
    const shbLog: Record<string, number | null | string> = {};
    CANONICAL_COMPARE_PARAMETERS.forEach((def) => {
      const feat = normalizedPhb.features.get(def.canonicalKey);
      phbLog[def.canonicalKey] = feat ? feat.phbValue : null;
      shbLog[def.canonicalKey] = extractShbValue(shb, def.canonicalKey);
    });
    terminalLogger.logPhbJsonCache({ features: phbLog });
    terminalLogger.logShbPacket({ vitals: shbLog });

    const rows: CmParameterRow[] = [];
    const missingShbKeys: string[] = [];
    const missingPhbKeys: string[] = [];
    let validParameterCount = 0;

    // Iterate through all 11 Canonical Parameters deterministically
    for (const def of CANONICAL_COMPARE_PARAMETERS) {
      const key = def.canonicalKey;
      const phbFeature = normalizedPhb.features.get(key);
      const shbVal = extractShbValue(shb, key);

      if (!phbFeature) {
        missingPhbKeys.push(key);
      }
      if (shbVal === null) {
        missingShbKeys.push(key);
      }

      if (!phbFeature) {
        // Parameter missing in PHB
        rows.push({
          secNo: def.secNo,
          key,
          name: def.parameter,
          type: def.category,
          unit: def.unit,
          phbBaseline: null,
          shbValue: shbVal,
          deviation: null,
          deviationDistance: null,
          direction: null,
          rawStageMagnitudes: null,
          cumulativeBoundaries: null,
          matchedStage: null,
          matchedBoundary: null,
          beyondBoundary: false,
          phbDevs: null,
          shbDevs: null,
          compare: null,
          directionality: 'BIDIRECTIONAL',
          status: 'NO_PHB_REFERENCE',
          compareStage: null,
          paramKey: key,
          parameter: def.parameter,
          category: def.category === 'DV' ? 'DIRECT' : def.category === 'IV' ? 'INDIRECT' : 'CONTEXT',
          phb: null,
          shb: shbVal,
          dev: null,
          severity: 'UNKNOWN',
          stage: 'NONE',
        });
        continue;
      }

      // Unit compatibility check
      if (!isUnitCompatible(key, phbFeature.unit)) {
        rows.push({
          secNo: def.secNo,
          key,
          name: def.parameter,
          type: def.category,
          unit: phbFeature.unit || def.unit,
          phbBaseline: phbFeature.baseline,
          shbValue: shbVal,
          deviation: null,
          deviationDistance: null,
          direction: null,
          rawStageMagnitudes: phbFeature.rawStageMagnitudes,
          cumulativeBoundaries: phbFeature.cumulativeBoundaries,
          matchedStage: null,
          matchedBoundary: null,
          beyondBoundary: false,
          phbDevs: null,
          shbDevs: null,
          compare: null,
          directionality: phbFeature.directionality,
          status: 'UNIT_MISMATCH',
          compareStage: null,
          paramKey: key,
          parameter: def.parameter,
          category: def.category === 'DV' ? 'DIRECT' : def.category === 'IV' ? 'INDIRECT' : 'CONTEXT',
          phb: phbFeature.phbValue,
          shb: shbVal,
          dev: null,
          severity: 'UNKNOWN',
          stage: 'NONE',
        });
        continue;
      }

      // Feature is discovered in PHB: evaluate against SHB
      const evaluation = evaluateFeatureComparison(phbFeature, shbVal);

      // Section 14: Final CM_PACKET Consistency Validation
      let isValidParam = evaluation.status === 'COMPUTED';
      if (isValidParam) {
        const stage = evaluation.matchedStage;
        const cumBounds = phbFeature.cumulativeBoundaries;

        let consistencyPassed = true;
        if (stage === 0) {
          if (evaluation.matchedBoundary !== 0 || evaluation.phbDevs !== 0) {
            consistencyPassed = false;
          }
        } else if (typeof stage === 'number' && stage >= 1 && stage <= 5) {
          const expectedBoundary = cumBounds[stage - 1];
          if (evaluation.matchedBoundary !== expectedBoundary) {
            consistencyPassed = false;
          }
          const expectedPhbDevs = evaluation.direction === 'DOWNWARD' ? -expectedBoundary : expectedBoundary;
          if (evaluation.phbDevs !== expectedPhbDevs) {
            consistencyPassed = false;
          }
        } else {
          consistencyPassed = false;
        }

        if (evaluation.compareStage !== evaluation.matchedStage) {
          consistencyPassed = false;
        }
        if (evaluation.shbDevs !== evaluation.dev) {
          consistencyPassed = false;
        }
        if (evaluation.compare !== ((evaluation.shbDevs ?? 0) - (evaluation.phbDevs ?? 0))) {
          consistencyPassed = false;
        }

        if (!consistencyPassed) {
          isValidParam = false;
          evaluation.status = 'PHB_DEVIATION_MODEL_INVALID';
        } else {
          validParameterCount += 1;
        }
      }

      rows.push({
        secNo: def.secNo,
        key,
        name: def.parameter,
        type: def.category,
        unit: phbFeature.unit || def.unit,
        phbBaseline: phbFeature.baseline,
        shbValue: evaluation.shb,
        deviation: evaluation.dev,
        deviationDistance: evaluation.deviationDistance,
        direction: evaluation.direction,
        rawStageMagnitudes: phbFeature.rawStageMagnitudes,
        cumulativeBoundaries: phbFeature.cumulativeBoundaries,
        matchedStage: typeof evaluation.matchedStage === 'number' ? evaluation.matchedStage : null,
        matchedBoundary: evaluation.matchedBoundary,
        beyondBoundary: evaluation.beyondBoundary,
        phbDevs: evaluation.phbDevs,
        shbDevs: evaluation.shbDevs,
        compare: evaluation.compare,
        directionality: phbFeature.directionality,
        status: evaluation.status === 'COMPUTED' ? 'VALID' : (evaluation.status as any),
        compareStage: typeof evaluation.compareStage === 'number' ? evaluation.compareStage : null,
        paramKey: key,
        parameter: def.parameter,
        category: def.category === 'DV' ? 'DIRECT' : def.category === 'IV' ? 'INDIRECT' : 'CONTEXT',
        phb: phbFeature.phbValue,
        shb: evaluation.shb,
        dev: evaluation.dev,
        severity: evaluation.severity,
        stage: evaluation.stage,
      });
    }

    const cmPacket: CmPacket = {
      version: '2.0.0',
      packetType: 'CM_PACKET',
      sessionId,
      uid: phbUid,
      target: selectedTargetOrgan,
      targetOrgan: selectedTargetOrgan,
      timestamp: Date.now(),
      parameters: rows,
      validParameterCount,
      missingShbParameters: missingShbKeys,
      missingPhbParameters: missingPhbKeys,
      status: validParameterCount === CANONICAL_COMPARE_PARAMETERS.length && missingShbKeys.length === 0 && missingPhbKeys.length === 0
        ? 'COMPUTED'
        : 'INCOMPLETE',
      rows,
      totalRows: rows.length,
      matchedCount: validParameterCount,
      missingShbCount: missingShbKeys.length,
      shbOnlyCount: missingPhbKeys.length,
      missingParameters: [...missingShbKeys, ...missingPhbKeys],
    };

    // Cache CM_PACKET
    cmPacketCache.setCmPacket(cmPacket);

    // Output Authoritative [CM_PACKET] to terminal
    terminalLogger.logCmPacket(cmPacket);

    return {
      success: true,
      cmPacket,
      validParameterCount,
      missingParameters: [...missingShbKeys, ...missingPhbKeys],
      invalidParameters: [],
    };
  }
}

export const compareEngine = new CompareEngine();
