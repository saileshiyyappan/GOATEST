/**
 * GOATEST Reusable Report Visualizations & Charts
 * 
 * PMT-4: Mobile-first, responsive parameter comparisons, deviation graphs,
 * longitudinal trends, and stage distributions.
 * 
 * DESIGN PRINCIPLES:
 * 1. REAL DATA ONLY — NEVER plot fake or simulated values.
 * 2. If insufficient data exists -> Renders clean "Not enough data" fallback.
 * 3. Mobile-first precision, no horizontal overflow.
 * 4. High-contrast, WCAG AA compliant light/dark theme styling.
 * 5. Clean SVG / Tailwind rendering without heavy bloated chart dependencies.
 */

import React from 'react';
import type {
  ReportVisualizationData,
  VisualizationComparisonItem,
  VisualizationDeviationItem,
  VisualizationTrendItem,
  VisualizationStageItem,
} from '../../types';
import { Activity, BarChart2, TrendingUp, Layers, AlertCircle } from 'lucide-react';

export interface ReportChartsProps {
  visualizationData?: ReportVisualizationData | null;
  reportType?: 'TEST' | 'DAY' | 'WEEK' | 'MONTH';
}

/**
 * Fallback component displayed when there is insufficient data to render graphs
 */
export const NoDataFallback: React.FC<{ message?: string; description?: string }> = ({
  message = 'Not enough data',
  description = 'Graph will automatically generate when sufficient sensor and baseline points are recorded.',
}) => (
  <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
      <AlertCircle className="w-5 h-5" />
    </div>
    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</span>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{description}</p>
  </div>
);

/**
 * 1. Comparison Graph (PHB Baseline vs Current Value)
 */
