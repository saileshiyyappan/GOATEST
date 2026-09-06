import { CmPacket } from '../../types/compare';

/**
 * Terminal Logging Bridge for GOATEST Compare Pipeline
 * 
 * Strict Requirement: Terminal must show ONLY the final CM_PACKET.
 * All diagnostic noise ([PHB FETCH START], [PHB FETCH RESULT], [PHB BASELINES],
 * [PHB DEVIATION CONFIG], [SHB PACKET], [COMPARE INPUT], [COMPARE CALCULATION],
 * [SHB PHYSIOLOGICAL AUDIT], [RR SOURCE], etc.) is suppressed.
 */

export class TerminalLogger {
  private static instance: TerminalLogger;

  public static getInstance(): TerminalLogger {
    if (!TerminalLogger.instance) {
      TerminalLogger.instance = new TerminalLogger();
    }
    return TerminalLogger.instance;
  }

  private getTerminalLogUrl(): string | null {
    if (typeof window === 'undefined') return null;

    const configured = (import.meta.env.VITE_TERMINAL_LOG_URL || '').trim();
    if (configured) return configured.replace(/\/$/, '');

    // Unified HOME server owns the diagnostic terminal endpoint.
    return '/api/terminal-log';
  }

  /**
   * Forwards lines to development terminal and console
   */
  public logToTerminal(lines: string | string[]): void {
    const logArray = Array.isArray(lines) ? lines : [lines];

    logArray.forEach((line) => {
      console.log(line);
    });

    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const terminalLogUrl = this.getTerminalLogUrl();
      if (!terminalLogUrl) return;

      try {
        fetch(terminalLogUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: logArray }),
        }).catch(() => {
          // Ignore terminal bridge errors so the app can continue even when the local dev logger is unavailable.
        });
      } catch {
        // Ignore fetch errors
      }
    }
  }

  /**
   * Authoritative Single CM_PACKET Terminal Output
   */
  public logCmPacket(cmPacket: CmPacket): void {
    // Strip rows/compatibility aliases from raw JSON dump for clean authoritative schema output
    const cleanPacket: any = {
      version: cmPacket.version,
      packetType: 'CM_PACKET',
      sessionId: cmPacket.sessionId,
      uid: cmPacket.uid,
      target: cmPacket.target || cmPacket.targetOrgan || 'OVERALL',
      timestamp: cmPacket.timestamp,
      parameters: (cmPacket.parameters || []).map((p) => ({
        key: p.key,
        name: p.name,
        parameter: p.name || p.parameter,
        type: p.type,
        unit: p.unit,
        phbBaseline: p.phbBaseline,
        shbValue: p.shbValue,
        deviation: p.deviation,
        deviationDistance: p.deviationDistance,
        direction: p.direction,
        rawStageMagnitudes: p.rawStageMagnitudes,
        cumulativeBoundaries: p.cumulativeBoundaries,
        matchedStage: p.matchedStage,
        matchedBoundary: p.matchedBoundary,
        ...(p.beyondBoundary ? { beyondBoundary: true } : {}),
        phbDevs: p.phbDevs,
        shbDevs: p.shbDevs,
        compare: p.compare,
        directionality: p.directionality,
        status: p.status,
        compareStage: p.compareStage ?? (typeof p.matchedStage === 'number' ? p.matchedStage : null),
      })),
      validParameterCount: cmPacket.validParameterCount,
      missingParameters: cmPacket.missingParameters || cmPacket.missingShbParameters || [],
      missingShbParameters: cmPacket.missingShbParameters || [],
      missingPhbParameters: cmPacket.missingPhbParameters || [],
      status: cmPacket.status,
    };

    const lines = [
      '[CM_PACKET]',
      JSON.stringify(cleanPacket, null, 2),
      '[CM_PACKET END]',
    ];

    this.logToTerminal(lines);
  }

  // Legacy/Diagnostic methods are kept as no-ops to prevent breaking older imports
  public logCmPacketFinal(cmPacket: CmPacket): void {
    this.logCmPacket(cmPacket);
  }
  public logPhbFetchStart(_info: any): void {}
  public logPhbFetchResult(_info: any): void {}
  public logPhbBaselines(_info: any): void {}
  public logPhbDeviationConfig(_info: any): void {}
  public logRrSource(_info: any): void {}
  public logPhbJsonCache(_info: any): void {}
  public logShbPacket(_info: any): void {}
  public logCompareInput(_info: any): void {}
  public logPhbSync(_info: any): void {}
  public logPhbSyncError(_uid: string, _reason: string, _details?: any): void {}
  public logCompareHeader(_info: any): void {}
  public logPhysiologicalAudit(_audits: any[]): void {}
  public logCompareFeature(_feature: any): void {}
  public logCompareTableData(_canonical: any[], _shbOnly: any[]): void {}
}

export const terminalLogger = TerminalLogger.getInstance();
