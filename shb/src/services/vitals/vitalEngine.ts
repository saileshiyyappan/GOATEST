import {
  LiveVitalsState,
  SensorStatusItem,
  OrganCategoryId,
  ShbFinalResultPacket,
  AcquisitionEngineStatus,
} from '../../types/shb';
import { parseSensorPacket, ParsedSensorData } from './packetParser';
import {
  ShbEngineState,
  createInitialEngineState,
  ingestPacketToEngine,
  lockAllVitals,
  DEFAULT_SHB_CONFIG,
} from './shbSessionEngine';
import {
  createShbE2ETestLockedState,
  isShbE2ETestEnabled,
  ShbE2ELockInputs,
} from './shbE2ETestSource';

export class VitalEngine {
  private state: ShbEngineState;
  private timerInterval: any = null;
  private e2eLockTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChangeCallback?: (state: LiveVitalsState) => void;
  private lastBleConnected: boolean = false;

  constructor(targetOrgan: OrganCategoryId = 'OVERALL') {
    this.state = createInitialEngineState(targetOrgan);
  }

  public setTargetOrgan(organ: OrganCategoryId) {
    this.state.targetOrgan = organ;
  }

  public setCallback(cb: (state: LiveVitalsState) => void) {
    this.onStateChangeCallback = cb;
  }

  public isSessionAcquiring(): boolean {
    return this.state.status === 'ACQUIRING';
  }

  public startAcquisition() {
    if (this.state.status === 'ACQUIRING') return;

    this.state.status = 'ACQUIRING';
    if (!this.state.startedAt) {
      this.state.startedAt = Date.now();
    }

    if (this.e2eLockTimer) {
      clearTimeout(this.e2eLockTimer);
      this.e2eLockTimer = null;
    }

    if (isShbE2ETestEnabled()) {
      this.timerInterval && clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.e2eLockTimer = setTimeout(() => {
        this.state = createShbE2ETestLockedState(this.state);
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback(this.getState(this.lastBleConnected));
        }
      }, 3000);
      return;
    }

