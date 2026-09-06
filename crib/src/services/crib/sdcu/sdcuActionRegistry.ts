/**
 * SDCU Action Question Registry and Predefined Action Guidance Mappings
 * GOATEST - CRIB PMT-4
 *
 * Deterministic selection based on available context. No Math.random().
 */

import { SDCUActionQuestion } from '../../../types/sdcu';
import { CribInputState } from '../../../types/cribInput';

export const SDCU_ACTION_QUESTIONS: Record<string, SDCUActionQuestion> = {
  RUNNING: {
    id: 'activity_running',
    text: 'DID YOU RUN?',
    category: 'ACTIVITY',
    timeoutMs: 10000,
    guidanceKey: 'FAST RUNNING',
  },
  EXERCISE: {
    id: 'activity_exercise',
    text: 'DID YOU EXERCISE?',
    category: 'ACTIVITY',
    timeoutMs: 10000,
    guidanceKey: 'EXERCISE',
  },
  HEAVY_LIFT: {
    id: 'activity_heavy_lift',
    text: 'DID YOU LIFT SOMETHING HEAVY?',
    category: 'ACTIVITY',
    timeoutMs: 10000,
    guidanceKey: 'HEAVY LIFT',
  },
  STAIRS: {
    id: 'activity_stairs',
    text: 'DID YOU CLIMB STAIRS?',
    category: 'ACTIVITY',
    timeoutMs: 10000,
    guidanceKey: 'STAIRS',
  },
  WALK_FAST: {
    id: 'activity_walk_fast',
    text: 'DID YOU WALK FAST?',
    category: 'ACTIVITY',
    timeoutMs: 10000,
    guidanceKey: 'FAST RUNNING',
  },
  LAUGH_HARD: {
    id: 'activity_laugh_hard',
    text: 'DID YOU LAUGH HARD?',
    category: 'PHYSIOLOGICAL',
    timeoutMs: 10000,
    guidanceKey: 'LAUGH_HARD',
  },
  DIZZY: {
    id: 'symptom_dizzy',
    text: 'DID YOU FEEL DIZZY?',
    category: 'SYMPTOM',
    timeoutMs: 10000,
    guidanceKey: 'DIZZY',
  },
  FALL: {
    id: 'symptom_fall',
    text: 'DID YOU FALL?',
    category: 'SYMPTOM',
    timeoutMs: 10000,
    guidanceKey: 'FALL',
  },
  FATIGUED: {
    id: 'symptom_fatigued',
    text: 'DID YOU FEEL FATIGUED?',
    category: 'SYMPTOM',
    timeoutMs: 10000,
    guidanceKey: 'FATIGUE',
  },
  SHORT_OF_BREATH: {
    id: 'symptom_short_of_breath',
    text: 'DID YOU FEEL SHORT OF BREATH?',
    category: 'SYMPTOM',
    timeoutMs: 10000,
    guidanceKey: 'SHORT OF BREATH',
  },
};

/**
 * Predefined Action-to-Guidance Directives mapping
 */
export const ACTION_GUIDANCE_MAP: Record<string, string[]> = {
  FATIGUE: ['SIT DOWN', 'TAKE REST', 'BREATHE SLOWLY'],
  'HEAVY LIFT': ['STOP ACTIVITY', 'SIT DOWN', 'REST'],
  'FAST RUNNING': ['STOP ACTIVITY', 'BREATHE SLOWLY', 'TAKE REST'],
  RUNNING: ['STOP ACTIVITY', 'BREATHE SLOWLY', 'TAKE REST'],
  EXERCISE: ['STOP ACTIVITY', 'REST', 'BREATHE SLOWLY'],
  DIZZY: ['SIT DOWN', 'KEEP HEAD ELEVATED', 'REST'],
  FALL: ['DO NOT MOVE SUDDENLY', 'STAY SEATED', 'CALL HELP'],
  'SHORT OF BREATH': ['SIT UPRIGHT', 'BREATHE SLOWLY', 'REST'],
  STAIRS: ['PAUSE ON STEP/LANDING', 'SIT DOWN', 'REST'],
  LAUGH_HARD: ['TAKE DEEP BREATHS', 'REST', 'SIT DOWN'],
};

/**
 * Deterministically select an appropriate verification question based on context.
 */
export function selectDeterministicQuestion(
  context?: {
    conditionLabel?: string | null;
    cribState?: CribInputState | null;
    forcedQuestionKey?: string;
  }
): SDCUActionQuestion {
  if (context?.forcedQuestionKey && SDCU_ACTION_QUESTIONS[context.forcedQuestionKey]) {
    return SDCU_ACTION_QUESTIONS[context.forcedQuestionKey];
  }

  const label = context?.conditionLabel?.toUpperCase() || '';
  const crib = context?.cribState;

  if (label.includes('RESPIRATORY') || label.includes('HYPOXIC') || label.includes('BREATH')) {
    return SDCU_ACTION_QUESTIONS.SHORT_OF_BREATH;
  }
  if (label.includes('AUTONOMIC') || label.includes('COLLAPSE') || label.includes('DIZZY')) {
    return SDCU_ACTION_QUESTIONS.DIZZY;
  }
  if (label.includes('FATIGUE')) {
    return SDCU_ACTION_QUESTIONS.FATIGUED;
  }
  if (label.includes('CARDIAC') || label.includes('STRESS')) {
    return SDCU_ACTION_QUESTIONS.RUNNING;
  }

  // Check vitals if present
  if (crib?.vitals) {
    const hrVital = crib.vitals.find((v) => v.key === 'hr')?.value;
    const motionVital = crib.vitals.find((v) => v.key === 'motion')?.value;
    const rrVital = crib.vitals.find((v) => v.key === 'rr')?.value;

    if (typeof motionVital === 'number' && motionVital > 0.05) {
      return SDCU_ACTION_QUESTIONS.RUNNING;
    }
    if (typeof hrVital === 'number' && hrVital > 100) {
      return SDCU_ACTION_QUESTIONS.RUNNING;
    }
    if (typeof rrVital === 'number' && (rrVital > 22 || rrVital < 10)) {
      return SDCU_ACTION_QUESTIONS.SHORT_OF_BREATH;
    }
  }

  // Default general verification question
  return SDCU_ACTION_QUESTIONS.RUNNING;
}

/**
 * Resolves guidance directives for a confirmed action
 */
export function getGuidanceForAction(actionKey: string): string[] {
  const normalized = actionKey.toUpperCase().trim();
  const directMatch = ACTION_GUIDANCE_MAP[normalized];
  if (directMatch && directMatch.length > 0) {
    return [...directMatch];
  }

  // Check substring matches
  for (const [key, directives] of Object.entries(ACTION_GUIDANCE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return [...directives];
    }
  }

  return ['WAITING FOR GUIDANCE'];
}
