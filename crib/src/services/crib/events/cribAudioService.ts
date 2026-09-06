/**
 * CRIB Audio Emergency Engine
 * Handles synthesizers, tones, alarms, and browser autoplay policies.
 * Safely guards against unhandled audio context suspensions.
 * GOATEST - PMT-9
 */

import { CribAudioState } from '../../../types/cribEvents';
import { CribPermissionManager } from './cribPermissionManager';

class CribAudioServiceImpl {
  private audioCtx: AudioContext | null = null;
  private isMuted = false;
  private isAutoplayBlocked = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.audioCtx = new AudioCtxClass();
        } catch (err) {
          console.warn('[CRIB_ERROR] AudioContext init failed:', err);
        }
      }
    }
    return this.audioCtx;
  }

  public getAudioState(): CribAudioState {
    const ctx = this.getAudioContext();
    if (!ctx) {
      return {
        audioStatus: 'AUDIO_UNAVAILABLE',
        isMuted: this.isMuted,
        isAutoplayBlocked: false,
      };
    }

    if (this.isMuted) {
      return {
        audioStatus: 'AUDIO_MUTED',
        isMuted: true,
        isAutoplayBlocked: this.isAutoplayBlocked,
      };
    }

    if (ctx.state === 'suspended' || this.isAutoplayBlocked) {
      return {
        audioStatus: 'AUDIO_ACTION_REQUIRED',
        isMuted: false,
        isAutoplayBlocked: true,
      };
    }

    return {
      audioStatus: 'AUDIO_READY',
      isMuted: false,
      isAutoplayBlocked: false,
    };
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    console.info(`[CRIB_EVENT] audio_muted=${muted}`);
  }

  /**
   * Resumes audio context upon user click/interaction
   */
  public async resumeAudioContext(): Promise<boolean> {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.isAutoplayBlocked = false;
        CribPermissionManager.updatePermission('AUDIO', 'GRANTED');
        console.info('[CRIB_EVENT] audio_resumed=true status=AUDIO_READY');
        return true;
      } catch (err) {
        console.warn('[CRIB_ERROR] Failed to resume AudioContext:', err);
        return false;
      }
    }

    this.isAutoplayBlocked = false;
    return true;
  }

  /**
   * Plays a high-priority emergency chime (two-tone alert)
   */
  public playEmergencyChime(): void {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      this.isAutoplayBlocked = true;
      console.info('[CRIB_EVENT] audio_status=AUDIO_ACTION_REQUIRED (autoplay suspended)');
      return;
    }

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.15); // D6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (err) {
      console.warn('[CRIB_ERROR] Audio chime playback error:', err);
    }
  }

  /**
   * Plays guidance confirmation tone
   */
  public playGuidanceTone(): void {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Ignore background audio glitch
    }
  }

  public resetForTesting(): void {
    this.isMuted = false;
    this.isAutoplayBlocked = false;
  }
}

export const CribAudioService = new CribAudioServiceImpl();
