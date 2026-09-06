import React, { useState } from 'react';
import { Activity, Check, ChevronDown, ChevronUp, Stethoscope, RefreshCw } from 'lucide-react';
import { DiagActionId, DiagActionResponsePayload } from '../types/diag';
import { ALL_DIAG_ACTION_CHOICES } from '../services/crib/diag/diagActionRegistry';

export interface CribDiagActionPromptProps {
  selectedAction: DiagActionResponsePayload | null;
  onSelectAction: (actionId: DiagActionId) => void;
  onDismissAction?: () => void;
}

export const CribDiagActionPrompt: React.FC<CribDiagActionPromptProps> = ({
  selectedAction,
  onSelectAction,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(!selectedAction);

  return (
    <div
      id="crib-diag-action-prompt"
      role="region"
      aria-label="Diagnostic Helper Action Verification"
      className="w-full rounded-xl bg-blue-950/90 border border-cyan-500/60 shadow-lg p-2 sm:p-2.5 flex flex-col gap-1.5 shrink-0 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-blue-900/90 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
            <Stethoscope className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[10px] font-mono font-black text-cyan-300 uppercase tracking-wider">
              DIAGNOSTIC ACTION VERIFICATION
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-200">
              NO TIMEOUT
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedAction && (
            <span className="text-[9px] font-mono text-cyan-200 font-bold bg-cyan-900/60 border border-cyan-500/50 px-1.5 py-0.5 rounded truncate max-w-[120px] sm:max-w-[200px]">
              [{selectedAction.actionLabel}]
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? 'Collapse action list' : 'Expand action list'}
            className="p-1 rounded bg-black/40 hover:bg-black/60 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-0.5"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Title / Question */}
      {isExpanded && (
        <p className="text-[11px] sm:text-xs font-bold text-white tracking-wide">
          Did the person perform or experience any of the following?
        </p>
      )}

      {/* 10 Action Buttons Grid */}
      {isExpanded ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-0.5 max-h-[140px] sm:max-h-none overflow-y-auto">
          {ALL_DIAG_ACTION_CHOICES.map((choice) => {
            const isSelected = selectedAction?.actionId === choice.id;
            return (
              <button
                key={choice.id}
                id={`btn-diag-action-${choice.id.toLowerCase()}`}
                type="button"
                onClick={() => {
                  onSelectAction(choice.id);
                  setIsExpanded(false);
                }}
                className={`py-1.5 px-2 rounded-lg font-bold text-[10px] sm:text-[11px] font-mono tracking-tight uppercase transition-all duration-150 flex items-center justify-between gap-1 border select-none active:scale-[0.98] ${
                  isSelected
                    ? 'bg-cyan-500 text-black border-cyan-300 shadow-md shadow-cyan-900/50 font-black ring-1 ring-white'
                    : 'bg-black/50 hover:bg-blue-900/70 border-cyan-500/30 text-cyan-100 hover:text-white hover:border-cyan-400'
                }`}
              >
                <span className="truncate">{choice.shortLabel || choice.label}</span>
                {isSelected ? (
                  <Check className="w-3 h-3 stroke-[3] shrink-0 text-black" />
                ) : (
                  <Activity className="w-2.5 h-2.5 shrink-0 opacity-40" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between pt-0.5 text-[10px] font-mono text-cyan-300/80">
          <span className="truncate">
            Verified: <strong className="text-cyan-200">{selectedAction?.actionLabel || 'NONE'}</strong>
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-cyan-400 hover:text-cyan-200 underline uppercase flex items-center gap-1 font-bold"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Change Action</span>
          </button>
        </div>
      )}
    </div>
  );
};
