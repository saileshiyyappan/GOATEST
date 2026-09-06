import PDFDocument from 'pdfkit';
import {
  ConditionReportDocument,
  ConditionResult,
  DayConditionResult,
  WeekConditionResult,
  MonthConditionResult,
  ParameterReportItem,
  TemporalObservationSummary,
  HomeQASection,
  TemporalLevel,
  SeverityLevel,
  ConfidenceLevel,
  TrendLabel,
  ConditionMatchStatus,
} from './conditionTypes';
import { CANONICAL_11_PARAMETERS } from '../../engine/canonicalParameters';
import { StageVector, evaluateStageVector } from '../../c50/evaluator';

/**
 * Formats a Date object into the canonical PMT-5 Title format:
 * [DATE] [TIME] — BAND REPORT — GOATEST REPORT — [TEMPORAL LEVEL]
 * Example: 29 AUG 2026 14:32 — BAND REPORT — GOATEST REPORT — TEST
 */
export function formatCanonicalReportTitle(dateInput: string | Date, temporalLevel: TemporalLevel): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const day = validDate.getUTCDate().toString().padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[validDate.getUTCMonth()];
  const year = validDate.getUTCFullYear();
  const hours = validDate.getUTCHours().toString().padStart(2, '0');
  const mins = validDate.getUTCMinutes().toString().padStart(2, '0');

  return `${day} ${month} ${year} ${hours}:${mins} — BAND REPORT — GOATEST REPORT — ${temporalLevel.toUpperCase()}`;
}

/**
 * Standard behavioral / action recommendations strictly bounded by non-diagnostic decision support.
 */
function getActionGuidance(severity: SeverityLevel): string {
  switch (severity) {
    case 'RISK':
      return 'Significant multi-system physiological elevation detected. Cease intense physical exertion immediately, rest in a temperate, well-ventilated space, and hydrate. Seek immediate professional clinical evaluation if accompanied by acute chest pain, dyspnea, or dizziness.';
    case 'HIGH':
      return 'Elevated autonomic strain and cardiorespiratory load observed. Reduce ongoing physical activity, engage in paced diaphragmatic breathing, and allow a 30-minute recovery period before reassessment.';
    case 'MILD':
      return 'Minor deviations from personal baseline. Continue routine activities with mindful pacing, maintain adequate hydration, and perform a standard follow-up check at the next scheduled interval.';
    case 'CONTROL':
    case 'NORMAL':
    default:
      return 'Physiological parameters remain well-bounded within expected normative control baselines. No corrective action required; continue scheduled diurnal tracking.';
  }
}

/**
 * Standard wellness and monitoring guidance.
 */
function getWellnessMonitoringGuidance(temporalLevel: TemporalLevel, severity: SeverityLevel): string {
  if (temporalLevel === 'DAY') {
    return 'Diurnal trajectory active. Maintain standard 3-point daily observation cadence (Morning resting baseline, Midday activity checkpoint, Evening recovery audit). Keep sensor band clean and snugly positioned 1 cm above the wrist bone.';
  } else if (temporalLevel === 'WEEK') {
    return 'Weekly multi-day monitoring active. Review diurnal trends and day-to-day variance. Ensure consistent sleep hygiene, regular hydration, and scheduled resting intervals.';
  } else if (temporalLevel === 'MONTH') {
    return 'Monthly longitudinal baseline active. Track systemic adaptation and baseline drift. Discuss longitudinal trend stability with your wellness supervisor or health advisor.';
  }
  return 'Standard single-observation check completed. Ensure comfortable sensor contact. If physiological state feels atypical, perform a follow-up test after 15 minutes of seated rest.';
}

/**
 * Standard non-diagnostic limitations disclaimer.
 */
export const NON_DIAGNOSTIC_DISCLAIMER =
  'Computational physiological stage decision support only. Not intended as primary clinical or diagnostic medical evaluation. BAND / GOATEST physiological pattern classification prototype.';

/**
 * Generates parameter-specific interpretations for each canonical channel.
 */
