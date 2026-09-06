/**
 * Firestore read request guard.
 *
 * This validates that a real Firebase user and target UID exist, but it does
 * not authorize caretaker relationships from client-side cache. Firestore
 * Security Rules remain the authority for owner/caretaker access.
 */

import { getFirebaseAuth } from '../config/firebase';

export interface ReadAuthResult {
  allowed: boolean;
  authUid: string | null;
  targetUserId: string;
  isOwner: boolean;
  isCaretaker: boolean;
  reason?: string;
}

export function validateFirestoreReadAuth(
  collectionName: string,
  targetUserId: string,
  ownershipField: string = 'userId'
): ReadAuthResult {
  if (!targetUserId || targetUserId === 'guest_user' || targetUserId === 'anonymous_user' || targetUserId.startsWith('guest_')) {
    return { allowed: false, authUid: null, targetUserId, isOwner: false, isCaretaker: false, reason: 'INVALID_TARGET_UID' };
  }

  let authUid: string | null = null;
  try { authUid = getFirebaseAuth()?.currentUser?.uid || null; } catch { authUid = null; }
  if (!authUid) {
    return { allowed: false, authUid: null, targetUserId, isOwner: false, isCaretaker: false, reason: 'NOT_AUTHENTICATED' };
  }

  const isOwner = targetUserId === authUid;
  console.info('[Firestore Read Audit]', {
    collection: collectionName,
    targetUid: targetUserId,
    authUid,
    ownershipField,
    request: 'sent_to_firestore_rules',
  });
  return { allowed: true, authUid, targetUserId, isOwner, isCaretaker: !isOwner, reason: 'FIRESTORE_RULES_AUTHORITATIVE' };
}

export function handleFirestoreReadError(error: unknown, collectionName: string, targetUserId: string): void {
  const msg = error instanceof Error ? error.message : String(error);
  const permissionDenied = isFirestorePermissionDenied(error);
  console.warn('[Firestore Read Audit]', { collection: collectionName, targetUid: targetUserId, success: false, permissionDenied });
  if (!permissionDenied) console.warn(`[Firestore Read Warning] /${collectionName}:`, msg);
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions');
}
