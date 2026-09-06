/**
 * GOATEST Full-Stack Application Server
 * 
 * Express backend providing:
 * 1. Server-side universal AI Assistant API (/api/ai/chat)
 * 2. Multi-source verified Health News aggregator (/api/news)
 * 3. Vite development middleware & production static asset serving
 */

import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { verifyIntegrationBearerToken } from '../c50/src/services/integration/firebaseAdminAuth';
import { reportStore } from '../c50/src/services/condition/reportStore';
import { generateReportPdfBuffer } from '../c50/src/services/condition/reportGenerator';
import { getAuthoritativeReportWithAdmin } from '../c50/src/services/integration/adminTestPersistence';
import { getAdminFirestore } from '../c50/src/services/integration/firebaseAdminAuth';
import { getMessaging } from 'firebase-admin/messaging';
import { GOATEST_AI_SYSTEM_INSTRUCTION } from './src/services/aiPrompt';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

const allowedCorsOrigins = new Set((process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedCorsOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.post('/api/devices', async (req, res) => {
  try {
    const uid = await verifyIntegrationBearerToken(req.headers.authorization);
    const token = String(req.body?.token || '').trim();
    if (!token || token.length < 20) return res.status(400).json({ ok: false, code: 'INVALID_DEVICE_TOKEN' });
    const platform = String(req.body?.platform || '').toLowerCase();
    if (platform !== 'android') return res.status(400).json({ ok: false, code: 'INVALID_DEVICE_PLATFORM' });
    const deviceId = String(req.body?.deviceId || token.slice(-24)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    await getAdminFirestore().collection('users').doc(uid).collection('devices').doc(deviceId).set({ token, platform, deviceId, enabled: true, updatedAt: new Date().toISOString() }, { merge: true });
    console.info('[FCM] device registration', { backendStatus: 200, platform });
    return res.json({ ok: true });
  } catch (error: any) {
    const status = error.statusCode || 500;
    console.warn('[FCM] device registration failed', { backendStatus: status });
    return res.status(status).json({ ok: false, code: 'DEVICE_REGISTRATION_FAILED' });
  }
});

app.post('/api/notifications/push', async (req, res) => {
  try {
    const sourceUid = await verifyIntegrationBearerToken(req.headers.authorization);
    const requested = Array.isArray(req.body?.recipientUids) ? req.body.recipientUids.filter((value: unknown): value is string => typeof value === 'string') : [];
    const notification = req.body?.notification || {};
    if (!requested.length || !notification.title || !notification.body || !notification.type) return res.status(400).json({ ok: false, code: 'INVALID_PUSH_REQUEST' });
    const db = getAdminFirestore();
    const authorized = new Set<string>([sourceUid]);
    const caretakers = await db.collection('users').where('role', '==', 'CARETAKER').where('monitoredUserIds', 'array-contains', sourceUid).get();
    caretakers.docs.forEach((item) => authorized.add(item.id));
    const recipientUids = requested.filter((uid: string) => authorized.has(uid));
    const deviceEntries: Array<{ uid: string; deviceId: string; token: string }> = [];
    for (const uid of recipientUids) {
      const devices = await db.collection('users').doc(uid).collection('devices').where('enabled', '==', true).get();
      devices.docs.forEach((device) => { const token = device.data().token; if (typeof token === 'string' && token) deviceEntries.push({ uid, deviceId: device.id, token }); });
    }
    const tokens = [...new Set(deviceEntries.map((entry) => entry.token))];
    console.info('[FCM] push dispatch', { recipientCount: recipientUids.length, deviceCount: tokens.length });
    if (!tokens.length) return res.json({ ok: true, sent: 0 });
    const result = await getMessaging().sendEachForMulticast({ tokens, notification: { title: String(notification.title), body: String(notification.body) }, data: { type: String(notification.type), notificationId: String(notification.id || ''), sourceUserUid: sourceUid, reportId: String(notification.reportId || ''), observationId: String(notification.observationId || ''), actionTab: String(notification.actionTab || 'home') }, android: { notification: { channelId: 'goatest-alerts-v2', icon: 'ic_stat_goatest', color: '#000000' } } });
    const invalidCodes = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
    const staleDevices = result.responses.flatMap((response, index) => response.success || !response.error || !invalidCodes.has(response.error.code)
      ? []
      : deviceEntries.filter((entry) => entry.token === tokens[index]).map((entry) => entry));
    await Promise.all(staleDevices.map((entry) => db.collection('users').doc(entry.uid).collection('devices').doc(entry.deviceId).delete()));
    if (staleDevices.length) console.info('[FCM] stale devices removed', { count: staleDevices.length });
    return res.json({ ok: true, sent: result.successCount, failed: result.failureCount });
  } catch (error: any) {
    const status = error.statusCode || 500;
    console.warn('[FCM] push dispatch failed', { backendStatus: status });
    return res.status(status).json({ ok: false, code: 'PUSH_SEND_FAILED' });
  }
});

const PUBLIC_USER_ID_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
const RELATIONSHIP_NAME_PATTERN = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'-]{0,79}$/u;

function caretakerConnection(value: unknown) {
  if (!value || typeof value !== 'object') throw Object.assign(new Error('Caretaker response is invalid.'), { statusCode: 500 });
  const candidate = value as Record<string, unknown>;
  const caretakerUid = typeof candidate.caretakerUid === 'string' ? candidate.caretakerUid.trim() : '';
  const caretakerName = typeof candidate.caretakerName === 'string' ? candidate.caretakerName.trim() : '';
  const caretakerPublicId = typeof candidate.caretakerPublicId === 'string' ? candidate.caretakerPublicId.trim().toUpperCase() : '';
  if (!caretakerUid || !caretakerName || !PUBLIC_USER_ID_PATTERN.test(caretakerPublicId)) {
    throw Object.assign(new Error('Caretaker relationship data is incomplete.'), { statusCode: 500 });
  }
  return { caretakerUid, caretakerName, caretakerPublicId };
}

async function resolveCaretaker(db: any, publicId: string) {
  const cleanId = String(publicId || '').trim().toUpperCase();
  if (!PUBLIC_USER_ID_PATTERN.test(cleanId)) throw Object.assign(new Error('Caretaker ID must be exactly six characters.'), { statusCode: 400 });
  const byUniqueId = await db.collection('users').where('uniqueId', '==', cleanId).limit(5).get();
  const byDisplayId = byUniqueId.empty ? await db.collection('users').where('displayId', '==', cleanId).limit(5).get() : byUniqueId;
  const match = byDisplayId.docs.find((item: any) => item.data()?.role === 'CARETAKER');
  if (!match) throw Object.assign(new Error('Caretaker account not found.'), { statusCode: 404 });
  const data = match.data() || {};
  return { uid: match.id, data, publicId: data.uniqueId || data.displayId || cleanId };
}

async function updateCaretakerBond(db: any, sourceUid: string, caretakerPublicId: string, shouldLink: boolean, requestedName?: string) {
  const sourceSnapshot = await db.collection('users').doc(sourceUid).get();
  if (!sourceSnapshot.exists || sourceSnapshot.data()?.role !== 'USER') throw Object.assign(new Error('Only USER accounts can create caretaker bonds.'), { statusCode: 403 });
  const caretaker = await resolveCaretaker(db, caretakerPublicId);
  const relationshipName = String(requestedName || '').trim();
  if (shouldLink && (!relationshipName || !RELATIONSHIP_NAME_PATTERN.test(relationshipName))) {
    throw Object.assign(new Error('Caretaker name is required and must contain only safe name characters.'), { statusCode: 400 });
  }
  if (caretaker.uid === sourceUid) throw Object.assign(new Error('A user cannot bond to their own account.'), { statusCode: 400 });
  const currentIds = Array.isArray(caretaker.data.monitoredUserIds) ? caretaker.data.monitoredUserIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  const currentUsers = Array.isArray(caretaker.data.monitoredUsers) ? caretaker.data.monitoredUsers : [];
  const alreadyLinked = currentIds.includes(sourceUid);
  if (shouldLink && alreadyLinked) throw Object.assign(new Error('This caretaker is already bonded.'), { statusCode: 409 });
  const source = sourceSnapshot.data() || {};
  const sourcePublicId = source.uniqueId || source.displayId || 'USER';
  const connection = caretakerConnection({ caretakerUid: caretaker.uid, caretakerName: relationshipName || caretaker.data.name || caretaker.data.displayName, caretakerPublicId: caretaker.publicId });
  const updatedIds = shouldLink ? [...currentIds, sourceUid] : currentIds.filter((id: string) => id !== sourceUid);
  const updatedUsers = shouldLink
    ? [...currentUsers, { name: source.name || source.displayName || 'User', uniqueId: sourcePublicId, firebaseUid: sourceUid, relationshipName, linkedAt: new Date().toISOString() }]
    : currentUsers.filter((item: any) => item?.firebaseUid !== sourceUid);
  await db.collection('users').doc(caretaker.uid).set({ monitoredUserIds: updatedIds, monitoredUsers: updatedUsers, updatedAt: new Date().toISOString() }, { merge: true });
  if (shouldLink) {
    const eventId = `caretaker_bond_${sourceUid}_${caretaker.uid}`;
    const sourceName = source.name || source.displayName || 'User';
    const timestamp = new Date().toISOString();
    await Promise.all([
      db.collection('notifications').doc(`${eventId}_${sourceUid}`).set({
        uid: sourceUid, userId: sourceUid, type: 'SYSTEM', title: 'Caretaker Added', body: `${relationshipName} has been added as your caretaker.`,
        timestamp, read: false, actionTab: 'settings',
      }, { merge: true }),
      db.collection('notifications').doc(`${eventId}_${caretaker.uid}`).set({
        uid: caretaker.uid, userId: caretaker.uid, type: 'SYSTEM', title: 'Caretaker Connection', body: `You are now connected to ${sourceName}.`,
        timestamp, read: false, actionTab: 'settings', metadata: { sourceUserPublicId: sourcePublicId, sourceUserName: sourceName },
      }, { merge: true }),
    ]);
  }
  return connection;
}

app.post('/api/caretaker/bond', async (req, res) => {
  try {
    const uid = await verifyIntegrationBearerToken(req.headers.authorization);
    return res.json(await updateCaretakerBond(getAdminFirestore(), uid, req.body?.caretakerPublicId, true, req.body?.caretakerName));
  } catch (error: any) { return res.status(error.statusCode || 500).json({ error: error.message || 'Caretaker bond failed' }); }
});

app.post('/api/caretaker/unbond', async (req, res) => {
  try {
    const uid = await verifyIntegrationBearerToken(req.headers.authorization);
    return res.json(await updateCaretakerBond(getAdminFirestore(), uid, req.body?.caretakerPublicId, false));
  } catch (error: any) { return res.status(error.statusCode || 500).json({ error: error.message || 'Caretaker unbond failed' }); }
});

app.get('/api/caretaker/links', async (req, res) => {
  try {
    const uid = await verifyIntegrationBearerToken(req.headers.authorization);
    const db = getAdminFirestore();
    const snapshots = await db.collection('users').where('monitoredUserIds', 'array-contains', uid).get();
    const caretakers = snapshots.docs
      .filter((item: any) => item.id !== uid && item.data()?.role === 'CARETAKER')
      .map((item: any) => {
        const data = item.data() || {};
        return caretakerConnection({
          caretakerUid: item.id,
          caretakerName: (Array.isArray(data.monitoredUsers) ? data.monitoredUsers.find((entry: any) => entry?.firebaseUid === uid)?.relationshipName : null) || data.name || data.displayName,
          caretakerPublicId: data.uniqueId || data.displayId,
        });
      });
    return res.json({ caretakers });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Caretaker links unavailable' });
  }
});

app.post('/api/notifications/caretaker-fanout', async (req, res) => {
  try {
    const authenticatedUid = await verifyIntegrationBearerToken(req.headers.authorization);
    const { sourceUserUid, type, reportType, reportId, observationId, date, eventId, severity } = req.body || {};
    if (!sourceUserUid || authenticatedUid !== sourceUserUid) return res.status(403).json({ error: 'Source user authorization failed' });
    if (!['TEST_REPORT_READY', 'DAY_REPORT_READY', 'WEEK_REPORT_READY', 'MONTH_REPORT_READY', 'QA_REQUIRED', 'EMERGENCY'].includes(type)) return res.status(400).json({ error: 'Unsupported caretaker notification type' });
    if (type !== 'EMERGENCY' && ((type !== 'QA_REQUIRED' && !reportId) || (type === 'QA_REQUIRED' && !observationId && !date))) return res.status(400).json({ error: 'Notification event identity is required' });

    const db = getAdminFirestore();
    const sourceSnapshot = await db.collection('users').doc(sourceUserUid).get();
    const source = sourceSnapshot.exists ? sourceSnapshot.data() || {} : {};
    const sourceUserPublicId = source.uniqueId || source.displayId || null;
    const sourceUserName = source.name || source.displayName || null;
    if (type !== 'QA_REQUIRED' && type !== 'EMERGENCY') {
      const reportCollection = `reports_${String(reportType || type.replace('_REPORT_READY', '')).toLowerCase()}`;
      if (!['reports_test', 'reports_day', 'reports_week', 'reports_month'].includes(reportCollection)) return res.status(400).json({ error: 'Unsupported report type' });
      const reportSnapshot = await db.collection(reportCollection).doc(reportId).get();
      if (!reportSnapshot.exists || reportSnapshot.data()?.uid !== sourceUserUid) return res.status(403).json({ error: 'Report is not owned by the authenticated source user' });
    }
    const caretakers = await db.collection('users').where('monitoredUserIds', 'array-contains', sourceUserUid).get();
    const logicalEventId = eventId || reportId || observationId || date || `emergency_${new Date().toISOString().slice(0, 10)}`;
    const caretakerTitle = type === 'QA_REQUIRED'
      ? `${sourceUserName || 'User'}'s daily check-in pending`
      : type === 'EMERGENCY' ? 'Emergency alert' : `${sourceUserName || 'User'}'s ${String(reportType || type.replace('_REPORT_READY', '')).toUpperCase()} report ready`;
    const caretakerBody = type === 'QA_REQUIRED'
      ? `A daily check-in is pending for ${sourceUserName || 'the monitored user'}.`
      : type === 'EMERGENCY' ? 'An emergency alert was raised by a monitored user.' : `A ${String(reportType || type.replace('_REPORT_READY', '')).toUpperCase()} condition report is ready for ${sourceUserName || 'the monitored user'}.`;
    const recipientUids = new Set(caretakers.docs.map((item) => item.id).filter((uid) => uid !== sourceUserUid));
    const timestamp = new Date().toISOString();
    await Promise.all(Array.from(recipientUids).map((recipientUid) => {
       const notificationId = `notification_${type}_${logicalEventId}_${recipientUid}`;
      return db.collection('notifications').doc(notificationId).set({
        uid: recipientUid, userId: recipientUid, type, title: caretakerTitle, body: caretakerBody,
        timestamp, read: false, actionTab: 'reports', reportId: reportId || null, observationId: observationId || null,
         date: date || null, severity: severity || null, recipientRole: 'CARETAKER', sourceUserUid,
         sourceUserPublicId, sourceUserName, reportType: reportType || (type === 'DAY_REPORT_READY' ? 'DAY' : type === 'TEST_REPORT_READY' ? 'TEST' : null),
      }, { merge: true });
    }));
    return res.json({ success: true, recipientCount: recipientUids.size, persisted: true, delivery: 'FIRESTORE_IN_APP', eventId: logicalEventId, title: caretakerTitle, body: caretakerBody });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Caretaker notification fan-out failed' });
  }
});

app.post('/api/terminal-log', (req, res) => {
  const logs = Array.isArray(req.body?.logs) ? req.body.logs : [];
  logs.forEach((line: unknown) => console.log(String(line)));
  return res.sendStatus(204);
});

app.get('/api/reports/:reportId', async (req, res) => {
  try {
    const uid = await verifyIntegrationBearerToken(req.headers.authorization);
    const report = reportStore.getReport(req.params.reportId, uid) || await getAuthoritativeReportWithAdmin(uid, req.params.reportId);
    if (!report) return res.status(404).json({ error: `Report not found: ${req.params.reportId}` });
    return res.json({ success: true, report });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Error retrieving report' });
  }
});

app.get('/api/reports/:reportId/download', async (req, res) => {
  try {
    const uid = await verifyIntegrationBearerToken(req.headers.authorization);
    const report = await getAuthoritativeReportWithAdmin(uid, req.params.reportId);
    if (!report) return res.status(404).json({ error: `Report not found: ${req.params.reportId}` });
    const pdfBuffer = await generateReportPdfBuffer(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BAND_REPORT_${report.reportId}.pdf"`);
    return res.end(pdfBuffer);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Error generating report PDF download' });
  }
});

// AI Models Priority List (Primary + Supported Fallback)
const AI_MODELS_PIPELINE = ['gemini-3.8-flash', 'gemini-3.7-flash'];

/**
 * Determine if an error from the Gemini SDK / network is a transient retryable failure.
 */
function isTransientGeminiError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const errObj = err as Record<string, any>;
  const status = String(errObj?.status || errObj?.error?.status || '').toUpperCase();
  const code = String(errObj?.code || errObj?.error?.code || errObj?.status || '');

  if (status === 'UNAVAILABLE' || code === '503' || code === '504' || code === '502') return true;
  if (status === 'RESOURCE_EXHAUSTED' || code === '429') return true;
  if (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('temporary') ||
    msg.includes('overloaded') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('socket hang up')
  ) {
    return true;
  }
  return false;
}

/**
 * Classify error for structured client response without exposing internal secrets/stack.
 */
function classifyAiError(err: unknown): {
  type: string;
  message: string;
  retryable: boolean;
  statusCode: number;
} {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const errObj = err as Record<string, any>;
  const status = String(errObj?.status || errObj?.error?.status || '').toUpperCase();
  const code = String(errObj?.code || errObj?.error?.code || '');

  if (msg.includes('api_key') || msg.includes('api key') || status === 'UNAUTHENTICATED' || code === '401') {
    return {
      type: 'AUTHENTICATION_ERROR',
      message: 'AI authentication error. Service configuration required.',
      retryable: false,
      statusCode: 500,
    };
  }

  if (status === 'RESOURCE_EXHAUSTED' || code === '429' || msg.includes('429') || msg.includes('rate limit')) {
    return {
      type: 'RATE_LIMIT',
      message: 'AI service rate limit reached. Please wait a moment and try again.',
      retryable: true,
      statusCode: 429,
    };
  }

  if (status === 'UNAVAILABLE' || code === '503' || msg.includes('503') || msg.includes('high demand') || msg.includes('unavailable')) {
    return {
      type: 'MODEL_UNAVAILABLE',
      message: 'AI service is temporarily busy. Please try again.',
      retryable: true,
      statusCode: 503,
    };
  }

  if (isTransientGeminiError(err)) {
    return {
      type: 'TRANSIENT_AI_ERROR',
      message: 'AI service is temporarily busy. Please try again.',
      retryable: true,
      statusCode: 503,
    };
  }

  return {
    type: 'UNKNOWN_AI_ERROR',
    message: 'Unable to complete AI request. Please try again.',
    retryable: true,
    statusCode: 500,
  };
}

/**
 * Delay helper for bounded exponential backoff
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Canonical provider-neutral AI endpoint. The router key remains server-only.
app.post('/api/ai/chat', async (req, res) => {
  const startedAt = Date.now();
  const endpoint = '/api/ai/chat';
  console.info('[AI] request start', { endpoint, method: req.method });
  try {
    await verifyIntegrationBearerToken(req.headers.authorization);
    const message = String(req.body?.message || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!message) {
      console.warn('[AI] request rejected', { endpoint, status: 400, elapsedMs: Date.now() - startedAt, category: 'AI_RESPONSE_ERROR' });
      return res.status(400).json({ ok: false, code: 'AI_RESPONSE_ERROR' });
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('[AI] provider unavailable', { endpoint, status: 503, elapsedMs: Date.now() - startedAt, category: 'AI_OPENROUTER_ERROR', reason: 'OPENROUTER_API_KEY missing' });
      return res.status(503).json({ ok: false, code: 'AI_OPENROUTER_ERROR' });
    }
    const model = process.env.AI_DEFAULT_MODEL || 'google/gemini-2.5-flash';
    const fallbackModels = (process.env.AI_FALLBACK_MODELS || '').split(',').map((item) => item.trim()).filter(Boolean);
    const messages = [
      { role: 'system', content: GOATEST_AI_SYSTEM_INSTRUCTION },
      ...history.slice(-20).map((item: any) => ({ role: item.sender === 'assistant' ? 'assistant' : 'user', content: String(item.text || item.content || '') })),
      { role: 'user', content: message },
    ];
    let lastStatus = 502;
    for (const selectedModel of [model, ...fallbackModels]) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'https://goatest.app', 'X-Title': 'GOATEST' },
          body: JSON.stringify({ model: selectedModel, messages, temperature: 0.7, max_tokens: 1000, ...(req.body?.responseMimeType ? { response_format: { type: 'json_object' } } : {}) }),
        });
        const body = await upstream.json().catch(() => ({}));
        clearTimeout(timeout);
        if (upstream.ok) {
          const text = body?.choices?.[0]?.message?.content;
          if (typeof text !== 'string' || !text.trim()) return res.status(502).json({ ok: false, code: 'AI_RESPONSE_ERROR' });
          console.info('[AI] response success', { endpoint, status: upstream.status, model: selectedModel, elapsedMs: Date.now() - startedAt });
          return res.json({ ok: true, text: text.trim(), model: selectedModel, provider: 'openrouter' });
        }
        console.warn('[AI] provider response failed', { endpoint, status: upstream.status, model: selectedModel, elapsedMs: Date.now() - startedAt, category: 'AI_OPENROUTER_ERROR' });
        lastStatus = upstream.status;
        if (![404, 408, 429, 500, 502, 503, 504].includes(upstream.status)) break;
      } catch (error) {
        clearTimeout(timeout);
        return res.status(error instanceof Error && error.name === 'AbortError' ? 408 : 502).json({ ok: false, code: error instanceof Error && error.name === 'AbortError' ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR' });
      }
    }
    const code = lastStatus === 401 || lastStatus === 403 ? 'AI_AUTH_ERROR' : lastStatus === 404 ? 'AI_MODEL_NOT_FOUND' : lastStatus === 429 ? 'AI_RATE_LIMIT' : lastStatus === 408 ? 'AI_TIMEOUT' : lastStatus >= 500 ? 'AI_PROVIDER_ERROR' : 'AI_RESPONSE_ERROR';
    return res.status(lastStatus).json({ ok: false, code });
  } catch {
    console.warn('[AI] request failed', { endpoint, status: 401, elapsedMs: Date.now() - startedAt, category: 'AI_AUTH_ERROR' });
    return res.status(401).json({ ok: false, code: 'AI_AUTH_ERROR' });
  }
});

// Inactive legacy Gemini route retained temporarily for backward compatibility;
// no application caller uses this endpoint. All current AI callers use /api/ai/chat.
app.post('/api/legacy-ai-chat', async (req, res) => {
  const { messages, message } = req.body;

  // Support single prompt or full conversational history
  const promptText = message || (Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1]?.text || messages[messages.length - 1]?.content : '');

  if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'INVALID_REQUEST',
        message: 'Message content is required.',
        retryable: false,
      },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: {
        type: 'AUTHENTICATION_ERROR',
        message: 'AI service is temporarily unconfigured (GEMINI_API_KEY missing).',
        retryable: false,
      },
    });
  }

  // Format chat history for Gemini API
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(messages) && messages.length > 1) {
    // Include prior conversational context (excluding the last message which is the current prompt)
    for (const msg of messages.slice(0, -1)) {
      const text = msg.text || msg.content || '';
      if (text && text.trim()) {
        const role = msg.sender === 'user' || msg.role === 'user' ? 'user' : 'model';
        contents.push({
          role,
          parts: [{ text: text.trim() }],
        });
      }
    }
  }

  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: promptText.trim() }],
  });

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  // Pipeline: Try models in priority order with bounded exponential retry
  for (const modelName of AI_MODELS_PIPELINE) {
    const maxRetries = 2; // 1 initial attempt + 2 retries = 3 total attempts per model
    const backoffDelays = [500, 1200];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const waitMs = backoffDelays[attempt - 1] || 1500;
          console.log(`[GOATEST AI] Transient retry #${attempt} for ${modelName} after ${waitMs}ms backoff...`);
          await delay(waitMs);
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: GOATEST_AI_SYSTEM_INSTRUCTION,
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        });

        const replyText = response.text?.trim() || '';
        if (!replyText) {
          throw new Error('Received empty response from AI model.');
        }

        // Return structured success contract
        return res.json({
          success: true,
          text: replyText,
          message: replyText,
          model: modelName,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        lastError = err;
        const isTransient = isTransientGeminiError(err);
        const errType = (err as any)?.status || (err as any)?.code || (err instanceof Error ? err.message : 'Unknown');

        console.warn(`[GOATEST AI Attempt Failed] Model: ${modelName}, Attempt: ${attempt + 1}/${maxRetries + 1}, Transient: ${isTransient}, Error: ${errType}`);

        if (!isTransient) {
          // Non-transient error (e.g. invalid key or bad payload) -> break retry loop immediately
          break;
        }

        // If transient, continue retry loop for this model
      }
    }

    console.warn(`[GOATEST AI] Model ${modelName} exhausted attempts. Checking fallback...`);
  }

  // All models & bounded retries exhausted -> Return structured error response
  console.error('[GOATEST AI API Final Failure]:', lastError);
  const classified = classifyAiError(lastError);

  return res.status(classified.statusCode).json({
    success: false,
    error: {
      type: classified.type,
      message: classified.message,
      retryable: classified.retryable,
    },
  });
});

/**
 * Fallback Contextual Q/A generator for daily assessments when Gemini API is unconfigured or unavailable.
 * Strictly non-diagnostic context questions with 4 MCQ choices and context explanation feedback.
 */
function generateFallbackQaQuestions(targetOrgans: string[] = ['Cardiovascular', 'Respiratory', 'Neurological']): Array<{
  questionId: string;
  question: string;
  options: string[];
  feedback: string;
  organ: string;
  topic: string;
}> {
  const primaryOrgan = targetOrgans[0] || 'Cardiovascular';
  const secondaryOrgan = targetOrgans[1] || 'Respiratory';
  const tertiaryOrgan = targetOrgans[2] || 'Neurological';

  return [
    {
      questionId: `qa_q1_sleep_${Date.now()}`,
      question: 'How would you rate your total restorative sleep duration and quality over the last 24 hours?',
      options: [
        'Excellent (7-9 hours undisturbed, woke up fully refreshed)',
        'Good (6-7 hours with minimal waking episodes)',
        'Fair (5-6 hours with restlessness or interrupted sleep)',
        'Poor (<5 hours or frequent disruptions)'
      ],
      feedback: 'Sleep quality directly influences autonomic nervous balance and morning resting baseline markers.',
      organ: primaryOrgan,
      topic: 'Sleep & Circadian Rhythm'
    },
    {
      questionId: `qa_q2_cardio_strain_${Date.now()}`,
      question: `During today's routine activities, did you notice any unexpected heart fluttering, rapid pulse, or unusual cardiovascular strain?`,
      options: [
        'None at all; resting and exertion pulse felt steady and comfortable',
        'Mild brief elevation during sudden standing or physical stairs',
        'Noticeable flutter or prolonged elevated rate during light activity',
        'Significant strain or sensation of heavy heartbeat'
      ],
      feedback: 'Tracking subjective perception alongside sensor data provides accurate baseline calibration.',
      organ: primaryOrgan,
      topic: 'Cardiovascular Response'
    },
    {
      questionId: `qa_q3_respiratory_${Date.now()}`,
      question: 'How was your breathing pattern while performing your daily physical tasks or at rest today?',
      options: [
        'Completely effortless and unobstructed nasal breathing',
        'Slight breathlessness only during brisk walking or stairs',
        'Occasional feeling of shallow breath or chest tightness at rest',
        'Frequent shortness of breath or persistent breathing discomfort'
      ],
      feedback: 'Respiration stability is a core indicator of autonomic balance and cardiovascular recovery.',
      organ: secondaryOrgan,
      topic: 'Respiratory Quality'
    },
    {
      questionId: `qa_q4_hydration_${Date.now()}`,
      question: 'What was your estimated fluid/water consumption throughout the day prior to testing?',
      options: [
        'Optimal (Over 2.5 liters / 8+ glasses of water)',
        'Adequate (1.5 to 2.5 liters across the day)',
        'Low (Under 1.5 liters, felt occasional thirst)',
        'Minimal (<1 liter, high caffeine or prolonged sweating)'
      ],
      feedback: 'Hydration levels directly modulate blood plasma volume, vascular resistance, and pulse metrics.',
      organ: primaryOrgan,
      topic: 'Hydration & Electrolytes'
    },
    {
      questionId: `qa_q5_physical_exertion_${Date.now()}`,
      question: 'What level of peak physical exertion or cardiovascular exercise did you engage in today?',
      options: [
        'Rest / Low activity (mostly sedentary office or gentle walking)',
        'Moderate aerobic activity (brisk walking, cycling, or light workout)',
        'Intense strenuous training (running, heavy lifting, or sports)',
        'High physical fatigue / prolonged strenuous manual labor'
      ],
      feedback: 'Physical strain accounts for post-exercise recovery stages and temporary baseline deviations.',
      organ: primaryOrgan,
      topic: 'Physical Exertion'
    },
    {
      questionId: `qa_q6_mental_stress_${Date.now()}`,
      question: 'How would you describe your mental strain or emotional stress level over the course of today?',
      options: [
        'Calm and relaxed with minimal psychological pressure',
        'Mild manageable stress during work or routine chores',
        'Moderate elevated stress with tension in neck or shoulders',
        'Severe acute stress or prolonged intense anxiety'
      ],
      feedback: 'Sympathetic nervous stimulation increases catecholamine release and shifts autonomic stage boundaries.',
      organ: tertiaryOrgan,
      topic: 'Autonomic & Psychological State'
    },
    {
      questionId: `qa_q7_caffeine_meals_${Date.now()}`,
      question: 'When did you last consume caffeine (coffee/tea/energy drink) or a heavy meal relative to your assessment?',
      options: [
        'More than 4 hours ago (or none today)',
        '2 to 4 hours before testing',
        '1 to 2 hours before testing',
        'Less than 1 hour before testing'
      ],
      feedback: 'Caffeine and postprandial digestion influence vascular tone and transient heart rate variability.',
      organ: primaryOrgan,
      topic: 'Nutritional Timing'
    },
    {
      questionId: `qa_q8_somatic_symptoms_${Date.now()}`,
      question: 'Did you experience any localized discomfort, headache, dizziness, or peripheral swelling today?',
      options: [
        'No somatic symptoms reported',
        'Mild headache or eye fatigue from screen time',
        'Occasional lightheadedness upon standing up quickly',
        'Moderate discomfort, chest heaviness, or dizziness'
      ],
      feedback: 'Orthostatic stability and microvascular responses reflect neurological and cardiovascular interplay.',
      organ: tertiaryOrgan,
      topic: 'Somatic Assessment'
    },
    {
      questionId: `qa_q9_thermal_env_${Date.now()}`,
      question: 'Were you exposed to extreme environmental temperatures (e.g. high heat, high humidity, or cold weather)?',
      options: [
        'Comfortable climate-controlled indoor environment',
        'Mild outdoor exposure with comfortable clothing',
        'Noticeable heat/sun exposure with moderate perspiration',
        'Extreme hot or cold environment causing shivering/excessive sweating'
      ],
      feedback: 'Thermoregulation impacts cutaneous blood flow and resting peripheral vascular conductance.',
      organ: secondaryOrgan,
      topic: 'Environmental Context'
    },
    {
      questionId: `qa_q10_overall_readiness_${Date.now()}`,
      question: 'Taking everything into account, how would you rate your overall physiological vitality and readiness today?',
      options: [
        'Peak vitality (energized, strong, and ready for full exertion)',
        'Good normal baseline (steady energy, feeling balanced)',
        'Somewhat fatigued (would benefit from extra rest or relaxation)',
        'Exhausted / Depleted (need significant recovery time)'
      ],
      feedback: 'Subjective vitality ratings help calibrate longitudinal trends against objective machine classifications.',
      organ: primaryOrgan,
      topic: 'Daily Subjective Vitality'
    }
  ];
}

/**
 * Server-side AI Dynamic Q/A Question Generator API
 * Route: POST /api/ai/qa-questions
 */
app.post('/api/legacy-ai-qa-questions', async (req, res) => {
  const { targetOrgans, dayDate, completedTests } = req.body || {};
  const organs: string[] = Array.isArray(targetOrgans) && targetOrgans.length > 0
    ? targetOrgans
    : ['Cardiovascular', 'Respiratory', 'Neurological'];

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ success: false, error: { type: 'NOT_CONFIGURED', message: 'AI Q/A is not configured.', retryable: false } });
  }

  const promptText = `
Generate exactly 10 multiple-choice assessment questions for a daily health-monitoring assessment in the GOATEST application.
Target organ systems evaluated today: ${organs.join(', ')}.
Date: ${dayDate || new Date().toISOString().split('T')[0]}.

CRITICAL SAFETY & MEDICAL RULES:
- DO NOT provide a medical diagnosis or claim the user has any disease or illness.
- Questions must be assessment, context, lifestyle, and physiological sensation questions (e.g. sleep quality, perceived exertion, chest/respiratory comfort, hydration, caffeine timing, orthostatic posture, stress, environmental factors, overall vitality).
- Each question MUST have exactly 4 clear, non-overlapping multiple-choice options.
- Provide a brief 1-2 sentence educational feedback explanation for why this context marker is relevant.
- Return ONLY a valid JSON array matching this exact schema:
[
  {
    "questionId": "q1",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "feedback": "Educational explanation of why this marker matters.",
    "organ": "${organs[0] || 'Cardiovascular'}",
    "topic": "Sleep / Strain / Hydration / etc"
  },
  ... 10 questions total
]
`.trim();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: {
        systemInstruction: GOATEST_AI_SYSTEM_INSTRUCTION,
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '';
    if (!responseText) {
      throw new Error('Empty response from AI for QA questions');
    }

    let parsedQuestions = JSON.parse(responseText);
    if (!Array.isArray(parsedQuestions) && parsedQuestions.questions && Array.isArray(parsedQuestions.questions)) {
      parsedQuestions = parsedQuestions.questions;
    }

    if (Array.isArray(parsedQuestions) && parsedQuestions.length >= 8) {
      const formatted = parsedQuestions.slice(0, 10).map((q: any, idx: number) => ({
        questionId: q.questionId || `qa_dyn_${idx + 1}_${Date.now()}`,
        question: String(q.question || `Assessment Question ${idx + 1}`),
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 4) : ['Optimal', 'Good', 'Fair', 'Poor'],
        feedback: String(q.feedback || 'Daily context helps calibrate physiological assessments.'),
        organ: String(q.organ || organs[idx % organs.length] || 'Cardiovascular'),
        topic: String(q.topic || 'General Health'),
      }));

      return res.json({
        success: true,
        questions: formatted,
        source: 'GEMINI_AI',
        timestamp: new Date().toISOString(),
      });
    }

    throw new Error('Invalid JSON structure from AI QA generation');
  } catch (err) {
    console.warn('[GOATEST AI QA Generation Failed]:', err);
    return res.status(502).json({ success: false, error: { type: 'AI_GENERATION_FAILED', message: 'AI Q/A generation failed. Please retry.', retryable: true } });
  }
});

