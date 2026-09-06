import React from 'react';
import { AlertTriangle, Maximize2, Activity } from 'lucide-react';
import { CribProbability, CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribProbabilityPanelProps {
  probabilities: CribProbability[];
  mode: CribMode;
  onOpenExpand: () => void;
}

export const CribProbabilityPanel: React.FC<CribProbabilityPanelProps> = ({
  probabilities,
  mode,
  onOpenExpand,
}) => {
  const theme = CRIB_THEMES[mode];
  const hasProbabilities = probabilities && probabilities.length > 0;

  const getStatusBadge = (prob: number | null, status?: string) => {
    if (prob === null) return null;
    if (prob >= 75 || status === 'critical') {
      return (
        <span className="px-1 py-0.2 text-[8px] sm:text-[9px] font-bold rounded bg-red-600/30 text-red-300 border border-red-500/50 uppercase">
          CRIT
        </span>
      );
    }
    if (prob >= 40 || status === 'high') {
      return (
        <span className="px-1 py-0.2 text-[8px] sm:text-[9px] font-bold rounded bg-amber-600/30 text-amber-300 border border-amber-500/50 uppercase">
          HIGH
        </span>
      );
    }
    return (
      <span className="px-1 py-0.2 text-[8px] sm:text-[9px] font-bold rounded bg-blue-600/30 text-blue-300 border border-blue-500/50 uppercase">
        MOD
      </span>
    );
  };

  const getBarColor = (prob: number | null) => {
    if (prob === null) return 'bg-neutral-600';
    if (prob >= 75) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]';
    if (prob >= 40) return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]';
    return 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]';
  };

  return (
    <div
      id="crib-max-probability-panel"
      className={`relative w-full h-full rounded-xl border ${theme.panelBorder} ${theme.panelBg} p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-300 shadow-md overflow-hidden`}
    >
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-1 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className={`w-3.5 h-3.5 ${theme.accentColor}`} aria-hidden="true" />
          <h2 className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-white truncate">
            MAX PROBABILITY
          </h2>
        </div>
        <button
          id="crib-expand-probability-btn"
          type="button"
          onClick={onOpenExpand}
          aria-label="Expand Max Probability Details"
          title="Expand Details"
          className="p-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-red-400 flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase"
        >
          <span className="hidden xs:inline">VIEW</span>
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* 2. Main Content: Occupies full available vertical space */}
      <div className="flex-1 min-h-0 py-1.5 flex flex-col justify-center overflow-hidden">
        {hasProbabilities ? (
          <div className="w-full h-full flex flex-col justify-around gap-1">
            {probabilities.slice(0, 4).map((item, idx) => {
              const probVal = item.probability;
              const hasVal = probVal !== null && probVal !== undefined;
              const normalizedWidth = hasVal ? Math.min(100, Math.max(0, probVal)) : 0;

              return (
                <div
                  key={item.id || `prob-${idx}`}
                  className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 flex flex-col justify-center gap-1 shrink-0"
                >
                  <div className="flex items-center justify-between gap-1 leading-tight">
                    <span className="text-[10px] sm:text-xs font-bold text-neutral-100 font-mono tracking-wide truncate">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {getStatusBadge(probVal, item.status)}
                      <span className="text-[10px] sm:text-xs font-black font-mono text-white">
                        {hasVal ? `${probVal}%` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Real Probability Visual Bar */}
                  <div className="w-full bg-neutral-800/80 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getBarColor(probVal)}`}
                      style={{ width: `${normalizedWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Proper centered compact standby state with NO wasted space */
          <div
            id="crib-empty-probability-state"
            className="w-full h-full py-2 px-2 flex flex-col items-center justify-center text-center rounded-lg bg-black/30 border border-dashed border-white/10"
          >
            <Activity className="w-4 h-4 text-neutral-500 mb-1 animate-pulse" aria-hidden="true" />
            <p className="text-[10px] sm:text-[11px] font-bold tracking-wider text-neutral-200 uppercase font-mono">
              NO CONDITION RESULT
            </p>
            <p className="text-[8px] sm:text-[9px] text-neutral-400 uppercase font-mono tracking-tight mt-0.5">
              WAITING FOR CONDITION DATA
            </p>
            <div className="mt-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-mono text-neutral-400 font-semibold uppercase tracking-wider">
              CONDITION STANDBY
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Indicator */}
      <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-neutral-400 shrink-0">
        <span>CONDITION</span>
        <span className={hasProbabilities ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
          {hasProbabilities ? 'READY' : 'STANDBY'}
        </span>
      </div>
    </div>
  );
};

