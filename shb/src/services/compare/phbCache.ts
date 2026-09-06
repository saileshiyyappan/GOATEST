import { SynchronizedPhbJson, AccountScopedPhbCache } from '../../types/compare';
import { cmPacketCache } from './cmPacketCache';

/**
 * Account-Scoped in-memory cache for the synchronized PHB JSON document.
 * Strictly bound to the authenticated Firebase UID.
 * 
 * Rules:
 * A. New login with another UID -> discard previous PHB cache
 * B. Logout -> immediately clear PHB cache
 * C. Account switch -> never reuse previous user's PHB
 * D. Same account -> reuse synchronized PHB JSON during current Compare workflow
 * E. Fresh sync -> replace cache atomically
 */
class PhbCacheManager {
  private cache: AccountScopedPhbCache | null = null;

  public setPhb(phb: SynchronizedPhbJson, uid: string, path: string): void {
    this.cache = {
      uid,
      phb,
      fetchedAt: Date.now(),
      sourcePath: path,
    };
  }

  public getPhb(uid?: string): SynchronizedPhbJson | null {
    if (!this.cache) return null;
    if (uid && this.cache.uid !== uid) {
      // Invalidate if requested for a different UID
      this.clear();
      cmPacketCache.clear();
      return null;
    }
    return this.cache.phb;
  }

  public getCacheEntry(): AccountScopedPhbCache | null {
    return this.cache;
  }

  public getAuthenticatedUid(): string | null {
    return this.cache?.uid ?? null;
  }

  public getFetchedPath(): string | null {
    return this.cache?.sourcePath ?? null;
  }

  public hasPhb(uid?: string): boolean {
    if (!this.cache) return false;
    if (uid && this.cache.uid !== uid) return false;
    return true;
  }

  public invalidateIfDifferentUser(currentUid: string): boolean {
    if (this.cache && this.cache.uid !== currentUid) {
      this.clear();
      cmPacketCache.clear();
      return true;
    }
    return false;
  }

  public clear(): void {
    this.cache = null;
  }
}

export const phbCache = new PhbCacheManager();
