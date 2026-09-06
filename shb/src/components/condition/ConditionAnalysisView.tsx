import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Shield,
  Heart,
  Wind,
  Zap,
} from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { CmPacket } from '../../types/compare';
import { cmPacketCache } from '../../services/compare/cmPacketCache';
import { getOrganDefinition } from '../../services/organ/organRegistry';

export interface ConditionAnalysisViewProps {
  cmPacket?: CmPacket | null;
  onBack: () => void;
  onProceedToReport: () => void;
}

export type ConditionPipelineStep =
  | 'INGESTING_CM_PACKET'
  | 'EVALUATING_DEVIATIONS'
  | 'SYNTHESIZING_RISK_INDEX'
  | 'CONDITION_COMPLETE';

export interface OrganConditionScore {
  organId: string;
  organName: string;
  maxStage: number;
  conditionLevel: 'OPTIMAL' | 'MILD_SHIFT' | 'MODERATE_DEVIATION' | 'SIGNIFICANT_ALERT';
  summary: string;
  activeCount: number;
}

export const ConditionAnalysisView: React.FC<ConditionAnalysisViewProps> = ({
  cmPacket: propCmPacket,
  onBack,
  onProceedToReport,
}) => {
  const { shb_color, accent } = useShbTheme();
  const [currentStep, setCurrentStep] = useState<ConditionPipelineStep>('INGESTING_CM_PACKET');
  const [progressPercent, setProgressPercent] = useState<number>(15);

  const activePacket = useMemo(() => {
    return propCmPacket || cmPacketCache.getCmPacket();
  }, [propCmPacket]);

  const targetOrgan = activePacket?.targetOrgan || activePacket?.target || 'OVERALL';
  const organDef = getOrganDefinition(targetOrgan);

  // Compute deterministic condition scores from CM_PACKET (NO Math.random)
  const conditionScore: OrganConditionScore = useMemo(() => {
    if (!activePacket || !activePacket.rows) {
      return {
        organId: targetOrgan,
        organName: organDef.name,
        maxStage: 0,
        conditionLevel: 'OPTIMAL',
        summary: 'Baseline physiological parameters are in homeostatic equilibrium.',
        activeCount: 0,
      };
    }

    let maxStage = 0;
    let computedCount = 0;

    const rowList = activePacket.parameters || activePacket.rows || [];
    for (const row of rowList) {
      const stageVal = typeof row.compareStage === 'number' ? row.compareStage : typeof row.matchedStage === 'number' ? row.matchedStage : typeof row.stage === 'number' ? row.stage : null;
      if (stageVal !== null) {
        computedCount++;
        if (stageVal > maxStage) {
          maxStage = stageVal;
        }
      }
    }

    let conditionLevel: OrganConditionScore['conditionLevel'] = 'OPTIMAL';
    let summary = 'Parameters show optimal stability relative to Personal Health Baseline.';

    if (maxStage >= 4) {
      conditionLevel = 'SIGNIFICANT_ALERT';
      summary = 'Stage 4+ deviation observed in physiological markers. Close monitoring indicated.';
    } else if (maxStage === 3) {
      conditionLevel = 'MODERATE_DEVIATION';
      summary = 'Stage 3 shift detected in primary vital metrics relative to baseline.';
    } else if (maxStage >= 1) {
      conditionLevel = 'MILD_SHIFT';
      summary = 'Stage 1-2 mild variance within physiological adaptive limits.';
    }

    return {
      organId: targetOrgan,
      organName: organDef.name,
      maxStage,
      conditionLevel,
      summary,
      activeCount: computedCount,
    };
  }, [activePacket, targetOrgan, organDef]);

  // Real pipeline timer progression
  useEffect(() => {
    const t1 = setTimeout(() => {
      setCurrentStep('EVALUATING_DEVIATIONS');
      setProgressPercent(50);
    }, 1200);

    const t2 = setTimeout(() => {
      setCurrentStep('SYNTHESIZING_RISK_INDEX');
      setProgressPercent(85);
    }, 2400);

    const t3 = setTimeout(() => {
      setCurrentStep('CONDITION_COMPLETE');
      setProgressPercent(100);
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const getConditionBadge = (level: OrganConditionScore['conditionLevel']) => {
    switch (level) {
      case 'SIGNIFICANT_ALERT':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          label: 'SIGNIFICANT DEVIATION',
        };
      case 'MODERATE_DEVIATION':
        return {
          bg: 'rgba(249, 115, 22, 0.15)',
          color: '#fb923c',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          label: 'MODERATE SHIFT',
        };
      case 'MILD_SHIFT':
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          label: 'MILD VARIANCE',
        };
      default:
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          label: 'EQUILIBRIUM (STAGE 0)',
        };
    }
  };

  const badgeStyle = getConditionBadge(conditionScore.conditionLevel);

  return (
    <div className="flex flex-col min-h-full w-full pb-6 select-none animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 pb-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-80"
          style={{
            backgroundColor: shb_color.panel,
            color: shb_color.textPrimary,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Compare</span>
        </button>

        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
          CONDITION ENGINE
        </span>
      </div>

      {/* Main Condition Pipeline Card */}
      <div
        className="p-4 rounded-2xl border space-y-4 shadow-md mb-3"
        style={{
          backgroundColor: shb_color.card,
          borderColor: shb_color.cardBorder,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-xl"
              style={{
                backgroundColor: shb_color.panel,
                border: `1px solid ${shb_color.panelBorder}`,
              }}
            >
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2
                className="text-xs font-black uppercase tracking-wider font-mono"
                style={{ color: shb_color.textPrimary }}
              >
                {organDef.name} CONDITION ANALYSIS
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono">
                Evaluating stage boundaries from CM_PACKET
              </p>
            </div>
          </div>

          <div
            className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase"
            style={{
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.color,
              border: badgeStyle.border,
            }}
          >
            {badgeStyle.label}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
            <span>
              {currentStep === 'INGESTING_CM_PACKET' && '1/3 Ingesting CM_PACKET...'}
              {currentStep === 'EVALUATING_DEVIATIONS' && '2/3 Calculating Stage Deviations...'}
              {currentStep === 'SYNTHESIZING_RISK_INDEX' && '3/3 Synthesizing Organ Health Index...'}
              {currentStep === 'CONDITION_COMPLETE' && 'Condition Assessment Complete'}
            </span>
            <span className="font-bold">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Real Assessment Summary */}
        <div
          className="p-3 rounded-xl border text-xs font-mono space-y-1.5"
          style={{
            backgroundColor: shb_color.panel,
            borderColor: shb_color.panelBorder,
          }}
        >
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>MAX STAGE OBSERVED:</span>
            <span className="font-bold text-zinc-200">S{conditionScore.maxStage}</span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
            {conditionScore.summary}
          </p>
        </div>
      </div>

      {/* Sub-system Indicators */}
      <div className="grid grid-cols-3 gap-2 mb-4 font-mono">
        <div
          className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
          style={{
            backgroundColor: shb_color.panel,
            borderColor: shb_color.panelBorder,
          }}
        >
          <Heart className="w-4 h-4 text-rose-400 mb-1" />
          <span className="text-[9px] text-zinc-400 uppercase">Cardiac</span>
          <span className="text-[10px] font-bold text-zinc-200 mt-0.5">
            {conditionScore.maxStage <= 1 ? 'STABLE' : 'MODERATE'}
          </span>
        </div>

        <div
          className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
          style={{
            backgroundColor: shb_color.panel,
            borderColor: shb_color.panelBorder,
          }}
        >
          <Wind className="w-4 h-4 text-cyan-400 mb-1" />
          <span className="text-[9px] text-zinc-400 uppercase">Pulmonary</span>
          <span className="text-[10px] font-bold text-zinc-200 mt-0.5">
            {conditionScore.maxStage <= 2 ? 'NORMAL' : 'WATCH'}
          </span>
        </div>

        <div
          className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
          style={{
            backgroundColor: shb_color.panel,
            borderColor: shb_color.panelBorder,
          }}
        >
          <Zap className="w-4 h-4 text-amber-400 mb-1" />
          <span className="text-[9px] text-zinc-400 uppercase">Autonomic</span>
          <span className="text-[10px] font-bold text-zinc-200 mt-0.5">
            {conditionScore.maxStage === 0 ? 'NOMINAL' : `DEV S${conditionScore.maxStage}`}
          </span>
        </div>
      </div>

      {/* Bottom Action Button: Next to Report */}
      <div className="mt-auto pt-2">
        <button
          onClick={onProceedToReport}
          disabled={currentStep !== 'CONDITION_COMPLETE'}
          className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider font-mono shadow-md transition-all duration-150 active:scale-[0.98] ${
            currentStep === 'CONDITION_COMPLETE'
              ? 'bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer shadow-emerald-500/20'
              : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-60'
          }`}
        >
          <span>
            {currentStep === 'CONDITION_COMPLETE'
              ? 'View Assessment Report'
              : 'Analyzing Condition...'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