function buildParameterReportItems(
  inputStages: StageVector | number[],
  matchedStages: StageVector | number[],
  rawInputs?: Array<{ parameterId: string; shbValue?: number; phbBaseline?: number }>
): ParameterReportItem[] {
  const items: ParameterReportItem[] = [];

  for (let i = 0; i < 11; i++) {
    const config = CANONICAL_11_PARAMETERS[i];
    const inStage = (inputStages && typeof inputStages[i] === 'number') ? inputStages[i] : 0;
    const mtStage = (matchedStages && typeof matchedStages[i] === 'number') ? matchedStages[i] : 0;
    const isAbnormal = inStage > 0;
    const isMatched = inStage === mtStage;
    const deltaStage = inStage - mtStage;

    const rawMatch = rawInputs?.find((r) => r.parameterId === config.id);

    let stageLabel = `Stage 0 (Normative Basal)`;
    if (inStage === 1) stageLabel = `Stage 1 (Subtle Shift)`;
    else if (inStage === 2) stageLabel = `Stage 2 (Moderate Elevation)`;
    else if (inStage === 3) stageLabel = `Stage 3 (Substantial Deviation)`;
    else if (inStage === 4) stageLabel = `Stage 4 (Marked Strain)`;
    else if (inStage === 5) stageLabel = `Stage 5 (Critical Boundary)`;

    let interpretation = `${config.name} is within expected control baseline (Stage 0).`;
    if (inStage > 0) {
      if (config.category === 'DV') {
        interpretation = `${config.name} demonstrates a Stage ${inStage} primary cardiovascular deviation, reflecting increased systemic hemodynamic demand.`;
      } else if (config.category === 'IV') {
        interpretation = `${config.name} demonstrates a Stage ${inStage} autonomic/respiratory response shift, indicating modulated parasympathetic/sympathetic balance.`;
      } else {
        interpretation = `${config.name} demonstrates a Stage ${inStage} environmental/contextual variance influencing physical load.`;
      }
    }

    items.push({
      index: i + 1,
      id: config.id,
      name: config.name,
      category: config.category,
      unit: config.unit,
      inputStage: inStage,
      matchedStage: mtStage,
      isAbnormal,
      isMatched,
      deltaStage,
      shbValue: rawMatch?.shbValue,
      phbBaseline: rawMatch?.phbBaseline,
      stageLabel,
      interpretation,
    });
  }

  return items;
}

/**
 * Builds the authoritative narrative for what was detected.
 */
function buildWhatWasDetectedNarrative(
  patternLabel: string,
  primaryTaxonomy: string,
  severity: SeverityLevel,
  inputStages: StageVector | number[],
  parameters: ParameterReportItem[],
  matchStatus: ConditionMatchStatus,
  datasetSno: string
): string {
  const abnormalCount = parameters.filter((p) => p.isAbnormal).length;
  const abnormalNames = parameters
    .filter((p) => p.isAbnormal)
    .map((p) => `${p.name} (Stage ${p.inputStage})`)
    .join(', ');

  let narrative = `Evaluation of 11-channel physiological and environmental profile identified a pattern consistent with "${patternLabel}" within the ${primaryTaxonomy.replace(/_/g, ' ')} taxonomy domain. `;

  if (abnormalCount === 0) {
    narrative += `All 11 canonical channels are currently operating within normative baseline thresholds (Stage 0 vector). `;
  } else {
    narrative += `A total of ${abnormalCount} of 11 canonical parameters exhibited stage elevation: ${abnormalNames}. `;
  }

  if (matchStatus === 'EXACT') {
    narrative += `An exact 11-stage vector match was resolved against certified reference record SNO #${datasetSno}.`;
  } else if (matchStatus === 'EQUIVALENT') {
    narrative += `An equivalent physiological burden vector was resolved against reference record SNO #${datasetSno}.`;
  } else if (matchStatus === 'APPROXIMATE') {
    narrative += `An approximate bounded clinical pattern match was resolved against reference record SNO #${datasetSno}.`;
  } else {
    narrative += `Evaluated directly through primary multi-system stage threshold rules.`;
  }

  return narrative;
}

/**
 * Builds combined parameter-specific multi-system interpretation narrative.
 */
function buildCombinedParameterInterpretation(parameters: ParameterReportItem[]): string {
  const dvAbnormal = parameters.filter((p) => p.category === 'DV' && p.isAbnormal);
  const ivAbnormal = parameters.filter((p) => p.category === 'IV' && p.isAbnormal);
  const cxAbnormal = parameters.filter((p) => p.category === 'CX' && p.isAbnormal);

  const parts: string[] = [];

  if (dvAbnormal.length > 0) {
    const list = dvAbnormal.map((p) => `${p.name} (S${p.inputStage})`).join(', ');
    parts.push(`Cardiovascular Dependent Channel(s) [${list}] reflect active hemodynamic compensation.`);
  } else {
    parts.push(`Cardiovascular parameters (Heart Rate, SpO2, PPI) remain stable at basal resting levels.`);
  }

  if (ivAbnormal.length > 0) {
    const list = ivAbnormal.map((p) => `${p.name} (S${p.inputStage})`).join(', ');
    parts.push(`Autonomic & Respiratory Channel(s) [${list}] indicate autonomic regulation response.`);
  } else {
    parts.push(`Autonomic HRV and Respiratory rates reflect balanced resting tone.`);
  }

  if (cxAbnormal.length > 0) {
    const list = cxAbnormal.map((p) => `${p.name} (S${p.inputStage})`).join(', ');
    parts.push(`Environmental / Contextual Load [${list}] provides active ambient co-factors.`);
  } else {
    parts.push(`Ambient environment and motion metrics remain standard.`);
  }

  return parts.join(' ');
}

/**
 * -------------------------------------------------------------------------
 * AUTHORITATIVE REPORT GENERATOR
 * Single Source of Truth for Web, Firestore, and PDF.
 * -------------------------------------------------------------------------
 */
