import {
  calculateRespiratoryRate,
  calculateBaseRrFromHr,
  calculateHrvAdjustments,
  calculateSpo2Adjustment,
  calculateActivityAdjustment,
  calculateEnvironmentalAdjustments,
  deriveRrRhythmState,
  deriveRrVariability,
  calculateRrConfidence,
} from '../respiratoryEstimator';
import { VitalEngine } from '../vitalEngine';
import { shbSessionCache } from '../shbSessionCache';
import { compareEngine } from '../../compare/compareEngine';

export function runRespiratoryRateTests() {
  const results: { name: string; passed: boolean; details: string }[] = [];

  // Test 1: Step 1 Base RR from HR Curve
  const hrTests: [number, number][] = [
    [50, 12.0],
    [55, 13.0],
    [70, 13.5],
    [100, 18.0],
    [110, 20.0],
    [140, 26.5],
  ];

  for (const [hr, expectedBase] of hrTests) {
    const calculated = calculateBaseRrFromHr(hr);
    const passed = Math.abs(calculated - expectedBase) < 0.1;
    results.push({
      name: `Base RR Curve for HR = ${hr} bpm (Expected: ${expectedBase})`,
      passed,
      details: `Got: ${calculated}`,
    });
  }

  // Test 2: Step 2 HRV Adjustments (RMSSD & SDNN)
  const hrv1 = calculateHrvAdjustments(70, 80);
  const hrv1Passed = hrv1.rmssdAdjust === -1.5 && hrv1.sdnnAdjust === -1.0;
  results.push({
    name: 'HRV High RMSSD/SDNN -> Parasympathetic reduction (-1.5, -1.0)',
    passed: hrv1Passed,
    details: `rmssd: ${hrv1.rmssdAdjust}, sdnn: ${hrv1.sdnnAdjust}`,
  });

  const hrv2 = calculateHrvAdjustments(15, 30);
  const hrv2Passed = hrv2.rmssdAdjust === 3.0 && hrv2.sdnnAdjust === 1.5;
  results.push({
    name: 'HRV Low RMSSD/SDNN -> Sympathetic elevation (+3.0, +1.5)',
    passed: hrv2Passed,
    details: `rmssd: ${hrv2.rmssdAdjust}, sdnn: ${hrv2.sdnnAdjust}`,
  });

  // Test 3: Step 3 SpO2 Hypoxia Adjustments
  const spo2Tests: [number, number][] = [
    [98, 0],
    [96, 1.0],
    [93, 3.0],
    [88, 5.0],
  ];
  for (const [spo2, expectedAdj] of spo2Tests) {
    const adj = calculateSpo2Adjustment(spo2);
    const passed = adj === expectedAdj;
    results.push({
      name: `SpO2 Hypoxia Compensatory Drive for SpO2 = ${spo2}%`,
      passed,
      details: `Expected: +${expectedAdj}, Got: +${adj}`,
    });
  }

  // Test 4: Step 4 Activity & Step 5 Environmental Adjustments
  const actAdj = calculateActivityAdjustment(50);
  results.push({
    name: 'Kinematic Activity Adjustment (Moderate 50%)',
    passed: actAdj === 2.0,
    details: `Got: +${actAdj}`,
  });

  const envAdj = calculateEnvironmentalAdjustments(3500, 38.5, 85, 980);
  results.push({
    name: 'Environmental Context Adjustments (High Altitude + Thermal + Humidity + Pressure)',
    passed: envAdj.tempAdjust === 2.0 && envAdj.humidityAdjust === 1.0 && envAdj.altitudeAdjust > 0,
    details: `Alt: ${envAdj.altitudeAdjust.toFixed(2)}, Temp: ${envAdj.tempAdjust}, Hum: ${envAdj.humidityAdjust}, Pres: ${envAdj.pressureAdjust.toFixed(2)}`,
  });

  // Test 5: End-to-End Multi-Stage Pipeline Execution
  const restingRes = calculateRespiratoryRate({
    heartRate: 68,
    spo2: 99,
    rmssd: 50,
    sdnn: 70,
    activityIntensity: 5,
    ambientTemperature: 24.5,
    relativeHumidity: 45,
    atmosphericPressure: 1013,
    altitude: 120,
  });

  const restingPassed =
    restingRes.isValid &&
    restingRes.respiratoryRate !== null &&
    restingRes.respiratoryRate >= 10 &&
    restingRes.respiratoryRate <= 16 &&
    restingRes.rhythmState === 'Regular (Resting)';

  results.push({
    name: 'Authoritative End-to-End Resting Adult Respiration',
    passed: restingPassed,
    details: `RR: ${restingRes.respiratoryRate} bpm, Base: ${restingRes.baseRr}, Rhythm: ${restingRes.rhythmState}, Conf: ${restingRes.confidence}%`,
  });

  // Test 6: VitalEngine Ingestion & Integration
  const engine = new VitalEngine('RESPIRATORY');
  engine.startAcquisition();

  for (let i = 0; i < 20; i++) {
    engine.ingestPacket({
      timestamp: Date.now() + i * 800,
      hr: 72,
      spo2: 98,
      ppi: 833,
      temp: 24.5,
      humidity: 45,
      pressure: 1013,
      altitude: 120,
      ax: 0.01,
      ay: -9.81,
      az: 0.02,
    }, true);
  }

  const liveState = engine.getState(true);
  const liveRr = liveState.indirectVitals?.rr;
  const engineLivePassed = liveRr !== undefined && liveRr.liveValue !== null;
  results.push({
    name: 'VitalEngine Live Multi-Stage RR Derivation',
    passed: engineLivePassed,
    details: `Live RR: ${liveRr?.liveValue}, Status: ${liveRr?.status}`,
  });

  // Test 7: Lock & Compare Pipeline Handoff
  engine.executeLock();
  const lockedState = engine.getState(true);
  const lockedRr = lockedState.indirectVitals?.rr;
  const lockPassed = lockedRr?.status === 'LOCKED' && typeof lockedRr?.lockedValue === 'number';

  results.push({
    name: 'VitalEngine RR Robust Lock & Session Cache Sync',
    passed: lockPassed,
    details: `Locked RR: ${lockedRr?.lockedValue} breaths/min, Status: ${lockedRr?.status}`,
  });

  // Save to Cache & Run Compare
  shbSessionCache.setSession({
    sessionId: 'session_rr_test_final',
    targetOrgan: 'RESPIRATORY',
    acquisitionDuration: 65,
    completedAt: Date.now(),
    directVitals: lockedState.directVitals,
    indirectVitals: lockedState.indirectVitals,
    lockedDirectVitals: {
      hr: lockedState.directVitals.hr.lockedValue as number,
      spo2: lockedState.directVitals.spo2.lockedValue as number,
      ppi: lockedState.directVitals.ppi.lockedValue as number,
    },
    lockedIndirectVitals: {
      rmssd: lockedState.indirectVitals.rmssd.lockedValue as number,
      sdnn: lockedState.indirectVitals.sdnn.lockedValue as number,
      rr: lockedRr?.lockedValue as number,
      respiratoryRate: lockedRr?.lockedValue as number,
    },
    lockedContextVariables: {
      activityIntensity: 0.05,
      ambientTemperature: 24.5,
      relativeHumidity: 45.0,
      atmosphericPressure: 1013.25,
      altitude: 120.0,
    },
    sessionStatus: 'COMPLETED',
  });

  const mockPhb = {
    uid: 'user_test_phb_01',
    userId: 'user_test_phb_01',
    version: '1.0.0',
    demographicProfile: { age: 30, gender: 'MALE' },
    physiological: {
      direct: [
        { name: 'heartRate', value: 72, unit: 'bpm' },
        { name: 'spo2', value: 98, unit: '%' },
        { name: 'ppi', value: 833, unit: 'ms' },
      ],
      indirect: [
        { name: 'respiratoryRate', value: 15, unit: 'breaths/min' },
        { name: 'rmssd', value: 35, unit: 'ms' },
      ],
    },
  };

  const cmResult = compareEngine.computeComparison(
    mockPhb as any,
    shbSessionCache.getSession()!,
    null,
    'RESPIRATORY'
  );

  const rrCmRow = cmResult.cmPacket?.rows.find(
    (r: any) => r.key === 'respiratoryRate' || r.key === 'rr' || r.name.toLowerCase().includes('respiratory')
  );
  const cmPassed = cmResult.success && rrCmRow !== undefined && rrCmRow.shbValue !== null;

  results.push({
    name: 'CM_PACKET Respiratory Rate Row Integration in Compare',
    passed: cmPassed,
    details: `CM Row: ${rrCmRow?.name}, SHB Val: ${rrCmRow?.shbValue}, Baseline: ${rrCmRow?.phbBaseline}`,
  });

  return results;
}
