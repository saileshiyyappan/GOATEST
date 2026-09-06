/**
 * Robust statistical averaging engine for physiological time-series data.
 * Implements Median Absolute Deviation (MAD) outlier rejection and coefficient-of-variation stability testing.
 */

export interface RobustAverageResult {
  lockedValue: number | null;
  isStable: boolean;
  validCount: number;
  rejectedCount: number;
  rawSampleCount: number;
  mean: number | null;
  median: number | null;
  mad: number | null;
}

export interface RobustAverageOptions {
  isInteger?: boolean;
  minSamples?: number;
  maxCv?: number; // Max acceptable coefficient of variation (stdDev / mean)
  maxStdDev?: number; // Max acceptable absolute standard deviation (crucial when mean is close to 0, e.g. resting motion)
  decimals?: number;
  minAbsoluteCutoff?: number; // Minimum tolerance delta from median
}

/**
 * Computes exact median of numeric array
 */
export function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes Median Absolute Deviation (MAD)
 */
export function calculateMad(values: number[], median: number): number {
  if (values.length === 0) return 0;
  const absDeviations = values.map((v) => Math.abs(v - median));
  return calculateMedian(absDeviations) || 0;
}

/**
 * Rejects outliers using MAD thresholding:
 * A sample is kept if: |x_i - M| <= max(minAbsoluteCutoff, k * 1.4826 * MAD)
 */
export function filterOutliersMad(
  samples: number[],
  k: number = 2.5,
  minAbsoluteCutoff: number = 2.0
): { cleanSamples: number[]; rejectedCount: number; median: number; mad: number } {
  if (samples.length === 0) {
    return { cleanSamples: [], rejectedCount: 0, median: 0, mad: 0 };
  }

  const median = calculateMedian(samples) ?? 0;
  const mad = calculateMad(samples, median);
  // 1.4826 is normal-distribution consistency factor for MAD
  const cutoff = Math.max(minAbsoluteCutoff, k * 1.4826 * mad);

  const cleanSamples: number[] = [];
  let rejectedCount = 0;

  for (const val of samples) {
    if (Math.abs(val - median) <= cutoff) {
      cleanSamples.push(val);
    } else {
      rejectedCount++;
    }
  }

  return { cleanSamples, rejectedCount, median, mad };
}

/**
 * Computes robust average and stability check for a vital series
 */
export function computeRobustVitalLock(
  rawSamples: number[],
  options: RobustAverageOptions = {}
): RobustAverageResult {
  const {
    isInteger = false,
    minSamples = 8,
    maxCv = 0.20,
    maxStdDev,
    decimals = 1,
    minAbsoluteCutoff = 2.0,
  } = options;

  // Filter non-finite numbers
  const validNumbers = rawSamples.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const rawSampleCount = validNumbers.length;

  if (rawSampleCount < minSamples) {
    return {
      lockedValue: null,
      isStable: false,
      validCount: rawSampleCount,
      rejectedCount: 0,
      rawSampleCount,
      mean: null,
      median: null,
      mad: null,
    };
  }

  // 1. Outlier Rejection via MAD
  const { cleanSamples, rejectedCount, median, mad } = filterOutliersMad(
    validNumbers,
    2.5,
    minAbsoluteCutoff
  );

  if (cleanSamples.length < Math.max(3, Math.floor(minSamples / 2))) {
    return {
      lockedValue: null,
      isStable: false,
      validCount: cleanSamples.length,
      rejectedCount,
      rawSampleCount,
      mean: null,
      median,
      mad,
    };
  }

  // 2. Compute Clean Arithmetic Mean
  const sum = cleanSamples.reduce((acc, v) => acc + v, 0);
  const mean = sum / cleanSamples.length;

  // 3. Check Variance and Coefficient of Variation
  const variance = cleanSamples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / cleanSamples.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;

  const isStable = (maxStdDev !== undefined && stdDev <= maxStdDev) || cv <= maxCv;

  // 4. Determine Final Locked Estimate
  let lockedValue: number | null = null;
  if (isStable) {
    if (isInteger) {
      lockedValue = Math.round(mean);
    } else {
      lockedValue = parseFloat(mean.toFixed(decimals));
    }
  }

  return {
    lockedValue,
    isStable,
    validCount: cleanSamples.length,
    rejectedCount,
    rawSampleCount,
    mean: parseFloat(mean.toFixed(decimals)),
    median: parseFloat(median.toFixed(decimals)),
    mad: parseFloat(mad.toFixed(decimals)),
  };
}