export function buildAuthoritativeReport(options: {
  temporalLevel: TemporalLevel;
  uid: string;
  reportId: string;
  createdAt?: string;
  status?: string;

  // C50 Match Source Data (Single Source of Truth)
  inputStages: StageVector | number[];
  matchedStages: StageVector | number[];
  matchedDatasetSno: string | number;
  matchStatus: ConditionMatchStatus;
  distanceScore: number;
  primaryTaxonomy: string;
  secondaryTaxonomy?: string;
  patternLabel: string;
  severityLabel: SeverityLevel;
  severityScore: string | number;
  confidenceScore: string | number;
  confidenceLevel: ConfidenceLevel;
  trendLabel: TrendLabel;
  labelVerificationStatus?: string;

  // Optional Raw Inputs (for enriched reporting)
  rawInputs?: Array<{ parameterId: string; shbValue?: number; phbBaseline?: number }>;

  // Temporal Extensions (DAY / WEEK / MONTH)
  temporalObservationsCount?: number;
  temporalObservations?: TemporalObservationSummary[];
  initialSeverity?: SeverityLevel;
  peakSeverity?: SeverityLevel;
  finalSeverity?: SeverityLevel;
  meanSeverity?: number;
  dominantPattern?: string;
  patternPersistence?: number;
  parameterChanges?: string[];
  homeQA?: {
    status?: 'AVAILABLE' | 'Q/A_NOT_AVAILABLE' | 'NOT_AVAILABLE';
    displayText?: string;
    qaId?: string;
    submittedAt?: string;
    responses?: Record<string, any>;
    notes?: string;
    data?: any;
  } | null;
}): ConditionReportDocument {
  const {
    temporalLevel,
    uid,
    reportId,
    createdAt = new Date().toISOString(),
    status = 'COMPLETED',
    inputStages,
    matchedStages,
    matchedDatasetSno,
    matchStatus,
    distanceScore,
    primaryTaxonomy,
    secondaryTaxonomy = '',
    patternLabel,
    severityLabel,
    severityScore,
    confidenceScore,
    confidenceLevel,
    trendLabel,
    labelVerificationStatus = 'VERIFIED_CONSISTENT',
    rawInputs,
    temporalObservationsCount = temporalLevel === 'DAY' ? 3 : temporalLevel === 'WEEK' ? 21 : temporalLevel === 'MONTH' ? 84 : 1,
    temporalObservations,
    initialSeverity,
    peakSeverity,
    finalSeverity,
    meanSeverity,
    dominantPattern = patternLabel,
    patternPersistence = 1.0,
    parameterChanges = [],
    homeQA,
  } = options;

  const formattedTitle = formatCanonicalReportTitle(createdAt, temporalLevel);

  // 1. Build Canonical 11 Parameter Breakdown
  const parameters = buildParameterReportItems(inputStages, matchedStages, rawInputs);
  const abnormalParameters = parameters.filter((p) => p.isAbnormal);

  // 2. Build Summary & Narratives
  const whatWasDetected = buildWhatWasDetectedNarrative(
    patternLabel,
    primaryTaxonomy,
    severityLabel,
    inputStages,
    parameters,
    matchStatus,
    String(matchedDatasetSno)
  );

  let conditionSummary = `${patternLabel} identified under ${primaryTaxonomy.replace(/_/g, ' ')} taxonomy. Severity classified as ${severityLabel} (${typeof severityScore === 'number' ? severityScore.toFixed(2) : severityScore}) with ${confidenceLevel} confidence.`;
  if (temporalLevel === 'DAY') {
    conditionSummary = `Diurnal 3-observation evaluation resolved ${patternLabel} (${severityLabel}). Mean diurnal severity: ${meanSeverity ?? severityScore}, trend classified as ${trendLabel}.`;
  } else if (temporalLevel === 'WEEK') {
    conditionSummary = `Weekly 21-observation longitudinal sequence resolved dominant pattern ${dominantPattern} (${severityLabel}). Longitudinal trend: ${trendLabel}.`;
  } else if (temporalLevel === 'MONTH') {
    conditionSummary = `Monthly 84-observation systemic profile resolved dominant pattern ${dominantPattern} (${severityLabel}). Longitudinal trend: ${trendLabel}.`;
  }

  // 3. Trajectory & Trend Description
  const trendDescription =
    trendLabel === 'N/A'
      ? 'Single instantaneous cross-sectional observation.'
      : trendLabel === 'STABLE'
      ? 'Basal physiological homeostasis sustained across intervals.'
      : trendLabel === 'PERSISTENT_ABNORMALITY'
      ? 'Sustained elevation or abnormal stage pattern maintained across observations.'
      : trendLabel === 'FLUCTUATING'
      ? 'High state variance with shifting stage magnitudes between intervals.'
      : trendLabel === 'DETERIORATING'
      ? 'Progressive stage escalation indicating increased systemic load.'
      : trendLabel === 'RECOVERING'
      ? 'Measurable attenuation of initial stage elevations towards baseline.'
      : 'Gradual normalization of physiological parameters.';

  let temporalInterpretation = 'Instantaneous cross-sectional snapshot observation (TEST depth = 1).';
  if (temporalLevel === 'DAY') {
    temporalInterpretation = `3-observation diurnal trajectory evaluated. Longitudinal trend classified as ${trendLabel}.`;
  } else if (temporalLevel === 'WEEK') {
    temporalInterpretation = `21-observation weekly multi-day sequence evaluated. Longitudinal trend classified as ${trendLabel}.`;
  } else if (temporalLevel === 'MONTH') {
    temporalInterpretation = `84-observation comprehensive monthly trajectory evaluated. Longitudinal trend classified as ${trendLabel}.`;
  }

  // 4. Parameter Specific Interpretation
  const parameterSpecificInterpretation = buildCombinedParameterInterpretation(parameters);

  // 5. Actions & Guidance
  const whatShouldIDoNow = getActionGuidance(severityLabel);
  const wellnessMonitoringGuidance = getWellnessMonitoringGuidance(temporalLevel, severityLabel);

  // 6. Caretaker Technical Evidence
  const caretakerTechnicalEvidence = {
    primaryTaxonomy,
    secondaryTaxonomy: secondaryTaxonomy || 'Isolated Primary Domain',
    referenceDatasetSno: String(matchedDatasetSno),
    distanceScore: Number(distanceScore.toFixed(3)),
    stageVectorString: `[${Array.isArray(inputStages) ? inputStages.join(', ') : ''}]`,
    matchedVectorString: `[${Array.isArray(matchedStages) ? matchedStages.join(', ') : ''}]`,
    verificationStatus: labelVerificationStatus,
    evidenceNotes: `C50 Dataset Match: ${matchStatus} (SNO #${matchedDatasetSno}, Delta: ${distanceScore.toFixed(3)}). Verified non-diagnostic classification model.`,
  };

  // 7. Home Q/A Section Handling (Strict Non-Fabrication Rule)
  let structuredHomeQA: HomeQASection | undefined = undefined;
  if (temporalLevel === 'DAY' || temporalLevel === 'WEEK' || temporalLevel === 'MONTH') {
    const isQAAvailable =
      homeQA &&
      (homeQA.status === 'AVAILABLE' ||
        (homeQA.status as string) === 'SUBMITTED' ||
        (homeQA.status as string) === 'PROCESSED' ||
        Boolean(homeQA.data || homeQA.responses));

    if (isQAAvailable) {
      const qaObj = homeQA.data || homeQA;
      structuredHomeQA = {
        status: 'AVAILABLE',
        displayText: homeQA.displayText || 'User-reported diurnal symptoms and lifestyle factors recorded.',
        qaId: qaObj.qaId || qaObj.id || homeQA.qaId,
        submittedAt: qaObj.submittedAt || homeQA.submittedAt,
        responses: qaObj.responses || homeQA.responses,
        notes: qaObj.notes || homeQA.notes,
      };
    } else {
      structuredHomeQA = {
        status: 'Q/A_NOT_AVAILABLE',
        displayText: 'Q/A NOT AVAILABLE',
      };
    }
  }

  return {
    reportId,
    uid,
    createdAt,
    title: 'BAND / GOATEST CONDITION REPORT',
    formattedTitle,
    temporalLevel,
    temporalObservationsCount,
    status,

    conditionSummary,
    whatWasDetected,
    patternInterpretation: patternLabel,

    severity: {
      label: severityLabel,
      score: typeof severityScore === 'number' ? severityScore.toFixed(2) : String(severityScore),
      description: `${severityLabel} systemic physiological demand level.`,
      initialSeverity,
      peakSeverity,
      finalSeverity,
      meanSeverity,
    },
    confidence: {
      level: confidenceLevel,
      score: typeof confidenceScore === 'number' ? confidenceScore.toFixed(2) : String(confidenceScore),
      description: `${confidenceLevel} evidentiary confidence based on multi-channel distance boundary.`,
    },
    trend: {
      label: trendLabel,
      description: trendDescription,
    },
    taxonomy: {
      primary: primaryTaxonomy,
      secondary: secondaryTaxonomy,
    },

    matchedPattern: {
      inputStages,
      matchedDatasetSno: String(matchedDatasetSno),
      matchedStages,
      matchStatus,
      distanceScore: Number(distanceScore.toFixed(3)),
    },
    labelVerificationStatus,
    temporalInterpretation,

    parameters,
    abnormalParameters,
    parameterSpecificInterpretation,

    whatShouldIDoNow,
    wellnessMonitoringGuidance,
    caretakerTechnicalEvidence,
    limitationsDisclaimer: NON_DIAGNOSTIC_DISCLAIMER,

    temporalObservations,
    dominantPattern,
    patternPersistence,
    parameterChanges,
    homeQA: structuredHomeQA,
  };
}