export const ParameterComparisonChart: React.FC<{
  data: VisualizationComparisonItem[];
}> = ({ data }) => {
  if (!data || data.length === 0) {
    return <NoDataFallback message="No comparison parameters" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
        <span>Parameter</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
            Baseline (PHB)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Current
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {data.map((item, idx) => {
          const hasBaseline = item.baseline !== null && item.baseline !== undefined;
          const numCurrent = typeof item.currentValue === 'number' ? item.currentValue : null;
          const numBaseline = typeof item.baseline === 'number' ? item.baseline : null;

          // Normalize bar scale
          const maxVal = Math.max(numCurrent || 100, numBaseline || 100, 100);
          const currentPct = numCurrent !== null ? Math.min(100, Math.max(15, (numCurrent / maxVal) * 100)) : 50;
          const baselinePct = numBaseline !== null ? Math.min(100, Math.max(15, (numBaseline / maxVal) * 100)) : 50;

          return (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{item.parameter}</span>
                <div className="flex items-center gap-2">
                  {item.stage !== null && item.stage !== undefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Stage {item.stage}
                    </span>
                  )}
                  {item.direction && item.direction !== 'NEUTRAL' && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        item.direction === 'POSITIVE'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {item.direction}
                    </span>
                  )}
                </div>
              </div>

              {/* Bar visualization */}
              <div className="flex flex-col gap-1.5 pt-1">
                {/* Current Value Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${currentPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 min-w-[50px] text-right">
                    {item.currentValue !== null && item.currentValue !== undefined ? `${item.currentValue} ${item.unit || ''}` : '--'}
                  </span>
                </div>

                {/* Baseline Bar (if available) */}
                {hasBaseline && (
                  <div className="flex items-center gap-2 opacity-75">
                    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
                      <div
                        className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all duration-300"
                        style={{ width: `${baselinePct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 min-w-[50px] text-right">
                      {item.baseline} {item.unit || ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 2. Deviation Graph
 */
export const DeviationBreakdownChart: React.FC<{
  data: VisualizationDeviationItem[];
}> = ({ data }) => {
  if (!data || data.length === 0) {
    return <NoDataFallback message="No deviation metrics available" />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((item, idx) => {
        const isElevated = (item.deviationPercent || 0) > 0;
        const isNegative = (item.deviationPercent || 0) < 0;
        const absVal = Math.abs(item.deviationPercent || 0);
        const widthPct = Math.min(100, Math.max(10, absVal * 3));

        return (
          <div
            key={idx}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{item.parameter}</span>
              <span
                className={`font-semibold ${
                  isElevated
                    ? 'text-amber-600 dark:text-amber-400'
                    : isNegative
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {item.deviationPercent !== null ? `${isElevated ? '+' : ''}${item.deviationPercent}%` : '--'}
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isElevated
                    ? 'bg-amber-500'
                    : isNegative
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 3. Longitudinal Trend Graph
 */
export const LongitudinalTrendChart: React.FC<{
  data: VisualizationTrendItem[];
  title?: string;
}> = ({ data, title = 'Longitudinal Assessment Trajectory' }) => {
  if (!data || data.length === 0) {
    return <NoDataFallback message="No longitudinal data points" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span className="font-medium">{title}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{data.length} data point{data.length === 1 ? '' : 's'}</span>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-3">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 text-xs border-b border-slate-200/60 dark:border-slate-700/40 last:border-0 pb-2 last:pb-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{item.label}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {item.stage && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {typeof item.stage === 'number' ? `Stage ${item.stage}` : String(item.stage)}
                </span>
              )}
              {item.value !== null && item.value !== undefined && (
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 4. Stage Progression & Distribution
 */
export const StageProgressionChart: React.FC<{
  data: VisualizationStageItem[];
}> = ({ data }) => {
  if (!data || data.length === 0) {
    return <NoDataFallback message="No stage distribution records" />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2">
        {data.map((st, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{st.label}</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {st.count} record{st.count === 1 ? '' : 's'} ({st.percentage}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, st.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Master Report Visualizations Container
 */
export const ReportCharts: React.FC<ReportChartsProps> = ({
  visualizationData,
  reportType = 'TEST',
}) => {
  if (!visualizationData || !visualizationData.hasEnoughData) {
    return (
      <NoDataFallback
        message="Insufficient Assessment Visualization Data"
        description="Structured charts will render automatically once physiological comparisons and longitudinal records are available."
      />
    );
  }

  const hasComparisons = visualizationData.comparisonData && visualizationData.comparisonData.length > 0;
  const hasDeviations = visualizationData.deviationData && visualizationData.deviationData.length > 0;
  const hasTrends = visualizationData.trendData && visualizationData.trendData.length > 0;
  const hasStages = visualizationData.stageDistribution && visualizationData.stageDistribution.length > 0;

  return (
    <div className="flex flex-col gap-5 text-left">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {reportType === 'TEST' ? 'TEST STAGE PROFILE · Source: TEST comparison stages' :
          reportType === 'DAY' ? 'DAY TEST PROGRESSION · Source: validated TEST observations' :
          reportType === 'WEEK' ? 'WEEK TREND · Source: WEEK longitudinal records' :
          'MONTH TREND · Source: MONTH longitudinal records'}
      </div>
      {/* Parameter Comparisons (Test & Day) */}
      {hasComparisons && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Physiological Baseline Comparisons</span>
          </div>
          <ParameterComparisonChart data={visualizationData.comparisonData} />
        </div>
      )}

      {/* Deviation Breakdown */}
      {hasDeviations && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <span>Baseline Deviation Distances</span>
          </div>
          <DeviationBreakdownChart data={visualizationData.deviationData} />
        </div>
      )}

      {/* Longitudinal Trends (Day, Week, Month) */}
      {hasTrends && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span>{reportType === 'TEST' ? 'Assessment Point' : 'Milestone Progression Timeline'}</span>
          </div>
          <LongitudinalTrendChart data={visualizationData.trendData} />
        </div>
      )}

      {/* Stage Progression */}
      {hasStages && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Layers className="w-4 h-4 text-purple-500" />
            <span>Stage Distribution</span>
          </div>
          <StageProgressionChart data={visualizationData.stageDistribution} />
        </div>
      )}
    </div>
  );
};
