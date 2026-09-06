/**
 * GOATEST Universal Card Component
 */

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outline' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const variantClasses = {
    default:
      'bg-[var(--color-surface-card)] text-[var(--color-card-text)] border border-[var(--color-card-border)] shadow-xs rounded-2xl',
    elevated:
      'bg-[var(--color-surface-card)] text-[var(--color-card-text)] border border-[var(--color-card-border)] shadow-md rounded-2xl',
    outline:
      'bg-transparent border border-[var(--color-border)] text-[var(--color-text-main)] rounded-2xl',
    interactive:
      'bg-[var(--color-surface-card)] text-[var(--color-card-text)] border border-[var(--color-card-border)] shadow-xs rounded-2xl hover:border-[var(--color-accent)] transition-all duration-150 cursor-pointer active:scale-[0.99]',
  };

  return (
    <div
      className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
