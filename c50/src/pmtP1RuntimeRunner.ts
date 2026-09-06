import {runP1RuntimeTests, type P1Result} from './pmtP1RuntimeTests';

const results: P1Result[] = runP1RuntimeTests();
for (const item of results) console.log(`${item.status} ${item.id} — ${item.detail}`);
const failed = results.filter((item) => item.status === 'FAIL');
const blocked = results.filter((item) => item.status === 'BLOCKED — environment');
console.log(`PMT-P1 summary: PASS=0 FAIL=${failed.length} BLOCKED=${blocked.length}`);
process.exitCode = failed.length ? 1 : 0;
