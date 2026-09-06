import React from 'react';
import { X, HeartPulse, Activity } from 'lucide-react';
import { CribVital, CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribExpandedVitalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vitals: CribVital[];
  mode: CribMode;
}

export const CribExpandedVitalsModal: React.FC<CribExpandedVitalsModalProps> = ({
  isOpen,
  onClose,
  vitals,
  mode,
}) => {
  if (!isOpen) return null;

  const theme = CRIB_THEMES[mode];

  const formatVitalValue = (vital: CribVital) => {
    if (vital.value === null || vital.value === undefined || vital.value === '') {
      return '--';
    }
    return vital.value;
  };

  const getStatusBadge = (status: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) {
      return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-neutral-800 text-neutral-400">OFFLINE</span>;
    }
    if (status === 'critical') {
      return <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono rounded bg-red-600/30 text-red-300 border border-red-500/50 uppercase animate-pulse">CRITICAL</span>;
    }
    if (status === 'warning') {
      return <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono rounded bg-amber-600/30 text-amber-300 border border-amber-500/50 uppercase">WARNING</span>;
    }
    return <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 uppercase">NORMAL</span>;
  };

  return (
    <div
      id="crib-expanded-vitals-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vitals-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-2xl max-h-[85dvh] flex flex-col rounded-2xl border ${theme.panelBorder} bg-neutral-950 shadow-2xl overflow-hidden`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <HeartPulse className={`w-5 h-5 ${theme.accentColor}`} />
            <div>
              <h3 id="vitals-modal-title" className="text-sm font-black tracking-wider uppercase text-white">
                ALL LIVE TELEMETRY VITALS
              </h3>
              <p className="text-[10px] font-mono text-neutral-400">
                10-PARAMETER PHYSIOLOGICAL MONITORING STREAM
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Vitals Details"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Complete Vitals Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {vitals.map((vital) => {
              const isBfit = vital.key.toLowerCase() === 'bfit';
              const valueStr = formatVitalValue(vital);
              const isAvailable = vital.value !== null && vital.value !== undefined;

              return (
                <div
                  key={vital.key}
                  className={`p-3 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between ${
                    isBfit ? 'border-amber-500/40 bg-amber-950/20' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                      {vital.label}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {vital.unit || 'Standard Unit'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-lg font-black tracking-tight ${
                        isAvailable ? 'text-white' : 'text-neutral-500 font-normal'
                      }`}
                    >
                      {isBfit && isAvailable ? `B-FIT ${valueStr}` : valueStr}
                    </span>
                    {getStatusBadge(vital.status, vital.value)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2 text-xs text-neutral-400">
            <Activity className="w-4 h-4 text-neutral-500 shrink-0" />
            <span>
              Real-time physiological telemetry is verified and routed through local pipeline sensors.
            </span>
          </div>
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
