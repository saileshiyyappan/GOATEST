import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  CribMode,
  CribVital,
  CribProbability,
  CribAiMessage,
  CribGuidanceItem,
  CribMediaState,
  CribSettingsState,
} from '../types/crib';
import { CribAdapterStatus, CribFreshnessStatus, CribCompareSummaryState } from '../types/cribInput';
import { SDCUSnapshot } from '../types/sdcu';
import { SSBSnapshot } from '../types/ssb';
import { DiagSnapshot, DiagActionId } from '../types/diag';
import { CRIB_THEMES } from '../themes/cribThemes';
import { CribTopBar } from './CribTopBar';
import { CribMediaPanel } from './CribMediaPanel';
import { CribProbabilityPanel } from './CribProbabilityPanel';
import { CribVitalsPanel } from './CribVitalsPanel';
import { CribAiChat } from './CribAiChat';
import { CribManualOverride } from './CribManualOverride';
import { CribSettingsModal } from './CribSettingsModal';
import { CribExpandedVitalsModal } from './CribExpandedVitalsModal';
import { CribExpandedProbabilityModal } from './CribExpandedProbabilityModal';
import { CribAiChatModal } from './CribAiChatModal';
import { CribActivationModal } from './CribActivationModal';
import { CribActionVerificationPopup } from './CribActionVerificationPopup';
import { CribStrangerPrompt } from './CribStrangerPrompt';
import { CribDiagActionPrompt } from './CribDiagActionPrompt';

export interface CribFrameProps {
  onExitToHome: () => void;
  mode: CribMode;
  onModeChange: (newMode: CribMode) => void;
  vitals: CribVital[];
  probabilities: CribProbability[];
  aiMessages: CribAiMessage[];
  guidance: CribGuidanceItem[];
  isAiLoading?: boolean;
  aiError?: string | null;
  mediaState: CribMediaState;
  onUpdateMediaState: (updates: Partial<CribMediaState>) => void;
  settings: CribSettingsState;
  onUpdateSettings: (newSettings: Partial<CribSettingsState>) => void;
  onSendMessage: (text: string) => Promise<void> | void;
  onManualOverride: () => void;
  isOverrideTriggered?: boolean;
  isTestTelemetryActive: boolean;
  onToggleTestTelemetry: (active: boolean) => void;
  adapterStatus?: CribAdapterStatus;
  freshness?: CribFreshnessStatus;
  target?: string;
  compareSummary?: CribCompareSummaryState | null;
  sdcuSnapshot?: SDCUSnapshot;
  onActivateSdcu?: () => void;
  onExitSdcuActivation?: () => void;
  onRespondAction?: (response: 'YES' | 'NO') => void;
  ssbSnapshot?: SSBSnapshot;
  onRespondStrangerAction?: (response: 'YES' | 'NO') => void;
  onNextStrangerQuestion?: () => void;
  onContinueSsb?: () => void;
  diagSnapshot?: DiagSnapshot;
  onSelectDiagAction?: (actionId: DiagActionId) => void;
  onDismissDiagAction?: () => void;
}