// Daily Server Cache for Health News
interface CachedFeed {
  date: string;
  timestamp: number;
  items: any[];
}
let newsCache: CachedFeed | null = null;

// Categorize articles based on title & description
function categorizeArticle(title: string, summary: string): string {
  const content = `${title} ${summary}`.toLowerCase();
  if (content.includes('heart') || content.includes('cardio') || content.includes('vascular') || content.includes('artery') || content.includes('blood pressure')) {
    return 'Cardiovascular';
  }
  if (content.includes('lung') || content.includes('breath') || content.includes('respiratory') || content.includes('asthma') || content.includes('copd')) {
    return 'Respiratory';
  }
  if (content.includes('sleep') || content.includes('circadian') || content.includes('insomnia')) {
    return 'Sleep';
  }
  if (content.includes('diet') || content.includes('nutrition') || content.includes('food') || content.includes('vitamin') || content.includes('sugar')) {
    return 'Nutrition';
  }
  if (content.includes('brain') || content.includes('neuro') || content.includes('cognitive') || content.includes('memory') || content.includes('mental')) {
    return 'Neurological';
  }
  if (content.includes('prevention') || content.includes('vaccine') || content.includes('exercise') || content.includes('screening') || content.includes('lifestyle')) {
    return 'Preventive Care';
  }
  if (content.includes('technology') || content.includes('sensor') || content.includes('digital health') || content.includes('ai in medicine') || content.includes('wearable')) {
    return 'Health Technology';
  }
  if (content.includes('study') || content.includes('trial') || content.includes('research') || content.includes('scientists') || content.includes('discovery')) {
    return 'Medical Research';
  }
  return 'General Health';
}

