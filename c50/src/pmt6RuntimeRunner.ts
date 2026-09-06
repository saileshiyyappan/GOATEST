import {runPmt6RuntimeTests, type Pmt6Result} from './pmt6RuntimeTests';

const results: Pmt6Result[] = runPmt6RuntimeTests();
for (const item of results) console.log(`${item.status} ${item.id} — ${item.detail}`);
const failed = results.filter((item) => item.status === 'FAIL');
const blocked = results.filter((item) => item.status === 'BLOCKED');
const notExecuted = results.filter((item) => item.status === 'NOT EXECUTED');
console.log(`PMT-6 summary: PASS=0 FAIL=${failed.length} BLOCKED=${blocked.length} NOT_EXECUTED=${notExecuted.length}`);
process.exitCode = failed.length ? 1 : 0;
