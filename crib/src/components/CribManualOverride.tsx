import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, ShieldOff, HeartHandshake } from 'lucide-react';
import { CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribManualOverrideProps {
  mode: CribMode;
  onManualOverride: () => void;
  isTriggered?: boolean;
  onContinueSsb?: () => void;
  isContinuing?: boolean;
}

export const CribManualOverride: React.FC<CribManualOverrideProps> = ({
  mode,
  onManualOverride,
  isTriggered = false,
  onContinueSsb,
  isContinuing = false,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const theme = CRIB_THEMES[mode];

  const handleInitialClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    onManualOverride();
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div
      id="crib-manual-override-container"
      className="w-full flex flex-col items-center justify-center shrink-0 pt-1 pb-1"
    >
      {/* Confirmation Modal when clicked */}
      {showConfirm ? (
        <div
          id="crib-override-confirm-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-confirm-title"
          className="w-full max-w-md p-3 sm:p-4 rounded-xl bg-neutral-900 border-2 border-red-500 shadow-2xl text-center flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200 z-40"
        >
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-400 animate-bounce" aria-hidden="true" />
            <h3 id="override-confirm-title" className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              CONFIRM MANUAL OVERRIDE
            </h3>
          </div>
          <p className="text-[11px] text-neutral-300">
            Emergency intervention will override automated dispatch protocols.
          </p>
          <div className="flex items-center gap-2 w-full mt-1">
            <button
              id="crib-override-cancel-btn"
              type="button"
              onClick={handleCancel}
              className="flex-1 py-1.5 sm:py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase tracking-wider border border-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-400"
            >
              Cancel
            </button>
            <button
              id="crib-override-confirm-btn"
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-1.5 sm:py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-950/60 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
            >
              Execute Override
            </button>
          </div>
        </div>
      ) : isTriggered ? (
        <div
          id="crib-override-active-banner"
          className="w-full py-2 px-3 sm:px-4 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-100 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wider">
                MANUAL OVERRIDE ENGAGED
              </p>
              <p className="text-[10px] text-emerald-300/80 font-mono">
                Manual signal active.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onManualOverride()}
            className="px-2.5 py-1 text-[10px] font-mono font-bold rounded bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-400/50 text-white uppercase transition-colors"
          >
            Re-engage
          </button>
        </div>
      ) : mode === 'SSB' ? (
        /* FIXED BOTTOM CONTROLS FOR SSB: [MANUAL OVERRIDE] [CONTINUE SSB] */
        <div className="w-full grid grid-cols-2 gap-2">
          <button
            id="crib-manual-override-btn"
            type="button"
            onClick={handleInitialClick}
            aria-label="Initiate CRIB Manual Override"
            className="py-2.5 sm:py-3 px-3 rounded-xl border-2 border-red-500/80 bg-red-950/80 hover:bg-red-900/90 text-red-100 font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-red-400 shadow-lg truncate"
          >
            <ShieldOff className="w-4 h-4 shrink-0 text-red-400" aria-hidden="true" />
            <span className="truncate">MANUAL OVERRIDE</span>
          </button>

          <button
            id="crib-continue-ssb-btn"
            type="button"
            onClick={() => onContinueSsb?.()}
            aria-label="Confirm Continued Stranger/Helper Assistance (Continue SSB)"
            className={`py-2.5 sm:py-3 px-3 rounded-xl border-2 font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-lg truncate ${
              isContinuing
                ? 'border-emerald-500 bg-emerald-950/90 text-emerald-200 hover:bg-emerald-900'
                : 'border-amber-500/80 bg-amber-950/80 hover:bg-amber-900/90 text-amber-100'
            }`}
          >
            <HeartHandshake className={`w-4 h-4 shrink-0 ${isContinuing ? 'text-emerald-400' : 'text-amber-400'}`} aria-hidden="true" />
            <span className="truncate">{isContinuing ? 'ASSISTING (CONTINUE SSB)' : 'CONTINUE SSB'}</span>
          </button>
        </div>
      ) : (
        /* SINGLE LARGE BUTTON FOR SDCU / DIAG */
        <button
          id="crib-manual-override-btn"
          type="button"
          onClick={handleInitialClick}
          aria-label="Initiate CRIB Manual Override"
          className={`w-full py-3 sm:py-3.5 px-4 rounded-xl border-2 font-black text-xs sm:text-sm tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-red-400/50 shadow-lg ${theme.overrideBtnBg}`}
        >
          <ShieldOff className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" aria-hidden="true" />
          <span>MANUAL OVERRIDE</span>
        </button>
      )}
    </div>
  );
};

