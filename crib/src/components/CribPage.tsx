import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CribMode, CribAiMessage, CribGuidanceItem, CribMediaState, CribSettingsState } from '../types/crib';
import { DEFAULT_GUIDANCE_STATE, DEFAULT_MEDIA_STATE, DEFAULT_SETTINGS_STATE } from '../data/defaultCribState';
import {
  SAMPLE_QA_CM_PACKET,
  SAMPLE_QA_CONDITION_RESULT,
  SAMPLE_QA_GUIDANCE,
  SAMPLE_QA_MESSAGES,
} from '../data/sampleTelemetryPacket';
import { useCribData } from '../services/crib/useCribData';
import { cribDataManager } from '../services/crib/cribDataManager';
import { useSdcuState } from '../services/crib/sdcu/useSdcuState';
import { sdcuStateMachine } from '../services/crib/sdcu/sdcuStateMachine';
import { useSsbState } from '../services/crib/ssb/useSsbState';
import { ssbStateMachine } from '../services/crib/ssb/ssbStateMachine';
import { useDiagState } from '../services/crib/diag/useDiagState';
import { diagStateMachine } from '../services/crib/diag/diagStateMachine';
import { CribAiContextBuilder } from '../services/crib/cribAiContext';
import { CribAiService } from '../services/crib/cribAiService';
import { CribEventEngine } from '../services/crib/events/cribEventEngine';
import { CribVisibilityManager } from '../services/crib/events/cribVisibilityManager';
import { CribAudioService } from '../services/crib/events/cribAudioService';
import { CribLocationService } from '../services/crib/events/cribLocationService';
import { CribCallService } from '../services/crib/events/cribCallService';
import { DiagActionId } from '../types/diag';
import { CribFrame } from './CribFrame';

