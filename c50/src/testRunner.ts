import { runAutomatedTestSuite } from './engine/automatedTests';
import { generateCMPacket } from './engine/compareEngine';

console.log('============================================================');
console.log('BAND V1 COMPARE STAGE 0-5 ALGORITHM TEST RUNNER');
console.log('============================================================\n');

// 1. Run 11-Parameter CM_PACKET Test
// Using representative prototype inputs matching prompt examples
const testInputs = [
  { parameterId: 'heart_rate', phbBaseline: 67, shbValue: 93 }, // DEV = +26 -> stage 4, boundary 36
  { parameterId: 'spo2', phbBaseline: 99, shbValue: 99 }, // DEV = 0 -> stage 0, boundary 0
  { parameterId: 'ppi', phbBaseline: 850, shbValue: 780 }, // DEV = -70 -> distance 70 <= 90 -> stage 3, boundary 90
  { parameterId: 'rmssd', phbBaseline: 50, shbValue: 164.8 }, // DEV = +114.8 -> distance 114.8 > 100 -> stage 5, beyond=true
  { parameterId: 'sdnn', phbBaseline: 65, shbValue: 58 }, // DEV = -7 -> distance 7 <= 10 -> stage 1, boundary 10
  { parameterId: 'respiratory_rate', phbBaseline: 16, shbValue: 18 }, // DEV = +2 -> distance 2 <= 3 -> stage 2, boundary 3
  { parameterId: 'activity_intensity', phbBaseline: 1.0, shbValue: 4.5 }, // DEV = +3.5 -> distance 3.5 <= 5.0 -> stage 4, boundary 5.0
  { parameterId: 'ambient_temperature', phbBaseline: 22.0, shbValue: 24.5 }, // DEV = +2.5 -> distance 2.5 <= 5.0 -> stage 2, boundary 5.0
  { parameterId: 'relative_humidity', phbBaseline: 45.0, shbValue: 41.0 }, // DEV = -4.0 -> distance 4.0 <= 5.0 -> stage 1, boundary 5.0
  { parameterId: 'atmospheric_pressure', phbBaseline: 1013.0, shbValue: 1010.0 }, // DEV = -3.0 -> distance 3.0 <= 5.0 -> stage 1, boundary 5.0
  { parameterId: 'altitude', phbBaseline: 150.0, shbValue: 240.0 }, // DEV = +90.0 -> distance 90.0 <= 120.0 -> stage 3, boundary 120.0
];

const packet = generateCMPacket(testInputs);

console.log('--- 11-PARAMETER CM_PACKET TEST ---');
packet.results.forEach((r, idx) => {
  console.log(
    `[${idx + 1}] ${r.parameterName.padEnd(22)} | PHB: ${String(r.phbBaseline).padStart(6)} | SHB: ${String(r.shbValue).padStart(6)} | DEV: ${String(r.deviation >= 0 ? '+' + r.deviation : r.deviation).padStart(7)} | Dist: ${String(r.deviationDistance).padStart(6)} | Boundaries: [${r.cumulativeBoundaries.join(',')}] | Stage: ${r.matchedStage} | Boundary: ${String(r.matchedBoundary).padStart(4)} | phbDevs: ${String(r.phbDevs).padStart(5)} | shbDevs: ${String(r.shbDevs).padStart(7)} | compare: ${String(r.compare).padStart(6)} | Dir: ${r.direction.padEnd(8)} | compareStage: ${r.compareStage} | Status: ${r.status}`
  );
});

console.log('\nFINAL ML VECTOR:');
console.log(JSON.stringify(packet.mlVector));
console.log(`Packet Consistency Valid: ${packet.isAllValid}`);

console.log('\n--- AUTOMATED TEST SUITE (A to P) ---');
const testSuiteResults = runAutomatedTestSuite();
let allPassed = true;
testSuiteResults.forEach((t) => {
  const mark = t.passed ? 'PASS' : 'FAIL';
  if (!t.passed) allPassed = false;
  console.log(`[${mark}] ${t.id} - ${t.name}: ${t.description}`);
  if (!t.passed) {
    console.log(`   Expected:`, t.expected);
    console.log(`   Actual:`, t.actual);
  }
});

console.log(`\nAutomated Test Suite Summary: ${allPassed ? 'ALL TESTS PASSED' : 'TESTS FAILED'}`);
