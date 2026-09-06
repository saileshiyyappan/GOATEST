/**
 * GOATEST C50 Result Persistence Service
 * 
 * PMT-2: Persists C50_RESULT_PACKET and integrates with PMT-1 Report Database Foundation.
 * 
 * CORE PRINCIPLES:
 * 1. RAW RESULT PRESERVATION: Exact ML input and output stored untouched.
 * 2. USER DATA ISOLATION: Enforces user ownership (`userId == auth.uid`).
 * 3. DUAL-LAYER PERSISTENCE: Firestore cloud storage with local storage fallback.
 * 4. REPORT FOUNDATION INTEGRATION: Links directly to DayRecord, WeekRecord, MonthRecord, and TestRecord.
 * 5. NO USER DELETION: Historical audit logs preserved immutably.
 */

import type {
  C50ResultPacket,
  C50InputPacket,
  MilestoneType,
} from './c50Packet';
import { reportDatabaseService } from '../reportDatabaseService';

const STORAGE_KEY_C50_RESULTS = 'goatest_c50_results_';

/**
 * Local storage helper to store a C50 result
 */
function saveLocalC50Result(userId: string, item: C50ResultPacket): void {
  try {
    const storageKey = `${STORAGE_KEY_C50_RESULTS}${userId}`;
    const raw = localStorage.getItem(storageKey);
    const list: C50ResultPacket[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex((x) => x.resultId === item.resultId);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (err) {
    console.warn('[C50ResultService Local Save Error]:', err);
  }
}

/**
 * Local storage helper to retrieve C50 results for a user
 */
function getLocalC50Results(userId: string): C50ResultPacket[] {
  try {
    const storageKey = `${STORAGE_KEY_C50_RESULTS}${userId}`;
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const c50ResultService = {
  /**
   * Saves a C50ResultPacket to local storage,
   * and links it to the appropriate DayRecord / WeekRecord / MonthRecord / TestRecord.
   * Legacy Firestore /c50_results write removed per Home Web PMT.
   */
  async saveResult(
    result: C50ResultPacket,
    inputPacket?: C50InputPacket,
    targetRecordId?: string
  ): Promise<void> {
    if (!result.resultId || !result.userId) {
      throw new Error('C50ResultPacket requires resultId and userId');
    }

    saveLocalC50Result(result.userId, result);

    // Integrate with PMT-1 Hierarchy based on milestone
    try {
      if (result.milestone === 'DAY' && targetRecordId) {
        const day = await reportDatabaseService.getDayRecord(targetRecordId);
        if (day && day.userId === result.userId) {
          day.rawMLInput = inputPacket
            ? {
                exactInputPacket: inputPacket,
                modelVersion: result.modelVersion,
                description: inputPacket.isDevelopmentFixture ? 'This is a raw DAY ML input fixture' : 'Raw C50 DAY ML input',
                isDevelopmentFixture: inputPacket.isDevelopmentFixture,
              }
            : day.rawMLInput;

          day.rawMLOutput = {
            exactOutputPacket: result.rawResponse,
            predictionValues: result.predictionPayload || {},
            stageValues: result.featureSummary || {},
            description: result.isFixture ? 'This is a raw DAY ML output fixture' : 'Raw C50 DAY ML output',
            isDevelopmentFixture: result.isFixture,
          };
          day.updatedAt = new Date().toISOString();
          await reportDatabaseService.saveDayRecord(day);
        }
      } else if (result.milestone === 'WEEK' && targetRecordId) {
        const week = await reportDatabaseService.getWeekRecord(targetRecordId);
        if (week && week.userId === result.userId) {
          week.rawMLInput = inputPacket
            ? {
                exactInputPacket: inputPacket,
                description: inputPacket.isDevelopmentFixture ? 'This is a raw WEEK ML input fixture' : 'Raw C50 WEEK ML input',
                isDevelopmentFixture: inputPacket.isDevelopmentFixture,
              }
            : week.rawMLInput;

          week.rawMLOutput = {
            exactOutputPacket: result.rawResponse,
            predictionValues: result.predictionPayload || {},
            description: result.isFixture ? 'This is a raw WEEK ML output fixture' : 'Raw C50 WEEK ML output',
            isDevelopmentFixture: result.isFixture,
          };
          week.updatedAt = new Date().toISOString();
          await reportDatabaseService.saveWeekRecord(week);
        }
      } else if (result.milestone === 'MONTH' && targetRecordId) {
        const month = await reportDatabaseService.getMonthRecord(targetRecordId);
        if (month && month.userId === result.userId) {
          month.rawMLInput = inputPacket
            ? {
                exactInputPacket: inputPacket,
                description: inputPacket.isDevelopmentFixture ? 'This is a raw MONTH ML input fixture' : 'Raw C50 MONTH ML input',
                isDevelopmentFixture: inputPacket.isDevelopmentFixture,
              }
            : month.rawMLInput;

          month.rawMLOutput = {
            exactOutputPacket: result.rawResponse,
            predictionValues: result.predictionPayload || {},
            description: result.isFixture ? 'This is a raw MONTH ML output fixture' : 'Raw C50 MONTH ML output',
            isDevelopmentFixture: result.isFixture,
          };
          month.updatedAt = new Date().toISOString();
          await reportDatabaseService.saveMonthRecord(month);
        }
      } else if (result.milestone === 'TEST' && targetRecordId) {
        const test = await reportDatabaseService.getTestRecord(targetRecordId);
        if (test && test.userId === result.userId) {
          test.rawData = {
            ...test.rawData,
            c50Result: {
              resultId: result.resultId,
              status: result.status,
              modelVersion: result.modelVersion,
              rawOutput: result.rawResponse,
            },
          };
          test.updatedAt = new Date().toISOString();
          await reportDatabaseService.saveTestRecord(test);
        }
      }
    } catch (err) {
      console.warn('[C50ResultService] Error linking to report database record:', err);
    }
  },

  /**
   * Retrieves a single C50ResultPacket by resultId from local storage.
   * Legacy Firestore /c50_results read removed per Home Web PMT.
   */
  async getResultById(resultId: string): Promise<C50ResultPacket | null> {
    if (!resultId) return null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_C50_RESULTS)) {
        try {
          const list: C50ResultPacket[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((r) => r.resultId === resultId);
          if (match) return match;
        } catch {
          // ignore
        }
      }
    }

    return null;
  },

  /**
   * Retrieves all C50ResultPackets for an authenticated user from local storage, optionally filtered by milestone.
   * Legacy Firestore /c50_results query removed per Home Web PMT.
   */
  async getUserResults(userId: string, milestone?: MilestoneType): Promise<C50ResultPacket[]> {
    if (!userId) return [];
    let localList = getLocalC50Results(userId);
    if (milestone) {
      localList = localList.filter((r) => r.milestone === milestone);
    }
    return localList.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  /**
   * Retrieves the latest C50 result for a user.
   */
  async getLatestUserResult(userId: string, milestone?: MilestoneType): Promise<C50ResultPacket | null> {
    const results = await this.getUserResults(userId, milestone);
    return results.length > 0 ? results[0] : null;
  },

  /**
   * Retrieves a C50 result by sourceInputId from local storage.
   * Legacy Firestore /c50_results query removed per Home Web PMT.
   */
  async getResultByInputId(inputId: string, userId: string): Promise<C50ResultPacket | null> {
    if (!inputId || !userId) return null;
    const localList = getLocalC50Results(userId);
    return localList.find((r) => r.sourceInputId === inputId) || null;
  },

  /**
   * Retrieves a C50 result by sourceCmPacketId from local storage.
   * Legacy Firestore /c50_results query removed per Home Web PMT.
   */
  async getResultByCmPacketId(cmPacketId: string, userId: string): Promise<C50ResultPacket | null> {
    if (!cmPacketId || !userId) return null;
    const localList = getLocalC50Results(userId);
    return localList.find((r) => r.sourceCmPacketId === cmPacketId) || null;
  },
};
