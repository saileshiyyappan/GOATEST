import {runPmt5RuntimeTests, type Pmt5Result} from './pmt5RuntimeTests';

const results: Pmt5Result[] = runPmt5RuntimeTests();
for (const item of results) console.log(`${item.status} ${item.id} — ${item.detail}`);
const failed = results.filter((item) => item.status === 'FAIL');
const blocked = results.filter((item) => item.status === 'BLOCKED');
console.log(`PMT-5 summary: PASS=${results.length - failed.length - blocked.length} FAIL=${failed.length} BLOCKED=${blocked.length}`);
process.exitCode = failed.length ? 1 : 0;
