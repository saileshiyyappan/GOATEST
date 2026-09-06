/**
 * GOATEST Universal Loading Page
 * 
 * Standardized loading & pipeline screen.
 * Dark-gray background with centered light-gray card, animated spinner, and simple text.
 */

import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Loader2, ArrowLeft } from 'lucide-react';

export interface LoadingPageProps {
  title?: string;
  subtext?: string;
  onBack?: () => void;
}

export const LoadingPage: React.FC<LoadingPageProps> = ({
  title = 'Loading...',
  subtext = 'Please wait...',
  onBack,
}) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-(--color-bg-app) text-center select-none">
      <Card padding="lg" className="w-full max-w-xs shadow-xl flex flex-col items-center justify-center py-8">
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-300 animate-pulse" />
          <Loader2 className="w-6 h-6 text-[var(--color-accent)] animate-spin absolute" />
        </div>

        <h3 className="text-sm font-bold tracking-wider uppercase text-zinc-900">
          {title}
        </h3>
        
        {subtext && (
          <p className="text-xs text-zinc-600 mt-1.5 max-w-[200px] leading-relaxed">
            {subtext}
          </p>
        )}

        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="mt-5 text-xs bg-white text-zinc-900 border-zinc-300"
          >
            Go Back
          </Button>
        )}
      </Card>
    </div>
  );
};
