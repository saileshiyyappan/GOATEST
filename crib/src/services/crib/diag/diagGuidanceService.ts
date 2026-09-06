/**
 * DIAG Emergency Guidance Service
 * GOATEST - CRIB PMT-7
 *
 * Produces structured AI guidance context and concise emergency keywords
 * based on live physiological data, condition results, and selected helper actions.
 */

import { CribInputState } from '../../../types/cribInput';
import { DiagActionId, DiagActionResponsePayload } from '../../../types/diag';
import { getGuidanceForDiagAction, DIAG_DEFAULT_GUIDANCE_DIRECTIVES } from './diagActionRegistry';

export interface DiagAiContext {
  mode: 'DIAG';
  sessionId: string | null;
  timestamp: number;
  conditionResult: {
    label: string;
    probability: number;
    severity: string;
  } | null;
  bfitResult: number | null;
  selectedAction: DiagActionResponsePayload | null;
  currentVitals: Record<string, number | string | null>;
  freshness: string;
}

export class DiagGuidanceService {
  /**
   * Builds structured AI context for DIAG mode consumption
   */
  public static buildAiContext(
    inputState: CribInputState | null,
    selectedAction: DiagActionResponsePayload | null
  ): DiagAiContext {
    const vitalsMap: Record<string, number | string | null> = {};
    if (inputState?.vitals) {
      for (const v of inputState.vitals) {
        vitalsMap[v.key] = v.value;
      }
    }

    return {
      mode: 'DIAG',
      sessionId: inputState?.sessionId || null,
      timestamp: Date.now(),
      conditionResult: inputState?.conditionResult
        ? {
            label: inputState.conditionResult.label,
            probability: inputState.conditionResult.probability,
            severity: inputState.conditionResult.severity,
          }
        : null,
      bfitResult: inputState?.bfitResult ?? null,
      selectedAction: selectedAction ? { ...selectedAction } : null,
      currentVitals: vitalsMap,
      freshness: inputState?.freshness || 'NO_PACKET',
    };
  }

  /**
   * Generates concise keyword guidance for emergency display
   */
  public static generateEmergencyDirectives(
    actionId: DiagActionId | null,
    conditionSeverity?: string
  ): string[] {
    if (actionId) {
      const baseDirectives = getGuidanceForDiagAction(actionId);
      if (conditionSeverity === 'critical') {
        return ['CALL FOR HELP', ...baseDirectives];
      }
      return baseDirectives;
    }

    if (conditionSeverity === 'critical') {
      return ['CALL FOR HELP', 'KEEP PERSON STILL', 'CHECK RESPONSIVENESS', 'CHECK BREATHING'];
    }

    return [...DIAG_DEFAULT_GUIDANCE_DIRECTIVES];
  }
}