// 2. Real Multi-Source Health News Endpoint
app.get('/api/news', async (req, res) => {
  const force = req.query.force === 'true';
  const today = new Date().toISOString().split('T')[0];

  // Daily Cache Check
  if (!force && newsCache && newsCache.date === today && newsCache.items.length > 0) {
    return res.json({
      source: 'cache',
      date: newsCache.date,
      articles: newsCache.items,
    });
  }

  // Accredited Public Health Feeds
  const credibleFeeds = [
    {
      source: 'National Institutes of Health (NIH)',
      url: 'https://www.nih.gov/news-events/feed.xml',
    },
    {
      source: 'Medical News Today',
      url: 'https://www.medicalnewstoday.com/feed',
    },
    {
      source: 'NY Times Health Science',
      url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
    },
  ];

  const aggregatedArticles: any[] = [];
  const seenUrls = new Set<string>();

  for (const feed of credibleFeeds) {
    try {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && Array.isArray(data.items)) {
          for (const item of data.items.slice(0, 4)) {
            const articleUrl = item.link || item.guid || '';
            if (articleUrl && !seenUrls.has(articleUrl)) {
              seenUrls.add(articleUrl);
              const cleanSummary = item.description
                ? item.description.replace(/<[^>]*>?/gm, '').trim().substring(0, 160) + '...'
                : 'Read full clinical update on original health publication.';

              const title = item.title?.trim() || 'Health Science Update';
              const category = categorizeArticle(title, cleanSummary);

              const thumbnail =
                item.thumbnail ||
                item.enclosure?.link ||
                (item.description && item.description.match(/<img[^>]+src="([^">]+)"/)?.[1]) ||
                undefined;

              aggregatedArticles.push({
                id: item.guid || `news_${aggregatedArticles.length}_${Date.now()}`,
                title,
                summary: cleanSummary,
                source: feed.source,
                url: articleUrl,
                category,
                publishedAt: item.pubDate || new Date().toISOString(),
                imageUrl: thumbnail,
              });
            }
          }
        }
      }
    } catch {
      // Continue to next feed if one times out
    }
  }

  if (aggregatedArticles.length > 0) {
    // Sort by publication date newest first
    aggregatedArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    newsCache = {
      date: today,
      timestamp: Date.now(),
      items: aggregatedArticles,
    };

    return res.json({
      source: 'live',
      date: today,
      articles: aggregatedArticles,
    });
  }

  // Fallback to cache if available
  if (newsCache && newsCache.items.length > 0) {
    return res.json({
      source: 'stale-cache',
      date: newsCache.date,
      articles: newsCache.items,
    });
  }

  return res.status(503).json({
    error: 'Unable to fetch current medical news from accredited feeds. Please retry later.',
  });
});

