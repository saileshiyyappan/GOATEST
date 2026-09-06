/**
 * GOATEST C50 ML Inference Service
 * 
 * PMT-2: Service Boundary to the External C50 Machine Learning Engine.
 * 
 * CORE PRINCIPLES:
 * 1. CLEAN BOUNDARY: Receives C50_INPUT_PACKET, invokes external inference, produces C50_RESULT_PACKET.
 * 2. NO HARDCODED SECRETS: Endpoint is configured via environment / server route (/api/c50/infer).
 * 3. NO FABRICATED HEALTH DATA: If endpoint is unconfigured or unreachable, returns explicit ML_NOT_CONFIGURED state.
 * 4. RAW OUTPUT PRESERVATION: The exact ML JSON response is saved untouched.
 * 5. ERROR HANDLING: Explicit technical error states (NOT_CONFIGURED, INVALID_INPUT, TIMEOUT, ML_ERROR, etc.).
 */

import type {
  C50InputPacket,
  C50ResultPacket,
  C50ServiceState,
  C50EndpointStatus,
  C50ResultStatus,
} from './c50Packet';
import { c50InputAdapter } from './c50InputAdapter';

export const C50_RESULT_VERSION = '1.0.0';
const DEFAULT_TIMEOUT_MS = 10000;

export class C50ServiceError extends Error {
  public code: C50ServiceState;
  public details?: unknown;

