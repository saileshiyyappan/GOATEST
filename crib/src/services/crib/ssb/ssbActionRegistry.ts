/**
 * SSB Stranger Questions & Helper Guidance Registry
 * GOATEST - CRIB PMT-5
 */

import { SSBQuestion, SSBGuidanceContract } from '../../../types/ssb';

export const SSB_DEFAULT_GUIDANCE_DIRECTIVES = [
  'CHECK IF THE PERSON IS RESPONSIVE',
  'KEEP THE PERSON STILL',
  'DO NOT LET THEM WALK',
  'CALL FOR HELP',
  'STAY WITH THE PERSON',
  'MONITOR BREATHING',
];

export const SSB_STRANGER_QUESTIONS: Record<string, SSBQuestion> = {
  responsive: {
    id: 'responsive',
    text: 'IS THE PERSON RESPONSIVE?',
    guidanceMap: {
      YES: [
        'KEEP THE PERSON STILL',
        'STAY WITH THE PERSON',
        'MONITOR BREATHING',
        'DO NOT LET THEM WALK',
      ],
      NO: [
        'CHECK IF THE PERSON IS RESPONSIVE',
        'CALL FOR HELP IMMEDIATELY',
        'MONITOR BREATHING',
        'STAY WITH THE PERSON',
      ],
    },
  },
  fall: {
    id: 'fall',
    text: 'DID THEY FALL?',
    guidanceMap: {
      YES: [
        'KEEP THE PERSON STILL',
        'DO NOT MOVE INJURED AREA',
        'DO NOT LET THEM WALK',
        'CALL FOR HELP',
      ],
      NO: [
        'KEEP THE PERSON STILL',
        'MONITOR BREATHING',
        'STAY WITH THE PERSON',
      ],
    },
  },
  breathing: {
    id: 'breathing',
    text: 'ARE THEY BREATHING?',
    guidanceMap: {
      YES: [
        'MONITOR BREATHING CONTINUOUSLY',
        'KEEP THE PERSON STILL',
        'STAY WITH THE PERSON',
      ],
      NO: [
        'CALL FOR HELP IMMEDIATELY',
        'ENSURE AIRWAY IS CLEAR',
        'PREPARE TO ASSIST',
        'STAY WITH THE PERSON',
      ],
    },
  },
  dizziness: {
    id: 'dizziness',
    text: 'DID THEY COMPLAIN OF DIZZINESS?',
    guidanceMap: {
      YES: [
        'KEEP THE PERSON SEATED OR LYING DOWN',
        'DO NOT LET THEM WALK',
        'STAY WITH THE PERSON',
      ],
      NO: [
        'KEEP THE PERSON STILL',
        'MONITOR BREATHING',
      ],
    },
  },
  consciousness: {
    id: 'consciousness',
    text: 'DID THEY LOSE CONSCIOUSNESS?',
    guidanceMap: {
      YES: [
        'CALL FOR HELP',
        'KEEP THE PERSON STILL',
        'MONITOR BREATHING',
        'STAY WITH THE PERSON',
      ],
      NO: [
        'KEEP THE PERSON STILL',
        'DO NOT LET THEM WALK',
        'MONITOR VITALS',
      ],
    },
  },
  difficulty_breathing: {
    id: 'difficulty_breathing',
    text: 'ARE THEY HAVING DIFFICULTY BREATHING?',
    guidanceMap: {
      YES: [
        'HELP PERSON SIT UPRIGHT',
        'LOOSEN TIGHT CLOTHING',
        'CALL FOR HELP',
        'STAY WITH THE PERSON',
      ],
      NO: [
        'MONITOR BREATHING',
        'KEEP THE PERSON STILL',
      ],
    },
  },
  injury: {
    id: 'injury',
    text: 'IS THERE AN INJURY?',
    guidanceMap: {
      YES: [
        'DO NOT MOVE INJURED AREA',
        'CALL FOR HELP',
        'KEEP THE PERSON STILL',
      ],
      NO: [
        'KEEP THE PERSON STILL',
        'STAY WITH THE PERSON',
      ],
    },
  },
};

/**
 * Deterministically select a stranger question based on context or index
 */
export function selectStrangerQuestion(context?: {
  reason?: string | null;
  index?: number;
}): SSBQuestion {
  if (context?.reason) {
    const r = context.reason.toUpperCase();
    if (r.includes('FALL')) return SSB_STRANGER_QUESTIONS.fall;
    if (r.includes('RESPIRAT') || r.includes('BREATH')) return SSB_STRANGER_QUESTIONS.difficulty_breathing;
    if (r.includes('DIZZY') || r.includes('AUTONOMIC')) return SSB_STRANGER_QUESTIONS.dizziness;
    if (r.includes('UNCONSCIOUS') || r.includes('SYNCOPE')) return SSB_STRANGER_QUESTIONS.consciousness;
    if (r.includes('CARDIAC') || r.includes('COLLAPSE')) return SSB_STRANGER_QUESTIONS.responsive;
  }

  const keys = Object.keys(SSB_STRANGER_QUESTIONS);
  const idx = (context?.index ?? 0) % keys.length;
  return SSB_STRANGER_QUESTIONS[keys[idx]];
}

export function buildSSBGuidanceContract(
  directive: string,
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL' = 'HIGH'
): SSBGuidanceContract {
  return {
    mode: 'SSB',
    audience: 'HELPER',
    directive,
    priority,
    timestamp: Date.now(),
  };
}
