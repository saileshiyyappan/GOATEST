import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initializeAdmin() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'goatest-2525';
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const hasExplicitCredentials = Boolean(clientEmail && privateKey);
    const hasApplicationDefaultCredential = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);

    if (process.env.NODE_ENV === 'production' && (!process.env.FIREBASE_ADMIN_PROJECT_ID || !clientEmail || !privateKey)) {
      throw Object.assign(new Error('Firebase Admin server credentials are not configured in the deployed environment.'), {
        statusCode: 500,
        code: 'ADMIN_CREDENTIAL_ERROR',
      });
    }

    if (!projectId && !hasApplicationDefaultCredential) {
      throw new Error('Firebase project is not configured. Set FIREBASE_ADMIN_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.');
    }

    const credential = hasExplicitCredentials
      ? cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID, clientEmail, privateKey: privateKey!.replace(/\\n/g, '\n') })
      : applicationDefault();
    initializeApp({ credential, projectId });
  }
}

function getAdminAuth() {
  initializeAdmin();
  return getAuth();
}

export function getAdminFirestore() {
  initializeAdmin();
  return getFirestore();
}

export async function verifyIntegrationBearerToken(header: string | undefined): Promise<string> {
  if (!header?.startsWith('Bearer ')) throw Object.assign(new Error('Authorization Bearer token is required'), { statusCode: 401, code: 'AUTH_REQUIRED' });
  const token = header.slice(7).trim();
  if (!token || token === 'undefined' || token === 'null' || token === '[object Object]') {
    throw Object.assign(new Error('Firebase ID token is invalid or unverifiable'), { statusCode: 401, code: 'AUTH_INVALID' });
  }
  try {
    return (await getAdminAuth().verifyIdToken(token)).uid;
  } catch (error: any) {
    const message = String(error?.message || 'Firebase ID token verification failed');
    const rawCode = String(error?.code || '').toLowerCase();
    const code = rawCode.includes('expired') ? 'TOKEN_EXPIRED'
      : rawCode.includes('project') || message.toLowerCase().includes('project') ? 'PROJECT_MISMATCH'
      : rawCode.includes('credential') || message.toLowerCase().includes('credential') || message.toLowerCase().includes('application default') ? 'ADMIN_CREDENTIAL_ERROR'
      : rawCode.includes('network') || message.toLowerCase().includes('network') || message.toLowerCase().includes('econn') ? 'NETWORK_VERIFICATION_ERROR'
      : 'TOKEN_INVALID';
    console.error('[AUTH VERIFY FAILURE]', {
      code,
      reason: message,
    });
    throw Object.assign(new Error('Firebase authentication verification failed'), { statusCode: 401, code });
  }
}
