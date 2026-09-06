import React, { HTMLAttributes, ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  selected?: boolean;
  compact?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  selected = false,
  compact = false,
  className = '',
  style,
  ...props
}) => {
  const { mode, accent } = useTheme();

  let baseStyle = '';
  if (mode === 'WHITE') {
    baseStyle = 'bg-white border border-slate-200/80 shadow-xs text-slate-900';
  } else if (mode === 'DARK') {
    baseStyle = 'bg-zinc-900/90 border border-zinc-800 shadow-sm text-zinc-100';
  } else {
    // DEFAULT
    baseStyle = 'bg-zinc-800/85 border border-zinc-700/60 shadow-sm text-zinc-100';
  }

  const selectedClasses = selected ? 'ring-2' : '';
  const selectedStyle = selected ? {
    borderColor: accent.primary,
    boxShadow: `0 0 0 2px ${accent.ring}`,
  } : undefined;

  const paddingClass = compact ? 'p-3' : 'p-4';

  return (
    <div
      className={`rounded-2xl transition-all duration-150 ${paddingClass} ${baseStyle} ${selectedClasses} ${className}`}
      style={{ ...selectedStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
