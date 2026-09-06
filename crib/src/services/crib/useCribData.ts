/**
 * React Hook: useCribData
 * Subscribes to the CRIB Input Adapter data stream with automatic cleanup
 * GOATEST - CRIB PMT-3
 */

import { useState, useEffect } from 'react';
import { CribInputState } from '../../types/cribInput';
import { cribDataManager } from './cribDataManager';

export function useCribData(authenticatedUid?: string | null): CribInputState {
  const [cribState, setCribState] = useState<CribInputState>(() => cribDataManager.getCurrentState());

  useEffect(() => {
    if (authenticatedUid !== undefined) {
      cribDataManager.setAuthenticatedUid(authenticatedUid);
    }

    const unsubscribe = cribDataManager.subscribe((nextState) => {
      setCribState(nextState);
    });

    return () => {
      unsubscribe();
    };
  }, [authenticatedUid]);

  return cribState;
}
