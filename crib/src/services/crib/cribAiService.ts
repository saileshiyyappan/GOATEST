/**
 * CRIB AI Service Client
 * PMT-8: Handles real API communication between CRIB frontend and backend AI routes.
 * Pure consumer of physiological state with deterministic fallback.
 */

import { CribAiMessage, CribGuidanceItem } from '../../types/crib';
import { CribAiContextPayload } from './cribAiContext';

export interface AiChatResponse {
  reply: string;
  priority: 'normal' | 'high' | 'urgent';
  timestamp: number;
  directives?: string[];
  isFallback?: boolean;
}

export interface AiGuidanceResponse {
  directives: string[];
  priority: 'normal' | 'high' | 'urgent';
  timestamp: number;
  isFallback?: boolean;
}

export class CribAiService {
  /**
   * Send a chat query to the CRIB AI backend endpoint with full structured context.
   */
  public static async sendChatMessage(params: {
    message: string;
    context: CribAiContextPayload;
    history: CribAiMessage[];
  }): Promise<AiChatResponse> {
    const { message, context, history } = params;

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      throw new Error('Chat message cannot be empty');
    }

    try {
      const response = await fetch('/api/crib/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedMsg,
          context,
          history: history.slice(-6).map((m) => ({
            role: m.role,
            message: m.message,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: HTTP ${response.status}`);
      }

      const data = (await response.json()) as AiChatResponse;
      return data;
    } catch (err) {
      console.warn('CRIB AI Chat backend request failed, applying deterministic fallback:', err);
      // Construct mode-appropriate deterministic guidance fallback message
      const fallbackReply = this.generateDeterministicChatReply(context, trimmedMsg);
      return {
        reply: fallbackReply,
        priority: context.mode === 'SSB' ? 'urgent' : 'normal',
        timestamp: Date.now(),
        isFallback: true,
        directives: context.deterministicDirectives,
      };
    }
  }

  /**
   * Request dynamic AI guidance directives tailored to the current physiological state & mode.
   */
  public static async requestGuidanceDirectives(
    context: CribAiContextPayload
  ): Promise<AiGuidanceResponse> {
    try {
      const response = await fetch('/api/crib/ai/guidance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) {
        throw new Error(`Guidance API error: HTTP ${response.status}`);
      }

      const data = (await response.json()) as AiGuidanceResponse;
      return data;
    } catch (err) {
      console.warn('CRIB AI Guidance backend request failed, falling back to deterministic registry:', err);
      return {
        directives: context.deterministicDirectives,
        priority: context.mode === 'SSB' ? 'urgent' : 'high',
        timestamp: Date.now(),
        isFallback: true,
      };
    }
  }

  /**
   * Converts string directives into typed CribGuidanceItems
   */
  public static mapDirectivesToItems(directives: string[], prefix = 'ai'): CribGuidanceItem[] {
    return directives.map((dir, idx) => ({
      id: `${prefix}-guidance-${idx}-${Date.now()}`,
      text: dir.toUpperCase().trim(),
      level: idx === 0 ? 'critical' : idx < 3 ? 'warning' : 'info',
    }));
  }

  /**
   * Deterministic chat reply generator when backend API is unavailable.
   */
  private static generateDeterministicChatReply(context: CribAiContextPayload, userMsg: string): string {
    const { mode, conditionResult, deterministicDirectives, currentVitals } = context;

    if (mode === 'SSB') {
      return (
        `[SSB EMERGENCY ASSISTANT] Follow primary emergency directives: ` +
        deterministicDirectives.slice(0, 3).join(', ') +
        `. Continue monitoring breathing and stay beside the individual.`
      );
    }

    if (mode === 'DIAG') {
      const condition = conditionResult ? conditionResult.label : 'DIAGNOSTIC';
      return (
        `[DIAG COPILOT] Assisting with ${condition}. Recommended steps: ` +
        deterministicDirectives.slice(0, 3).join(', ') +
        `. Check vital changes regularly.`
      );
    }

    // SDCU mode
    const hr = currentVitals['HR'] || currentVitals['HEART RATE'];
    const hrText = hr ? ` Current HR is ${hr}.` : '';
    return (
      `[SDCU COPILOT] Directives: ` +
      deterministicDirectives.slice(0, 3).join(', ') +
      `.${hrText} Remain calm and seated.`
    );
  }
}
