/**
 * GOATEST Universal Loading State
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading...',
  subtitle = 'Please wait...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center min-h-[200px] ${className}`}>
      <div className="relative mb-4 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-zinc-300 dark:border-zinc-700 animate-pulse" />
        <Loader2 className="w-5 h-5 text-[var(--color-accent)] animate-spin absolute" />
      </div>
      <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};
