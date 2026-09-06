import React, { useState } from 'react';
import { ConditionFrame } from '../components/condition/ConditionFrame';
import { ConditionLoading } from '../components/condition/ConditionLoading';
import { ConditionReportView } from '../components/condition/ConditionReportView';
import type { ConditionPipelineOutput } from '../services/condition/conditionPipeline';
import type { ConditionProcessingState } from '../services/condition/conditionTypes';
import { downloadConditionReportPdf } from '../services/condition/browserPdf';

export interface ConditionPageProps {
  initialOutput?: ConditionPipelineOutput | null;
  onFinish?: () => void;
  onBackToCompare?: () => void;
  persistenceError?: string | null;
}

export const ConditionPage: React.FC<ConditionPageProps> = ({ initialOutput, onFinish, onBackToCompare, persistenceError }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const state: ConditionProcessingState = initialOutput ? 'COMPLETED' : 'ERROR';

  if (!initialOutput) {
    return (
      <ConditionFrame currentState="ERROR" viewMode="loading" canGoNext={false} onNext={() => undefined} onBack={onFinish || (() => undefined)}>
        <ConditionLoading state="ERROR" errorMessage="A completed Compare result is required before Condition can start." />
      </ConditionFrame>
    );
  }

  return (
    <ConditionFrame currentState={state} viewMode="report" canGoNext={false} onNext={() => undefined} onBack={onBackToCompare || onFinish || (() => undefined)} onDownload={() => { setIsDownloading(true); try { downloadConditionReportPdf(initialOutput.report); } finally { setIsDownloading(false); } }} isDownloading={isDownloading}>
      <ConditionReportView report={initialOutput.report} result={initialOutput.result} onFinish={onFinish} isDevelopmentPreview={false} />
      {persistenceError && <div className="text-xs text-amber-300 mt-2">{persistenceError}</div>}
    </ConditionFrame>
  );
};
