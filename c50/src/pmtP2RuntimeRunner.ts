import { runP2RuntimeTests } from './pmtP2RuntimeTests';

const results = runP2RuntimeTests();
for (const item of results) console.log(`${item.status} ${item.id} — ${item.detail}`);
const counts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
for (const item of results) counts[item.status] += 1;
console.log(`PMT-P2 summary: PASS=${counts.PASS} FAIL=${counts.FAIL} BLOCKED=${counts.BLOCKED}`);
process.exitCode = counts.FAIL > 0 ? 1 : 0;