  constructor(message: string, code: C50ServiceState = 'ML_ERROR', details?: unknown) {
    super(message);
    this.name = 'C50ServiceError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Validates the raw response structure returned from the external ML engine
 */
export function validateC50ModelResponse(
  rawResponse: unknown,
  expectedInputId: string
): {
  modelVersion: string;
  predictionPayload?: Record<string, any> | null;
  featureSummary?: Record<string, any> | null;
  trendSummary?: Record<string, any> | null;
  classification?: string | null;
  confidence?: number | null;
} {
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new C50ServiceError(
      'Malformed response from C50 ML engine: payload is not an object',
      'ML_ERROR'
    );
  }

  const res = rawResponse as Record<string, any>;

  // Check if response contains an error flag from the external model
  if (res.error || res.status === 'ERROR') {
    throw new C50ServiceError(
      res.message || res.error || 'External C50 ML returned an error status',
      'ML_ERROR',
      res
    );
  }

  const modelVersion = String(res.modelVersion || res.model_version || 'C50_EXTERNAL_V1');
  const predictionPayload = res.predictionPayload || res.predictions || res.output || null;
  const featureSummary = res.featureSummary || res.features || null;
  const trendSummary = res.trendSummary || res.trends || null;
  const classification = typeof res.classification === 'string' ? res.classification : (typeof res.label === 'string' ? res.label : null);
  const confidence = typeof res.confidence === 'number' && Number.isFinite(res.confidence) ? res.confidence : null;

  return {
    modelVersion,
    predictionPayload,
    featureSummary,
    trendSummary,
    classification,
    confidence,
  };
}

export const c50Service = {
  /**
   * Checks whether the external C50 inference endpoint is configured and reachable.
   */
  async checkEndpointStatus(): Promise<C50EndpointStatus> {
    try {
      // First check server proxy status
      const response = await fetch('/api/c50/status', {
        method: 'GET',
        headers: { credentials: 'omit' },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          configured: Boolean(data.configured),
          endpointUrl: data.endpointUrl || null,
          state: data.configured ? 'SUCCESS' : 'NOT_CONFIGURED',
          modelVersion: data.modelVersion || 'C50_V1',
          message: data.message || (data.configured ? 'C50 ML engine is configured and ready.' : 'C50 ML engine endpoint is not configured.'),
        };
      }
    } catch {
      // Server route might not have responded or client is offline
    }

    // Client-side fallback check (if VITE_C50_ML_ENDPOINT is defined)
    const clientEndpoint = (import.meta as any).env?.VITE_C50_ML_ENDPOINT;
    if (clientEndpoint) {
      return {
        configured: true,
        endpointUrl: clientEndpoint,
        state: 'SUCCESS',
        modelVersion: 'C50_EXTERNAL',
        message: 'External C50 inference endpoint detected via client environment.',
      };
    }

    return {
      configured: false,
      endpointUrl: null,
      state: 'NOT_CONFIGURED',
      message: 'External C50 ML engine is not configured. Real inference will be executed when external Python engine is connected.',
    };
  },

  /**
   * Sends a C50_INPUT_PACKET to the external inference service and produces a C50_RESULT_PACKET.
   * 
   * If the external ML service is not configured:
   * Returns a typed C50ResultPacket with status 'ML_NOT_CONFIGURED' and NO fake clinical values.
   */
  async runInference(inputPacket: C50InputPacket, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<C50ResultPacket> {
    if (!inputPacket || !inputPacket.inputId || !inputPacket.userId) {
      throw new C50ServiceError('Invalid input packet: missing required identifiers', 'INVALID_INPUT');
    }

    const nowIso = new Date().toISOString();
    const resultId = `c50_res_${inputPacket.milestone.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Check if input packet is a development fixture
    if (inputPacket.isDevelopmentFixture) {
      return {
        version: C50_RESULT_VERSION,
        resultId,
        sourceInputId: inputPacket.inputId,
        sourceCmPacketId: inputPacket.sourceCmPacketId,
        userId: inputPacket.userId,
        milestone: inputPacket.milestone,
        timestamp: nowIso,
        modelVersion: 'C50_DEV_FIXTURE_STUB',
        status: 'SUCCESS',
        predictionPayload: {
          description: 'This is a raw C50 ML output fixture',
          isDevelopmentFixture: true,
          processedFeatureCount: Object.keys(inputPacket.physiologicalFeatures).length,
        },
        featureSummary: {
          milestone: inputPacket.milestone,
          target: inputPacket.target,
        },
        trendSummary: null,
        classification: null,
        confidence: null,
        rawResponse: {
          fixture: true,
          description: 'This is a raw C50 ML output fixture',
          receivedInputId: inputPacket.inputId,
        },
        isFixture: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    // 2. Check endpoint status
    const status = await this.checkEndpointStatus();

    if (!status.configured) {
      // External model not configured - Return clean technical unconfigured state.
      // ZERO fake clinical data.
      return {
        version: C50_RESULT_VERSION,
        resultId,
        sourceInputId: inputPacket.inputId,
        sourceCmPacketId: inputPacket.sourceCmPacketId,
        userId: inputPacket.userId,
        milestone: inputPacket.milestone,
        timestamp: nowIso,
        modelVersion: 'C50_UNCONFIGURED',
        status: 'ML_NOT_CONFIGURED',
        predictionPayload: null,
        featureSummary: null,
        trendSummary: null,
        classification: null,
        confidence: null,
        rawResponse: {
          state: 'ML_NOT_CONFIGURED',
          message: 'External C50 ML engine is not configured in this environment.',
          inputId: inputPacket.inputId,
          timestamp: nowIso,
        },
        errorMessage: 'External C50 ML engine endpoint is not configured.',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    // 3. Attempt inference request to server proxy (/api/c50/infer) or direct client endpoint
    const endpoint = status.endpointUrl || '/api/c50/infer';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputPacket }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errMessage = `ML service HTTP error: ${response.status} ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody.message) errMessage = errBody.message;
        } catch {
          // ignore
        }
        throw new C50ServiceError(errMessage, 'ML_ERROR');
      }

      const rawJson = await response.json();

      // 4. Validate output response
      const validated = validateC50ModelResponse(rawJson, inputPacket.inputId);

      return {
        version: C50_RESULT_VERSION,
        resultId,
        sourceInputId: inputPacket.inputId,
        sourceCmPacketId: inputPacket.sourceCmPacketId,
        userId: inputPacket.userId,
        milestone: inputPacket.milestone,
        timestamp: new Date().toISOString(),
        modelVersion: validated.modelVersion,
        status: 'SUCCESS',
        predictionPayload: validated.predictionPayload,
        featureSummary: validated.featureSummary,
        trendSummary: validated.trendSummary,
        classification: validated.classification,
        confidence: validated.confidence,
        rawResponse: rawJson, // Raw untouched response preserved
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof C50ServiceError) {
        throw err;
      }

      const isAbort = (err as Error)?.name === 'AbortError';
      if (isAbort) {
        throw new C50ServiceError(`C50 ML inference request timed out after ${timeoutMs}ms`, 'TIMEOUT');
      }

      throw new C50ServiceError(
        `Failed to communicate with C50 ML engine: ${(err as Error)?.message || String(err)}`,
        'ML_ERROR',
        err
      );
    }
  },
};
