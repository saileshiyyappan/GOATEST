/**
 * GOATEST Divider & ProgressIndicator
 */

import React from 'react';

export interface DividerProps {
  label?: string;
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ label, className = '' }) => {
  if (label) {
    return (
      <div className={`relative flex py-3 items-center ${className}`}>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        <span className="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
      </div>
    );
  }
  return <hr className={`border-t border-slate-200 dark:border-slate-800 my-4 ${className}`} />;
};

export interface ProgressIndicatorProps {
  value?: number; // 0 - 100
  indeterminate?: boolean;
  size?: 'sm' | 'md';
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
  };

  return (
    <div className={`w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden ${heightClasses[size]} ${className}`}>
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
