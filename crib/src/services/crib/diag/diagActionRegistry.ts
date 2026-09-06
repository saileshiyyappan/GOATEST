/**
 * DIAG Action Registry & Action Guidance Mapping
 * GOATEST - CRIB PMT-7
 *
 * Deterministic emergency action choices and their corresponding keyword guidance.
 */

import { DiagActionChoice, DiagActionId, DiagGuidanceContract } from '../../../types/diag';

export const DIAG_DEFAULT_GUIDANCE_DIRECTIVES: string[] = [
  'SIT DOWN',
  'REST',
  'BREATHE SLOWLY',
  'STAY WITH PERSON',
];

export const DIAG_ACTION_CHOICES: Record<DiagActionId, DiagActionChoice> = {
  RUN: {
    id: 'RUN',
    label: 'RUN',
    shortLabel: 'RUN',
    guidanceDirectives: ['STOP EXERTION', 'SIT DOWN', 'REST', 'BREATHE SLOWLY'],
  },
  EXERCISE: {
    id: 'EXERCISE',
    label: 'EXERCISE',
    shortLabel: 'EXERCISE',
    guidanceDirectives: ['STOP EXERTION', 'SIT DOWN', 'REST', 'BREATHE SLOWLY'],
  },
  FALL: {
    id: 'FALL',
    label: 'FALL',
    shortLabel: 'FALL',
    guidanceDirectives: ['KEEP PERSON STILL', 'CHECK RESPONSIVENESS', 'CHECK BREATHING'],
  },
  LIFT_SOMETHING_HEAVY: {
    id: 'LIFT_SOMETHING_HEAVY',
    label: 'LIFT SOMETHING HEAVY',
    shortLabel: 'HEAVY LIFT',
    guidanceDirectives: ['STOP ACTIVITY', 'SIT DOWN', 'REST', 'BREATHE SLOWLY'],
  },
  LAUGH_COUGH_HARD: {
    id: 'LAUGH_COUGH_HARD',
    label: 'LAUGH / COUGH HARD',
    shortLabel: 'COUGH/LAUGH',
    guidanceDirectives: ['REST SITTING', 'SIP WATER IF CONSCIOUS', 'BREATHE SLOWLY'],
  },
  FEEL_DIZZY: {
    id: 'FEEL_DIZZY',
    label: 'FEEL DIZZY',
    shortLabel: 'DIZZINESS',
    guidanceDirectives: ['SIT OR LIE DOWN', 'DO NOT WALK', 'STAY WITH PERSON'],
  },
  FEEL_FATIGUED: {
    id: 'FEEL_FATIGUED',
    label: 'FEEL FATIGUED',
    shortLabel: 'FATIGUE',
    guidanceDirectives: ['SIT DOWN', 'TAKE REST', 'BREATHE SLOWLY'],
  },
  SHORTNESS_OF_BREATH: {
    id: 'SHORTNESS_OF_BREATH',
    label: 'HAVE SHORTNESS OF BREATH',
    shortLabel: 'DYSPNEA',
    guidanceDirectives: ['SIT UPRIGHT', 'BREATHE SLOWLY', 'MONITOR BREATHING'],
  },
  CHEST_DISCOMFORT: {
    id: 'CHEST_DISCOMFORT',
    label: 'EXPERIENCE CHEST DISCOMFORT',
    shortLabel: 'CHEST PAIN',
    guidanceDirectives: ['SIT DOWN IMMEDIATELY', 'REST', 'CALL FOR HELP', 'DO NOT WALK'],
  },
  OTHER: {
    id: 'OTHER',
    label: 'OTHER',
    shortLabel: 'OTHER',
    guidanceDirectives: ['SIT DOWN', 'REST', 'MONITOR CONDITION', 'STAY WITH PERSON'],
  },
};

export const ALL_DIAG_ACTION_CHOICES: DiagActionChoice[] = Object.values(DIAG_ACTION_CHOICES);

export function getGuidanceForDiagAction(actionId: DiagActionId): string[] {
  return DIAG_ACTION_CHOICES[actionId]?.guidanceDirectives || DIAG_DEFAULT_GUIDANCE_DIRECTIVES;
}

export function buildDiagGuidanceContract(
  directive: string,
  directives: string[],
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL' = 'HIGH'
): DiagGuidanceContract {
  return {
    mode: 'DIAG',
    directive,
    directives,
    priority,
    timestamp: Date.now(),
  };
}
