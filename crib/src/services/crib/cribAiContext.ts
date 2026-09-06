/**
 * CRIB AI Context Builder
 * PMT-8: Pure consumer of structured CM_PACKET, CONDITION_RESULT, BFIT, MODE, and USER/HELPER ACTION.
 * Note: Never mutates physiological data or fabricates fake parameters.
 */

import { CribMode, CribVital, CribProbability } from '../../types/crib';
import { CmPacket, ConditionResult } from '../../types/cmPacket';
import { getGuidanceForAction as getGuidanceForSdcuAction } from './sdcu/sdcuActionRegistry';
import { SSB_STRANGER_QUESTIONS, SSB_DEFAULT_GUIDANCE_DIRECTIVES } from './ssb/ssbActionRegistry';
import { getGuidanceForDiagAction } from './diag/diagActionRegistry';

export interface CribAiContextPayload {
  mode: CribMode;
  uid: string;
  timestamp: number;
  currentVitals: Record<string, number | string>;
  conditionResult: {
    label: string;
    probability: number;
    severity?: string;
  } | null;
  probabilities: Array<{
    label: string;
    probability: number;
    status?: string;
  }>;
  bfitScore: number | null;
  currentActionOrQuestion: {
    type: 'SDCU_ACTION' | 'SSB_STRANGER_PROMPT' | 'DIAG_HELPER_ACTION' | 'NONE';
    id?: string;
    label?: string;
    question?: string;
    lastResponse?: string;
  } | null;
  deterministicDirectives: string[];
}

export class CribAiContextBuilder {
  /**
   * Builds structured AI Context payload from real CRIB data sources.
   * Only includes real, non-null values. Missing values are labeled NOT AVAILABLE or omitted.
   */
  public static buildContext(params: {
    mode: CribMode;
    uid: string;
    vitals: CribVital[];
    probabilities: CribProbability[];
    cmPacket?: CmPacket | null;
    conditionResult?: ConditionResult | null;
    actionInfo?: {
      type: 'SDCU_ACTION' | 'SSB_STRANGER_PROMPT' | 'DIAG_HELPER_ACTION' | 'NONE';
      id?: string;
      label?: string;
      question?: string;
      lastResponse?: string;
    } | null;
  }): CribAiContextPayload {
    const { mode, uid, vitals, probabilities, cmPacket, conditionResult, actionInfo } = params;

    // 1. Map only available vitals
    const currentVitals: Record<string, number | string> = {};
    for (const vital of vitals) {
      if (vital.value !== null && vital.value !== undefined) {
        currentVitals[vital.key.toUpperCase()] = `${vital.value}${vital.unit ? ` ${vital.unit}` : ''}`;
      }
    }

    // 2. Map condition result
    let condMapped: { label: string; probability: number; severity?: string } | null = null;
    if (conditionResult) {
      condMapped = {
        label: conditionResult.label || 'EVALUATING',
        probability: Math.round(
          conditionResult.probability > 1 ? conditionResult.probability : conditionResult.probability * 100
        ),
        severity: conditionResult.severity,
      };
    } else if (probabilities.length > 0) {
      condMapped = {
        label: probabilities[0].label,
        probability: probabilities[0].probability,
        severity: probabilities[0].status,
      };
    }

    // 3. Map probabilities list
    const mappedProbabilities = probabilities.map((p) => ({
      label: p.label,
      probability: p.probability,
      status: p.status,
    }));

    // 4. Extract B-FIT
    let bfitScore: number | null = null;
    if (cmPacket?.bfitResult !== undefined && cmPacket.bfitResult !== null) {
      if (typeof cmPacket.bfitResult === 'number') {
        bfitScore = cmPacket.bfitResult;
      } else if (typeof cmPacket.bfitResult === 'object' && cmPacket.bfitResult.score !== null && cmPacket.bfitResult.score !== undefined) {
        bfitScore = cmPacket.bfitResult.score;
      }
    } else {
      const bfitVital = vitals.find((v) => v.key.toLowerCase() === 'bfit');
      if (bfitVital && bfitVital.value !== null && bfitVital.value !== undefined) {
        bfitScore = typeof bfitVital.value === 'number' ? bfitVital.value : parseFloat(String(bfitVital.value));
      }
    }

    // 5. Pre-calculate deterministic fallback directives from registry
    let deterministicDirectives: string[] = [];
    if (actionInfo) {
      if (actionInfo.type === 'SDCU_ACTION' && actionInfo.id) {
        deterministicDirectives = getGuidanceForSdcuAction(actionInfo.id);
      } else if (actionInfo.type === 'SSB_STRANGER_PROMPT' && actionInfo.id) {
        const q = SSB_STRANGER_QUESTIONS[actionInfo.id];
        const resp = (actionInfo.lastResponse || 'YES').toUpperCase() as 'YES' | 'NO';
        deterministicDirectives = q?.guidanceMap?.[resp] || SSB_DEFAULT_GUIDANCE_DIRECTIVES;
      } else if (actionInfo.type === 'DIAG_HELPER_ACTION' && actionInfo.id) {
        deterministicDirectives = getGuidanceForDiagAction(actionInfo.id as any);
      }
    }

    if (deterministicDirectives.length === 0) {
      if (mode === 'SDCU') {
        deterministicDirectives = ['REST', 'BREATHE SLOWLY', 'MONITOR CONDITION'];
      } else if (mode === 'SSB') {
        deterministicDirectives = ['CHECK BREATHING', 'STAY WITH PERSON', 'CALL FOR HELP'];
      } else if (mode === 'DIAG') {
        deterministicDirectives = ['SIT DOWN', 'REST', 'STAY WITH PERSON'];
      }
    }

    return {
      mode,
      uid,
      timestamp: Date.now(),
      currentVitals,
      conditionResult: condMapped,
      probabilities: mappedProbabilities,
      bfitScore,
      currentActionOrQuestion: actionInfo || null,
      deterministicDirectives,
    };
  }

