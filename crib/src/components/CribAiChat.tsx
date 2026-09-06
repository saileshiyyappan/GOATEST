import React from 'react';
import { MessageSquare, Sparkles, AlertCircle, Bot, Loader2 } from 'lucide-react';
import { CribAiMessage, CribGuidanceItem, CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribAiChatProps {
  messages: CribAiMessage[];
  guidance: CribGuidanceItem[];
  mode: CribMode;
  isLoading?: boolean;
  onOpenChat: () => void;
}

export const CribAiChat: React.FC<CribAiChatProps> = ({
  messages,
  guidance,
  mode,
  isLoading = false,
  onOpenChat,
}) => {
  const theme = CRIB_THEMES[mode];
  const hasGuidance = guidance && guidance.length > 0;
  const primaryGuidance = hasGuidance ? guidance[0] : null;
  const messageCount = messages.length;

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
    <section
      id="crib-ai-chat-banner"
      aria-label="CRIB AI Guidance and Directives"
      className={`w-full min-h-[44px] rounded-xl border ${theme.panelBorder} ${theme.panelBg} px-3 py-2 sm:py-2.5 flex items-center justify-between gap-2 shadow-md shrink-0 select-none`}
    >
      {/* Left: AI Directive / Real-time Status */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Sparkles className={`w-4 h-4 ${theme.accentColor} shrink-0`} />
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-neutral-300 font-mono text-[11px] animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
            <span className="font-bold uppercase tracking-wider text-amber-300">
              AI ANALYZING VITALS...
            </span>
          </div>
        ) : primaryGuidance ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className={`px-2.5 py-1 rounded border font-mono text-[10px] sm:text-xs font-bold uppercase truncate flex items-center gap-1.5 shadow-sm ${getGuidanceBadgeStyle(
                primaryGuidance.level
              )}`}
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{primaryGuidance.text}</span>
            </div>
            {guidance.length > 1 && (
              <span className="text-[10px] font-mono text-neutral-400 shrink-0 hidden sm:inline">
                +{guidance.length - 1} MORE DIRECTIVES
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 text-neutral-400 font-mono text-[11px]">
            <Bot className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="truncate uppercase text-neutral-300 font-semibold">
              AI COPILOT ACTIVE &bull; MONITORING STREAM
            </span>
          </div>
        )}
      </div>

      {/* Right: Open Full Chat Button */}
      <button
        id="crib-open-chat-btn"
        type="button"
        onClick={onOpenChat}
        aria-label={`Open AI Copilot Chat (${messageCount} messages)`}
        className="px-3 py-1.5 rounded-lg bg-red-600/25 hover:bg-red-600/40 border border-red-500/50 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 focus:outline-none focus:ring-1 focus:ring-red-400 active:scale-95 shadow-sm"
      >
        <MessageSquare className="w-3.5 h-3.5 text-red-400" />
        <span>CHAT</span>
        {messageCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white leading-none">
            {messageCount}
          </span>
        )}
      </button>
    </section>
  );
};
