import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { useShbTheme } from '../../theme/shbTheme';
import { CompareConnectionState, SynchronizedPhbJson, CmPacket } from '../../types/compare';
import { shbSessionCache } from '../../services/vitals/shbSessionCache';
import { compareEngine } from '../../services/compare/compareEngine';
import { PhbDocumentViewer } from '../compare/PhbDocumentViewer';
import { CompareTableView } from '../compare/CompareTableView';
import { runConditionPipeline, type ConditionPipelineOutput } from '../../../../c50/src/services/condition/conditionPipeline';

export interface CompareLoadingViewProps {
  onBack: () => void;
  onProceedToCondition?: (output: ConditionPipelineOutput) => void;
  initialOrgan?: string;
  homePhb?: any | null;
  homeUid?: string | null;
}

export function isCompareReadyForCondition(cmPacket: CmPacket | null): boolean {
  if (!cmPacket) return false;

  const rows = Array.isArray(cmPacket.parameters) ? cmPacket.parameters : [];
  const missingShbParameters = Array.isArray(cmPacket.missingShbParameters) ? cmPacket.missingShbParameters : [];
  const missingPhbParameters = Array.isArray(cmPacket.missingPhbParameters) ? cmPacket.missingPhbParameters : [];
  const hasRequiredRows = rows.length === 11;
  const hasValidPacket = cmPacket.status === 'COMPUTED' &&
    cmPacket.validParameterCount === 11 &&
    hasRequiredRows &&
    missingShbParameters.length === 0 &&
    missingPhbParameters.length === 0;

  if (!hasValidPacket) return false;

  return rows.every((row) => {
    const hasFiniteShbValue = row.shbValue !== null && row.shbValue !== undefined && Number.isFinite(row.shbValue);
    const hasStage = typeof row.compareStage === 'number' && Number.isFinite(row.compareStage) && row.compareStage >= 0 && row.compareStage <= 5;
    const rowIsComparable = row.status === 'VALID' || row.status === 'COMPUTED';
    return rowIsComparable && hasFiniteShbValue && hasStage;
  });
}

