/**
 * GOATEST Report Viewer Modal
 * 
 * PMT-4: High-fidelity mobile-first report inspection viewer.
 * 
 * FEATURES:
 * - Milestone tier badges (TEST / DAY / WEEK / MONTH)
 * - Exact C50 ML result label & confidence (or explicit "C50 result not available")
 * - Executive readable summary & findings
 * - Interactive parameter comparison & trend charts from visualizationData
 * - Q/A context summary (for Day/Week/Month)
 * - Immutable raw source reference linkage (zero data loss)
 * - Dark/light responsive theme contract
 */

import React, { useEffect, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { ReportCharts } from './ReportCharts';
import logoUrl from '../../assets/goatest-logo.png';
import type { ReportRecord, TestRecord } from '../../types';
import { reportDatabaseService } from '../../services/reportDatabaseService';
import { pdfExportService } from '../../services/pdfExportService';
import { buildShortReportSummary } from '../../services/shortReportSummaryService';
import {
  X,
  FileText,
  Calendar,
  Cpu,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  Database,
  Printer,
  Download,
} from 'lucide-react';

export interface ReportViewerModalProps {
  report: ReportRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

const graphTraceReferences = (value: unknown, path = 'report', output: Array<{ path: string; value: unknown }> = []) => {
  if (!value || typeof value !== 'object' || output.length >= 200) return output;
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const childPath = `${path}.${key}`;
    if (/(id|ids|reference|source|observation|session|report)/i.test(key) && (typeof child === 'string' || Array.isArray(child))) output.push({ path: childPath, value: child });
    if (child && typeof child === 'object') graphTraceReferences(child, childPath, output);
  });
  return output;
};

