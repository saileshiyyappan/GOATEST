/**
 * GOATEST AUTHORITATIVE RESPIRATORY RATE ESTIMATION ENGINE
 * Complete Replacement adhering strictly to PMT Multi-Stage Physiological Model.
 *
 * Pipeline:
 * Step 1: Base RR from Heart Rate
 * Step 2: Autonomic HRV Adjustment (RMSSD + SDNN)
 * Step 3: Oxygenation SpO2 Adjustment
 * Step 4: Kinematic Activity Adjustment
 * Step 5: Environmental Barometric & Thermal Adjustments
 * Step 6: Final Clamping (4 - 40 breaths/min), Single Decimal Precision
 * Step 7: Rhythm State, Variability, and Confidence Derivations
 */

export interface RrEstimatorInputs {
  heartRate: number | null | undefined;
  spo2: number | null | undefined;
  rmssd?: number | null | undefined;
  sdnn?: number | null | undefined;
  activityIntensity?: number | null | undefined;
  ambientTemperature?: number | null | undefined;
  relativeHumidity?: number | null | undefined;
  atmosphericPressure?: number | null | undefined;
  altitude?: number | null | undefined;
}

export interface RrEstimateResult {
  isValid: boolean;
  respiratoryRate: number | null;
  baseRr: number | null;
  adjustments: {
    hrvRmssd: number;
    hrvSdnn: number;
    spo2: number;
    activity: number;
    altitude: number;
    temperature: number;
    humidity: number;
    pressure: number;
  };
  rhythmState:
    | 'Regular (Resting)'
    | 'Regular (Normal)'
    | 'Tachypnea'
    | 'Bradypnea'
    | 'Borderline'
    | 'WAITING'
    | 'NOT_AVAILABLE';
  variability: 'High' | 'Moderate' | 'Low' | 'WAITING';
  confidence: number | null;
  status: 'LOCKED' | 'ACQUIRING' | 'WAITING' | 'NOT_AVAILABLE';
  peakFrequencyHz?: number;
  notes?: string;
}

/**
 * Step 1: Base RR Curve calculation from HR
 */
export function calculateBaseRrFromHr(hr: number): number {
  let baseRr = 12.0;

  if (hr < 60) {
    baseRr = 12 + (hr - 50) * 0.2;
  } else if (hr < 100) {
    baseRr = 12 + (hr - 60) * 0.15;
  } else if (hr < 130) {
    baseRr = 18 + (hr - 100) * 0.2;
  } else {
    baseRr = 24 + (hr - 130) * 0.25;
  }

  // Clamp 8 <= base_rr <= 50
  return Math.max(8, Math.min(50, baseRr));
}

/**
 * Step 2: Autonomic HRV adjustments
 */
export function calculateHrvAdjustments(
  rmssd: number | null | undefined,
  sdnn: number | null | undefined
): { rmssdAdjust: number; sdnnAdjust: number } {
  let rmssdAdjust = 0;
  if (rmssd !== null && rmssd !== undefined && Number.isFinite(rmssd) && rmssd >= 0) {
    if (rmssd > 60) {
      rmssdAdjust = -1.5;
    } else if (rmssd > 40) {
      rmssdAdjust = 0;
    } else if (rmssd > 20) {
      rmssdAdjust = 1.5;
    } else {
      rmssdAdjust = 3.0;
    }
  }

  let sdnnAdjust = 0;
  if (sdnn !== null && sdnn !== undefined && Number.isFinite(sdnn) && sdnn >= 0) {
    if (sdnn > 70) {
      sdnnAdjust = -1.0;
    } else if (sdnn > 40) {
      sdnnAdjust = 0;
    } else {
      sdnnAdjust = 1.5;
    }
  }

  return { rmssdAdjust, sdnnAdjust };
}

/**
 * Step 3: SpO2 Hypoxia adjustment
 */
export function calculateSpo2Adjustment(spo2: number): number {
  if (spo2 >= 97) return 0;
  if (spo2 >= 95) return 1.0;
  if (spo2 >= 92) return 3.0;
  return 5.0;
}

/**
 * Step 4: Activity Intensity adjustment (scale 0-100)
 */
export function calculateActivityAdjustment(activity: number | null | undefined): number {
  if (activity === null || activity === undefined || !Number.isFinite(activity)) {
    return 0;
  }
  if (activity < 20) return -1.0;
  if (activity < 40) return 0;
  if (activity < 60) return 2.0;
  return 4.0;
}

/**
 * Step 5: Environmental context adjustments (Altitude, Temp, Humidity, Pressure)
 */
