import { doc, setDoc } from 'firebase/firestore';
import { App as CapacitorApp } from '@capacitor/app';
import { getFirebaseAuth, getFirebaseDb } from '../config/firebase';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface PendingSyncOperation {
  operationId: string;
  uid: string;
  collection: string;
  documentId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

export interface LocalStagedRecord {
  recordKey: string;
  uid: string;
  kind: 'TEST' | 'REPORT';
  record: Record<string, unknown>;
  updatedAt: string;
}

const DB_NAME = 'goatest-offline-sync';
const OPERATIONS_STORE = 'operations';
const RECORDS_STORE = 'records';
const FALLBACK_KEY = 'goatest_offline_sync_operations';
const FALLBACK_RECORDS_KEY = 'goatest_offline_sync_records';
const STALE_SYNCING_MS = 30_000;
const listeners = new Set<(status: SyncStatus | 'OFFLINE' | 'ONLINE') => void>();
let replayPromise: Promise<void> | null = null;
const syncedCallbacks = new Map<string, Set<() => void | Promise<void>>>();

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function emit(status: SyncStatus | 'OFFLINE' | 'ONLINE') {
  listeners.forEach((listener) => listener(status));
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPERATIONS_STORE)) db.createObjectStore(OPERATIONS_STORE, { keyPath: 'operationId' });
      if (!db.objectStoreNames.contains(RECORDS_STORE)) db.createObjectStore(RECORDS_STORE, { keyPath: 'recordKey' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function fallbackRead(): PendingSyncOperation[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function fallbackWrite(operations: PendingSyncOperation[]) {
  try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(operations)); } catch { /* best effort fallback */ }
}

function fallbackReadRecords(): LocalStagedRecord[] {
  try {
    const raw = localStorage.getItem(FALLBACK_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function fallbackWriteRecords(records: LocalStagedRecord[]) {
  try { localStorage.setItem(FALLBACK_RECORDS_KEY, JSON.stringify(records)); } catch { /* best effort fallback */ }
}

async function readAll(): Promise<PendingSyncOperation[]> {
  const db = await openDb();
  if (!db) return fallbackRead();
  return new Promise((resolve) => {
    const request = db.transaction(OPERATIONS_STORE, 'readonly').objectStore(OPERATIONS_STORE).getAll();
    request.onsuccess = () => resolve(request.result as PendingSyncOperation[]);
    request.onerror = () => resolve(fallbackRead());
  });
}

async function readRecords(uid: string, kind?: LocalStagedRecord['kind']): Promise<LocalStagedRecord[]> {
  const db = await openDb();
  if (!db) return fallbackReadRecords().filter((item) => item.uid === uid && (!kind || item.kind === kind));
  return new Promise((resolve) => {
    const request = db.transaction(RECORDS_STORE, 'readonly').objectStore(RECORDS_STORE).getAll();
    request.onsuccess = () => resolve((request.result as LocalStagedRecord[]).filter((item) => item.uid === uid && (!kind || item.kind === kind)));
    request.onerror = () => resolve(fallbackReadRecords().filter((item) => item.uid === uid && (!kind || item.kind === kind)));
  });
}

async function put(operation: PendingSyncOperation): Promise<void> {
  const db = await openDb();
  if (!db) {
    const operations = fallbackRead().filter((item) => item.operationId !== operation.operationId);
    fallbackWrite([...operations, operation]);
    return;
  }
  await new Promise<void>((resolve) => {
    const request = db.transaction(OPERATIONS_STORE, 'readwrite').objectStore(OPERATIONS_STORE).put(operation);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

async function stageAtomically(record: LocalStagedRecord, operation: PendingSyncOperation): Promise<void> {
  const db = await openDb();
  if (!db) {
    const records = fallbackReadRecords().filter((item) => item.recordKey !== record.recordKey);
    const operations = fallbackRead().filter((item) => item.operationId !== operation.operationId);
    fallbackWriteRecords([...records, record]);
    fallbackWrite([...operations, operation]);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([RECORDS_STORE, OPERATIONS_STORE], 'readwrite');
    transaction.objectStore(RECORDS_STORE).put(record);
    transaction.objectStore(OPERATIONS_STORE).put(operation);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('LOCAL_STAGE_TRANSACTION_FAILED'));
    transaction.onabort = () => reject(transaction.error || new Error('LOCAL_STAGE_TRANSACTION_ABORTED'));
  });
}

function isTransient(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('offline') || message.includes('unavailable') || message.includes('network') || message.includes('deadline') || message.includes('timeout');
}

async function replay(): Promise<void> {
  if (replayPromise) return replayPromise;
  replayPromise = (async () => {
    if (!isOnline()) {
      emit('OFFLINE');
      return;
    }
    const authUid = getFirebaseAuth()?.currentUser?.uid;
    const db = getFirebaseDb();
    if (!authUid || !db) return;
    const now = Date.now();
    const operations = (await readAll()).filter((operation) => operation.status !== 'SYNCED').map((operation) => {
      if (operation.status === 'SYNCING' && now - new Date(operation.updatedAt).getTime() > STALE_SYNCING_MS) {
        return { ...operation, status: 'PENDING' as const, updatedAt: new Date().toISOString() };
      }
      return operation;
    });
    for (const operation of operations) {
      if (operation.uid !== authUid) continue;
      const syncing = { ...operation, status: 'SYNCING' as const, updatedAt: new Date().toISOString() };
      await put(syncing);
      emit('SYNCING');
      try {
        await setDoc(doc(db, operation.collection, operation.documentId), operation.payload, { merge: true });
        await put({ ...syncing, status: 'SYNCED', updatedAt: new Date().toISOString(), lastError: undefined });
        emit('SYNCED');
        const callbacks = syncedCallbacks.get(operation.operationId);
        if (callbacks) {
          syncedCallbacks.delete(operation.operationId);
          for (const callback of callbacks) await callback();
        }
      } catch (error) {
        const failed = { ...syncing, status: 'FAILED' as const, retryCount: operation.retryCount + 1, updatedAt: new Date().toISOString(), lastError: error instanceof Error ? error.message : String(error) };
        await put(failed);
        emit('FAILED');
        if (!isTransient(error)) continue;
        break;
      }
    }
  })().finally(() => { replayPromise = null; });
  return replayPromise;
}

export const offlineSyncService = {
  async stageRecordAndQueue(input: {
    record: LocalStagedRecord;
    operation: Omit<PendingSyncOperation, 'createdAt' | 'updatedAt' | 'status' | 'retryCount'>;
  }): Promise<SyncStatus> {
    const existing = (await readAll()).find((operation) => operation.operationId === input.operation.operationId);
    const operation: PendingSyncOperation = {
      ...input.operation,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: existing?.status === 'SYNCED' ? 'SYNCED' : 'PENDING',
      retryCount: existing?.retryCount || 0,
    };
    await stageAtomically(input.record, operation);
    await replay();
    return (await readAll()).find((item) => item.operationId === operation.operationId)?.status || 'PENDING';
  },
  async getLocalRecords<T>(uid: string, kind: LocalStagedRecord['kind']): Promise<T[]> {
    return (await readRecords(uid, kind)).map((item) => item.record as T);
  },
  async enqueue(input: Omit<PendingSyncOperation, 'createdAt' | 'updatedAt' | 'status' | 'retryCount'>) {
    const existing = (await readAll()).find((operation) => operation.operationId === input.operationId);
    await put({ ...input, createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), status: existing?.status === 'SYNCED' ? 'SYNCED' : 'PENDING', retryCount: existing?.retryCount || 0 });
    void replay();
  },
  replay,
  onSynced(operationId: string, callback: () => void | Promise<void>) {
    const callbacks = syncedCallbacks.get(operationId) || new Set<() => void | Promise<void>>();
    callbacks.add(callback);
    syncedCallbacks.set(operationId, callbacks);
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) syncedCallbacks.delete(operationId);
    };
  },
  async getStatus(uid: string, operationId: string): Promise<SyncStatus | null> {
    return (await readAll()).find((operation) => operation.uid === uid && operation.operationId === operationId)?.status || null;
  },
  subscribe(listener: (status: SyncStatus | 'OFFLINE' | 'ONLINE') => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { emit('ONLINE'); void replay(); });
  window.addEventListener('offline', () => emit('OFFLINE'));
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void replay(); });
  void replay();
}
