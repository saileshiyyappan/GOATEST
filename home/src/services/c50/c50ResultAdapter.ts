/**
 * GOATEST C50 Result Adapter
 * 
 * PMT-4: Transforms raw C50_RESULT_PACKET into ReportSummaryModel.
 * 
 * CORE CONTRACT RULES:
 * 1. The raw C50_RESULT_PACKET is NEVER modified or mutated.
 * 2. If C50 result is unavailable, outputs "C50 result not available".
 * 3. Exact ML label is preserved and mapped to clean readable format without reinterpretation.
 *    (e.g., NORMAL -> "Normal", CARDIAC_STRESS -> "Cardiac Stress").
 * 4. Zero fabricated classifications, fake confidence scores, or invented medical diagnoses.
 */

import type { C50ResultPacket } from './c50Packet';
import type { ReportSummaryModel } from '../../types';

/**
 * Converts uppercase snake_case ML label to Title Case readable display label.
 * e.g. "CARDIAC_STRESS" -> "Cardiac Stress", "NORMAL" -> "Normal"
 */
export function formatMlLabelToDisplay(rawLabel: string | null | undefined): string {
  if (!rawLabel || typeof rawLabel !== 'string' || !rawLabel.trim()) {
    return 'C50 result not available';
  }

  const clean = rawLabel.trim();
  if (clean.toUpperCase() === 'NOT_AVAILABLE' || clean.toUpperCase() === 'UNAVAILABLE') {
    return 'C50 result not available';
  }

  // Convert SNAKE_CASE or camelCase to Clean Title Words
  return clean
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const c50ResultAdapter = {
  /**
   * Adapts a raw C50ResultPacket into a structured, readable ReportSummaryModel.
   * Untouched raw packet input -> immutable derived view model.
   */
  adaptResult(resultPacket?: C50ResultPacket | null): ReportSummaryModel {
    if (!resultPacket) {
      return {
        isAvailable: false,
        status: 'UNAVAILABLE',
        rawLabel: null,
        displayLabel: 'C50 result not available',
        confidence: null,
        severity: null,
        features: null,
        modelVersion: 'C50_NOT_AVAILABLE',
        timestamp: new Date().toISOString(),
        description: 'C50 inference result is not available for this record.',
      };
    }

    const isSuccess = resultPacket.status === 'SUCCESS';
    const rawLabel = resultPacket.classification || (resultPacket.predictionPayload?.label as string) || null;
    const hasLabel = isSuccess && !!rawLabel;

    const displayLabel = hasLabel
      ? formatMlLabelToDisplay(rawLabel)
      : resultPacket.status === 'ML_NOT_CONFIGURED'
      ? 'C50 Model Standby'
      : 'C50 result not available';

    // Extract confidence if present in ML response
    let confidence: number | null = null;
    if (typeof resultPacket.confidence === 'number') {
      confidence = resultPacket.confidence;
    } else if (resultPacket.predictionPayload && typeof resultPacket.predictionPayload.confidence === 'number') {
      confidence = resultPacket.predictionPayload.confidence;
    }

    // Extract feature contributions or stage features if present
    const features = resultPacket.featureSummary || resultPacket.predictionPayload?.featureContributions || null;
    const severity = (resultPacket.predictionPayload?.severity as string) || null;

    return {
      isAvailable: isSuccess && hasLabel,
      status: resultPacket.status,
      rawLabel,
      displayLabel,
      confidence,
      severity,
      features,
      modelVersion: resultPacket.modelVersion || 'C50_V1.0',
      timestamp: resultPacket.timestamp || resultPacket.createdAt || new Date().toISOString(),
      description: resultPacket.errorMessage || (hasLabel ? `C50 ML classification: ${displayLabel}` : 'C50 result not available'),
      classificationMetadata: resultPacket.predictionPayload || {},
    };
  },
};
