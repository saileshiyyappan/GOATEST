/**
 * GOATEST AI Assistant Service
 * 
 * Communicates with the server-side universal GOATEST AI service.
 * Preserves message history and enforces health safety guidance.
 * ZERO fake or mocked client-side responses.
 */

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
}

export interface AiChatResponse {
  success?: boolean;
  text?: string;
  message?: string;
  model?: string;
  timestamp?: string;
  error?: {
    type?: string;
    message?: string;
    retryable?: boolean;
  };
}

import { requestUniversalAiText, UniversalAiError } from './aiConfigService';

export class AiServiceError extends Error {
  public type: string;
  public retryable: boolean;

  constructor(message: string, type: string = 'UNKNOWN_AI_ERROR', retryable: boolean = true) {
    super(message);
    this.name = 'AiServiceError';
    this.type = type;
    this.retryable = retryable;
  }
}

export const aiService = {
  /**
   * Send a chat message with history to the canonical AI pipeline.
   */
  async sendMessage(
    userMessage: string,
    history: ChatMessage[] = []
  ): Promise<string> {
    if (!userMessage.trim()) {
      throw new AiServiceError('Message cannot be empty.', 'INVALID_REQUEST', false);
    }

    try {
      return await requestUniversalAiText(userMessage.trim(), history);
    } catch (err) {
      if (err instanceof UniversalAiError) throw new AiServiceError(err.message, err.code, err.retryable);
      if (err instanceof Error) throw new AiServiceError(err.message, 'AI_REQUEST_FAILED', true);
      throw new AiServiceError('AI request failed. Please retry.', 'AI_REQUEST_FAILED', true);
    }

  },
};
