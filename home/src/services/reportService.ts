/**
 * GOATEST Report Service & Aggregation Gateway
 * 
 * PMT-1: Bridge between UI presentation and Report Database Foundation.
 * Provides unified retrieval for TEST, DAY, WEEK, MONTH reports.
 * ZERO fake or fabricated report items.
 */

import { reportDatabaseService } from './reportDatabaseService';
import { getFirebaseAuth } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import { buildUnifiedC50Evidence } from './conditionReportContract';
import { scheduleService } from './scheduleService';
import type {
  ReportItem,
  ReportRecord,
  TestRecord,
  DayRecord,
  WeekRecord,
  MonthRecord,
  ReportType,
} from '../types';

export const reportService = {
  /**
   * Receives the actual completed C50 report object and persists the existing
   * HOME ReportRecord projection to the authoritative reports_test collection.
   */
  async receiveConditionReport(report: any): Promise<void> {
    if (!report || report.temporalLevel !== 'TEST' || !report.reportId || !report.uid) {
      throw new Error('Completed TEST Condition report is required');
    }
    const authenticatedUid = getFirebaseAuth()?.currentUser?.uid;
    if (!authenticatedUid || authenticatedUid !== report.uid) {
      throw new Error('Condition report UID does not match the authenticated HOME user');
    }

    const generatedAt = report.createdAt || new Date().toISOString();
    const reportRecord: ReportRecord = {
      reportId: report.reportId,
      userId: report.uid,
      sessionId: report.sessionId,
      target: report.target,
      reportType: 'TEST',
      referenceId: report.sessionId || report.reportId,
      title: report.title || report.formattedTitle || 'TEST Condition Report',
      generatedAt,
      status: report.status === 'ARCHIVED' ? 'ARCHIVED' : 'COMPLETED',
      rawSourceReference: { collectionName: 'test', documentId: report.sessionId || report.reportId },
      readableContent: {
        summary: report.conditionSummary || report.whatWasDetected || report.title || 'TEST Condition Report',
        organTested: report.target,
        sections: report.parameters ? [{
          heading: 'C50 ML Evaluation',
          body: report.patternInterpretation || report.conditionSummary || '',
          bulletPoints: report.parameters.map((parameter: any) => `${parameter.name}: Stage ${parameter.inputStage}`),
        }] : undefined,
        // Preserve the complete generated C50 report object for HOME readers.
        metricsSummary: {
          ...report,
          c50Label: report.result?.matchedRecord?.pattern_label || report.matchedPattern || report.pattern_label || (report.matchStatus === 'NO_ACCEPTABLE_MATCH' ? 'No acceptable dataset trajectory' : null),
          c50Available: report.matchStatus !== 'NO_ACCEPTABLE_MATCH',
        },
      },
      modelVersion: 'C50_TEST',
      isFixture: Boolean(report.isFixture),
      createdAt: generatedAt,
      updatedAt: new Date().toISOString(),
      assessmentDate: generatedAt.slice(0, 10),
      c50Evidence: buildUnifiedC50Evidence(report.result || report, 'TEST', 'C50_TEST'),
      provenance: { reportType: 'TEST', testId: report.sessionId || report.reportId, sessionId: report.sessionId || report.reportId },
      technicalAudit: { reportType: 'TEST', vectorLength: report.inputStages?.length || report.result?.inputVector?.length || null, sourceObservationCount: 1, classificationStatus: report.status },
      healthCareGuidance: null,
    };

    const testRecord: TestRecord = {
      testId: report.sessionId || report.reportId,
      userId: report.uid,
      sessionId: report.sessionId || report.reportId,
      timestamp: generatedAt,
      target: report.target || 'General',
      status: 'COMPLETED',
      source: 'SHB',
      rawData: {
        cmPacket: report.sourceCmPacket,
        rawFeatureArray: report.result?.inputVector || report.inputStages,
        conditionResult: report.result,
        matchedTestRow: report.matchedTestRow,
      },
      reportReference: report.reportId,
      isFixture: Boolean(report.isFixture),
      createdAt: generatedAt,
      updatedAt: new Date().toISOString(),
    };

    await reportDatabaseService.saveTestRecord(testRecord);
    await reportDatabaseService.saveReportRecord(reportRecord);
    await scheduleService.cancelMissedForCompletedAssessment(report.uid, generatedAt).catch(() => undefined);

  },
  /**
   * Retrieves available reports for the user from Firestore and database service.
   * Converts full ReportRecords to ReportItems for UI compatibility.
   */
  async getReports(userId: string): Promise<ReportItem[]> {
    if (!userId) return [];

    try {
      const records = await reportDatabaseService.getUserConditionReports(userId);
      if (records.length > 0) {
        return records.map((r) => {
          let category: string;
          switch (r.reportType) {
            case 'DAY':
              category = "Today's Report";
              break;
            case 'WEEK':
              category = 'Weekly Report';
              break;
            case 'MONTH':
              category = 'Monthly Report';
              break;
            case 'TEST':
            default:
              category = 'Recent Test';
              break;
          }

          return {
            id: r.reportId,
            userId: r.userId,
            timestamp: r.generatedAt,
            category,
            summary: r.readableContent?.summary || r.title,
            organTested: r.readableContent?.organTested,
            status: r.status === 'ARCHIVED' ? 'ARCHIVED' : 'COMPLETED',
            reportType: r.reportType,
            referenceId: r.referenceId,
            isFixture: r.isFixture,
          };
        });
      }
    } catch (err) {
      console.warn('[reportService] Error loading report records:', err);
    }

    return [];
  },

  /**
   * Retrieves raw test records for the authenticated user.
   */
  async getUserTests(userId: string): Promise<TestRecord[]> {
    return reportDatabaseService.getUserTests(userId);
  },

  /**
   * Retrieves DAY reports for the authenticated user.
   */
  async getUserDayReports(userId: string): Promise<ReportRecord[]> {
    return reportDatabaseService.getUserReports(userId, 'DAY');
  },

  /**
   * Retrieves WEEK reports for the authenticated user.
   */
  async getUserWeekReports(userId: string): Promise<ReportRecord[]> {
    return reportDatabaseService.getUserReports(userId, 'WEEK');
  },

  /**
   * Retrieves MONTH reports for the authenticated user.
   */
  async getUserMonthReports(userId: string): Promise<ReportRecord[]> {
    return reportDatabaseService.getUserReports(userId, 'MONTH');
  },

  /**
   * Retrieves reports by type (TEST | DAY | WEEK | MONTH) or all reports.
   */
  async getUserReports(userId: string, reportType?: ReportType): Promise<ReportRecord[]> {
    return reportDatabaseService.getUserReports(userId, reportType);
  },

  /**
   * Save a completed assessment report to database foundation.
   */
  async saveReport(report: ReportItem): Promise<void> {
    const reportType: ReportType =
      report.reportType ||
      (report.category === "Today's Report"
        ? 'DAY'
        : report.category === 'Weekly Report'
        ? 'WEEK'
        : report.category === 'Monthly Report'
        ? 'MONTH'
        : 'TEST');

    const reportRecord: ReportRecord = {
      reportId: report.id,
      userId: report.userId,
      reportType,
      referenceId: report.referenceId || report.id,
      title: report.summary || `${report.organTested || 'Health'} Assessment Report`,
      generatedAt: report.timestamp || new Date().toISOString(),
      status: report.status === 'ARCHIVED' ? 'ARCHIVED' : 'COMPLETED',
      rawSourceReference: {
        collectionName: reportType === 'DAY' ? 'day' : reportType === 'WEEK' ? 'week' : reportType === 'MONTH' ? 'month' : 'test',
        documentId: report.referenceId || report.id,
      },
      readableContent: {
        summary: report.summary,
        organTested: report.organTested,
        observations: [],
      },
      isFixture: report.isFixture,
      createdAt: report.timestamp || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await reportDatabaseService.saveReportRecord(reportRecord);
  },

  /**
   * Access to lower-level raw database service
   */
  rawDb: reportDatabaseService,
};

export { reportDatabaseService };
