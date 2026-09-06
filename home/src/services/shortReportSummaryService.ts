import type { ReportRecord } from '../types';

export interface ShortReportField {
  label: string;
  value: string;
}

export interface ShortReportSummary {
  heading: string;
  summary: string;
  c50Label: string | null;
  fields: ShortReportField[];
}

const isPresent = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

const text = (value: unknown): string | null => {
  if (!isPresent(value)) return null;
  if (typeof value === 'object') return null;
  return String(value);
};

const firstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return null;
};

const add = (fields: ShortReportField[], label: string, ...values: unknown[]) => {
  const value = firstText(...values);
  if (value) fields.push({ label, value });
};

const percentOrText = (value: unknown): string | null => {
  if (typeof value === 'number' && value >= 0 && value <= 1) return `${(value * 100).toFixed(0)}%`;
  return text(value);
};

export function buildShortReportSummary(report: ReportRecord): ShortReportSummary {
  const stored = report.readableContent?.metricsSummary || {};
  const root: any = stored;
  const trajectory: any = report.trajectoryResult || root.trajectoryResult || {};
  const severity = root.severity;
  const confidence = root.confidence;
  const trend = root.trend;
  const c50Label = firstText(root.c50Label, root.matchedPattern?.pattern_label, root.matchedPattern, root.patternInterpretation, root.dominantPattern);
  const classification = firstText(root.classification, root.taxonomy?.primary, root.primaryTaxonomy, root.primary_taxonomy);
  const severityText = firstText(severity?.label, severity, root.severityLabel, root.finalSeverity);
  const confidenceText = firstText(confidence?.level, confidence, root.confidenceLevel, root.confidence_score, root.confidenceScore);
  const trendText = firstText(trend?.label, trend, root.trendLabel, root.trend_label);
  const fields: ShortReportField[] = [];

  if (report.reportType === 'TEST') {
    add(fields, 'Assessment', classification, root.whatWasDetected, root.conditionSummary);
    add(fields, 'Severity', severityText);
    add(fields, 'Confidence', percentOrText(confidenceText));
    add(fields, 'Trend', trendText);
    const physiological = root.physiologicalFeatures || root.metrics || root.sessionMetrics || {};
    for (const [key, label] of [['hr', 'HR'], ['spo2', 'SpO2'], ['ppi', 'PPI'], ['rmssd', 'RMSSD'], ['sdnn', 'SDNN'], ['respiratoryRate', 'Respiratory Rate'], ['activity', 'Activity'], ['temperature', 'Temperature'], ['humidity', 'Humidity'], ['pressure', 'Pressure'], ['altitude', 'Altitude']] as const) {
      add(fields, label, physiological[key], root[key]);
    }
  } else if (report.reportType === 'DAY') {
    add(fields, 'Daily Assessment', classification, root.conditionSummary);
    add(fields, 'Initial Severity', trajectory.initialSeverity, root.initialSeverity);
    add(fields, 'Peak Severity', trajectory.peakSeverity, root.peakSeverity);
    add(fields, 'Final Severity', trajectory.finalSeverity, root.finalSeverity);
    add(fields, 'Mean Severity', trajectory.meanSeverity, root.meanSeverity);
    add(fields, 'Trend', trajectory.trend, trendText);
    add(fields, 'Pattern Persistence', trajectory.patternPersistence, root.patternPersistence);
    add(fields, 'Dominant Pattern', trajectory.dominantPattern, root.dominantPattern);
    add(fields, 'Confidence', percentOrText(confidenceText));
    add(fields, 'Tests Used', Array.isArray(report.testObservationIds) ? report.testObservationIds.join(', ') : root.testObservationIds?.join(', '));
    add(fields, 'Daily Check-in', report.qaCompletionStatus || root.qaCompletionStatus);
  } else if (report.reportType === 'WEEK') {
    add(fields, 'Weekly Assessment', classification, root.conditionSummary);
    add(fields, 'Initial Severity', trajectory.initialSeverity, root.initialSeverity);
    add(fields, 'Peak Severity', trajectory.peakSeverity, root.peakSeverity);
    add(fields, 'Final Severity', trajectory.finalSeverity, root.finalSeverity);
    add(fields, 'Mean Severity', trajectory.meanSeverity, root.meanSeverity);
    add(fields, 'Trend', trajectory.trend, trendText);
    add(fields, 'Persistence', trajectory.patternPersistence, root.patternPersistence);
    add(fields, 'Dominant Pattern', trajectory.dominantPattern, root.dominantPattern);
    add(fields, 'Confidence', percentOrText(confidenceText));
    add(fields, 'Days Assessed', root.totalCompletedDays, root.daysAssessed);
    if (!fields.some((field) => field.label === 'Trend')) fields.push({ label: 'Trend', value: 'Weekly trend data unavailable' });
  } else {
    add(fields, 'Monthly Assessment', classification, root.conditionSummary);
    add(fields, 'Initial Severity', trajectory.initialSeverity, root.initialSeverity);
    add(fields, 'Peak Severity', trajectory.peakSeverity, root.peakSeverity);
    add(fields, 'Final Severity', trajectory.finalSeverity, root.finalSeverity);
    add(fields, 'Mean Severity', trajectory.meanSeverity, root.meanSeverity);
    add(fields, 'Long-Term Trend', trajectory.trend, trendText);
    add(fields, 'Persistence', trajectory.patternPersistence, root.patternPersistence);
    add(fields, 'Dominant Pattern', trajectory.dominantPattern, root.dominantPattern);
    add(fields, 'Confidence', percentOrText(confidenceText));
    add(fields, 'Weeks Assessed', root.totalWeeks, root.weeksAssessed);
    if (!fields.some((field) => field.label === 'Long-Term Trend')) fields.push({ label: 'Long-Term Trend', value: 'Long-term trend data unavailable' });
  }

  const fallback = report.readableContent?.summary || `${report.reportType} assessment report available.`;
  const summary = report.reportType === 'TEST'
    ? `${classification ? `The recorded assessment was classified as ${classification}` : 'The TEST assessment was recorded'}${severityText ? ` with ${severityText} severity` : ''}${confidenceText ? ` and ${confidenceText} confidence` : ''}.`
    : report.reportType === 'DAY'
      ? `${report.testObservationIds?.length || root.testCount ? `Daily assessment based on ${report.testObservationIds?.length || root.testCount} TEST observations` : 'Daily assessment recorded'}${trendText ? `; the trajectory was ${trendText}` : ''}.`
      : fallback;

  return { heading: `${report.reportType} REPORT`, summary, c50Label, fields };
}
