import { getAdminFirestore } from './firebaseAdminAuth';

export async function getAuthoritativeReportWithAdmin(uid: string, reportId: string): Promise<any | null> {
  const db = getAdminFirestore();
  const suffix = reportId.startsWith('rep_day_') ? 'day' : reportId.startsWith('rep_test_') ? 'test' : reportId.startsWith('rep_week_') ? 'week' : reportId.startsWith('rep_month_') ? 'month' : null;
  if (!suffix) return null;
  const snap = await db.collection(`reports_${suffix}`).doc(reportId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  if (data.uid === uid || data.userId === uid) return data;

  // Caretaker authorization is resolved from the caretaker's UID document.
  // The public six-character ID is never used as an authorization principal.
  const caretakerSnapshot = await db.collection('users').doc(uid).get();
  const monitoredUserIds = caretakerSnapshot.exists && Array.isArray(caretakerSnapshot.data()?.monitoredUserIds)
    ? caretakerSnapshot.data()?.monitoredUserIds
    : [];
  if (monitoredUserIds.includes(data.uid || data.userId)) return data;

  throw new Error('Report access denied for authenticated user');
}

export async function persistTestResultWithAdmin(uid: string, result: any): Promise<{ observation: any; report: any }> {
  const observationId = result.observationId;
  const reportId = result.reportId;
  if (!observationId || !reportId || !result.result || !result.report) throw new Error('C50 TEST result is incomplete for persistence');
  const matched = result.result.matchedRecord;
  const observation = {
    id: observationId, observationId, uid, userId: uid,
    timestamp: result.result.timestamp, temporalLevel: 'TEST',
    packetId: result.packetId, sessionId: result.sessionId, parameters: result.parameters,
    inputStages: result.inputStages || result.result.inputVector || [],
    matchedStages: result.matchedStages || matched.matchedVector || [],
    matchedPattern: result.matchedPattern || matched.pattern_label,
    classification: result.classification || matched.primary_taxonomy,
    severity: result.severity || matched.severity_label,
    severityScore: result.severityScore || Number(matched.severity_score) || 0,
    confidence: result.confidence || Number(matched.confidence_score) || 0.95,
    confidenceScore: result.confidenceScore || Number(matched.confidence_score) || 0.95,
    matchStatus: result.matchStatus || matched.matchType,
    referenceDatasetSno: result.referenceDatasetSno ?? Number(matched.sno) ?? 0,
    distanceScore: result.distanceScore ?? matched.distance ?? 0,
    isFixture: Boolean(result.report.isFixture), createdAt: result.result.timestamp,
  };
  const report = { ...result.report, reportId, uid, userId: uid, temporalLevel: 'TEST' };
  const db = getAdminFirestore();
  await db.collection('test').doc(observationId).set(observation, { merge: true });
  await db.collection('reports_test').doc(reportId).set(report, { merge: true });
  return {
    observation: { success: true, status: 'CLOUD_CONNECTED', persistedLocation: 'FIRESTORE', collection: 'test', documentId: observationId, uid },
    report: { success: true, status: 'CLOUD_CONNECTED', persistedLocation: 'FIRESTORE', collection: 'reports_test', documentId: reportId, uid },
  };
}

export async function dispatchTestNotificationsWithAdmin(uid: string, result: any): Promise<{ success: boolean; notifications: any[] }> {
  if (!uid || result?.status !== 'COMPLETED' || !result.reportId) throw new Error('Notification requires a persisted completed TEST report');
  const db = getAdminFirestore();
  const recipients = new Set<string>([uid]);
  const caretakerSnapshot = await db.collection('users').where('monitoredUserIds', 'array-contains', uid).get();
  caretakerSnapshot.forEach((doc) => recipients.add(doc.id));
  const notifications: any[] = [];
  for (const recipientUid of recipients) {
    const isCaretaker = recipientUid !== uid;
    const notificationId = `notif_test_${result.reportId}_${recipientUid}`;
    const notification = {
      notificationId, id: notificationId, uid: recipientUid, userId: recipientUid,
      monitoredUserId: uid, recipient: isCaretaker ? 'CARETAKER' : 'USER',
      reportId: result.reportId, testObservationId: result.observationId, temporalLevel: 'TEST',
      classification: result.classification, severity: result.severity, matchStatus: result.matchStatus,
      timestamp: result.result?.timestamp || result.timestamp, reportStatus: 'COMPLETED', delivered: true,
      createdAt: new Date().toISOString(),
    };
    notifications.push(notification);
  }
  return { success: true, notifications };
}

export async function persistQaSessionWithAdmin(uid: string, qaData: any): Promise<any> {
  const qaSessionId = qaData?.qaSessionId || qaData?.qaId;
  if (!qaSessionId) throw new Error('qaSessionId is required for Q/A persistence');
  if ((qaData.uid && qaData.uid !== uid) || (qaData.userId && qaData.userId !== uid)) throw new Error('Q/A UID does not match authenticated UID');
  const createdAt = qaData.createdAt || new Date().toISOString();
  const expiresAt = qaData.expiresAt || new Date(new Date(createdAt).getTime() + 60 * 60 * 1000).toISOString();
  const expired = new Date(expiresAt).getTime() <= Date.now();
  const status = qaData.status === 'ANSWERED' && expired ? 'NOT_ANSWERED' : (expired ? 'NOT_ANSWERED' : (qaData.status || 'PENDING'));
  if (qaData.status === 'ANSWERED' && expired) throw new Error('Expired Q/A cannot be answered');
  const payload = { ...qaData, qaSessionId, qaId: qaSessionId, id: qaSessionId, uid, userId: uid, createdAt, expiresAt, status, answeredAt: status === 'ANSWERED' ? (qaData.answeredAt || new Date().toISOString()) : (qaData.answeredAt || null) };
  await getAdminFirestore().collection('qa_sessions').doc(qaSessionId).set(payload, { merge: true });
  return { success: true, status: 'CLOUD_CONNECTED', persistedLocation: 'FIRESTORE', collection: 'qa_sessions', documentId: qaSessionId, uid, data: payload };
}

export async function dispatchTemporalNotificationsWithAdmin(uid: string, result: any): Promise<{ success: boolean; notifications: any[] }> {
  if (!uid || result?.status !== 'COMPLETED' || !result.reportId) throw new Error('Notification requires a persisted completed report');
  const db = getAdminFirestore();
  const recipients = new Set<string>([uid]);
  const caretakers = await db.collection('users').where('monitoredUserIds', 'array-contains', uid).get();
  caretakers.forEach((item) => recipients.add(item.id));
  const level = String(result.temporalLevel || 'DAY').toLowerCase();
  const notifications: any[] = [];
  for (const recipientUid of recipients) {
    const notificationId = `notif_${level}_${result.reportId}_${recipientUid}`;
    const notification = { notificationId, id: notificationId, uid: recipientUid, userId: recipientUid, monitoredUserId: uid, recipient: recipientUid === uid ? 'USER' : 'CARETAKER', reportId: result.reportId, observationId: result.observationId, temporalLevel: level.toUpperCase(), status: 'COMPLETED', delivered: true, createdAt: new Date().toISOString() };
    notifications.push(notification);
  }
  return { success: true, notifications };
}

export async function persistTemporalResultWithAdmin(uid: string, result: any): Promise<{ observation: any; report: any }> {
  const level = String(result.temporalLevel || '').toUpperCase();
  if (!['DAY', 'WEEK', 'MONTH'].includes(level) || result.status !== 'COMPLETED') {
    throw new Error(`Cannot persist incomplete temporal result: ${level || 'UNKNOWN'}`);
  }
  const observationId = result.observationId;
  const reportId = result.reportId;
  if (!observationId || !reportId) throw new Error(`${level} result is missing deterministic observation/report IDs`);
  const suffix = level.toLowerCase();
  const db = getAdminFirestore();
  const observation = { ...result, id: observationId, observationId, reportId, uid, userId: uid, temporalLevel: level };
  const report = { ...result, reportId, observationId, uid, userId: uid, temporalLevel: level };
  await db.collection(suffix).doc(observationId).set(observation, { merge: true });
  await db.collection(`reports_${suffix}`).doc(reportId).set(report, { merge: true });
  return {
    observation: { success: true, status: 'CLOUD_CONNECTED', persistedLocation: 'FIRESTORE', collection: suffix, documentId: observationId, uid },
    report: { success: true, status: 'CLOUD_CONNECTED', persistedLocation: 'FIRESTORE', collection: `reports_${suffix}`, documentId: reportId, uid },
  };
}