export const CompareLoadingView: React.FC<CompareLoadingViewProps> = ({
  onBack,
  onProceedToCondition,
  initialOrgan,
  homePhb,
  homeUid,
}) => {
  const { shb_color } = useShbTheme();
  const [connectionState, setConnectionState] = useState<CompareConnectionState>('DATABASE_CONNECTING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPhb, setCurrentPhb] = useState<any | null>(homePhb || null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<string>(() => {
    return initialOrgan || shbSessionCache.getSession()?.targetOrgan || 'OVERALL';
  });
  const [showPhbViewer, setShowPhbViewer] = useState<boolean>(false);
  const [pipelineProcessing, setPipelineProcessing] = useState<boolean>(false);
  const initPipeline = useCallback(() => {
    setErrorMessage(null);

    // Unified HOME route: PHB and UID are supplied by HOME AuthContext.
    if (homePhb && homeUid) {
      setCurrentPhb(homePhb);
      setCurrentUid(homeUid);
      setConnectionState('PHB_READY');
      return;
    }
    setConnectionState('AUTH_REQUIRED');
    setErrorMessage('HOME must provide an authenticated PHB before Compare can start.');
  }, [homePhb, homeUid]);

  useEffect(() => {
    initPipeline();
  }, [initPipeline]);

  const handleRetry = () => {
    initPipeline();
  };

  // Compute CM_PACKET once PHB is ready (Always call hook unconditionally)
  const cmPacket: CmPacket | null = useMemo(() => {
    if (connectionState !== 'PHB_READY' || !currentPhb) return null;
    const session = shbSessionCache.getSession();
    const result = compareEngine.computeComparison(
      currentPhb,
      session,
      currentUid,
      selectedOrgan
    );
    return result.cmPacket;
  }, [connectionState, currentPhb, currentUid, selectedOrgan]);

  const isCompleteCompare = isCompareReadyForCondition(cmPacket);

  const handleProceedToCondition = useCallback(async () => {
    if (!cmPacket || pipelineProcessing) return;

    setPipelineProcessing(true);
    setErrorMessage(null);
    try {
      const output = await runConditionPipeline(cmPacket);
      onProceedToCondition?.(output);
    } catch (err: any) {
      const message = err?.message || 'Condition pipeline failed.';
      console.error('[C50 DIRECT PIPELINE FAILURE]', { message, cmPacket });
      setErrorMessage(message);
    } finally {
      setPipelineProcessing(false);
    }
  }, [cmPacket, onProceedToCondition, pipelineProcessing]);

  // If user opened the full PHB Viewer modal / subscreen
  if (showPhbViewer && currentPhb) {
    return (
      <PhbDocumentViewer
        phb={currentPhb}
        onBack={() => setShowPhbViewer(false)}
      />
    );
  }

  // If CM_PACKET is computed, render the pure Compare Table View
  if (connectionState === 'PHB_READY' && cmPacket) {
    return (
      <div className="flex flex-col min-h-full w-full">
        {errorMessage && (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-mono text-rose-300"
          >
            <div className="font-bold">CONDITION PIPELINE FAILED</div>
            <div className="mt-1 break-words">{errorMessage}</div>
          </div>
        )}
        <CompareTableView
          cmPacket={cmPacket}
          onBack={onBack}
          onProceedToCondition={isCompleteCompare && !pipelineProcessing ? handleProceedToCondition : undefined}
          onSelectTargetOrgan={(organ) => setSelectedOrgan(organ)}
          onViewPhb={() => setShowPhbViewer(true)}
          phbDocument={currentPhb}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[75vh] w-full">
      {/* Top-left: < Back */}
      <div className="pt-2 pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-80"
          style={{
            backgroundColor: shb_color.panel,
            color: shb_color.textPrimary,
            border: `1px solid ${shb_color.panelBorder}`,
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to SHB</span>
        </button>
      </div>

      {/* Main content: Technical Bridge Flow */}
      <div className="flex-1 flex flex-col items-center justify-center -mt-4 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          {/* 1. Loading States (CONNECTING / AUTHENTICATING / FETCHING) */}
          {(connectionState === 'DATABASE_CONNECTING' ||
            connectionState === 'AUTHENTICATING' ||
            connectionState === 'PHB_FETCHING' ||
            connectionState === 'AUTHENTICATED') && (
            <div className="space-y-3">
              <div className="inline-block w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
              <div>
                <h1
                  className="text-base font-black tracking-widest uppercase font-mono"
                  style={{ color: shb_color.textPrimary }}
                >
                  COMPARE PIPELINE
                </h1>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  {connectionState === 'DATABASE_CONNECTING' && 'Preparing HOME PHB...'}
                  {connectionState === 'AUTHENTICATING' && 'Authenticating with Google...'}
                  {connectionState === 'AUTHENTICATED' && 'Authenticated • Preparing retrieval...'}
                  {connectionState === 'PHB_FETCHING' && 'Retrieving /phbs/{uid}...'}
                </p>
              </div>
            </div>
          )}

          {/* 2. AUTH_REQUIRED State */}
          {connectionState === 'AUTH_REQUIRED' && (
            <div
              className="p-5 rounded-2xl border space-y-3 shadow-lg"
              style={{
                backgroundColor: shb_color.card,
                borderColor: shb_color.cardBorder,
              }}
            >
              <h2 className="text-sm font-bold tracking-tight text-zinc-100 uppercase font-mono">
                Authentication Required
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sign in with your Google account to retrieve your verified Personal Health Baseline (/phbs/{'{uid}'}).
              </p>
              <button
                onClick={handleRetry}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                style={{ backgroundColor: shb_color.accent }}
              >
                <span>Sign in with Google</span>
              </button>
            </div>
          )}

          {/* 3. DATABASE_DISCONNECTED / Configuration Notice */}
          {connectionState === 'DATABASE_DISCONNECTED' && (
            <div
              className="p-5 rounded-2xl border space-y-3 shadow-lg text-left"
              style={{
                backgroundColor: shb_color.card,
                borderColor: 'rgba(234, 179, 8, 0.3)',
              }}
            >
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <h2 className="text-xs font-bold uppercase font-mono tracking-wider">
                  Firebase Config Required
                </h2>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Runtime Firebase environment variables (P25 project) are pending configuration. Please provide the project secrets to establish the cloud database bridge.
              </p>
              <button
                onClick={handleRetry}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-zinc-200 border border-zinc-700 bg-zinc-800 hover:bg-zinc-750 transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Configuration</span>
              </button>
            </div>
          )}

          {/* 4. Error & Fallback States (AUTH_ERROR / PHB_NOT_FOUND / PHB_FETCH_ERROR / CONNECTION_ERROR) */}
          {(connectionState === 'AUTH_ERROR' ||
            connectionState === 'PHB_NOT_FOUND' ||
            connectionState === 'PHB_FETCH_ERROR' ||
            connectionState === 'CONNECTION_ERROR') && (
            <div
              className="p-5 rounded-2xl border space-y-3 shadow-lg text-left"
              style={{
                backgroundColor: shb_color.card,
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <h2 className="text-xs font-bold uppercase font-mono tracking-wider">
                  {connectionState === 'PHB_NOT_FOUND' ? 'Baseline Not Found' : 'Connection Notice'}
                </h2>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {errorMessage ||
                  (connectionState === 'PHB_NOT_FOUND'
                    ? 'No Personal Health Baseline (/phbs/{uid}) exists for this authenticated user.'
                    : 'A network or authentication error occurred while accessing the database.')}
              </p>
              <button
                onClick={handleRetry}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: shb_color.accent }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
