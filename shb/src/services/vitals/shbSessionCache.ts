import {
  OrganCategoryId,
  DirectVitalItem,
  IndirectVitalItem,
  BFitStatusDisplay,
  ShbFinalResultPacket,
  LiveVitalsState,
  LockedVitalsSnapshot,
} from '../../types/shb';
import {
  CANONICAL_PARAMETER_DEFINITIONS,
  CanonicalParameterKey,
} from '../../types/physiologicalRegistry';

export interface ShbCompletedSessionCache {
  sessionId: string;
  targetOrgan: OrganCategoryId;
  acquisitionDuration: number;
  completedAt: number;
  directVitals: Record<string, DirectVitalItem>;
  indirectVitals: Record<string, IndirectVitalItem>;
  lockedDirectVitals?: {
    hr?: number | null;
    heartRate?: number | null;
    spo2?: number | null;
    ppi?: number | null;
    // Compatibility aliases
    temp?: number | null;
    accel?: number | null;
  };
  lockedIndirectVitals?: {
    rmssd?: number | null;
    sdnn?: number | null;
    rr?: number | null;
    respiratoryRate?: number | null;
  };
  lockedContextVariables?: {
    activityIntensity?: number | null;
    ambientTemperature?: number | null;
    relativeHumidity?: number | null;
    atmosphericPressure?: number | null;
    altitude?: number | null;
  };
  bfit?: BFitStatusDisplay;
  sessionStatus?: 'COMPLETED' | 'LOCKED';
  finalResultPacket?: ShbFinalResultPacket | null;
  lockedVitals?: LockedVitalsSnapshot;
}

export interface LockValidationResult {
  isValid: boolean;
  missingVitals: string[];
}

class ShbSessionCacheService {
  private activeSessionResult: ShbCompletedSessionCache | null = null;

  /**
   * Stores completed SHB session in the backend/session cache
   */
  public setSession(result: ShbCompletedSessionCache): void {
    this.activeSessionResult = { ...result };
  }

  /**
   * Retrieves the current cached SHB session result for Compare pipeline
   */
  public getSession(): ShbCompletedSessionCache | null {
    return this.activeSessionResult ? { ...this.activeSessionResult } : null;
  }

  /**
   * Checks if a valid cached session exists
   */
  public hasSession(): boolean {
    return this.activeSessionResult !== null;
  }

  /**
   * Clears the temporary completed-session cache upon session termination/exit
   */
  public clear(): void {
    this.activeSessionResult = null;
  }
}

export const shbSessionCache = new ShbSessionCacheService();

/**
 * Validates that required DV and IV parameters are properly locked,
 * present, valid, finite numbers according to the canonical SHB pipeline.
 */
export function validateShbVitalsLock(
  vitalsState: LiveVitalsState,
  targetOrgan: OrganCategoryId = 'OVERALL'
): LockValidationResult {
  const missingVitals: string[] = [];

  const lockedSnapshot = vitalsState.lockedVitals;
  const canonicalKeys = [
    'heartRate', 'spo2', 'ppi', 'rmssd', 'sdnn', 'respiratoryRate',
    'activityIntensity', 'ambientTemperature', 'relativeHumidity',
    'atmosphericPressure', 'altitude',
  ] as const;
  if (!lockedSnapshot || !canonicalKeys.every((key) => Number.isFinite(lockedSnapshot[key]))) {
    missingVitals.push(...canonicalKeys.filter((key) => !lockedSnapshot || !Number.isFinite(lockedSnapshot[key])));
  }

  // Required DVs: hr, spo2, ppi
  const requiredDvKeys = ['hr', 'spo2', 'ppi'];
  for (const key of requiredDvKeys) {
    const item = vitalsState.directVitals[key];
    if (!item) {
      missingVitals.push(`DV: ${key.toUpperCase()}`);
      continue;
    }

    const lockedVal = item.lockedValue;
    const isLockedStatus = item.status === 'LOCKED';
    const isNumeric = typeof lockedVal === 'number' && Number.isFinite(lockedVal);

    if (!isLockedStatus || !isNumeric) {
      missingVitals.push(item.label || item.shortCode || key.toUpperCase());
    }
  }

  // Required IVs: rmssd, sdnn, rr
  const requiredIvKeys = ['rmssd', 'sdnn', 'rr'];
  for (const key of requiredIvKeys) {
    const item = vitalsState.indirectVitals[key];
    if (!item) {
      missingVitals.push(`IV: ${key.toUpperCase()}`);
      continue;
    }

    const lockedVal = item.lockedValue ?? item.value;
    const isLockedStatus = item.status === 'LOCKED';
    const isNumeric = typeof lockedVal === 'number' && Number.isFinite(lockedVal);

    if (!isLockedStatus || !isNumeric) {
      missingVitals.push(item.label || item.shortCode || key.toUpperCase());
    }
  }

  return {
    isValid: missingVitals.length === 0 && Boolean(lockedSnapshot?.lockComplete && lockedSnapshot.lockedCount === 11),
    missingVitals,
  };
}
