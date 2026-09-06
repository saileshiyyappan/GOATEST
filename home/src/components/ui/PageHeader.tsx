/**
 * GOATEST Page Header & Section Header
 */

import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-start justify-between gap-3 mb-4 text-left ${className}`}>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-white">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-[#cfd8dc] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export interface SectionHeaderProps {
  title: string;
  titleClassName?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  titleClassName = 'text-white',
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between gap-2 mb-2 text-left ${className}`}>
      <div className="flex items-center justify-between w-full">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-bold uppercase tracking-wider ${titleClassName}`}>
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] text-[#cfd8dc] mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
};
