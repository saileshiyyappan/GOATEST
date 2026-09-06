/**
 * React Hook: useSdcuState
 * Subscribes to the SDCU State Machine snapshot
 * GOATEST - CRIB PMT-4
 */

import { useState, useEffect } from 'react';
import { SDCUSnapshot } from '../../../types/sdcu';
import { sdcuStateMachine } from './sdcuStateMachine';

export function useSdcuState(): SDCUSnapshot {
  const [snapshot, setSnapshot] = useState<SDCUSnapshot>(() => sdcuStateMachine.getSnapshot());

  useEffect(() => {
    const unsubscribe = sdcuStateMachine.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return snapshot;
}
