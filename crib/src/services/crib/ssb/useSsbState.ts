/**
 * React hook to subscribe to the SSB State Machine
 * GOATEST - CRIB PMT-5
 */

import { useState, useEffect } from 'react';
import { SSBSnapshot } from '../../../types/ssb';
import { ssbStateMachine } from './ssbStateMachine';

export function useSsbState(): SSBSnapshot {
  const [snapshot, setSnapshot] = useState<SSBSnapshot>(() => ssbStateMachine.getSnapshot());

  useEffect(() => {
    const unsubscribe = ssbStateMachine.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return snapshot;
}
