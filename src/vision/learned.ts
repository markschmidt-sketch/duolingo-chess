import { decodeFeature, encodeFeature, CellFeature } from './features';
import type { Label, Template } from './classify';
import { loadTemplates } from './templates';

/**
 * Squares the user corrected on the confirm screen, kept in IndexedDB and used as
 * extra templates so the same misread doesn't happen twice.
 */
const DB = 'dc-vision';
const STORE = 'templates';
const MAX = 400;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => (db.close(), resolve(req.result));
        t.onerror = () => (db.close(), reject(t.error));
      }),
  );
}

interface Stored {
  label: Label;
  f: string;
}

export async function loadLearned(): Promise<Template[]> {
  try {
    const all = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>);
    return all.slice(-MAX).map((t) => ({ label: t.label, feature: decodeFeature(t.f), source: 'user' }));
  } catch {
    return [];
  }
}

export async function learn(items: { label: Label; feature: CellFeature }[]): Promise<void> {
  if (!items.length) return;
  try {
    for (const it of items) await tx('readwrite', (s) => s.add({ label: it.label, f: encodeFeature(it.feature) } satisfies Stored));
  } catch {
    // Private browsing or storage full: learning is a nicety, not a requirement.
  }
}

export async function forgetLearned(): Promise<void> {
  await tx('readwrite', (s) => s.clear()).catch(() => undefined);
}

export async function allTemplates(): Promise<Template[]> {
  return [...loadTemplates(), ...(await loadLearned())];
}