export const CribFrame: React.FC<CribFrameProps> = ({
  onExitToHome,
  mode,
  onModeChange,
  vitals,
  probabilities,
  aiMessages,
  guidance,
  isAiLoading = false,
  aiError = null,
  mediaState,
  onUpdateMediaState,
  settings,
  onUpdateSettings,
  onSendMessage,
  onManualOverride,
  isOverrideTriggered = false,
  isTestTelemetryActive,
  onToggleTestTelemetry,
  adapterStatus,
  freshness,
  target,
  compareSummary,
  sdcuSnapshot,
  onActivateSdcu,
  onExitSdcuActivation,
  onRespondAction,
  ssbSnapshot,
  onRespondStrangerAction,
  onNextStrangerQuestion,
  onContinueSsb,
  diagSnapshot,
  onSelectDiagAction,
  onDismissDiagAction,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [isProbModalOpen, setIsProbModalOpen] = useState(false);
  const [isAiChatModalOpen, setIsAiChatModalOpen] = useState(false);

  const theme = CRIB_THEMES[mode];

  return (
    <div
      id="crib-universal-frame"
      className={`h-full max-h-full min-h-0 w-full flex flex-col justify-between overflow-hidden relative select-none transition-colors duration-500 ${theme.bgClass}`}
    >
      {/* 1. FIXED TOP BAR */}
      <CribTopBar mode={mode} onOpenSettings={() => setIsSettingsOpen(true)} onExitToHome={onExitToHome} />

      {/* 2. MAIN FIXED EMERGENCY CONSOLE VIEWPORT (NO PAGE SCROLL) */}
      <main
        id="crib-main-viewport"
        className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-col gap-2 overflow-hidden justify-between"
      >
        {/* SDCU Action Verification Popup (Appears compactly when prompt is active) */}
        {mode === 'SDCU' && sdcuSnapshot?.state === 'ACTION_CHECK_PENDING' && sdcuSnapshot.currentActionQuestion && (
          <CribActionVerificationPopup
            question={sdcuSnapshot.currentActionQuestion}
            countdown={sdcuSnapshot.actionCountdown}
            onRespond={(resp) => onRespondAction?.(resp)}
          />
        )}

        {/* SSB Stranger Assistance Prompt (Compact, non-expiring interactive prompt) */}
        {mode === 'SSB' && ssbSnapshot?.currentStrangerQuestion && (
          <CribStrangerPrompt
            question={ssbSnapshot.currentStrangerQuestion}
            onRespond={(resp) => onRespondStrangerAction?.(resp)}
            onNextQuestion={onNextStrangerQuestion}
            lastResponse={ssbSnapshot.lastHelperResponse}
          />
        )}

        {/* DIAG Diagnostic Helper Action Verification (Compact 10-choice action verification, NO timeout) */}
        {mode === 'DIAG' && (
          <CribDiagActionPrompt
            selectedAction={diagSnapshot?.selectedAction || null}
            onSelectAction={(actionId) => onSelectDiagAction?.(actionId)}
            onDismissAction={onDismissDiagAction}
          />
        )}

        {/* 3. COMPACT VIDEO PANEL */}
        <CribMediaPanel
          mediaState={mediaState}
          mode={mode}
          onUpdateMediaState={onUpdateMediaState}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* 4. MAX PROBABILITY + LIVE VITALS (Strictly Side-by-Side on both mobile and desktop) */}
        <div
          id="crib-telemetry-panels-container"
          className="w-full grid grid-cols-2 gap-2 flex-1 min-h-0 items-stretch"
        >
          {/* MAX PROBABILITY (Compact) */}
          <CribProbabilityPanel
            probabilities={probabilities}
            mode={mode}
            onOpenExpand={() => setIsProbModalOpen(true)}
          />

          {/* LIVE VITALS (Compact) */}
          <CribVitalsPanel
            vitals={vitals}
            mode={mode}
            onOpenExpand={() => setIsVitalsModalOpen(true)}
            freshness={freshness}
          />
        </div>

        {/* 5. AI CHAT / DIRECTIVES COMPACT BANNER */}
        <CribAiChat
          messages={aiMessages}
          guidance={guidance}
          mode={mode}
          isLoading={isAiLoading}
          onOpenChat={() => setIsAiChatModalOpen(true)}
        />
      </main>

      {/* 6. FIXED BOTTOM BAR ([MANUAL OVERRIDE] / [CONTINUE SSB]) */}
      <footer
        id="crib-bottom-bar"
        className="w-full shrink-0 px-3 py-1.5 sm:py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] bg-black/90 border-t border-white/10 z-30"
      >
        <div className="w-full max-w-5xl mx-auto">
          <CribManualOverride
            mode={mode}
            onManualOverride={onManualOverride}
            isTriggered={isOverrideTriggered}
            onContinueSsb={onContinueSsb}
            isContinuing={ssbSnapshot?.isContinuing}
          />
        </div>
      </footer>

      {/* 7. MODALS & DRAWERS (No page scrolling) */}
      <AnimatePresence>
        {/* SDCU Activation Modal (10s Countdown) */}
        {mode === 'SDCU' && sdcuSnapshot?.state === 'ACTIVATION_PENDING' && (
          <CribActivationModal
            isOpen={true}
            countdown={sdcuSnapshot.activationCountdown}
            onActivate={() => onActivateSdcu?.()}
            onExit={() => onExitSdcuActivation?.()}
          />
        )}
        {isSettingsOpen && (
          <CribSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            currentMode={mode}
            onSelectMode={(newMode) => {
              onModeChange(newMode);
            }}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            mediaState={mediaState}
            onUpdateMediaState={onUpdateMediaState}
            isTestTelemetryActive={isTestTelemetryActive}
            onToggleTestTelemetry={onToggleTestTelemetry}
          />
        )}

        {isVitalsModalOpen && (
          <CribExpandedVitalsModal
            isOpen={isVitalsModalOpen}
            onClose={() => setIsVitalsModalOpen(false)}
            vitals={vitals}
            mode={mode}
          />
        )}

        {isProbModalOpen && (
          <CribExpandedProbabilityModal
            isOpen={isProbModalOpen}
            onClose={() => setIsProbModalOpen(false)}
            probabilities={probabilities}
            mode={mode}
          />
        )}

        {isAiChatModalOpen && (
          <CribAiChatModal
            isOpen={isAiChatModalOpen}
            onClose={() => setIsAiChatModalOpen(false)}
            messages={aiMessages}
            guidance={guidance}
            mode={mode}
            isLoading={isAiLoading}
            error={aiError}
            onSendMessage={onSendMessage}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
