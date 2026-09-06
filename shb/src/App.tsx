import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { DeviceProvider } from './context/DeviceContext';
import { MobileAppFrame } from './components/layout/MobileAppFrame';
import { ShbTestPage } from './pages/ShbTestPage';

export default function App() {
  const handleExitToHome = () => {
    window.history.pushState({}, '', '/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleProceedToCondition = (output: import('../../c50/src/services/condition/conditionPipeline').ConditionPipelineOutput) => {
    const reportId = output.report.reportId;
    const reportQuery = reportId ? `?testReportId=${encodeURIComponent(reportId)}` : '';
    window.history.pushState({}, '', `/condition${reportQuery}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <ThemeProvider>
      <DeviceProvider>
        <MobileAppFrame>
          {/* Main Full-Screen SHB Viewport: Fixed container with scrollable page body */}
          <main className="flex-1 flex flex-col w-full min-h-0 overflow-hidden">
            <ShbTestPage
              onExitToHome={handleExitToHome}
              onProceedToCondition={handleProceedToCondition}
            />
          </main>
        </MobileAppFrame>
      </DeviceProvider>
    </ThemeProvider>
  );
}
