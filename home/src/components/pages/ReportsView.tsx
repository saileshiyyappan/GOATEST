/**
 * GOATEST Reports View
 * 
 * PMT-4: Full-fidelity readable report repository & management:
 * - Real Firestore & local database retrieval via reportDatabaseService
 * - Auto-triggers derived report generation for completed tests/days/weeks/months
 * - Multi-tier filtering: All / Test / Daily / Weekly / Monthly
 * - Full ReportViewerModal with parameter graphs, deviations, trends, and exact C50 labels
 * - Interactive DailyQaRunnerModal launcher for completing daily 10-question Q/A
 * - Real empty state and loading pipeline states (zero fake health reports)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState } from '../ui/EmptyState';
import { ReportViewerModal } from '../reports/ReportViewerModal';
import { DailyQaRunnerModal } from '../reports/DailyQaRunnerModal';
import { reportDatabaseService } from '../../services/reportDatabaseService';
import { localCalendarDate } from '../../services/dayAggregationService';
import {
  FileText,
  Calendar,
  Layers,
  Sparkles,
  Cpu,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ArrowLeft,
} from 'lucide-react';
import type { ReportRecord, ReportType, MonitoredUser } from '../../types';

export interface ReportsViewProps {
  onNavigateToTest: () => void;
}

type FilterType = 'all' | 'TEST' | 'DAY' | 'WEEK' | 'MONTH';

export const ReportsView: React.FC<ReportsViewProps> = ({ onNavigateToTest }) => {
  const { currentUser, userProfile, role, isLoading: isAuthLoading, authState } = useAuth();
  const isCaretaker = role === 'CARETAKER' || userProfile?.role === 'CARETAKER';

  // Caretaker target state: 'SELF' for caretaker's own reports or a specific MonitoredUser
  const [selectedTarget, setSelectedTarget] = useState<'SELF' | MonitoredUser>('SELF');
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Derive monitored users list with fallback from monitoredUserIds
  const monitoredList: MonitoredUser[] = useMemo(() => {
    const list = userProfile?.monitoredUsers ? [...userProfile.monitoredUsers] : [];
    if (userProfile?.monitoredUserIds) {
      userProfile.monitoredUserIds.forEach((uid) => {
        if (!list.some((u) => u.firebaseUid === uid || u.uniqueId === uid)) {
          list.push({
            name: 'User',
            uniqueId: uid,
            firebaseUid: uid,
          });
        }
      });
    }
    return list;
  }, [userProfile?.monitoredUsers, userProfile?.monitoredUserIds]);

  const activeTargetUid =
    selectedTarget === 'SELF'
      ? currentUser?.uid || userProfile?.uid || ''
      : selectedTarget.firebaseUid;

  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [dateSearch, setDateSearch] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);

  // Daily QA Modal
  const [isQaRunnerOpen, setIsQaRunnerOpen] = useState<boolean>(false);
  const [todayDayId, setTodayDayId] = useState<string>('');

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setIsSelectorOpen(false);
      }
    };
    if (isSelectorOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isSelectorOpen]);

  const loadReports = useCallback(async () => {
    if (!activeTargetUid || isAuthLoading || authState === 'AUTH_LOADING') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch authoritative reports from canonical Firestore collections.
      const userReports = await reportDatabaseService.getUserConditionReports(activeTargetUid);
      setReports(userReports);
      const pendingReportId = typeof window !== 'undefined' ? window.sessionStorage.getItem('goatest:pending-report-id') : null;
      const pendingReport = pendingReportId ? userReports.find((report) => report.reportId === pendingReportId) : null;
      if (pendingReport) {
        window.sessionStorage.removeItem('goatest:pending-report-id');
        setSelectedReport(pendingReport);
        setIsViewerOpen(true);
      }

      // 3. Find today's dayId
      const todayDateStr = localCalendarDate(new Date());
      const todayDayRecord = await reportDatabaseService.getDayRecordByDate(todayDateStr, activeTargetUid);
      if (todayDayRecord) {
        setTodayDayId(todayDayRecord.dayId);
      } else {
        setTodayDayId(`day_${todayDateStr}`);
      }
    } catch (err) {
      console.warn('[ReportsView] Error fetching reports:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTargetUid, selectedTarget, isAuthLoading, authState]);

  useEffect(() => {
    const pendingSourceUid = typeof window !== 'undefined' ? window.sessionStorage.getItem('goatest:pending-report-source-uid') : null;
    if (pendingSourceUid) {
      const target = monitoredList.find((user) => user.firebaseUid === pendingSourceUid);
      if (target) {
        window.sessionStorage.removeItem('goatest:pending-report-source-uid');
        setSelectedTarget(target);
      }
    }
  }, [monitoredList]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!activeTargetUid || isAuthLoading || authState === 'AUTH_LOADING') return;
    return reportDatabaseService.subscribeUserConditionReports(activeTargetUid, undefined, setReports, (error) => {
      console.warn('[ReportsView] Realtime report listener unavailable:', error.message);
    });
  }, [activeTargetUid, isAuthLoading, authState]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadReports();
  };

  const handleOpenReport = (report: ReportRecord) => {
    setSelectedReport(report);
    setIsViewerOpen(true);
  };

  const filteredReports = reports.filter((r) => (filter === 'all' || r.reportType === filter) && (!dateSearch || [r.generatedAt, r.date, r.assessmentDate, r.periodStart, r.periodEnd]
    .filter(Boolean)
    .some((value) => localCalendarDate(new Date(value as string)) === dateSearch)));

  const testsByDate = useMemo(() => {
    const groups = new Map<string, ReportRecord[]>();
    filteredReports.filter((report) => report.reportType === 'TEST').forEach((report) => {
      const date = localCalendarDate(new Date(report.generatedAt));
      const existing = groups.get(date) || [];
      existing.push(report);
      groups.set(date, existing);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredReports]);

  const [openTestDates, setOpenTestDates] = useState<string[]>([]);
  const toggleTestDate = (date: string) => {
    setOpenTestDates((current) => current.includes(date)
      ? current.filter((item) => item !== date)
      : [...current, date]);
  };

  const getBadgeClass = (type: ReportType) => {
    switch (type) {
      case 'DAY':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
      case 'WEEK':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
      case 'MONTH':
        return 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
      case 'TEST':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
    }
  };

  const renderReportCard = (report: ReportRecord) => {
    const dateFormatted = new Date(report.generatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const rawC50Label = report.readableContent?.metricsSummary?.c50Label;
    const c50Label = typeof rawC50Label === 'string' || typeof rawC50Label === 'number' ? String(rawC50Label) : null;
    const hasC50 = !!c50Label && c50Label !== 'C50 result not available';
    return (
      <div key={report.reportId} onClick={() => handleOpenReport(report)} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer shadow-xs flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getBadgeClass(report.reportType)}`}>{report.reportType}</span>
            {report.isFixture && <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">FIXTURE</span>}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">{dateFormatted} · {timeFormatted}</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">{report.title}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed break-words">{report.readableContent?.summary}</p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className={`flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 min-w-0 ${hasC50 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'italic'}`}><Cpu className="w-3.5 h-3.5 shrink-0" />{c50Label || 'C50 standby'}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">View Report <ChevronRight className="w-4 h-4" /></span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 text-left pb-6">
      {/* Header with Caretaker Report Selector */}
      <div className="flex items-center justify-between relative" ref={selectorRef}>
        {isCaretaker ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all text-left shadow-xs cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedTarget === 'SELF' ? 'REPORT' : `User: ${selectedTarget.name}`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSelectorOpen ? 'rotate-180' : ''}`} />
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {selectedTarget === 'SELF' ? 'Caretaker Report' : `ID: ${selectedTarget.uniqueId}`}
                </div>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isSelectorOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-30">
                <div className="px-3.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Report Mode
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTarget('SELF');
                    setIsSelectorOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors ${
                    selectedTarget === 'SELF'
                      ? 'text-[var(--color-accent)] bg-slate-50 dark:bg-slate-800/40'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Caretaker Report</span>
                  </div>
                  {selectedTarget === 'SELF' && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800 my-1 px-3.5 pt-2 pb-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Monitored Users</span>
                  <span>{monitoredList.length}</span>
                </div>

                {monitoredList.length === 0 ? (
                  <div className="px-3.5 py-2 text-xs text-slate-400 italic">
                    No monitored users linked yet
                  </div>
                ) : (
                  monitoredList.map((user) => {
                    const isSelected = selectedTarget !== 'SELF' && selectedTarget.firebaseUid === user.firebaseUid;
                    return (
                      <button
                        key={user.firebaseUid || user.uniqueId}
                        type="button"
                        onClick={() => {
                          setSelectedTarget(user);
                          setIsSelectorOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors ${
                          isSelected
                            ? 'text-[var(--color-accent)] bg-slate-50 dark:bg-slate-800/40'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            User: {user.name} — <span className="font-bold">{user.uniqueId}</span>
                          </span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[var(--color-accent)]" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          <PageHeader
            title="GOATEST REPORTS"
            subtitle="Derived physiological assessments & C50 evaluations"
          />
        )}

        <div className="flex items-center gap-2">
          {/* VIEW USER Quick Action for Caretakers */}
          {isCaretaker && monitoredList.length > 0 && selectedTarget === 'SELF' && (
            <button
              type="button"
              onClick={() => setSelectedTarget(monitoredList[0])}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="View Monitored User Report"
            >
              VIEW USER
            </button>
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Caretaker Monitored User Context Banner */}
      {isCaretaker && selectedTarget !== 'SELF' && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="text-slate-600 dark:text-slate-400">Viewing Report for: </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{selectedTarget.name}</span>{' '}
              <span className="font-mono text-amber-600 dark:text-amber-400">({selectedTarget.uniqueId})</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTarget('SELF')}
            className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs cursor-pointer"
          >
            Caretaker Report
          </button>
        </div>
      )}

      {/* Daily QA Banner Card (Shown for own user or caretaker self) */}
      {selectedTarget === 'SELF' && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                Daily Health Q/A Context
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                10 dynamic contextual questions required for complete Day reports
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsQaRunnerOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 shadow-xs transition-colors"
          >
            Open Q/A
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold overflow-x-auto no-scrollbar">
        {(['all', 'TEST', 'DAY', 'WEEK', 'MONTH'] as const).map((tabKey) => {
          const labels: Record<FilterType, string> = { all: 'All Reports', TEST: 'Test', DAY: 'Day', WEEK: 'Week', MONTH: 'Month' };
          return <button key={tabKey} type="button" onClick={() => setFilter(tabKey)} className={`flex-1 py-1.5 px-2.5 rounded-lg whitespace-nowrap ${filter === tabKey ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{labels[tabKey]}</button>;
        })}
      </div>

      {/* Frontend-only date search */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
        <label htmlFor="report-date-search" className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
          Search date
        </label>
        <input
          id="report-date-search"
          type="date"
          value={dateSearch}
          onChange={(event) => setDateSearch(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 outline-none"
        />
        {dateSearch && (
          <button type="button" onClick={() => setDateSearch('')} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Clear
          </button>
        )}
      </div>

      {/* Content Stream */}
      {isLoading ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse h-24"
            />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6 text-slate-400" />}
          title={
            selectedTarget !== 'SELF'
              ? `No reports yet for ${selectedTarget.name}`
              : dateSearch
              ? 'No reports found for this date'
              : 'No reports yet'
          }
          description={
            selectedTarget !== 'SELF'
              ? `Authorized assessments for ${selectedTarget.name} (${selectedTarget.uniqueId}) will appear here once submitted.`
              : 'Completed health assessments and daily Q/A sessions will automatically generate readable reports here.'
          }
          actionLabel={selectedTarget === 'SELF' ? 'Start Test' : undefined}
          onAction={selectedTarget === 'SELF' ? onNavigateToTest : undefined}
          className="my-6"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {testsByDate.length > 0 && (
            <div className="flex flex-col gap-2">
              {testsByDate.map(([date, dateReports]) => {
                const isOpen = openTestDates.includes(date);
                const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
                return (
                  <div key={date} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                    <button type="button" onClick={() => toggleTestDate(date)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">TESTS ON {dateLabel.toUpperCase()} <span className="text-slate-400">({dateReports.length})</span></span>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 p-2">
                        {dateReports.map((report) => renderReportCard(report))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {filteredReports.filter((report) => report.reportType !== 'TEST').map((report) => renderReportCard(report))}
        </div>
      )}

      {/* Report Viewer Modal */}
      <ReportViewerModal
        report={selectedReport}
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedReport(null);
        }}
      />

      {/* Daily QA Runner Modal */}
      <DailyQaRunnerModal
        userId={activeTargetUid}
        dayId={todayDayId || `day_${localCalendarDate(new Date())}`}
        isOpen={isQaRunnerOpen}
        onClose={() => setIsQaRunnerOpen(false)}
        onSessionComplete={() => {
          loadReports();
        }}
      />
    </div>
  );
};
/*
            const dateFormatted = new Date(report.generatedAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeFormatted = new Date(report.generatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const rawC50Label = report.readableContent?.metricsSummary?.c50Label;
            const c50Label = typeof rawC50Label === 'string' || typeof rawC50Label === 'number'
              ? String(rawC50Label)
              : null;
            const hasC50 = !!c50Label && c50Label !== 'C50 result not available';

            return (
              <div
                key={report.reportId}
                onClick={() => handleOpenReport(report)}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer shadow-xs flex flex-col gap-2.5"
              >
                Top Row: Badge & Timestamp
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getBadgeClass(
                        report.reportType
                      )}`}
                    >
                      {report.reportType}
                    </span>
                    {report.isFixture && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                        FIXTURE
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {dateFormatted} · {timeFormatted}
                  </span>
                </div>

                Title & Summary
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {report.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {report.readableContent?.summary}
                  </p>
                </div>

                Bottom Meta & C50 Banner
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span className={hasC50 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'italic'}>
                        {c50Label || 'C50 standby'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>View Report</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      Report Viewer Modal (duplicate block)
      <ReportViewerModal
        report={selectedReport}
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedReport(null);
        }}
      />

      Daily QA Runner Modal (duplicate block)
      <DailyQaRunnerModal
        userId={activeTargetUid}
        dayId={todayDayId || `day_${localCalendarDate(new Date())}`}
        isOpen={isQaRunnerOpen}
        onClose={() => setIsQaRunnerOpen(false)}
        onSessionComplete={() => {
          loadReports();
        }}
      />
    </div>
  );
};
*/
