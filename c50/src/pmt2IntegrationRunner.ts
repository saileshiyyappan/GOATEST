import { runPmt2IntegrationTests } from './pmt2IntegrationTests';

const results = runPmt2IntegrationTests();
console.log(JSON.stringify({ total: results.length, passed: results.filter((result) => result.passed).length, allPassed: results.every((result) => result.passed), tests: results }, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