    // Start 1-second elapsed timer for normal 65s acquisition
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state.status === 'ACQUIRING') {
        this.state.elapsedSeconds += 1;

        // Check if 65s normal acquisition target is reached
        if (this.state.elapsedSeconds >= this.state.config.targetDurationSeconds) {
          this.executeLock();
        } else if (this.onStateChangeCallback) {
          this.onStateChangeCallback(this.getState(this.lastBleConnected));
        }
      }
    }, 1000);
  }

  public pauseAcquisition() {
    if (this.state.status === 'ACQUIRING') {
      this.state.status = 'PAUSED';
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.e2eLockTimer) {
        clearTimeout(this.e2eLockTimer);
        this.e2eLockTimer = null;
      }
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(this.getState(this.lastBleConnected));
      }
    }
  }

  public resumeAcquisition() {
    if (this.state.status === 'PAUSED' || this.state.status === 'PAUSED_BY_SHAKE') {
      this.state.status = 'ACQUIRING';
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.state.status === 'ACQUIRING') {
          this.state.elapsedSeconds += 1;

          // Check if 65s normal acquisition target is reached
          if (this.state.elapsedSeconds >= this.state.config.targetDurationSeconds) {
            this.executeLock();
          } else if (this.onStateChangeCallback) {
            this.onStateChangeCallback(this.getState(this.lastBleConnected));
          }
        }
      }, 1000);

      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(this.getState(this.lastBleConnected));
      }
    }
  }

  public stopAcquisition() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.e2eLockTimer) {
      clearTimeout(this.e2eLockTimer);
      this.e2eLockTimer = null;
    }
    if (this.state.status === 'ACQUIRING' || this.state.status === 'PAUSED' || this.state.status === 'PAUSED_BY_SHAKE') {
      this.state.status = 'IDLE';
    }
  }

  public executeLock() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.state = lockAllVitals(this.state);
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.getState(this.lastBleConnected));
    }
  }

  /**
   * Test-only completion entry point for Android QA. It is deliberately
   * guarded so production builds cannot inject a synthetic SHB result.
   */
  public runControlledE2ECompletion(inputs: ShbE2ELockInputs): LiveVitalsState {
    if (!isShbE2ETestEnabled()) {
      throw new Error('Controlled SHB completion requires VITE_SHB_E2E_TEST=true');
    }

    if (this.e2eLockTimer) {
      clearTimeout(this.e2eLockTimer);
      this.e2eLockTimer = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.state = createShbE2ETestLockedState(this.state, inputs);
    const nextState = this.getState(this.lastBleConnected);
    this.onStateChangeCallback?.(nextState);
    return nextState;
  }

  public reset(targetOrgan: OrganCategoryId = 'OVERALL') {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.e2eLockTimer) {
      clearTimeout(this.e2eLockTimer);
      this.e2eLockTimer = null;
    }
    this.state = createInitialEngineState(targetOrgan);
  }

  public getFinalResult(): ShbFinalResultPacket | null {
    return this.state.finalResult;
  }

  /**
   * Ingests a raw sensor packet into the vital calculation pipeline.
   * Usable both by UI and future background loop (shb_bgloop).
   */
  public ingestPacket(
    rawPacket: string | { timestamp: number; [key: string]: any } | DataView,
    bleConnected: boolean = false
  ): LiveVitalsState {
    this.lastBleConnected = bleConnected;
    const parsed: ParsedSensorData = parseSensorPacket(rawPacket);

    if (this.state.status === 'ACQUIRING' || this.state.status === 'PAUSED' || this.state.status === 'PAUSED_BY_SHAKE') {
      this.state = ingestPacketToEngine(this.state, parsed, bleConnected);

      // If terminated due to 2/2 interference or 2/2 shake events, halt timer
      if (
        this.state.status === 'TERMINATED_INTERFERENCE' ||
        this.state.status === 'TERMINATED_BY_SHAKE' ||
        this.state.status === 'PAUSED_BY_SHAKE'
      ) {
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
      }

      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(this.getState(bleConnected));
      }
    }

    return this.getState(bleConnected);
  }

  public getState(bleConnected: boolean = false): LiveVitalsState {
    this.lastBleConnected = bleConnected;
    const hasValidSamples = this.state.sampleBuffer.validSamples > 0;
    const lastParsed = this.state.sampleBuffer.buffers;

    // ACTIVE HARDWARE SENSOR SET: PPG (MAX30102), MPU (MPU6050), ENV (BMP180)
    // Audited hardware configuration: BMP180 barometric/thermometer sensor
    const sensors: SensorStatusItem[] = [
      {
        id: 'PPG',
        name: 'MAX30102',
        fullName: 'Optical PPG',
        status: bleConnected
          ? hasValidSamples
            ? 'STREAMING'
            : 'CONNECTED'
          : 'NOT_CONNECTED',
        rateHz: 50,
      },
      {
        id: 'MPU',
        name: 'MPU6050',
        fullName: '6-DoF IMU',
        status: bleConnected
          ? lastParsed.accel.length > 0
            ? 'STREAMING'
            : 'CONNECTED'
          : 'NOT_CONNECTED',
        rateHz: 50,
      },
      {
        id: 'ENV',
        name: 'BMP180',
        fullName: 'Temp / Pres / Alt',
        status: bleConnected
          ? lastParsed.temp.length > 0
            ? 'STREAMING'
            : 'CONNECTED'
          : 'NOT_CONNECTED',
        rateHz: 10,
      },
    ];

    const isAcquiring = this.state.status === 'ACQUIRING';

    return {
      isAcquiring,
      engineStatus: this.state.status,
      elapsedSeconds: this.state.elapsedSeconds,
      targetDurationSeconds: this.state.config.targetDurationSeconds,
      directVitals: this.state.liveDv,
      indirectVitals: this.state.liveIv,
      sensors,
      bfit: {
        status: this.state.bfit.displayStatus,
        confidence: this.state.bfit.quality === 'GOOD' ? 0.95 : this.state.bfit.quality === 'MODERATE' ? 0.75 : null,
        sensorContact: this.state.bfit.sensorContact,
        motionStability: this.state.bfit.motionStability,
        interferenceCount: this.state.interferenceCount,
        message: this.state.bfit.message,
        shakeState: this.state.shakeState,
        shakeEventCount: this.state.shakeEventCount,
      },
      contextVariables: {
        activityIntensity: lastParsed.activity.length > 0 ? lastParsed.activity[lastParsed.activity.length - 1] : null,
        ambientTemperature: lastParsed.temp.length > 0 ? lastParsed.temp[lastParsed.temp.length - 1] : null,
        relativeHumidity: lastParsed.humidity.length > 0 ? lastParsed.humidity[lastParsed.humidity.length - 1] : null,
        atmosphericPressure: lastParsed.pressure.length > 0 ? lastParsed.pressure[lastParsed.pressure.length - 1] : null,
        altitude: lastParsed.altitude.length > 0 ? lastParsed.altitude[lastParsed.altitude.length - 1] : null,
        // Compatibility aliases
        ambientTemp: lastParsed.temp.length > 0 ? lastParsed.temp[lastParsed.temp.length - 1] : null,
        humidity: lastParsed.humidity.length > 0 ? lastParsed.humidity[lastParsed.humidity.length - 1] : null,
        pressure: lastParsed.pressure.length > 0 ? lastParsed.pressure[lastParsed.pressure.length - 1] : null,
        motionIntensity: lastParsed.activity.length > 0 ? lastParsed.activity[lastParsed.activity.length - 1] : null,
      },
      sampleStats: {
        totalPackets: this.state.sampleBuffer.totalPackets,
        validSamples: this.state.sampleBuffer.validSamples,
        rejectedSamples: this.state.sampleBuffer.rejectedSamples,
        durationSeconds: this.state.elapsedSeconds,
      },
      lockedVitals: this.state.lockedVitals,
    };
  }
}
