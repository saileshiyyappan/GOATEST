/**
 * GOATEST Universal Error State Component
 */

import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'System Error',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-left ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 uppercase tracking-wider">
            {title}
          </h4>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-relaxed break-words">
            {message}
          </p>
          {onRetry && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="bg-white/80 dark:bg-black/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs"
              >
                Retry Action
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
