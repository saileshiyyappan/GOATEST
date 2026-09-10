/**
 * Boundary between pure C50 condition computation and application persistence.
 * The condition engine uses the pure adapter by default. HOME/server code may
 * inject its existing persistence implementation at the integration boundary.
 */
export interface ConditionPersistence {
  [method: string]: ((...args: any[]) => any) | undefined;
}

export const pureConditionPersistence: ConditionPersistence = {
  validateAuthenticatedOwnership: (uid: string) => ({ isValid: Boolean(uid), authUid: uid }),
  getTestObservationsByIds: async () => ({ success: false, data: [], error: 'TEST observations must be supplied to pure C50 computation.' }),
  getTestObservationsByUid: async () => [],
  writeQA: async (_uid: string, data: any) => ({ success: true, status: 'LOCAL_ONLY', persistedLocation: 'NONE', data }),
  getQA: async () => ({ success: false, data: null, status: 'NOT_FOUND' }),
  writeTestObservation: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  writeTestReport: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  getDayObservationsByIds: async () => ({ success: false, data: [], error: 'DAY observations must be supplied to pure C50 computation.' }),
  getDayObservationsByUid: async () => [],
  writeDayObservation: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  writeDayReport: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  getWeekObservationsByIds: async () => ({ success: false, data: [], error: 'WEEK observations must be supplied to pure C50 computation.' }),
  getWeekObservationsByUid: async () => [],
  writeWeekObservation: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  writeWeekReport: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  writeMonthObservation: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  writeMonthReport: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
  writeNotification: async () => ({ success: true, status: 'COMPUTED', persistedLocation: 'NONE' }),
};