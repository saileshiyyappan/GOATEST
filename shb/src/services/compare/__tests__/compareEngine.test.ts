import {
  compareEngine,
  CANONICAL_COMPARE_PARAMETERS,
  CANONICAL_ORGAN_PARAM_MAP,
  extractShbValue,
  resolveDeviationModelFromPhb,
  normalizePhbDocument,
  buildCumulativeDeviationBoundaries,
  matchApplicableStage,
  evaluateFeatureComparison,
} from '../compareEngine';
import { PhbDocument } from '../../../types/compare';
import { ShbCompletedSessionCache } from '../../vitals/shbSessionCache';

export function runCompareEngineTests(): boolean {
  console.log('==================================================');
  console.log('GOATEST COMPARE ENGINE — PMT-2 DETERMINISTIC VERIFICATION TESTS');
  console.log('==================================================');

  const standardPhbDoc: PhbDocument = {
    uid: 'user_test_p25_standard',
    userId: 'user_test_p25_standard',
    version: '1.0.0',
    demographicProfile: { age: 32, gender: 'MALE' },
    physiological: {
      direct: [
        { name: 'heartRate', value: 67, unit: 'bpm' },
        { name: 'spo2', value: 99, unit: '%' },
        { name: 'ppi', value: 896, unit: 'ms' },
      ],
      indirect: [
        { name: 'rmssd', value: 50, unit: 'ms' },
        { name: 'sdnn', value: 70, unit: 'ms' },
      ],
    },
    deviationConfiguration: [
      {
        featureName: 'heartRate',
        baseline: 67,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 5.0, magnitude: 5.0, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 5.0, upperBound: 17.0, magnitude: 12.0, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 17.0, upperBound: 40.0, magnitude: 23.0, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 40.0, upperBound: 72.0, magnitude: 32.0, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 72.0, upperBound: 127.0, magnitude: 55.0, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'spo2',
        baseline: 99,
        comparisonType: 'ABSOLUTE',
        directionality: 'DOWNWARD',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 1.0, magnitude: 1.0, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 1.0, upperBound: 2.0, magnitude: 1.0, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 2.0, upperBound: 3.0, magnitude: 1.0, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 3.0, upperBound: 4.0, magnitude: 1.0, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 4.0, upperBound: 5.0, magnitude: 1.0, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'ppi',
        baseline: 896,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 67.0, magnitude: 67.0, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 67.0, upperBound: 175.0, magnitude: 108.0, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 175.0, upperBound: 312.0, magnitude: 137.0, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 312.0, upperBound: 493.0, magnitude: 181.0, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 493.0, upperBound: 704.0, magnitude: 211.0, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'rmssd',
        baseline: 50,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 10.0, magnitude: 10.0, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 10.0, upperBound: 25.0, magnitude: 15.0, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 25.0, upperBound: 45.0, magnitude: 20.0, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 45.0, upperBound: 70.0, magnitude: 25.0, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 70.0, upperBound: 100.0, magnitude: 30.0, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'sdnn',
        baseline: 70,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 13.0, magnitude: 13.0, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 13.0, upperBound: 33.0, magnitude: 20.0, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 33.0, upperBound: 59.0, magnitude: 26.0, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 59.0, upperBound: 92.0, magnitude: 33.0, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 92.0, upperBound: 131.0, magnitude: 39.0, severity: 'CRITICAL' },
        },
      },
    ],
  };

  const normalizedPhb = normalizePhbDocument(standardPhbDoc);
  const hrFeat = normalizedPhb.features.get('heartRate')!;
  const testCumHr = [5, 17, 40, 72, 127];

  // 1. COMPLETE MATCH BASELINE (D = 0 -> Stage 0, PHB_DEVS = 0, COMPARE = 0)
  const identicalShb: ShbCompletedSessionCache = {
    sessionId: 'session_test_identical',
    targetOrgan: 'OVERALL',
    acquisitionDuration: 60,
    completedAt: Date.now(),
    directVitals: {},
    indirectVitals: {},
    lockedDirectVitals: { hr: 67, spo2: 99, ppi: 896 },
    lockedIndirectVitals: { rmssd: 50, sdnn: 70, rr: 15, respiratoryRate: 15 },
    lockedContextVariables: { activityIntensity: 0.05, ambientTemperature: 24.5, relativeHumidity: 45, atmosphericPressure: 1013.25, altitude: 120 },
  };
  const res1 = compareEngine.computeComparison(standardPhbDoc, identicalShb, null, 'OVERALL');
  if (!res1.success || res1.validParameterCount < 5) {
    throw new Error('Test 1 Failed: Complete match baseline count mismatch');
  }
  for (const row of res1.cmPacket!.parameters.filter((r) => r.status === 'COMPUTED' || r.status === 'VALID')) {
    if (row.deviation !== 0 || row.phbDevs !== 0 || row.compare !== 0 || row.matchedStage !== 0 || row.compareStage !== 0) {
      throw new Error(`Test 1 Failed: Row ${row.name} did not resolve to zero/stage 0: ${JSON.stringify(row)}`);
    }
  }
  console.log('[PASS] 1. Complete Match Baseline');

  // 2. D = 0 IDENTITY
  const evalD0 = evaluateFeatureComparison(hrFeat, 67);
  if (evalD0.dev !== 0 || evalD0.matchedStage !== 0 || evalD0.compareStage !== 0 || evalD0.phbDevs !== 0 || evalD0.compare !== 0) {
    throw new Error(`Test 2 Failed: D=0 Identity: ${JSON.stringify(evalD0)}`);
  }
  console.log('[PASS] 2. D = 0 Identity (Stage 0, PHB_DEVS=0, COMPARE=0)');

  // 3. STAGE 1 (D <= B1, e.g. D = 4 <= 5 -> Stage 1, boundary = 5, PHB_DEVS = 5, COMPARE = 4 - 5 = -1)
  const evalS1 = evaluateFeatureComparison(hrFeat, 71); // DEV = +4, D = 4 <= 5
  if (evalS1.dev !== 4 || evalS1.matchedStage !== 1 || evalS1.compareStage !== 1 || evalS1.matchedBoundary !== 5 || evalS1.phbDevs !== 5 || evalS1.shbDevs !== 4 || evalS1.compare !== -1) {
    throw new Error(`Test 3 Failed: Stage 1 (D <= B1): ${JSON.stringify(evalS1)}`);
  }
  console.log('[PASS] 3. Stage 1 (D <= B1, boundary = 5, PHB_DEVS = 5, COMPARE = -1)');

  // 4. STAGE 1 EXACT BOUNDARY (D = B1 = 5)
  const evalS1Exact = evaluateFeatureComparison(hrFeat, 72); // DEV = +5, D = 5 -> Stage 1, B1 = 5
  if (evalS1Exact.dev !== 5 || evalS1Exact.matchedStage !== 1 || evalS1Exact.compareStage !== 1 || evalS1Exact.matchedBoundary !== 5 || evalS1Exact.phbDevs !== 5 || evalS1Exact.compare !== 0) {
    throw new Error(`Test 4 Failed: S1 Exact Boundary (D=5): ${JSON.stringify(evalS1Exact)}`);
  }
  console.log('[PASS] 4. S1 Exact Boundary (D = B1 = 5 -> Stage 1, PHB_DEVS = 5, COMPARE = 0)');

  // 5. STAGE 2 (B1 < D <= B2, D = 10, B2 = 17 -> Stage 2, B2 = 17, PHB_DEVS = 17, COMPARE = 10 - 17 = -7)
  const evalS2 = evaluateFeatureComparison(hrFeat, 77); // DEV = +10, 5 < 10 <= 17 -> Stage 2, B2 = 17
  if (evalS2.dev !== 10 || evalS2.matchedStage !== 2 || evalS2.compareStage !== 2 || evalS2.matchedBoundary !== 17 || evalS2.phbDevs !== 17 || evalS2.compare !== -7) {
    throw new Error(`Test 5 Failed: S2 (D=10): ${JSON.stringify(evalS2)}`);
  }
  console.log('[PASS] 5. S2 (B1 < D <= B2 -> Stage 2, PHB_DEVS = 17, COMPARE = -7)');

  // 6. PMT SECTION 10 WORKED EXAMPLE (HR SHB=93, PHB=67, DEV=+26 -> cumBounds [5,13,23,36,51] -> Stage 4, B4=36, COMPARE=-10)
  const hrFeatSection10 = {
    ...hrFeat,
    baseline: 67,
    cumulativeBoundaries: [5, 13, 23, 36, 51],
    rawStageMagnitudes: [5, 8, 10, 13, 15],
  };
  const evalS10 = evaluateFeatureComparison(hrFeatSection10, 93); // DEV = +26, 23 < 26 <= 36 -> Stage 4, B4 = 36
  if (
    evalS10.dev !== 26 ||
    evalS10.matchedStage !== 4 ||
    evalS10.compareStage !== 4 ||
    evalS10.matchedBoundary !== 36 ||
    evalS10.phbDevs !== 36 ||
    evalS10.shbDevs !== 26 ||
    evalS10.compare !== -10
  ) {
    throw new Error(`Test 6 Failed: Section 10 Worked Example: ${JSON.stringify(evalS10)}`);
  }
  console.log('[PASS] 6. Section 10 Worked Example (HR SHB=93, DEV=+26 -> Stage 4, PHB_DEVS=36, COMPARE=-10, compareStage=4)');

  // 7. PMT SECTION 3 & 9 DOWNWARD SIGNED EXAMPLE (HR DEV=-26 -> Stage 4, B4=36, PHB_DEVS=-36, COMPARE=+10)
  const evalS10Down = evaluateFeatureComparison(hrFeatSection10, 41); // DEV = -26, 23 < 26 <= 36 -> Stage 4, B4 = 36
  if (
    evalS10Down.dev !== -26 ||
    evalS10Down.matchedStage !== 4 ||
    evalS10Down.compareStage !== 4 ||
    evalS10Down.matchedBoundary !== 36 ||
    evalS10Down.phbDevs !== -36 ||
    evalS10Down.shbDevs !== -26 ||
    evalS10Down.compare !== 10
  ) {
    throw new Error(`Test 7 Failed: Downward Signed Example (HR DEV=-26): ${JSON.stringify(evalS10Down)}`);
  }
  console.log('[PASS] 7. Downward Signed Example (HR SHB=41, DEV=-26 -> Stage 4, PHB_DEVS=-36, COMPARE=+10, compareStage=4)');

  // 8. PMT SECTION 12 PPI EXAMPLE (PHB=896, SHB=639 -> DEV=-257, cumBounds [67,175,312,493,704] -> Stage 3, B3=312, PHB_DEVS=-312, COMPARE=+55)
  const ppiFeat = normalizedPhb.features.get('ppi')!;
  const evalPpiS12 = evaluateFeatureComparison(ppiFeat, 639); // DEV = -257, 175 < 257 <= 312 -> Stage 3
  if (
    evalPpiS12.dev !== -257 ||
    evalPpiS12.matchedStage !== 3 ||
    evalPpiS12.compareStage !== 3 ||
    evalPpiS12.matchedBoundary !== 312 ||
    evalPpiS12.phbDevs !== -312 ||
    evalPpiS12.shbDevs !== -257 ||
    evalPpiS12.compare !== 55
  ) {
    throw new Error(`Test 8 Failed: Section 12 PPI Example: ${JSON.stringify(evalPpiS12)}`);
  }
  console.log('[PASS] 8. Section 12 PPI Example (DEV=-257 -> Stage 3, PHB_DEVS=-312, COMPARE=+55, compareStage=3)');

  // 9. BEYOND 5TH BOUNDARY (Section 8: D > B5 -> Stage 5, B5, beyondBoundary = true)
  const evalBeyond = matchApplicableStage(150, testCumHr);
  if (evalBeyond.matchedStage !== 5 || evalBeyond.compareStage !== 5 || evalBeyond.boundary !== 127 || !evalBeyond.beyondBoundary) {
    throw new Error(`Test 9 Failed: Beyond 5th boundary: ${JSON.stringify(evalBeyond)}`);
  }
  console.log('[PASS] 9. Beyond 5th Boundary (D > B5 -> Stage 5, boundary = B5, beyondBoundary = true)');

  // 10. STAGE 5 REGION (B4 < D <= B5, D = 100 <= 127 -> Stage 5, B5 = 127, beyondBoundary = false)
  const evalS5 = matchApplicableStage(100, testCumHr);
  if (evalS5.matchedStage !== 5 || evalS5.boundary !== 127 || evalS5.beyondBoundary) {
    throw new Error(`Test 10 Failed: Stage 5 match: ${JSON.stringify(evalS5)}`);
  }
  console.log('[PASS] 10. Stage 5 Region (B4 < D <= B5 -> Stage 5, boundary = 127, beyondBoundary = false)');

  // 11. DOWNWARD UNIDIRECTIONAL NON-ADVERSE (SpO2 PHB=99, SHB=100 -> DEV=+1 -> Stage 0, PHB_DEVS=0, COMPARE=1)
  const spo2Feat = normalizedPhb.features.get('spo2')!;
  const evalSpo2Normal = evaluateFeatureComparison(spo2Feat, 100);
  if (
    evalSpo2Normal.dev !== 1 ||
    evalSpo2Normal.matchedStage !== 0 ||
    evalSpo2Normal.compareStage !== 0 ||
    evalSpo2Normal.phbDevs !== 0 ||
    evalSpo2Normal.compare !== 1
  ) {
    throw new Error(`Test 11 Failed: SpO2 Non-adverse UP: ${JSON.stringify(evalSpo2Normal)}`);
  }
  console.log('[PASS] 11. SpO2 Non-Adverse Deviation (DEV=+1 -> Stage 0, PHB_DEVS=0, COMPARE=1)');

  // 12. DOWNWARD UNIDIRECTIONAL ADVERSE (SpO2 PHB=99, SHB=96 -> DEV=-3, Distance=3 -> Stage 3, B3=3, PHB_DEVS=-3, COMPARE=0)
  const evalSpo2Active = evaluateFeatureComparison(spo2Feat, 96);
  if (
    evalSpo2Active.dev !== -3 ||
    evalSpo2Active.matchedStage !== 3 ||
    evalSpo2Active.compareStage !== 3 ||
    evalSpo2Active.matchedBoundary !== 3 ||
    evalSpo2Active.phbDevs !== -3 ||
    evalSpo2Active.compare !== 0
  ) {
    throw new Error(`Test 12 Failed: Downward Adverse (SpO2 DEV=-3): ${JSON.stringify(evalSpo2Active)}`);
  }
  console.log('[PASS] 12. Downward Adverse Deviation (SpO2 DEV=-3 -> Stage 3, PHB_DEVS=-3, COMPARE=0)');

  // 13. PPI DETERMINISTIC TEST (PHB=896, SHB=606 -> DEV=-290 -> 175 < 290 <= 312 -> Stage 3, B3=312, PHB_DEVS=-312, COMPARE=-290 - (-312) = +22)
  const evalPpi = evaluateFeatureComparison(ppiFeat, 606);
  if (
    evalPpi.dev !== -290 ||
    evalPpi.matchedStage !== 3 ||
    evalPpi.compareStage !== 3 ||
    evalPpi.matchedBoundary !== 312 ||
    evalPpi.phbDevs !== -312 ||
    evalPpi.compare !== 22
  ) {
    throw new Error(`Test 13 Failed: PPI Evaluation: ${JSON.stringify(evalPpi)}`);
  }
  console.log('[PASS] 13. PPI Deterministic Test (DEV=-290 -> Stage 3, PHB_DEVS=-312, COMPARE=+22)');

  // 14. RMSSD DETERMINISTIC TEST (PHB=50, SHB=60 -> DEV=+10 -> D=10 <= 10 -> Stage 1, B1=10, PHB_DEVS=+10, COMPARE=0)
  const rmssdFeat = normalizedPhb.features.get('rmssd')!;
  const evalRmssd = evaluateFeatureComparison(rmssdFeat, 60);
  if (
    evalRmssd.dev !== 10 ||
    evalRmssd.matchedStage !== 1 ||
    evalRmssd.matchedBoundary !== 10 ||
    evalRmssd.phbDevs !== 10 ||
    evalRmssd.compare !== 0
  ) {
    throw new Error(`Test 14 Failed: RMSSD Evaluation: ${JSON.stringify(evalRmssd)}`);
  }
  console.log('[PASS] 14. RMSSD Deterministic Test (DEV=+10 -> Stage 1, PHB_DEVS=10, COMPARE=0)');

  // 15. SDNN DETERMINISTIC TEST (PHB=70, SHB=105 -> DEV=+35 -> 33 < 35 <= 59 -> Stage 3, B3=59, PHB_DEVS=+59, COMPARE=35 - 59 = -24)
  const sdnnFeat = normalizedPhb.features.get('sdnn')!;
  const evalSdnn = evaluateFeatureComparison(sdnnFeat, 105);
  if (
    evalSdnn.dev !== 35 ||
    evalSdnn.matchedStage !== 3 ||
    evalSdnn.compareStage !== 3 ||
    evalSdnn.matchedBoundary !== 59 ||
    evalSdnn.phbDevs !== 59 ||
    evalSdnn.compare !== -24
  ) {
    throw new Error(`Test 15 Failed: SDNN Evaluation: ${JSON.stringify(evalSdnn)}`);
  }
  console.log('[PASS] 15. SDNN Deterministic Test (DEV=+35 -> Stage 3, PHB_DEVS=59, COMPARE=-24)');

  // 16. MISSING SHB PARAMETER
  const evalMissingShb = evaluateFeatureComparison(hrFeat, null);
  if (evalMissingShb.status !== 'MISSING_SHB_VALUE' || evalMissingShb.shb !== null || evalMissingShb.compare !== null) {
    throw new Error(`Test 16 Failed: Missing SHB: ${JSON.stringify(evalMissingShb)}`);
  }
  console.log('[PASS] 16. Missing SHB Parameter (status: MISSING_SHB_VALUE)');

  // 17. SHB-ONLY PARAMETER
  const shbWithExtra: ShbCompletedSessionCache = {
    sessionId: 'session_shb_only_test',
    targetOrgan: 'OVERALL',
    acquisitionDuration: 60,
    completedAt: Date.now(),
    directVitals: {},
    indirectVitals: {},
    lockedDirectVitals: { hr: 67, spo2: 99, ppi: 896 },
    lockedIndirectVitals: { rmssd: 50, sdnn: 70, rr: 15 },
    lockedContextVariables: { activityIntensity: 0.05, ambientTemperature: 36.6, relativeHumidity: 45, atmosphericPressure: 1013, altitude: 100 },
  };
  const res17 = compareEngine.computeComparison(standardPhbDoc, shbWithExtra, null, 'OVERALL');
  const tempRow = res17.cmPacket?.parameters.find((r) => r.key === 'ambientTemperature');
  if (!tempRow || tempRow.status !== 'NO_PHB_REFERENCE' || tempRow.shbValue !== 36.6 || tempRow.phbBaseline !== null) {
    throw new Error(`Test 17 Failed: SHB-Only parameter: ${JSON.stringify(tempRow)}`);
  }
  console.log('[PASS] 17. SHB-Only Parameter (status: NO_PHB_REFERENCE)');

  // 18. UNIT MISMATCH
  const mismatchedPhbDoc: PhbDocument = {
    uid: 'user_mismatch',
    version: '1.0.0',
    physiological: {
      direct: [
        { name: 'heartRate', value: 67, unit: 'kg' }, // Incompatible unit
        { name: 'spo2', value: 99, unit: '%' },
      ],
    },
  };
  const mismatchShb: ShbCompletedSessionCache = {
    ...identicalShb,
    sessionId: 'session_test_mismatch',
  };
  const res18 = compareEngine.computeComparison(mismatchedPhbDoc, mismatchShb, null, 'OVERALL');
  const hrMismatchRow = res18.cmPacket?.parameters.find((r) => r.key === 'heartRate');
  if (!hrMismatchRow || hrMismatchRow.status !== 'UNIT_MISMATCH') {
    throw new Error(`Test 18 Failed: Unit Mismatch handling: ${JSON.stringify(hrMismatchRow)}`);
  }
  console.log('[PASS] 18. Unit Mismatch (status: UNIT_MISMATCH)');

  // 19. RESPIRATORY RATE INTEGRATION
  const respCompare = compareEngine.computeComparison(standardPhbDoc, identicalShb, null, 'RESPIRATORY');
  const respKeys = respCompare.cmPacket?.parameters.map((r) => r.key) || [];
  if (!respKeys.includes('respiratoryRate' as any)) {
    throw new Error('Test 19 Failed: Respiratory Rate is missing from Compare packet');
  }
  console.log('[PASS] 19. Respiratory Rate Integrated into Compare');

  // 20. IDEMPOTENCY & DETERMINISM
  const res20A = compareEngine.computeComparison(standardPhbDoc, identicalShb, null, 'OVERALL');
  const res20B = compareEngine.computeComparison(standardPhbDoc, identicalShb, null, 'OVERALL');
  if (JSON.stringify(res20A.cmPacket) !== JSON.stringify(res20B.cmPacket)) {
    throw new Error('Test 20 Failed: Compare computation is not deterministic');
  }
  console.log('[PASS] 20. Idempotency & Determinism');

  // 21. PMT SECTION 5 EXAMPLES A-G VERIFICATION
  const bounds5 = [13, 33, 59, 92, 131];
  // Example A: D = 1.5 <= 13 -> Stage 1
  const exA = matchApplicableStage(1.5, bounds5);
  if (exA.matchedStage !== 1 || exA.compareStage !== 1 || exA.boundary !== 13 || exA.beyondBoundary) {
    throw new Error(`Example A Failed: ${JSON.stringify(exA)}`);
  }
  // Example B: D = 13 <= 13 -> Stage 1
  const exB = matchApplicableStage(13, bounds5);
  if (exB.matchedStage !== 1 || exB.compareStage !== 1 || exB.boundary !== 13 || exB.beyondBoundary) {
    throw new Error(`Example B Failed: ${JSON.stringify(exB)}`);
  }
  // Example C: D = 13.1 <= 33 -> Stage 2
  const exC = matchApplicableStage(13.1, bounds5);
  if (exC.matchedStage !== 2 || exC.compareStage !== 2 || exC.boundary !== 33 || exC.beyondBoundary) {
    throw new Error(`Example C Failed: ${JSON.stringify(exC)}`);
  }
  // Example D: D = 33 <= 33 -> Stage 2
  const exD = matchApplicableStage(33, bounds5);
  if (exD.matchedStage !== 2 || exD.compareStage !== 2 || exD.boundary !== 33 || exD.beyondBoundary) {
    throw new Error(`Example D Failed: ${JSON.stringify(exD)}`);
  }
  // Example E: D = 33.1 <= 59 -> Stage 3
  const exE = matchApplicableStage(33.1, bounds5);
  if (exE.matchedStage !== 3 || exE.compareStage !== 3 || exE.boundary !== 59 || exE.beyondBoundary) {
    throw new Error(`Example E Failed: ${JSON.stringify(exE)}`);
  }
  // Example F: D = 100 <= 131 -> Stage 5 (not beyond)
  const exF = matchApplicableStage(100, bounds5);
  if (exF.matchedStage !== 5 || exF.compareStage !== 5 || exF.boundary !== 131 || exF.beyondBoundary) {
    throw new Error(`Example F Failed: ${JSON.stringify(exF)}`);
  }
  // Example G: D = 150 > 131 -> Stage 5 (beyondBoundary = true)
  const exG = matchApplicableStage(150, bounds5);
  if (exG.matchedStage !== 5 || exG.compareStage !== 5 || exG.boundary !== 131 || !exG.beyondBoundary) {
    throw new Error(`Example G Failed: ${JSON.stringify(exG)}`);
  }
  console.log('[PASS] 21. PMT Section 5 Boundary Examples A-G Verified');

  // 22. PMT SECTION 11 BIDIRECTIONAL TEST (PHB=100, bounds=[5,13,23,36,51])
  const biPhbFeat: any = {
    canonicalKey: 'heartRate',
    category: 'CARDIOVASCULAR',
    baseline: 100,
    phbValue: 100,
    unit: 'bpm',
    directionality: 'BIDIRECTIONAL',
    comparisonType: 'ABSOLUTE',
    rawStageMagnitudes: [5, 8, 10, 13, 15],
    cumulativeBoundaries: [5, 13, 23, 36, 51],
    deviationProfile: {
      stage1: { stage: 1, lowerBound: 0, upperBound: 5, magnitude: 5, severity: 'MILD' },
      stage2: { stage: 2, lowerBound: 5, upperBound: 13, magnitude: 8, severity: 'MODERATE' },
      stage3: { stage: 3, lowerBound: 13, upperBound: 23, magnitude: 10, severity: 'SEVERE' },
      stage4: { stage: 4, lowerBound: 23, upperBound: 36, magnitude: 13, severity: 'CRITICAL' },
      stage5: { stage: 5, lowerBound: 36, upperBound: 51, magnitude: 15, severity: 'CRITICAL' },
    },
  };
  // Case 1: SHB = 122 -> DEV = +22, D = 22 <= 23 -> Stage 3, UPWARD, phbDevs = +23, shbDevs = +22, compare = -1
  const biCase1 = evaluateFeatureComparison(biPhbFeat, 122);
  if (
    biCase1.dev !== 22 ||
    biCase1.direction !== 'UPWARD' ||
    biCase1.matchedStage !== 3 ||
    biCase1.compareStage !== 3 ||
    biCase1.matchedBoundary !== 23 ||
    biCase1.phbDevs !== 23 ||
    biCase1.shbDevs !== 22 ||
    biCase1.compare !== -1
  ) {
    throw new Error(`PMT Section 11 Case 1 Failed: ${JSON.stringify(biCase1)}`);
  }
  // Case 2: SHB = 78 -> DEV = -22, D = 22 <= 23 -> Stage 3, DOWNWARD, phbDevs = -23, shbDevs = -22, compare = +1
  const biCase2 = evaluateFeatureComparison(biPhbFeat, 78);
  if (
    biCase2.dev !== -22 ||
    biCase2.direction !== 'DOWNWARD' ||
    biCase2.matchedStage !== 3 ||
    biCase2.compareStage !== 3 ||
    biCase2.matchedBoundary !== 23 ||
    biCase2.phbDevs !== -23 ||
    biCase2.shbDevs !== -22 ||
    biCase2.compare !== 1
  ) {
    throw new Error(`PMT Section 11 Case 2 Failed: ${JSON.stringify(biCase2)}`);
  }
  console.log('[PASS] 22. PMT Section 11 Bidirectional Case 1 & Case 2 Verified (Both compareStage=3)');

  // 23. COMPLETE 11-PARAMETER CM_PACKET TEST RESULT (Section 12, 13, 14, 15)
  const full11PhbDoc: PhbDocument = {
    uid: 'user_full_11_test',
    userId: 'user_full_11_test',
    version: '1.0.0',
    demographicProfile: { age: 35, gender: 'FEMALE' },
    physiological: {
      direct: [
        { name: 'heartRate', value: 67, unit: 'bpm' },
        { name: 'spo2', value: 99, unit: '%' },
        { name: 'ppi', value: 896, unit: 'ms' },
      ],
      indirect: [
        { name: 'rmssd', value: 50, unit: 'ms' },
        { name: 'sdnn', value: 70, unit: 'ms' },
        { name: 'respiratoryRate', value: 16, unit: 'bpm' },
      ],
      context: [
        { name: 'activityIntensity', value: 0.1, unit: 'g' },
        { name: 'ambientTemperature', value: 24.0, unit: '°C' },
        { name: 'relativeHumidity', value: 50, unit: '%' },
        { name: 'atmosphericPressure', value: 1013.25, unit: 'hPa' },
        { name: 'altitude', value: 100, unit: 'm' },
      ],
    },
    deviationConfiguration: [
      {
        featureName: 'heartRate',
        baseline: 67,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 5, magnitude: 5, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 5, upperBound: 13, magnitude: 8, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 13, upperBound: 23, magnitude: 10, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 23, upperBound: 36, magnitude: 13, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 36, upperBound: 51, magnitude: 15, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'spo2',
        baseline: 99,
        comparisonType: 'ABSOLUTE',
        directionality: 'DOWNWARD',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 1, magnitude: 1, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 1, upperBound: 2, magnitude: 1, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 2, upperBound: 3, magnitude: 1, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 3, upperBound: 4, magnitude: 1, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 4, upperBound: 5, magnitude: 1, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'ppi',
        baseline: 896,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 67, magnitude: 67, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 67, upperBound: 175, magnitude: 108, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 175, upperBound: 312, magnitude: 137, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 312, upperBound: 493, magnitude: 181, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 493, upperBound: 704, magnitude: 211, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'rmssd',
        baseline: 50,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 10, magnitude: 10, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 10, upperBound: 25, magnitude: 15, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 25, upperBound: 45, magnitude: 20, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 45, upperBound: 70, magnitude: 25, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 70, upperBound: 100, magnitude: 30, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'sdnn',
        baseline: 70,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 13, magnitude: 13, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 13, upperBound: 33, magnitude: 20, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 33, upperBound: 59, magnitude: 26, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 59, upperBound: 92, magnitude: 33, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 92, upperBound: 131, magnitude: 39, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'respiratoryRate',
        baseline: 16,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 2, magnitude: 2, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 2, upperBound: 5, magnitude: 3, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 5, upperBound: 9, magnitude: 4, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 9, upperBound: 14, magnitude: 5, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 14, upperBound: 20, magnitude: 6, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'activityIntensity',
        baseline: 0.1,
        comparisonType: 'ABSOLUTE',
        directionality: 'UPWARD',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 0.2, magnitude: 0.2, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 0.2, upperBound: 0.5, magnitude: 0.3, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 0.5, upperBound: 1.0, magnitude: 0.5, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 1.0, upperBound: 1.8, magnitude: 0.8, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 1.8, upperBound: 3.0, magnitude: 1.2, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'ambientTemperature',
        baseline: 24.0,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 2.0, magnitude: 2.0, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 2.0, upperBound: 5.0, magnitude: 3.0, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 5.0, upperBound: 9.0, magnitude: 4.0, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 9.0, upperBound: 14.0, magnitude: 5.0, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 14.0, upperBound: 20.0, magnitude: 6.0, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'relativeHumidity',
        baseline: 50,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 5, magnitude: 5, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 5, upperBound: 12, magnitude: 7, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 12, upperBound: 22, magnitude: 10, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 22, upperBound: 35, magnitude: 13, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 35, upperBound: 50, magnitude: 15, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'atmosphericPressure',
        baseline: 1013.25,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 5, magnitude: 5, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 5, upperBound: 15, magnitude: 10, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 15, upperBound: 30, magnitude: 15, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 30, upperBound: 50, magnitude: 20, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 50, upperBound: 80, magnitude: 30, severity: 'CRITICAL' },
        },
      },
      {
        featureName: 'altitude',
        baseline: 100,
        comparisonType: 'ABSOLUTE',
        directionality: 'BIDIRECTIONAL',
        deviationProfile: {
          stage1: { stage: 1, lowerBound: 0, upperBound: 20, magnitude: 20, severity: 'MILD' },
          stage2: { stage: 2, lowerBound: 20, upperBound: 50, magnitude: 30, severity: 'MODERATE' },
          stage3: { stage: 3, lowerBound: 50, upperBound: 100, magnitude: 50, severity: 'SEVERE' },
          stage4: { stage: 4, lowerBound: 100, upperBound: 200, magnitude: 100, severity: 'CRITICAL' },
          stage5: { stage: 5, lowerBound: 200, upperBound: 400, magnitude: 200, severity: 'CRITICAL' },
        },
      },
    ],
  };

  const testShbSession: ShbCompletedSessionCache = {
    sessionId: 'session_full_11_verified',
    targetOrgan: 'OVERALL',
    acquisitionDuration: 60,
    completedAt: Date.now(),
    directVitals: {},
    indirectVitals: {},
    lockedDirectVitals: {
      hr: 93,       // DEV = +26 -> bounds [5,13,23,36,51] -> Stage 4, B4=36, phbDevs=36, compare=-10
      spo2: 99,     // DEV = 0 -> Stage 0, B0=0, phbDevs=0, compare=0
      ppi: 639,     // DEV = -257 -> bounds [67,175,312,493,704] -> Stage 3, B3=312, phbDevs=-312, compare=+55
    },
    lockedIndirectVitals: {
      rmssd: 68,    // DEV = +18 -> bounds [10,25,45,70,100] -> Stage 2, B2=25, phbDevs=25, compare=-7
      sdnn: 78,     // DEV = +8 -> bounds [13,33,59,92,131] -> Stage 1, B1=13, phbDevs=13, compare=-5
      respiratoryRate: 18, // DEV = +2 -> bounds [2,5,9,14,20] -> Stage 1, B1=2, phbDevs=2, compare=0
    },
    lockedContextVariables: {
      activityIntensity: 0.8, // DEV = +0.7 -> bounds [0.2,0.5,1.0,1.8,3.0] -> Stage 3, B3=1.0, phbDevs=1.0, compare=-0.3
      ambientTemperature: 27.5, // DEV = +3.5 -> bounds [2,5,9,14,20] -> Stage 2, B2=5, phbDevs=5, compare=-1.5
      relativeHumidity: 53, // DEV = +3 -> bounds [5,12,22,35,50] -> Stage 1, B1=5, phbDevs=5, compare=-2
      atmosphericPressure: 1010.25, // DEV = -3 -> bounds [5,15,30,50,80] -> Stage 1, B1=5, phbDevs=-5, compare=+2
      altitude: 180, // DEV = +80 -> bounds [20,50,100,200,400] -> Stage 3, B3=100, phbDevs=100, compare=-20
    },
  };

  const res11 = compareEngine.computeComparison(full11PhbDoc, testShbSession, null, 'OVERALL');
  if (!res11.success || res11.validParameterCount !== 11) {
    throw new Error(`Test 23 Failed: Expected 11 valid parameters, got ${res11.validParameterCount}`);
  }

  const packet = res11.cmPacket!;
  console.log('\n========================================================================================');
  console.log('COMPLETE 11-PARAMETER CM_PACKET TEST RESULT:');
  console.log('========================================================================================');
  console.log('Sec | Canonical Key       | PHB     | SHB     | DEV     | Stage | Boundary | PHB_DEVS | COMPARE | Direction');
  console.log('----+---------------------+---------+---------+---------+-------+----------+----------+---------+-----------');
  for (const row of packet.parameters) {
    const secStr = String(row.secNo).padStart(3, ' ');
    const keyStr = row.key.padEnd(19, ' ');
    const phbStr = (row.phbBaseline !== null ? String(row.phbBaseline) : '--').padStart(7, ' ');
    const shbStr = (row.shbValue !== null ? String(row.shbValue) : '--').padStart(7, ' ');
    const devStr = (row.deviation !== null ? (row.deviation > 0 ? `+${row.deviation}` : String(row.deviation)) : '--').padStart(7, ' ');
    const stageStr = (row.compareStage !== null ? String(row.compareStage) : '--').padStart(5, ' ');
    const bndStr = (row.matchedBoundary !== null ? String(row.matchedBoundary) : '--').padStart(8, ' ');
    const phbDevsStr = (row.phbDevs !== null ? (row.phbDevs > 0 ? `+${row.phbDevs}` : String(row.phbDevs)) : '--').padStart(8, ' ');
    const cmpStr = (row.compare !== null ? (row.compare > 0 ? `+${row.compare}` : String(row.compare)) : '--').padStart(7, ' ');
    const dirStr = (row.direction || '--').padEnd(9, ' ');
    console.log(`${secStr} | ${keyStr} | ${phbStr} | ${shbStr} | ${devStr} | ${stageStr} | ${bndStr} | ${phbDevsStr} | ${cmpStr} | ${dirStr}`);
  }
  console.log('----------------------------------------------------------------------------------------');
  const mlVector = packet.parameters.map((r) => r.compareStage);
  console.log('FINAL ML VECTOR [HR, SpO2, PPI, RMSSD, SDNN, RR, Act, Temp, Hum, Press, Alt]:');
  console.log(JSON.stringify(mlVector));
  console.log('========================================================================================\n');

  // Verify ML vector matches expected stages: [4, 0, 3, 2, 1, 1, 3, 2, 1, 1, 3]
  const expectedVector = [4, 0, 3, 2, 1, 1, 3, 2, 1, 1, 3];
  if (JSON.stringify(mlVector) !== JSON.stringify(expectedVector)) {
    throw new Error(`ML Vector mismatch: expected ${JSON.stringify(expectedVector)}, got ${JSON.stringify(mlVector)}`);
  }
  console.log('[PASS] 23. Complete 11-Parameter CM_PACKET Test Verified and Printed');

  console.log('==================================================');
  console.log('ALL PMT-2 DETERMINISTIC VERIFICATION TESTS PASSED!');
  console.log('==================================================');

  return true;
}