export function calculateEnvironmentalAdjustments(
  altitude: number | null | undefined,
  temp: number | null | undefined,
  humidity: number | null | undefined,
  pressure: number | null | undefined
): { altitudeAdjust: number; tempAdjust: number; humidityAdjust: number; pressureAdjust: number } {
  let altitudeAdjust = 0;
  if (altitude !== null && altitude !== undefined && Number.isFinite(altitude)) {
    altitudeAdjust = Math.max(0, (altitude - 3000) * 0.001) * 1.5;
  }

  let tempAdjust = 0;
  if (temp !== null && temp !== undefined && Number.isFinite(temp)) {
    if (temp > 38) tempAdjust = 2.0;
    else if (temp > 37) tempAdjust = 0.5;
    else tempAdjust = 0;
  }

  let humidityAdjust = 0;
  if (humidity !== null && humidity !== undefined && Number.isFinite(humidity)) {
    if (humidity > 80) humidityAdjust = 1.0;
    else humidityAdjust = 0;
  }

  let pressureAdjust = 0;
  if (pressure !== null && pressure !== undefined && Number.isFinite(pressure)) {
    pressureAdjust = Math.max(0, (1013 - pressure) * 0.01);
  }

  return { altitudeAdjust, tempAdjust, humidityAdjust, pressureAdjust };
}

/**
 * Derives the clinical Respiratory Rhythm State
 */
export function deriveRrRhythmState(
  rr: number,
  activity: number,
  spo2: number
): RrEstimateResult['rhythmState'] {
  if (activity < 20 && spo2 >= 97) {
    return 'Regular (Resting)';
  }
  if (activity < 40 && Math.abs(rr - 16) < 3) {
    return 'Regular (Normal)';
  }
  if (rr > 25) {
    return 'Tachypnea';
  }
  if (rr < 10) {
    return 'Bradypnea';
  }
  return 'Borderline';
}

/**
 * Derives Respiratory Variability classification
 */
export function deriveRrVariability(rmssd: number | null | undefined): RrEstimateResult['variability'] {
  if (rmssd === null || rmssd === undefined || !Number.isFinite(rmssd)) {
    return 'WAITING';
  }
  if (rmssd > 50) return 'High';
  if (rmssd > 30) return 'Moderate';
  return 'Low';
}

/**
 * Calculates estimation confidence score (30 <= confidence <= 98)
 */
export function calculateRrConfidence(
  activity: number,
  rmssd: number | null | undefined,
  spo2: number,
  sdnn: number | null | undefined
): number {
  let confidence = 100;

  if (activity > 70) {
    confidence -= 25;
  }
  if (rmssd !== null && rmssd !== undefined && Number.isFinite(rmssd) && rmssd > 0) {
    confidence += 5;
  }
  if (spo2 < 95) {
    confidence -= 10;
  }
  if (sdnn !== null && sdnn !== undefined && Number.isFinite(sdnn) && sdnn > 40) {
    confidence += 5;
  }

  return Math.max(30, Math.min(98, confidence));
}

/**
 * Authoritative PMT Respiratory Rate Calculation Pipeline
 */
