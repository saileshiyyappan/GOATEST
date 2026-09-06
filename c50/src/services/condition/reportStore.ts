import * as fs from 'fs';
import * as path from 'path';
import { ConditionReportDocument } from './conditionTypes';

/**
 * Report Persistence Store
 * Scoped to authenticated user (uid).
 * Provides atomic in-memory caching and persistent local JSON storage in data/reports/.
 * Designed to seamlessly synchronize with Firestore /reports/{reportId} collection.
 */
class ReportStore {
  private cache: Map<string, ConditionReportDocument> = new Map();
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.join(process.cwd(), 'data', 'reports');
    this.ensureDirectory();
    this.loadExistingReports();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }
    } catch (e) {
      console.error('[ReportStore] Failed to ensure directory:', e);
    }
  }

  private loadExistingReports() {
    try {
      if (fs.existsSync(this.reportsDir)) {
        const files = fs.readdirSync(this.reportsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const raw = fs.readFileSync(path.join(this.reportsDir, file), 'utf-8');
            const doc: ConditionReportDocument = JSON.parse(raw);
            if (doc && doc.reportId) {
              this.cache.set(doc.reportId, doc);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ReportStore] Notice loading local reports:', e);
    }
  }

  public saveReport(report: ConditionReportDocument): ConditionReportDocument {
    if (!report.reportId || !report.uid) {
      throw new Error('Report document must contain reportId and authenticated uid');
    }

    // 1. In-memory cache
    this.cache.set(report.reportId, report);

    // 2. Persistent storage
    try {
      this.ensureDirectory();
      let safeFilename = report.reportId.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (safeFilename.length > 80) {
        safeFilename = `${safeFilename.substring(0, 64)}_${safeFilename.length}`;
      }
      const filePath = path.join(this.reportsDir, `${safeFilename}.json`);
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ReportStore] Error saving report to disk:', err);
    }

    return report;
  }

  public getReport(reportId: string, requestedUid?: string): ConditionReportDocument | null {
    const report = this.cache.get(reportId);
    if (!report) return null;

    // Strict user isolation check
    if (requestedUid && report.uid !== requestedUid) {
      const err: any = new Error('Unauthorized access to report');
      err.statusCode = 403;
      throw err;
    }

    return report;
  }

  public listReportsForUser(uid: string): ConditionReportDocument[] {
    const userReports: ConditionReportDocument[] = [];
    for (const report of this.cache.values()) {
      if (report.uid === uid) {
        userReports.push(report);
      }
    }
    return userReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const reportStore = new ReportStore();
