/**
 * GOATEST Universal Input Component
 */

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  id,
  type,
  className = '',
  ...props
}, ref) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = type === 'password';
  const generatedId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={generatedId}
          className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3.5 text-zinc-500 pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={generatedId}
          type={isPassword ? (isPasswordVisible ? 'text' : 'password') : type}
          className={`w-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
              : 'border-zinc-300 dark:border-zinc-700 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'
          } rounded-xl px-4 py-2.5 text-sm transition-all duration-150 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 ${
            leftIcon ? 'pl-10' : ''
          } ${rightIcon || isPassword ? 'pr-12' : ''} ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 text-zinc-500 flex items-center">
            {rightIcon}
          </div>
        )}
        {isPassword && (
          <button type="button" onClick={() => setIsPasswordVisible((visible) => !visible)} aria-label={isPasswordVisible ? 'Hide password' : 'Show password'} className="absolute right-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
            {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {error ? (
        <span className="text-xs text-red-500 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</span>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
