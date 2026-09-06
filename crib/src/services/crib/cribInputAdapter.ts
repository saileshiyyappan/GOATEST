/**
 * CRIB Input Adapter
 * GOATEST - CRIB PMT-3
 *
 * Responsibility:
 *   CM_PACKET -> CribInputState
 *
 * Core Principles:
 *   1. COMPARE is the single source of truth; CRIB is a consumer.
 *   2. Never recalculate DEV, PHB_DEVS, SHB_DEVS, COMPARE, MATCHED STAGE inside CRIB.
 *   3. Never fabricate fake values or estimate vitals.
 *   4. Strictly enforce UID isolation & session binding.
 *   5. Preserve target & comparison summary for downstream systems.
 *   6. Provide clear state flow (INITIALIZING, WAITING_FOR_SHB, WAITING_FOR_COMPARE, CM_PACKET_READY, etc.)
 *   7. Zero raw packet mutation.
 *   8. Strict minimal logging: [CRIB_INPUT] and [CRIB_INPUT_ERROR].
 */

import { CribVital, CribProbability, VitalStatus } from '../../types/crib';
import { CmPacket, CmPacketParameterRow, ConditionResult } from '../../types/cmPacket';
import {
  CribInputState,
  AdaptCmPacketOptions,
  CribAdapterStatus,
  CribFreshnessStatus,
  CribCompareParameterSummary,
  CribCompareSummaryState,
} from '../../types/cribInput';

/**
 * Standard ordered physiological vital schema definitions
 */
interface VitalDefinition {
  cmKey: string;
  vitalKey: string;
  label: string;
  shortLabel: string;
  unit: string;
}

const VITAL_DEFINITIONS: VitalDefinition[] = [
  { cmKey: 'heartRate', vitalKey: 'hr', label: 'HR', shortLabel: 'HR', unit: 'bpm' },
  { cmKey: 'spo2', vitalKey: 'spo2', label: 'SpO2', shortLabel: 'SpO2', unit: '%' },
  { cmKey: 'ppi', vitalKey: 'ppi', label: 'PPI', shortLabel: 'PPI', unit: 'ms' },
  { cmKey: 'rmssd', vitalKey: 'rmssd', label: 'RMSSD', shortLabel: 'RMSSD', unit: 'ms' },
  { cmKey: 'sdnn', vitalKey: 'sdnn', label: 'SDNN', shortLabel: 'SDNN', unit: 'ms' },
  { cmKey: 'respiratoryRate', vitalKey: 'rr', label: 'RR', shortLabel: 'RR', unit: '/min' },
  { cmKey: 'skinTemperature', vitalKey: 'temp', label: 'TEMP', shortLabel: 'TEMP', unit: '°C' },
  { cmKey: 'motionVector', vitalKey: 'motion', label: 'MOTION', shortLabel: 'MOTION', unit: 'g' },
  { cmKey: 'arterialO2Content', vitalKey: 'o2', label: 'O2', shortLabel: 'O2', unit: '' },
  { cmKey: 'metabolicActivityIndex', vitalKey: 'mai', label: 'MAI', shortLabel: 'MAI', unit: '' },
];

/**
 * Creates an empty/initial CRIB vital row with null value
 */
function createEmptyVital(def: VitalDefinition): CribVital {
  return {
    key: def.vitalKey,
    label: def.label,
    shortLabel: def.shortLabel,
    value: null,
    unit: def.unit,
    status: 'unknown',
  };
}

/**
 * Default empty vitals template
 */
export function getDefaultCribVitals(): CribVital[] {
  const list = VITAL_DEFINITIONS.map(createEmptyVital);
  // Optional B-FIT slot initially null
  list.push({
    key: 'bfit',
    label: 'B-FIT',
    shortLabel: 'B-FIT',
    value: null,
    unit: '',
    status: 'unknown',
  });
  return list;
}

/**
 * Helper to normalize parameters from either Record or Array format
 */
function normalizeParameterRows(
  parameters: Record<string, CmPacketParameterRow> | CmPacketParameterRow[] | undefined | null
): Map<string, CmPacketParameterRow> {
  const map = new Map<string, CmPacketParameterRow>();
  if (!parameters) return map;

  if (Array.isArray(parameters)) {
    for (const row of parameters) {
      if (row && row.parameter) {
        map.set(row.parameter.toLowerCase(), row);
      }
    }
  } else if (typeof parameters === 'object') {
    for (const [key, row] of Object.entries(parameters)) {
      if (row && typeof row === 'object') {
        const paramKey = (row.parameter || key).toLowerCase();
        map.set(paramKey, { ...row, parameter: row.parameter || key });
      }
    }
  }

  return map;
}

/**
 * Maps Compare status or deviation to CRIB VitalStatus
 */
