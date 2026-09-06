import { runAllCribTests } from './cribInputAdapter.test';
import { runAllSdcuTests } from '../sdcu/__tests__/sdcuStateMachine.test';
import { runAllSsbTests } from '../ssb/__tests__/ssbStateMachine.test';
import { runAllPmt6Tests } from './pmt6PanelDensity.test';
import { runAllDiagTests } from '../diag/__tests__/diagStateMachine.test';
import { runAllAiServiceTests } from './cribAiService.test';
import { runAllMediaExpansionTests } from './mediaContainerExpansion.test';

console.log('====================================================');
console.log('RUNNING FULL CRIB SYSTEM DETERMINISTIC TEST SUITE');
console.log('====================================================\n');

const res1 = runAllCribTests();
console.log('\n');
const res2 = runAllSdcuTests();
console.log('\n');
const res3 = runAllSsbTests();
console.log('\n');
const res4 = runAllPmt6Tests();
console.log('\n');
const res5 = runAllDiagTests();
console.log('\n');
const res6 = runAllAiServiceTests();
console.log('\n');
const res7 = runAllMediaExpansionTests();

const totalPassed =
  res1.passed + res2.passed + res3.passed + res4.passed + res5.passed + res6.passed + res7.passed;
const totalFailed =
  res1.failed + res2.failed + res3.failed + res4.failed + res5.failed + res6.failed + res7.failed;

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('====================================================');

if (totalFailed > 0) {
  console.error(`\nTest suite failed with ${totalFailed} errors.`);
  process.exit(1);
} else {
  console.log(`\nALL ${totalPassed} SYSTEM TESTS PASSED CLEANLY!`);
  process.exit(0);
}



