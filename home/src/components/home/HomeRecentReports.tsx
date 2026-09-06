/**
 * GOATEST Recent Reports & Hierarchy Component
 * 
 * PMT-3: Comprehensive Home Report Record & Hierarchy Pipeline
 * - Connects TEST, DAY, WEEK, MONTH records from Firestore.
 * - Displays accurate Report Availability & C50 ML availability.
 * - Shows QA session completion progress for Day records.
 * - ZERO fabricated reports or dummy metrics.
 * - Meaningful empty states for all levels.
 * - Full universal theme contrast adaptation.
 */

import React, { useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SectionHeader } from '../ui/PageHeader';
import { Dialog } from '../ui/Dialog';
import {
  FileText,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Layers,
  Calendar,
  CalendarDays,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import type {
  ReportItem,
  HomeReportHierarchyData,
  HomeDaySummary,
  HomeWeekSummary,
  HomeMonthSummary,
  HomeTestSummary,
} from '../../types';

export interface HomeRecentReportsProps {
  reports: ReportItem[];
  hierarchyData?: HomeReportHierarchyData;
  reportsError?: string | null;
  onViewReports: () => void;
  onOpenReportDetail?: (report: ReportItem) => void;
  onRefresh?: () => void;
}

type TabFilter = 'all' | 'day' | 'week' | 'month' | 'test';

export const HomeRecentReports: React.FC<HomeRecentReportsProps> = ({
  reports,
  hierarchyData,
  reportsError,
  onViewReports,
  onOpenReportDetail,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [openTestDates, setOpenTestDates] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<{
    type: 'TEST' | 'DAY' | 'WEEK' | 'MONTH' | 'REPORT';
    title: string;
    date: string;
    status: string;
    reportAvailable: boolean;
    c50Status?: string;
    details: Array<{ label: string; value: string }>;
    isFixture?: boolean;
  } | null>(null);

  const tests = hierarchyData?.tests || [];
  const days = hierarchyData?.days || [];
  const weeks = hierarchyData?.weeks || [];
  const months = hierarchyData?.months || [];
  const dbStatus = hierarchyData?.status;

  const reportDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const reportsByDate = useMemo(() => {
    const groups = new Map<string, ReportItem[]>();
    reports.filter((report) => report.reportType === 'TEST').forEach((report) => {
      const date = reportDate(report.timestamp);
      groups.set(date, [...(groups.get(date) || []), report]);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [reports]);
  const testsByDate = useMemo(() => {
    const groups = new Map<string, HomeTestSummary[]>();
    tests.forEach((test) => {
      const date = reportDate(test.timestamp);
      groups.set(date, [...(groups.get(date) || []), test]);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [tests]);
  const isTestDateOpen = (date: string, _firstDate: string) => openTestDates.includes(date);
  const toggleTestDate = (date: string) => setOpenTestDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date]);

  const handleOpenTestModal = (test: HomeTestSummary) => {
    setSelectedRecord({
      type: 'TEST',
      title: `${test.target} Test Record`,
      date: new Date(test.timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: test.status,
      reportAvailable: test.reportAvailable,
      c50Status: test.c50Status,
      isFixture: test.isFixture,
      details: [
        { label: 'Test ID', value: test.testId },
        { label: 'Target / Organ', value: test.target },
        { label: 'Completion State', value: test.status },
        {
          label: 'Derived Report',
          value: test.reportAvailable
            ? 'Report Generated'
            : 'Pending Generation',
        },
        {
          label: 'C50 ML State',
          value:
            test.c50Status === 'C50_AVAILABLE'
              ? 'Result Available'
              : test.c50Status === 'C50_PROCESSING'
              ? 'Processing'
              : 'Standby / Pending',
        },
      ],
    });
  };

  const handleOpenDayModal = (day: HomeDaySummary) => {
    setSelectedRecord({
      type: 'DAY',
      title: `Daily Record (${day.date})`,
      date: day.date,
      status: day.dayStatus,
      reportAvailable: day.reportAvailable,
      c50Status: day.c50Status,
      isFixture: day.isFixture,
      details: [
        { label: 'Day ID', value: day.dayId },
        {
          label: 'Tests Completed',
          value: `${day.testCount} of 3 target tests`,
        },
        {
          label: 'Daily QA Progress',
          value:
            day.qaStatus === 'QA_COMPLETED'
              ? '10 of 10 Questions Completed'
              : day.qaStatus === 'QA_IN_PROGRESS'
              ? `${day.qaCompletedCount} of ${day.qaTotalQuestions} Answered`
              : 'Not Started',
        },
        {
          label: 'Day Status',
          value:
            day.dayStatus === 'REPORT_AVAILABLE'
              ? 'Report Available'
              : day.dayStatus === 'READY'
              ? 'Ready for Synthesis'
              : day.dayStatus === 'IN_PROGRESS'
              ? 'In Progress'
              : 'Not Ready',
        },
        {
          label: 'C50 ML State',
          value:
            day.c50Status === 'C50_AVAILABLE'
              ? 'Result Available'
              : day.c50Status === 'C50_PROCESSING'
              ? 'Processing'
              : 'Standby',
        },
      ],
    });
  };

  const handleOpenWeekModal = (week: HomeWeekSummary) => {
    setSelectedRecord({
      type: 'WEEK',
      title: `Weekly Record (${week.weekStart})`,
      date: `${week.weekStart} to ${week.weekEnd}`,
      status: week.reportAvailable ? 'REPORT_AVAILABLE' : 'RECORDED',
      reportAvailable: week.reportAvailable,
      c50Status: week.c50Status,
      isFixture: week.isFixture,
      details: [
        { label: 'Week ID', value: week.weekId },
        { label: 'Date Range', value: `${week.weekStart} to ${week.weekEnd}` },
        {
          label: 'Linked Days',
          value: `${week.completedDaysCount} recorded days`,
        },
        {
          label: 'Report State',
          value: week.reportAvailable
            ? 'Report Generated'
            : 'Standby / Pending',
        },
        {
          label: 'C50 Longitudinal State',
          value:
            week.c50Status === 'C50_AVAILABLE'
              ? 'Result Available'
              : 'Standby',
        },
      ],
    });
  };

  const handleOpenMonthModal = (month: HomeMonthSummary) => {
    setSelectedRecord({
      type: 'MONTH',
      title: `Monthly Record (${month.month}/${month.year})`,
      date: `${month.month}/${month.year}`,
      status: month.reportAvailable ? 'REPORT_AVAILABLE' : 'RECORDED',
      reportAvailable: month.reportAvailable,
      c50Status: month.c50Status,
      isFixture: month.isFixture,
      details: [
        { label: 'Month ID', value: month.monthId },
        { label: 'Period', value: `${month.month}/${month.year}` },
        {
          label: 'Linked Weeks',
          value: `${month.completedWeeksCount} recorded weeks`,
        },
        {
          label: 'Report State',
          value: month.reportAvailable
            ? 'Report Generated'
            : 'Standby / Pending',
        },
        {
          label: 'C50 Trend State',
          value:
            month.c50Status === 'C50_AVAILABLE'
              ? 'Result Available'
              : 'Standby',
        },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-2.5 text-left">
      <SectionHeader
        title="GOATEST REPORTS"
        titleClassName="text-[#ffffff]"
        subtitle="Hierarchy & assessment archives"
        action={
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh Records"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onViewReports}
              className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Database Status Notice if Error or Offline */}
      {dbStatus === 'DATABASE_ERROR' && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-300">
            <p className="font-semibold">Database Standby</p>
            <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-400">
              Could not sync cloud records. Local state remains preserved.
            </p>
          </div>
        </div>
      )}

      {dbStatus === 'PERMISSION_ERROR' && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <p className="font-semibold">Permission Restricted</p>
            <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-400">
              Authenticated user permissions required for private records.
            </p>
          </div>
        </div>
      )}

      {reportsError && dbStatus !== 'PERMISSION_ERROR' && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-300">
            <p className="font-semibold">Reports unavailable</p>
            <p className="text-[11px] mt-0.5">Firebase could not load reports. Try Refresh Records.</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#90a4ae] border border-[#263238] text-xs font-semibold overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-[11px] ${
            activeTab === 'all'
              ? 'bg-[#263238] text-white shadow-xs font-bold'
              : 'text-[#263238] hover:bg-[#78909c]'
          }`}
        >
          All Reports ({reports.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('day')}
          className={`hidden px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-[11px] flex items-center gap-1 ${
            activeTab === 'day'
              ? 'bg-[#263238] text-white shadow-xs font-bold'
              : 'text-[#263238] hover:bg-[#78909c]'
          }`}
        >
          <Calendar className="w-3 h-3" />
          <span>Days ({days.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('week')}
          className={`hidden px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-[11px] flex items-center gap-1 ${
            activeTab === 'week'
              ? 'bg-[#263238] text-white shadow-xs font-bold'
              : 'text-[#263238] hover:bg-[#78909c]'
          }`}
        >
          <CalendarDays className="w-3 h-3" />
          <span>Weeks ({weeks.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('month')}
          className={`hidden px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-[11px] flex items-center gap-1 ${
            activeTab === 'month'
              ? 'bg-[#263238] text-white shadow-xs font-bold'
              : 'text-[#263238] hover:bg-[#78909c]'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Months ({months.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('test')}
          className={`hidden px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-[11px] flex items-center gap-1 ${
            activeTab === 'test'
              ? 'bg-[#263238] text-white shadow-xs font-bold'
              : 'text-[#263238] hover:bg-[#78909c]'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>Tests ({tests.length})</span>
        </button>
      </div>

      {/* 1. ALL REPORTS TAB */}
      {activeTab === 'all' && (
        <>
          {reports.length === 0 ? (
            <Card
              padding="md"
              className="flex flex-col items-center justify-center py-6 text-center shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[#263238]">
                No reports available yet
              </h4>
              <p className="text-xs text-[#37474f] font-medium mt-1 max-w-[240px] leading-relaxed">
                Assessment summaries and logs will appear here once tests are
                completed.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={onViewReports}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                className="mt-3.5 text-xs bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
              >
                View Reports
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {reportsByDate.map(([date, dateReports]) => {
                const isOpen = isTestDateOpen(date, reportsByDate[0][0]);
                return (
                  <div key={date} className="rounded-xl border border-[#263238] overflow-hidden">
                    <button type="button" onClick={() => toggleTestDate(date)} className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#90a4ae] text-left">
                      <span className="text-[11px] font-bold text-[#263238]">TESTS ON {new Date(`${date}T12:00:00`).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} ({dateReports.length})</span>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[#263238]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#263238]" />}
                    </button>
                    {isOpen && <div className="flex flex-col gap-1 p-1.5 bg-[#78909c]">
                      {dateReports.map((report) => (
                        <Card key={report.id} padding="sm" variant="interactive" onClick={() => onOpenReportDetail ? onOpenReportDetail(report) : onViewReports()} className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]">
                          <div className="min-w-0 text-left"><div className="text-xs font-bold truncate">{report.summary || report.category}</div><div className="text-[10px] text-[#37474f]">{new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>
                          <ChevronRight className="w-4 h-4 text-[#263238] shrink-0 ml-2" />
                        </Card>
                      ))}
                    </div>}
                  </div>
                );
              })}
              {reports.filter((report) => report.reportType !== 'TEST').map((report) => (
                <Card
                  key={report.id}
                  padding="sm"
                  variant="interactive"
                  onClick={() =>
                    onOpenReportDetail
                      ? onOpenReportDetail(report)
                      : onViewReports()
                  }
                  className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[#263238]" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#263238] truncate">
                          {report.category}
                        </span>
                        {report.isFixture && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-800 text-amber-100 border border-amber-950 uppercase">
                            Fixture
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#37474f]">
                          {new Date(report.timestamp).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#37474f] font-medium truncate">
                        {report.summary || 'Assessment record archived.'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#263238] shrink-0 ml-2" />
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* 2. DAYS TAB */}
      {activeTab === 'day' && (
        <div className="flex flex-col gap-2">
          {days.length === 0 ? (
            <Card
              padding="md"
              className="flex flex-col items-center justify-center py-6 text-center shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
            >
              <Calendar className="w-8 h-8 text-[#263238] mb-2" />
              <h4 className="text-xs font-bold text-[#263238]">
                No daily records yet
              </h4>
              <p className="text-xs text-[#37474f] font-medium mt-1 max-w-[240px]">
                Daily records aggregate up to 3 tests and daily QA responses.
              </p>
            </Card>
          ) : (
            days.map((day) => (
              <Card
                key={day.dayId}
                padding="sm"
                variant="interactive"
                onClick={() => handleOpenDayModal(day)}
                className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center shrink-0 font-bold text-xs">
                    <Calendar className="w-4 h-4 text-[#263238]" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#263238]">
                        {day.date}
                      </span>
                      {day.isFixture && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-800 text-amber-100 border border-amber-950 uppercase">
                          Fixture
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#37474f] font-medium">
                      <span>{day.testCount}/3 Tests</span>
                      <span>•</span>
                      <span>
                        {day.qaStatus === 'QA_COMPLETED'
                          ? 'QA Complete'
                          : day.qaStatus === 'QA_IN_PROGRESS'
                          ? 'QA In Progress'
                          : 'QA Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border ${
                      day.reportAvailable
                        ? 'bg-emerald-800 text-emerald-100 border-emerald-950'
                        : 'bg-[#78909c] text-[#263238] border-[#263238]'
                    }`}
                  >
                    {day.reportAvailable ? 'Report Ready' : 'Report Standby'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#263238]" />
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 3. WEEKS TAB */}
      {activeTab === 'week' && (
        <div className="flex flex-col gap-2">
          {weeks.length === 0 ? (
            <Card
              padding="md"
              className="flex flex-col items-center justify-center py-6 text-center shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
            >
              <CalendarDays className="w-8 h-8 text-[#263238] mb-2" />
              <h4 className="text-xs font-bold text-[#263238]">
                No weekly records yet
              </h4>
              <p className="text-xs text-[#37474f] font-medium mt-1 max-w-[240px]">
                Weekly records summarize day records and multi-day trends.
              </p>
            </Card>
          ) : (
            weeks.map((week) => (
              <Card
                key={week.weekId}
                padding="sm"
                variant="interactive"
                onClick={() => handleOpenWeekModal(week)}
                className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-[#263238]" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#263238]">
                        {week.weekStart}
                      </span>
                      {week.isFixture && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-800 text-amber-100 border border-amber-950 uppercase">
                          Fixture
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#37474f] font-medium mt-0.5">
                      {week.completedDaysCount} recorded days
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border ${
                      week.reportAvailable
                        ? 'bg-emerald-800 text-emerald-100 border-emerald-950'
                        : 'bg-[#78909c] text-[#263238] border-[#263238]'
                    }`}
                  >
                    {week.reportAvailable ? 'Report Ready' : 'Report Standby'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#263238]" />
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 4. MONTHS TAB */}
      {activeTab === 'month' && (
        <div className="flex flex-col gap-2">
          {months.length === 0 ? (
            <Card
              padding="md"
              className="flex flex-col items-center justify-center py-6 text-center shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
            >
              <Layers className="w-8 h-8 text-[#263238] mb-2" />
              <h4 className="text-xs font-bold text-[#263238]">
                No monthly records yet
              </h4>
              <p className="text-xs text-[#37474f] font-medium mt-1 max-w-[240px]">
                Monthly records aggregate weeks for longitudinal analysis.
              </p>
            </Card>
          ) : (
            months.map((month) => (
              <Card
                key={month.monthId}
                padding="sm"
                variant="interactive"
                onClick={() => handleOpenMonthModal(month)}
                className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-[#263238]" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#263238]">
                        {month.month}/{month.year}
                      </span>
                      {month.isFixture && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-800 text-amber-100 border border-amber-950 uppercase">
                          Fixture
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#37474f] font-medium mt-0.5">
                      {month.completedWeeksCount} recorded weeks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border ${
                      month.reportAvailable
                        ? 'bg-emerald-800 text-emerald-100 border-emerald-950'
                        : 'bg-[#78909c] text-[#263238] border-[#263238]'
                    }`}
                  >
                    {month.reportAvailable ? 'Report Ready' : 'Report Standby'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#263238]" />
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 5. TESTS TAB */}
      {activeTab === 'test' && (
        <div className="flex flex-col gap-2">
          {tests.length === 0 ? (
            <Card
              padding="md"
              className="flex flex-col items-center justify-center py-6 text-center shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
            >
              <Activity className="w-8 h-8 text-[#263238] mb-2" />
              <h4 className="text-xs font-bold text-[#263238]">
                No raw test records yet
              </h4>
              <p className="text-xs text-[#37474f] font-medium mt-1 max-w-[240px]">
                Completed biological sensor tests will appear here.
              </p>
            </Card>
          ) : (
            testsByDate.flatMap(([date, dateTests], dateIndex) => [
              <button key={`${date}-header`} type="button" onClick={() => toggleTestDate(date)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#90a4ae] border border-[#263238] text-left">
                <span className="text-[11px] font-bold text-[#263238]">TESTS ON {new Date(`${date}T12:00:00`).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} ({dateTests.length})</span>
                {isTestDateOpen(date, testsByDate[0][0]) ? <ChevronDown className="w-3.5 h-3.5 text-[#263238]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#263238]" />}
              </button>,
              ...(isTestDateOpen(date, testsByDate[0][0]) ? dateTests.map((test) => (
              <Card
                key={test.testId}
                padding="sm"
                variant="interactive"
                onClick={() => handleOpenTestModal(test)}
                className="flex items-center justify-between shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-[#263238]" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#263238] truncate">
                        {test.target}
                      </span>
                      {test.isFixture && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-800 text-amber-100 border border-amber-950 uppercase">
                          Fixture
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#37474f] font-medium mt-0.5">
                      {new Date(test.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border ${
                      test.reportAvailable
                        ? 'bg-emerald-800 text-emerald-100 border-emerald-950'
                        : 'bg-[#78909c] text-[#263238] border-[#263238]'
                    }`}
                  >
                    {test.reportAvailable ? 'Report Ready' : 'Raw Test'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#263238]" />
                </div>
              </Card>
            )) : [])
            ])
          )}
        </div>
      )}

      {/* Record Hierarchy Inspection Dialog (Safe UI - Zero Raw Machine JSON) */}
      <Dialog
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord?.title || 'RECORD DETAILS'}
        description={`Record Level: ${selectedRecord?.type || ''}`}
      >
        {selectedRecord && (
          <div className="flex flex-col gap-3 py-2 text-left">
            {selectedRecord.isFixture && (
              <div className="p-2.5 rounded-xl bg-amber-800 text-amber-100 border border-amber-950 text-xs">
                <span className="font-bold uppercase tracking-wider text-[10px]">
                  Development Test Fixture
                </span>
                <p className="text-[11px] mt-0.5 text-amber-100 font-medium">
                  This record is an isolated non-clinical test fixture for
                  pipeline validation.
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#78909c] border border-[#263238] space-y-2 text-[#263238]">
              {selectedRecord.details.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-0.5 border-b border-[#263238]/30 last:border-0"
                >
                  <span className="text-[#37474f] font-semibold">
                    {item.label}
                  </span>
                  <span className="font-bold text-[#263238] max-w-[180px] truncate text-right">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecord(null)}
                className="bg-[#78909c] text-[#263238] border-[#263238]"
              >
                Close
              </Button>
              {selectedRecord.reportAvailable && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedRecord(null);
                    onViewReports();
                  }}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  className="bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
                >
                  Open Report
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
