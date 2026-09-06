import React, { useState, useEffect, useRef } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useShbTheme } from '../theme/shbTheme';
import { OrganCategory, ShbSessionPhase } from '../types/shb';
import { ShbHeader } from '../components/shb/ShbHeader';
import { OrganSelector, ORGAN_CATEGORIES } from '../components/shb/OrganSelector';
import { BleStatusCard } from '../components/shb/BleStatusCard';
import { BFitStatusCard } from '../components/shb/BFitStatusCard';
import { SensorStatusCard } from '../components/shb/SensorStatusCard';
import { DirectVitals } from '../components/shb/DirectVitals';
import { IndirectVitals } from '../components/shb/IndirectVitals';
import { ContextVariables } from '../components/shb/ContextVariables';
import { CompareLoadingView } from '../components/shb/CompareLoadingView';
import type { ConditionPipelineOutput } from '../../../c50/src/services/condition/conditionPipeline';
import { ConditionAnalysisView } from '../components/condition/ConditionAnalysisView';
import { MinimalReportView } from '../components/report/MinimalReportView';
import { useLiveVitals } from '../hooks/useLiveVitals';
import {
  shbSessionCache,
  validateShbVitalsLock,
  ShbCompletedSessionCache,
} from '../services/vitals/shbSessionCache';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { AlertTriangle, RefreshCw, XCircle, Play, Square, Vibrate } from 'lucide-react';

export interface ShbTestPageProps {
  onExitToHome: () => void;
  onProceedToCondition: (output: ConditionPipelineOutput) => void;
  homePhb?: any | null;
  homeUid?: string | null;
}

