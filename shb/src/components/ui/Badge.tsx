import React, { ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const { mode, accent } = useTheme();

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px] font-medium' : 'px-2.5 py-1 text-xs font-semibold';

  let variantClass = '';
  let customStyle: React.CSSProperties | undefined = undefined;

  switch (variant) {
    case 'success':
      variantClass = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      break;
    case 'warning':
      variantClass = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      break;
    case 'danger':
      variantClass = 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      break;
    case 'accent':
      customStyle = {
        backgroundColor: accent.bgLight,
        color: accent.primary,
        borderColor: accent.primary,
      };
      variantClass = 'border';
      break;
    case 'outline':
      variantClass = mode === 'WHITE'
        ? 'border border-slate-300 text-slate-600'
        : 'border border-zinc-700 text-zinc-300';
      break;
    case 'neutral':
    default:
      variantClass = mode === 'WHITE'
        ? 'bg-slate-100 text-slate-600 border border-slate-200'
        : 'bg-zinc-800 text-zinc-300 border border-zinc-750';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md tracking-tight uppercase whitespace-nowrap ${sizeClass} ${variantClass} ${className}`}
      style={customStyle}
    >
      {children}
    </span>
  );
};
