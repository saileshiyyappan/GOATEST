import { CmPacket } from '../../types/compare';

/**
 * In-memory cache for computed CM_PACKETs (PMT-NEW-1).
 * Supports session-keyed idempotency to prevent duplicate calculations and logs.
 */
class CmPacketCacheManager {
  private activePacket: CmPacket | null = null;
  private sessionMap: Map<string, CmPacket> = new Map();
  private computedAt: number | null = null;

  public setCmPacket(packet: CmPacket): void {
    this.activePacket = { ...packet };
    this.computedAt = Date.now();
    const key = `${packet.sessionId}_${packet.target || packet.targetOrgan || 'OVERALL'}`;
    this.sessionMap.set(key, { ...packet });
  }

  public getCmPacket(sessionId?: string, target?: string): CmPacket | null {
    if (sessionId) {
      const key = `${sessionId}_${target || 'OVERALL'}`;
      if (this.sessionMap.has(key)) {
        return { ...this.sessionMap.get(key)! };
      }
      return null;
    }
    return this.activePacket ? { ...this.activePacket } : null;
  }

  public hasCmPacket(sessionId?: string, target?: string): boolean {
    if (sessionId) {
      const key = `${sessionId}_${target || 'OVERALL'}`;
      return this.sessionMap.has(key);
    }
    return this.activePacket !== null && this.activePacket.status === 'COMPUTED';
  }

  public getComputedAt(): number | null {
    return this.computedAt;
  }

  public clear(): void {
    this.activePacket = null;
    this.sessionMap.clear();
    this.computedAt = null;
  }
}

export const cmPacketCache = new CmPacketCacheManager();

