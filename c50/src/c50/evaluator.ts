import { ConfidenceLevel, SeverityLevel, StageValue, TrendLabel } from './types';

export const PARAMETER_NAMES = [
  'HR',
  'SpO2',
  'PPI',
  'RMSSD',
  'SDNN',
  'RespiratoryRate',
  'ActivityIntensity',
  'AmbientTemperature',
  'RelativeHumidity',
  'AtmosphericPressure',
  'Altitude',
] as const;

export type StageVector = [
  StageValue,
  StageValue,
  StageValue,
  StageValue,
  StageValue,
  StageValue,
  StageValue,
  StageValue,
  StageValue,
  StageValue,
  StageValue
];

export interface PatternEvaluationResult {
  primary_taxonomy: string;
  secondary_taxonomy: string;
  pattern_label: string;
  severity_label: SeverityLevel;
  severity_score: string;
  confidence_score: string;
  confidence_level: ConfidenceLevel;
}

export interface TrajectoryEvaluationResult extends PatternEvaluationResult {
  trend_label: TrendLabel;
}

/**
 * Deterministically evaluates a single 11-stage vector into taxonomy, severity, scores, and pattern label.
 */
export function evaluateStageVector(stages: StageVector): PatternEvaluationResult {
  const [
    hr,
    spo2,
    ppi,
    rmssd,
    sdnn,
    rr,
    activity,
    temp,
    humidity,
    pressure,
    altitude,
  ] = stages;

  const maxStage = Math.max(...stages) as StageValue;
  const activeCount = stages.filter((s) => s > 0).length;

  // Activity and the remaining environmental channels are contextual evidence.
  // They stay in the canonical 11-D vector but must not independently escalate
  // a physiological severity classification.
  const physioStages = [hr, spo2, ppi, rmssd, sdnn, rr];
  const maxPhysio = Math.max(...physioStages) as StageValue;
  const physioActiveCount = physioStages.filter((s) => s > 0).length;

  const physioStage5Count = physioStages.filter((s) => s === 5).length;
  const physioStage4Count = physioStages.filter((s) => s === 4).length;

  // 1. SEVERITY EVALUATION (Deterministic, non-circular rule)
  let severity_label: SeverityLevel;
  if (maxStage === 0) {
    severity_label = 'NORMAL';
  } else if (maxStage === 1 && activeCount <= 2) {
    severity_label = 'CONTROL';
  } else if (
    physioStage5Count >= 1 ||
    (physioStage4Count >= 2 && maxPhysio >= 4) ||
    (maxPhysio >= 4 && physioActiveCount >= 4)
  ) {
    severity_label = 'RISK';
  } else if (
    maxPhysio >= 3 ||
    (maxPhysio === 2 && physioActiveCount >= 5) ||
    (physioStage4Count >= 1)
  ) {
    severity_label = 'HIGH';
  } else {
    severity_label = 'MILD';
  }

  // 2. CONTINUOUS SEVERITY SCORE (Normalized strictly [0.00..1.00] monotonic with label)
  const rawScore =
    hr * 1.3 +
    spo2 * 1.5 +
    ppi * 1.1 +
    rmssd * 1.1 +
    sdnn * 1.0 +
    rr * 1.2 +
    activity * 1.0 +
    temp * 0.5 +
    humidity * 0.4 +
    pressure * 0.5 +
    altitude * 0.6;
  const maxRawScore = 5 * (1.3 + 1.5 + 1.1 + 1.1 + 1.0 + 1.2 + 1.0 + 0.5 + 0.4 + 0.5 + 0.6); // 51.0
  const normalizedRaw = Math.min(1.0, Math.max(0.0, rawScore / maxRawScore));

  let scoreNum = 0.0;
  if (severity_label === 'NORMAL') {
    scoreNum = 0.0;
  } else if (severity_label === 'CONTROL') {
    scoreNum = 0.05 + normalizedRaw * 0.20;
  } else if (severity_label === 'MILD') {
    scoreNum = 0.26 + normalizedRaw * 0.24;
  } else if (severity_label === 'HIGH') {
    scoreNum = 0.51 + normalizedRaw * 0.24;
  } else {
    scoreNum = 0.76 + normalizedRaw * 0.24;
  }
  const severity_score = scoreNum.toFixed(2);

  // 3. DETERMINISTIC CONFIDENCE SCORE & LEVEL (0.00 - 1.00) FOR SNAPSHOT (TEST)
  let coherencePenalty = 0.0;
  if (activity >= 4 && hr <= 1) coherencePenalty += 0.18;
  else if (activity >= 3 && hr === 0) coherencePenalty += 0.12;

  if (spo2 >= 4 && rr === 0) coherencePenalty += 0.15;
  else if (spo2 >= 3 && rr === 0 && hr === 0) coherencePenalty += 0.10;

  if (hr >= 4 && rmssd === 0 && sdnn === 0 && ppi === 0) coherencePenalty += 0.10;
  if (temp >= 4 && hr === 0 && activity === 0) coherencePenalty += 0.06;
  if (altitude >= 4 && spo2 === 0 && rr === 0 && hr === 0) coherencePenalty += 0.08;

  let baseConfidence = 0.88;
  if (activeCount === 0) baseConfidence = 0.98;
  else if (activeCount === 1) baseConfidence = 0.92;
  else if (activeCount <= 3) baseConfidence = 0.86;
  else if (activeCount <= 6) baseConfidence = 0.80;
  else if (activeCount <= 9) baseConfidence = 0.75;
  else baseConfidence = 0.70;

  const stageSum = stages.reduce((a, b) => a + b, 0);
  const variancePerturbation = ((stageSum * 13 + hr * 3 + spo2 * 7) % 7) * 0.01;

  const rawConfidence = baseConfidence - coherencePenalty - variancePerturbation;
  const finalConfidence = Math.max(0.50, Math.min(0.99, rawConfidence));
  const confidence_score = finalConfidence.toFixed(2);
  const confNum = parseFloat(confidence_score);
  const confidence_level: ConfidenceLevel =
    confNum >= 0.85 ? 'HIGH' : confNum >= 0.65 ? 'MEDIUM' : 'LOW';

  // 4. TAXONOMY EVALUATION
  const cardiacScore = hr * 1.3 + ppi * 1.0;
  const oxygenationScore = spo2 * 1.5 + (rr > spo2 ? rr * 1.1 : 0);
  const respiratoryScore = rr * 1.2;
  const autonomicScore = rmssd * 1.1 + sdnn * 1.1;
  const activityScore = activity * 1.4;
  const thermalScore = temp * 1.0 + humidity * 1.0;
  const pressureAltScore = pressure * 1.0 + altitude * 1.1;

  const groups: { name: string; score: number }[] = [];
  if (cardiacScore > 0) groups.push({ name: 'CARDIAC_PATTERN', score: cardiacScore });
  if (spo2 > 0) groups.push({ name: 'OXYGENATION_PATTERN', score: oxygenationScore });
  else if (rr > 0 && cardiacScore === 0) groups.push({ name: 'RESPIRATORY_PATTERN', score: respiratoryScore });
  if (autonomicScore > 0) groups.push({ name: 'AUTONOMIC_HRV_PATTERN', score: autonomicScore });
  if (activityScore > 0) groups.push({ name: 'ACTIVITY_METABOLIC_PATTERN', score: activityScore });
  if (thermalScore > 0) groups.push({ name: 'THERMAL_ENVIRONMENTAL_PATTERN', score: thermalScore });
  if (pressureAltScore > 0) groups.push({ name: 'ENVIRONMENTAL_PRESSURE_ALTITUDE_PATTERN', score: pressureAltScore });

  groups.sort((a, b) => b.score - a.score);

  let primary_taxonomy = 'NORMAL_BASELINE';
  let secondaryList: string[] = [];

  if (maxStage === 0) {
    primary_taxonomy = 'NORMAL_BASELINE';
    secondaryList = [];
  } else if (severity_label === 'RISK' && groups.length >= 3) {
    primary_taxonomy = 'MULTI_PARAMETER_RISK';
    secondaryList = groups.map((g) => g.name);
  } else if (cardiacScore > 0 && (spo2 > 0 || rr > 0)) {
    primary_taxonomy = 'CARDIORESPIRATORY_PATTERN';
    const otherGroups = groups.filter(
      (g) => g.name !== 'CARDIAC_PATTERN' && g.name !== 'OXYGENATION_PATTERN' && g.name !== 'RESPIRATORY_PATTERN'
    );
    secondaryList = [
      ...(spo2 > 0 ? ['OXYGENATION_PATTERN'] : ['RESPIRATORY_PATTERN']),
      'CARDIAC_PATTERN',
      ...otherGroups.map((g) => g.name),
    ];
  } else if (activityScore > 0 && (cardiacScore > 0 || autonomicScore > 0)) {
    primary_taxonomy = activityScore >= (cardiacScore + autonomicScore) ? 'ACTIVITY_METABOLIC_PATTERN' : 'CARDIORESPIRATORY_PATTERN';
    secondaryList = groups.filter((g) => g.name !== primary_taxonomy).map((g) => g.name);
  } else if (groups.length > 0) {
    primary_taxonomy = groups[0].name;
    secondaryList = groups.slice(1).map((g) => g.name);
  }

  const uniqueSecondary = Array.from(new Set(secondaryList.filter((s) => s !== primary_taxonomy)));
  const secondary_taxonomy = uniqueSecondary.join('|');

  // 5. PATTERN LABEL
  let pattern_label = 'Normal Baseline';
  if (maxStage === 0) {
    pattern_label = 'Normal Baseline';
  } else if (primary_taxonomy === 'MULTI_PARAMETER_RISK') {
    pattern_label = 'Severe Multisystem Risk Pattern';
  } else if (primary_taxonomy === 'CARDIORESPIRATORY_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Subtle Cardiorespiratory Shift';
    else if (severity_label === 'MILD') pattern_label = 'Cardiorespiratory Load';
    else if (severity_label === 'HIGH') pattern_label = 'High Cardiorespiratory Load';
    else pattern_label = 'Severe Cardiorespiratory Stress';
  } else if (primary_taxonomy === 'CARDIAC_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Isolated Cardiac Variation';
    else if (severity_label === 'MILD') pattern_label = 'Mild Cardiac Load';
    else if (severity_label === 'HIGH') pattern_label = 'High Cardiac Strain';
    else pattern_label = 'Severe Cardiac Stress';
  } else if (primary_taxonomy === 'OXYGENATION_PATTERN') {
    if (severity_label === 'CONTROL' || severity_label === 'MILD') pattern_label = 'Mild Oxygenation Load';
    else if (severity_label === 'HIGH') pattern_label = 'High Hypoxic Stress';
    else pattern_label = 'Critical Hypoxic Risk';
  } else if (primary_taxonomy === 'RESPIRATORY_PATTERN') {
    if (severity_label === 'CONTROL' || severity_label === 'MILD') pattern_label = 'Mild Respiratory Load';
    else if (severity_label === 'HIGH') pattern_label = 'High Respiratory Stress';
    else pattern_label = 'Severe Respiratory Compromise';
  } else if (primary_taxonomy === 'AUTONOMIC_HRV_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Minor Autonomic Fluctuation';
    else if (severity_label === 'MILD') pattern_label = 'Autonomic Stress Response';
    else if (severity_label === 'HIGH') pattern_label = 'High Autonomic Depletion';
    else pattern_label = 'Severe Autonomic Deregulation';
  } else if (primary_taxonomy === 'ACTIVITY_METABOLIC_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Light Physical Activity';
    else if (severity_label === 'MILD') pattern_label = 'Moderate Metabolic Exertion';
    else if (severity_label === 'HIGH') pattern_label = 'Vigorous Exercise Load';
    else pattern_label = 'Exhaustive Physical Strain';
  } else if (primary_taxonomy === 'THERMAL_ENVIRONMENTAL_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Ambient Thermal Fluctuation';
    else if (severity_label === 'MILD') pattern_label = 'Mild Environmental Thermal Load';
    else if (severity_label === 'HIGH') pattern_label = 'High Thermal Stress';
    else pattern_label = 'Extreme Thermal Risk';
  } else if (primary_taxonomy === 'ENVIRONMENTAL_PRESSURE_ALTITUDE_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Barometric Pressure Variation';
    else if (severity_label === 'MILD') pattern_label = 'Moderate Altitude Exposure';
    else if (severity_label === 'HIGH') pattern_label = 'High Altitude Hypobaric Load';
    else pattern_label = 'Extreme High-Altitude Stress';
  }

  return {
    primary_taxonomy,
    secondary_taxonomy,
    pattern_label,
    severity_label,
    severity_score,
    confidence_score,
    confidence_level,
  };
}

