import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ShieldAlert, X } from 'lucide-react';

export interface CribActivationModalProps {
  isOpen: boolean;
  countdown: number;
  onActivate: () => void;
  onExit: () => void;
}

export const CribActivationModal: React.FC<CribActivationModalProps> = ({
  isOpen,
  countdown,
  onActivate,
  onExit,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="crib-activation-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        id="crib-activation-dialog"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm rounded-2xl bg-neutral-950 border-2 border-red-500/70 p-5 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Header Visual Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        {/* Icon & Title */}
        <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center mb-3 text-red-400">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white font-mono uppercase">
          ACTIVATE CRIB?
        </h2>

        <p className="text-xs text-neutral-300 mt-1 mb-3">
          Starting emergency monitoring in{' '}
          <strong className="text-red-400 font-mono text-sm">{countdown}s</strong>
        </p>

        {/* Countdown Visual Indicator */}
        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-5">
          <motion.div
            className="h-full bg-red-500"
            initial={{ width: '100%' }}
            animate={{ width: `${(countdown / 10) * 100}%` }}
            transition={{ duration: 0.8, ease: 'linear' }}
          />
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            id="btn-activate-crib"
            type="button"
            onClick={onActivate}
            className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            ACTIVATE CRIB
          </button>

          <button
            id="btn-exit-crib"
            type="button"
            onClick={onExit}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] text-neutral-300 hover:text-white font-semibold text-xs uppercase tracking-wider transition-colors border border-white/10 flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            EXIT
          </button>
        </div>
      </motion.div>
    </div>
  );
};
