/**
 * GOATEST Daily Q/A Session Runner Modal
 * 
 * PMT-4: 10-Question interactive MCQ contextual assessment runner.
 * 
 * FEATURES:
 * - Dynamic 10-question pipeline
 * - Progress tracking & step indicator (Question X of 10)
 * - 4 MCQ options with instant selection feedback
 * - Contextual educational notes (non-diagnostic)
 * - Real-time persistence to Firestore qa_sessions collection
 * - Automatically triggers Day Report generation upon 10/10 completion + 3 tests
 */

import React, { useState, useEffect } from 'react';
import type { QaSessionRecord, QaQuestionItem } from '../../types';
import { dynamicQaService } from '../../services/dynamicQaService';
import {
  X,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Sparkles,
  Info,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';

export interface DailyQaRunnerModalProps {
  userId: string;
  dayId: string;
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete?: (qaRecord: QaSessionRecord) => void;
}

export const DailyQaRunnerModal: React.FC<DailyQaRunnerModalProps> = ({
  userId,
  dayId,
  isOpen,
  onClose,
  onSessionComplete,
}) => {
  const [qaSession, setQaSession] = useState<QaSessionRecord | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId && dayId) {
      loadSession();
    } else {
      setQaSession(null);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setCompletedSuccess(false);
      setLoadError(null);
    }
  }, [isOpen, userId, dayId]);

  const loadSession = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const session = await dynamicQaService.getOrCreateDailyQaSession({
        userId,
        dayId,
      });
      setQaSession(session);
      setSelectedAnswers(session.answers || {});

      // If already partially answered, jump to first unanswered
      const unansweredIdx = session.questions.findIndex(
        (q) => !session.answers || session.answers[q.questionId] === undefined
      );
      if (unansweredIdx >= 0) {
        setCurrentIndex(unansweredIdx);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI service is unavailable.';
      setLoadError(message);
      console.warn('[DailyQaRunnerModal] Q/A unavailable:', message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const questions: QaQuestionItem[] = qaSession?.questions || [];
  const totalQuestions = questions.length || 10;
  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? selectedAnswers[currentQ.questionId] : undefined;
  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPct = Math.round((answeredCount / totalQuestions) * 100);

  const handleSelectOption = async (option: string) => {
    if (!currentQ || !qaSession) return;

    const newAnswers = { ...selectedAnswers, [currentQ.questionId]: option };
    setSelectedAnswers(newAnswers);

    // Save progressively to Firestore
    try {
      await dynamicQaService.recordAnswer(
        qaSession.qaSessionId,
        userId,
        currentQ.questionId,
        option
      );
    } catch (err) {
      console.warn('[DailyQaRunner] Progress save warning:', err);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleFinishSubmit = async () => {
    if (!qaSession) return;
    setSubmitting(true);
    try {
      const updated = await dynamicQaService.submitFullQaSession(
        qaSession.qaSessionId,
        userId,
        selectedAnswers
      );
      setQaSession(updated);

      // C50 is the sole DAY report authority. HOME only submits Q/A; it does not
      // regenerate clinical interpretation locally.

      setCompletedSuccess(true);
      if (onSessionComplete) {
        onSessionComplete(updated);
      }
    } catch (err) {
      console.error('[DailyQaRunner] Final submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Daily Assessment Context
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Daily AI Q/A Session
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Initializing dynamic Q/A assessment pipeline...
              </span>
            </div>
          ) : completedSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Daily Q/A Session Completed!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm">
                All 10 contextual health markers have been securely stored. Your daily synthesis report is ready for aggregation.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">AI Q/A unavailable</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm">{loadError}</p>
              <button type="button" onClick={loadSession} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">Retry</button>
            </div>
          ) : currentQ ? (
            <div className="flex flex-col gap-4">
              {/* Question Tracker & Tag */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {currentQ.topic || currentQ.organ || 'Assessment Context'}
                </span>
              </div>

              {/* Question Text */}
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {currentQ.question}
              </h3>

              {/* MCQ Options */}
              <div className="flex flex-col gap-2.5 pt-1">
                {currentQ.options.map((option, oIdx) => {
                  const isSelected = currentAnswer === option;

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectOption(option)}
                      className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-indigo-100 font-semibold shadow-xs'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className="leading-relaxed">{option}</span>
                      <div
                        className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Feedback Note if selected */}
              {currentAnswer && currentQ.feedback && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 animate-in fade-in duration-200">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    {currentQ.feedback}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-8 text-center">
              No questions found for this session.
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        {!completedSuccess && !loadError && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {answeredCount}/{totalQuestions} Answered
            </span>

            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!currentAnswer}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishSubmit}
                disabled={answeredCount < totalQuestions || submitting}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Submit Q/A</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
