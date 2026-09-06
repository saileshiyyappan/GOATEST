/**
 * GOATEST Universal Brand Logo Component
 * Part 3: Visually distinguishes "TEST" from "GOA" in "GOATEST".
 */

import React from 'react';
import logoUrl from '../../assets/goatest-logo.png';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtext?: boolean;
  subtext?: string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtext = false,
  subtext = 'HEALTH MONITORING',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-sm tracking-wider',
    md: 'text-lg tracking-widest',
    lg: 'text-2xl tracking-widest',
    xl: 'text-3xl tracking-widest',
  };

  const subtextSizes = {
    sm: 'text-[8px] tracking-wider',
    md: 'text-[9px] tracking-widest',
    lg: 'text-[10px] tracking-widest',
    xl: 'text-[11px] tracking-widest',
  };

  const logoSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11 sm:w-12 sm:h-12',
    lg: 'w-14 h-14',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img src={logoUrl} alt="" aria-hidden="true" className={`${logoSizes[size]} rounded-md object-contain shrink-0`} />
      <div className="flex flex-col">
        <div className={`font-mono leading-none ${sizeClasses[size]}`}>
          <span className="font-semibold text-[var(--color-text-main)] opacity-90">GOA</span>
          <span className="font-black text-[var(--color-accent)]">TEST</span>
        </div>
        {showSubtext && (
          <span className={`text-[var(--color-text-sub)] font-medium mt-1 uppercase ${subtextSizes[size]}`}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};
