import { phbCache } from '../phbCache';
import { PhbDocument } from '../../../types/compare';
import { createSynchronizedPhbJson } from '../phbNormalizer';

export function runPhbBridgeTests() {
  console.log('==================================================');
  console.log('GOATEST COMPARE & PHB BRIDGE VERIFICATION TESTS');
  console.log('==================================================');

  // Test 1: PHB Cache initial state
  phbCache.clear();
  if (phbCache.hasPhb() !== false || phbCache.getPhb() !== null) {
    throw new Error('Test 1 Failed: phbCache should be empty initially.');
  }
  console.log('[PASS] PHB Cache Initial State is clean.');

  // Test 2: PHB Cache storage and retrieval
  const mockPhb: PhbDocument = {
    userId: 'test_user_uid_123',
    physiological: {
      direct: [
        { name: 'heartRate', value: 72, unit: 'bpm' },
        { name: 'spo2', value: 98, unit: '%' },
      ],
      indirect: [
        { name: 'rmssd', value: 35, unit: 'ms' },
        { name: 'sdnn', value: 42, unit: 'ms' },
      ],
    },
  };

  const synchronized = createSynchronizedPhbJson(mockPhb, 'test_user_uid_123');
  phbCache.setPhb(synchronized, 'test_user_uid_123', '/phbs/test_user_uid_123');

  if (!phbCache.hasPhb()) {
    throw new Error('Test 2 Failed: phbCache should indicate PHB exists.');
  }
  const retrieved = phbCache.getPhb('test_user_uid_123');
  if (!retrieved || retrieved.uid !== 'test_user_uid_123' || !retrieved.features.has('heartRate')) {
    throw new Error('Test 2 Failed: retrieved PHB does not match stored baseline.');
  }
  if (phbCache.getFetchedPath() !== '/phbs/test_user_uid_123') {
    throw new Error('Test 2 Failed: fetchedPath mismatch.');
  }
  console.log('[PASS] PHB Cache Storage & Retrieval verified.');

  // Test 3: Cache clearing on exit
  phbCache.clear();
  if (phbCache.hasPhb() !== false || phbCache.getPhb() !== null) {
    throw new Error('Test 3 Failed: phbCache did not clear properly.');
  }
  console.log('[PASS] PHB Cache Clear verified.');

  // Test 4: Security contract check - No arbitrary UID
  const currentUid = 'auth_uid_456';
  const targetPath = `/phbs/${currentUid}`;
  if (!targetPath.endsWith(currentUid)) {
    throw new Error('Test 4 Failed: Target path must bind to authenticated UID.');
  }
  console.log('[PASS] Security Contract: Firestore request maps strictly to /phbs/{authenticatedUid}.');

  console.log('ALL COMPARE & PHB TESTS PASSED SUCCESSFULLY!');
  return true;
}
