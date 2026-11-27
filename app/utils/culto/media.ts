import { nanoid } from "nanoid";

// Images of the services (backgrounds, the church's logo, slides from a PDF),
// kept on this device in IndexedDB: localStorage is too small for them and
// there is no server. The console and the projector window share the origin,
// so the projector reads the same images by id.

const DB_NAME = "acapela-media";
const STORE = "media";

export type MediaRecord = {
  id: string;
  blob: Blob;
  name: string;
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

// One object URL per image for the life of the page.
const urls = new Map<string, Promise<string | null>>();

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(database => new Promise<T>((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export async function putMedia(blob: Blob, name = ""): Promise<string> {
  const id = nanoid(12);
  await run("readwrite", store => store.put({
    id,
    blob,
    name,
    createdAt: Date.now(),
  } satisfies MediaRecord));
  return id;
}

/** Keeps an image under a given id (importing a service); existing ids are left as they are. */
export async function putMediaWithId(id: string, blob: Blob, name = ""): Promise<void> {
  if (await getMedia(id))
    return;
  await run("readwrite", store => store.put({
    id,
    blob,
    name,
    createdAt: Date.now(),
  } satisfies MediaRecord));
}

export async function getMedia(id: string): Promise<MediaRecord | undefined> {
  return run<MediaRecord | undefined>("readonly", store => store.get(id));
}

export async function deleteMedia(ids: string[]): Promise<void> {
  if (!ids.length)
    return;
  await run("readwrite", (store) => {
    let last!: IDBRequest;
    for (const id of ids)
      last = store.delete(id);
    return last;
  });
  for (const id of ids) {
    const url = urls.get(id);
    if (url)
      url.then(u => u && URL.revokeObjectURL(u));
    urls.delete(id);
  }
}

export async function allMediaIds(): Promise<string[]> {
  return run<IDBValidKey[]>("readonly", store => store.getAllKeys()).then(keys => keys.map(String));
}

export function mediaUrl(id: string): Promise<string | null> {
  let url = urls.get(id);
  if (!url) {
    url = getMedia(id).then(record => record
      ? URL.createObjectURL(record.blob)
      : null).catch(() => null);
    urls.set(id, url);
  }
  return url;
}

/**
 * An image file reduced to projection size (1920 px wide at most) and
 * re-encoded, so a 12 MB photo from a phone does not fill the storage.
 */
export async function importImage(file: Blob, name = ""): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / bitmap.width, 1920 / bitmap.height);
  if (scale === 1 && file.size < 1_500_000) {
    bitmap.close();
    return putMedia(file, name);
  }
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.86 });
  return putMedia(blob, name);
}