/**
 * Adapter: Builds ConditionReportDocument directly from standard ConditionResult (TEST level).
 */
export function buildConditionReportDocument(
  result: ConditionResult,
  uid: string,
  rawInputs?: Array<{ parameterId: string; shbValue?: number; phbBaseline?: number }>
): ConditionReportDocument {
  return buildAuthoritativeReport({
    temporalLevel: result.temporalLevel,
    uid,
    reportId: result.reportId,
    createdAt: result.timestamp,
    status: 'COMPLETED',

    inputStages: result.inputVector,
    matchedStages: result.matchedRecord.matchedVector,
    matchedDatasetSno: result.matchedRecord.sno,
    matchStatus: result.matchStatus,
    distanceScore: result.distanceScore,
    primaryTaxonomy: result.primary_taxonomy,
    secondaryTaxonomy: result.secondary_taxonomy,
    patternLabel: result.pattern_label,
    severityLabel: result.severity_label,
    severityScore: result.severity_score,
    confidenceScore: result.confidence_score,
    confidenceLevel: result.confidence_level,
    trendLabel: result.trend_label,
    labelVerificationStatus: result.labelVerificationStatus,

    rawInputs,
    temporalObservationsCount: result.temporalObservationsCount,
  });
}

/**
 * Adapter: Builds ConditionReportDocument from DayConditionResult (DAY level).
 */
