import React, { useEffect, useState } from 'react';
import { VitalEngine } from '../../../shb/src/services/vitals/vitalEngine';
import {
  getShbE2EDecision,
  ShbE2EDecision,
} from '../../../shb/src/services/vitals/shbE2ETestSource';
import {
  shbSessionCache,
  ShbCompletedSessionCache,
} from '../../../shb/src/services/vitals/shbSessionCache';
import { compareEngine } from '../../../shb/src/services/compare/compareEngine';
import { createSynchronizedPhbJson } from '../../../shb/src/services/compare/phbNormalizer';
import { runConditionPipeline } from '../../../c50/src/services/condition/conditionPipeline';

type QaCase = { shake: number; event: number };
type QaRun = QaCase & {
  expected: ShbE2EDecision;
  actual: ShbE2EDecision;
  status: string;
  pipeline: boolean;
  passed: boolean;
  error?: string;
};

const MATRIX: QaCase[] = Array.from({ length: 3 }, (_, shake) =>
  Array.from({ length: 3 }, (_, event) => ({ shake, event }))
).flat();

const CRITICAL_CASES: QaCase[] = [
  { shake: 0, event: 0 },
  { shake: 1, event: 1 },
  { shake: 2, event: 2 },
];

const PHB = createSynchronizedPhbJson({
  userId: 'android-qa-user',
  physiological: {
    direct: [
      { name: 'heartRate', value: 72, unit: 'bpm' },
      { name: 'spo2', value: 98, unit: '%' },
      { name: 'ppi', value: 833, unit: 'ms' },
    ],
    indirect: [
      { name: 'rmssd', value: 50, unit: 'ms' },
      { name: 'sdnn', value: 60, unit: 'ms' },
      { name: 'respiratoryRate', value: 16, unit: 'breaths/min' },
    ],
    context: [
      { name: 'activityIntensity', value: 10, unit: 'g' },
      { name: 'ambientTemperature', value: 25, unit: 'C' },
      { name: 'relativeHumidity', value: 50, unit: '%' },
      { name: 'atmosphericPressure', value: 1013, unit: 'hPa' },
      { name: 'altitude', value: 100, unit: 'm' },
    ],
  },
}, 'android-qa-user');

function toSession(state: ReturnType<VitalEngine['getState']>): ShbCompletedSessionCache {
  if (!state.lockedVitals || state.engineStatus !== 'LOCKED') {
    throw new Error('Controlled SHB state did not reach a complete lock');
  }

  return {
    sessionId: state.lockedVitals.sessionId,
    targetOrgan: 'OVERALL',
    acquisitionDuration: state.elapsedSeconds,
    completedAt: Date.now(),
    directVitals: state.directVitals,
    indirectVitals: state.indirectVitals,
    lockedDirectVitals: {
      heartRate: state.lockedVitals.heartRate,
      spo2: state.lockedVitals.spo2,
      ppi: state.lockedVitals.ppi,
      hr: state.lockedVitals.heartRate,
    },
    lockedIndirectVitals: {
      rmssd: state.lockedVitals.rmssd,
      sdnn: state.lockedVitals.sdnn,
      rr: state.lockedVitals.respiratoryRate,
      respiratoryRate: state.lockedVitals.respiratoryRate,
    },
    lockedContextVariables: {
      activityIntensity: state.lockedVitals.activityIntensity,
      ambientTemperature: state.lockedVitals.ambientTemperature,
      relativeHumidity: state.lockedVitals.relativeHumidity,
      atmosphericPressure: state.lockedVitals.atmosphericPressure,
      altitude: state.lockedVitals.altitude,
    },
    bfit: state.bfit,
    sessionStatus: 'COMPLETED',
    finalResultPacket: null,
    lockedVitals: state.lockedVitals,
  };
}

async function runCase(testCase: QaCase): Promise<QaRun> {
  const expected = getShbE2EDecision(testCase);
  const engine = new VitalEngine('OVERALL');
  engine.startAcquisition();
  const state = engine.runControlledE2ECompletion(testCase);
  const actual: ShbE2EDecision = state.engineStatus === 'LOCKED' ? 'LOCK' : 'UNLOCK';
  let pipeline = false;
  let error: string | undefined;

  try {
    if (actual === 'LOCK') {
      const session = toSession(state);
      shbSessionCache.clear();
      shbSessionCache.setSession(session);
      const comparison = compareEngine.computeComparison(PHB, session, 'android-qa-user', 'OVERALL');
      if (comparison.cmPacket.status !== 'COMPUTED' || comparison.cmPacket.parameters.length !== 11) {
        throw new Error(`CM_PACKET invalid: ${comparison.cmPacket.status}`);
      }
      await runConditionPipeline(comparison.cmPacket);
      pipeline = true;
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  return {
    ...testCase,
    expected,
    actual,
    status: state.engineStatus,
    pipeline,
    passed: expected === actual && (actual === 'UNLOCK' || pipeline),
    error,
  };
}

export const AndroidShbQaPage: React.FC = () => {
  const [runs, setRuns] = useState<QaRun[]>([]);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const execute = async () => {
      const cases = [...MATRIX, ...Array.from({ length: 5 }, () => CRITICAL_CASES).flat()];
      const results: QaRun[] = [];
      for (const testCase of cases) {
        const result = await runCase(testCase);
        results.push(result);
        if (!cancelled) setRuns([...results]);
      }
      if (cancelled) return;
      const passed = results.filter((result) => result.passed).length;
      const result = {
        status: passed === results.length ? 'PASS' : 'FAIL',
        total: results.length,
        passed,
        failed: results.length - passed,
        blocked: 0,
        lockMatrix: results.slice(0, MATRIX.length),
        repeatedRuns: results.slice(MATRIX.length),
        endToEnd: {
          shb: results.some((item) => item.actual === 'LOCK'),
          compare: results.some((item) => item.pipeline),
          c50: results.some((item) => item.pipeline),
          condition: results.some((item) => item.pipeline),
          result: results.some((item) => item.pipeline),
        },
      };
      (window as Window & { __GOATEST_ANDROID_E2E_RESULT__?: unknown }).__GOATEST_ANDROID_E2E_RESULT__ = result;
      console.log('GOATEST_ANDROID_E2E_RESULT', JSON.stringify(result));
      setComplete(true);
    };
    void execute();
    return () => {
      cancelled = true;
    };
  }, []);

  const passed = runs.filter((run) => run.passed).length;
  return (
    <main style={{ minHeight: '100vh', background: '#100e0e', color: '#fff', padding: 24, fontFamily: 'monospace' }}>
      <h1>ANDROID SHB QA</h1>
      <p>{complete ? `QA_STATUS ${passed}/${runs.length} PASS` : `QA_RUNNING ${runs.length}`}</p>
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {runs.map((run) => `${run.shake}/${run.event} expected=${run.expected} actual=${run.actual} status=${run.status} pipeline=${run.pipeline} ${run.passed ? 'PASS' : `FAIL ${run.error ?? ''}`}`).join('\n')}
      </pre>
    </main>
  );
};
