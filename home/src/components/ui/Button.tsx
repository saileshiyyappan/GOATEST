/**
 * GOATEST Universal Button Component
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5 min-h-[36px]',
    md: 'px-4 py-2 text-sm font-medium rounded-xl gap-2 min-h-[44px]',
    lg: 'px-6 py-3 text-base font-medium rounded-xl gap-2.5 min-h-[48px]',
  };

  const variantClasses = {
    primary:
      'bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-fg)] font-semibold hover:opacity-90 active:scale-[0.98] shadow-xs border border-[#263238]',
    accent:
      'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-semibold hover:opacity-90 active:scale-[0.98] shadow-xs',
    secondary:
      'bg-[#78909c] text-[#263238] hover:bg-[#b0bec5] font-semibold border border-[#263238] active:scale-[0.98]',
    outline:
      'border border-[#263238] text-[#263238] hover:bg-[#263238]/10 font-semibold active:scale-[0.98]',
    ghost:
      'text-[#263238] hover:bg-[#263238]/10 font-medium active:scale-[0.98]',
    danger:
      'bg-[var(--color-emergency)] text-[var(--color-emergency-foreground)] font-semibold hover:opacity-90 active:scale-[0.98] shadow-xs',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = disabled || isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';

  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${disabledClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
