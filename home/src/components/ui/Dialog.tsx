/**
 * GOATEST Universal Dialog / Modal Component
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Card } from './Card';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'sm',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <Card
        className={`relative z-10 w-full ${widthClasses[maxWidth]} max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left`}
        padding="lg"
      >
        <div className="flex items-start justify-between pb-3 border-b border-[#263238]">
          <div className="min-w-0 break-words">
            <h3 className="text-base font-bold text-[#263238] uppercase tracking-wide">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#37474f] mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-w-11 min-h-11 shrink-0 flex items-center justify-center rounded-lg text-[#263238] hover:bg-[#78909c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overflow-x-hidden py-4 text-sm text-[#263238] break-words">
          {children}
        </div>

        {footer && (
          <div className="pt-3 border-t border-[#263238] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
};
