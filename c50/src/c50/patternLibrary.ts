import { StageValue } from './types';
import { StageVector } from './evaluator';
import { PRNG } from './prng';

export interface PatternLibrary {
  patterns: StageVector[];
  patternsByComplexity: Map<number, StageVector[]>;
  patternSet: Set<string>;
  totalUnique: number;
}

export function vectorToKey(v: StageVector): string {
  return v.join(',');
}

export function keyToVector(k: string): StageVector {
  return k.split(',').map((x) => parseInt(x, 10) as StageValue) as StageVector;
}

/**
 * Builds a deterministic, rich pattern library containing >= 5,000 unique 11-stage patterns
 * covering all active complexity levels from 0 to 11 and all stages 0..5 across every parameter.
 */
export function buildPatternLibrary(seed: number = 42): PatternLibrary {
  const prng = new PRNG(seed);
  const patternSet = new Set<string>();

  const addPattern = (v: StageVector) => {
    patternSet.add(vectorToKey(v));
  };

  // 1. Complexity 0: Normal baseline (1 pattern)
  addPattern([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // 2. Complexity 1: Single-parameter variations across all 11 features and stages 1..5 (55 patterns)
  for (let paramIdx = 0; paramIdx < 11; paramIdx++) {
    for (let stage = 1; stage <= 5; stage++) {
      const v: StageValue[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      v[paramIdx] = stage as StageValue;
      addPattern(v as StageVector);
    }
  }

  // 3. Complexity 2: Two-parameter combinations across all 55 pairs (1,375 patterns)
  for (let i = 0; i < 11; i++) {
    for (let j = i + 1; j < 11; j++) {
      for (let s1 = 1; s1 <= 5; s1++) {
        for (let s2 = 1; s2 <= 5; s2++) {
          const v: StageValue[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          v[i] = s1 as StageValue;
          v[j] = s2 as StageValue;
          addPattern(v as StageVector);
        }
      }
    }
  }

  // Helper to sample structured combinations for complexities 3..11
  const generateCombosForComplexity = (
    activeCount: number,
    targetCount: number,
    prngInstance: PRNG
  ) => {
    let attempts = 0;
    const maxAttempts = targetCount * 60;
    const initialSize = patternSet.size;

    while (patternSet.size - initialSize < targetCount && attempts < maxAttempts) {
      attempts++;
      // Pick activeCount distinct parameter indices
      const indices: number[] = [];
      while (indices.length < activeCount) {
        const idx = prngInstance.nextInt(0, 10);
        if (!indices.includes(idx)) indices.push(idx);
      }

      const v: StageValue[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const severityProfile = prngInstance.pick([
        'control',
        'mild',
        'high',
        'risk',
        'heterogeneous',
        'ascending',
        'descending',
      ]);

      indices.forEach((idx, orderIdx) => {
        let stage: StageValue;
        if (severityProfile === 'control') {
          stage = prngInstance.pick([1, 2]);
        } else if (severityProfile === 'mild') {
          stage = prngInstance.pick([2, 3]);
        } else if (severityProfile === 'high') {
          stage = prngInstance.pick([3, 4, 5]);
        } else if (severityProfile === 'risk') {
          stage = prngInstance.pick([4, 5]);
        } else if (severityProfile === 'ascending') {
          stage = Math.min(5, Math.max(1, (orderIdx % 5) + 1)) as StageValue;
        } else if (severityProfile === 'descending') {
          stage = Math.min(5, Math.max(1, 5 - (orderIdx % 5))) as StageValue;
        } else {
          stage = prngInstance.pick([1, 2, 3, 4, 5]);
        }
        v[idx] = stage;
      });

      addPattern(v as StageVector);
    }
  };

  // 4. Complexities 3 to 11 with generous quotas guaranteeing >= 6,500 unique patterns
  generateCombosForComplexity(3, 600, prng);
  generateCombosForComplexity(4, 700, prng);
  generateCombosForComplexity(5, 750, prng);
  generateCombosForComplexity(6, 750, prng);
  generateCombosForComplexity(7, 700, prng);
  generateCombosForComplexity(8, 650, prng);
  generateCombosForComplexity(9, 550, prng);
  generateCombosForComplexity(10, 450, prng);
  generateCombosForComplexity(11, 500, prng);

  // Group patterns by complexity
  const patterns: StageVector[] = [];
  const patternsByComplexity = new Map<number, StageVector[]>();
  for (let c = 0; c <= 11; c++) {
    patternsByComplexity.set(c, []);
  }

  patternSet.forEach((key) => {
    const v = keyToVector(key);
    patterns.push(v);
    const active = v.filter((s) => s > 0).length;
    patternsByComplexity.get(active)?.push(v);
  });

  return {
    patterns,
    patternsByComplexity,
    patternSet,
    totalUnique: patternSet.size,
  };
}
