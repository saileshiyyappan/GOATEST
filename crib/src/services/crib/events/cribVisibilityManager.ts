/**
 * CRIB Visibility & Background State Manager
 * Preserves emergency state across browser tab changes, minimizing data loss
 * and re-verifying packet freshness upon return.
 * GOATEST - PMT-9
 */

type VisibilityListener = (isVisible: boolean, backgroundDurationMs: number) => void;

class CribVisibilityManagerImpl {
  private isVisible = true;
  private lastHiddenTime: number | null = null;
  private listeners: Set<VisibilityListener> = new Set();
  private isBound = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof document !== 'undefined' && !this.isBound) {
      this.isVisible = document.visibilityState !== 'hidden';
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.isBound = true;
    }
  }

  private handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return;

    const currentlyVisible = document.visibilityState !== 'hidden';
    const now = Date.now();

    if (!currentlyVisible && this.isVisible) {
      // Transitioning to background
      this.isVisible = false;
      this.lastHiddenTime = now;
      console.info('[CRIB_STATE] visibility=hidden (state & timers preserved in background)');
      this.notifyListeners(false, 0);
    } else if (currentlyVisible && !this.isVisible) {
      // Transitioning to foreground
      this.isVisible = true;
      const backgroundDurationMs = this.lastHiddenTime ? now - this.lastHiddenTime : 0;
      this.lastHiddenTime = null;
      console.info(`[CRIB_STATE] visibility=visible background_duration=${backgroundDurationMs}ms (revalidating telemetry freshness)`);
      this.notifyListeners(true, backgroundDurationMs);
    }
  };

  public getIsVisible(): boolean {
    return this.isVisible;
  }

  public subscribe(listener: VisibilityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(isVisible: boolean, backgroundDurationMs: number): void {
    for (const listener of this.listeners) {
      try {
        listener(isVisible, backgroundDurationMs);
      } catch (err) {
        console.error('[CRIB_ERROR] Visibility listener error:', err);
      }
    }
  }

  public resetForTesting(): void {
    this.isVisible = true;
    this.lastHiddenTime = null;
    this.listeners.clear();
  }
}

export const CribVisibilityManager = new CribVisibilityManagerImpl();
