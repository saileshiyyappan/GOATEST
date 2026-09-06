import {
  computeRobustVitalLock,
  calculateMedian,
  calculateMad,
  filterOutliersMad,
} from '../robustAverager';
import { parseSensorPacket, parseGattHeartRateData } from '../packetParser';
import { evaluateBFitSignal } from '../bfitEngine';
import { VitalEngine } from '../vitalEngine';
import { PacketReassembler } from '../packetReassembler';

/**
 * Deterministic test runner for robust averaging, packet parsing, and vital calculation pipeline.
 * Run with tsx / node.
 */
export function runAlgorithmVerificationTests() {
  const results: { name: string; passed: boolean; details: string }[] = [];

  // Test 1: Single extreme outlier rejection (e.g. 250 spike amidst 100 bpm baseline)
  const test1Samples = [100, 101, 100, 102, 101, 100, 250, 99, 101, 100];
  const res1 = computeRobustVitalLock(test1Samples, { isInteger: true, minSamples: 8 });
  const test1Passed = res1.lockedValue !== null && res1.lockedValue >= 99 && res1.lockedValue <= 102 && res1.rejectedCount === 1;
  results.push({
    name: 'Single Extreme Outlier Rejection',
    passed: test1Passed,
    details: `Locked: ${res1.lockedValue}, Rejected: ${res1.rejectedCount}, Expected ~100 with 1 rejected`,
  });

  // Test 2: Constant values
  const test2Samples = [72, 72, 72, 72, 72, 72, 72, 72, 72, 72];
  const res2 = computeRobustVitalLock(test2Samples, { isInteger: true, minSamples: 8 });
  const test2Passed = res2.lockedValue === 72 && res2.isStable;
  results.push({
    name: 'Constant Values Stability',
    passed: test2Passed,
    details: `Locked: ${res2.lockedValue}, isStable: ${res2.isStable}`,
  });

  // Test 3: Mild physiological variation (normal sinus rhythm 68-74 bpm)
  const test3Samples = [69, 70, 71, 72, 70, 69, 73, 71, 70, 72];
  const res3 = computeRobustVitalLock(test3Samples, { isInteger: true, minSamples: 8 });
  const test3Passed = res3.lockedValue !== null && res3.lockedValue >= 70 && res3.lockedValue <= 72 && res3.isStable;
  results.push({
    name: 'Mild Physiological Variation',
    passed: test3Passed,
    details: `Locked: ${res3.lockedValue}, Mean: ${res3.mean}`,
  });

  // Test 4: Insufficient samples (< minSamples)
  const test4Samples = [80, 81, 80];
  const res4 = computeRobustVitalLock(test4Samples, { isInteger: true, minSamples: 8 });
  const test4Passed = res4.lockedValue === null && !res4.isStable;
  results.push({
    name: 'Insufficient Samples (< minSamples)',
    passed: test4Passed,
    details: `Locked: ${res4.lockedValue} (Should be null)`,
  });

  // Test 5: Unstable wildly varying data
  const test5Samples = [40, 120, 200, 50, 180, 60, 210, 45, 190, 70];
  const res5 = computeRobustVitalLock(test5Samples, { isInteger: true, minSamples: 8, maxCv: 0.15 });
  const test5Passed = res5.lockedValue === null || !res5.isStable;
  results.push({
    name: 'Unstable / Wild Variation',
    passed: test5Passed,
    details: `isStable: ${res5.isStable}, lockedValue: ${res5.lockedValue}`,
  });

  // Test 6: Skin Temperature (Decimal rounding and low variance tolerance)
  const test6Samples = [36.5, 36.6, 36.5, 36.4, 36.6, 36.5, 48.0, 36.5, 36.6, 36.5];
  const res6 = computeRobustVitalLock(test6Samples, { isInteger: false, decimals: 1, minSamples: 8 });
  const test6Passed = res6.lockedValue === 36.5 && res6.rejectedCount === 1;
  results.push({
    name: 'Skin Temperature Decimal Robust Lock',
    passed: test6Passed,
    details: `Locked: ${res6.lockedValue}, Rejected: ${res6.rejectedCount}`,
  });

  // Test 7: Packet Parser - ASCII Key-Value String
  const rawAscii = 'TEMP=36.6,HUM=65.0,PRES=101325,ALT=50.2,AX=0.02,AY=-9.80,AZ=0.10,IR=12500,RED=14000,HR=72,SPO2=98,PPI=833';
  const parsedAscii = parseSensorPacket(rawAscii);
  const test7Passed = parsedAscii.isValid && parsedAscii.heartRate === 72 && parsedAscii.spO2 === 98 && parsedAscii.skinTemp === 36.6 && parsedAscii.ppi === 833;
  results.push({
    name: 'Packet Parser: Key-Value Format',
    passed: test7Passed,
    details: `HR=${parsedAscii.heartRate}, SpO2=${parsedAscii.spO2}, Temp=${parsedAscii.skinTemp}, PPI=${parsedAscii.ppi}`,
  });

  // Test 8: Packet Parser - M-BAND BLEPackets Prefix Format (e.g. VITAL:HR=74,SPO2=98,TEMP=36.5,PPI=810,AX=0.01,AY=-9.81,AZ=0.02)
  const mbandVital = 'VITAL:HR=74,SPO2=98,TEMP=36.5,PPI=810,AX=0.01,AY=-9.81,AZ=0.02,PRES=101325';
  const parsedMband = parseSensorPacket(mbandVital);
  const test8Passed = parsedMband.isValid && parsedMband.packetType === 'VITAL' && parsedMband.heartRate === 74 && parsedMband.spO2 === 98 && parsedMband.skinTemp === 36.5;
  results.push({
    name: 'Packet Parser: M-BAND BLEPackets VITAL Prefix',
    passed: test8Passed,
    details: `Type=${parsedMband.packetType}, HR=${parsedMband.heartRate}, SpO2=${parsedMband.spO2}`,
  });

  // Test 9: Packet Parser - M-BAND BLEPackets STATUS & BFIT
  const mbandStatus = 'STATUS:BAT=95,STATE=READY';
  const parsedStatus = parseSensorPacket(mbandStatus);
  const test9Passed = parsedStatus.isValid && parsedStatus.packetType === 'STATUS' && parsedStatus.batteryPercent === 95;
  results.push({
    name: 'Packet Parser: M-BAND BLEPackets STATUS',
    passed: test9Passed,
    details: `Type=${parsedStatus.packetType}, BAT=${parsedStatus.batteryPercent}%`,
  });

  // Test 10: Packet Reassembler - Multi-frame chunk reassembly
  const reassembler = new PacketReassembler();
  const chunk1 = 'VITAL:HR=72,SPO2=98,TE';
  const chunk2 = 'MP=36.5,PPI=833\n';
  const frames1 = reassembler.push(chunk1);
  const frames2 = reassembler.push(chunk2);
  const test10Passed = frames1.length === 0 && frames2.length === 1 && frames2[0] === 'VITAL:HR=72,SPO2=98,TEMP=36.5,PPI=833';
  results.push({
    name: 'Packet Reassembler: Multi-chunk Reassembly',
    passed: test10Passed,
    details: `Frames yielded: ${frames2.length}, Frame: "${frames2[0]}"`,
  });

  // Test 11: B-FIT Signal Quality Gate
  const goodSignal = evaluateBFitSignal(parsedAscii, true);
  const test11Passed = goodSignal.quality === 'GOOD' && goodSignal.displayStatus === 'ALLOW' && goodSignal.sensorContact === true;
  results.push({
    name: 'B-FIT Signal Quality Evaluation',
    passed: test11Passed,
    details: `Quality=${goodSignal.quality}, Status=${goodSignal.displayStatus}, Contact=${goodSignal.sensorContact}`,
  });

  // Test 12: End-to-End Vital Engine Ingestion & DV/IV Derivation
  const engine = new VitalEngine('OVERALL');
  engine.startAcquisition();
  for (let i = 0; i < 15; i++) {
    engine.ingestPacket(`VITAL:HR=${70 + (i % 3)},SPO2=98,TEMP=36.5,PPI=${850 + (i % 20)},IR=12000,AX=0.01,AY=-9.81,AZ=0.01`, true);
  }
  const state = engine.getState(true);
  const hrItem = state.directVitals['hr'];
  const rmssdItem = state.indirectVitals['rmssd'];
  const accelItem = state.directVitals['accel'];
  const maiItem = state.indirectVitals['mai'];
  const test12Passed = hrItem?.liveValue !== null && rmssdItem?.liveValue !== null && accelItem?.liveValue !== null;
  engine.stopAcquisition();
  results.push({
    name: 'End-to-End Engine Ingest & DV/IV Pipeline',
    passed: test12Passed,
    details: `Live HR=${hrItem?.liveValue}, Live RMSSD=${rmssdItem?.liveValue}, Live Accel=${accelItem?.liveValue}, Valid Samples=${state.sampleStats.validSamples}`,
  });

  // Test 13: Resting Motion Vector Stability with Near-Zero Mean & maxStdDev
  const restingMotionSamples = [0.01, 0.02, 0.01, 0.00, 0.02, 0.01, 0.01, 0.02, 0.01, 0.01];
  const motionLockRes = computeRobustVitalLock(restingMotionSamples, {
    isInteger: false,
    minSamples: 8,
    maxCv: 0.50,
    maxStdDev: 0.25,
    decimals: 2,
    minAbsoluteCutoff: 0.05,
  });
  const test13Passed = motionLockRes.isStable && motionLockRes.lockedValue !== null && motionLockRes.lockedValue <= 0.05;
  results.push({
    name: 'Resting Motion Vector Stability (Near-Zero Mean & maxStdDev)',
    passed: test13Passed,
    details: `Locked: ${motionLockRes.lockedValue}g, isStable: ${motionLockRes.isStable}, stdDev: ${motionLockRes.mean}`,
  });

  // Test 14: Dynamic Accel Conversion from m/s^2 vs g
  const rawMs2Packet = parseSensorPacket('VITAL:HR=72,SPO2=98,AX=0.01,AY=-9.81,AZ=0.02');
  const rawGPacket = parseSensorPacket('VITAL:HR=72,SPO2=98,AX=0.01,AY=-1.00,AZ=0.02');
  const test14Passed =
    rawMs2Packet.motionMagnitude !== null &&
    rawMs2Packet.motionMagnitude <= 0.05 &&
    rawGPacket.motionMagnitude !== null &&
    rawGPacket.motionMagnitude <= 0.05;
  results.push({
    name: 'Kinematic Acceleration Vector Normalization (m/s² vs g)',
    passed: test14Passed,
    details: `m/s² Mag=${rawMs2Packet.motionMagnitude}g, g-unit Mag=${rawGPacket.motionMagnitude}g`,
  });

  console.log('==================================================');
  console.log('M-BAND BLE & VITAL PIPELINE VERIFICATION TESTS');
  console.log('==================================================');
  for (const r of results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}: ${r.details}`);
  }

  return results;
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('robustAverager.test')) {
  runAlgorithmVerificationTests();
}
