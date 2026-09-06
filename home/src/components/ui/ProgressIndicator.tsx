/**
 * GOATEST Universal Progress Indicator Component
 */

import React from 'react';

export interface ProgressIndicatorProps {
  value?: number; // 0 - 100
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value = 0,
  indeterminate = false,
  size = 'md',
  className = '',
}) => {
  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div
      className={`w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden ${heightClasses[size]} ${className}`}
    >
      {indeterminate ? (
        <div className="w-full h-full bg-[var(--color-accent)] animate-pulse rounded-full" />
      ) : (
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-300 rounded-full"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      )}
    </div>
  );
};
