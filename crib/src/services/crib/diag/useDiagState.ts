/**
 * React Hook for subscribing to DIAG State Machine
 * GOATEST - CRIB PMT-7
 */

import { useState, useEffect } from 'react';
import { DiagSnapshot } from '../../../types/diag';
import { diagStateMachine } from './diagStateMachine';

export function useDiagState(): DiagSnapshot {
  const [snapshot, setSnapshot] = useState<DiagSnapshot>(() => diagStateMachine.getSnapshot());

  useEffect(() => {
    const unsubscribe = diagStateMachine.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return snapshot;
}
