import React from 'react';
import {
  ConditionProcessingState,
  CONDITION_STATE_CONFIG,
} from '../../services/condition/conditionTypes';

interface ConditionLoadingProps {
  state?: ConditionProcessingState;
  customPrimary?: string;
  customSecondary?: string;
  customFootnote?: string;
  errorMessage?: string;
}

export const ConditionLoading: React.FC<ConditionLoadingProps> = ({
  state = 'ANALYZING',
  customPrimary,
  customSecondary,
  customFootnote,
  errorMessage,
}) => {
  const config = CONDITION_STATE_CONFIG[state] || CONDITION_STATE_CONFIG.ANALYZING;

  let primaryText = customPrimary || config.primary;
  let secondaryText = customSecondary || (state === 'ERROR' && errorMessage ? errorMessage : config.secondary);
  let footnoteText = customFootnote || config.footnote;

  if (state === 'COMPLETED') {
    primaryText = 'PHYSIOLOGICAL ANALYSIS COMPLETED';
    secondaryText = 'CONDITION REPORT READY';
    footnoteText = 'CLICK NEXT > TO VIEW REPORT';
  }

  return (
    <div
      id="condition-loading-card"
      className="w-full max-w-[340px] flex flex-col items-center justify-between py-10 px-6 bg-[#181a1f] border border-[#262932] rounded-2xl shadow-xl min-h-[380px] my-auto"
    >
      {/* Top Tag */}
      <div id="condition-loading-header" className="text-center space-y-1">
        <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase font-semibold">
          CONDITION
        </span>
        <div className="w-8 h-[1px] bg-neutral-700 mx-auto mt-1" />
      </div>

      {/* Center Primary and Secondary State Display */}
      <div id="condition-loading-center" className="flex flex-col items-center text-center space-y-5 my-auto">
        <div className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-100 uppercase font-sans">
            {primaryText}
          </h2>
          <p className="text-xs font-mono text-neutral-400 tracking-wider uppercase">
            {secondaryText}
          </p>
        </div>

        {/* Minimal Rhythm / State Indicator Animation */}
        {state === 'COMPLETED' ? (
          <div className="flex items-center justify-center p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          </div>
        ) : state !== 'ERROR' ? (
          <div
            id="condition-loading-indicator"
            className="flex items-center space-x-2 py-3"
            aria-label="Processing indicator"
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-neutral-300 animate-pulse"
              style={{ animationDelay: '0ms', animationDuration: '1.2s' }}
            />
            <span
              className="w-2.5 h-2.5 rounded-full bg-neutral-400 animate-pulse"
              style={{ animationDelay: '200ms', animationDuration: '1.2s' }}
            />
            <span
              className="w-2.5 h-2.5 rounded-full bg-neutral-500 animate-pulse"
              style={{ animationDelay: '400ms', animationDuration: '1.2s' }}
            />
          </div>
        ) : (
          <div className="py-2">
            <span className="inline-block w-3 h-3 rounded-full bg-rose-500" />
          </div>
        )}
      </div>

      {/* Bottom User Instruction */}
      <div id="condition-loading-footer" className="text-center pt-2">
        <span className={`text-[10px] font-mono tracking-widest uppercase font-medium ${state === 'COMPLETED' ? 'text-neutral-200 font-bold' : 'text-neutral-500'}`}>
          {footnoteText}
        </span>
      </div>
    </div>
  );
};

