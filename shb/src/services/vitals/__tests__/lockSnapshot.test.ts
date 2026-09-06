import { VitalEngine } from '../vitalEngine';

export function runLockSnapshotTests() {
  const results: { name: string; passed: boolean; details: string }[] = [];
  const engine = new VitalEngine('OVERALL');
  engine.startAcquisition();

  for (let index = 0; index < 15; index += 1) {
    engine.ingestPacket(
      `VITAL:HR=${70 + (index % 2)},SPO2=98,TEMP=24.5,PPI=${850 + (index % 2)},HUM=45,PRES=1013.2,ALT=120,AX=0.01,AY=-9.81,AZ=0.01`,
      true,
    );
  }

  engine.executeLock();
  const lockedState = engine.getState(true);
  const snapshot = lockedState.lockedVitals;
  const complete = Boolean(
    snapshot?.lockComplete &&
      snapshot.lockedCount === 11 &&
      Object.values(snapshot).length > 0 &&
      Number.isFinite(snapshot.heartRate) &&
      Number.isFinite(snapshot.spo2) &&
      Number.isFinite(snapshot.ppi) &&
      Number.isFinite(snapshot.rmssd) &&
      Number.isFinite(snapshot.sdnn) &&
      Number.isFinite(snapshot.respiratoryRate) &&
      Number.isFinite(snapshot.activityIntensity) &&
      Number.isFinite(snapshot.ambientTemperature) &&
      Number.isFinite(snapshot.relativeHumidity) &&
      Number.isFinite(snapshot.atmosphericPressure) &&
      Number.isFinite(snapshot.altitude),
  );
  results.push({
    name: 'Atomic 11/11 lock includes CX',
    passed: complete && lockedState.engineStatus === 'LOCKED',
    details: `status=${lockedState.engineStatus}, lockedCount=${snapshot?.lockedCount ?? 0}`,
  });

  const lockedHeartRate = snapshot?.heartRate;
  engine.ingestPacket('VITAL:HR=180,SPO2=98,TEMP=24.5,PPI=333,HUM=45,PRES=1013.2,ALT=120,AX=0.5,AY=-9.5,AZ=0.5', true);
  const afterUpdate = engine.getState(true);
  results.push({
    name: 'Locked snapshot remains immutable after live update',
    passed: afterUpdate.lockedVitals?.heartRate === lockedHeartRate && afterUpdate.lockedVitals === snapshot,
    details: `before=${lockedHeartRate}, after=${afterUpdate.lockedVitals?.heartRate}`,
  });

  engine.reset('OVERALL');
  const resetState = engine.getState(true);
  results.push({
    name: 'New session starts without prior lock',
    passed: resetState.lockedVitals === null && resetState.engineStatus === 'IDLE',
    details: `lockedVitals=${resetState.lockedVitals}, status=${resetState.engineStatus}`,
  });

  return results;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const results = runLockSnapshotTests();
  for (const result of results) {
    console.log(`${result.passed ? '[PASS]' : '[FAIL]'} ${result.name}: ${result.details}`);
  }
  if (results.some((result) => !result.passed)) process.exit(1);
}
