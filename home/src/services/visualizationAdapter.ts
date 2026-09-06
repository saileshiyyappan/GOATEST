/**
 * GOATEST Visualization Adapter
 * 
 * PMT-4: Transforms raw comparison and longitudinal data into structured
 * ReportVisualizationData for dynamic frontend rendering.
 * 
 * CORE CONTRACT RULES:
 * 1. Raw ML/CM packets remain untouched.
 * 2. Generates separate visualizationData object.
 * 3. NO MISSING VALUE BECOMES FAKE ZERO. Missing values remain null or '-- / NOT AVAILABLE'.
 * 4. Only graph parameters actually present in the CM_PACKET / C50 result / TestRecord.
 * 5. Structured data allows dynamic client-side rendering with full responsiveness.
 */

import type {
  ReportVisualizationData,
  VisualizationComparisonItem,
  VisualizationDeviationItem,
  VisualizationTrendItem,
  VisualizationStageItem,
  TestRecord,
  DayRecord,
  WeekRecord,
  MonthRecord,
} from '../types';
import type { C50ResultPacket, CmPacketInput } from './c50/c50Packet';

export const visualizationAdapter = {
  /**
   * Generates visualizationData for a single TEST report.
   */
  generateTestVisualization(
    testRecord: TestRecord,
    cmPacket?: CmPacketInput | null,
    c50Result?: C50ResultPacket | null
  ): ReportVisualizationData {
    const comparisonData: VisualizationComparisonItem[] = [];
    const deviationData: VisualizationDeviationItem[] = [];
    const stageMap: Record<string, number> = {};

    // 1. Extract comparisons from CM_PACKET if present
    if (cmPacket?.parameters && typeof cmPacket.parameters === 'object') {
      for (const [paramName, paramData] of Object.entries(cmPacket.parameters)) {
        if (!paramData) continue;

        const baseline = paramData.phbBaseline ?? null;
        const currentValue = paramData.shbValue ?? null;
        const deviation = paramData.shbDeviation ?? paramData.absDeviationDistance ?? null;
        const stage = paramData.matchedStage ?? null;

        comparisonData.push({
          parameter: paramData.name || paramName,
          baseline,
          currentValue,
          deviation,
          absDeviationDistance: paramData.absDeviationDistance ?? null,
          direction: paramData.direction ?? null,
          stage,
          unit: (paramData as any).unit || '',
        });

        if (deviation !== null && typeof deviation === 'number') {
          deviationData.push({
            parameter: paramData.name || paramName,
            deviationPercent: Number((deviation * 100).toFixed(1)),
            direction: paramData.direction || 'NEUTRAL',
            stage,
          });
        }

        if (stage !== null && stage !== undefined) {
          const stKey = String(stage);
          stageMap[stKey] = (stageMap[stKey] || 0) + 1;
        }
      }
    } else if (testRecord.rawData?.sessionMetrics) {
      // Extract from rawData metrics if present
      for (const [metricKey, metricVal] of Object.entries(testRecord.rawData.sessionMetrics)) {
        if (typeof metricVal === 'number' || typeof metricVal === 'string') {
          comparisonData.push({
            parameter: metricKey.replace(/([A-Z])/g, ' $1').trim(),
            baseline: null, // Keep explicitly null when no baseline exists
            currentValue: metricVal,
            stage: 'Standard',
          });
        }
      }
    }

    // 2. Stage distribution calculation
    const totalStages = Object.values(stageMap).reduce((acc, count) => acc + count, 0);
    const stageDistribution: VisualizationStageItem[] = Object.entries(stageMap).map(([st, count]) => ({
      stage: st,
      count,
      percentage: totalStages > 0 ? Number(((count / totalStages) * 100).toFixed(0)) : 0,
      label: `Stage ${st}`,
    }));

    const hasEnoughData = comparisonData.length > 0 || deviationData.length > 0;

    return {
      hasEnoughData,
      comparisonData,
      deviationData,
      trendData: [
        {
          timestamp: testRecord.timestamp,
          label: testRecord.organ || testRecord.target,
          value: comparisonData.length > 0 && typeof comparisonData[0].currentValue === 'number'
            ? comparisonData[0].currentValue
            : null,
          stage: comparisonData[0]?.stage || null,
          organ: testRecord.organ || testRecord.target,
        },
      ],
      stageDistribution,
    };
  },

  /**
   * Generates visualizationData for a multi-test DAY report.
   */
  generateDayVisualization(
    dayRecord: DayRecord,
    tests: TestRecord[],
    c50Results: C50ResultPacket[] = []
  ): ReportVisualizationData {
    const comparisonData: VisualizationComparisonItem[] = [];
    const deviationData: VisualizationDeviationItem[] = [];
    const trendData: VisualizationTrendItem[] = [];
    const stageMap: Record<string, number> = {};

    tests.forEach((test, idx) => {
      const timeLabel = new Date(test.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const testVisual = this.generateTestVisualization(test);

      // Aggregate comparison parameters
      testVisual.comparisonData.forEach((item) => {
        if (!comparisonData.some((c) => c.parameter === item.parameter)) {
          comparisonData.push(item);
        }
      });

      testVisual.deviationData.forEach((item) => {
        if (!deviationData.some((d) => d.parameter === item.parameter)) {
          deviationData.push(item);
        }
      });

      // Add to Day Trend Points
      const firstVal = testVisual.comparisonData.find((c) => typeof c.currentValue === 'number')?.currentValue as number | undefined;
      const stage = testVisual.comparisonData[0]?.stage ?? `T${idx + 1}`;

      trendData.push({
        timestamp: test.timestamp,
        label: `Test ${idx + 1} (${test.organ || test.target}) - ${timeLabel}`,
        value: typeof firstVal === 'number' ? firstVal : null,
        stage,
        organ: test.organ || test.target,
      });

      if (stage !== null && stage !== undefined) {
        const stKey = String(stage);
        stageMap[stKey] = (stageMap[stKey] || 0) + 1;
      }
    });

    const totalStages = Object.values(stageMap).reduce((acc, count) => acc + count, 0);
    const stageDistribution: VisualizationStageItem[] = Object.entries(stageMap).map(([st, count]) => ({
      stage: st,
      count,
      percentage: totalStages > 0 ? Number(((count / totalStages) * 100).toFixed(0)) : 0,
      label: `Stage ${st}`,
    }));

    return {
      hasEnoughData: tests.length > 0 && (comparisonData.length > 0 || trendData.length > 0),
      comparisonData,
      deviationData,
      trendData,
      stageDistribution,
    };
  },

  /**
   * Generates visualizationData for a multi-day WEEK report.
   */
  generateWeekVisualization(
    weekRecord: WeekRecord,
    days: DayRecord[],
    c50Results: C50ResultPacket[] = []
  ): ReportVisualizationData {
    const trendData: VisualizationTrendItem[] = [];
    const stageMap: Record<string, number> = {};

    days.forEach((day, idx) => {
      const dayDate = new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
      const completedTests = day.testReferences?.length || 0;

      trendData.push({
        timestamp: day.date,
        label: dayDate,
        value: completedTests, // Number of completed assessments for the day
        score: completedTests >= 3 ? 100 : Math.round((completedTests / 3) * 100),
        stage: completedTests >= 3 ? 'Completed' : 'Partial',
        trend: completedTests >= 3 ? 'STABLE' : 'ELEVATED',
      });

      const stKey = completedTests >= 3 ? 'Completed' : 'Partial';
      stageMap[stKey] = (stageMap[stKey] || 0) + 1;
    });

    const totalStages = Object.values(stageMap).reduce((acc, count) => acc + count, 0);
    const stageDistribution: VisualizationStageItem[] = Object.entries(stageMap).map(([st, count]) => ({
      stage: st,
      count,
      percentage: totalStages > 0 ? Number(((count / totalStages) * 100).toFixed(0)) : 0,
      label: st,
    }));

    return {
      hasEnoughData: days.length > 0,
      comparisonData: [],
      deviationData: [],
      trendData,
      stageDistribution,
    };
  },

  /**
   * Generates visualizationData for a multi-week MONTH report.
   */
  generateMonthVisualization(
    monthRecord: MonthRecord,
    weeks: WeekRecord[]
  ): ReportVisualizationData {
    const trendData: VisualizationTrendItem[] = [];
    const stageMap: Record<string, number> = {};

    weeks.forEach((week, idx) => {
      const weekLabel = `Week ${idx + 1}`;
      const completedDays = week.dayReferences?.length || 0;

      trendData.push({
        timestamp: week.weekStart,
        label: weekLabel,
        value: completedDays,
        score: Math.round((completedDays / 7) * 100),
        stage: completedDays >= 5 ? 'High Adherence' : 'Moderate Adherence',
        trend: 'STABLE',
      });

      const stKey = completedDays >= 5 ? 'High Adherence' : 'Moderate Adherence';
      stageMap[stKey] = (stageMap[stKey] || 0) + 1;
    });

    const totalStages = Object.values(stageMap).reduce((acc, count) => acc + count, 0);
    const stageDistribution: VisualizationStageItem[] = Object.entries(stageMap).map(([st, count]) => ({
      stage: st,
      count,
      percentage: totalStages > 0 ? Number(((count / totalStages) * 100).toFixed(0)) : 0,
      label: st,
    }));

    return {
      hasEnoughData: weeks.length > 0,
      comparisonData: [],
      deviationData: [],
      trendData,
      stageDistribution,
    };
  },
};