export function calculateRespiratoryRate(inputs: RrEstimatorInputs): RrEstimateResult {
  const {
    heartRate,
    spo2,
    rmssd,
    sdnn,
    activityIntensity,
    ambientTemperature,
    relativeHumidity,
    atmosphericPressure,
    altitude,
  } = inputs;

  // DATA QUALITY SAFETY GUARD:
  // Reject missing, non-finite, zero, or out-of-physiological-range direct vitals
  if (
    heartRate === null ||
    heartRate === undefined ||
    !Number.isFinite(heartRate) ||
    heartRate < 30 ||
    heartRate > 240
  ) {
    return {
      isValid: false,
      respiratoryRate: null,
      baseRr: null,
      adjustments: {
        hrvRmssd: 0,
        hrvSdnn: 0,
        spo2: 0,
        activity: 0,
        altitude: 0,
        temperature: 0,
        humidity: 0,
        pressure: 0,
      },
      rhythmState: 'WAITING',
      variability: 'WAITING',
      confidence: null,
      status: 'WAITING',
      notes: 'Awaiting valid heart rate telemetry',
    };
  }

  if (
    spo2 === null ||
    spo2 === undefined ||
    !Number.isFinite(spo2) ||
    spo2 < 50 ||
    spo2 > 100
  ) {
    return {
      isValid: false,
      respiratoryRate: null,
      baseRr: null,
      adjustments: {
        hrvRmssd: 0,
        hrvSdnn: 0,
        spo2: 0,
        activity: 0,
        altitude: 0,
        temperature: 0,
        humidity: 0,
        pressure: 0,
      },
      rhythmState: 'WAITING',
      variability: 'WAITING',
      confidence: null,
      status: 'WAITING',
      notes: 'Awaiting valid SpO2 telemetry',
    };
  }

  // 1. Base RR
  const baseRr = calculateBaseRrFromHr(heartRate);

  // 2. HRV Adjustments
  const { rmssdAdjust, sdnnAdjust } = calculateHrvAdjustments(rmssd, sdnn);

  // 3. SpO2 Adjustment
  const spo2Adjust = calculateSpo2Adjustment(spo2);

  // 4. Activity Adjustment
  const effActivity =
    activityIntensity !== null && activityIntensity !== undefined && Number.isFinite(activityIntensity)
      ? activityIntensity
      : 0;
  const activityAdjust = calculateActivityAdjustment(effActivity);

  // 5. Environmental Adjustments
  const { altitudeAdjust, tempAdjust, humidityAdjust, pressureAdjust } = calculateEnvironmentalAdjustments(
    altitude,
    ambientTemperature,
    relativeHumidity,
    atmosphericPressure
  );

  // 6. Sum & Clamp final estimate: 4 <= RR <= 40 breaths/min
  const rawSum =
    baseRr +
    rmssdAdjust +
    sdnnAdjust +
    spo2Adjust +
    activityAdjust +
    altitudeAdjust +
    tempAdjust +
    humidityAdjust +
    pressureAdjust;

  const clampedRr = Math.max(4, Math.min(40, rawSum));
  const finalRr = Math.round(clampedRr * 10) / 10;

  // 7. Rhythm State, Variability & Confidence
  const rhythmState = deriveRrRhythmState(finalRr, effActivity, spo2);
  const variability = deriveRrVariability(rmssd);
  const confidence = calculateRrConfidence(effActivity, rmssd, spo2, sdnn);

  return {
    isValid: true,
    respiratoryRate: finalRr,
    baseRr: Math.round(baseRr * 10) / 10,
    adjustments: {
      hrvRmssd: rmssdAdjust,
      hrvSdnn: sdnnAdjust,
      spo2: spo2Adjust,
      activity: activityAdjust,
      altitude: Math.round(altitudeAdjust * 100) / 100,
      temperature: tempAdjust,
      humidity: humidityAdjust,
      pressure: Math.round(pressureAdjust * 100) / 100,
    },
    rhythmState,
    variability,
    confidence,
    status: 'ACQUIRING',
    notes: `PMT multi-stage derived RR: Base=${baseRr.toFixed(1)}, Total Adjust=${(rawSum - baseRr).toFixed(1)}`,
  };
}

/**
 * Adapter for PPI pulse-interval series stream
 */
export function estimateRespiratoryRate(
  ppiSequence?: number[],
  irWaveform?: number[],
  context?: {
    spo2?: number | null;
    activity?: number | null;
    temp?: number | null;
    humidity?: number | null;
    pressure?: number | null;
    altitude?: number | null;
  }
): RrEstimateResult {
  if (!ppiSequence || ppiSequence.length < 3) {
    return {
      isValid: false,
      respiratoryRate: null,
      baseRr: null,
      adjustments: {
        hrvRmssd: 0,
        hrvSdnn: 0,
        spo2: 0,
        activity: 0,
        altitude: 0,
        temperature: 0,
        humidity: 0,
        pressure: 0,
      },
      rhythmState: 'WAITING',
      variability: 'WAITING',
      confidence: null,
      status: 'WAITING',
    };
  }

  // Calculate HR from mean PPI
  const validPpis = ppiSequence.filter((p) => p >= 250 && p <= 2000);
  if (validPpis.length === 0) {
    return {
      isValid: false,
      respiratoryRate: null,
      baseRr: null,
      adjustments: {
        hrvRmssd: 0,
        hrvSdnn: 0,
        spo2: 0,
        activity: 0,
        altitude: 0,
        temperature: 0,
        humidity: 0,
        pressure: 0,
      },
      rhythmState: 'NOT_AVAILABLE',
      variability: 'WAITING',
      confidence: null,
      status: 'NOT_AVAILABLE',
    };
  }

  const meanPpi = validPpis.reduce((acc, v) => acc + v, 0) / validPpis.length;
  const hr = Math.round(60000 / meanPpi);

  // Calculate RMSSD
  let rmssd: number | null = null;
  if (validPpis.length >= 2) {
    let sumSqDiff = 0;
    for (let i = 1; i < validPpis.length; i++) {
      sumSqDiff += Math.pow(validPpis[i] - validPpis[i - 1], 2);
    }
    rmssd = Math.round(Math.sqrt(sumSqDiff / (validPpis.length - 1)) * 10) / 10;
  }

  // Calculate SDNN
  let sdnn: number | null = null;
  if (validPpis.length >= 2) {
    const variance = validPpis.reduce((acc, v) => acc + Math.pow(v - meanPpi, 2), 0) / validPpis.length;
    sdnn = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  const spo2 = context?.spo2 ?? 98;

  return calculateRespiratoryRate({
    heartRate: hr,
    spo2,
    rmssd,
    sdnn,
    activityIntensity: context?.activity ?? 0,
    ambientTemperature: context?.temp,
    relativeHumidity: context?.humidity,
    atmosphericPressure: context?.pressure,
    altitude: context?.altitude,
  });
}
