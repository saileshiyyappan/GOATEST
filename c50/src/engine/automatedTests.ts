import { TestCaseResult } from '../types/compare';
import { calculateParameterCompare } from './compareEngine';
import { CANONICAL_11_PARAMETERS } from './canonicalParameters';

export function runAutomatedTestSuite(): TestCaseResult[] {
  const dummyConfig = CANONICAL_11_PARAMETERS[0]; // Heart Rate config
  const testBoundaries: [number, number, number, number, number] = [5, 13, 23, 36, 51];
  const phb = 100;

  const testCases: TestCaseResult[] = [];

  // A. DEV = 0 -> Stage 0
  {
    const res = calculateParameterCompare(dummyConfig, phb, 100, testBoundaries);
    const passed =
      res.deviation === 0 &&
      res.deviationDistance === 0 &&
      res.matchedStage === 0 &&
      res.matchedBoundary === 0 &&
      res.compareStage === 0 &&
      res.direction === 'NORMAL' &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_A',
      name: 'Test A: DEV = 0 -> Stage 0',
      description: 'Deviation of exact 0 must produce Stage 0 with boundary 0.',
      input: { phb, shb: 100, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 0,
        deviationDistance: 0,
        stage: 0,
        matchedBoundary: 0,
        direction: 'NORMAL',
        beyondBoundary: false,
        compare: 0,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // B. deviation exactly at B1 -> Stage 1
  {
    const res = calculateParameterCompare(dummyConfig, phb, 105, testBoundaries);
    const passed =
      res.deviationDistance === 5 &&
      res.matchedStage === 1 &&
      res.matchedBoundary === 5 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_B',
      name: 'Test B: deviation exactly at B1 -> Stage 1',
      description: 'Deviation distance exactly equal to B1 (5) maps to Stage 1 with boundary B1 (5).',
      input: { phb, shb: 105, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 5,
        deviationDistance: 5,
        stage: 1,
        matchedBoundary: 5,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // C. deviation slightly above B1 -> Stage 2
  {
    const res = calculateParameterCompare(dummyConfig, phb, 105.1, testBoundaries);
    const passed =
      res.deviationDistance === 5.1 &&
      res.matchedStage === 2 &&
      res.matchedBoundary === 13 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_C',
      name: 'Test C: deviation slightly above B1 -> Stage 2',
      description: 'Deviation distance 5.1 (> B1) maps to Stage 2 with boundary B2 (13).',
      input: { phb, shb: 105.1, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 5.1,
        deviationDistance: 5.1,
        stage: 2,
        matchedBoundary: 13,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // D. deviation exactly at B2 -> Stage 2
  {
    const res = calculateParameterCompare(dummyConfig, phb, 113, testBoundaries);
    const passed =
      res.deviationDistance === 13 &&
      res.matchedStage === 2 &&
      res.matchedBoundary === 13 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_D',
      name: 'Test D: deviation exactly at B2 -> Stage 2',
      description: 'Deviation distance exactly equal to B2 (13) maps to Stage 2 with boundary B2 (13).',
      input: { phb, shb: 113, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 13,
        deviationDistance: 13,
        stage: 2,
        matchedBoundary: 13,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // E. deviation slightly above B2 -> Stage 3
  {
    const res = calculateParameterCompare(dummyConfig, phb, 113.1, testBoundaries);
    const passed =
      res.deviationDistance === 13.1 &&
      res.matchedStage === 3 &&
      res.matchedBoundary === 23 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_E',
      name: 'Test E: deviation slightly above B2 -> Stage 3',
      description: 'Deviation distance 13.1 (> B2) maps to Stage 3 with boundary B3 (23).',
      input: { phb, shb: 113.1, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 13.1,
        deviationDistance: 13.1,
        stage: 3,
        matchedBoundary: 23,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // F. deviation exactly at B3 -> Stage 3
  {
    const res = calculateParameterCompare(dummyConfig, phb, 123, testBoundaries);
    const passed =
      res.deviationDistance === 23 &&
      res.matchedStage === 3 &&
      res.matchedBoundary === 23 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_F',
      name: 'Test F: deviation exactly at B3 -> Stage 3',
      description: 'Deviation distance exactly equal to B3 (23) maps to Stage 3 with boundary B3 (23).',
      input: { phb, shb: 123, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 23,
        deviationDistance: 23,
        stage: 3,
        matchedBoundary: 23,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // G. deviation slightly above B3 -> Stage 4
  {
    const res = calculateParameterCompare(dummyConfig, phb, 123.1, testBoundaries);
    const passed =
      res.deviationDistance === 23.1 &&
      res.matchedStage === 4 &&
      res.matchedBoundary === 36 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_G',
      name: 'Test G: deviation slightly above B3 -> Stage 4',
      description: 'Deviation distance 23.1 (> B3) maps to Stage 4 with boundary B4 (36).',
      input: { phb, shb: 123.1, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 23.1,
        deviationDistance: 23.1,
        stage: 4,
        matchedBoundary: 36,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // H. deviation exactly at B4 -> Stage 4
  {
    const res = calculateParameterCompare(dummyConfig, phb, 136, testBoundaries);
    const passed =
      res.deviationDistance === 36 &&
      res.matchedStage === 4 &&
      res.matchedBoundary === 36 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_H',
      name: 'Test H: deviation exactly at B4 -> Stage 4',
      description: 'Deviation distance exactly equal to B4 (36) maps to Stage 4 with boundary B4 (36).',
      input: { phb, shb: 136, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 36,
        deviationDistance: 36,
        stage: 4,
        matchedBoundary: 36,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // I. deviation slightly above B4 -> Stage 5
  {
    const res = calculateParameterCompare(dummyConfig, phb, 136.1, testBoundaries);
    const passed =
      res.deviationDistance === 36.1 &&
      res.matchedStage === 5 &&
      res.matchedBoundary === 51 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_I',
      name: 'Test I: deviation slightly above B4 -> Stage 5',
      description: 'Deviation distance 36.1 (> B4, <= B5) maps to Stage 5 with boundary B5 (51).',
      input: { phb, shb: 136.1, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 36.1,
        deviationDistance: 36.1,
        stage: 5,
        matchedBoundary: 51,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // J. deviation exactly at B5 -> Stage 5
  {
    const res = calculateParameterCompare(dummyConfig, phb, 151, testBoundaries);
    const passed =
      res.deviationDistance === 51 &&
      res.matchedStage === 5 &&
      res.matchedBoundary === 51 &&
      res.beyondBoundary === false;

    testCases.push({
      id: 'TEST_J',
      name: 'Test J: deviation exactly at B5 -> Stage 5',
      description: 'Deviation distance exactly equal to B5 (51) maps to Stage 5 with boundary B5 (51).',
      input: { phb, shb: 151, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 51,
        deviationDistance: 51,
        stage: 5,
        matchedBoundary: 51,
        direction: 'UPWARD',
        beyondBoundary: false,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // K. deviation above B5 -> Stage 5 + beyondBoundary=true
  {
    const res = calculateParameterCompare(dummyConfig, phb, 175, testBoundaries);
    const passed =
      res.deviationDistance === 75 &&
      res.matchedStage === 5 &&
      res.matchedBoundary === 51 &&
      res.beyondBoundary === true;

    testCases.push({
      id: 'TEST_K',
      name: 'Test K: deviation above B5 -> Stage 5 + beyondBoundary=true',
      description: 'Deviation distance 75 (> B5) maps to Stage 5 (NOT Stage 6) with beyondBoundary=true.',
      input: { phb, shb: 175, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 75,
        deviationDistance: 75,
        stage: 5,
        matchedBoundary: 51,
        direction: 'UPWARD',
        beyondBoundary: true,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // L. positive deviation -> correct stage + UPWARD
  {
    const res = calculateParameterCompare(dummyConfig, phb, 122, testBoundaries);
    const passed =
      res.deviation === 22 &&
      res.deviationDistance === 22 &&
      res.matchedStage === 3 &&
      res.compareStage === 3 &&
      res.direction === 'UPWARD';

    testCases.push({
      id: 'TEST_L',
      name: 'Test L: positive deviation -> correct stage + UPWARD',
      description: 'Positive deviation (+22) maps to Stage 3 with direction UPWARD.',
      input: { phb, shb: 122, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 22,
        deviationDistance: 22,
        stage: 3,
        matchedBoundary: 23,
        direction: 'UPWARD',
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // M. equivalent negative deviation -> same stage + DOWNWARD
  {
    const res = calculateParameterCompare(dummyConfig, phb, 78, testBoundaries);
    const passed =
      res.deviation === -22 &&
      res.deviationDistance === 22 &&
      res.matchedStage === 3 &&
      res.compareStage === 3 &&
      res.direction === 'DOWNWARD';

    testCases.push({
      id: 'TEST_M',
      name: 'Test M: equivalent negative deviation -> same stage + DOWNWARD',
      description: 'Negative deviation (-22) maps to same Stage 3 with direction DOWNWARD.',
      input: { phb, shb: 78, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: -22,
        deviationDistance: 22,
        stage: 3,
        matchedBoundary: 23,
        direction: 'DOWNWARD',
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  // N. verify matchedBoundary always corresponds to matchedStage
  {
    const checks = [
      calculateParameterCompare(dummyConfig, 100, 100, testBoundaries), // stage 0 -> 0
      calculateParameterCompare(dummyConfig, 100, 103, testBoundaries), // stage 1 -> 5
      calculateParameterCompare(dummyConfig, 100, 110, testBoundaries), // stage 2 -> 13
      calculateParameterCompare(dummyConfig, 100, 120, testBoundaries), // stage 3 -> 23
      calculateParameterCompare(dummyConfig, 100, 130, testBoundaries), // stage 4 -> 36
      calculateParameterCompare(dummyConfig, 100, 150, testBoundaries), // stage 5 -> 51
    ];
    const expectedBounds = [0, 5, 13, 23, 36, 51];
    const passed = checks.every((c, idx) => c.matchedBoundary === expectedBounds[idx]);

    testCases.push({
      id: 'TEST_N',
      name: 'Test N: verify matchedBoundary corresponds exactly to matchedStage',
      description: 'Stages 0, 1, 2, 3, 4, 5 must map to [0, B1, B2, B3, B4, B5] respectively.',
      input: { phb: 100, shb: 130, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 30,
        deviationDistance: 30,
        stage: 4,
        matchedBoundary: 36,
        direction: 'UPWARD',
      },
      actual: {
        deviation: checks[4].deviation,
        deviationDistance: checks[4].deviationDistance,
        stage: checks[4].matchedStage,
        matchedBoundary: checks[4].matchedBoundary,
        direction: checks[4].direction,
        beyondBoundary: checks[4].beyondBoundary,
        compare: checks[4].compare,
      },
      passed,
    });
  }

  // O. verify compareStage == matchedStage
  {
    const testShbs = [100, 102, 108, 118, 130, 160];
    const checks = testShbs.map((s) => calculateParameterCompare(dummyConfig, 100, s, testBoundaries));
    const passed = checks.every((c) => c.compareStage === c.matchedStage);

    testCases.push({
      id: 'TEST_O',
      name: 'Test O: verify compareStage == matchedStage',
      description: 'compareStage is never derived from residual compare and always equals matchedStage.',
      input: { phb: 100, shb: 160, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 60,
        deviationDistance: 60,
        stage: 5,
        matchedBoundary: 51,
        direction: 'UPWARD',
      },
      actual: {
        deviation: checks[5].deviation,
        deviationDistance: checks[5].deviationDistance,
        stage: checks[5].matchedStage,
        matchedBoundary: checks[5].matchedBoundary,
        direction: checks[5].direction,
        beyondBoundary: checks[5].beyondBoundary,
        compare: checks[5].compare,
      },
      passed,
    });
  }

  // P. verify compare == shbDevs - phbDevs
  {
    // Example from prompt: DEV = +26, Stage = 4, Boundary = 36, phbDevs = +36, shbDevs = +26, compare = 26 - 36 = -10
    const res = calculateParameterCompare(dummyConfig, 67, 93, testBoundaries);
    const passed =
      res.shbDevs === 26 &&
      res.phbDevs === 36 &&
      res.compare === -10 &&
      res.compareStage === 4;

    testCases.push({
      id: 'TEST_P',
      name: 'Test P: verify compare == shbDevs - phbDevs (residual)',
      description: 'Residual compare calculation: shbDevs (26) - phbDevs (36) = -10 with compareStage = 4.',
      input: { phb: 67, shb: 93, cumulativeBoundaries: testBoundaries },
      expected: {
        deviation: 26,
        deviationDistance: 26,
        stage: 4,
        matchedBoundary: 36,
        direction: 'UPWARD',
        compare: -10,
      },
      actual: {
        deviation: res.deviation,
        deviationDistance: res.deviationDistance,
        stage: res.matchedStage,
        matchedBoundary: res.matchedBoundary,
        direction: res.direction,
        beyondBoundary: res.beyondBoundary,
        compare: res.compare,
      },
      passed,
    });
  }

  return testCases;
}
