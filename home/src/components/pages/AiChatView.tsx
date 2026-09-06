/**
 * GOATEST AI Assistant View
 * 
 * Conversational Health Assistant:
 * - Real server-side universal AI message pipeline (/api/ai/chat)
 * - Message history with user & assistant bubbles
 * - "Generating response..." loading states
 * - Clean error recovery and Clear Conversation action
 * - Health safety guardrails and medical guidance disclaimers
 * - Gated Q/A Session pipeline (requires 3 completed tests)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../ui/PageHeader';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  Send,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Layers,
  RotateCcw,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { aiService, type ChatMessage } from '../../services/aiService';
import { qaService, REQUIRED_COMPLETED_TESTS, type QaEligibilityResult } from '../../services/qaService';
import type { NavigationTab } from '../../types';

export interface AiChatViewProps {
  onNavigate?: (tab: NavigationTab) => void;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'assistant',
  text: 'Hello! I am your GOATEST AI health assistant. I can help explain health concepts, baseline metrics, physiological tests, and wellness principles. How can I help you today?',
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export const AiChatView: React.FC<AiChatViewProps> = ({ onNavigate }) => {
  const { currentUser, userProfile } = useAuth();
  const userId = currentUser?.uid || userProfile?.uid || '';

  const [activeMode, setActiveMode] = useState<'general' | 'qa'>('general');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isSending]);

  // Q/A Eligibility State
  const [isCheckingQa, setIsCheckingQa] = useState<boolean>(true);
  const [qaEligibility, setQaEligibility] = useState<QaEligibilityResult>({
    isEligible: false,
    completedCount: 0,
    requiredCount: REQUIRED_COMPLETED_TESTS,
    remainingCount: REQUIRED_COMPLETED_TESTS,
    completedSessions: [],
  });

  useEffect(() => {
    let isMounted = true;
    async function loadEligibility() {
      setIsCheckingQa(true);
      try {
        const res = await qaService.checkEligibility(userId);
        if (isMounted) {
          setQaEligibility(res);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) {
          setIsCheckingQa(false);
        }
      }
    }
    loadEligibility();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const executeSend = async (textToSend: string, currentLog: ChatMessage[]) => {
    setIsSending(true);
    setChatError(null);

    try {
      const replyText = await aiService.sendMessage(textToSend, currentLog);
      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatLog((prev) => [...prev, assistantMsg]);
      setLastFailedText(null);
      setChatError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to AI assistant.';
      setChatError(msg);
      setLastFailedText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputMessage.trim();
    if (!textToSend || isSending) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedLog = [...chatLog, userMsg];
    setChatLog(updatedLog);
    setInputMessage('');

    await executeSend(textToSend, updatedLog);
  };

  const handleRetry = async () => {
    if (!lastFailedText || isSending) return;
    await executeSend(lastFailedText, chatLog);
  };

  const handleClearChat = () => {
    setChatLog([
      {
        id: `welcome_${Date.now()}`,
        sender: 'assistant',
        text: 'Conversation reset. How else can I assist you with your health and physiological metrics?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatError(null);
    setLastFailedText(null);
  };

  return (
    <div className="flex flex-col h-full text-left pb-2">
      <PageHeader
        title="AI ASSISTANT"
        subtitle="Evidence-based health assistant"
        action={
          activeMode === 'general' && chatLog.length > 1 ? (
            <button
              type="button"
              onClick={handleClearChat}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          ) : undefined
        }
      />

      {/* Mode Switch: General Chat | Q/A Session */}
      <div className="shrink-0 mb-3 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 grid grid-cols-2 gap-1 select-none">
        <button
          type="button"
          onClick={() => setActiveMode('general')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeMode === 'general'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>General Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('qa')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeMode === 'qa'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>Q/A Session</span>
          {!qaEligibility.isEligible && (
            <Lock className="w-3 h-3 text-slate-400 dark:text-zinc-500 ml-0.5" />
          )}
        </button>
      </div>

      {/* VIEW 1: General Chat */}
      {activeMode === 'general' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Messages Container */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 mb-2.5 min-h-0 shadow-inner">
            {chatLog.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[88%] ${
                  msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-fg)] rounded-br-none shadow-xs font-medium'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 rounded-bl-none border border-slate-200/50 dark:border-zinc-700/50'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-1 px-1">
                  {msg.time}
                </span>
              </div>
            ))}

            {/* Generating response indicator */}
            {isSending && (
              <div className="self-start flex flex-col items-start max-w-[88%]">
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-bl-none flex items-center gap-2 text-xs border border-slate-200/50 dark:border-zinc-700/50">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
                  <span className="italic">Generating response...</span>
                </div>
              </div>
            )}

            {/* Error banner */}
            {chatError && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-2 shadow-xs">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block text-slate-900 dark:text-zinc-100">AI Service Notification</span>
                    <span className="text-slate-600 dark:text-zinc-300 leading-relaxed">{chatError}</span>
                  </div>
                </div>
                {lastFailedText && (
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isSending}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-fg)] hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Retry sending message"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry Request</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Health Safety Disclaimer */}
          <div className="flex items-center gap-1.5 px-2 mb-2 text-[10px] text-slate-400 dark:text-zinc-500">
            <ShieldAlert className="w-3 h-3 shrink-0 text-slate-400 dark:text-zinc-500" />
            <span className="truncate">
              For general health education. Not a substitute for clinical medical diagnosis.
            </span>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="flex items-center gap-2 shrink-0">
            <Input
              placeholder="Ask about vitals, physiological trends..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isSending}
              className="text-xs flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!inputMessage.trim() || isSending}
              isLoading={isSending}
              className="shrink-0 px-4 h-10"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}

      {/* VIEW 2: Q/A Session */}
      {activeMode === 'qa' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {isCheckingQa ? (
            <Card padding="lg" className="flex flex-col items-center justify-center text-center py-10 my-auto">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin mb-3" />
              <p className="text-xs text-slate-500 dark:text-zinc-400">Verifying test completion status...</p>
            </Card>
          ) : !qaEligibility.isEligible ? (
            /* Locked State when < 3 tests completed */
            <Card padding="lg" className="flex flex-col items-center text-center gap-3.5 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Q/A Session Locked
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 max-w-xs">
                  Complete all 3 required tests to start Q/A Session.
                </p>
              </div>

              {/* Progress Tracker */}
              <div className="w-full max-w-xs p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-zinc-400">Test Verification</span>
                  <span className="text-slate-900 dark:text-white font-mono">
                    {qaEligibility.completedCount} / {REQUIRED_COMPLETED_TESTS} Completed
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[var(--color-accent)] h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${(qaEligibility.completedCount / REQUIRED_COMPLETED_TESTS) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {onNavigate && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate('test')}
                  className="text-xs mt-1"
                >
                  Go to Test Pipeline
                </Button>
              )}
            </Card>
          ) : (
            /* Eligible State: 3 Completed Tests Verified */
            <div className="flex flex-col gap-3.5">
              <Card padding="md" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[var(--color-accent)]" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Q/A Physiological Pipeline
                    </span>
                  </div>
                  <Badge variant="verified" size="sm">
                    {qaEligibility.completedCount}/3 Tests Verified
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Test requirements satisfied. Pipeline standby for reasoning model integration.
                </p>

                {/* Stored Real Test Records Summary */}
                <div className="border-t border-slate-100 dark:border-zinc-800 pt-2.5 flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Collected Test Records
                  </span>
                  {qaEligibility.completedSessions.slice(0, 3).map((session, index) => (
                    <div
                      key={session.id || index}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-medium text-slate-800 dark:text-zinc-200">
                          {session.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="md" className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200">
                  <AlertCircle className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Pipeline Architecture Contract</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Real physiological and Q/A reasoning engine will be connected via the backend controller when the model module is deployed. No synthetic predictions or fabricated conclusions are generated.
                </p>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