export const CribPage: React.FC<{ onExitToHome: () => void; authenticatedUid?: string }> = ({ onExitToHome, authenticatedUid: authenticatedUidProp }) => {
  // Mode state: SDCU (Red), SSB (Organ/Unconscious/Helper), DIAG (Blue)
  const [mode, setMode] = useState<CribMode>('SDCU');

  // Authenticated user ID (bound to session)
  // HOME owns authentication; CRIB receives the active UID as a page input.
  const authenticatedUid = authenticatedUidProp || '';

  // Subscribe to real CRIB Input Adapter data stream
  const cribInputState = useCribData(authenticatedUid);

  // Subscribe to SDCU State Machine
  const sdcuSnapshot = useSdcuState();

  // Subscribe to SSB State Machine
  const ssbSnapshot = useSsbState();

  // Subscribe to DIAG State Machine
  const diagSnapshot = useDiagState();

  // QA Simulated telemetry toggle (defaults to false for strict production compliance: NO fake data!)
  const [isTestTelemetryActive, setIsTestTelemetryActive] = useState<boolean>(false);

  // AI Guidance Directives
  const [guidance, setGuidance] = useState<CribGuidanceItem[]>(DEFAULT_GUIDANCE_STATE);

  // AI Chat Messages
  const [aiMessages, setAiMessages] = useState<CribAiMessage[]>([]);

  // AI Loading & Error status
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Media Player State (MP4 / MP3)
  const [mediaState, setMediaState] = useState<CribMediaState>(DEFAULT_MEDIA_STATE);

  // Console Settings State
  const [settings, setSettings] = useState<CribSettingsState>(DEFAULT_SETTINGS_STATE);

  // Manual Override Trigger State
  const [isOverrideTriggered, setIsOverrideTriggered] = useState<boolean>(false);

  // Ref tracking whether escalation has already dispatched to avoid duplicate events
  const hasEscalatedRef = useRef<boolean>(false);

  // Mode change handler
  const handleModeChange = useCallback((newMode: CribMode) => {
    setMode(newMode);
    if (newMode === 'SSB') {
      ssbStateMachine.manualStart();
      CribEventEngine.dispatchEvent({
        eventType: 'SSB_ACTIVATED',
        mode: 'SSB',
        uid: authenticatedUid,
        sessionId: cribInputState.sessionId || 'SESSION-SSB',
        vitals: cribInputState.vitals,
        customMessage: 'SSB Stranger Assistance Protocol manually activated.',
      });
    } else if (newMode === 'SDCU') {
      hasEscalatedRef.current = false;
      sdcuStateMachine.reset();
      sdcuStateMachine.startActivation();
    } else if (newMode === 'DIAG') {
      diagStateMachine.startDiag();
    }
  }, [authenticatedUid, cribInputState.sessionId, cribInputState.vitals]);

  // Track Visibility across browser tabs: preserve state and revalidate freshness on return
  useEffect(() => {
    const unsub = CribVisibilityManager.subscribe((isVisible, backgroundDurationMs) => {
      if (isVisible && backgroundDurationMs > 5000) {
        // Tab restored from background after >5s - recheck audio context & vitals freshness
        CribAudioService.getAudioState();
      }
    });
    return unsub;
  }, []);

  // Automatic SDCU escalation transition to SSB & Emergency Event Pipeline
  useEffect(() => {
    if (
      sdcuSnapshot.state === 'SDCU_ESCALATION_PENDING' &&
      sdcuSnapshot.requestedMode === 'SSB' &&
      !hasEscalatedRef.current
    ) {
      hasEscalatedRef.current = true;
      setMode('SSB');
      ssbStateMachine.startFromSdcu(sdcuSnapshot.escalationReason || 'SDCU_ESCALATION');

      // Trigger full CRIB emergency escalation pipeline (Location, Caretaker, User, Audio, Directives)
      CribEventEngine.handleSdcuEscalation({
        uid: authenticatedUid,
        sessionId: cribInputState.sessionId || 'SESSION-SDCU',
        conditionResult: null,
        vitals: cribInputState.vitals,
        reason: sdcuSnapshot.escalationReason || '120-second active window unconfirmed or critical fall detected',
      });
    }
  }, [
    sdcuSnapshot.state,
    sdcuSnapshot.requestedMode,
    sdcuSnapshot.escalationReason,
    authenticatedUid,
    cribInputState.sessionId,
    cribInputState.vitals,
  ]);

  // Sync guidance directives based on active mode & state machine directives
  useEffect(() => {
    if (mode === 'SSB') {
      if (ssbSnapshot.guidanceDirectives.length > 0) {
        const mapped: CribGuidanceItem[] = ssbSnapshot.guidanceDirectives.map((text, idx) => ({
          id: `ssb-guidance-${idx}`,
          text,
          level: idx === 0 ? 'critical' : idx < 3 ? 'warning' : 'info',
        }));
        setGuidance(mapped);
      }
    } else if (mode === 'SDCU') {
      if (sdcuSnapshot.guidanceDirectives.length > 0) {
        const mapped: CribGuidanceItem[] = sdcuSnapshot.guidanceDirectives.map((text, idx) => ({
          id: `sdcu-guidance-${idx}`,
          text,
          level: idx === 0 ? 'warning' : 'info',
        }));
        setGuidance(mapped);
      }
    } else if (mode === 'DIAG') {
      if (diagSnapshot.guidanceDirectives.length > 0) {
        const mapped: CribGuidanceItem[] = diagSnapshot.guidanceDirectives.map((text, idx) => ({
          id: `diag-guidance-${idx}`,
          text,
          level: idx === 0 ? 'critical' : idx < 3 ? 'warning' : 'info',
        }));
        setGuidance(mapped);
      }
    }
  }, [mode, ssbSnapshot.guidanceDirectives, sdcuSnapshot.guidanceDirectives, diagSnapshot.guidanceDirectives]);

  // Initial SDCU Activation Entry Dialog on load if in SDCU mode
  useEffect(() => {
    if (mode === 'SDCU' && sdcuSnapshot.state === 'IDLE') {
      sdcuStateMachine.startActivation();
    }
  }, [mode, sdcuSnapshot.state]);

  // Toggle QA Telemetry simulation through the real CRIB Input Adapter
  const handleToggleTestTelemetry = useCallback((active: boolean) => {
    setIsTestTelemetryActive(active);
    if (active) {
      // Ingest real test CM_PACKET into adapter pipeline
      cribDataManager.ingestCmPacket({
        ...SAMPLE_QA_CM_PACKET,
        timestamp: Date.now(),
      });
      cribDataManager.ingestConditionResult({
        ...SAMPLE_QA_CONDITION_RESULT,
        timestamp: Date.now(),
      });
      setGuidance(SAMPLE_QA_GUIDANCE);
      setAiMessages(SAMPLE_QA_MESSAGES);
    } else {
      // Reset pipeline to real waiting state with null/empty values
      cribDataManager.ingestCmPacket(null);
      cribDataManager.ingestConditionResult(null);
      setGuidance(DEFAULT_GUIDANCE_STATE);
      setAiMessages([]);
    }
  }, []);

  // Update Media State Handler
  const handleUpdateMediaState = useCallback((updates: Partial<CribMediaState>) => {
    setMediaState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update Settings Handler
  const handleUpdateSettings = useCallback((newSettings: Partial<CribSettingsState>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    sdcuStateMachine.updateSettings({
      sdcuEnabled: newSettings.sdcuEnabled,
      actionVerificationEnabled: newSettings.actionVerificationEnabled,
      audioGuidanceEnabled: newSettings.audioGuidanceEnabled,
    });
  }, []);

  // Helper to extract current action info
  const getCurrentActionInfo = useCallback(() => {
    if (mode === 'SDCU') {
      return {
        type: 'SDCU_ACTION' as const,
        id: sdcuSnapshot.currentActionQuestion?.id || undefined,
        question: sdcuSnapshot.currentActionQuestion?.text || undefined,
        lastResponse: sdcuSnapshot.lastConfirmedAction?.response || undefined,
      };
    }
    if (mode === 'SSB') {
      return {
        type: 'SSB_STRANGER_PROMPT' as const,
        id: ssbSnapshot.currentStrangerQuestion?.id || undefined,
        question: ssbSnapshot.currentStrangerQuestion?.text || undefined,
        lastResponse: ssbSnapshot.lastHelperResponse?.response || undefined,
      };
    }
    if (mode === 'DIAG') {
      return {
        type: 'DIAG_HELPER_ACTION' as const,
        id: diagSnapshot.selectedAction?.actionId || undefined,
        label: diagSnapshot.selectedAction?.actionLabel,
      };
    }
    return null;
  }, [
    mode,
    sdcuSnapshot.currentActionQuestion,
    sdcuSnapshot.lastConfirmedAction,
    ssbSnapshot.currentStrangerQuestion,
    ssbSnapshot.lastHelperResponse,
    diagSnapshot.selectedAction,
  ]);

  // AI Chat user message send handler - Real API invocation with structured physiological context
  const handleSendMessage = useCallback(
    async (text: string) => {
      const userMsg: CribAiMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        message: text,
        timestamp: Date.now(),
        priority: 'normal',
      };

      setAiMessages((prev) => [...prev, userMsg]);
      setIsAiLoading(true);
      setAiError(null);

      try {
        const actionInfo = getCurrentActionInfo();
        const context = CribAiContextBuilder.buildContext({
          mode,
          uid: authenticatedUid,
          vitals: cribInputState.vitals,
          probabilities: cribInputState.probabilities,
          conditionResult: null,
          actionInfo,
        });

        const response = await CribAiService.sendChatMessage({
          message: text,
          context,
          history: [...aiMessages, userMsg],
        });

        const aiMsg: CribAiMessage = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          message: response.reply,
          timestamp: response.timestamp || Date.now(),
          priority: response.priority || 'normal',
        };

        setAiMessages((prev) => [...prev, aiMsg]);

        // If response included new directives, update guidance banner
        if (response.directives && response.directives.length > 0) {
          setGuidance(CribAiService.mapDirectivesToItems(response.directives));
        }
      } catch (err: any) {
        console.error('Failed to communicate with CRIB AI Backend:', err);
        setAiError('AI Copilot temporarily offline. Deterministic protocols active.');
      } finally {
        setIsAiLoading(false);
      }
    },
    [
      mode,
      authenticatedUid,
      cribInputState.vitals,
      cribInputState.probabilities,
      aiMessages,
      getCurrentActionInfo,
    ]
  );

  // Manual Override Callback
  const handleManualOverride = useCallback(() => {
    setIsOverrideTriggered((prev) => !prev);
    if (mode === 'SDCU') {
      sdcuStateMachine.handleManualOverride();
    } else if (mode === 'SSB') {
      ssbStateMachine.handleManualOverride();
    } else if (mode === 'DIAG') {
      diagStateMachine.handleManualOverride();
    }
  }, [mode]);

  // SDCU Action Callbacks
  const handleActivateSdcu = useCallback(() => {
    sdcuStateMachine.activate();
  }, []);

  const handleExitSdcuActivation = useCallback(() => {
    sdcuStateMachine.exitActivation();
    onExitToHome();
  }, [onExitToHome]);

  const handleRespondAction = useCallback((response: 'YES' | 'NO') => {
    sdcuStateMachine.respondAction(response);
  }, []);

  // SSB Stranger Action Callbacks
  const handleRespondStrangerAction = useCallback((response: 'YES' | 'NO') => {
    ssbStateMachine.respondStranger(response);
  }, []);

  const handleNextStrangerQuestion = useCallback(() => {
    ssbStateMachine.promptStranger();
  }, []);

  const handleContinueSsb = useCallback(() => {
    ssbStateMachine.continueSsb();
  }, []);

  // DIAG Action Callbacks
  const handleSelectDiagAction = useCallback((actionId: DiagActionId) => {
    diagStateMachine.selectAction(actionId);
  }, []);

  const handleDismissDiagAction = useCallback(() => {
    diagStateMachine.dismissAction();
  }, []);

  return (
    <CribFrame
      onExitToHome={onExitToHome}
      mode={mode}
      onModeChange={handleModeChange}
      vitals={cribInputState.vitals}
      probabilities={cribInputState.probabilities}
      aiMessages={aiMessages}
      guidance={guidance}
      isAiLoading={isAiLoading}
      aiError={aiError}
      mediaState={mediaState}
      onUpdateMediaState={handleUpdateMediaState}
      settings={settings}
      onUpdateSettings={handleUpdateSettings}
      onSendMessage={handleSendMessage}
      onManualOverride={handleManualOverride}
      isOverrideTriggered={isOverrideTriggered}
      isTestTelemetryActive={isTestTelemetryActive}
      onToggleTestTelemetry={handleToggleTestTelemetry}
      adapterStatus={cribInputState.status}
      freshness={cribInputState.freshness}
      target={cribInputState.target}
      compareSummary={cribInputState.compareSummary}
      sdcuSnapshot={sdcuSnapshot}
      onActivateSdcu={handleActivateSdcu}
      onExitSdcuActivation={handleExitSdcuActivation}
      onRespondAction={handleRespondAction}
      ssbSnapshot={ssbSnapshot}
      onRespondStrangerAction={handleRespondStrangerAction}
      onNextStrangerQuestion={handleNextStrangerQuestion}
      onContinueSsb={handleContinueSsb}
      diagSnapshot={diagSnapshot}
      onSelectDiagAction={handleSelectDiagAction}
      onDismissDiagAction={handleDismissDiagAction}
    />
  );
};
