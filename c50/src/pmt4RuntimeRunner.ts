import {runPmt4RuntimeTests, type Pmt4Result} from './pmt4RuntimeTests';

const results: Pmt4Result[] = runPmt4RuntimeTests();
for (const result of results) {
  console.log(`${result.status} ${result.id} — ${result.detail}`);
}

const failures = results.filter((result) => result.status === 'FAIL');
const blocked = results.filter((result) => result.status === 'BLOCKED');
console.log(`PMT-4 summary: PASS=${results.length - failures.length - blocked.length} FAIL=${failures.length} BLOCKED=${blocked.length}`);
process.exitCode = failures.length > 0 ? 1 : 0;
