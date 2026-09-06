/**
 * Packet Reassembler for BLE Telemetry Streams
 * Handles MTU chunk fragmentation, multi-packet buffering, newline/semicolon/delimiter framing,
 * and JSON/binary packet extraction.
 */

export class PacketReassembler {
  private textBuffer: string = '';
  private flushTimeout: any = null;

  /**
   * Pushes incoming raw notification payload (string or DataView)
   * Returns an array of complete frames ready for parsing.
   */
  public push(raw: string | DataView): string[] {
    const frames: string[] = [];

    if (raw instanceof DataView) {
      // Check if text or pure binary
      try {
        const decoder = new TextDecoder('utf-8');
        const decoded = decoder.decode(raw);
        // If it looks like text (contains letters or ASCII printable characters)
        if (/^[\x20-\x7E\r\n\t]+$/.test(decoded)) {
          return this.push(decoded);
        }
      } catch {
        // Pure binary packet: pass through as-is (non-fragmented binary frame)
        return [];
      }
    }

    if (typeof raw !== 'string') {
      return [];
    }

    this.textBuffer += raw;

    // Reset trailing flush timer
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    // Check for delimiter-separated lines (\n, \r\n, or ;)
    if (this.textBuffer.includes('\n') || this.textBuffer.includes('\r')) {
      const lines = this.textBuffer.split(/[\r\n]+/);
      // The last element is either empty (if ended with newline) or an incomplete trailing fragment
      const incompleteFragment = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          frames.push(trimmed);
        }
      }
      this.textBuffer = incompleteFragment;
    } else if (this.textBuffer.includes(';')) {
      // Semicolon-delimited frame streaming
      const segments = this.textBuffer.split(';');
      const incompleteFragment = segments.pop() ?? '';
      for (const seg of segments) {
        const trimmed = seg.trim();
        if (trimmed.length > 0) {
          frames.push(trimmed);
        }
      }
      this.textBuffer = incompleteFragment;
    } else if (this.isCompleteJsonOrTelemetry(this.textBuffer)) {
      // Complete self-contained JSON or key-value packet without trailing delimiter
      frames.push(this.textBuffer.trim());
      this.textBuffer = '';
    } else {
      // Buffer incomplete fragment and set a short fallback flush timer (150ms)
      // to handle devices that don't send explicit delimiters per frame
      this.flushTimeout = setTimeout(() => {
        if (this.textBuffer.trim().length > 0) {
          const fl = this.textBuffer.trim();
          this.textBuffer = '';
          if (this.onFlushCallback) {
            this.onFlushCallback([fl]);
          }
        }
      }, 150);
    }

    return frames;
  }

  private onFlushCallback?: (frames: string[]) => void;

  public setOnFlush(callback: (frames: string[]) => void) {
    this.onFlushCallback = callback;
  }

  public reset() {
    this.textBuffer = '';
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  /**
   * Checks if string is a complete balanced JSON object or complete key-value statement
   */
  private isCompleteJsonOrTelemetry(str: string): boolean {
    const s = str.trim();
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        JSON.parse(s);
        return true;
      } catch {
        return false;
      }
    }
    // Key-value pair with at least one complete metric and no trailing dangling '=' or ','
    if (s.includes('=') && !s.endsWith('=') && !s.endsWith(',')) {
      // If it contains multiple pairs or known telemetry keys
      if (/^(?:VITAL:|STATUS:|BFIT:|PROGRESS:)?(?:[A-Za-z0-9_]+=[^=,]+(?:,|$))+$/.test(s)) {
        return true;
      }
    }
    return false;
  }
}
