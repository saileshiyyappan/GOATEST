import { getShbE2EDecision } from '../shbE2ETestSource';

const expected = new Map<string, 'LOCK' | 'UNLOCK'>([
  ['0/0', 'LOCK'],
  ['0/1', 'LOCK'],
  ['0/2', 'LOCK'],
  ['1/0', 'LOCK'],
  ['1/1', 'LOCK'],
  ['1/2', 'LOCK'],
  ['2/0', 'LOCK'],
  ['2/1', 'LOCK'],
  ['2/2', 'UNLOCK'],
]);

for (const [key, decision] of expected) {
  const [shake, event] = key.split('/').map(Number);
  const actual = getShbE2EDecision({ shake, event });
  if (actual !== decision) {
    throw new Error(`Controlled lock invariant failed for ${key}: expected ${decision}, got ${actual}`);
  }
}

console.log(`[PASS] Controlled SHB lock matrix: ${expected.size}/${expected.size}`);