export function buildDayReportDocument(
  dayResult: DayConditionResult,
  uid: string,
  testObservations?: any[]
): ConditionReportDocument {
  const temporalObservations: TemporalObservationSummary[] = [];

  if (testObservations && testObservations.length > 0) {
    testObservations.forEach((obs, idx) => {
      const stageVector = (obs.inputStages || obs.stageVector || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) as StageVector;
      const evaluation = evaluateStageVector(stageVector);
      const name = idx === 0 ? 'Observation 1 (Morning)' : idx === 1 ? 'Observation 2 (Midday)' : 'Observation 3 (Evening)';

      temporalObservations.push({
        observationIndex: idx + 1,
        observationId: obs.id || obs.observationId || `obs_test_${idx + 1}`,
        name,
        timestamp: obs.timestamp || obs.createdAt,
        stageVector,
        severity: evaluation.severity_label,
        severityScore: parseFloat(evaluation.severity_score) || 0,
        pattern: evaluation.pattern_label,
      });
    });
  }

  const inputStages = dayResult.inputStages ? (dayResult.inputStages.slice(0, 11) as StageVector) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const matchedStages = dayResult.matchedStages ? (dayResult.matchedStages.slice(0, 11) as StageVector) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  return buildAuthoritativeReport({
    temporalLevel: 'DAY',
    uid,
    reportId: dayResult.reportId || `rep_day_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: dayResult.status,

    inputStages,
    matchedStages,
    matchedDatasetSno: dayResult.referenceDatasetSno ?? 0,
    matchStatus: dayResult.matchStatus,
    distanceScore: dayResult.distanceScore || 0,
    primaryTaxonomy: dayResult.classification || 'NORMAL_BASELINE',
    patternLabel: dayResult.dominantPattern || dayResult.matchedPattern || 'Normative Diurnal Pattern',
    severityLabel: dayResult.severity || 'NORMAL',
    severityScore: dayResult.severityScore ?? 0,
    confidenceScore: dayResult.confidenceScore ?? 0.95,
    confidenceLevel: dayResult.confidenceLevel || 'HIGH',
    trendLabel: dayResult.trend || 'STABLE',

    temporalObservationsCount: 3,
    temporalObservations,
    initialSeverity: dayResult.initialSeverity || undefined,
    peakSeverity: dayResult.peakSeverity || undefined,
    finalSeverity: dayResult.finalSeverity || undefined,
    meanSeverity: dayResult.meanSeverity ?? undefined,
    dominantPattern: dayResult.dominantPattern || undefined,
    patternPersistence: dayResult.patternPersistence,

    homeQA: dayResult.qaStatus === 'AVAILABLE' && dayResult.qaData
      ? {
          status: 'AVAILABLE',
          displayText: 'Home Web Q/A Recorded',
          qaId: dayResult.qaData.id || dayResult.qaData.qaId,
          submittedAt: dayResult.qaData.submittedAt,
          responses: dayResult.qaData.responses,
          notes: dayResult.qaData.notes,
        }
      : {
          status: 'Q/A_NOT_AVAILABLE',
          displayText: 'Q/A NOT AVAILABLE',
        },
  });
}

/**
 * Adapter: Builds ConditionReportDocument from WeekConditionResult (WEEK level).
 */
export function buildWeekReportDocument(
  weekResult: WeekConditionResult,
  uid: string,
  dayObservations?: any[]
): ConditionReportDocument {
  const temporalObservations: TemporalObservationSummary[] = [];

  if (dayObservations && dayObservations.length > 0) {
    dayObservations.forEach((obs, idx) => {
      const stageVector = (obs.inputStages ? obs.inputStages.slice(0, 11) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) as StageVector;
      const evaluation = evaluateStageVector(stageVector);

      temporalObservations.push({
        observationIndex: idx + 1,
        observationId: obs.id || obs.observationId || `obs_day_${idx + 1}`,
        name: `Day ${idx + 1} Diurnal Profile`,
        timestamp: obs.timestamp || obs.createdAt,
        stageVector,
        severity: evaluation.severity_label,
        severityScore: parseFloat(evaluation.severity_score) || 0,
        pattern: evaluation.pattern_label,
      });
    });
  }

  const inputStages = weekResult.inputStages ? (weekResult.inputStages.slice(0, 11) as StageVector) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const matchedStages = weekResult.matchedStages ? (weekResult.matchedStages.slice(0, 11) as StageVector) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  return buildAuthoritativeReport({
    temporalLevel: 'WEEK',
    uid,
    reportId: weekResult.reportId || `rep_week_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: weekResult.status,

    inputStages,
    matchedStages,
    matchedDatasetSno: weekResult.referenceDatasetSno ?? 0,
    matchStatus: weekResult.matchStatus,
    distanceScore: weekResult.distanceScore || 0,
    primaryTaxonomy: weekResult.classification || 'NORMAL_BASELINE',
    secondaryTaxonomy: weekResult.secondaryTaxonomy,
    patternLabel: weekResult.dominantPattern || weekResult.matchedPattern || 'Normative Multi-Day Profile',
    severityLabel: weekResult.severity || 'NORMAL',
    severityScore: weekResult.severityScore ?? 0,
    confidenceScore: weekResult.confidenceScore ?? 0.95,
    confidenceLevel: weekResult.confidenceLevel || 'HIGH',
    trendLabel: weekResult.trend || 'STABLE',

    temporalObservationsCount: 21,
    temporalObservations,
    initialSeverity: weekResult.initialSeverity || undefined,
    peakSeverity: weekResult.peakSeverity || undefined,
    finalSeverity: weekResult.finalSeverity || undefined,
    meanSeverity: weekResult.meanSeverity ?? undefined,
    dominantPattern: weekResult.dominantPattern || undefined,
    patternPersistence: weekResult.patternPersistence,
    homeQA: {
      status: 'Q/A_NOT_AVAILABLE',
      displayText: 'Q/A NOT AVAILABLE',
    },
  });
}