  /**
   * Formats the context into a clean, structured text prompt for the AI model.
   */
  public static formatPromptContext(context: CribAiContextPayload): string {
    const lines: string[] = [];

    lines.push(`MODE: ${context.mode}`);
    lines.push(`USER ID: ${context.uid}`);

    // Vitals
    lines.push('\nCURRENT VITALS:');
    const vitalEntries = Object.entries(context.currentVitals);
    if (vitalEntries.length > 0) {
      for (const [k, v] of vitalEntries) {
        lines.push(`${k}: ${v}`);
      }
    } else {
      lines.push('VITALS NOT AVAILABLE (SENSOR STANDBY)');
    }

    if (context.bfitScore !== null) {
      lines.push(`B-FIT SCORE: ${context.bfitScore}`);
    }

    // Condition
    lines.push('\nCONDITION ASSESSMENT:');
    if (context.conditionResult) {
      lines.push(`PRIMARY CONDITION: ${context.conditionResult.label}`);
      lines.push(`PROBABILITY: ${context.conditionResult.probability}%`);
      if (context.conditionResult.severity) {
        lines.push(`SEVERITY: ${context.conditionResult.severity.toUpperCase()}`);
      }
    } else {
      lines.push('CONDITION: EVALUATING / NOT AVAILABLE');
    }

    if (context.probabilities.length > 0) {
      lines.push('\nPROBABILITIES:');
      for (const p of context.probabilities) {
        lines.push(`- ${p.label}: ${p.probability}% (${p.status || 'NORMAL'})`);
      }
    }

    // Action/Question Context
    if (context.currentActionOrQuestion) {
      lines.push('\nCURRENT ACTION / INTERACTIVE EVENT:');
      lines.push(`EVENT TYPE: ${context.currentActionOrQuestion.type}`);
      if (context.currentActionOrQuestion.label) {
        lines.push(`ACTION: ${context.currentActionOrQuestion.label}`);
      }
      if (context.currentActionOrQuestion.question) {
        lines.push(`QUESTION: ${context.currentActionOrQuestion.question}`);
      }
      if (context.currentActionOrQuestion.lastResponse) {
        lines.push(`USER/HELPER RESPONSE: ${context.currentActionOrQuestion.lastResponse}`);
      }
    }

    return lines.join('\n');
  }
}
