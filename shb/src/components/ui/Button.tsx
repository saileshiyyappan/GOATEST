import React, { ButtonHTMLAttributes } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const { mode, accent } = useTheme();

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-lg',
    md: 'px-4 py-2 text-sm font-semibold rounded-xl',
    lg: 'px-5 py-2.5 text-base font-semibold rounded-xl',
  }[size];

  let variantStyle: string = '';

  if (variant === 'accent') {
    variantStyle = 'text-white shadow-sm';
  } else if (variant === 'primary') {
    if (mode === 'DEFAULT') {
      variantStyle = 'bg-white text-zinc-950 hover:bg-zinc-100 font-semibold shadow-sm';
    } else if (mode === 'WHITE') {
      variantStyle = 'bg-zinc-900 text-white hover:bg-zinc-800 font-semibold shadow-sm';
    } else {
      // DARK
      variantStyle = 'bg-zinc-100 text-zinc-950 hover:bg-white font-semibold shadow-sm';
    }
  } else if (variant === 'secondary') {
    if (mode === 'WHITE') {
      variantStyle = 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200';
    } else if (mode === 'DARK') {
      variantStyle = 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700';
    } else {
      variantStyle = 'bg-zinc-800/90 text-zinc-100 hover:bg-zinc-750 border border-zinc-700/60';
    }
  } else if (variant === 'outline') {
    if (mode === 'WHITE') {
      variantStyle = 'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50';
    } else {
      variantStyle = 'bg-transparent text-zinc-300 border border-zinc-700 hover:bg-zinc-800/50';
    }
  } else if (variant === 'ghost') {
    if (mode === 'WHITE') {
      variantStyle = 'bg-transparent text-slate-600 hover:bg-slate-100';
    } else {
      variantStyle = 'bg-transparent text-zinc-400 hover:bg-zinc-800 text-zinc-200';
    }
  } else if (variant === 'danger') {
    variantStyle = 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm';
  }

  const customAccentStyle = variant === 'accent' ? {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  } : undefined;

  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ${sizeClasses} ${variantStyle} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={customAccentStyle}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
