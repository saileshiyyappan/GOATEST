import React from 'react';
import { HeartPulse, Maximize2, AlertTriangle } from 'lucide-react';
import { CribVital, CribMode } from '../types/crib';
import { CribFreshnessStatus } from '../types/cribInput';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribVitalsPanelProps {
  vitals: CribVital[];
  mode: CribMode;
  onOpenExpand: () => void;
  freshness?: CribFreshnessStatus;
}

interface TargetVitalSlot {
  key: string;
  label: string;
  unit: string;
  matchKeys: string[];
}

const TARGET_VITAL_SLOTS: TargetVitalSlot[] = [
  { key: 'hr', label: 'HR', unit: 'bpm', matchKeys: ['hr', 'heartrate'] },
  { key: 'spo2', label: 'SpO2', unit: '%', matchKeys: ['spo2'] },
  { key: 'ppi', label: 'PPI', unit: 'ms', matchKeys: ['ppi'] },
  { key: 'rr', label: 'RR', unit: '/min', matchKeys: ['rr', 'respiratoryrate'] },
  { key: 'rmssd', label: 'RMSSD', unit: 'ms', matchKeys: ['rmssd'] },
  { key: 'sdnn', label: 'SDNN', unit: 'ms', matchKeys: ['sdnn'] },
  { key: 'temp', label: 'TEMP', unit: '°C', matchKeys: ['temp', 'skintemperature'] },
  { key: 'motion', label: 'MOTION', unit: 'g', matchKeys: ['motion', 'motionvector'] },
  { key: 'o2', label: 'O2', unit: '', matchKeys: ['o2', 'arterialo2content'] },
  { key: 'bfit', label: 'B-FIT', unit: '', matchKeys: ['bfit', 'bfitresult'] },
];

export const CribVitalsPanel: React.FC<CribVitalsPanelProps> = ({
  vitals,
  mode,
  onOpenExpand,
  freshness,
}) => {
  const theme = CRIB_THEMES[mode];

  // Map 10 required vital slots deterministically preserving exact order
  const slotItems = TARGET_VITAL_SLOTS.map((slot) => {
    const found = vitals.find((v) => slot.matchKeys.includes(v.key.toLowerCase()));
    const isAvailable = found && found.value !== null && found.value !== undefined && found.value !== '';
    return {
      key: slot.key,
      label: slot.label,
      unit: found?.unit || slot.unit,
      value: isAvailable ? found!.value : null,
      status: found?.status || 'unknown',
      isAvailable,
    };
  });

  const getStatusDot = (status?: string, isAvailable?: boolean) => {
    if (!isAvailable) {
      return <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 inline-block" />;
    }
    if (status === 'critical') {
      return <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />;
    }
    if (status === 'warning') {
      return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />;
    }
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />;
  };

  return (
    <div
      id="crib-live-vitals-panel"
      className={`relative w-full h-full rounded-xl border ${theme.panelBorder} ${theme.panelBg} p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-300 shadow-md overflow-hidden`}
    >
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-1 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <HeartPulse className={`w-3.5 h-3.5 ${theme.accentColor}`} aria-hidden="true" />
          <h2 className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-white truncate">
            LIVE VITALS
          </h2>
        </div>
        <button
          id="crib-expand-vitals-btn"
          type="button"
          onClick={onOpenExpand}
          aria-label="Expand Live Vitals Details"
          title="Expand Details"
          className="p-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-red-400 flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase"
        >
          <span className="hidden xs:inline">VIEW</span>
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Stale Alert if applicable */}
      {freshness === 'STALE' && (
        <div className="my-0.5 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-200 text-[8px] font-mono font-bold flex items-center gap-1 shrink-0">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
          <span className="truncate">STALE DATA</span>
        </div>
      )}

      {/* 2. Compact 2x5 Grid occupying full vertical height evenly */}
      <div className="flex-1 min-h-0 py-1 grid grid-cols-2 grid-rows-5 gap-1">
        {slotItems.map((item) => {
          const isBfit = item.key === 'bfit';
          return (
            <div
              key={item.key}
              className={`px-1.5 py-0.5 rounded-md bg-black/40 border border-white/10 flex flex-col justify-between ${
                isBfit && item.isAvailable ? 'border-amber-500/30 bg-amber-950/20' : ''
              }`}
            >
              <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-mono text-neutral-400 leading-none">
                <span className="font-bold uppercase tracking-wider text-neutral-300 truncate">
                  {item.label}
                </span>
                {getStatusDot(item.status, item.isAvailable)}
              </div>

              <div className="flex items-baseline justify-between leading-none mt-0.5">
                <span
                  className={`font-mono text-[10px] sm:text-xs font-black tracking-tight truncate ${
                    item.isAvailable ? 'text-white' : 'text-neutral-500 font-normal'
                  }`}
                >
                  {item.isAvailable ? String(item.value) : '--'}
                </span>
                {item.unit && (
                  <span className="text-[7px] sm:text-[8px] font-mono text-neutral-400 ml-1 truncate">
                    {item.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Footer Indicator */}
      <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-neutral-400 shrink-0">
        <span>TELEMETRY</span>
        <span className="text-neutral-400">10 PARAMETERS</span>
      </div>
    </div>
  );
};

