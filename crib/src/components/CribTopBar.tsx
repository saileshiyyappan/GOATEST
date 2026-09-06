import React from 'react';
import { Settings, ShieldAlert, Activity, HeartPulse, ArrowLeft } from 'lucide-react';
import { CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribTopBarProps {
  mode: CribMode;
  onOpenSettings: () => void;
  onExitToHome: () => void;
}

export const CribTopBar: React.FC<CribTopBarProps> = ({ mode, onOpenSettings, onExitToHome }) => {
  const theme = CRIB_THEMES[mode];

  const getModeIcon = () => {
    switch (mode) {
      case 'SDCU':
        return <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" aria-hidden="true" />;
      case 'SSB':
        return <HeartPulse className="w-4 h-4 text-amber-400 animate-pulse" aria-hidden="true" />;
      case 'DIAG':
        return <Activity className="w-4 h-4 text-cyan-400 animate-pulse" aria-hidden="true" />;
    }
  };

  return (
    <header
      id="crib-top-bar"
      role="banner"
      className={`w-full h-11 sm:h-12 px-3 sm:px-4 shrink-0 flex items-center justify-between z-30 transition-colors duration-300 ${theme.headerBg}`}
    >
      {/* LEFT: CRIB Title */}
      <div className="flex items-center gap-2">
        <span
          id="crib-brand-title"
          className="text-base sm:text-lg font-black tracking-widest text-white uppercase select-none flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
          CRIB
        </span>
        <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-neutral-300">
          EMERGENCY CONSOLE
        </span>
      </div>

      {/* CENTER: Current Mode */}
      <div
        id="crib-mode-indicator"
        className="flex items-center gap-1.5"
        aria-live="polite"
      >
        <div
          className={`flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full border text-[11px] sm:text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder} shadow-sm`}
        >
          {getModeIcon()}
          <span>MODE: <strong className="font-bold tracking-widest">{mode}</strong></span>
        </div>
      </div>

      {/* RIGHT: Settings Control */}
      <div className="flex items-center gap-1.5">
        <button
          id="crib-exit-home-btn"
          type="button"
          onClick={onExitToHome}
          aria-label="Exit CRIB to HOME"
          title="Exit to HOME"
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-black/40 hover:bg-black/60 border border-white/15 text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline text-[11px] font-medium uppercase tracking-wider">Exit</span>
        </button>
        <button
          id="crib-settings-btn"
          type="button"
          onClick={onOpenSettings}
          aria-label="Open CRIB Emergency Settings & Mode Selector"
          title="CRIB Settings"
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-black/40 hover:bg-black/60 border border-white/15 text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
        >
          <Settings className="w-3.5 h-3.5 text-neutral-200" aria-hidden="true" />
          <span className="hidden sm:inline text-[11px] font-medium uppercase tracking-wider">Settings</span>
        </button>
      </div>
    </header>
  );
};
