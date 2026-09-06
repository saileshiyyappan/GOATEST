import { buildShortReportSummary } from './shortReportSummaryService';
import { buildUnifiedC50Evidence } from './conditionReportContract';
import type { ReportRecord } from '../types';

const report = (reportType: 'TEST' | 'DAY' | 'WEEK', metricsSummary: Record<string, any>): ReportRecord => ({
  reportId: `rep_${reportType.toLowerCase()}_fixture`, userId: 'uid_fixture', reportType, referenceId: 'source_fixture',
  title: `${reportType} Condition Report`, generatedAt: '2026-08-30T23:59:59.000Z', status: 'COMPLETED',
  rawSourceReference: { collectionName: 'reports', documentId: 'source_fixture' },
  readableContent: { summary: `${reportType} assessment`, metricsSummary }, createdAt: '2026-08-30T23:59:59.000Z', updatedAt: '2026-08-30T23:59:59.000Z',
});

export function runConditionReportContractTests(): void {
  const testEvidence = buildUnifiedC50Evidence({ matchStatus: 'EXACT', referenceDatasetSno: 1, classification: 'CARDIAC_PATTERN', matchedPattern: 'Cardiac Load', severity: 'HIGH', severityScore: 0.8, confidenceScore: 0.95, confidenceLevel: 'HIGH', trend: 'STABLE', inputStages: Array(11).fill(0), matchedStages: Array(11).fill(0) }, 'TEST', 'C50_TEST');
  const dayEvidence = buildUnifiedC50Evidence({ matchStatus: 'EQUIVALENT', referenceDatasetSno: 2, classification: 'CARDIAC_PATTERN', matchedPattern: 'Daily Load', severity: 'MILD', severityScore: 0.4, confidenceScore: 0.8, confidenceLevel: 'MEDIUM', trend: 'IMPROVING', inputStages: Array(33).fill(0), matchedStages: Array(33).fill(0) }, 'DAY', 'C50_DAY');
  const weekEvidence = buildUnifiedC50Evidence({ matchStatus: 'APPROXIMATE', referenceDatasetSno: 3, classification: 'MULTI_PARAMETER_RISK', matchedPattern: 'Weekly Load', severity: 'RISK', severityScore: 0.9, confidenceScore: 0.7, confidenceLevel: 'MEDIUM', trend: 'DETERIORATING', weekVector: Array(231).fill(0), matchedStages: Array(231).fill(0) }, 'WEEK', 'C50_WEEK');
  if (testEvidence.vectorLength !== 11 || dayEvidence.vectorLength !== 33 || weekEvidence.vectorLength !== 231) throw new Error('Report vector dimensionality was not preserved');
  if (testEvidence.matchType !== 'EXACT' || dayEvidence.matchType !== 'EQUIVALENT' || weekEvidence.matchType !== 'APPROXIMATE') throw new Error('Match type was transformed');
  const noMatch = buildUnifiedC50Evidence({ matchStatus: 'NO_ACCEPTABLE_MATCH', classification: null, matchedPattern: null, severity: null, confidenceScore: null, confidenceLevel: null, trend: null, inputStages: Array(11).fill(0) }, 'TEST', 'C50_TEST');
  if (noMatch.matchType !== 'NO_ACCEPTABLE_MATCH' || noMatch.primaryTaxonomy !== null || noMatch.matchedSno !== null) throw new Error('NO_ACCEPTABLE_MATCH fabricated classification');
  if (buildShortReportSummary(report('TEST', { c50Label: 'Cardiac Load', classification: 'CARDIAC_PATTERN' })).heading !== 'TEST REPORT') throw new Error('TEST short report compatibility failed');
  if (buildShortReportSummary(report('DAY', { c50Label: 'Daily Load', classification: 'CARDIAC_PATTERN', testCount: 3 })).heading !== 'DAY REPORT') throw new Error('DAY short report compatibility failed');
  if (buildShortReportSummary(report('WEEK', { c50Label: 'Weekly Load', classification: 'MULTI_PARAMETER_RISK', totalCompletedDays: 7 })).heading !== 'WEEK REPORT') throw new Error('WEEK short report compatibility failed');
}