/**
 * Adapter: Builds ConditionReportDocument from MonthConditionResult (MONTH level).
 */
export function buildMonthReportDocument(
  monthResult: MonthConditionResult,
  uid: string,
  weekObservations?: any[]
): ConditionReportDocument {
  const temporalObservations: TemporalObservationSummary[] = [];

  if (weekObservations && weekObservations.length > 0) {
    weekObservations.forEach((obs, idx) => {
      const stageVector = (obs.inputStages ? obs.inputStages.slice(0, 11) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) as StageVector;
      const evaluation = evaluateStageVector(stageVector);

      temporalObservations.push({
        observationIndex: idx + 1,
        observationId: obs.id || obs.observationId || `obs_week_${idx + 1}`,
        name: `Week ${idx + 1} Profile`,
        timestamp: obs.timestamp || obs.createdAt,
        stageVector,
        severity: evaluation.severity_label,
        severityScore: parseFloat(evaluation.severity_score) || 0,
        pattern: evaluation.pattern_label,
      });
    });
  }

  const inputStages = monthResult.inputStages ? (monthResult.inputStages.slice(0, 11) as StageVector) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const matchedStages = monthResult.matchedStages ? (monthResult.matchedStages.slice(0, 11) as StageVector) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  return buildAuthoritativeReport({
    temporalLevel: 'MONTH',
    uid,
    reportId: monthResult.reportId || `rep_month_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: monthResult.status,

    inputStages,
    matchedStages,
    matchedDatasetSno: monthResult.referenceDatasetSno ?? 0,
    matchStatus: monthResult.matchStatus,
    distanceScore: monthResult.distanceScore || 0,
    primaryTaxonomy: monthResult.classification || 'NORMAL_BASELINE',
    secondaryTaxonomy: monthResult.secondaryTaxonomy,
    patternLabel: monthResult.dominantPattern || monthResult.matchedPattern || 'Normative Monthly Profile',
    severityLabel: monthResult.severity || 'NORMAL',
    severityScore: monthResult.severityScore ?? 0,
    confidenceScore: monthResult.confidenceScore ?? 0.95,
    confidenceLevel: monthResult.confidenceLevel || 'HIGH',
    trendLabel: monthResult.trend || 'STABLE',

    temporalObservationsCount: 84,
    temporalObservations,
    initialSeverity: monthResult.initialSeverity || undefined,
    peakSeverity: monthResult.peakSeverity || undefined,
    finalSeverity: monthResult.finalSeverity || undefined,
    meanSeverity: monthResult.meanSeverity ?? undefined,
    dominantPattern: monthResult.dominantPattern || undefined,
    patternPersistence: monthResult.patternPersistence,
    homeQA: {
      status: 'Q/A_NOT_AVAILABLE',
      displayText: 'Q/A NOT AVAILABLE',
    },
  });
}

/**
 * Generates an Authoritative PDF document buffer from the common ConditionReportDocument.
 * Strictly adheres to PMT-5:
 * - Professional clinical/research layout
 * - Visible, unclipped 11-parameter table
 * - Formatted report title
 * - Non-diagnostic disclaimer
 * - Complete data consistency with Web and Firestore
 */
export function generateReportPdfBuffer(report: ConditionReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: report.formattedTitle,
          Author: 'BAND / GOATEST Physiological Stage Pipeline',
          Subject: `${report.temporalLevel} Condition Report - ${report.reportId}`,
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Color Palette (Sophisticated Light Clinical Theme)
      const primaryDark = '#0f172a';
      const slateDark = '#1e293b';
      const slateLight = '#f8fafc';
      const borderColor = '#cbd5e1';
      const textMain = '#1e293b';
      const textMuted = '#64748b';
      const accentBlue = '#0284c7';
      const greenMatch = '#16a34a';
      const amberDelta = '#d97706';
      const redAlert = '#dc2626';

      // 1. Header Banner
      doc.rect(36, 36, 523, 56).fill(primaryDark);

      // Title & Branding
      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text('BAND / GOATEST PHYSIOLOGICAL STAGE EVALUATION', 48, 46);
      doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8').text(report.formattedTitle, 48, 62);
      doc.fontSize(7.5).fillColor('#64748b').text(`REPORT ID: ${report.reportId}  |  UID: ${report.uid}`, 48, 74);

      let currentY = 100;

      // 2. Summary & What Was Detected Card
      doc.rect(36, currentY, 523, 68).fillAndStroke(slateLight, borderColor);
      doc.fillColor(slateDark).fontSize(9).font('Helvetica-Bold').text('EXECUTIVE CONDITION SUMMARY & WHAT WAS DETECTED', 46, currentY + 8);
      doc.fontSize(8).font('Helvetica').fillColor(textMain).text(report.conditionSummary, 46, currentY + 22, { width: 503, lineGap: 1.5 });
      doc.fontSize(7.5).fillColor(textMuted).text(report.whatWasDetected, 46, currentY + 44, { width: 503, lineGap: 1 });

      currentY += 76;

      // 3. Clinical Metrics 4-Column Grid
      const colW = 124;
      const colGap = 9;
      const cardH = 50;

      const sevLabel = typeof report.severity === 'string' ? report.severity : (report.severity?.label || 'NORMAL');
      const sevScore = typeof report.severity === 'object' ? (report.severity?.score || '0.00') : '0.00';
      const confLevel = typeof report.confidence === 'string' ? report.confidence : (report.confidence?.level || 'HIGH');
      const confScore = typeof report.confidence === 'object' ? (report.confidence?.score || '0.95') : '0.95';
      const trendLabel = typeof report.trend === 'string' ? report.trend : (report.trend?.label || 'STABLE');
      const primaryTax = typeof report.taxonomy === 'string' ? report.taxonomy : (report.taxonomy?.primary || 'Normative Baseline');
      const matchedSno = report.matchedPattern?.matchedDatasetSno || 'N/A';
      const distanceScore = report.matchedPattern?.distanceScore ?? 0;

      // Card 1: Severity
      const sevColor = sevLabel === 'RISK' ? redAlert : sevLabel === 'HIGH' ? amberDelta : greenMatch;
      doc.rect(36, currentY, colW, cardH).fillAndStroke(slateLight, borderColor);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(textMuted).text('SEVERITY ASSESSMENT', 42, currentY + 6);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(sevColor).text(sevLabel, 42, currentY + 18);
      doc.fontSize(7.5).font('Helvetica').fillColor(textMuted).text(`Score: ${sevScore} / 1.00`, 42, currentY + 34);

      // Card 2: Confidence
      doc.rect(36 + (colW + colGap), currentY, colW, cardH).fillAndStroke(slateLight, borderColor);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(textMuted).text('EVIDENTIARY CONFIDENCE', 42 + (colW + colGap), currentY + 6);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(accentBlue).text(confLevel, 42 + (colW + colGap), currentY + 18);
      doc.fontSize(7.5).font('Helvetica').fillColor(textMuted).text(`Score: ${confScore} / 1.00`, 42 + (colW + colGap), currentY + 34);

      // Card 3: Taxonomy
      doc.rect(36 + (colW + colGap) * 2, currentY, colW, cardH).fillAndStroke(slateLight, borderColor);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(textMuted).text('PRIMARY TAXONOMY', 42 + (colW + colGap) * 2, currentY + 6);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(slateDark).text(primaryTax.replace(/_/g, ' '), 42 + (colW + colGap) * 2, currentY + 18, { width: 114 });
      doc.fontSize(7).font('Helvetica').fillColor(textMuted).text(`Ref SNO: #${matchedSno}`, 42 + (colW + colGap) * 2, currentY + 34);

      // Card 4: Temporal Trajectory
      doc.rect(36 + (colW + colGap) * 3, currentY, colW, cardH).fillAndStroke(slateLight, borderColor);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(textMuted).text(`TRAJECTORY (${report.temporalLevel})`, 42 + (colW + colGap) * 3, currentY + 6);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(slateDark).text(trendLabel, 42 + (colW + colGap) * 3, currentY + 18);
      doc.fontSize(7).font('Helvetica').fillColor(textMuted).text(`${report.temporalObservationsCount || 1} Obs | Distance: ${distanceScore}`, 42 + (colW + colGap) * 3, currentY + 34);

      currentY += cardH + 10;

      // 4. Canonical 11-Parameter Table
      doc.fillColor(slateDark).fontSize(9).font('Helvetica-Bold').text('CANONICAL 11-PARAMETER PHYSIOLOGICAL & ENVIRONMENTAL BREAKDOWN', 36, currentY);
      currentY += 13;

      // Table Header Row
      doc.rect(36, currentY, 523, 16).fill('#e2e8f0');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(slateDark);
      doc.text('#', 42, currentY + 4);
      doc.text('PARAMETER NAME', 60, currentY + 4);
      doc.text('CAT', 180, currentY + 4);
      doc.text('INPUT STAGE', 215, currentY + 4);
      doc.text('REF STAGE', 290, currentY + 4);
      doc.text('STATUS', 365, currentY + 4);
      doc.text('STAGE INTERPRETATION', 425, currentY + 4);
      currentY += 16;

      const params = report.parameters && report.parameters.length === 11
        ? report.parameters
        : buildParameterReportItems(report.matchedPattern.inputStages, report.matchedPattern.matchedStages);

      for (let i = 0; i < params.length; i++) {
        const p = params[i];
        const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(36, currentY, 523, 15).fill(rowBg);

        doc.fontSize(7).font('Helvetica').fillColor(textMain);
        doc.text(String(p.index), 42, currentY + 4);
        doc.font(p.isAbnormal ? 'Helvetica-Bold' : 'Helvetica').text(`${p.name} (${p.unit})`, 60, currentY + 4);
        doc.font('Helvetica').text(p.category, 180, currentY + 4);

        doc.font(p.inputStage > 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(p.inputStage > 0 ? amberDelta : textMain).text(`Stage ${p.inputStage}`, 215, currentY + 4);
        doc.font('Helvetica').fillColor(textMuted).text(`Stage ${p.matchedStage}`, 290, currentY + 4);

        const statusLabel = p.isMatched ? 'MATCH' : `DELTA ${Math.abs(p.deltaStage)}`;
        doc.font('Helvetica-Bold').fillColor(p.isMatched ? greenMatch : amberDelta).text(statusLabel, 365, currentY + 4);

        doc.font('Helvetica').fillColor(textMuted).text(p.stageLabel, 425, currentY + 4, { width: 130, ellipsis: true });

        currentY += 15;
      }

      currentY += 8;

      // 5. Parameter Interpretation & Clinical Guidance
      const splitBoxH = 68;
      const halfW = 257;

      // Left Box: What Should I Do Now?
      doc.rect(36, currentY, halfW, splitBoxH).fillAndStroke(slateLight, borderColor);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(slateDark).text('WHAT SHOULD I DO NOW?', 44, currentY + 7);
      doc.fontSize(7.5).font('Helvetica').fillColor(textMain).text(report.whatShouldIDoNow, 44, currentY + 20, { width: 241, lineGap: 1.5 });

      // Right Box: Wellness & Monitoring Guidance
      doc.rect(36 + halfW + 9, currentY, halfW, splitBoxH).fillAndStroke(slateLight, borderColor);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(slateDark).text('WELLNESS / MONITORING GUIDANCE', 44 + halfW + 9, currentY + 7);
      doc.fontSize(7.5).font('Helvetica').fillColor(textMain).text(report.wellnessMonitoringGuidance, 44 + halfW + 9, currentY + 20, { width: 241, lineGap: 1.5 });

      currentY += splitBoxH + 8;

      // 6. Caretaker Technical Evidence & Home Q/A Box
      const techBoxH = 68;
      doc.rect(36, currentY, 523, techBoxH).fillAndStroke(slateLight, borderColor);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(slateDark).text('CARETAKER TECHNICAL EVIDENCE & AUDIT LOG', 44, currentY + 6);

      doc.fontSize(7).font('Helvetica').fillColor(textMuted);
      doc.text(`Taxonomy: ${report.taxonomy.primary} (Secondary: ${report.taxonomy.secondary || 'None'})`, 44, currentY + 18);
      doc.text(`Reference Dataset Record: SNO #${report.matchedPattern.matchedDatasetSno}  |  Match Status: ${report.matchedPattern.matchStatus}  |  Distance Metric: ${report.matchedPattern.distanceScore}`, 44, currentY + 28);
      doc.text(`Verification Status: ${report.labelVerificationStatus}  |  Longitudinal Trajectory: ${report.temporalInterpretation}`, 44, currentY + 38, { width: 507 });

      // Home Q/A status display
      const qaText = report.homeQA?.status === 'AVAILABLE' ? `Home Q/A: AVAILABLE (${report.homeQA.displayText})` : 'Home Q/A: Q/A NOT AVAILABLE';
      doc.font('Helvetica-Bold').fillColor(report.homeQA?.status === 'AVAILABLE' ? accentBlue : textMuted).text(qaText, 44, currentY + 52);

      currentY += techBoxH + 10;

      // 7. Footer: Disclaimer & Non-Diagnostic Boundary
      doc.rect(36, 770, 523, 36).fill('#f1f5f9');
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(slateDark).text('NON-DIAGNOSTIC NOTICE & REGULATORY DISCLAIMER', 44, 775, { align: 'center', width: 507 });
      doc.fontSize(6.5).font('Helvetica').fillColor(textMuted).text(report.limitationsDisclaimer, 44, 785, { align: 'center', width: 507 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
