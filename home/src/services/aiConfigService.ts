import type { ChatMessage } from './aiService';
import { GOATEST_AI_SYSTEM_INSTRUCTION } from './aiPrompt';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const USER_KEY_STORAGE = 'goatest.user.openrouter.api.key';
const USER_KEY_FILE = 'goatest_openrouter_api_key.txt';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const FALLBACK_MODELS = ['google/gemini-2.0-flash-001'];
const REQUEST_TIMEOUT_MS = 30_000;

export interface UniversalAiResponse { ok: boolean; text?: string; model?: string; provider?: string; code?: string; }
export interface AiRequestOptions { responseMimeType?: string; maxTokens?: number; }
type AiMode = 'universal' | 'user' | 'unconfigured';

function userMessage(code?: string): string {
  switch (code) {
    case 'AI_NOT_CONFIGURED': return 'Configure an OpenRouter API key in Settings to use AI.';
    case 'AI_AUTH_ERROR': return 'The OpenRouter API key was rejected. Check the key in Settings.';
    case 'AI_PAYMENT_REQUIRED': return 'The OpenRouter account has no available usage credit.';
    case 'AI_RATE_LIMIT': return 'OpenRouter is temporarily busy. Please retry.';
    case 'AI_MODEL_NOT_FOUND': return 'The configured AI model is unavailable.';
    case 'AI_MODEL_ERROR': return 'The selected AI model is incompatible with this request.';
    case 'AI_REQUEST_FORMAT_ERROR': return 'The selected model rejected the request format.';
    case 'AI_TIMEOUT': return 'AI request timed out. Please retry.';
    case 'AI_OUTPUT_LIMIT': return 'AI response was truncated. Please retry.';
    case 'AI_NETWORK_ERROR': return 'Could not connect to OpenRouter. Check the network and retry.';
    case 'AI_PROVIDER_ERROR': return 'OpenRouter could not complete the request. Please retry.';
    case 'AI_RESPONSE_ERROR': return 'OpenRouter returned an invalid response.';
    default: return 'AI service is temporarily unavailable.';
  }
}

export class UniversalAiError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  constructor(code: string, retryable = true) { super(userMessage(code)); this.name = 'UniversalAiError'; this.code = code; this.retryable = retryable; }
}

function cleanKey(value: unknown): string {
  let key = typeof value === 'string' ? value.trim() : '';
  if (key.length >= 2 && ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))) {
    key = key.slice(1, -1).trim();
  }
  return key && key !== 'SET_IN_BUILD_SECRET' && key !== 'SET_IN_DEPLOYMENT_SECRET_STORE' ? key : '';
}
function universalKey(): string { return cleanKey(import.meta.env.VITE_OPENROUTER_API_KEY); }
function localUserKey(): string { try { return cleanKey(localStorage.getItem(USER_KEY_STORAGE)); } catch { return ''; } }
async function persistentUserKey(): Promise<string> {
  const local = localUserKey();
  if (local) return local;
  try {
    const result = await Filesystem.readFile({ path: USER_KEY_FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    const fileKey = cleanKey(result.data);
    if (fileKey) {
      try { localStorage.setItem(USER_KEY_STORAGE, fileKey); } catch { /* filesystem remains canonical */ }
    }
    return fileKey;
  } catch { return ''; }
}
async function selectedKey(): Promise<{ key: string; mode: AiMode }> {
  const universal = universalKey();
  if (universal) return { key: universal, mode: 'universal' };
  const personal = await persistentUserKey();
  if (personal) return { key: personal, mode: 'user' };
  return { key: '', mode: 'unconfigured' };
}
function configuredModels(): string[] {
  const primary = cleanKey(import.meta.env.VITE_OPENROUTER_MODEL) || DEFAULT_MODEL;
  const configured = String(import.meta.env.VITE_OPENROUTER_FALLBACK_MODELS || '').split(',').map(cleanKey).filter(Boolean);
  return [...new Set([primary, ...configured, ...FALLBACK_MODELS])];
}
function responseCode(status: number, payload: any): string {
  if (status === 401 || status === 403) return 'AI_AUTH_ERROR';
  if (status === 402) return 'AI_PAYMENT_REQUIRED';
  if (status === 408) return 'AI_TIMEOUT';
  if (status === 429) return 'AI_RATE_LIMIT';
  if (status === 404) return 'AI_MODEL_NOT_FOUND';
  if (status === 400) {
    const detail = `${payload?.error?.code || ''} ${payload?.error?.message || ''}`.toLowerCase();
    if (detail.includes('model') || detail.includes('unsupported') || detail.includes('parameter') || detail.includes('response format') || detail.includes('provider')) return detail.includes('model') ? 'AI_MODEL_ERROR' : 'AI_REQUEST_FORMAT_ERROR';
  }
  if (status >= 500) return 'AI_PROVIDER_ERROR';
  return 'AI_INVALID_RESPONSE';
}
function toMessages(message: string, history: ChatMessage[]) {
  return [{ role: 'system', content: GOATEST_AI_SYSTEM_INSTRUCTION }, ...history.slice(-20).map((item) => ({ role: item.sender === 'assistant' ? 'assistant' : 'user', content: String(item.text || '') })), { role: 'user', content: message }];
}

async function requestModel(key: string, model: string, message: string, history: ChatMessage[], maxTokens: number): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.origin || 'https://goatest.app', 'X-Title': 'GOATEST' },
        body: JSON.stringify({ model, messages: toMessages(message, history), temperature: 0.7, max_tokens: maxTokens }),
    });
    const payload = await response.json().catch(() => ({}));
    const finishReason = payload?.choices?.[0]?.finish_reason;
    console.info('[AI] response', { endpoint: OPENROUTER_ENDPOINT, status: response.status, model, finishReason });
    if (!response.ok) {
      const code = responseCode(response.status, payload);
      throw new UniversalAiError(code, ['AI_MODEL_ERROR', 'AI_REQUEST_FORMAT_ERROR', 'AI_PROVIDER_ERROR', 'AI_TIMEOUT'].includes(code));
    }
    if (finishReason === 'length' || finishReason === 'max_tokens') throw new UniversalAiError('AI_OUTPUT_LIMIT');
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new UniversalAiError('AI_INVALID_RESPONSE');
    return text.trim();
  } catch (error) {
    if (error instanceof UniversalAiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new UniversalAiError('AI_TIMEOUT');
    throw new UniversalAiError('AI_NETWORK_ERROR');
  } finally { window.clearTimeout(timeout); }
}

