import React, { useState } from 'react';
import { HelpCircle, ChevronRight, Check, X } from 'lucide-react';
import { SSBQuestion } from '../types/ssb';

interface CribStrangerPromptProps {
  question: SSBQuestion;
  onRespond: (response: 'YES' | 'NO') => void;
  onNextQuestion?: () => void;
  lastResponse?: { questionText: string; response: 'YES' | 'NO' } | null;
}

export const CribStrangerPrompt: React.FC<CribStrangerPromptProps> = ({
  question,
  onRespond,
  onNextQuestion,
  lastResponse,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return (
      <div className="w-full flex justify-end shrink-0">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-[10px] font-mono text-amber-400 hover:text-amber-300 underline flex items-center gap-1 uppercase"
        >
          <HelpCircle className="w-3 h-3" />
          <span>Ask Responder Question</span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="crib-stranger-prompt-popup"
      role="region"
      aria-label="Stranger/Helper Assistance Question"
      className="w-full p-2.5 rounded-xl bg-amber-950/90 border border-amber-500/60 shadow-lg flex flex-col gap-2 shrink-0 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span className="text-[10px] font-mono font-black text-amber-300 uppercase tracking-widest truncate">
            HELPER / RESPONDER CHECK
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onNextQuestion && (
            <button
              type="button"
              onClick={onNextQuestion}
              aria-label="Next question"
              title="Next question"
              className="text-[9px] font-mono text-amber-300/80 hover:text-amber-200 uppercase px-1.5 py-0.5 rounded bg-black/40 border border-amber-500/30 flex items-center gap-0.5"
            >
              <span>Next</span>
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wide">
          {question.text}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="stranger-prompt-no-btn"
            type="button"
            onClick={() => onRespond('NO')}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/20 text-neutral-200 font-bold text-xs font-mono uppercase tracking-wider transition-colors active:scale-95 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5 text-neutral-400" />
            <span>NO</span>
          </button>
          <button
            id="stranger-prompt-yes-btn"
            type="button"
            onClick={() => onRespond('YES')}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs font-mono uppercase tracking-wider transition-colors shadow-md active:scale-95 flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
            <span>YES</span>
          </button>
        </div>
      </div>

      {lastResponse && (
        <div className="pt-1 border-t border-amber-500/20 flex items-center justify-between text-[9px] font-mono text-amber-200/70">
          <span className="truncate">Last verified: {lastResponse.questionText}</span>
          <span className="font-bold text-amber-300 uppercase shrink-0">[{lastResponse.response}]</span>
        </div>
      )}
    </div>
  );
};
