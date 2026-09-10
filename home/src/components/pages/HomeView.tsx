/**
 * GOATEST Elite Home View
 * 
 * PMT 2: Modern, mobile-first, health-tech Home experience
 * - Authenticated user profile identity & time-aware greeting
 * - Real Device status & BLE connection management (zero fake sensor data)
 * - Real Today's Schedule powered by Firestore
 * - Prominent "START ASSESSMENT" pipeline launcher
 * - Real Recent Reports powered by Firestore (zero fake reports)
 * - AI Health Insight standby architecture (zero fabricated conclusions)
 * - Real state-backed Pending Actions
 * - Real external accredited Health & Science News with progressive skeletons & retry
 * - Independent scrolling & fixed bottom navigation compatibility
 * - Full theme support: DEFAULT, WHITE, DARK & custom accent colors.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { HomeGreeting } from '../home/HomeGreeting';
import { HomeDeviceStatus } from '../home/HomeDeviceStatus';
import { HomeAssessmentHero } from '../home/HomeAssessmentHero';
import { HomeSchedule } from '../home/HomeSchedule';
import { HomeRecentReports } from '../home/HomeRecentReports';
import { HomeAiInsight } from '../home/HomeAiInsight';
import { HomePendingActions } from '../home/HomePendingActions';
import { HomeHealthNews } from '../home/HomeHealthNews';
import { ScheduleAssessmentModal } from '../home/ScheduleAssessmentModal';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { DailyQaRunnerModal } from '../reports/DailyQaRunnerModal';
import { getDailyQaGate, type DailyQaGateState } from '../../services/dailyQaGateService';
import { buildDayReportRecord, runDayCondition, type HomeDayConditionResult } from '../../services/dayConditionService';
import { reportDatabaseService } from '../../services/reportDatabaseService';
import { notificationService } from '../../services/notificationService';
import { homeService } from '../../services/homeService';
import { healthNewsService } from '../../services/healthNewsService';
import { FileSpreadsheet, ExternalLink } from 'lucide-react';
import type {
  NavigationTab,
  HomeDashboardData,
  DeviceInfo,
  AssessmentScheduleItem,
  PendingActionItem,
  ReportItem,
} from '../../types';
import { useDevice } from '../../../../shb/src/context/DeviceContext';

export interface HomeViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const { userProfile, role, currentUser, isConfigured, isLoading: isAuthLoading, authState } = useAuth();
  const { status: bleStatus, device: bleDevice } = useDevice();
  const { addToast } = useToast();

  // Master Home Data State
  const [homeData, setHomeData] = useState<HomeDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNewsLoading, setIsNewsLoading] = useState<boolean>(false);

  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [isPhbModalOpen, setIsPhbModalOpen] = useState<boolean>(false);
  const [dailyQaGate, setDailyQaGate] = useState<DailyQaGateState | null>(null);
  const [isDailyQaPromptOpen, setIsDailyQaPromptOpen] = useState(false);
  const [isDailyQaRunnerOpen, setIsDailyQaRunnerOpen] = useState(false);
  const [dayConditionResult, setDayConditionResult] = useState<HomeDayConditionResult | null>(null);
  const [homeRealtimeReports, setHomeRealtimeReports] = useState<ReportItem[] | null>(null);

  const effectiveUserId = currentUser?.uid || userProfile?.uid || '';
  const sharedDeviceInfo: DeviceInfo = {
    connected: bleStatus === 'CONNECTED' || bleStatus === 'NOTIFYING' || bleStatus === 'STREAMING',
    status: bleStatus === 'NOT_SUPPORTED' ? 'NOT_AVAILABLE' : bleStatus === 'CONNECTING' ? 'CONNECTING' : (bleStatus === 'CONNECTED' || bleStatus === 'NOTIFYING' || bleStatus === 'STREAMING') ? 'CONNECTED' : 'DISCONNECTED',
    deviceName: bleDevice?.name || null,
    batteryLevel: bleDevice?.batteryLevel ?? null,
    lastConnectedAt: bleDevice?.connectedAt ? new Date(bleDevice.connectedAt).toISOString() : null,
  };

  // Load Aggregated Home Data
  const loadHomeData = useCallback(async () => {
    if (isAuthLoading || authState === 'AUTH_LOADING') {
      return;
    }

    try {
      const data = await homeService.getHomeDashboardData(effectiveUserId, userProfile);
      setHomeData(data);
    } catch (err) {
      console.error('Error loading home data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, userProfile, isAuthLoading, authState]);

  // Initial Load & Device Subscription
  useEffect(() => {
    if (!isAuthLoading && authState !== 'AUTH_LOADING') {
      loadHomeData();
    }

  }, [loadHomeData, isAuthLoading, authState]);

  // Keep HOME's recent-report summary synchronized with the existing canonical listener.
  useEffect(() => {
    if (!effectiveUserId || isAuthLoading || authState === 'AUTH_LOADING') return;
    setHomeRealtimeReports(null);
    return reportDatabaseService.subscribeUserConditionReports(effectiveUserId, undefined, (records) => {
      setHomeRealtimeReports(records.map((record) => ({
        id: record.reportId,
        userId: record.userId,
        timestamp: record.generatedAt,
        category: record.reportType === 'DAY' ? "Today's Report" : record.reportType === 'WEEK' ? 'Weekly Report' : record.reportType === 'MONTH' ? 'Monthly Report' : 'Recent Test',
        summary: record.readableContent?.summary || record.title,
        organTested: record.readableContent?.organTested,
        status: record.status === 'ARCHIVED' ? 'ARCHIVED' as const : 'COMPLETED' as const,
        reportType: record.reportType,
        referenceId: record.referenceId,
        isFixture: record.isFixture,
      })));
      setHomeData((previous) => previous ? { ...previous, reportsError: null } : previous);
    }, (error) => {
      setHomeData((previous) => previous ? { ...previous, reportsError: error.message } : previous);
    });
  }, [effectiveUserId, isAuthLoading, authState]);

  useEffect(() => {
    if (!effectiveUserId || isAuthLoading || authState === 'AUTH_LOADING') return;
    void getDailyQaGate(effectiveUserId).then((gate) => {
      setDailyQaGate(gate);
      const pendingQaDayId = typeof window !== 'undefined' ? window.sessionStorage.getItem('goatest:pending-qa-day-id') : null;
      const shouldOpenPendingQa = gate.status === 'Q/A_REQUIRED' && pendingQaDayId === gate.dayObservationId;
      if (shouldOpenPendingQa) window.sessionStorage.removeItem('goatest:pending-qa-day-id');
      const canOpenQaToday = gate.qaOpportunityAvailable !== false;
      setIsDailyQaPromptOpen(gate.status === 'Q/A_REQUIRED' && canOpenQaToday && !shouldOpenPendingQa);
      setIsDailyQaRunnerOpen(shouldOpenPendingQa && canOpenQaToday);
    }).catch((error) => console.warn('[HomeView] Daily Q/A gate unavailable:', error));
  }, [effectiveUserId, isAuthLoading, authState]);

  useEffect(() => {
    const handleOpenQa = (event: Event) => {
      const dayId = (event as CustomEvent<{ dayId?: string }>).detail?.dayId;
      if (dayId && dayId !== dailyQaGate?.dayObservationId) return;
      if (dailyQaGate?.status === 'Q/A_REQUIRED') {
        setIsDailyQaPromptOpen(false);
        setIsDailyQaRunnerOpen(true);
      }
    };
    window.addEventListener('goatest:open-daily-qa', handleOpenQa);
    return () => window.removeEventListener('goatest:open-daily-qa', handleOpenQa);
  }, [dailyQaGate]);

  // PMT-4: compute DAY only from the validated PMT-2 input after completed Q/A.
  useEffect(() => {
    if (dailyQaGate?.status !== 'Q/A_COMPLETED' || !dailyQaGate.dayInput || !dailyQaGate.qaSession) return;
    try {
      const result = runDayCondition({
        ...dailyQaGate.dayInput,
        qaSessionId: dailyQaGate.qaSession.qaSessionId,
        qaCompletionStatus: 'COMPLETED',
        qaCompletedAt: dailyQaGate.qaSession.completedAt,
        qaSession: dailyQaGate.qaSession,
      });
      setDayConditionResult(result);
      if (result.success) {
        void reportDatabaseService.saveReportRecord(buildDayReportRecord(result)).then(() => {
          console.info('[DAY REPORT CREATED]', { uid: result.uid, dayObservationId: result.dayObservationId, reportId: result.reportId });
          return undefined;
        }).catch((error) => console.warn('[DAY REPORT] persistence unavailable:', error));
      }
    } catch (error) {
      console.error('[DAY C50] computation blocked:', error);
      setDayConditionResult(null);
    }
  }, [dailyQaGate]);

  // Refresh News Only
  const handleRefreshNews = async () => {
    setIsNewsLoading(true);
    try {
      const articles = await healthNewsService.fetchHealthNews(true);
      setHomeData((prev) =>
        prev ? { ...prev, newsArticles: articles, newsError: null } : null
      );
      addToast({
        title: 'News Refreshed',
        description: 'Latest health science articles loaded.',
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not refresh news.';
      setHomeData((prev) =>
        prev ? { ...prev, newsError: msg } : null
      );
    } finally {
      setIsNewsLoading(false);
    }
  };

  // Pending Action Dispatcher
  const handlePendingActionClick = (action: PendingActionItem) => {
    switch (action.actionType) {
      case 'CONNECT_DEVICE':
        window.dispatchEvent(new Event('goatest:open-device-modal'));
        break;
      case 'SCHEDULE_TEST':
        setIsScheduleModalOpen(true);
        break;
      case 'CONFIGURE_PHB':
        setIsPhbModalOpen(true);
        break;
      case 'START_TEST':
        onNavigate('test');
        break;
      case 'VIEW_REPORT':
        onNavigate('reports');
        break;
      case 'CARETAKER_REVIEW':
        onNavigate(action.targetTab || 'settings');
        break;
    }
  };

  // Start Scheduled Test
  const handleStartScheduledTest = (_item: AssessmentScheduleItem) => {
    onNavigate('test');
  };

  return (
    <div className="flex flex-col gap-4 text-left pb-6">
      {/* 1. Header Welcome & User Profile Identity */}
      <HomeGreeting
        userProfile={userProfile}
        role={role}
        notificationCount={homeData?.notificationCount || 0}
      />

      {/* 2. Device & Connection Status Section */}
      <HomeDeviceStatus
        deviceInfo={sharedDeviceInfo}
        onOpenDeviceModal={() => window.dispatchEvent(new Event('goatest:open-device-modal'))}
      />

      {/* 3. Primary Assessment Hero & "START ASSESSMENT" Action */}
      <HomeAssessmentHero
        assessmentStatus={
          homeData?.assessmentStatus || {
            status: 'Not started',
            todayScheduledCount: 0,
            todayCompletedCount: 0,
            lastCompletedAt: null,
          }
        }
        onStartAssessment={() => onNavigate('test')}
      />

      {/* 4. Today's Assessment Schedule */}
      <HomeSchedule
        schedule={homeData?.todaySchedule || []}
        onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        onStartScheduledTest={handleStartScheduledTest}
      />

      {/* 5. Recent Reports & Hierarchy Section */}
      <HomeRecentReports
        reports={homeRealtimeReports ?? homeData?.recentReports ?? []}
        hierarchyData={homeData?.hierarchyData}
        reportsError={homeData?.reportsError}
        onViewReports={() => onNavigate('reports')}
        onRefresh={loadHomeData}
      />

      {/* 6. AI Health Insight Standby Card */}
      <HomeAiInsight onOpenAiChat={() => onNavigate('ai')} />

      {/* 7. Pending Actions Section */}
      <HomePendingActions
        pendingActions={homeData?.pendingActions || []}
        onActionClick={handlePendingActionClick}
      />

      {/* 8. Health & Science News Feed */}
      <HomeHealthNews
        articles={homeData?.newsArticles || []}
        isLoading={isNewsLoading || (isLoading && !homeData)}
        error={homeData?.newsError}
        onRetry={handleRefreshNews}
      />

      {/* Modals & Dialogs */}

      <Dialog
        isOpen={isDailyQaPromptOpen && dailyQaGate?.status === 'Q/A_REQUIRED'}
        onClose={() => setIsDailyQaPromptOpen(false)}
        title="DAILY CHECK-IN REQUIRED"
        description="Your 3 daily tests are complete. Please complete the daily health Q/A before your DAY assessment can continue."
      >
        <Button variant="primary" size="md" fullWidth onClick={() => { setIsDailyQaPromptOpen(false); setIsDailyQaRunnerOpen(true); }}>
          START Q/A
        </Button>
      </Dialog>

      <DailyQaRunnerModal
        userId={effectiveUserId}
        dayId={dailyQaGate?.dayObservationId || ''}
        isOpen={isDailyQaRunnerOpen && Boolean(dailyQaGate?.dayObservationId)}
        onClose={() => { setIsDailyQaRunnerOpen(false); if (dailyQaGate?.status === 'Q/A_REQUIRED') setIsDailyQaPromptOpen(true); }}
        onSessionComplete={(qaRecord) => {
          setIsDailyQaRunnerOpen(false);
          if (dailyQaGate?.dayObservationId) void notificationService.markFirestoreAsRead(effectiveUserId, `notification_QA_REQUIRED_${dailyQaGate.dayObservationId}`);
          setDailyQaGate((previous) => previous ? { ...previous, status: 'Q/A_COMPLETED', qaCompletionStatus: qaRecord.completionStatus, qaCompletedAt: qaRecord.completedAt, qaSession: qaRecord } : previous);
        }}
      />

      {/* Schedule Assessment Modal */}
      <ScheduleAssessmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        userId={effectiveUserId}
        onScheduleCreated={loadHomeData}
      />

      {/* PHB Integration Status Modal (Safe NOT_CONFIGURED) */}
      <Dialog
        isOpen={isPhbModalOpen}
        onClose={() => setIsPhbModalOpen(false)}
        title="PERSONAL HEALTH BASELINE"
        description="External PHB Web Application Integration"
      >
        <div className="flex flex-col gap-3 py-2 text-left">
          <div className="p-3 rounded-xl bg-amber-800 text-amber-100 border border-amber-950 flex items-start gap-3">
            <FileSpreadsheet className="w-6 h-6 text-amber-100 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-100">
                EXTERNAL SERVICE: NOT CONFIGURED
              </h4>
              <p className="text-xs text-amber-100 font-medium mt-1 leading-relaxed">
                The external PHB web service URL is currently not configured.
              </p>
            </div>
          </div>

          <div className="text-xs text-[#263238] font-medium space-y-1 pt-1">
            <p>• PHB is an external web application.</p>
            <p>• Zero mock URLs or localhost fallbacks are used.</p>
            <p>• Integration will activate once production endpoints are provisioned.</p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsPhbModalOpen(false)} className="bg-[#78909c] text-[#263238] border-[#263238]">
              Dismiss
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
