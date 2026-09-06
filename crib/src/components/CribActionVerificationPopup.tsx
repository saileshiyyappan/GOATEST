import React from 'react';
import { motion } from 'motion/react';
import { HelpCircle, Check, X } from 'lucide-react';
import { SDCUActionQuestion } from '../types/sdcu';

export interface CribActionVerificationPopupProps {
  question: SDCUActionQuestion | null;
  countdown: number;
  onRespond: (response: 'YES' | 'NO') => void;
}

export const CribActionVerificationPopup: React.FC<CribActionVerificationPopupProps> = ({
  question,
  countdown,
  onRespond,
}) => {
  if (!question) return null;

  return (
    <motion.div
      id="crib-action-verification-popup"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="w-full rounded-xl bg-neutral-950/95 border border-amber-500/70 p-2.5 sm:p-3 shadow-xl backdrop-blur-md flex flex-col gap-2 shrink-0 z-20 relative overflow-hidden"
    >
      {/* Visual Accent Top Bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 animate-pulse" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-950 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase font-mono text-amber-400/90 font-semibold tracking-wider">
              ACTION VERIFICATION
            </span>
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
              {question.text}
            </h4>
          </div>
        </div>

        {/* Countdown Badge */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold shrink-0">
          <span>{countdown}s</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-0.5">
        <button
          id="btn-action-yes"
          type="button"
          onClick={() => onRespond('YES')}
          className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/50"
        >
          <Check className="w-3.5 h-3.5" />
          YES
        </button>

        <button
          id="btn-action-no"
          type="button"
          onClick={() => onRespond('NO')}
          className="py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-neutral-200 hover:text-white font-semibold text-xs uppercase tracking-wider transition-colors border border-white/10 flex items-center justify-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          NO
        </button>
      </div>
    </motion.div>
  );
};
