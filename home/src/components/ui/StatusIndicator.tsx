/**
 * GOATEST Universal Status Indicator
 */

import React from 'react';
import type { SystemServiceStatus } from '../../types';

export interface StatusIndicatorProps {
  status: SystemServiceStatus;
  label?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className = '',
}) => {
  const statusConfig: Record<
    SystemServiceStatus,
    { dotColor: string; ping: boolean; defaultLabel: string }
  > = {
    READY: { dotColor: 'bg-emerald-500', ping: false, defaultLabel: 'READY' },
    INITIALIZING: { dotColor: 'bg-sky-500', ping: true, defaultLabel: 'INITIALIZING' },
    STANDBY: { dotColor: 'bg-slate-400', ping: false, defaultLabel: 'STANDBY' },
    PIPELINE_STANDBY: { dotColor: 'bg-amber-500', ping: false, defaultLabel: 'PIPELINE STANDBY' },
    NOT_CONFIGURED: { dotColor: 'bg-amber-400', ping: false, defaultLabel: 'NOT CONFIGURED' },
    DEVICE_NOT_CONNECTED: { dotColor: 'bg-rose-400', ping: false, defaultLabel: 'DEVICE NOT CONNECTED' },
    OFFLINE: { dotColor: 'bg-slate-500', ping: false, defaultLabel: 'OFFLINE' },
    ERROR: { dotColor: 'bg-red-500', ping: false, defaultLabel: 'ERROR' },
  };

  const current = statusConfig[status] || statusConfig.NOT_CONFIGURED;
  const displayLabel = label || current.defaultLabel;

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${className}`}>
      <span className="relative flex h-2 w-2">
        {current.ping && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${current.dotColor} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dotColor}`} />
      </span>
      <span className="text-[11px] font-semibold tracking-wider text-slate-700 dark:text-slate-300">
        {displayLabel}
      </span>
    </div>
  );
};
