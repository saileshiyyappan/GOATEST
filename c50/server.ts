import express from 'express';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { createServer as createViteServer } from 'vite';
import { CANONICAL_11_PARAMETERS } from './src/engine/canonicalParameters';
import { generateCMPacket } from './src/engine/compareEngine';
import { runAutomatedTestSuite } from './src/engine/automatedTests';
import { exportCMPacketToCSV } from './src/engine/csvExport';

// C50 V1 Dataset Module Imports
import { generateC50DatasetsToDisk, DEFAULT_OPTIONS } from './src/c50/generator';
import { getDatasetPaths, ensureDatasetDirectories, buildDatasetHeader } from './src/c50/csvExporter';
import { computeCsvFileStatistics } from './src/c50/distributionReporter';
import { runAllC50DiskTests } from './src/c50/automatedTests';

// Condition Engine & Report Services
import { conditionEngine } from './src/services/condition/conditionEngine';
import { reportStore } from './src/services/condition/reportStore';
import { generateReportPdfBuffer } from './src/services/condition/reportGenerator';
import { firestoreDatabaseService } from './src/services/firebase/firestoreService';
import { runPMT2Tests } from './src/pmt2Runner';
import { runPMT3Tests } from './src/pmt3Runner';
import { runPMT4Tests } from './src/pmt4Runner';
import { runPMT5Tests } from './src/pmt5Runner';
import { runPMT6Tests } from './src/pmt6Runner';
import { verifyIntegrationBearerToken } from './src/services/integration/firebaseAdminAuth';
import { persistTestResultWithAdmin, persistTemporalResultWithAdmin, dispatchTestNotificationsWithAdmin, persistQaSessionWithAdmin, dispatchTemporalNotificationsWithAdmin, getAuthoritativeReportWithAdmin } from './src/services/integration/adminTestPersistence';

const rootDir = process.cwd();
const datasetPaths = getDatasetPaths(rootDir);

