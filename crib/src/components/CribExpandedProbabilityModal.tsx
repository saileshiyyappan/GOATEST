import React from 'react';
import { X, AlertTriangle, Activity } from 'lucide-react';
import { CribProbability, CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribExpandedProbabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  probabilities: CribProbability[];
  mode: CribMode;
}

export const CribExpandedProbabilityModal: React.FC<CribExpandedProbabilityModalProps> = ({
  isOpen,
  onClose,
  probabilities,
  mode,
}) => {
  if (!isOpen) return null;

  const theme = CRIB_THEMES[mode];
  const hasProbabilities = probabilities && probabilities.length > 0;

  const getStatusBadge = (prob: number | null, status?: string) => {
    if (prob === null) return null;
    if (prob >= 75 || status === 'critical') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-600/30 text-red-300 border border-red-500/50 uppercase">CRITICAL</span>;
    }
    if (prob >= 40 || status === 'high') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-600/30 text-amber-300 border border-amber-500/50 uppercase">HIGH</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-600/30 text-blue-300 border border-blue-500/50 uppercase">MOD</span>;
  };

  return (
    <div
      id="crib-expanded-probability-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prob-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-2xl max-h-[85dvh] flex flex-col rounded-2xl border ${theme.panelBorder} bg-neutral-950 shadow-2xl overflow-hidden`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${theme.accentColor}`} />
            <div>
              <h3 id="prob-modal-title" className="text-sm font-black tracking-wider uppercase text-white">
                ALL EVALUATED CONDITION PROBABILITIES
              </h3>
              <p className="text-[10px] font-mono text-neutral-400">
                MULTI-PATTERN EMERGENCY RECOGNITION MATRIX
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Probability Details"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Complete Probabilities List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          {hasProbabilities ? (
            probabilities.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-black/50 border border-white/10 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-100 uppercase tracking-wide">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.probability, item.status)}
                    <span className="text-base font-extrabold text-white">
                      {item.probability !== null ? `${item.probability}%` : '--'}
                    </span>
                  </div>
                </div>

                {item.probability !== null && (
                  <div className="w-full bg-neutral-850 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.probability >= 75
                          ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                          : item.probability >= 40
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, item.probability))}%` }}
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center rounded-xl bg-black/30 border border-dashed border-white/10">
              <Activity className="w-8 h-8 text-neutral-500 mb-3 animate-pulse" />
              <p className="text-sm font-bold tracking-widest text-neutral-300 uppercase font-mono">
                NO CONDITION RESULT
              </p>
              <p className="text-xs text-neutral-500 mt-1 uppercase font-mono">
                WAITING FOR CONDITION DATA / BACKGROUND PIPELINE
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-neutral-900/60 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono font-bold uppercase text-white transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
