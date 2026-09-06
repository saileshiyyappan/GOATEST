import React, { ReactNode } from 'react';
import { ConditionProcessingState } from '../../services/condition/conditionTypes';
import { ConditionStatus } from './ConditionStatus';

interface ConditionFrameProps {
  children: ReactNode;
  currentState?: ConditionProcessingState;
  viewMode?: 'loading' | 'report';
  canGoNext?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
}

export const ConditionFrame: React.FC<ConditionFrameProps> = ({
  children,
  currentState = 'ANALYZING',
  viewMode = 'loading',
  canGoNext = false,
  onNext,
  onBack,
  onDownload,
  isDownloading = false,
}) => {
  return (
    <div
      id="condition-viewport-root"
      className="h-full min-h-0 w-full max-w-full overflow-x-hidden bg-[#090a0c] text-neutral-200 flex items-center justify-center p-0 overflow-y-hidden select-none font-sans"
    >
      {/* Universal Mobile Frame Container */}
      <div
        id="condition-mobile-frame"
        className="w-full max-w-full h-full min-h-0 bg-[#121316] flex flex-col overflow-x-hidden overflow-y-hidden relative"
      >
        {/* Top Bar */}
        <header
          id="condition-top-bar"
          className="h-14 px-4 sm:px-5 border-b border-[#22242a] bg-[#16171c]/95 backdrop-blur flex items-center justify-between flex-shrink-0 z-10"
        >
          <div className="flex items-center space-x-2.5">
            {onBack ? (
              <button
                id="condition-back-btn"
                onClick={onBack}
                className="text-xs font-mono font-semibold tracking-wider text-neutral-400 hover:text-neutral-100 flex items-center space-x-1 cursor-pointer transition-colors py-1 px-1.5 rounded-lg bg-neutral-800/40 border border-neutral-700/40"
              >
                <span>&lt; BACK</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-neutral-400" />
                <h1 className="text-xs font-bold tracking-widest text-neutral-100 uppercase font-mono">
                  CONDITION
                </h1>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {viewMode === 'report' && onDownload && (
              <button id="download-report-btn" type="button" onClick={onDownload} disabled={isDownloading} className="text-xs font-mono font-bold tracking-wider px-3 py-1 rounded-lg border bg-neutral-100 text-neutral-900 border-white hover:bg-white shadow cursor-pointer disabled:opacity-50">
                {isDownloading ? 'GENERATING PDF...' : 'DOWNLOAD PDF'}
              </button>
            )}
            <ConditionStatus state={currentState} />

            {/* Top NEXT > Button */}
            {viewMode === 'loading' && onNext && (
              <button
                id="condition-top-next-btn"
                onClick={onNext}
                disabled={!canGoNext}
                className={`text-xs font-mono font-bold tracking-wider px-3 py-1 rounded-lg border transition-all flex items-center space-x-1 ${
                  canGoNext
                    ? 'bg-neutral-100 text-neutral-900 border-white hover:bg-white shadow cursor-pointer active:scale-95'
                    : 'bg-neutral-900/60 text-neutral-600 border-neutral-800 cursor-not-allowed opacity-50'
                }`}
              >
                <span>NEXT &gt;</span>
              </button>
            )}
          </div>
        </header>

        {/* Condition Main Content Viewport */}
        <main
          id="condition-content-area"
          className="flex-1 min-w-0 w-full max-w-full flex flex-col items-center justify-center p-3 sm:p-4 overflow-x-hidden overflow-y-hidden relative"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
