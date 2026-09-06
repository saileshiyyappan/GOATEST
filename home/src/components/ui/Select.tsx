/**
 * GOATEST Universal Select Component
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  helperText,
  error,
  id,
  className = '',
  ...props
}) => {
  const generatedId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={generatedId}
          className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center w-full">
        <select
          id={generatedId}
          className={`w-full appearance-none bg-[var(--color-surface)] text-slate-900 dark:text-slate-100 border ${
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-slate-300 dark:border-slate-700 focus:border-[var(--color-accent)]'
          } rounded-xl px-4 py-2.5 pr-10 text-sm transition-all duration-150 outline-none ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[var(--color-surface)] text-slate-900 dark:text-slate-100">
              {opt.label}
            </option>
          ))}
        </select>

        <div className="absolute right-3.5 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error ? (
        <span className="text-xs text-red-500 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-500 dark:text-slate-400">{helperText}</span>
      ) : null}
    </div>
  );
};