function deriveVitalStatus(row: CmPacketParameterRow | undefined): VitalStatus {
  if (!row) return 'unknown';
  if (row.status === 'MISSING_SHB_VALUE' || row.shbValue === null || row.shbValue === undefined) {
    return 'unknown';
  }

  const statusStr = String(row.status || '').toUpperCase();
  if (statusStr.includes('CRITICAL') || statusStr.includes('ALERT')) {
    return 'critical';
  }
  if (statusStr.includes('WARNING') || statusStr.includes('ELEVATED') || statusStr.includes('LOW')) {
    return 'warning';
  }

  if (typeof row.compare === 'number') {
    const absComp = Math.abs(row.compare);
    if (absComp >= 3.0) return 'critical';
    if (absComp >= 2.0) return 'warning';
  }

  return 'normal';
}

/**
 * Primary CRIB Input Adapter function:
 * CM_PACKET + CONDITION RESULT -> CribInputState
 */
export function adaptCmPacketToCribState(options: AdaptCmPacketOptions): CribInputState {
  const {
    packet,
    conditionResult,
    authenticatedUid,
    maxStaleAgeMs = 60_000,
    currentTime = Date.now(),
  } = options;

  // 1. Check Authentication
  if (authenticatedUid === null || authenticatedUid === undefined) {
    return {
      sessionId: null,
      uid: null,
      timestamp: null,
      target: 'OVERALL',
      vitals: getDefaultCribVitals(),
      compareSummary: null,
      conditionResult: null,
      probabilities: [],
      bfitResult: null,
      status: 'WAITING_FOR_AUTHENTICATION',
      freshness: 'UNAVAILABLE',
    };
  }

  // 2. Check Packet Presence
  if (!packet) {
    return {
      sessionId: null,
      uid: authenticatedUid,
      timestamp: null,
      target: 'OVERALL',
      vitals: getDefaultCribVitals(),
      compareSummary: null,
      conditionResult: null,
      probabilities: [],
      bfitResult: null,
      status: 'WAITING_FOR_COMPARE',
      freshness: 'UNAVAILABLE',
    };
  }

  // 3. Security: UID Isolation Check
  if (packet.uid && packet.uid !== authenticatedUid) {
    console.error(`[CRIB_INPUT_ERROR] Security rejection: packet UID (${packet.uid}) does not match authenticated user (${authenticatedUid})`);
    return {
      sessionId: packet.sessionId || null,
      uid: authenticatedUid,
      timestamp: packet.timestamp || null,
      target: packet.target || 'OVERALL',
      vitals: getDefaultCribVitals(),
      compareSummary: null,
      conditionResult: null,
      probabilities: [],
      bfitResult: null,
      status: 'ERROR',
      freshness: 'UNAVAILABLE',
      errorMessage: 'UID mismatch: rejected packet',
    };
  }

  // 4. Validate packet structure
  if (!packet.sessionId || typeof packet.timestamp !== 'number' || isNaN(packet.timestamp)) {
    console.error('[CRIB_INPUT_ERROR] Malformed CM_PACKET structure: missing sessionId or invalid timestamp');
    return {
      sessionId: packet.sessionId || null,
      uid: authenticatedUid,
      timestamp: packet.timestamp || null,
      target: packet.target || 'OVERALL',
      vitals: getDefaultCribVitals(),
      compareSummary: null,
      conditionResult: null,
      probabilities: [],
      bfitResult: null,
      status: 'ERROR',
      freshness: 'UNAVAILABLE',
      errorMessage: 'Malformed CM_PACKET structure',
    };
  }

  // 5. Stale Packet Calculation
  const packetAge = currentTime - packet.timestamp;
  let freshness: CribFreshnessStatus = 'LIVE';
  let adapterStatus: CribAdapterStatus = 'CM_PACKET_READY';

  if (packetAge < 0) {
    freshness = 'LIVE';
  } else if (packetAge > maxStaleAgeMs) {
    freshness = 'STALE';
    adapterStatus = 'STALE_DATA';
  } else if (packetAge > 20_000) {
    freshness = 'RECENT';
  } else {
    freshness = 'LIVE';
  }

  // 6. Target Support (preserve target, default 'OVERALL')
  const target = packet.target || 'OVERALL';

  // 7. Normalize Parameter Map
  const paramMap = normalizeParameterRows(packet.parameters);

  // 8. Map Vitals from CM_PACKET (Compiles only real values, never fabricates)
  const mappedVitals: CribVital[] = [];
  const compareSummaries: CribCompareParameterSummary[] = [];
  let computedCount = 0;

  for (const def of VITAL_DEFINITIONS) {
    const row = paramMap.get(def.cmKey.toLowerCase());

    if (row && (row.status === 'COMPUTED' || (typeof row.shbValue === 'number' && !isNaN(row.shbValue)))) {
      const numericVal = row.shbValue;
      const isValidNumber = typeof numericVal === 'number' && !isNaN(numericVal);

      mappedVitals.push({
        key: def.vitalKey,
        label: def.label,
        shortLabel: def.shortLabel,
        value: isValidNumber ? numericVal : null,
        unit: row.unit || def.unit,
        status: deriveVitalStatus(row),
      });

      if (isValidNumber) {
        computedCount++;
      }

      // Preserve structured compare summary for downstream systems
      compareSummaries.push({
        parameter: def.cmKey,
        label: def.label,
        phbBaseline: typeof row.phbBaseline === 'number' ? row.phbBaseline : null,
        shbValue: isValidNumber ? numericVal : null,
        deviation: typeof row.deviation === 'number' ? row.deviation : null,
        direction: row.direction || 'STABLE',
        matchedStage: row.matchedStage ?? null,
        compare: typeof row.compare === 'number' ? row.compare : null,
        status: row.status || 'COMPUTED',
        unit: row.unit || def.unit,
      });
    } else {
      // Missing or uncomputed vital
      mappedVitals.push(createEmptyVital(def));

      if (row) {
        compareSummaries.push({
          parameter: def.cmKey,
          label: def.label,
          phbBaseline: typeof row.phbBaseline === 'number' ? row.phbBaseline : null,
          shbValue: null,
          deviation: null,
          direction: 'UNKNOWN',
          matchedStage: row.matchedStage ?? null,
          compare: null,
          status: row.status || 'MISSING_SHB_VALUE',
          unit: def.unit,
        });
      }
    }
  }

  // 9. B-FIT Handling: only if a REAL B-FIT result exists
  let realBfitScore: number | null = null;
  if (packet.bfitResult !== undefined && packet.bfitResult !== null) {
    if (typeof packet.bfitResult === 'number' && !isNaN(packet.bfitResult)) {
      realBfitScore = packet.bfitResult;
    } else if (typeof packet.bfitResult === 'object' && typeof packet.bfitResult.score === 'number' && !isNaN(packet.bfitResult.score)) {
      realBfitScore = packet.bfitResult.score;
    }
  }

  mappedVitals.push({
    key: 'bfit',
    label: 'B-FIT',
    shortLabel: 'B-FIT',
    value: realBfitScore,
    unit: '',
    status: realBfitScore !== null ? 'normal' : 'unknown',
  });

  // 10. Compare Summary State
  const compareSummaryState: CribCompareSummaryState = {
    parameters: compareSummaries,
    computedCount,
    totalCount: VITAL_DEFINITIONS.length,
    matchedStage: packet.compareSummary?.matchedStage ?? null,
    summaryText: packet.compareSummary?.summaryText,
  };

  // 11. Condition Result & Probabilities Adapter
  let adaptedCondition: ConditionResult | null = null;
  let probabilities: CribProbability[] = [];

  if (conditionResult && conditionResult.label && typeof conditionResult.label === 'string') {
    adaptedCondition = {
      label: conditionResult.label,
      probability: typeof conditionResult.probability === 'number' ? conditionResult.probability : null,
      severity: conditionResult.severity || 'unknown',
      timestamp: conditionResult.timestamp || packet.timestamp,
      patterns: conditionResult.patterns || [],
      summary: conditionResult.summary,
    };

    if (conditionResult.patterns && conditionResult.patterns.length > 0) {
      probabilities = conditionResult.patterns.map((p) => ({
        id: p.id,
        label: p.name,
        probability: typeof p.probability === 'number' ? p.probability : null,
        status: (p.status as any) || (p.probability >= 75 ? 'critical' : p.probability >= 40 ? 'high' : 'low'),
      }));
    } else if (conditionResult.label && conditionResult.probability !== null) {
      probabilities = [
        {
          id: 'primary-condition',
          label: conditionResult.label,
          probability: conditionResult.probability,
          status: conditionResult.severity === 'critical' ? 'critical' : conditionResult.severity === 'high' ? 'high' : 'moderate',
        },
      ];
    }

    if (adapterStatus === 'CM_PACKET_READY') {
      adapterStatus = 'CONDITION_READY';
    }
  } else {
    // Condition is not yet available; do NOT fabricate fake values
    if (adapterStatus === 'CM_PACKET_READY') {
      adapterStatus = 'CONDITION_PENDING';
    }
  }

  // 12. Minimal Terminal Logging (Strict Rule: at most one concise line)
  const conditionLabel = adaptedCondition ? `${adaptedCondition.label} (${adaptedCondition.probability}%)` : 'PENDING';
  console.info(`[CRIB_INPUT] sessionId=${packet.sessionId} parameters=${computedCount} condition=${conditionLabel} status=${adapterStatus}`);

  return {
    sessionId: packet.sessionId,
    uid: authenticatedUid,
    timestamp: packet.timestamp,
    target,
    vitals: mappedVitals,
    compareSummary: compareSummaryState,
    conditionResult: adaptedCondition,
    probabilities,
    bfitResult: realBfitScore,
    status: adapterStatus,
    freshness,
  };
}
