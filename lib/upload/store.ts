/**
 * Uploaded prints on this device (IndexedDB, `mono-uploads`): the 1500 × 2000
 * ink rasters per tee (PNG, 1-bit alpha) and a re-encoded working copy of the
 * picture (no metadata, at most 3,000 px) so "Edit" can convert it again.
 * The working copy goes when the order is placed; the rasters follow the
 * deletion rules (lib/upload/retention). Nothing here leaves the device.
 */

export interface StoredUpload {
  id: string;
  /** The ink raster per tee it can print on (PNG blobs). */
  rasters: Partial<Record<"black" | "white", Blob>>;
  /** The picture to convert again (Edit), until the order is placed. Words keep their lines instead. */
  source?: Blob;
  words?: string[];
  createdAt: number;
}

const DB = "mono-uploads";
const STORE = "uploads";

let opening: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  }));
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const available = () => typeof indexedDB !== "undefined";
export const putUpload = (u: StoredUpload) => tx("readwrite", (s) => void s.put(u)).then(() => undefined);
export const getUpload = (id: string) => tx<StoredUpload>("readonly", (s) => s.get(id) as IDBRequest<StoredUpload>);
export const deleteUpload = (id: string) => tx("readwrite", (s) => void s.delete(id)).then(() => undefined);
export const uploadIds = () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((k) => (k ?? []).map(String));
export const clearUploads = () => tx("readwrite", (s) => void s.clear()).then(() => undefined);
/** Drops the working copy once the order is placed: only the rasters stay. */
export async function dropSource(id: string) {
  const u = await getUpload(id);
  if (u?.source) await putUpload({ ...u, source: undefined });
}
