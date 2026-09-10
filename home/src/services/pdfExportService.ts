/**
 * GOATEST PDF / Printable Report Export Service
 * PMT-6 Part 11: High-fidelity clinical report export & printing.
 */

import type { ReportRecord } from '../types';
import logoUrl from '../assets/goatest-logo.png';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
// The browser build registers PDFKit's standard fonts; the generic entry can
// omit that registration after bundling and causes Helvetica runtime failures.
// @ts-expect-error PDFKit does not publish a declaration for this browser entry.
import PDFDocument from 'pdfkit-browser-entry';
import { CANONICAL_11_PARAMETERS } from '../../../c50/src/engine/canonicalParameters';

const escapeHtml = (value: unknown): string => String(value ?? 'Unavailable')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const display = (value: unknown): string => value === null || value === undefined || value === '' ? 'Unavailable' : escapeHtml(value);

export interface PdfExportResult {
  saved: boolean;
  shared: boolean;
  filename?: string;
}

export const pdfExportService = {
  /**
   * Generates and triggers browser print-to-PDF with clean clinical styling.
   */
  async exportReportToPdf(report: ReportRecord, userName: string = 'User'): Promise<PdfExportResult> {
    if (!report) throw new Error('A report is required to generate a PDF.');

    if (Capacitor.getPlatform() === 'android') {
      return exportReportToAndroid(report, userName);
    }

    const reportDate = new Date(report.generatedAt).toLocaleString([], {
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const evidence: any = report.c50Evidence || report.readableContent?.metricsSummary?.c50Metadata || {};
    const provenance: any = report.provenance || {};
    const c50Label =
      report.readableContent?.metricsSummary?.c50Label ||
      (report.readableContent?.metricsSummary?.c50Available === false
        ? 'No acceptable dataset trajectory'
        : 'Available');
    const provenanceLines = report.reportType === 'WEEK' && Array.isArray(provenance.sourceDayIds)
      ? provenance.sourceDayIds.map((dayId, index) => `DAY ${index + 1} → ${provenance.dayDates?.[index] || 'Unavailable'} → ${(provenance.sourceTestIdsByDay?.[index] || []).join(', ') || 'TEST IDs unavailable'}`)
      : report.reportType === 'DAY'
        ? [`DAY ${provenance.dayId || report.referenceId} → ${report.assessmentDate || 'Unavailable'} → ${(provenance.sourceTestIds || report.testObservationIds || []).join(', ') || 'TEST IDs unavailable'}`]
        : [`TEST / Session: ${provenance.testId || provenance.sessionId || report.referenceId}`];

    const sectionsHtml = (report.readableContent?.sections || [])
      .map(
        (sec) => `
        <div style="margin-bottom: 16px; page-break-inside: avoid;">
          <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">
            ${escapeHtml(sec.heading)}
          </h3>
          <p style="font-size: 12px; line-height: 1.6; color: #334155; margin: 0 0 6px 0;">
            ${escapeHtml(sec.body)}
          </p>
          ${
            sec.bulletPoints && sec.bulletPoints.length > 0
              ? `<ul style="margin: 0; padding-left: 18px; font-size: 11.5px; color: #475569; line-height: 1.5;">
                  ${sec.bulletPoints.map((bp) => `<li>${escapeHtml(bp)}</li>`).join('')}
                </ul>`
              : ''
          }
        </div>
      `
      )
      .join('');

    const rawRef =
      typeof report.rawSourceReference === 'object'
        ? `${report.rawSourceReference.collectionName}/${report.rawSourceReference.documentId}`
        : String(report.rawSourceReference || report.referenceId);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback if popup blocked
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>GOATEST_${escapeHtml(report.reportType)}_${escapeHtml(report.reportId)}.pdf</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 12px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 0.15em;
            color: #0f172a;
            font-family: monospace;
          }
          .brand-lockup { display: flex; align-items: center; gap: 10px; }
          .brand-logo { width: 42px; height: 42px; object-fit: contain; border-radius: 6px; }
          .brand-badge {
            font-size: 10px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
            font-size: 11px;
          }
          .meta-item {
            display: flex;
            gap: 6px;
          }
          .meta-label {
            font-weight: 700;
            color: #64748b;
          }
          .meta-value {
            color: #0f172a;
            font-weight: 600;
          }
          .c50-banner {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .summary-box {
            background: #f1f5f9;
            border-left: 4px solid #0284c7;
            padding: 12px 16px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 18px;
            font-size: 12px;
          }
          .footer {
            margin-top: 32px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            font-size: 10px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
          .evidence-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .evidence-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid; }
          .evidence-card h3 { margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #0369a1; }
          .evidence-card p, .evidence-card li { overflow-wrap: anywhere; word-break: break-word; }
          .provenance { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
          body > *:not(.watermark) { position: relative; z-index: 1; }
          .watermark { position: fixed; z-index: 0; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 42%; max-width: 280px; max-height: 34vh; object-fit: contain; opacity: 0.045; pointer-events: none; }
          @media print { .footer { position: fixed; bottom: 0; left: 0; right: 0; } }
          @media print {
            body { padding: 0 0 48px 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <img class="watermark" src="${logoUrl}" alt="" aria-hidden="true" />
        <div class="header">
          <div class="brand-lockup">
            <img class="brand-logo" src="${logoUrl}" alt="GOATEST" />
            <div>
              <div class="brand-title">GOATEST</div>
            <div style="font-size: 10px; color: #64748b; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">
              CONDITION REPORT · ${escapeHtml(report.reportType)}
            </div>
            </div>
          </div>
          <div>
            <span class="brand-badge">${report.reportType} ASSESSMENT</span>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Patient:</span> <span class="meta-value">${display(userName)}</span></div>
          <div class="meta-item"><span class="meta-label">Generated:</span> <span class="meta-value">${display(reportDate)}</span></div>
          <div class="meta-item"><span class="meta-label">Report ID:</span> <span class="meta-value" style="font-family: monospace; overflow-wrap:anywhere;">${display(report.reportId)}</span></div>
          <div class="meta-item"><span class="meta-label">Model Engine:</span> <span class="meta-value">${display(report.modelVersion || 'C50_V1.0')}</span></div>
          ${report.reportType === 'TEST' ? `<div class="meta-item"><span class="meta-label">Session:</span> <span class="meta-value">${display(provenance.sessionId || provenance.testId || report.referenceId)}</span></div>` : ''}
          ${report.reportType === 'DAY' ? `<div class="meta-item"><span class="meta-label">DAY:</span> <span class="meta-value">${display(provenance.dayId || report.dayObservationId || report.referenceId)}</span></div>` : ''}
          ${report.reportType === 'WEEK' ? `<div class="meta-item"><span class="meta-label">Week:</span> <span class="meta-value">${display(`${report.periodStart || report.readableContent?.metricsSummary?.weekStart || 'Unavailable'} → ${report.periodEnd || report.readableContent?.metricsSummary?.weekEnd || 'Unavailable'}`)}</span></div>` : ''}
        </div>

        <div class="c50-banner">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase;">C50 ML Evaluation</span>
            <div style="font-size: 13px; font-weight: 800; color: #047857; margin-top: 2px; overflow-wrap:anywhere;">${display(c50Label)}</div>
          </div>
          <div style="font-size: 10px; color: #059669; font-weight: 600;">VERIFIED ENGINE</div>
        </div>

        <div class="summary-box">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0369a1; margin-bottom: 4px;">Executive Summary</div>
          <div style="color: #1e293b; line-height: 1.6; overflow-wrap:anywhere;">${display(report.readableContent?.summary || 'Assessment evaluation completed.')}</div>
        </div>

        <div style="margin-bottom: 20px;">
          ${sectionsHtml}
        </div>

        <div class="evidence-grid">
          <div class="evidence-card"><h3>Condition & Labels</h3><p><b>Pattern:</b> ${display(evidence.patternLabel || c50Label)}</p><p><b>Primary taxonomy:</b> ${display(evidence.primaryTaxonomy)}</p><p><b>Secondary taxonomy:</b> ${display(evidence.secondaryTaxonomy)}</p><p><b>Match type:</b> ${display(evidence.matchType)}</p><p><b>Dataset SNO:</b> ${display(evidence.matchedSno)}</p></div>
          <div class="evidence-card"><h3>Severity · Confidence · Trend</h3><p><b>Severity:</b> ${display(evidence.severityLabel)} (${display(evidence.severityScore)})</p><p><b>Confidence:</b> ${display(evidence.confidenceLevel)} (${display(evidence.confidenceScore)})</p><p><b>Trend:</b> ${display(evidence.trendLabel)}</p><p><b>Vector:</b> ${display(evidence.vectorLength)} stages</p></div>
        </div>
        <div class="evidence-card provenance" style="margin-top: 12px;"><h3>Source / Provenance</h3>${provenanceLines.map((line) => `<div>${display(line)}</div>`).join('')}</div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 10px; color: #64748b; font-family: monospace;">
          Source Reference: ${rawRef} · Stored: Firestore (/reports)
        </div>

        <div class="footer">
          <div>GOATEST Physiological Assessment Prototype · Non-diagnostic</div>
          <div>Confidential Report · Page count supplied by browser print</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    return { saved: false, shared: false };
  },
};

function pdfText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return pdfText(object.label ?? object.name ?? object.value ?? object.text ?? object.displayLabel ?? object.level ?? object.score);
  }
  return String(value).replace(/\s+/g, ' ').trim() || 'Unavailable';
}

function normalizedC50(report: ReportRecord) {
  const raw: any = report.c50Evidence || report.readableContent?.metricsSummary?.c50Metadata || report.readableContent?.metricsSummary || {};
  const metric: any = report.readableContent?.metricsSummary || {};
  const label = (value: unknown, fallback?: unknown) => pdfText(value === undefined || value === null ? fallback : value);
  return {
    pattern: label(raw.patternLabel, metric.c50Label),
    matchType: label(raw.matchType, metric.matchType || metric.matchStatus),
    matchedSno: label(raw.matchedSno, metric.matchedSno || metric.referenceDatasetSno),
    primaryTaxonomy: label(raw.primaryTaxonomy, metric.primaryTaxonomy || metric.classification),
    secondaryTaxonomy: label(raw.secondaryTaxonomy, metric.secondaryTaxonomy),
    dataset: label(raw.dataset, metric.dataset),
    severity: label(raw.severityLabel, metric.severity?.label || metric.severity),
    severityScore: label(raw.severityScore, metric.severity?.score),
    confidence: label(raw.confidenceLevel, metric.confidence?.level || metric.confidenceLevel),
    confidenceScore: label(raw.confidenceScore, metric.confidence?.score || metric.confidenceScore),
    trend: label(raw.trendLabel, metric.trend?.label || metric.trend),
    inputStages: Array.isArray(raw.inputStages) ? raw.inputStages : [],
    matchedStages: Array.isArray(raw.matchedStages) ? raw.matchedStages : [],
  };
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function buildAndroidPdf(report: ReportRecord, userName: string): Promise<string> {
  const evidence = normalizedC50(report);
  const sections = report.readableContent?.sections || [];
  const chunks: Uint8Array[] = [];
  const document = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `GOATEST ${report.reportType} Report`, Author: 'GOATEST' } });
  // The browser entry registers PDFKit's standard fonts at module load. Select
  // Helvetica explicitly so a missing registration fails before file writing.
  document.font('Helvetica');

  document.on('data', (chunk: Uint8Array) => chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)));
  const completed = new Promise<void>((resolve, reject) => {
    document.on('end', () => resolve());
    document.on('error', reject);
  });

  document.fontSize(22).fillColor('#0f172a').text('GOATEST', { continued: true });
  document.fontSize(10).fillColor('#64748b').text(`  ${report.reportType} CONDITION REPORT`);
  document.moveDown().strokeColor('#0f172a').moveTo(48, document.y).lineTo(547, document.y).stroke().moveDown();
  document.fontSize(10).fillColor('#0f172a')
    .text(`Patient: ${pdfText(userName)}`)
    .text(`Generated: ${pdfText(new Date(report.generatedAt).toLocaleString())}`)
    .text(`Report ID: ${pdfText(report.reportId)}`)
    .text(`Model Engine: ${pdfText(report.modelVersion || 'C50_V1.0')}`);
  document.moveDown();
  // Draw the watermark at a fixed position without moving PDFKit's flowing
  // text cursor; otherwise the following summary starts hundreds of points
  // lower and creates the large blank gap seen in Android exports.
  const flowingY = document.y;
  document.save().opacity(0.07).fontSize(82).fillColor('#0f172a').text('GOATEST', 105, 390, { rotate: -32 });
  document.y = flowingY;
  document.restore();
  document.fontSize(13).fillColor('#0369a1').text('EXECUTIVE SUMMARY');
  document.fontSize(10).fillColor('#1e293b').text(pdfText(report.readableContent?.summary || 'Assessment evaluation completed.'));
  document.moveDown();
  document.fontSize(13).fillColor('#0369a1').text('FINDINGS');
  for (const section of sections) {
    document.moveDown(0.5).fontSize(11).fillColor('#0f172a').text(pdfText(section.heading));
    document.fontSize(10).fillColor('#334155').text(pdfText(section.body));
    for (const bullet of section.bulletPoints || []) document.list([pdfText(bullet)], { bulletRadius: 1.5 });
  }
  document.moveDown().fontSize(13).fillColor('#0369a1').text('C50 ML EVALUATION');
  document.fontSize(10).fillColor('#334155')
    .text(`Pattern: ${evidence.pattern}`)
    .text(`Match type: ${evidence.matchType}`)
    .text(`Matched SNO: ${evidence.matchedSno}`)
    .text(`Dataset: ${evidence.dataset}`)
    .text(`Primary taxonomy: ${evidence.primaryTaxonomy}`)
    .text(`Secondary taxonomy: ${evidence.secondaryTaxonomy}`)
    .text(`Severity: ${evidence.severity} (${evidence.severityScore})`)
    .text(`Confidence: ${evidence.confidence} (${evidence.confidenceScore})`)
    .text(`Trend: ${evidence.trend}`);
  document.moveDown().fontSize(13).fillColor('#0369a1').text('C50 PARAMETERS');
  const tableX = 48; const tableWidth = 499; const rowHeight = 18; const valueX = 360;
  document.fontSize(9).fillColor('#0f172a').text('Parameter', tableX, document.y).text('Stage / Value', valueX, document.y);
  document.moveTo(tableX, document.y + 3).lineTo(tableX + tableWidth, document.y + 3).strokeColor('#94a3b8').stroke();
  for (let index = 0; index < CANONICAL_11_PARAMETERS.length; index += 1) {
    const y = document.y + 7;
    const input = evidence.inputStages[index]; const matched = evidence.matchedStages[index];
    document.fontSize(8.5).fillColor('#334155').text(CANONICAL_11_PARAMETERS[index].name, tableX, y, { width: 290 });
    document.text(`Stage ${pdfText(input)} / Match ${pdfText(matched)}`, valueX, y, { width: 180 });
    document.moveTo(tableX, y + rowHeight - 3).lineTo(tableX + tableWidth, y + rowHeight - 3).strokeColor('#e2e8f0').stroke();
    document.y = y + rowHeight;
  }
  document.moveDown().fontSize(8).fillColor('#64748b').text('GOATEST Physiological Assessment Prototype · Non-diagnostic · Confidential Report');
  document.end();
  await completed;
  return base64FromBytes(new Uint8Array(chunks.reduce((all, chunk) => {
    const next = new Uint8Array(all.length + chunk.length);
    next.set(all); next.set(chunk, all.length); return next;
  }, new Uint8Array())));
}

async function exportReportToAndroid(report: ReportRecord, userName: string): Promise<PdfExportResult> {
  const safeName = `GOATEST_${report.reportType}_${report.reportId}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const base64 = await buildAndroidPdf(report, userName);
  const saved = await Filesystem.writeFile({ path: `${safeName}.pdf`, data: base64, directory: Directory.Documents, recursive: true });
  const canShare = await Share.canShare();
  if (canShare.value) {
    await Share.share({ title: `GOATEST ${report.reportType} report`, url: saved.uri, dialogTitle: 'Open or share report PDF' });
    return { saved: true, shared: true, filename: `${safeName}.pdf` };
  }
  return { saved: true, shared: false, filename: `${safeName}.pdf` };
}
