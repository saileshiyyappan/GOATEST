import type { ConditionReportDocument } from './conditionTypes';

type PdfLine = { text: string; size?: number; bold?: boolean; gap?: number };
const clean = (value: string) => value.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

class PdfFlow {
  private pages: string[][] = [[]];
  private y = 800;
  private readonly margin = 44;
  private page() { this.pages.push([]); this.y = 800; }
  private ensure(height: number) { if (this.y - height < 44) this.page(); }
  private add(command: string) { this.pages[this.pages.length - 1].push(command); }
  text(value: string, size: number, bold = false, gap = 5) {
    const wrapped = clean(value || '').match(/.{1,88}(?:\s|$)/g) || [''];
    wrapped.forEach((part) => { this.ensure(size + gap + 2); this.add(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${this.margin} ${this.y} Td (${part.trim()}) Tj ET`); this.y -= size + gap; });
  }
  section(title: string, rows: PdfLine[]) {
    const estimated = 34 + rows.reduce((total, row) => total + Math.max(1, Math.ceil((row.text || '').length / 88)) * ((row.size || 9) + (row.gap === undefined ? 5 : row.gap)), 0);
    this.ensure(estimated); const start = this.y; const before = this.y; this.text(title, 13, true, 8);
    rows.forEach((row) => this.text(row.text, row.size || 9, row.bold, row.gap === undefined ? 5 : row.gap));
    const bottom = this.y - 7; const top = Math.max(start, before); this.add(`q 0.86 0.88 0.92 RG 1 w ${this.margin - 8} ${bottom} m 551 ${bottom} l 551 ${top + 9} l ${this.margin - 8} ${top + 9} l h S Q`); this.y -= 14;
  }
  output() { return this.pages.map((commands) => commands.join('\n')); }
}

export function downloadConditionReportPdf(report: ConditionReportDocument): void {
  const flow = new PdfFlow();
  flow.text('GOATEST', 24, true, 4); flow.text('CONDITION REPORT', 16, true, 12);
  flow.section('TEST DETAILS', [{ text: `DATE / TIME: ${report.createdAt}`, size: 9 }, { text: `REPORT ID: ${report.reportId}`, size: 9 }, { text: `UID: ${report.uid}`, size: 9, gap: 10 }]);
  flow.section('CONDITION REPORT', [{ text: report.patternInterpretation || report.dominantPattern, size: 15, bold: true, gap: 8 }, { text: `TAXONOMY: ${report.taxonomy.primary}`, size: 10 }, { text: `SEVERITY: C50 ${report.severity.label} (${report.severity.score})`, size: 10 }, { text: `CONFIDENCE: ${report.confidence.level} (${report.confidence.score})`, size: 10 }, { text: `TREND: ${report.trend.label}`, size: 10, gap: 10 }]);
  flow.section('LABELS', [{ text: `PRIMARY TAXONOMY: ${report.taxonomy.primary}`, size: 9 }, { text: `SECONDARY TAXONOMY: ${report.taxonomy.secondary}`, size: 9 }, { text: `PATTERN LABEL: ${report.patternInterpretation || report.dominantPattern}`, size: 9 }, { text: `REFERENCE SNO: #${report.matchedPattern.matchedDatasetSno}`, size: 9 }, { text: `MATCH TYPE: ${report.matchedPattern.matchStatus}`, size: 9 }, { text: `DISTANCE: ${report.matchedPattern.distanceScore}`, size: 9, gap: 10 }]);
  flow.section('AI REPORT', [{ text: report.conditionSummary, size: 10 }, { text: report.whatWasDetected, size: 10, gap: 10 }]);
  flow.section('HEALTH CARE GUIDANCE', [{ text: 'WHAT SHOULD I DO NOW?', size: 10, bold: true }, { text: report.whatShouldIDoNow, size: 10 }, { text: 'WELLNESS / MONITORING', size: 10, bold: true }, { text: report.wellnessMonitoringGuidance, size: 10, gap: 10 }]);
  flow.section('PHYSIOLOGICAL EVIDENCE', report.parameters.map((parameter) => ({ text: `${parameter.name}: Stage ${parameter.inputStage} -> ${parameter.matchedStage}`, size: 9 })));
  flow.section('TECHNICAL EVIDENCE & AUDIT', [{ text: `PRIMARY TAXONOMY: ${report.taxonomy.primary}`, size: 9 }, { text: `SECONDARY TAXONOMY: ${report.taxonomy.secondary}`, size: 9 }, { text: `LABEL VERIFICATION: ${report.labelVerificationStatus}`, size: 9 }, { text: `RAW STAGE VECTOR: [${report.matchedPattern.inputStages.join(', ')}]`, size: 9 }, { text: `MATCHED STAGE VECTOR: [${report.matchedPattern.matchedStages.join(', ')}]`, size: 9 }]);
  flow.text(report.limitationsDisclaimer, 8, false, 4);

  const pageStreams = flow.output();
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', '', ''];
  const pageRefs: string[] = []; const font1Index = 4 + pageStreams.length * 2;
  pageStreams.forEach((stream) => { const contentIndex = objects.length + 1; objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`); const pageIndex = objects.length + 1; objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1Index} 0 R /F2 ${font1Index + 1} 0 R >> >> /Contents ${contentIndex} 0 R >>`); pageRefs.push(`${pageIndex} 0 R`); });
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`; objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${(report.formattedTitle || report.reportId).replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`; anchor.click(); URL.revokeObjectURL(url);
}
