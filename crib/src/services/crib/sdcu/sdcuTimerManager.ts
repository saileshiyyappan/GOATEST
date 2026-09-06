/**
 * Centralized SDCU Timer Manager
 * GOATEST - CRIB PMT-4
 *
 * Responsibilities:
 *   1. 10-second CRIB activation countdown timer.
 *   2. 120-second SDCU monitoring evaluation timer.
 *   3. 10-second action verification timeout timer.
 *   4. Strict lifecycle: start(), stop(), reset(), cleanup().
 *   5. Zero lingering timers or interval leaks.
 */

export interface SdcuTimerCallbacks {
  onActivationTick?: (remainingSeconds: number) => void;
  onActivationExpired?: () => void;
  onSdcuTick?: (remainingSeconds: number) => void;
  onSdcuExpired?: () => void;
  onActionTick?: (remainingSeconds: number) => void;
  onActionExpired?: () => void;
}

export class SdcuTimerManager {
  private callbacks: SdcuTimerCallbacks = {};

  // 1. Activation Timer State (10s)
  private activationTimerId: NodeJS.Timeout | number | null = null;
  private activationRemainingSeconds: number = 10;

  // 2. SDCU Monitoring Window Timer State (120s)
  private sdcuTimerId: NodeJS.Timeout | number | null = null;
  private sdcuRemainingSeconds: number = 120;

  // 3. Action Verification Timeout Timer State (10s)
  private actionTimerId: NodeJS.Timeout | number | null = null;
  private actionRemainingSeconds: number = 10;

  constructor(callbacks?: SdcuTimerCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public setCallbacks(callbacks: SdcuTimerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ==========================================
  // 1. ACTIVATION COUNTDOWN (10 SECONDS)
  // ==========================================

  public startActivationTimer(durationSeconds: number = 10): void {
    this.stopActivationTimer();
    this.activationRemainingSeconds = durationSeconds;
    this.callbacks.onActivationTick?.(this.activationRemainingSeconds);

    this.activationTimerId = setInterval(() => {
      this.activationRemainingSeconds -= 1;
      this.callbacks.onActivationTick?.(this.activationRemainingSeconds);

      if (this.activationRemainingSeconds <= 0) {
        this.stopActivationTimer();
        this.callbacks.onActivationExpired?.();
      }
    }, 1000);
  }

  public stopActivationTimer(): void {
    if (this.activationTimerId !== null) {
      clearInterval(this.activationTimerId as any);
      this.activationTimerId = null;
    }
  }

  public getActivationRemaining(): number {
    return this.activationRemainingSeconds;
  }

  // ==========================================
  // 2. SDCU 2-MINUTE WINDOW (120 SECONDS)
  // ==========================================

  public startSdcuMonitoringTimer(durationSeconds: number = 120): void {
    this.stopSdcuMonitoringTimer();
    this.sdcuRemainingSeconds = durationSeconds;
    this.callbacks.onSdcuTick?.(this.sdcuRemainingSeconds);

    this.sdcuTimerId = setInterval(() => {
      this.sdcuRemainingSeconds -= 1;
      this.callbacks.onSdcuTick?.(this.sdcuRemainingSeconds);

      if (this.sdcuRemainingSeconds <= 0) {
        this.stopSdcuMonitoringTimer();
        this.callbacks.onSdcuExpired?.();
      }
    }, 1000);
  }

  public stopSdcuMonitoringTimer(): void {
    if (this.sdcuTimerId !== null) {
      clearInterval(this.sdcuTimerId as any);
      this.sdcuTimerId = null;
    }
  }

  public getSdcuRemaining(): number {
    return this.sdcuRemainingSeconds;
  }

  // ==========================================
  // 3. ACTION VERIFICATION TIMEOUT (10 SECONDS)
  // ==========================================

  public startActionTimer(durationSeconds: number = 10): void {
    this.stopActionTimer();
    this.actionRemainingSeconds = durationSeconds;
    this.callbacks.onActionTick?.(this.actionRemainingSeconds);

    this.actionTimerId = setInterval(() => {
      this.actionRemainingSeconds -= 1;
      this.callbacks.onActionTick?.(this.actionRemainingSeconds);

      if (this.actionRemainingSeconds <= 0) {
        this.stopActionTimer();
        this.callbacks.onActionExpired?.();
      }
    }, 1000);
  }

  public stopActionTimer(): void {
    if (this.actionTimerId !== null) {
      clearInterval(this.actionTimerId as any);
      this.actionTimerId = null;
    }
  }

  public getActionRemaining(): number {
    return this.actionRemainingSeconds;
  }

  // ==========================================
  // LIFECYCLE & CLEANUP
  // ==========================================

  public resetAll(): void {
    this.stopActivationTimer();
    this.stopSdcuMonitoringTimer();
    this.stopActionTimer();
    this.activationRemainingSeconds = 10;
    this.sdcuRemainingSeconds = 120;
    this.actionRemainingSeconds = 10;
  }

  public cleanup(): void {
    this.resetAll();
    this.callbacks = {};
  }
}
