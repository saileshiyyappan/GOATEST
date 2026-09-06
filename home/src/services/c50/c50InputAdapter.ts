/**
 * GOATEST C50 Input Adapter
 * 
 * PMT-2: Transforms CM_PACKET into C50_INPUT_PACKET.
 * 
 * MANDATES:
 * 1. Accepts existing CM_PACKET without altering COMPARE calculations.
 * 2. Preserves personalized comparison parameters:
 *    - PHB baseline
 *    - SHB value
 *    - SHB deviation
 *    - absolute deviation distance
 *    - direction
 *    - PHB raw stage magnitudes
 *    - cumulative PHB boundaries
 *    - matched stage
 *    - PHB_DEVS
 *    - SHB_DEVS
 *    - COMPARE metrics
 * 3. NO INVENTED VALUES: Missing values remain explicitly missing (undefined / null).
 * 4. STRICT VALIDATION: Rejects NaN, Infinity, and malformed inputs.
 * 5. MILESTONE SUPPORT: TEST | DAY | WEEK | MONTH.
 */

import type {
  CmPacketInput,
  C50InputPacket,
  C50DeviationFeature,
  C50StageFeature,
  MilestoneType,
} from './c50Packet';

export const C50_INPUT_ADAPTER_VERSION = '1.0.0';

/**
 * Validates that a numeric value is strictly finite and not NaN or Infinity.
 * Returns true if value is a finite number, or if value is null/undefined.
 * Returns false if value is NaN, Infinity, -Infinity, or non-numeric object/string that cannot be safely processed.
 */
export function isSafeFiniteNumber(val: unknown): boolean {
  if (val === undefined || val === null) {
    return true; // Explicitly missing is permitted
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) && !Number.isNaN(val);
  }
  return false;
}

/**
 * Recursively scans an object for illegal non-finite numbers (NaN, Infinity, -Infinity).
 * Returns the path of the first invalid field found, or null if all values are safe.
 */
export function findNonFiniteValuePath(obj: unknown, currentPath = ''): string | null {
  if (obj === null || obj === undefined) return null;

  if (typeof obj === 'number') {
    if (Number.isNaN(obj) || !Number.isFinite(obj)) {
      return currentPath || 'root';
    }
    return null;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const p = findNonFiniteValuePath(obj[i], `${currentPath}[${i}]`);
      if (p) return p;
    }
    return null;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      const p = findNonFiniteValuePath(value, nextPath);
      if (p) return p;
    }
  }

  return null;
}

export class C50InputValidationError extends Error {
  public code: string;
  constructor(message: string, code = 'INVALID_INPUT') {
    super(message);
    this.name = 'C50InputValidationError';
    this.code = code;
  }
}

export const c50InputAdapter = {
  /**
   * Transforms a CM_PACKET into a strongly typed, versioned C50_INPUT_PACKET.
   * 
   * @param cmPacket Raw CM_PACKET from COMPARE
   * @param milestoneOverride Optional milestone explicitly supplied ('TEST' | 'DAY' | 'WEEK' | 'MONTH')
   */
  adapt(cmPacket: CmPacketInput, milestoneOverride?: MilestoneType): C50InputPacket {
    if (!cmPacket || typeof cmPacket !== 'object') {
      throw new C50InputValidationError('CM_PACKET is null or not an object');
    }

    // 1. Validate required identification fields
    const sourceCmPacketId =
      cmPacket.sourceCmPacketId ||
      cmPacket.packetId ||
      cmPacket.id ||
      `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const userId = cmPacket.userId;
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new C50InputValidationError('CM_PACKET missing required userId');
    }

    const sessionId =
      cmPacket.sessionId ||
      `session_${Date.now()}`;

    const target = cmPacket.target || cmPacket.organ || 'General';

    const timestamp = cmPacket.timestamp || new Date().toISOString();

    const milestone: MilestoneType =
      milestoneOverride ||
      cmPacket.milestone ||
      'TEST';

    // 2. Deep-scan for non-finite numbers (NaN, Infinity)
    const invalidPath = findNonFiniteValuePath(cmPacket);
    if (invalidPath) {
      throw new C50InputValidationError(
        `CM_PACKET contains non-finite number (NaN or Infinity) at path: ${invalidPath}`
      );
    }

    // 3. Extract and map physiological parameters
    const physiologicalFeatures: Record<string, number | null | undefined> = {};
    const deviationFeatures: Record<string, C50DeviationFeature> = {};
    const stageFeatures: Record<string, C50StageFeature> = {};

    // Check if parameters dictionary exists in CM_PACKET
    const rawParams = cmPacket.parameters || cmPacket.metrics || {};

    for (const [paramName, paramData] of Object.entries(rawParams)) {
      if (!paramData || typeof paramData !== 'object') {
        // If it's a direct primitive number
        if (typeof paramData === 'number') {
          physiologicalFeatures[paramName] = paramData;
        } else if (paramData === null) {
          physiologicalFeatures[paramName] = null;
        }
        continue;
      }

      // Preserve raw physiological values without inventing defaults
      if (paramData.shbValue !== undefined) {
        physiologicalFeatures[paramName] = paramData.shbValue;
      } else if (paramData.value !== undefined) {
        physiologicalFeatures[paramName] = paramData.value;
      }

      // Preserve exact deviation features
      deviationFeatures[paramName] = {
        phbBaseline: paramData.phbBaseline ?? paramData.baseline ?? null,
        shbValue: paramData.shbValue ?? paramData.value ?? null,
        shbDeviation: paramData.shbDeviation ?? paramData.deviation ?? null,
        absDeviationDistance: paramData.absDeviationDistance ?? paramData.absDistance ?? null,
        direction: paramData.direction ?? null,
        phbRawStageMagnitudes: Array.isArray(paramData.phbRawStageMagnitudes)
          ? [...paramData.phbRawStageMagnitudes]
          : null,
        cumulativePhbBoundaries: Array.isArray(paramData.cumulativePhbBoundaries)
          ? [...paramData.cumulativePhbBoundaries]
          : null,
        matchedStage: paramData.matchedStage ?? null,
        phbDevs: paramData.phbDevs ?? null,
        shbDevs: paramData.shbDevs ?? null,
        compareMetrics: paramData.compareMetrics ? { ...paramData.compareMetrics } : null,
      };

      // Preserve stage features if available
      if (paramData.matchedStage !== undefined) {
        stageFeatures[paramName] = {
          matchedStage: paramData.matchedStage,
          stageConfidence: paramData.stageConfidence ?? null,
          boundaryProximity: paramData.boundaryProximity ?? null,
          stageLabel: paramData.stageLabel ?? null,
        };
      }
    }

    // 4. Generate unique C50 Input Packet ID
    const inputId = `c50_in_${milestone.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const isDevelopmentFixture = Boolean(
      cmPacket.isDevelopmentFixture ||
      cmPacket.isFixture ||
      cmPacket.source === 'DEV_FIXTURE'
    );

    const inputPacket: C50InputPacket = {
      version: C50_INPUT_ADAPTER_VERSION,
      inputId,
      sourceCmPacketId,
      userId,
      sessionId,
      target,
      timestamp,
      milestone,
      physiologicalFeatures,
      deviationFeatures,
      stageFeatures,
      sourceMetadata: {
        source: cmPacket.source || 'COMPARE_PIPELINE',
        sourceVersion: cmPacket.metadata?.version || '1.0.0',
        adapterVersion: C50_INPUT_ADAPTER_VERSION,
        isDevelopmentFixture,
        ...cmPacket.metadata,
      },
      isDevelopmentFixture,
    };

    return inputPacket;
  },
};
