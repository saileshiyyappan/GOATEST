import React from 'react';
import { Bot, Sparkles, AlertCircle } from 'lucide-react';
import { CribGuidanceItem, CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribGuidanceProps {
  guidance: CribGuidanceItem[];
  mode: CribMode;
}

export const CribGuidance: React.FC<CribGuidanceProps> = ({ guidance, mode }) => {
  const theme = CRIB_THEMES[mode];
  const hasGuidance = guidance && guidance.length > 0;

  const getGuidanceBadgeStyle = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-600/30 text-red-200 border-red-500 animate-pulse';
      case 'warning':
        return 'bg-amber-600/30 text-amber-200 border-amber-500';
      default:
        return 'bg-blue-600/30 text-blue-200 border-blue-500';
    }
  };

  return (
    <div
      id="crib-guidance-area"
      aria-label="CRIB AI Emergency Directives"
      className="w-full pb-3 mb-3 border-b border-white/10"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className={`w-3.5 h-3.5 ${theme.accentColor}`} aria-hidden="true" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-neutral-300 font-mono">
          EMERGENCY DIRECTIVES / GUIDANCE KEYWORDS
        </span>
      </div>

      {hasGuidance ? (
        <div className="flex flex-wrap gap-2">
          {guidance.map((item) => (
            <div
              key={item.id}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs sm:text-sm font-extrabold tracking-wider uppercase flex items-center gap-1.5 shadow-sm ${getGuidanceBadgeStyle(
                item.level
              )}`}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-black/30 border border-dashed border-white/10 flex items-center justify-between text-neutral-400 font-mono text-xs">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-neutral-500" />
            <span className="tracking-wider uppercase text-neutral-300 font-semibold">
              WAITING FOR AI GUIDANCE
            </span>
          </div>
          <span className="text-[10px] text-neutral-500 uppercase">STANDBY FOR PROTOCOL DISPATCH</span>
        </div>
      )}
    </div>
  );
};