const traceGraphTest = (source: string, test: TestRecord | null) => {
  const raw = test?.rawData as Record<string, any> | undefined;
  const packet = raw?.cmPacket;
  const parameters = packet?.parameters;
  const rows = Array.isArray(parameters) ? parameters : parameters && typeof parameters === 'object' ? Object.values(parameters) : [];
  console.info('[GRAPH TRACE TEST]', {
    source,
    testId: test?.testId || null,
    sessionId: test?.sessionId || null,
    reportReference: test?.reportReference || null,
    timestamp: test?.timestamp || null,
    rawData: !!raw,
    cmPacket: !!packet,
    parameterCount: rows.length,
    parameters: rows.map((row: any) => ({ name: row?.name, parameterId: row?.parameterId, id: row?.id, shbValue: row?.shbValue })),
  });
};
const localDate = (value: string | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const reportToTestRecord = (sourceReport: ReportRecord): TestRecord | null => {
  const payload = sourceReport as ReportRecord & Record<string, any>;
  const metrics = sourceReport.readableContent?.metricsSummary as Record<string, any> | undefined;
  const sourceCmPacket = metrics?.sourceCmPacket || payload.sourceCmPacket;
  if (!sourceCmPacket || typeof sourceCmPacket !== 'object') return null;
  const testId = sourceReport.referenceId || sourceReport.sessionId || sourceReport.reportId;
  return { testId, userId: sourceReport.userId, sessionId: sourceReport.sessionId || testId, timestamp: sourceReport.generatedAt, target: sourceReport.target || 'General', status: 'COMPLETED', source: 'SHB', rawData: { cmPacket: sourceCmPacket }, reportReference: sourceReport.reportId, createdAt: sourceReport.createdAt, updatedAt: sourceReport.updatedAt };
};
const resolveGraphSourceTests = async (report: ReportRecord): Promise<TestRecord[]> => {
  const provenance = report.provenance as Record<string, any> | undefined;
  console.info('[GRAPH TRACE REPORT]', { reportType: report.reportType, reportId: report.reportId, referenceId: report.referenceId, date: report.date, assessmentDate: report.assessmentDate, periodStart: report.periodStart, periodEnd: report.periodEnd, topLevelKeys: Object.keys(report), references: graphTraceReferences(report) });
  const sourceIds = new Set<string>([
    ...(report.testObservationIds || []),
    ...(Array.isArray(provenance?.sourceTestIds) ? provenance.sourceTestIds : []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0));
  const addDayTests = async (dayId: string) => {
    const day = await reportDatabaseService.getDayRecord(dayId);
    (day?.testReferences || []).forEach((id) => sourceIds.add(id));
  };
  if (report.reportType === 'DAY' && sourceIds.size === 0) await addDayTests(report.referenceId);
  if (report.reportType === 'WEEK' && sourceIds.size === 0) {
    const week = await reportDatabaseService.getWeekRecord(report.referenceId);
    for (const dayId of week?.dayReferences || []) await addDayTests(dayId);
  }
  console.info('[GRAPH TRACE SOURCE IDS]', { reportId: report.reportId, sourceIds: Array.from(sourceIds), sourceIdCount: sourceIds.size });
  if (report.reportType === 'MONTH' && sourceIds.size === 0) {
    const month = await reportDatabaseService.getMonthRecord(report.referenceId);
    for (const weekId of month?.weekReferences || []) {
      const week = await reportDatabaseService.getWeekRecord(weekId);
      for (const dayId of week?.dayReferences || []) await addDayTests(dayId);
    }
  }
  const resolveOne = async (sourceId: string): Promise<TestRecord | null> => {
    const bareId = sourceId.replace(/^rep_test_/, '');
    const direct = await reportDatabaseService.getTestRecord(sourceId) || (bareId !== sourceId ? await reportDatabaseService.getTestRecord(bareId) : null);
    if (direct) { traceGraphTest('direct:' + sourceId, direct); return direct; }
    const sourceReport = await reportDatabaseService.getReportRecord(sourceId) || await reportDatabaseService.getReportRecord(`rep_test_${bareId}`);
    if (!sourceReport) { console.info('[GRAPH TRACE MISSING SOURCE]', { sourceId, triedTestIds: [sourceId, bareId], triedReportIds: [sourceId, 'rep_test_' + bareId] }); return null; }
    const payload = sourceReport as ReportRecord & Record<string, any>;
    const metrics = sourceReport.readableContent?.metricsSummary as Record<string, any> | undefined;
    const sourceCmPacket = metrics?.sourceCmPacket || payload.sourceCmPacket;
    if (!sourceCmPacket || typeof sourceCmPacket !== 'object') { console.info('[GRAPH TRACE NO CM PACKET]', { sourceId, sourceReportId: sourceReport.reportId, sourceReportKeys: Object.keys(sourceReport), metricsKeys: Object.keys(metrics || {}) }); return null; }
    const syntheticTest: TestRecord = {
      testId: bareId,
      userId: sourceReport.userId,
      sessionId: sourceReport.sessionId || bareId,
      timestamp: sourceReport.generatedAt,
      target: sourceReport.target || 'General',
      status: 'COMPLETED',
      source: 'SHB',
      rawData: { cmPacket: sourceCmPacket },
      reportReference: sourceReport.reportId,
      createdAt: sourceReport.createdAt,
      updatedAt: sourceReport.updatedAt,
    };
    traceGraphTest('report:' + sourceReport.reportId, syntheticTest);
    return syntheticTest;
  };
  const records = await Promise.all(Array.from(sourceIds).map(resolveOne));
  records.forEach((test, index) => traceGraphTest('resolved:' + index, test));
  const resolved = records.filter((test): test is TestRecord => !!test && test.userId === report.userId && test.status === 'COMPLETED');
  if (resolved.some((test) => !!(test.rawData as Record<string, any>)?.cmPacket?.parameters)) return resolved;

  const reportDate = localDate(report.assessmentDate || report.date || report.generatedAt);
  const periodStart = localDate(report.periodStart || (provenance?.weekStart as string | undefined));
  const periodEnd = localDate(report.periodEnd || (provenance?.weekEnd as string | undefined));
  const inPeriod = (timestamp: string) => {
    const date = localDate(timestamp);
    if (report.reportType === 'DAY') return !reportDate || date === reportDate;
    if (periodStart && periodEnd) return date >= periodStart && date <= periodEnd;
    return true;
  };
  const allLocalTests = await reportDatabaseService.getUserTests(report.userId);
  const localTests = allLocalTests.filter((test) => inPeriod(test.timestamp));
  const persistedTestReports = await reportDatabaseService.getUserConditionReports(report.userId, 'TEST');
  console.info('[GRAPH TRACE PERIOD FALLBACK]', { reportId: report.reportId, reportDate, periodStart, periodEnd, localTestCount: allLocalTests.length, persistedTestReportCount: persistedTestReports.length });
  const reportTests = persistedTestReports.filter((testReport) => inPeriod(testReport.generatedAt)).map(reportToTestRecord).filter((test): test is TestRecord => !!test);
  const byId = new Map<string, TestRecord>();
  [...localTests, ...reportTests].forEach((test) => byId.set(test.testId, test));
  const finalTests = Array.from(byId.values()).filter((test) => !!(test.rawData as Record<string, any>)?.cmPacket?.parameters);
};
export const ReportViewerModal: React.FC<ReportViewerModalProps> = ({
  report,
  isOpen,
  onClose,
}) => {
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSavedMessage, setPdfSavedMessage] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [graphSourceTests, setGraphSourceTests] = useState<TestRecord[]>([]);

  useEffect(() => {
    let active = true;
    setGraphSourceTests([]);
    if (!isOpen || !report || report.reportType === 'TEST') return () => { active = false; };
    void resolveGraphSourceTests(report).then((tests) => { if (active) setGraphSourceTests(tests); });
    return () => { active = false; };
  }, [isOpen, report]);

  const handleExportPdf = async () => {
    setPdfError(null);
    setPdfSavedMessage(null);
    setIsPdfExporting(true);
    try {
      const result = await pdfExportService.exportReportToPdf(report);
      if (result.saved && !result.shared) setPdfSavedMessage('PDF saved to Documents.');
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'PDF download failed. Please try again.');
    } finally {
      setIsPdfExporting(false);
    }
  };
  if (!isOpen || !report) return null;

  const reportDate = new Date(report.generatedAt).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const reportTime = new Date(report.generatedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getTierColor = (type: string) => {
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

  const rawDocId = typeof report.rawSourceReference === 'object'
    ? `${report.rawSourceReference.collectionName}/${report.rawSourceReference.documentId}`
    : String(report.rawSourceReference || report.referenceId);

  const rawC50Label = report.readableContent?.metricsSummary?.c50Label;
  const c50Label = typeof rawC50Label === 'string' || typeof rawC50Label === 'number'
    ? String(rawC50Label)
    : null;
  const shortSummary = buildShortReportSummary(report);
  const resolvedC50Label = shortSummary.c50Label || c50Label;
  const isC50Available = report.readableContent?.metricsSummary?.c50Available !== false && !!resolvedC50Label && resolvedC50Label !== 'C50 result not available';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
              <img src={logoUrl} alt="GOATEST" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getTierColor(
                    report.reportType
                  )}`}
                >
                  {report.reportType} REPORT
                </span>
                {report.isFixture && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                    DEV FIXTURE
                  </span>
                )}
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                {report.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report viewer"
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Report Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Metadata Row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{reportDate}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{reportTime}</span>
            </div>
          </div>

          {/* C50 Result Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              isC50Available
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                isC50Available
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Cpu className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  C50 ML Result:
                </span>
                <span
                  className={`text-xs font-bold ${
                    isC50Available
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-400 font-normal italic'
                  }`}
                >
                  {resolvedC50Label || (isC50Available ? 'Available' : 'C50 result unavailable')}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Model: {report.modelVersion || 'C50_V1.0'} · Pipeline: Derived ML Evaluation
              </span>
            </div>
          </div>

          {/* Short Report */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {shortSummary.heading}
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {shortSummary.summary}
            </p>
            {shortSummary.fields.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {shortSummary.fields.map((field) => (
                  <div key={field.label} className="rounded-lg border border-slate-200 dark:border-slate-700/70 px-2.5 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{field.label}</div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-words">{field.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Structured Sections */}
          {report.readableContent?.sections && report.readableContent.sections.length > 0 && (
            <div className="flex flex-col gap-3">
              {report.readableContent.sections.map((sec, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2"
                >
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {sec.heading}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {sec.body}
                  </p>

                  {sec.bulletPoints && sec.bulletPoints.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {sec.bulletPoints.map((bp, bIdx) => (
                        <li
                          key={bIdx}
                          className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                          <span>{bp}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Immutable Raw Source Notice */}
          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Database className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Immutable Machine Provenance
              </span>
              <span className="truncate font-mono text-[10px]">
                Source: {rawDocId}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowGraph(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-500" />
            <span>View Graph</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isPdfExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>{isPdfExporting ? 'Preparing PDF…' : 'Download PDF'}</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
              ID: {report.reportId.slice(0, 10)}...
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Close Report
            </button>
          </div>
        </div>
        {pdfSavedMessage && (
          <div role="status" className="px-5 py-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-900">
            {pdfSavedMessage}
          </div>
        )}
        {pdfError && (
          <div role="alert" className="px-5 py-2 text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900">
            PDF download failed: {pdfError}
          </div>
        )}

        {/* Graph Dialog */}
        <Dialog
          isOpen={showGraph}
          onClose={() => setShowGraph(false)}
          title="Report Graph"
          description={`Visualization for ${report.reportType} report · ${
            report.periodStart && report.periodEnd
              ? `${report.periodStart} to ${report.periodEnd}`
              : new Date(report.generatedAt).toLocaleString()
          }`}
          maxWidth="lg"
        >
          <div className="w-full">
            <ReportCharts visualizationData={report.visualizationData} reportType={report.reportType} report={report} sourceTests={graphSourceTests} />
          </div>
        </Dialog>

      </div>
    </div>
  );
};
