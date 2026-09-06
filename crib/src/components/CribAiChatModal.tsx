import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, ShieldAlert, Sparkles, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { CribAiMessage, CribGuidanceItem, CribMode } from '../types/crib';
import { CRIB_THEMES } from '../themes/cribThemes';

interface CribAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: CribAiMessage[];
  guidance: CribGuidanceItem[];
  mode: CribMode;
  isLoading?: boolean;
  error?: string | null;
  onSendMessage: (text: string) => Promise<void> | void;
}

export const CribAiChatModal: React.FC<CribAiChatModalProps> = ({
  isOpen,
  onClose,
  messages,
  guidance,
  mode,
  isLoading = false,
  error = null,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = CRIB_THEMES[mode];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages, isOpen, isLoading]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;
    setInputText('');
    await onSendMessage(trimmed);
  };

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

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
      id="crib-ai-chat-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-chat-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-2xl h-[88dvh] max-h-[88dvh] flex flex-col rounded-2xl border ${theme.panelBorder} bg-neutral-950 shadow-2xl overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className={`w-5 h-5 ${theme.accentColor}`} />
            <div>
              <div className="flex items-center gap-2">
                <h3 id="ai-chat-modal-title" className="text-sm font-black tracking-wider uppercase text-white">
                  EMERGENCY AI CHAT & COPILOT
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-red-600/30 border border-red-500/40 text-red-300 font-mono text-[9px] font-bold uppercase">
                  {mode} MODE
                </span>
              </div>
              <p className="text-[10px] font-mono text-neutral-400">
                REAL-TIME CLINICAL DECISION SUPPORT & DIRECTIVES
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Chat"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Guidance Directive Highlights */}
        {guidance && guidance.length > 0 && (
          <div className="px-4 py-2.5 bg-black/40 border-b border-white/10 shrink-0">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-red-400" />
              <span>ACTIVE DIRECTIVES:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {guidance.map((item) => (
                <div
                  key={item.id}
                  className={`px-2.5 py-1 rounded-md border font-mono text-[11px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-sm ${getGuidanceBadgeStyle(
                    item.level
                  )}`}
                >
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error notification banner if API failed */}
        {error && (
          <div
            id="crib-ai-error-banner"
            className="px-4 py-2 bg-amber-950/70 border-b border-amber-500/30 flex items-center gap-2 text-xs font-mono text-amber-200 shrink-0"
          >
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Chat Timeline */}
        <div
          id="crib-ai-modal-messages-list"
          className="flex-1 overflow-y-auto p-4 space-y-3 font-mono"
        >
          {messages.length > 0 ? (
            messages.map((msg) => {
              const isAi = msg.role === 'ai';
              const isSystem = msg.role === 'system';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isAi ? 'items-start' : isSystem ? 'items-center' : 'items-end'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-1 px-1">
                    {isAi ? (
                      <>
                        <Bot className="w-3 h-3 text-red-400" />
                        <span className="font-semibold text-neutral-300">CRIB AI ASSISTANT</span>
                      </>
                    ) : isSystem ? (
                      <>
                        <ShieldAlert className="w-3 h-3 text-amber-400" />
                        <span className="font-semibold text-amber-300">SYSTEM DISPATCH</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-neutral-300" />
                        <span className="font-semibold text-neutral-300">RESPONDER / USER</span>
                      </>
                    )}
                    <span className="text-[9px] text-neutral-500 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-sans tracking-wide shadow-md leading-relaxed ${
                      isAi
                        ? 'bg-neutral-900 border border-red-500/30 text-neutral-100 rounded-tl-none'
                        : isSystem
                        ? 'bg-amber-950/40 border border-amber-500/40 text-amber-100 text-center font-mono'
                        : 'bg-red-600 text-white rounded-tr-none font-medium'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500">
              <Bot className="w-8 h-8 text-neutral-600 mb-2" />
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                AI COPILOT STANDBY
              </p>
              <p className="text-[11px] text-neutral-600 mt-1 max-w-xs">
                Emergency AI agent analyzes physiological data and responder inputs to assist in real-time.
              </p>
            </div>
          )}

          {/* Loading bubble */}
          {isLoading && (
            <div className="flex flex-col items-start animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-1 px-1">
                <Bot className="w-3 h-3 text-red-400" />
                <span className="font-semibold text-neutral-300">CRIB AI ASSISTANT</span>
              </div>
              <div className="bg-neutral-900 border border-red-500/30 text-neutral-300 rounded-xl rounded-tl-none px-3.5 py-2.5 text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                <span className="font-mono text-[11px] font-semibold text-neutral-300">
                  AI THINKING...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-3 border-t border-white/10 bg-neutral-900/90 flex items-center gap-2 shrink-0"
        >
          <input
            id="crib-ai-modal-input"
            ref={inputRef}
            type="text"
            value={inputText}
            disabled={isLoading}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isLoading ? 'AI is processing response...' : 'Type message to CRIB AI Assistant...'}
            aria-label="Message to CRIB AI Assistant"
            className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent font-sans disabled:opacity-50"
          />
          <button
            id="crib-ai-modal-send-btn"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            aria-label="Send message"
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