// Ensure datasets exist on disk on startup
if (!fs.existsSync(datasetPaths.testCsvPath) || !fs.existsSync(datasetPaths.monthCsvPath)) {
  console.log('[Server Startup] Generating physical C50 CSV datasets to disk in dataset/...');
  generateC50DatasetsToDisk({
    seed: DEFAULT_OPTIONS.seed,
    basePatternCount: DEFAULT_OPTIONS.basePatternCount,
    rootDir,
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3001);

  app.use(express.json());
  const allowedOrigins = new Set((process.env.INTEGRATION_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3002').split(','));
  app.use('/api/integration', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // API Routes - Band V1 Compare
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      engine: 'BAND_V1_COMPARE_STAGE_0_5',
      c50_dataset_generator: 'C50_V1_4_DATASETS_CLEAN_ML_ACTIVE',
    });
  });

  app.get('/api/parameters', (req, res) => {
    res.json(CANONICAL_11_PARAMETERS);
  });

  app.post('/api/compare', (req, res) => {
    try {
      const inputs = req.body?.inputs;
      const packet = generateCMPacket(inputs);
      res.json(packet);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error processing compare packet' });
    }
  });

  app.get('/api/test-suite', (req, res) => {
    try {
      const testResults = runAutomatedTestSuite();
      const allPassed = testResults.every((t) => t.passed);
      res.json({
        total: testResults.length,
        allPassed,
        tests: testResults,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error running test suite' });
    }
  });

  app.post('/api/export-csv', (req, res) => {
    try {
      const inputs = req.body?.inputs;
      const packet = generateCMPacket(inputs);
      const csv = exportCMPacketToCSV(packet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="band_v1_compare_packet.csv"');
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error exporting CSV' });
    }
  });

  // =========================================================================
  // C50 V1 4-DATASET GENERATOR API ENDPOINTS (TEST, DAY, WEEK, MONTH)
  // =========================================================================

  // Generate / Regenerate datasets with custom parameters
  app.post('/api/c50/generate', async (req, res) => {
    try {
      const seed = req.body?.seed ?? DEFAULT_OPTIONS.seed;
      const basePatternCount = req.body?.basePatternCount ?? DEFAULT_OPTIONS.basePatternCount;
      const summary = generateC50DatasetsToDisk({
        seed,
        basePatternCount,
        rootDir,
      });
      res.json({
        success: true,
        message: 'C50 Clean 4-Dataset Bundle generated successfully and persisted to disk',
        summary,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating C50 datasets' });
    }
  });

  // Get dataset sample rows by temporal level
  app.get('/api/c50/datasets/:temporalLevel', async (req, res) => {
    try {
      const level = req.params.temporalLevel.toLowerCase();
      let targetPath = datasetPaths.testCsvPath;
      if (level === 'day') targetPath = datasetPaths.dayCsvPath;
      else if (level === 'week') targetPath = datasetPaths.weekCsvPath;
      else if (level === 'month') targetPath = datasetPaths.monthCsvPath;
      else if (level !== 'test') {
        return res.status(400).json({ error: `Invalid temporal level: ${level}. Use test, day, week, or month.` });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const records: any[] = [];
      let total = 0;

      if (fs.existsSync(targetPath)) {
        const fileStream = fs.createReadStream(targetPath, { encoding: 'utf-8' });
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let headerColumns: string[] = [];
        let isHeader = true;
        let rowIndex = 0;

        for await (const line of rl) {
          if (!line.trim()) continue;
          if (isHeader) {
            headerColumns = line.split(',');
            isHeader = false;
            continue;
          }
          if (rowIndex >= offset && records.length < limit) {
            const cols = line.split(',');
            const rec: Record<string, any> = {};
            headerColumns.forEach((h, idx) => {
              rec[h] = cols[idx];
            });
            records.push(rec);
          }
          rowIndex++;
        }
        total = rowIndex;
      }

      res.json({
        temporalLevel: level.toUpperCase(),
        total,
        offset,
        limit,
        records,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching dataset' });
    }
  });

  // Download raw CSV for any of the 4 datasets directly from disk
  app.get('/api/c50/download-csv/:temporalLevel', (req, res) => {
    try {
      const level = req.params.temporalLevel.toLowerCase();
      let targetPath = datasetPaths.testCsvPath;
      let filename = 'test_dataset.csv';

      if (level === 'day') {
        targetPath = datasetPaths.dayCsvPath;
        filename = 'day_dataset.csv';
      } else if (level === 'week') {
        targetPath = datasetPaths.weekCsvPath;
        filename = 'week_dataset.csv';
      } else if (level === 'month') {
        targetPath = datasetPaths.monthCsvPath;
        filename = 'month_dataset.csv';
      } else if (level !== 'test') {
        return res.status(400).json({ error: `Invalid temporal level: ${level}. Use test, day, week, or month.` });
      }

      if (fs.existsSync(targetPath)) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return fs.createReadStream(targetPath).pipe(res);
      } else {
        return res.status(404).json({ error: `File not found on disk: ${targetPath}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error downloading CSV' });
    }
  });

  // Statistical Distribution Report
  app.get('/api/c50/report', async (req, res) => {
    try {
      const testStats = await computeCsvFileStatistics(datasetPaths.testCsvPath, 1);
      const dayStats = await computeCsvFileStatistics(datasetPaths.dayCsvPath, 3);
      const weekStats = await computeCsvFileStatistics(datasetPaths.weekCsvPath, 21);
      const monthStats = await computeCsvFileStatistics(datasetPaths.monthCsvPath, 84);

      res.json({
        patternLibrarySize: 7081,
        basePatternCount: testStats.totalRows,
        temporalObservationDepths: {
          testDepth: 1,
          dayDepth: 3,
          weekDepth: 21,
          monthDepth: 84,
          ratio: '1 : 3 : 21 : 84',
        },
        test: testStats,
        day: dayStats,
        week: weekStats,
        month: monthStats,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating distribution report' });
    }
  });

  // Automated Tests
  app.get('/api/c50/tests', async (req, res) => {
    try {
      const testResults = await runAllC50DiskTests(rootDir);
      res.json(testResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error running C50 test suite' });
    }
  });

  // PMT-2 Automated Pipeline & Verification Tests
  app.get('/api/condition/pmt2-tests', async (req, res) => {
    try {
      const testResults = await runPMT2Tests();
      res.json(testResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error running PMT-2 test suite' });
    }
  });

  // PMT-3 DAY Pipeline & Verification Tests
  app.get('/api/condition/pmt3-tests', async (req, res) => {
    try {
      const testResults = await runPMT3Tests();
      res.json(testResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error running PMT-3 test suite' });
    }
  });

  // PMT-4 WEEK Pipeline & Verification Tests
  app.get('/api/condition/pmt4-tests', async (req, res) => {
    try {
      const testResults = await runPMT4Tests();
      res.json(testResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error running PMT-4 test suite' });
    }
  });

  // PMT-5 Complete Condition Report Generator Verification Tests
  app.get('/api/condition/pmt5-tests', async (req, res) => {
    try {
      const testResults = await runPMT5Tests();
      res.json(testResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error running PMT-5 test suite' });
    }
  });

  // PMT-6 Final Automation + Notification + Retrieval + Pipeline Integration Tests
  app.get('/api/condition/pmt6-tests', async (req, res) => {
    try {
      const testResults = await runPMT6Tests();
      res.json(testResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error running PMT-6 test suite' });
    }
  });

  // =========================================================================
  // CONDITION & REPORT PROCESSING API ENDPOINTS
  // =========================================================================

  // All condition/report/Q&A routes derive identity from Firebase Admin verification.
  // Caller-supplied UID headers, body fields, and display identifiers are not authority.
  async function getAuthenticatedUid(req: express.Request): Promise<string> {
    return verifyIntegrationBearerToken(req.headers.authorization);
  }

  // POST /api/condition/process - Executes end-to-end TEST Condition Pipeline
  app.post('/api/condition/process', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const processResponse = await conditionEngine.processCondition(req.body, {
        temporalLevel: req.body?.temporalLevel,
        longitudinalVectors: req.body?.longitudinalVectors,
        uid,
        observationId: req.body?.observationId,
        reportId: req.body?.reportId,
      });

      res.json(processResponse);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        status: 'ERROR',
        error: err.message || 'Failed to process physiological condition packet',
      });
    }
  });

  // POST /api/condition/process-day - Executes end-to-end PMT-3 DAY Condition Pipeline (3 Tests + Home Q/A -> Firestore)
  app.post('/api/condition/process-day', async (req, res) => {
    try {
      const uid = await verifyIntegrationBearerToken(req.headers.authorization);
      const processResponse = await conditionEngine.processDayAssessment({
        uid,
        testObservationIds: req.body?.testObservationIds,
        testObservations: req.body?.testObservations,
        testVectors: req.body?.testVectors,
        qaData: req.body?.qaData,
        qaId: req.body?.qaId,
        dayAssessmentId: req.body?.dayAssessmentId,
        observationId: req.body?.observationId,
        reportId: req.body?.reportId,
        isFixture: req.body?.isFixture,
        timestamp: req.body?.timestamp,
      });
      if (processResponse.status === 'COMPLETED' && (!processResponse.persisted?.observation?.persistedLocation || processResponse.persisted.observation.persistedLocation !== 'FIRESTORE')) {
        try { processResponse.persisted = await persistTemporalResultWithAdmin(uid, processResponse); }
        catch (err: any) { return res.status(502).json({ success: false, status: 'FIRESTORE_PERSISTENCE_FAILURE', temporalLevel: 'DAY', error: err.message || 'DAY persistence failed', result: processResponse }); }
      }
      if (processResponse.status === 'COMPLETED' && processResponse.persisted?.observation?.persistedLocation === 'FIRESTORE' && processResponse.persisted?.report?.persistedLocation === 'FIRESTORE') {
        try { (processResponse as any).notifications = await dispatchTemporalNotificationsWithAdmin(uid, processResponse); }
        catch (err: any) { (processResponse as any).notifications = { success: false, status: 'DELIVERY_FAILED', error: err.message, notifications: [] }; }
      }
      res.json(processResponse);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        status: 'ERROR',
        error: err.message || 'Failed to process day condition assessment',
      });
    }
  });

  // POST /api/condition/process-week - Executes end-to-end PMT-4 WEEK Condition Pipeline (7 Days -> Firestore)
  app.post('/api/condition/process-week', async (req, res) => {
    try {
      const uid = await verifyIntegrationBearerToken(req.headers.authorization);
      const processResponse = await conditionEngine.processWeekAssessment({
        uid,
        dayObservationIds: req.body?.dayObservationIds,
        dayObservations: req.body?.dayObservations,
        dayVectors: req.body?.dayVectors,
        observationId: req.body?.observationId,
        reportId: req.body?.reportId,
        isFixture: req.body?.isFixture,
        timestamp: req.body?.timestamp,
      });

      if (processResponse.status === 'COMPLETED' && (!processResponse.persisted?.observation?.persistedLocation || processResponse.persisted.observation.persistedLocation !== 'FIRESTORE')) {
        try { processResponse.persisted = await persistTemporalResultWithAdmin(uid, processResponse); }
        catch (err: any) { return res.status(502).json({ success: false, status: 'FIRESTORE_PERSISTENCE_FAILURE', temporalLevel: 'WEEK', error: err.message || 'WEEK persistence failed', result: processResponse }); }
      }
      res.json(processResponse);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        status: 'ERROR',
        error: err.message || 'Failed to process week condition assessment',
      });
    }
  });

  // POST /api/condition/process-month - Executes end-to-end PMT-4/6 MONTH Condition Pipeline (4 Weeks -> Firestore)
  app.post('/api/condition/process-month', async (req, res) => {
    try {
      const uid = await verifyIntegrationBearerToken(req.headers.authorization);
      const processResponse = await conditionEngine.processMonthAssessment({
        uid,
        weekObservationIds: req.body?.weekObservationIds,
        weekObservations: req.body?.weekObservations,
        weekVectors: req.body?.weekVectors,
        observationId: req.body?.observationId,
        reportId: req.body?.reportId,
        isFixture: req.body?.isFixture,
        timestamp: req.body?.timestamp,
      });

      if (processResponse.status === 'COMPLETED' && (!processResponse.persisted?.observation?.persistedLocation || processResponse.persisted.observation.persistedLocation !== 'FIRESTORE')) {
        try { processResponse.persisted = await persistTemporalResultWithAdmin(uid, processResponse); }
        catch (err: any) { return res.status(502).json({ success: false, status: 'FIRESTORE_PERSISTENCE_FAILURE', temporalLevel: 'MONTH', error: err.message || 'MONTH persistence failed', result: processResponse }); }
      }
      res.json(processResponse);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        status: 'ERROR',
        error: err.message || 'Failed to process month condition assessment',
      });
    }
  });

  // POST /api/condition/automate - Full automated end-to-end multi-tier pipeline trigger
  app.post('/api/condition/automate', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const result = await conditionEngine.automateFullPipeline({
        uid,
        sampleInputs: req.body?.sampleInputs,
        qaData: req.body?.qaData,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        status: 'ERROR',
        error: err.message || 'Failed to execute automated condition pipeline',
      });
    }
  });

  // POST /api/condition/qa - Ingests Home Web Q/A for an authenticated user
  app.post('/api/condition/qa', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const qaResult = await persistQaSessionWithAdmin(uid, req.body);
      res.json(qaResult);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to record home Q/A payload',
      });
    }
  });

  // GET /api/condition/qa/:qaId - Retrieves a Home Web Q/A record
  app.get('/api/condition/qa/:qaId', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const qaResult = await firestoreDatabaseService.getQA(uid, req.params.qaId);
      res.json(qaResult);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to retrieve home Q/A document',
      });
    }
  });

  // GET /api/condition/notifications - Lists all dispatched notifications for authenticated user
  app.get('/api/condition/notifications', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const notifs = await firestoreDatabaseService.getNotifications(uid);
      res.json({ success: true, count: notifs.length, notifications: notifs });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to list notifications',
      });
    }
  });

  // GET /api/reports/:reportId - Retrieves a single report document
  app.get('/api/reports/:reportId', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const report = reportStore.getReport(req.params.reportId, uid) || await getAuthoritativeReportWithAdmin(uid, req.params.reportId);
      if (!report) {
        return res.status(404).json({ error: `Report not found: ${req.params.reportId}` });
      }
      res.json({ success: true, report });
    } catch (err: any) {
      const status = err.statusCode || 500;
      res.status(status).json({ error: err.message || 'Error retrieving report' });
    }
  });

  // GET /api/reports/:reportId/download - Downloads high-resolution PDF document
  app.get('/api/reports/:reportId/download', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const report = await getAuthoritativeReportWithAdmin(uid, req.params.reportId);
      if (!report) {
        return res.status(404).json({ error: `Report not found: ${req.params.reportId}` });
      }

      const pdfBuffer = await generateReportPdfBuffer(report);
      const safeTitle = (report.formattedTitle || `BAND_REPORT_${report.temporalLevel || 'TEST'}_${report.reportId}`)
        .replace(/[^a-zA-Z0-9_\-— ]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err: any) {
      const status = err.statusCode || 500;
      res.status(status).json({ error: err.message || 'Error generating report PDF download' });
    }
  });

  // GET /api/reports - Lists all reports for authenticated user
  app.get('/api/reports', async (req, res) => {
    try {
      const uid = await getAuthenticatedUid(req);
      const reports = reportStore.listReportsForUser(uid);
      res.json({ success: true, count: reports.length, reports });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing user reports' });
    }
  });

  // GET /api/database/status - Returns status of Firebase/Firestore database foundation
  app.get('/api/database/status', (req, res) => {
    try {
      const status = firestoreDatabaseService.getStatus();
      res.json({
        success: true,
        ...status,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error checking database status' });
    }
  });


  // Vite Middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
        server: { middlewareMode: true, hmr: process.env.DISABLE_HMR === 'true' ? false : { port: 24679 } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Band V1 Compare Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
