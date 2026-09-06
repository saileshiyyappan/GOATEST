import React from 'react';
import { ConditionProcessingState } from '../../services/condition/conditionTypes';

interface ConditionStatusProps {
  state: ConditionProcessingState;
}

export const ConditionStatus: React.FC<ConditionStatusProps> = ({ state }) => {
  const getStatusColor = () => {
    switch (state) {
      case 'COMPLETED':
        return 'bg-emerald-400';
      case 'ERROR':
        return 'bg-rose-500';
      case 'ANALYZING':
      case 'PROCESSING':
      case 'RECEIVING_DATA':
      case 'INITIALIZING':
      default:
        return 'bg-neutral-400';
    }
  };

  return (
    <div
      id="condition-status-indicator"
      className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60"
    >
      <span className="relative flex h-2 w-2">
        {state !== 'ERROR' && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getStatusColor()}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor()}`} />
      </span>
      <span className="text-[11px] font-mono font-medium tracking-wider text-neutral-300 uppercase">
        {state}
      </span>
    </div>
  );
};