export async function requestUniversalAiText(message: string, history: ChatMessage[] = [], options: AiRequestOptions = {}): Promise<string> {
  const cleanMessage = message.trim();
  if (!cleanMessage) throw new UniversalAiError('AI_INVALID_RESPONSE', false);
  const selection = await selectedKey();
  if (!selection.key) throw new UniversalAiError('AI_NOT_CONFIGURED', false);
  console.info('[AI] request start', { endpoint: OPENROUTER_ENDPOINT, method: 'POST', mode: selection.mode, outputLimit: options.maxTokens || 1000 });
  let lastError: UniversalAiError | null = null;
  for (const model of configuredModels()) {
    try { return await requestModel(selection.key, model, cleanMessage, history, options.maxTokens || 1000); }
    catch (error) {
      lastError = error instanceof UniversalAiError ? error : new UniversalAiError('AI_NETWORK_ERROR');
      if (!['AI_MODEL_NOT_FOUND', 'AI_MODEL_ERROR', 'AI_REQUEST_FORMAT_ERROR', 'AI_PROVIDER_ERROR', 'AI_TIMEOUT'].includes(lastError.code)) throw lastError;
    }
  }
  throw lastError || new UniversalAiError('AI_PROVIDER_ERROR');
}

export function getAiConfiguration(): { mode: AiMode; hasUniversalKey: boolean; hasUserKey: boolean } { const hasUser = Boolean(localUserKey()); return { mode: universalKey() ? 'universal' : hasUser ? 'user' : 'unconfigured', hasUniversalKey: Boolean(universalKey()), hasUserKey: hasUser }; }
export async function hydrateUserOpenRouterKey(): Promise<boolean> { return Boolean(await persistentUserKey()); }
export async function saveUserOpenRouterKey(value: string): Promise<void> {
  const key = cleanKey(value);
  if (!key) throw new UniversalAiError('AI_AUTH_ERROR', false);
  let localSaved = false;
  let fileSaved = false;
  try { localStorage.setItem(USER_KEY_STORAGE, key); localSaved = localUserKey() === key; } catch { /* filesystem fallback below */ }
  try { await Filesystem.writeFile({ path: USER_KEY_FILE, data: key, directory: Directory.Data, encoding: Encoding.UTF8 }); fileSaved = true; } catch { /* localStorage may still be available */ }
  if (!localSaved && !fileSaved) throw new UniversalAiError('AI_PROVIDER_ERROR', false);
}
export async function clearUserOpenRouterKey(): Promise<void> { try { localStorage.removeItem(USER_KEY_STORAGE); } catch { /* best effort */ } try { await Filesystem.deleteFile({ path: USER_KEY_FILE, directory: Directory.Data }); } catch { /* already absent */ } }
export const aiConfigService = { isConfigured(): boolean { return Boolean(universalKey() || localUserKey()); }, async checkAvailability(): Promise<boolean> { try { await requestUniversalAiText('Reply with exactly: GOATEST_AI_OK'); return true; } catch { return false; } } };
export async function requestAiText(prompt: string, options: AiRequestOptions = {}): Promise<string> { return requestUniversalAiText(prompt, [], options); }
export async function runAiDiagnostic(): Promise<{ model: string; success: boolean; text?: string; error?: string }> { try { const text = await requestUniversalAiText('Reply with exactly: GOATEST_AI_OK'); return { model: 'openrouter', success: text === 'GOATEST_AI_OK', text }; } catch (error) { return { model: 'openrouter', success: false, error: error instanceof Error ? error.message : 'AI diagnostic failed.' }; } }
