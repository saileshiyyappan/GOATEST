/**
 * GOATEST Universal Badge Component
 */

import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'user' | 'caretaker' | 'verified';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] font-semibold',
    md: 'px-2.5 py-1 text-xs font-semibold',
  };

  const variantClasses = {
    neutral: 'bg-[#78909c] text-[#263238] border border-[#263238]',
    primary: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border border-[#263238]',
    accent: 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]',
    success: 'bg-emerald-800 text-emerald-100 border border-emerald-950',
    verified: 'bg-emerald-800 text-emerald-100 border border-emerald-950',
    warning: 'bg-amber-800 text-amber-100 border border-amber-950',
    danger: 'bg-red-800 text-red-100 border border-red-950',
    user: 'bg-[#78909c] text-[#263238] border border-[#263238]',
    caretaker: 'bg-[#37474f] text-white border border-[#263238]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full uppercase tracking-wider ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