/**
 * Evaluates an entire longitudinal trajectory of N vectors (N = 3 for DAY, 21 for WEEK, 84 for MONTH).
 * Correctly computes trajectory-level longitudinal severity, taxonomy, pattern label, confidence, and trend.
 */
export function evaluateTrajectory(vectors: StageVector[]): TrajectoryEvaluationResult {
  const N = vectors.length;
  if (N <= 1) {
    const single = evaluateStageVector(vectors[0]);
    return {
      ...single,
      trend_label: 'N/A',
    };
  }

  // 1. Evaluate all instantaneous timepoints
  const timepointEvals = vectors.map((v) => evaluateStageVector(v));
  const sevScores = timepointEvals.map((e) => parseFloat(e.severity_score));
  
  // 2. Compute Trajectory Statistics
  const meanSev = sevScores.reduce((a, b) => a + b, 0) / N;
  const maxSev = Math.max(...sevScores);
  const minSev = Math.min(...sevScores);
  
  let sevVariance = 0;
  for (let i = 0; i < N; i++) {
    sevVariance += Math.pow(sevScores[i] - meanSev, 2);
  }
  sevVariance /= N;
  const sevStdDev = Math.sqrt(sevVariance);

  // 3. Linear Regression for Trend
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < N; i++) {
    const x = i + 1;
    const y = sevScores[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const slope = (N * sumXY - sumX * sumY) / (N * sumXX - sumX * sumX);

  // Determine Longitudinal Trend Label
  let trend_label: TrendLabel = 'STABLE';
  if (meanSev < 0.05 && maxSev <= 0.06) {
    trend_label = 'STABLE';
  } else if (meanSev >= 0.50 && Math.abs(slope) < 0.020 && sevVariance < 0.02) {
    trend_label = 'PERSISTENT_ABNORMALITY';
  } else if (slope > 0.020) {
    trend_label = 'DETERIORATING';
  } else if (slope < -0.020) {
    trend_label = (sevScores[0] >= 0.45 && sevScores[N - 1] <= 0.30) ? 'RECOVERING' : 'IMPROVING';
  } else if (sevVariance >= 0.015) {
    trend_label = 'FLUCTUATING';
  } else {
    trend_label = 'STABLE';
  }

  // 4. Longitudinal Weighted Severity Score & Label
  // Blend mean severity (60%) with maximum sustained severity (40%) to account for cumulative burden
  const weightedSevScore = Math.min(1.0, Math.max(0.0, 0.65 * meanSev + 0.35 * maxSev));
  const severity_score = weightedSevScore.toFixed(2);
  const scoreNum = parseFloat(severity_score);

  let severity_label: SeverityLevel;
  if (scoreNum < 0.04) severity_label = 'NORMAL';
  else if (scoreNum <= 0.25) severity_label = 'CONTROL';
  else if (scoreNum <= 0.50) severity_label = 'MILD';
  else if (scoreNum <= 0.75) severity_label = 'HIGH';
  else severity_label = 'RISK';

  // 5. Longitudinal Primary and Secondary Taxonomy (Cumulative Organ System Burden)
  const cumulativeDomainScores: Record<string, number> = {
    CARDIAC_PATTERN: 0,
    OXYGENATION_PATTERN: 0,
    RESPIRATORY_PATTERN: 0,
    AUTONOMIC_HRV_PATTERN: 0,
    ACTIVITY_METABOLIC_PATTERN: 0,
    THERMAL_ENVIRONMENTAL_PATTERN: 0,
    ENVIRONMENTAL_PRESSURE_ALTITUDE_PATTERN: 0,
  };

  vectors.forEach((v) => {
    const [hr, spo2, ppi, rmssd, sdnn, rr, activity, temp, humidity, pressure, altitude] = v;
    cumulativeDomainScores.CARDIAC_PATTERN += hr * 1.3 + ppi * 1.0;
    cumulativeDomainScores.OXYGENATION_PATTERN += spo2 * 1.5;
    cumulativeDomainScores.RESPIRATORY_PATTERN += rr * 1.2;
    cumulativeDomainScores.AUTONOMIC_HRV_PATTERN += rmssd * 1.1 + sdnn * 1.1;
    cumulativeDomainScores.ACTIVITY_METABOLIC_PATTERN += activity * 1.4;
    cumulativeDomainScores.THERMAL_ENVIRONMENTAL_PATTERN += temp * 1.0 + humidity * 1.0;
    cumulativeDomainScores.ENVIRONMENTAL_PRESSURE_ALTITUDE_PATTERN += pressure * 1.0 + altitude * 1.1;
  });

  const sortedDomains = Object.entries(cumulativeDomainScores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  let primary_taxonomy = 'NORMAL_BASELINE';
  let secondary_taxonomy = '';

  if (severity_label === 'NORMAL' || sortedDomains.length === 0) {
    primary_taxonomy = 'NORMAL_BASELINE';
    secondary_taxonomy = '';
  } else if (severity_label === 'RISK' && sortedDomains.length >= 3) {
    primary_taxonomy = 'MULTI_PARAMETER_RISK';
    secondary_taxonomy = sortedDomains.map((d) => d[0]).join('|');
  } else if (
    cumulativeDomainScores.CARDIAC_PATTERN > 0 &&
    (cumulativeDomainScores.OXYGENATION_PATTERN > 0 || cumulativeDomainScores.RESPIRATORY_PATTERN > 0)
  ) {
    primary_taxonomy = 'CARDIORESPIRATORY_PATTERN';
    const other = sortedDomains.filter((d) => d[0] !== 'CARDIAC_PATTERN' && d[0] !== 'OXYGENATION_PATTERN' && d[0] !== 'RESPIRATORY_PATTERN');
    const sec = [
      cumulativeDomainScores.OXYGENATION_PATTERN > 0 ? 'OXYGENATION_PATTERN' : 'RESPIRATORY_PATTERN',
      'CARDIAC_PATTERN',
      ...other.map((d) => d[0]),
    ];
    secondary_taxonomy = Array.from(new Set(sec)).join('|');
  } else {
    primary_taxonomy = sortedDomains[0][0];
    secondary_taxonomy = sortedDomains.slice(1).map((d) => d[0]).join('|');
  }

  // 6. Longitudinal Pattern Label
  let pattern_label = 'Normal Baseline';
  if (severity_label === 'NORMAL') {
    pattern_label = 'Normal Baseline';
  } else if (primary_taxonomy === 'MULTI_PARAMETER_RISK') {
    pattern_label = trend_label === 'PERSISTENT_ABNORMALITY' ? 'Persistent Multisystem Risk' : 'Severe Multisystem Risk Pattern';
  } else if (primary_taxonomy === 'CARDIORESPIRATORY_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Subtle Cardiorespiratory Shift';
    else if (severity_label === 'MILD') pattern_label = trend_label === 'RECOVERING' ? 'Resolving Cardiorespiratory Load' : 'Cardiorespiratory Load';
    else if (severity_label === 'HIGH') pattern_label = trend_label === 'DETERIORATING' ? 'Progressive Cardiorespiratory Strain' : 'High Cardiorespiratory Load';
    else pattern_label = 'Severe Cardiorespiratory Stress';
  } else if (primary_taxonomy === 'CARDIAC_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Isolated Cardiac Variation';
    else if (severity_label === 'MILD') pattern_label = trend_label === 'RECOVERING' ? 'Resolving Cardiac Load' : 'Mild Cardiac Load';
    else if (severity_label === 'HIGH') pattern_label = trend_label === 'PERSISTENT_ABNORMALITY' ? 'Persistent Cardiac Strain' : 'High Cardiac Strain';
    else pattern_label = 'Severe Cardiac Stress';
  } else if (primary_taxonomy === 'OXYGENATION_PATTERN') {
    if (severity_label === 'CONTROL' || severity_label === 'MILD') pattern_label = 'Mild Oxygenation Load';
    else if (severity_label === 'HIGH') pattern_label = trend_label === 'RECOVERING' ? 'Resolving Hypoxic Stress' : 'High Hypoxic Stress';
    else pattern_label = 'Critical Hypoxic Risk';
  } else if (primary_taxonomy === 'RESPIRATORY_PATTERN') {
    if (severity_label === 'CONTROL' || severity_label === 'MILD') pattern_label = 'Mild Respiratory Load';
    else if (severity_label === 'HIGH') pattern_label = 'High Respiratory Stress';
    else pattern_label = 'Severe Respiratory Compromise';
  } else if (primary_taxonomy === 'AUTONOMIC_HRV_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Minor Autonomic Fluctuation';
    else if (severity_label === 'MILD') pattern_label = 'Autonomic Stress Response';
    else if (severity_label === 'HIGH') pattern_label = 'High Autonomic Depletion';
    else pattern_label = 'Severe Autonomic Deregulation';
  } else if (primary_taxonomy === 'ACTIVITY_METABOLIC_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Light Physical Activity';
    else if (severity_label === 'MILD') pattern_label = 'Moderate Metabolic Exertion';
    else if (severity_label === 'HIGH') pattern_label = 'Vigorous Exercise Load';
    else pattern_label = 'Exhaustive Physical Strain';
  } else if (primary_taxonomy === 'THERMAL_ENVIRONMENTAL_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Ambient Thermal Fluctuation';
    else if (severity_label === 'MILD') pattern_label = 'Mild Environmental Thermal Load';
    else if (severity_label === 'HIGH') pattern_label = 'High Thermal Stress';
    else pattern_label = 'Extreme Thermal Risk';
  } else if (primary_taxonomy === 'ENVIRONMENTAL_PRESSURE_ALTITUDE_PATTERN') {
    if (severity_label === 'CONTROL') pattern_label = 'Barometric Pressure Variation';
    else if (severity_label === 'MILD') pattern_label = 'Moderate Altitude Exposure';
    else if (severity_label === 'HIGH') pattern_label = 'High Altitude Hypobaric Load';
    else pattern_label = 'Extreme High-Altitude Stress';
  }

  // 7. Longitudinal Confidence Model (Scientifically Grounded on Evidence Depth & Consistency)
  // Base confidence increases with observation sample size N
  let depthBaseConfidence = 0.82;
  if (N === 3) depthBaseConfidence = 0.86;
  else if (N === 21) depthBaseConfidence = 0.91;
  else if (N >= 84) depthBaseConfidence = 0.95;

  // Trajectory stability bonus/penalty:
  // Low variance and consistent trend increases confidence; high state fluctuation penalizes confidence
  const stabilityFactor = Math.max(-0.25, Math.min(0.04, 0.03 - sevVariance * 2.5));
  
  // Signal coherence penalty from timepoint evaluations
  const avgPointConfidence = timepointEvals.reduce((a, b) => a + parseFloat(b.confidence_score), 0) / N;
  const coherenceAdj = (avgPointConfidence - 0.80) * 0.35;

  const rawTrajectoryConfidence = depthBaseConfidence + stabilityFactor + coherenceAdj;
  const finalTrajectoryConfidence = Math.max(0.50, Math.min(0.99, rawTrajectoryConfidence));
  const confidence_score = finalTrajectoryConfidence.toFixed(2);
  const confNum = parseFloat(confidence_score);
  const confidence_level: ConfidenceLevel =
    confNum >= 0.85 ? 'HIGH' : confNum >= 0.65 ? 'MEDIUM' : 'LOW';

  return {
    primary_taxonomy,
    secondary_taxonomy,
    pattern_label,
    severity_label,
    severity_score,
    confidence_score,
    confidence_level,
    trend_label,
  };
}
