const DB_NAME = 'goatest-profile-cache';
const STORE_NAME = 'images';
const memory = new Map<string, string>();
const listeners = new Map<string, Set<(image: string | null) => void>>();

function storageKey(uid: string) { return `profile-image:${uid}`; }

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function write(uid: string, value: string | null): Promise<void> {
  if (value) memory.set(uid, value); else memory.delete(uid);
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      if (value) tx.objectStore(STORE_NAME).put(value, storageKey(uid));
      else tx.objectStore(STORE_NAME).delete(storageKey(uid));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } else {
    try {
      if (value) localStorage.setItem(storageKey(uid), value);
      else localStorage.removeItem(storageKey(uid));
    } catch { /* local cache may be unavailable */ }
  }
}

async function read(uid: string): Promise<string | null> {
  if (memory.has(uid)) return memory.get(uid) || null;
  const db = await openDb();
  if (db) {
    const value = await new Promise<string | null>((resolve) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(storageKey(uid));
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => resolve(null);
    });
    if (value) memory.set(uid, value);
    return value;
  }
  try { return localStorage.getItem(storageKey(uid)); } catch { return null; }
}

function emit(uid: string, image: string | null) {
  listeners.get(uid)?.forEach((listener) => listener(image));
}

export const profileImageStorage = {
  load: read,
  async savePending(uid: string, image: string): Promise<void> { await write(`${uid}:pending`, image); },
  async commit(uid: string, image: string): Promise<string | null> {
    await write(uid, image);
    let remoteUrl: string | null = null;
    if (firebaseApp) {
      const objectRef = ref(getStorage(firebaseApp), `profileImages/${uid}/profile`);
      await uploadString(objectRef, image, 'data_url', { contentType: image.match(/^data:([^;]+)/)?.[1] || 'image/jpeg' });
      remoteUrl = await getDownloadURL(objectRef);
    }
    await write(`${uid}:pending`, null);
    emit(uid, image);
    return remoteUrl;
  },
  async discardPending(uid: string): Promise<void> { await write(`${uid}:pending`, null); },
  subscribe(uid: string, listener: (image: string | null) => void): () => void {
    if (!listeners.has(uid)) listeners.set(uid, new Set());
    listeners.get(uid)!.add(listener);
    return () => listeners.get(uid)?.delete(listener);
  },
};
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '../config/firebase';

