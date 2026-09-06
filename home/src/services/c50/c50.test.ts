/**
 * GOATEST C50 Machine Learning Subsystem Tests
 * 
 * PMT-2 Verification Suite:
 * 1. CM_PACKET -> C50_INPUT_PACKET conversion
 * 2. Missing parameter handling (preserved without invented values)
 * 3. Non-finite value rejection (NaN, Infinity)
 * 4. sourceCmPacketId preservation
 * 5. Milestone preservation (TEST, DAY, WEEK, MONTH)
 * 6. C50 result validation
 * 7. Raw ML output preservation
 * 8. Firestore / Local result persistence
 * 9. Authentication ownership enforcement
 * 10. ML-not-configured handling
 * 11. Malformed ML response rejection
 * 12. Model version preservation
 */

import {
  c50InputAdapter,
  findNonFiniteValuePath,
  C50InputValidationError,
} from './c50InputAdapter';
import {
  c50Service,
  validateC50ModelResponse,
  C50ServiceError,
} from './c50Service';
import { c50ResultService } from './c50ResultService';
import type {
  CmPacketInput,
  C50InputPacket,
  C50ResultPacket,
} from './c50Packet';

export interface TestResultItem {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runC50TestSuite(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];

  function record(id: string, name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        return (res as Promise<void>)
          .then(() => {
            results.push({ id, name, passed: true });
          })
          .catch((err) => {
            results.push({ id, name, passed: false, error: (err as Error).message });
          });
      }
      results.push({ id, name, passed: true });
      return Promise.resolve();
    } catch (err) {
      results.push({ id, name, passed: false, error: (err as Error).message });
      return Promise.resolve();
    }
  }

  // 1. CM_PACKET -> C50_INPUT_PACKET transformation
  await record('TEST_1', 'CM_PACKET to C50_INPUT_PACKET transformation', () => {
    const rawCm: CmPacketInput = {
      packetId: 'cm_test_001',
      userId: 'usr_test_123',
      sessionId: 'sess_001',
      timestamp: '2026-08-23T12:00:00.000Z',
      target: 'Cardiovascular',
      milestone: 'TEST',
      parameters: {
        hr: {
          name: 'Heart Rate',
          phbBaseline: 72,
          shbValue: 78,
          shbDeviation: 6,
          absDeviationDistance: 6,
          direction: 'POSITIVE',
          phbRawStageMagnitudes: [5, 10, 15],
          cumulativePhbBoundaries: [77, 82, 87],
          matchedStage: 1,
          phbDevs: 1.2,
          shbDevs: 1.2,
        },
      },
    };

    const inputPacket = c50InputAdapter.adapt(rawCm);
    if (!inputPacket.inputId.startsWith('c50_in_test_')) throw new Error('Invalid inputId prefix');
    if (inputPacket.userId !== 'usr_test_123') throw new Error('userId mismatch');
    if (inputPacket.sourceCmPacketId !== 'cm_test_001') throw new Error('sourceCmPacketId not preserved');
    if (inputPacket.physiologicalFeatures.hr !== 78) throw new Error('physiologicalFeatures.hr mismatch');
    if (inputPacket.deviationFeatures.hr.shbDeviation !== 6) throw new Error('shbDeviation mismatch');
    if (inputPacket.deviationFeatures.hr.matchedStage !== 1) throw new Error('matchedStage mismatch');
  });

  // 2. Missing parameter handling (preserved as null/undefined without inventing values)
  await record('TEST_2', 'Missing parameters preserved without fabrication', () => {
    const rawCm: CmPacketInput = {
      packetId: 'cm_missing_test',
      userId: 'usr_test_123',
      sessionId: 'sess_002',
      timestamp: '2026-08-23T12:00:00.000Z',
      target: 'Respiratory',
      milestone: 'TEST',
      parameters: {
        spo2: {
          shbValue: 98,
          phbBaseline: null,
          shbDeviation: null,
          direction: null,
        },
      },
    };

    const inputPacket = c50InputAdapter.adapt(rawCm);
    if (inputPacket.deviationFeatures.spo2.phbBaseline !== null) {
      throw new Error('Missing phbBaseline was modified');
    }
    if (inputPacket.deviationFeatures.spo2.shbDeviation !== null) {
      throw new Error('Missing shbDeviation was modified');
    }
    // Verify unmeasured parameter is undefined
    if (inputPacket.physiologicalFeatures.hr !== undefined) {
      throw new Error('Unmeasured HR was fabricated');
    }
  });

  // 3. Non-finite value rejection (NaN, Infinity)
  await record('TEST_3', 'Rejects non-finite values (NaN, Infinity)', () => {
    const rawCmNaN: CmPacketInput = {
      packetId: 'cm_nan',
      userId: 'usr_test_123',
      sessionId: 'sess_nan',
      timestamp: '2026-08-23T12:00:00.000Z',
      target: 'Cardiovascular',
      parameters: {
        hr: {
          shbValue: NaN,
        },
      },
    };

    let errorThrown = false;
    try {
      c50InputAdapter.adapt(rawCmNaN);
    } catch (err) {
      errorThrown = true;
      if (!(err instanceof C50InputValidationError)) {
        throw new Error('Expected C50InputValidationError');
      }
    }
    if (!errorThrown) throw new Error('Failed to reject NaN in CM_PACKET');

    const rawCmInf: CmPacketInput = {
      packetId: 'cm_inf',
      userId: 'usr_test_123',
      sessionId: 'sess_inf',
      timestamp: '2026-08-23T12:00:00.000Z',
      target: 'Cardiovascular',
      parameters: {
        hr: {
          shbValue: Infinity,
        },
      },
    };

    errorThrown = false;
    try {
      c50InputAdapter.adapt(rawCmInf);
    } catch (err) {
      errorThrown = true;
    }
    if (!errorThrown) throw new Error('Failed to reject Infinity in CM_PACKET');
  });

  // 4. sourceCmPacketId preservation
  await record('TEST_4', 'sourceCmPacketId preserved across transformations', () => {
    const cmId = 'cm_preserve_9988';
    const rawCm: CmPacketInput = {
      packetId: cmId,
      userId: 'usr_456',
      sessionId: 'sess_456',
      timestamp: '2026-08-23T12:00:00.000Z',
      target: 'Hepatic',
    };

    const inputPacket = c50InputAdapter.adapt(rawCm);
    if (inputPacket.sourceCmPacketId !== cmId) {
      throw new Error(`sourceCmPacketId expected ${cmId}, got ${inputPacket.sourceCmPacketId}`);
    }
  });

  // 5. Milestone preservation (TEST, DAY, WEEK, MONTH)
  await record('TEST_5', 'Milestone types preserved across all 4 milestones', () => {
    const milestones = ['TEST', 'DAY', 'WEEK', 'MONTH'] as const;
    for (const m of milestones) {
      const rawCm: CmPacketInput = {
        packetId: `cm_${m.toLowerCase()}`,
        userId: 'usr_m',
        sessionId: 'sess_m',
        timestamp: '2026-08-23T12:00:00.000Z',
        target: 'Systemic',
        milestone: m,
      };
      const packet = c50InputAdapter.adapt(rawCm);
      if (packet.milestone !== m) {
        throw new Error(`Expected milestone ${m}, got ${packet.milestone}`);
      }
    }
  });

  // 6. C50 result response validation
  await record('TEST_6', 'C50 model response validation', () => {
    const validRaw = {
      modelVersion: 'C50_PROD_1.0',
      predictionPayload: { stagePrediction: 2 },
      featureSummary: { vectorLength: 12 },
      trendSummary: { deltaScore: 0.15 },
      classification: 'NORMAL',
      confidence: 0.94,
    };

    const validated = validateC50ModelResponse(validRaw, 'input_123');
    if (validated.modelVersion !== 'C50_PROD_1.0') throw new Error('modelVersion mismatch');
    if (validated.confidence !== 0.94) throw new Error('confidence mismatch');
    if (validated.classification !== 'NORMAL') throw new Error('classification mismatch');
  });

  // 7. Raw ML output preservation
  await record('TEST_7', 'Raw ML response is retained untouched in C50ResultPacket', async () => {
    const inputPacket: C50InputPacket = {
      version: '1.0.0',
      inputId: 'c50_in_fixture_1',
      sourceCmPacketId: 'cm_fixture_1',
      userId: 'usr_test_fixture',
      sessionId: 'sess_fixture',
      target: 'Cardiovascular',
      timestamp: '2026-08-23T12:00:00.000Z',
      milestone: 'TEST',
      physiologicalFeatures: { hr: 75 },
      deviationFeatures: {},
      stageFeatures: {},
      sourceMetadata: { source: 'TEST_FIXTURE', adapterVersion: '1.0.0', isDevelopmentFixture: true },
      isDevelopmentFixture: true,
    };

    const result = await c50Service.runInference(inputPacket);
    if (!result.rawResponse || typeof result.rawResponse !== 'object') {
      throw new Error('Raw response missing or not object');
    }
    if (result.sourceInputId !== 'c50_in_fixture_1') {
      throw new Error('sourceInputId not linked');
    }
    if (result.sourceCmPacketId !== 'cm_fixture_1') {
      throw new Error('sourceCmPacketId not linked');
    }
  });

  // 8. Result persistence in Firestore and local storage
  await record('TEST_8', 'C50ResultService persistence and retrieval', async () => {
    const testResult: C50ResultPacket = {
      version: '1.0.0',
      resultId: `c50_test_res_${Date.now()}`,
      sourceInputId: 'in_persist_1',
      sourceCmPacketId: 'cm_persist_1',
      userId: 'usr_persist_test',
      milestone: 'TEST',
      timestamp: new Date().toISOString(),
      modelVersion: 'C50_TEST_V1',
      status: 'SUCCESS',
      predictionPayload: { test: true },
      rawResponse: { rawVal: 42 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await c50ResultService.saveResult(testResult);
    const retrieved = await c50ResultService.getResultById(testResult.resultId);
    if (!retrieved) throw new Error('Failed to retrieve saved C50 result');
    if (retrieved.sourceInputId !== 'in_persist_1') throw new Error('sourceInputId mismatch in retrieved record');
  });

  // 9. Authentication ownership enforcement
  await record('TEST_9', 'Authentication ownership query filtering', async () => {
    const userA = 'usr_owner_a';
    const userB = 'usr_owner_b';

    const resultA: C50ResultPacket = {
      version: '1.0.0',
      resultId: `c50_res_a_${Date.now()}`,
      sourceInputId: 'in_a',
      sourceCmPacketId: 'cm_a',
      userId: userA,
      milestone: 'TEST',
      timestamp: new Date().toISOString(),
      modelVersion: 'C50_V1',
      status: 'SUCCESS',
      rawResponse: { user: 'A' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await c50ResultService.saveResult(resultA);
    const resultsForB = await c50ResultService.getUserResults(userB);
    const hasAInB = resultsForB.some((r) => r.userId === userA);
    if (hasAInB) throw new Error('User B was able to access User A results');
  });

  // 10. ML-not-configured handling (returns ML_NOT_CONFIGURED with zero fake clinical data)
  await record('TEST_10', 'Handles unconfigured ML engine safely with zero fake data', async () => {
    const nonFixtureInput: C50InputPacket = {
      version: '1.0.0',
      inputId: 'in_unconf_1',
      sourceCmPacketId: 'cm_unconf_1',
      userId: 'usr_real_1',
      sessionId: 'sess_real',
      target: 'Neurological',
      timestamp: new Date().toISOString(),
      milestone: 'DAY',
      physiologicalFeatures: { hr: 70 },
      deviationFeatures: {},
      stageFeatures: {},
      sourceMetadata: { source: 'REAL_PIPELINE', adapterVersion: '1.0.0' },
      isDevelopmentFixture: false,
    };

    const result = await c50Service.runInference(nonFixtureInput);
    if (result.status === 'ML_NOT_CONFIGURED') {
      if (result.classification !== null) throw new Error('Fabricated classification in unconfigured state');
      if (result.confidence !== null) throw new Error('Fabricated confidence in unconfigured state');
      if (result.predictionPayload !== null) throw new Error('Fabricated predictions in unconfigured state');
    }
  });

  // 11. Malformed ML response rejection
  await record('TEST_11', 'Rejects malformed ML responses', () => {
    let errorThrown = false;
    try {
      validateC50ModelResponse(null, 'in_123');
    } catch (err) {
      errorThrown = true;
      if (!(err instanceof C50ServiceError)) throw new Error('Expected C50ServiceError');
    }
    if (!errorThrown) throw new Error('Failed to reject null response');

    errorThrown = false;
    try {
      validateC50ModelResponse({ error: 'External model GPU out of memory', status: 'ERROR' }, 'in_123');
    } catch (err) {
      errorThrown = true;
    }
    if (!errorThrown) throw new Error('Failed to reject model error payload');
  });

  // 12. Model version preservation
  await record('TEST_12', 'Preserves modelVersion across validation', () => {
    const validated = validateC50ModelResponse({ modelVersion: 'C50_PYTORCH_2.4.1' }, 'in_123');
    if (validated.modelVersion !== 'C50_PYTORCH_2.4.1') {
      throw new Error(`Expected C50_PYTORCH_2.4.1, got ${validated.modelVersion}`);
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    total: results.length,
    passed: passedCount,
    results,
  };
}
