import { useState, useEffect, useRef, useCallback } from 'react';
import { useDevice } from '../context/DeviceContext';
import { LiveVitalsState, OrganCategoryId, ShbFinalResultPacket } from '../types/shb';
import { VitalEngine } from '../services/vitals/vitalEngine';
import { BlePacketInfo } from '../types/device';

export function useLiveVitals(selectedOrganId: OrganCategoryId = 'OVERALL') {
  const { status: bleStatus, subscribePacket, addDebugLog } = useDevice();
  const engineRef = useRef<VitalEngine>(new VitalEngine(selectedOrganId));
  const isBleConnected = bleStatus === 'CONNECTED' || bleStatus === 'NOTIFYING' || bleStatus === 'STREAMING';

  const [vitalsState, setVitalsState] = useState<LiveVitalsState>(() =>
    engineRef.current.getState(isBleConnected)
  );

  // Sync organ change
  useEffect(() => {
    engineRef.current.setTargetOrgan(selectedOrganId);
  }, [selectedOrganId]);

  // Set reactive engine state callback
  useEffect(() => {
    engineRef.current.setCallback((nextState) => {
      setVitalsState(nextState);
    });
  }, []);

  const startAcquisition = useCallback(() => {
    engineRef.current.startAcquisition();
    const nextState = engineRef.current.getState(isBleConnected);
    setVitalsState(nextState);
    addDebugLog('ENGINE', 'INFO', 'SHB 65s Acquisition Started');
  }, [isBleConnected, addDebugLog]);

  const pauseAcquisition = useCallback(() => {
    engineRef.current.pauseAcquisition();
    const nextState = engineRef.current.getState(isBleConnected);
    setVitalsState(nextState);
    addDebugLog('ENGINE', 'INFO', 'SHB Acquisition Paused');
  }, [isBleConnected, addDebugLog]);

  const resumeAcquisition = useCallback(() => {
    engineRef.current.resumeAcquisition();
    const nextState = engineRef.current.getState(isBleConnected);
    setVitalsState(nextState);
    addDebugLog('ENGINE', 'INFO', 'SHB Acquisition Resumed');
  }, [isBleConnected, addDebugLog]);

  const stopAcquisition = useCallback(() => {
    engineRef.current.stopAcquisition();
    const nextState = engineRef.current.getState(isBleConnected);
    setVitalsState(nextState);
  }, [isBleConnected]);

  const resetVitals = useCallback((organ: OrganCategoryId = selectedOrganId) => {
    engineRef.current.reset(organ);
    const nextState = engineRef.current.getState(isBleConnected);
    setVitalsState(nextState);
    addDebugLog('ENGINE', 'INFO', `SHB Reset for target: ${organ}`);
  }, [isBleConnected, selectedOrganId, addDebugLog]);

  const executeLock = useCallback(() => {
    engineRef.current.executeLock();
    const nextState = engineRef.current.getState(isBleConnected);
    setVitalsState(nextState);
    addDebugLog('ENGINE', 'SUCCESS', 'Robust Vital Averaging & Lock Completed');
  }, [isBleConnected, addDebugLog]);

  const getFinalResult = useCallback((): ShbFinalResultPacket | null => {
    return engineRef.current.getFinalResult();
  }, []);

  const ingestPacket = useCallback(
    (packet: string | any) => {
      const nextState = engineRef.current.ingestPacket(packet, isBleConnected);
      setVitalsState(nextState);
    },
    [isBleConnected]
  );

  // Subscribe directly to BLE packet stream (prevents packet drops and React batching bugs)
  useEffect(() => {
    const unsubscribe = subscribePacket((packetInfo: BlePacketInfo) => {
      const nextState = engineRef.current.ingestPacket(packetInfo.rawPayload, isBleConnected);
      setVitalsState(nextState);
    });

    return () => {
      unsubscribe();
    };
  }, [subscribePacket, isBleConnected]);

  // Sync BLE connection state with vital engine
  useEffect(() => {
    setVitalsState(engineRef.current.getState(isBleConnected));
  }, [isBleConnected, bleStatus]);

  useEffect(() => {
    if (!isBleConnected && vitalsState.isAcquiring) {
      engineRef.current.stopAcquisition();
      setVitalsState(engineRef.current.getState(false));
      addDebugLog('ENGINE', 'WARN', 'SHB acquisition stopped because the shared BLE session disconnected');
    }
  }, [isBleConnected, vitalsState.isAcquiring, addDebugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current.stopAcquisition();
    };
  }, []);

  return {
    vitalsState,
    startAcquisition,
    pauseAcquisition,
    resumeAcquisition,
    stopAcquisition,
    resetVitals,
    executeLock,
    getFinalResult,
    ingestPacket,
    isBleConnected,
  };
}