// 3. Server-Side C50 Machine Learning Inference Gateway
app.get('/api/c50/status', (req, res) => {
  const endpoint = process.env.C50_ML_ENDPOINT;
  if (!endpoint) {
    return res.json({
      configured: false,
      state: 'NOT_CONFIGURED',
      message: 'External C50 ML engine is not configured in this environment.',
    });
  }

  return res.json({
    configured: true,
    state: 'SUCCESS',
    endpointUrl: '/api/c50/infer',
    modelVersion: 'C50_EXTERNAL_V1',
    message: 'External C50 ML engine endpoint is configured and active.',
  });
});

app.post('/api/c50/infer', async (req, res) => {
  const { inputPacket } = req.body;

  if (!inputPacket || typeof inputPacket !== 'object' || !inputPacket.inputId || !inputPacket.userId) {
    return res.status(400).json({
      status: 'INVALID_INPUT',
      error: 'Invalid C50_INPUT_PACKET: required fields missing or malformed',
    });
  }

  const endpoint = process.env.C50_ML_ENDPOINT;
  if (!endpoint) {
    return res.json({
      status: 'ML_NOT_CONFIGURED',
      modelVersion: 'C50_UNCONFIGURED',
      message: 'External C50 ML engine is not configured in this environment.',
      rawResponse: {
        state: 'ML_NOT_CONFIGURED',
        receivedInputId: inputPacket.inputId,
      },
    });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.C50_ML_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.C50_ML_API_KEY}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const mlResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputPacket }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!mlResponse.ok) {
      return res.status(mlResponse.status).json({
        status: 'ML_ERROR',
        message: `External ML service responded with HTTP status ${mlResponse.status}`,
      });
    }

    const mlData = await mlResponse.json();
    return res.json(mlData);
  } catch (err: unknown) {
    const isAbort = (err as Error)?.name === 'AbortError';
    if (isAbort) {
      return res.status(504).json({
        status: 'TIMEOUT',
        message: 'External C50 ML engine inference request timed out.',
      });
    }

    return res.status(502).json({
      status: 'ML_ERROR',
      message: `Failed to communicate with external C50 ML engine: ${(err as Error)?.message || String(err)}`,
    });
  }
});

// 4. Vite Development Middleware / Production Static Asset Serving
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
    console.log(`[GOATEST Server] Running on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error('[GOATEST Server Startup Error]:', err);
});
