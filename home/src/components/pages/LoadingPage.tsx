/**
 * GOATEST Universal Loading Page Component
 * 
 * Reusable minimal loading state for views & pipelines.
 * Standardized layout: dark gray background, light gray card, animated center spinner, simple text.
 * Zero fake algorithms, zero fake percentages, zero technical clutter.
 */

import React from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface LoadingPageProps {
  title?: string;
  subtext?: string;
  onBack?: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const LoadingPage: React.FC<LoadingPageProps> = ({
  title = 'Loading...',
  subtext = 'Please wait...',
  onBack,
  actionText,
  onAction,
}) => {
  return (
    <div
      className="w-full flex-1 flex flex-col items-center justify-center min-h-[460px] py-8 px-4 text-center select-none"
      style={{ minHeight: 'calc(100vh - 160px)' }}
    >
      <Card padding="lg" className="w-full max-w-xs shadow-xl flex flex-col items-center justify-center py-8">
        {/* Subtle loading spinner */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--color-card-border)] animate-pulse" />
          <Loader2 className="w-6 h-6 text-[var(--color-accent)] animate-spin absolute" />
        </div>

        {/* Title */}
        <h2 className="text-base font-bold tracking-wider text-[var(--color-card-text)] uppercase">
          {title}
        </h2>

        {/* Subtext */}
        <p className="text-xs text-[var(--color-card-text-muted)] font-medium mt-1.5 leading-relaxed">
          {subtext}
        </p>

        {/* Optional Actions */}
        {(onBack || onAction) && (
          <div className="mt-6 flex flex-col gap-2 w-full max-w-[200px]">
            {onAction && actionText && (
              <Button
                variant="primary"
                size="sm"
                onClick={onAction}
                fullWidth
              >
                {actionText}
              </Button>
            )}

            {onBack && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                fullWidth
                className="text-xs"
              >
                Go Back
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
