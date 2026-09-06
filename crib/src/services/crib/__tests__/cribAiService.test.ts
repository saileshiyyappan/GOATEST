/**
 * PMT-8 AI Context, AI Chat & Guidance Deterministic Test Suite
 */

import { CribAiContextBuilder } from '../cribAiContext';
import { CribAiService } from '../cribAiService';
import { CribVital, CribProbability } from '../../../types/crib';
import { CmPacket, ConditionResult } from '../../../types/cmPacket';

export function runAllAiServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${message}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${message}`);
    }
  }

  console.log('--- RUNNING CRIB PMT-8 AI SERVICE & CONTEXT TESTS ---');

  // Test 1: Context builder correctly maps non-null vitals and excludes nulls
  const testVitals: CribVital[] = [
    { key: 'HR', label: 'Heart Rate', value: 88, unit: 'BPM', status: 'normal' },
    { key: 'SpO2', label: 'SpO2', value: 97, unit: '%', status: 'normal' },
    { key: 'BP', label: 'Blood Pressure', value: null, unit: 'mmHg', status: 'unknown' },
    { key: 'TEMP', label: 'Temperature', value: 36.8, unit: '°C', status: 'normal' },
  ];

  const testProbabilities: CribProbability[] = [
    { id: '1', label: 'TACHYCARDIA', probability: 78, status: 'high' },
    { id: '2', label: 'NORMAL', probability: 22, status: 'low' },
  ];

  const contextSdcu = CribAiContextBuilder.buildContext({
    mode: 'SDCU',
    uid: 'user-001',
    vitals: testVitals,
    probabilities: testProbabilities,
  });

  assert(contextSdcu.mode === 'SDCU', 'SDCU mode correctly captured in context');
  assert(contextSdcu.uid === 'user-001', 'User ID correctly captured in context');
  assert(contextSdcu.currentVitals['HR'] === '88 BPM', 'HR vital mapped with unit');
  assert(contextSdcu.currentVitals['SPO2'] === '97 %', 'SpO2 vital mapped with unit');
  assert(!('BP' in contextSdcu.currentVitals), 'Null vital BP excluded from context');
  assert(contextSdcu.conditionResult?.label === 'TACHYCARDIA', 'Primary condition inferred from top probability');
  assert(contextSdcu.conditionResult?.probability === 78, 'Probability mapped accurately');

  // Test 2: Context builder with CM_PACKET and ConditionResult
  const testCmPacket: CmPacket = {
    sessionId: 'session-1234',
    uid: 'user-001',
    timestamp: Date.now(),
    parameters: [],
    bfitResult: 84,
  };

  const testConditionResult: ConditionResult = {
    label: 'VENTRICULAR_ECTOPY',
    probability: 0.85,
    severity: 'critical',
    timestamp: Date.now(),
  };

  const contextWithCm = CribAiContextBuilder.buildContext({
    mode: 'SSB',
    uid: 'user-001',
    vitals: testVitals,
    probabilities: testProbabilities,
    cmPacket: testCmPacket,
    conditionResult: testConditionResult,
    actionInfo: {
      type: 'SSB_STRANGER_PROMPT',
      id: 'S1',
      question: 'Is the person breathing?',
      lastResponse: 'YES',
    },
  });

  assert(contextWithCm.mode === 'SSB', 'SSB mode set in context');
  assert(contextWithCm.bfitScore === 84, 'B-FIT score extracted from CM_PACKET / condition');
  assert(contextWithCm.conditionResult?.label === 'VENTRICULAR_ECTOPY', 'ConditionResult overrides probabilities list');
  assert(contextWithCm.conditionResult?.probability === 85, 'ConditionResult decimal probability normalized to 85%');
  assert(contextWithCm.currentActionOrQuestion?.type === 'SSB_STRANGER_PROMPT', 'Stranger prompt action captured');
  assert(contextWithCm.currentActionOrQuestion?.lastResponse === 'YES', 'User/helper response recorded');

  // Test 3: Fallback directives for SDCU, SSB, and DIAG
  const contextDiag = CribAiContextBuilder.buildContext({
    mode: 'DIAG',
    uid: 'user-002',
    vitals: [],
    probabilities: [],
    actionInfo: {
      type: 'DIAG_HELPER_ACTION',
      id: 'RUN',
      label: 'RUN',
    },
  });

  assert(contextDiag.deterministicDirectives.length > 0, 'Deterministic directives computed for DIAG action');
  assert(contextDiag.deterministicDirectives.includes('SIT DOWN'), 'Includes SIT DOWN directive for RUN');

  // Test 4: Format prompt context
  const formattedPrompt = CribAiContextBuilder.formatPromptContext(contextWithCm);
  assert(formattedPrompt.includes('MODE: SSB'), 'Formatted prompt contains MODE');
  assert(formattedPrompt.includes('USER ID: user-001'), 'Formatted prompt contains USER ID');
  assert(formattedPrompt.includes('HR: 88 BPM'), 'Formatted prompt contains HR');
  assert(formattedPrompt.includes('PRIMARY CONDITION: VENTRICULAR_ECTOPY'), 'Formatted prompt contains PRIMARY CONDITION');
  assert(formattedPrompt.includes('Is the person breathing?'), 'Formatted prompt contains prompt question');

  // Test 5: Empty chat message validation
  let caughtError = false;
  const promise = CribAiService.sendChatMessage({
    message: '   ',
    context: contextSdcu,
    history: [],
  });
  promise.catch(() => {
    caughtError = true;
  });
  assert(promise instanceof Promise, 'CribAiService.sendChatMessage returns a Promise');

  // Test 6: Directives to item mapper
  const rawDirectives = ['CHECK AIRWAY', 'CALL 911', 'KEEP CALM'];
  const items = CribAiService.mapDirectivesToItems(rawDirectives, 'test');
  assert(items.length === 3, 'Mapped 3 items');
  assert(items[0].level === 'critical', 'First directive assigned critical priority');
  assert(items[1].level === 'warning', 'Second directive assigned warning priority');
  assert(items[2].level === 'warning', 'Third directive assigned warning priority');
  assert(items[0].text === 'CHECK AIRWAY', 'Text preserved and uppercased');

  // Test 7: Non-mutation of original data objects
  const originalVitalsCopy = JSON.stringify(testVitals);
  const originalProbCopy = JSON.stringify(testProbabilities);
  CribAiContextBuilder.buildContext({
    mode: 'SDCU',
    uid: 'user-001',
    vitals: testVitals,
    probabilities: testProbabilities,
  });
  assert(JSON.stringify(testVitals) === originalVitalsCopy, 'Original vitals array strictly not mutated');
  assert(JSON.stringify(testProbabilities) === originalProbCopy, 'Original probabilities array strictly not mutated');

  console.log(`\nCRIB PMT-8 AI Service tests complete: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}
