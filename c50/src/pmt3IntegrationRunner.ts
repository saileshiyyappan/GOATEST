import { runPmt3IntegrationTests } from './pmt3IntegrationTests';

const results = await runPmt3IntegrationTests();
console.log(JSON.stringify({ total: results.length, pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length, blocked: results.filter((r) => r.status === 'BLOCKED').length, results }, null, 2));
if (results.some((r) => r.status === 'FAIL')) process.exitCode = 1;