export const ShbTestPage: React.FC<ShbTestPageProps> = ({ onExitToHome, onProceedToCondition, homePhb, homeUid }) => {
  const { status: bleStatus } = useDevice();
  const { shb_color, accent } = useShbTheme();

  // Session phase: ORGAN_SELECTION is strictly the first screen
  const [phase, setPhase] = useState<ShbSessionPhase>('ORGAN_SELECTION');
  // OVERALL is the default first selection
  const [selectedOrgan, setSelectedOrgan] = useState<OrganCategory | null>(ORGAN_CATEGORIES[0]);

  // Modals and failure feedback state
  const [showFailedLockModal, setShowFailedLockModal] = useState<boolean>(false);
  const [missingVitals, setMissingVitals] = useState<string[]>([]);

  // Guard against race conditions and double navigation
  const hasCompletedTransitionRef = useRef<boolean>(false);
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hook for live physiological calculations & telemetry
  const {
    vitalsState,
    startAcquisition,
    pauseAcquisition,
    resumeAcquisition,
    stopAcquisition,
    resetVitals,
    getFinalResult,
    isBleConnected,
  } = useLiveVitals(selectedOrgan?.id);

  // When entering LIVE_SHB for a fresh session, start acquisition automatically
  useEffect(() => {
    if (phase === 'LIVE_SHB') {
      // Only start if not already LOCKED or running
      if (vitalsState.engineStatus === 'IDLE') {
        startAcquisition();
      }
    } else if (phase === 'ORGAN_SELECTION') {
      stopAcquisition();
    }
  }, [phase, vitalsState.engineStatus, startAcquisition, stopAcquisition]);

  // 65s Completion & Lock Validation Pipeline
  useEffect(() => {
    if (phase === 'LIVE_SHB' && vitalsState.engineStatus === 'LOCKED') {
      // Guard against double execution or repeat transitions when returning from Compare
      if (hasCompletedTransitionRef.current) return;
      hasCompletedTransitionRef.current = true;

      const organId = selectedOrgan?.id || 'OVERALL';
      const validation = validateShbVitalsLock(vitalsState, organId);

      if (validation.isValid) {
        // SUCCESS PATH: Store completed session result in backend/session cache
        const finalResult = getFinalResult();
        const context = finalResult?.contextVariables;
        if (!context || Object.values(context).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
          setMissingVitals(['Context variables are incomplete']);
          setShowFailedLockModal(true);
          return;
        }
        const sessionResult: ShbCompletedSessionCache = {
          sessionId: getFinalResult()?.sessionId || `shb_${Date.now().toString(36)}`,
          targetOrgan: organId,
          acquisitionDuration: vitalsState.elapsedSeconds,
          completedAt: Date.now(),
          directVitals: vitalsState.directVitals,
          indirectVitals: vitalsState.indirectVitals,
          lockedDirectVitals: {
            heartRate: (vitalsState.directVitals.hr?.lockedValue ?? null) as number | null,
            spo2: (vitalsState.directVitals.spo2?.lockedValue ?? null) as number | null,
            ppi: (vitalsState.directVitals.ppi?.lockedValue ?? null) as number | null,
            hr: (vitalsState.directVitals.hr?.lockedValue ?? null) as number | null,
          },
          lockedIndirectVitals: {
            rmssd: (vitalsState.indirectVitals.rmssd?.lockedValue ?? vitalsState.indirectVitals.rmssd?.value ?? null) as number | null,
            sdnn: (vitalsState.indirectVitals.sdnn?.lockedValue ?? vitalsState.indirectVitals.sdnn?.value ?? null) as number | null,
            rr: (vitalsState.indirectVitals.rr?.lockedValue ?? vitalsState.indirectVitals.rr?.value ?? null) as number | null,
            respiratoryRate: (vitalsState.indirectVitals.rr?.lockedValue ?? vitalsState.indirectVitals.rr?.value ?? null) as number | null,
          },
          lockedContextVariables: {
            activityIntensity: context.activityIntensity,
            ambientTemperature: context.ambientTemperature,
            relativeHumidity: context.relativeHumidity,
            atmosphericPressure: context.atmosphericPressure,
            altitude: context.altitude,
          },
          bfit: vitalsState.bfit,
          sessionStatus: 'COMPLETED',
          finalResultPacket: finalResult,
          lockedVitals: vitalsState.lockedVitals,
        };
        shbSessionCache.setSession(sessionResult);

        // 3-second automatic transition to existing Compare Loading page
        completionTimerRef.current = setTimeout(() => {
          setPhase('COMPARE_LOADING');
        }, 3000);
      } else {
        // FAILED PATH: Lock validation failed - do not navigate, do not create Compare-ready cache
        setMissingVitals(validation.missingVitals);
        setShowFailedLockModal(true);
      }
    }
  }, [phase, vitalsState, selectedOrgan, getFinalResult]);

  // Clean up any pending transition timer on unmount
  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  // Phase transitions
  const handleProceedFromOrganSelect = () => {
    if (selectedOrgan) {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      hasCompletedTransitionRef.current = false;
      shbSessionCache.clear();
      resetVitals(selectedOrgan.id);
      setPhase('LIVE_SHB');
    }
  };

  // Compare Loading Back returns to previous LIVE_SHB assessment screen without restarting
  const handleBackFromCompare = () => {
    setPhase('LIVE_SHB');
  };

  // Normal exit back to Organ Selection
  const handleBackToOrganSelect = () => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    hasCompletedTransitionRef.current = false;
    shbSessionCache.clear();
    resetVitals(selectedOrgan?.id || 'OVERALL');
    setPhase('ORGAN_SELECTION');
  };

  // Retake test on failed lock validation
  const handleRetakeTest = () => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    setShowFailedLockModal(false);
    setMissingVitals([]);
    hasCompletedTransitionRef.current = false;
    shbSessionCache.clear();
    resetVitals(selectedOrgan?.id || 'OVERALL');
    startAcquisition();
  };

  // Exit fully on failed lock validation
  const handleExitFullyFromFailed = () => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    setShowFailedLockModal(false);
    setMissingVitals([]);
    hasCompletedTransitionRef.current = false;
    shbSessionCache.clear();
    resetVitals(selectedOrgan?.id || 'OVERALL');
    setPhase('ORGAN_SELECTION');
  };

  const engineStatus = vitalsState.engineStatus;
  const isAcquiring = engineStatus === 'ACQUIRING';
  const isLocked = engineStatus === 'LOCKED';
  const isPaused = engineStatus === 'PAUSED' || engineStatus === 'PAUSED_BY_SHAKE';
  const isTerminated = engineStatus === 'TERMINATED_INTERFERENCE' || engineStatus === 'TERMINATED_BY_SHAKE';
  const elapsed = vitalsState.elapsedSeconds;
  const targetDuration = vitalsState.targetDurationSeconds;
  const progressPercent = Math.min(100, Math.round((elapsed / targetDuration) * 100));

  const isSessionLocked = isLocked;
  const lockedCount = vitalsState.lockedVitals?.lockedCount ?? 0;
  const isLockComplete = vitalsState.lockedVitals?.lockComplete === true && lockedCount === 11;
  const isCompareReady = isSessionLocked && !showFailedLockModal && shbSessionCache.hasSession();
  const isNextEnabled = isCompareReady;

  const handleNext = () => {
    if (isNextEnabled) {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
      setPhase('COMPARE_LOADING');
    }
  };

  const getStatusBadgeText = () => {
    switch (engineStatus) {
      case 'ACQUIRING':
        return `ACQUIRING (${elapsed}s / ${targetDuration}s)`;
      case 'LOCKED':
        return `${lockedCount} / 11 LOCKED`;
      case 'PAUSED':
        return `PAUSED (${elapsed}s)`;
      case 'PAUSED_BY_SHAKE':
        return `PAUSED (SHAKE 1/2 · ${elapsed}s)`;
      case 'TERMINATED_BY_SHAKE':
        return 'TERMINATED (SHAKE 2/2)';
      case 'TERMINATED_INTERFERENCE':
        return 'TERMINATED (INTERFERENCE)';
      case 'ABORTED':
        return 'LOCK INCOMPLETE (65s LIMIT)';
      default:
        return 'READY';
    }
  };

  return (
    <div
      className="flex flex-1 flex-col w-full max-w-md mx-auto min-h-0 max-h-full overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: shb_color.background,
        color: shb_color.textPrimary,
      }}
    >
      {/* For Phase 1 & 2, show the minimalist SHB Header with top-left Back button */}
      {(phase === 'ORGAN_SELECTION' || phase === 'LIVE_SHB') && (
        <ShbHeader
          phase={phase}
          selectedOrgan={selectedOrgan}
          onExit={onExitToHome}
          onBackToOrganSelect={phase === 'LIVE_SHB' ? handleBackToOrganSelect : undefined}
          onNext={handleNext}
          isNextEnabled={isNextEnabled}
          lockedCount={lockedCount}
        />
      )}

      <div
        className="flex-1 px-4 py-2 w-full max-w-md mx-auto overflow-y-auto overflow-x-hidden min-h-0"
        style={{ backgroundColor: '#100e0e' }}
      >
        {/* Phase 1: Organ Selection Screen (First SHB Screen) */}
        {phase === 'ORGAN_SELECTION' && (
          <OrganSelector
            selectedOrgan={selectedOrgan}
            onSelectOrgan={setSelectedOrgan}
            onProceed={handleProceedFromOrganSelect}
          />
        )}

        {/* Phase 2: LIVE SHB Medical Monitoring Workspace */}
        {phase === 'LIVE_SHB' && (
          <div className="space-y-2.5 pb-20 w-full overflow-x-hidden">
            {/* 1. Live Target Assessment & Session Timer Banner */}
            <div
              className="rounded-xl p-2.5 transition-colors w-full"
              style={{
                backgroundColor: shb_color.card,
                border: `1px solid ${shb_color.cardBorder}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2"
                  style={{
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    paddingRight: '12px',
                    marginLeft: '0px',
                    marginTop: '8px',
                    marginBottom: '0px',
                    marginRight: '-60px',
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: isLocked
                        ? '#8b5cf6'
                        : isAcquiring
                        ? '#10b981'
                        : isTerminated
                        ? '#ef4444'
                        : shb_color.textMuted,
                      boxShadow: isAcquiring ? '0 0 8px rgba(16, 185, 129, 0.6)' : undefined,
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-tight" style={{ color: shb_color.textPrimary }}>
                        {selectedOrgan?.name}
                      </span>
                      <span className="text-[10px] font-mono opacity-70" style={{ color: shb_color.textSecondary }}>
                        ASSESSMENT
                      </span>
                    </div>
                  </div>
                </div>

                {/* Running Status Badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="flex items-center justify-center px-2 py-1 rounded-md relative"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse relative"
                      style={{
                        boxShadow: '0 0 8px #10b981',
                      }}
                    />
                  </span>
                </div>
              </div>

              {/* Acquisition Progress Bar */}
              <div className="mt-2 pt-1.5 flex items-center gap-2" style={{ borderTop: `1px solid ${shb_color.panelBorder}` }}>
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: shb_color.panel }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: isLocked
                        ? '#8b5cf6'
                        : isAcquiring
                        ? '#10b981'
                        : isTerminated
                        ? '#ef4444'
                        : shb_color.textMuted,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: shb_color.textMuted }}>
                  {elapsed}s / {targetDuration}s
                </span>
              </div>
            </div>

            {/* Shake Warning Alert if Paused */}
            {engineStatus === 'PAUSED_BY_SHAKE' && (
              <div className="p-3 rounded-2xl flex items-start gap-2.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">Test Paused: Shake Event 1 of 2</p>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      PAUSED
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Unusual movement detected. The assessment is temporarily paused.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={resumeAcquisition}
                      className="text-xs inline-flex items-center gap-1 py-1 px-2.5"
                      style={{ backgroundColor: accent.primary, color: '#ffffff' }}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Resume Test</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBackToOrganSelect}
                      className="text-xs inline-flex items-center gap-1 py-1 px-2.5"
                    >
                      <Square className="w-3 h-3" />
                      <span>End Test</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Termination Warning Alert if Terminated */}
            {isTerminated && (
              <div
                className="p-3 rounded-2xl flex items-start gap-2.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {engineStatus === 'TERMINATED_BY_SHAKE'
                      ? 'Acquisition Terminated: Repeated Movement (Shake 2/2)'
                      : 'Acquisition Terminated: 2/2 Interference Events'}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {engineStatus === 'TERMINATED_BY_SHAKE'
                      ? 'The SHB assessment has been stopped for measurement integrity. Return to organ select to start a clean acquisition.'
                      : 'Signal noise threshold exceeded twice during the window. Return to organ select to start a clean acquisition.'}
                  </p>
                </div>
              </div>
            )}

            {/* 2. Compact BLE Card with STREAMING / CONNECTED distinctions */}
            <BleStatusCard compact />

            {/* 3. Signal Quality Validator Card */}
            <BFitStatusCard bfitState={vitalsState.bfit} />

            {/* 4. Active Telemetry Modules Grid (PPG, MPU, ENV: BMP180) */}
            <SensorStatusCard
              sensors={vitalsState.sensors}
              bleConnected={isBleConnected}
            />

            {/* 5. Direct Vitals (DV) Section with Live & Locked Columns */}
            <DirectVitals
              vitals={vitalsState.directVitals}
              organId={selectedOrgan?.id}
              isAcquiring={isAcquiring}
            />

            {/* 6. Indirect Vitals (IV) Section with Live Derived & Locked Columns */}
            <IndirectVitals
              vitals={vitalsState.indirectVitals}
              organId={selectedOrgan?.id}
              isAcquiring={isAcquiring}
            />

            {/* 7. Context Variables (CX) Section with Live & Locked Columns */}
            <ContextVariables
              contextVariables={vitalsState.contextVariables}
              lockedContextVariables={getFinalResult()?.contextVariables}
              organId={selectedOrgan?.id}
              isAcquiring={isAcquiring}
              isLocked={isLocked}
            />
          </div>
        )}

        {/* Phase 3: Minimal COMPARING Boundary (Back button returns to LIVE_SHB) */}
        {phase === 'COMPARE_LOADING' && (
          <CompareLoadingView
            onBack={handleBackFromCompare}
            onProceedToCondition={onProceedToCondition}
            homePhb={homePhb}
            homeUid={homeUid}
            initialOrgan={selectedOrgan?.id}
          />
        )}

        {/* Phase 4: Condition Analysis Pipeline */}
        {phase === 'CONDITION_ANALYSIS' && (
          <ConditionAnalysisView
            onBack={() => setPhase('COMPARE_LOADING')}
            onProceedToReport={() => setPhase('REPORT')}
          />
        )}

        {/* Phase 5: Minimal Assessment Report */}
        {phase === 'REPORT' && (
          <MinimalReportView
            onNewAssessment={handleBackToOrganSelect}
            onExitToHome={onExitToHome}
          />
        )}
      </div>

      {/* Shake Event 1: Pause Modal */}
      <Modal
        isOpen={engineStatus === 'PAUSED_BY_SHAKE'}
        onClose={() => {}}
        title="TEST PAUSED"
      >
        <div className="space-y-4 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">
              Unusual movement detected.
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
              SHAKE EVENT 1 OF 2
            </span>
          </div>

          <div className="flex items-start gap-2.5 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-200">
            <Vibrate className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <p className="text-xs leading-relaxed">
              The assessment has been temporarily paused. Please stabilize your arm and sensor contact before resuming.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToOrganSelect}
              className="text-xs inline-flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End Test</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={resumeAcquisition}
              className="text-xs inline-flex items-center gap-1.5"
              style={{
                backgroundColor: accent.primary,
                color: '#ffffff',
              }}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Test</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Shake Event 2: Terminated Modal */}
      <Modal
        isOpen={engineStatus === 'TERMINATED_BY_SHAKE'}
        onClose={handleBackToOrganSelect}
        title="TEST TERMINATED"
      >
        <div className="space-y-4 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400">
              Repeated movement detected.
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
              SHAKE EVENT 2 OF 2
            </span>
          </div>

          <div className="flex items-start gap-2.5 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 text-rose-200">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <p className="text-xs leading-relaxed">
              The SHB assessment has been stopped for measurement integrity. No test results were finalized.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleBackToOrganSelect}
              className="text-xs inline-flex items-center gap-1.5"
              style={{
                backgroundColor: accent.primary,
                color: '#ffffff',
              }}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Close</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Failed Lock Validation Modal */}
      <Modal
        isOpen={showFailedLockModal}
        onClose={handleExitFullyFromFailed}
        title="Vitals are not locked properly"
      >
        <div className="space-y-4 text-sm text-zinc-300">
          <div className="flex items-start gap-2.5 text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <p className="text-xs leading-relaxed">
              The 65-second acquisition did not produce valid locked values for all required physiological parameters. This can occur if sensor contact was lost or excessive motion interference was detected.
            </p>
          </div>

          {missingVitals.length > 0 && (
            <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400">
                Unlocked / Incomplete Parameters:
              </span>
              <div className="flex flex-wrap gap-1 pt-1">
                {missingVitals.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitFullyFromFailed}
              className="text-xs inline-flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Exit Fully</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRetakeTest}
              className="text-xs inline-flex items-center gap-1.5"
              style={{
                backgroundColor: accent.primary,
                color: '#ffffff',
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retake Test</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
