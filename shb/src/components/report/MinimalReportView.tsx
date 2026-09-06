import React, { useMemo } from 'react';
import { FileText, ArrowLeft, RotateCcw, ShieldCheck } from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { CmPacket } from '../../types/compare';
import { cmPacketCache } from '../../services/compare/cmPacketCache';
import { shbSessionCache } from '../../services/vitals/shbSessionCache';
import { getOrganDefinition } from '../../services/organ/organRegistry';

export interface MinimalReportViewProps {
  cmPacket?: CmPacket | null;
  onNewAssessment: () => void;
  onExitToHome: () => void;
}

export const MinimalReportView: React.FC<MinimalReportViewProps> = ({
  cmPacket: propCmPacket,
  onNewAssessment,
  onExitToHome,
}) => {
  const { shb_color } = useShbTheme();

  const activePacket = useMemo(() => {
    return propCmPacket || cmPacketCache.getCmPacket();
  }, [propCmPacket]);

  const session = useMemo(() => {
    return shbSessionCache.getSession();
  }, []);

  const targetOrgan = activePacket?.targetOrgan || session?.targetOrgan || 'OVERALL';
  const organDef = getOrganDefinition(targetOrgan);

  const stats = useMemo(() => {
    const rows = activePacket?.parameters || activePacket?.rows;
    if (!activePacket || !rows) {
      return {
        maxStage: 0,
        stageCounts: { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 },
        totalRows: 0,
      };
    }

    let maxStage = 0;
    const counts = { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };

    for (const row of rows) {
      const stage = typeof row.compareStage === 'number' ? row.compareStage : typeof row.matchedStage === 'number' ? row.matchedStage : typeof row.stage === 'number' ? row.stage : null;
      if (stage !== null) {
        if (stage > maxStage) maxStage = stage;
        if (stage === 0) counts.s0++;
        else if (stage === 1) counts.s1++;
        else if (stage === 2) counts.s2++;
        else if (stage === 3) counts.s3++;
        else if (stage === 4) counts.s4++;
        else if (stage >= 5) counts.s5++;
      }
    }

    return {
      maxStage,
      stageCounts: counts,
      totalRows: rows.length,
    };
  }, [activePacket]);

  return (
    <div className="flex flex-col min-h-full w-full pb-6 select-none animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-2 pb-3">
        <button
          onClick={onExitToHome}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-80"
          style={{
            backgroundColor: shb_color.panel,
            color: shb_color.textPrimary,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-emerald-400">
          <FileText className="w-3.5 h-3.5" />
          <span>ASSESSMENT REPORT</span>
        </div>
      </div>

      {/* Report Container */}
      <div className="space-y-3 flex-1">
        {/* Header Summary Card */}
        <div
          className="p-4 rounded-2xl border space-y-2 shadow-sm"
          style={{
            backgroundColor: shb_color.card,
            borderColor: shb_color.cardBorder,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400">
              TARGET: <span className="font-bold text-zinc-100 uppercase">{organDef.name}</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              ID: {activePacket?.sessionId?.slice(0, 8) || 'GOATEST_01'}
            </span>
          </div>

          <h1
            className="text-sm font-black uppercase tracking-wider font-mono"
            style={{ color: shb_color.textPrimary }}
          >
            Physiological Comparison Report
          </h1>

          <div className="pt-1 flex items-center gap-2">
            <div
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${
                stats.maxStage >= 4
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : stats.maxStage === 3
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                  : stats.maxStage >= 1
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {stats.maxStage >= 4
                ? 'CRITICAL DEVIATION (STAGE 4+)'
                : stats.maxStage === 3
                ? 'MODERATE DEVIATION (STAGE 3)'
                : stats.maxStage >= 1
                ? 'MILD VARIATION (STAGE 1-2)'
                : 'PHYSIOLOGICAL EQUILIBRIUM (STAGE 0)'}
            </div>
          </div>
        </div>

        {/* Breakdown by Stage */}
        <div
          className="p-3.5 rounded-2xl border space-y-2.5 shadow-sm"
          style={{
            backgroundColor: shb_color.panel,
            borderColor: shb_color.panelBorder,
          }}
        >
          <div className="flex items-center justify-between text-xs font-mono font-bold uppercase">
            <span style={{ color: shb_color.textPrimary }}>STAGE DEVIATION DISTRIBUTION</span>
            <span className="text-zinc-500 text-[10px]">{stats.totalRows} Parameters</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-[9px] text-zinc-500">STAGE 0</div>
              <div className="text-xs font-bold text-emerald-400">{stats.stageCounts.s0}</div>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-[9px] text-zinc-500">STAGE 1</div>
              <div className="text-xs font-bold text-blue-400">{stats.stageCounts.s1}</div>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-[9px] text-zinc-500">STAGE 2</div>
              <div className="text-xs font-bold text-amber-400">{stats.stageCounts.s2}</div>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-[9px] text-zinc-500">STAGE 3</div>
              <div className="text-xs font-bold text-orange-400">{stats.stageCounts.s3}</div>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-[9px] text-zinc-500">STAGE 4+</div>
              <div className="text-xs font-bold text-rose-400">{stats.stageCounts.s4}</div>
            </div>
          </div>
        </div>

        {/* Observation & Clinical Recommendations Slot */}
        <div
          className="p-3.5 rounded-2xl border space-y-2 shadow-sm"
          style={{
            backgroundColor: shb_color.card,
            borderColor: shb_color.cardBorder,
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-zinc-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>OBSERVATIONAL RECOMMENDATIONS</span>
          </div>

          <div className="text-xs font-sans text-zinc-300 space-y-1.5 leading-relaxed">
            <p>
              • Telemetry acquisition completed across all available sensor channels (DV, IV, CX).
            </p>
            <p>
              • Locked parameters evaluated against verified user Personal Health Baseline.
            </p>
            {stats.maxStage >= 3 ? (
              <p className="text-amber-300">
                • Observed deviations in secondary physiological channels recommend repeat assessment in 24 hours.
              </p>
            ) : (
              <p className="text-emerald-300">
                • Target physiological markers remain consistent with historical baseline.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 flex gap-2">
        <button
          onClick={onNewAssessment}
          className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs uppercase tracking-wider font-mono shadow-md transition-all duration-150 active:scale-[0.98] bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Assessment</span>
        </button>

        <button
          onClick={onExitToHome}
          className="py-3 px-4 rounded-xl flex items-center justify-center font-bold text-xs uppercase tracking-wider font-mono transition-all duration-150 active:scale-[0.98] border"
          style={{
            backgroundColor: shb_color.panel,
            borderColor: shb_color.panelBorder,
            color: shb_color.textPrimary,
          }}
        >
          <span>Home</span>
        </button>
      </div>
    </div>
  );
};
