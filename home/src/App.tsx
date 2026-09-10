/**
 * GOATEST Universal Root Application
 * Foundation + Firebase + Auth + Universal Design System
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MobileFrame } from './components/layout/MobileFrame';
import { AppShell } from './components/layout/AppShell';
import { Button } from './components/ui/Button';
import { WifiOff, RefreshCw, LogOut } from 'lucide-react';
import { ConditionPage } from '../../c50/src/pages/ConditionPage';
import { androidNotificationService } from './services/androidNotificationService';
import { reportService } from './services/reportService';
import type { ConditionPipelineOutput } from '../../c50/src/services/condition/conditionPipeline';

// Auth Views
import { SignInView } from './components/auth/SignInView';
import { SignUpView } from './components/auth/SignUpView';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView';

// Page Views
import { OpeningView } from './components/pages/OpeningView';
import { HomeView } from './components/pages/HomeView';
import { TestPipelineView } from './components/pages/TestPipelineView';
import { MedicView } from './components/pages/MedicView';
import { ReportsView } from './components/pages/ReportsView';
import { AiChatView } from './components/pages/AiChatView';
import { SettingsView } from './components/pages/SettingsView';
import { ProfileView } from './components/pages/ProfileView';
import { EmergencyView } from './components/pages/EmergencyView';
import { LoadingPage } from './components/pages/LoadingPage';
import { ThemeProvider as ShbThemeProvider } from '../../shb/src/context/ThemeContext';
import { DeviceProvider as ShbDeviceProvider } from '../../shb/src/context/DeviceContext';
import { ShbTestPage } from '../../shb/src/pages/ShbTestPage';
import { CribPage } from '../../crib/src/components/CribPage';
import { AndroidShbQaPage } from './qa/AndroidShbQaPage';

import type { NavigationTab } from './types';

type AuthScreenState = 'signin' | 'signup' | 'forgot-password';
type V1Route = 'home' | 'shb' | 'condition' | 'crib';

const resolveRouteFromLocation = (pathname: string): V1Route => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/shb' || normalized.endsWith('/shb')) return 'shb';
  if (normalized === '/condition' || normalized.endsWith('/condition')) return 'condition';
  if (normalized === '/crib' || normalized.endsWith('/crib')) return 'crib';
  return 'home';
};

const MainAppContent: React.FC = () => {
  const {
    authState,
    currentUser,
    userProfile,
    phbRecord,
    isProfileLoading,
    profileError,
    isConfigured,
    isFirebaseReady,
    signOut,
    retryLoadProfile,
  } = useAuth();

  const [v1Route, setV1Route] = useState<V1Route>(() => resolveRouteFromLocation(window.location.pathname));
  const navigateToRoute = React.useCallback((route: V1Route, search = '') => {
    const nextPath = `${route === 'home' ? '/home' : `/${route}`}${search}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setV1Route(route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  useEffect(() => {
    const handleRouteChange = () => setV1Route(resolveRouteFromLocation(window.location.pathname));
    window.addEventListener('popstate', handleRouteChange);
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/home');
      setV1Route('home');
    }
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  useEffect(() => {
    const handleNativeNotificationClick = (event: Event) => {
      const detail = (event as CustomEvent<{ destination?: string; type?: string }>).detail;
      const reportId = (event as CustomEvent<{ reportId?: string }>).detail?.reportId;
      const sourceUserUid = (event as CustomEvent<{ sourceUserUid?: string }>).detail?.sourceUserUid;
      if (reportId) window.sessionStorage.setItem('goatest:pending-report-id', reportId);
      if (sourceUserUid) window.sessionStorage.setItem('goatest:pending-report-source-uid', sourceUserUid);
      if (detail?.destination === 'emergency') {
        navigateToRoute('crib');
      } else if (detail?.destination === 'home') {
        navigateToRoute('home');
        setActiveTab('home');
        if (detail?.type === 'QA_REQUIRED') window.dispatchEvent(new CustomEvent('goatest:open-daily-qa', { detail }));
      } else {
        navigateToRoute('home');
        setActiveTab('reports');
      }
    };
    window.addEventListener('goatest:native-notification-click', handleNativeNotificationClick);
    return () => window.removeEventListener('goatest:native-notification-click', handleNativeNotificationClick);
  }, [navigateToRoute]);

  // Application Startup Pipeline State
  const [hasCompletedOpening, setHasCompletedOpening] = useState<boolean>(false);
  const handleOpeningComplete = React.useCallback(() => {
    setHasCompletedOpening(true);
  }, []);

  // Authentication Screen Sub-state
  const [authScreen, setAuthScreen] = useState<AuthScreenState>('signin');

  // Main Authenticated Navigation Tab
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [conditionOutput, setConditionOutput] = useState<ConditionPipelineOutput | null>(null);
  const [conditionPersistenceError, setConditionPersistenceError] = useState<string | null>(null);
  const persistedConditionReportIds = React.useRef(new Set<string>());
  const handleProceedToCondition = React.useCallback(async (output: ConditionPipelineOutput) => {
    setConditionOutput(output);
    setConditionPersistenceError(null);
    const reportId = output.report.reportId;
    if (!reportId || persistedConditionReportIds.current.has(reportId)) {
      navigateToRoute('condition');
      return;
    }
    persistedConditionReportIds.current.add(reportId);
    navigateToRoute('condition');
    void reportService.receiveConditionReport(output.report).catch((error: unknown) => {
      persistedConditionReportIds.current.delete(reportId);
      setConditionPersistenceError(error instanceof Error ? error.message : 'HOME report persistence failed.');
    });
  }, [navigateToRoute]);
  const navigate = (tab: NavigationTab) => {
    if (tab === 'test' || tab === 'shb') {
      navigateToRoute('shb');
      return;
    }
    if (tab === 'condition') {
      navigateToRoute('condition');
      return;
    }
    if (tab === 'emergency') {
      navigateToRoute('crib');
      return;
    }
    setActiveTab(tab);
  };

  const qaBuildEnabled = import.meta.env.MODE === 'android-qa';
  if (qaBuildEnabled) {
    return <AndroidShbQaPage />;
  }

  // 1. Mandatory Opening Page Pipeline (Black Animated GOATEST Splash)
  // The black animated GOATEST splash is the only startup splash screen.
  // It handles the letter-formation animation, minimum ~2.2s duration, and automatic continuation.
  const isAuthResolving = authState === 'AUTH_LOADING' || (!userProfile && isProfileLoading && !profileError);
  if (!hasCompletedOpening || isAuthResolving) {
    return (
      <OpeningView
        onComplete={handleOpeningComplete}
        isConfigured={isConfigured}
        isFirebaseReady={isFirebaseReady}
        isAuthPending={isAuthResolving}
      />
    );
  }

  if (authState === 'AUTH_SIGNED_OUT' || !currentUser) {
    return (
      <div className="w-full h-full flex flex-col justify-center px-4 overflow-y-auto bg-black">
        {authScreen === 'signin' && <SignInView onNavigateToSignUp={() => setAuthScreen('signup')} onNavigateToForgotPassword={() => setAuthScreen('forgot-password')} />}
        {authScreen === 'signup' && <SignUpView onNavigateToSignIn={() => setAuthScreen('signin')} />}
        {authScreen === 'forgot-password' && <ForgotPasswordView onBackToSignIn={() => setAuthScreen('signin')} />}
      </div>
    );
  }

  if (!userProfile && profileError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center bg-black">
        <h2 className="text-lg font-bold text-white mb-1">Unable to Connect</h2>
        <p className="text-xs text-zinc-400 mb-6">Could not connect to the account database.</p>
        <Button variant="primary" size="md" fullWidth onClick={retryLoadProfile}>Retry</Button>
      </div>
    );
  }

  if (v1Route === 'shb' || v1Route === 'condition') {
    return (
      <ShbThemeProvider>
        <main className="flex-1 flex flex-col w-full min-h-0 overflow-hidden">
          <div className={v1Route === 'condition' ? 'hidden' : 'flex flex-1 min-h-0'}>
            <ShbTestPage
              onExitToHome={() => navigateToRoute('home')}
              homePhb={phbRecord}
              homeUid={currentUser?.uid}
              onProceedToCondition={handleProceedToCondition}
            />
          </div>
          {v1Route === 'condition' && (
            <ConditionPage
              initialOutput={conditionOutput}
              onBackToCompare={() => navigateToRoute('shb')}
              onFinish={async () => {
                try {
                  // Ensure plugin initialized and permissions granted on Android
                  await androidNotificationService.initialize();
                  await androidNotificationService.show({
                    id: `report:${conditionOutput?.report.reportId ?? String(Date.now())}`,
                    title: 'Report Completed',
                    body: 'Your report has been generated successfully.',
                    type: 'SYSTEM',
                    userId: currentUser?.uid ?? '',
                    timestamp: new Date().toISOString(),
                    reportId: conditionOutput?.report.reportId ?? null,
                    actionTab: 'reports'
                  });
                } catch (e) {
                  // Ignore notification failures — still navigate home
                  console.warn('Notification error', e);
                } finally {
                  navigateToRoute('home');
                }
              }}
              persistenceError={conditionPersistenceError}
            />
          )}
        </main>
      </ShbThemeProvider>
    );
  }

  if (v1Route === 'crib') {
    return <CribPage onExitToHome={() => navigateToRoute('home')} authenticatedUid={currentUser?.uid} />;
  }

  // 4. Authenticated State -> Universal Mobile App Shell with Independent Content Scrolling
  return (
    <AppShell activeTab={activeTab} onNavigate={navigate}>
      {activeTab === 'home' && <HomeView onNavigate={navigate} />}
      {activeTab === 'test' && <TestPipelineView />}
      {activeTab === 'condition' && (
        <ConditionPage
          persistenceError={conditionPersistenceError}
        />
      )}
      {activeTab === 'medic' && <MedicView />}
      {activeTab === 'reports' && (
        <ReportsView onNavigateToTest={() => navigate('test')} />
      )}
      {activeTab === 'ai' && <AiChatView onNavigate={setActiveTab} />}
      {activeTab === 'settings' && (
        <SettingsView
          onSignOut={signOut}
        />
      )}
      {activeTab === 'profile' && (
        <ProfileView
          onNavigate={setActiveTab}
          onSignOut={signOut}
        />
      )}
      {activeTab === 'phb' && (
        <LoadingPage title="PHB" subtext="Loading..." onBack={() => setActiveTab('home')} />
      )}
      {activeTab === 'emergency' && (
        <EmergencyView onBack={() => setActiveTab('home')} />
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ShbDeviceProvider>
            <MobileFrame>
              <MainAppContent />
            </MobileFrame>
          </ShbDeviceProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
