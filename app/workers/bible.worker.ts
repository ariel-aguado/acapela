/// <reference lib="webworker" />
// Bible versions, downloaded on demand and read offline: the Bible part of
// SúperBiblia's sqlite.worker.ts, brought over with its safeguards. Each
// version is one SQLite file listed in /bibles/manifest.json
// (scripts/build-bibles.mjs); the first time it is used it is downloaded,
// kept in the Cache Storage and imported into OPFS, and from then on it is
// opened from there with no network.
//
// VFS: OPFS "SAH Pool". Unlike the classic "opfs" VFS it needs no
// COOP/COEP headers; the price is a single active connection per origin,
// which plugins/bible-worker.client.ts handles by electing one tab to run
// this worker for all the others.

import type { Sqlite3Static } from "@sqlite.org/sqlite-wasm";

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import * as Comlink from "comlink";

import type {
  BibleBook,
  BibleManifest,
  BibleVersionStatus,
  DownloadProgress,
  VerseRow,
} from "~~/lib/bible";

import { BIBLE_DB_CACHE_NAME, BIBLE_MANIFEST_CACHE_NAME } from "~~/lib/bible";

import type { ParsedBibleReference } from "../utils/bible/parse-bible-reference";

import { bookMatcher } from "../utils/bible/books";
import { buildFtsMatchQuery } from "../utils/bible/build-fts-match-query";
import { parseBibleReference } from "../utils/bible/parse-bible-reference";

const BIBLES_DIR = "/bibles";
const VFS_NAME = "acapela-bible-sahpool";

type PoolUtil = Awaited<ReturnType<Sqlite3Static["installOpfsSAHPoolVfs"]>>;
type SAHPoolDb = InstanceType<PoolUtil["OpfsSAHPoolDb"]>;

let poolPromise: Promise<PoolUtil> | null = null;
const openDbHandles = new Map<string, SAHPoolDb>();

// Slots added at once when the pool fills up (see downloadAndImportNow).
const POOL_CAPACITY_STEP = 4;

/**
 * Memoized: if installing the VFS fails (another tab holds the pool), the
 * failure is cached and not retried on every call.
 */
function ensurePool(): Promise<PoolUtil> {
  if (poolPromise)
    return poolPromise;
  poolPromise = (async () => {
    // Best effort: persistent storage makes it less likely that the
    // browser (iOS above all) evicts OPFS under pressure. Never blocks.
    await navigator.storage?.persist?.().catch(() => false);
    const sqlite3 = await sqlite3InitModule();
    return sqlite3.installOpfsSAHPoolVfs({ directory: BIBLES_DIR, name: VFS_NAME, initialCapacity: 8 });
  })();
  return poolPromise;
}

// iOS/Safari reports intermittent "disk I/O error" writing to the pool
// under storage pressure, and a download can be cut short without any
// network error (tab in the background, network change). A fresh retry
// usually succeeds in both cases.
const TRANSIENT_DOWNLOAD_RETRY_COUNT = 2;

function isDiskIoError(err: unknown): boolean {
  const message = err instanceof Error
    ? err.message
    : String(err);
  return /disk i\/o error|sqlite_ioerr/i.test(message);
}

/**
 * A stream that ends early is not reported as an error, and
 * `pool.importDb()` only checks that the size is a multiple of 512 and the
 * header is valid: a truncated file can pass both. Comparing the bytes
 * received with the manifest's `sizeBytes` catches it cheaply.
 */
class IncompleteDownloadError extends Error {}

// pool.importDb() in chunks does not reserve its slot until it finishes:
// two imports at once pick the same slot and write over each other (seen
// in SúperBiblia: RVR1960 ended up with the text of LBLA). One at a time.
let importQueue: Promise<unknown> = Promise.resolve();

/**
 * The response to import from, with a SINGLE reader of its body. Reading
 * two clones at once (one to the cache, one to the import) crashes the
 * whole tab in Firefox. So: the cached copy if there is one; otherwise the
 * whole download goes to the cache first and is read back from there.
 *
 * `fromNetwork`: progress was already reported while downloading.
 */
async function openDbResponse(
  dbUrl: string,
  sizeBytes: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<{ response: Response; fromNetwork: boolean }> {
  const cache = await caches.open(BIBLE_DB_CACHE_NAME).catch(() => null);
  const cached = await cache?.match(dbUrl).catch(() => undefined);
  if (cached?.ok && cached.body)
    return { response: cached, fromNetwork: false };

  const response = await fetch(dbUrl);
  if (!response.ok || !response.body)
    throw new Error(`no se pudo descargar ${dbUrl}: HTTP ${response.status}`);
  if (!cache)
    return { response, fromNetwork: false };

  // sizeBytes first: with a precompressed file (gzip_static in nginx)
  // content-length is the compressed size, while the bytes counted below
  // are already decompressed.
  const total = sizeBytes || Number(response.headers.get("content-length")) || null;
  let loaded = 0;
  onProgress?.({ loaded: 0, total, phase: "fetch" });
  const counted = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      loaded += chunk.byteLength;
      onProgress?.({ loaded, total, phase: "fetch" });
      controller.enqueue(chunk);
    },
  }));

  // Older builds of the same file go first: otherwise they take the quota
  // the new one needs.
  await evictStaleCacheEntries(cache, dbUrl);
  let putFailed = false;
  try {
    await cache.put(dbUrl, new Response(counted, { status: response.status, headers: response.headers }));
  }
  catch {
    putFailed = true;
  }
  // If put() failed (quota) it stopped reading halfway, so a short `loaded`
  // proves nothing: the direct import below checks the size itself.
  if (!putFailed && loaded !== sizeBytes) {
    await cache.delete(dbUrl).catch(() => {});
    throw new IncompleteDownloadError(`descarga incompleta de ${dbUrl}: ${loaded} de ${sizeBytes} bytes`);
  }
  const stored = putFailed
    ? undefined
    : await cache.match(dbUrl).catch(() => undefined);
  if (stored?.body)
    return { response: stored, fromNetwork: true };
  // Not cached and the body is spent: download again and import directly.
  const fresh = await fetch(dbUrl);
  if (!fresh.ok || !fresh.body)
    throw new Error(`no se pudo descargar ${dbUrl}: HTTP ${fresh.status}`);
  return { response: fresh, fromNetwork: false };
}

/** Removes cached copies of earlier builds (`rvr1960.<old-hash>.sqlite`). */
async function evictStaleCacheEntries(cache: Cache, keepUrl: string) {
  const keepPath = new URL(keepUrl, globalThis.location.href).pathname;
  const stem = keepPath.replace(/\.[0-9a-f]+\.sqlite$/i, ".");
  if (stem === keepPath)
    return;
  const keys = await cache.keys().catch(() => [] as readonly Request[]);
  await Promise.all(keys
    .filter((request) => {
      const p = new URL(request.url).pathname;
      return p !== keepPath && p.startsWith(stem) && /^[0-9a-f]+\.sqlite$/i.test(p.slice(stem.length));
    })
    .map(request => cache.delete(request).catch(() => false)));
}

function downloadAndImport(...args: Parameters<typeof downloadAndImportNow>): Promise<void> {
  const run = importQueue.then(() => downloadAndImportNow(...args));
  importQueue = run.catch(() => {});
  return run;
}

/** Streams `dbUrl` into the pool at `vfsPath`, retrying transient failures. */
async function downloadAndImportNow(
  dbUrl: string,
  vfsPath: string,
  pool: PoolUtil,
  sizeBytes: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  // A pool keeps the capacity it was created with: grow it when full.
  if (!pool.getFileNames().includes(vfsPath) && pool.getFileCount() >= pool.getCapacity())
    await pool.addCapacity(POOL_CAPACITY_STEP);

  for (let attempt = 0; ; attempt++) {
    try {
      const { response, fromNetwork } = await openDbResponse(dbUrl, sizeBytes, onProgress);
      const total = sizeBytes || Number(response.headers.get("content-length")) || null;
      let loaded = 0;
      const reader = response.body!.getReader();
      if (!fromNetwork)
        onProgress?.({ loaded: 0, total, phase: "fetch" });

      await pool.importDb(vfsPath, async () => {
        const { done, value } = await reader.read();
        // Caught here, before importDb() fails with its own size error,
        // so that it is retried and the truncated cached copy is dropped.
        if (done && loaded !== sizeBytes)
          throw new IncompleteDownloadError(`descarga incompleta de ${vfsPath}: ${loaded} de ${sizeBytes} bytes`);
        if (done)
          return undefined;
        loaded += value.byteLength;
        if (!fromNetwork)
          onProgress?.({ loaded, total, phase: "writing-opfs" });
        return value;
      });

      if (loaded !== sizeBytes)
        throw new IncompleteDownloadError(`descarga incompleta de ${vfsPath}: ${loaded} de ${sizeBytes} bytes`);
      return;
    }
    catch (err) {
      const isTransient = isDiskIoError(err) || err instanceof IncompleteDownloadError;
      if (!isTransient || attempt >= TRANSIENT_DOWNLOAD_RETRY_COUNT)
        throw err;
      try {
        pool.unlink(vfsPath);
      }
      catch {
        // It may not have been created.
      }
      // A truncated cached copy would be served again: drop it. After a
      // disk I/O error the copy is fine and, offline, the only way to retry.
      if (err instanceof IncompleteDownloadError)
        await caches.open(BIBLE_DB_CACHE_NAME).then(cache => cache.delete(dbUrl)).catch(() => {});
    }
  }
}

/** Frees the slots of earlier builds of `id` before importing the current one. */
function evictStaleVersionFiles(pool: PoolUtil, id: string, keepFile: string) {
  const prefix = `/${id}.`;
  const keepPath = `/${keepFile}`;
  for (const name of pool.getFileNames()) {
    if (!name.startsWith(prefix) || !name.endsWith(".sqlite") || name === keepPath)
      continue;
    closeHandle(id);
    pool.unlink(name);
  }
}

async function getPoolStatus(): Promise<"ok" | "locked"> {
  try {
    await ensurePool();
    return "ok";
  }
  catch {
    return "locked";
  }
}

async function fetchManifest(): Promise<BibleManifest> {
  const manifestUrl = `${BIBLES_DIR}/manifest.json`;
  let response: Response | undefined;
  try {
    response = await fetch(manifestUrl);
  }
  catch {
    // Offline before the service worker took control: the copy kept below.
  }
  if (!response?.ok) {
    const cached = await caches.open(BIBLE_MANIFEST_CACHE_NAME).then(c => c.match(manifestUrl)).catch(() => undefined);
    if (cached)
      return cached.json();
    throw new Error(`no se pudo cargar el índice de biblias${response
      ? `: HTTP ${response.status}`
      : ""}`);
  }
  // Kept here too, not only by the service worker: on the very first load
  // it may not control the page yet, and without the manifest an already
  // downloaded version cannot be found offline.
  return readAndCacheJson(response, manifestUrl) as Promise<BibleManifest>;
}

/** Reads the JSON once and caches a copy built from that text (no clone()). */
async function readAndCacheJson(response: Response, url: string): Promise<unknown> {
  const text = await response.text();
  caches.open(BIBLE_MANIFEST_CACHE_NAME)
    .then(cache => cache.put(url, new Response(text, { status: response.status, headers: response.headers })))
    .catch(() => {});
  return JSON.parse(text);
}

async function listAvailableVersions(): Promise<BibleVersionStatus[]> {
  const manifest = await fetchManifest();
  let present = new Set<string>();
  try {
    present = new Set((await ensurePool()).getFileNames());
  }
  catch {
    // Pool unavailable: the catalogue still lists, none marked ready.
  }
  return manifest.versions.map(v => ({
    ...v,
    isReady: present.has(`/${v.file}`),
  }));
}

function openDb(versionId: string, vfsPath: string, pool: PoolUtil): SAHPoolDb {
  const existing = openDbHandles.get(versionId);
  if (existing)
    return existing;
  const db = new pool.OpfsSAHPoolDb(vfsPath);
  openDbHandles.set(versionId, db);
  return db;
}

function closeHandle(versionId: string) {
  openDbHandles.get(versionId)?.close();
  openDbHandles.delete(versionId);
}

/**
 * Second check: a file damaged in an earlier session already counts as
 * present, so the `verse` table is checked before trusting it.
 */
function tableExists(db: SAHPoolDb, tableName: string): boolean {
  try {
    return db.selectObjects(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [tableName]).length > 0;
  }
  catch {
    return false;
  }
}

function closeAndUnlink(pool: PoolUtil, versionId: string, vfsPath: string) {
  closeHandle(versionId);
  try {
    pool.unlink(vfsPath);
  }
  catch {
    // Not critical.
  }
}

async function loadVersion(
  versionId: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<BibleVersionStatus> {
  const pool = await ensurePool();
  const manifest = await fetchManifest();
  const meta = manifest.versions.find(v => v.id === versionId);
  if (!meta)
    throw new Error(`versión de la Biblia desconocida: ${versionId}`);

  evictStaleVersionFiles(pool, versionId, meta.file);
  const vfsPath = `/${meta.file}`;
  const dbUrl = `${BIBLES_DIR}/${meta.file}`;

  if (!pool.getFileNames().includes(vfsPath))
    await downloadAndImport(dbUrl, vfsPath, pool, meta.sizeBytes, onProgress);

  onProgress?.({ loaded: meta.sizeBytes, total: meta.sizeBytes, phase: "done" });
  let db = openDb(versionId, vfsPath, pool);

  if (!tableExists(db, "verse")) {
    closeAndUnlink(pool, versionId, vfsPath);
    await downloadAndImport(dbUrl, vfsPath, pool, meta.sizeBytes, onProgress);
    db = openDb(versionId, vfsPath, pool);
    if (!tableExists(db, "verse")) {
      closeAndUnlink(pool, versionId, vfsPath);
      throw new Error(`la base de "${versionId}" sigue dañada después de volver a descargarla`);
    }
  }

  return { ...meta, isReady: true };
}

/** Frees the space a version takes on this device (OPFS and the cached download). */
async function removeVersion(versionId: string): Promise<void> {
  const pool = await ensurePool();
  closeHandle(versionId);
  for (const name of pool.getFileNames()) {
    if (name.startsWith(`/${versionId}.`) && name.endsWith(".sqlite"))
      pool.unlink(name);
  }
  const cache = await caches.open(BIBLE_DB_CACHE_NAME).catch(() => null);
  const keys = await cache?.keys().catch(() => [] as readonly Request[]) ?? [];
  await Promise.all(keys
    .filter(request => new URL(request.url).pathname.startsWith(`${BIBLES_DIR}/${versionId}.`))
    .map(request => cache!.delete(request).catch(() => false)));
}

// Queries load the version themselves: with several tabs this worker lives
// in the leader tab, and a new leader starts with nothing open while other
// tabs keep asking. Concurrent loads of one version share a promise.
const pendingLoads = new Map<string, Promise<BibleVersionStatus>>();
function loadVersionDeduped(
  versionId: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<BibleVersionStatus> {
  let pending = pendingLoads.get(versionId);
  if (!pending) {
    pending = loadVersion(versionId, onProgress).finally(() => pendingLoads.delete(versionId));
    pendingLoads.set(versionId, pending);
  }
  return pending;
}

async function ensureBibleDb(versionId: string): Promise<SAHPoolDb> {
  if (!openDbHandles.has(versionId))
    await loadVersionDeduped(versionId);
  const db = openDbHandles.get(versionId);
  if (!db)
    throw new Error(`la versión "${versionId}" no está cargada`);
  return db;
}

async function getBookList(versionId: string): Promise<BibleBook[]> {
  const db = await ensureBibleDb(versionId);
  const rows = db.selectObjects(
    `SELECT book.id AS id, book.testament_id AS testamentId, book.name AS name, book.abbreviation AS abbreviation,
            (SELECT MAX(v.chapter) FROM verse v WHERE v.book_id = book.id) AS chapterCount,
            (SELECT json_group_array(vc.verseCount) FROM (
               SELECT MAX(v.verse) AS verseCount FROM verse v WHERE v.book_id = book.id GROUP BY v.chapter ORDER BY v.chapter
             ) vc) AS versesPerChapterJson
     FROM book ORDER BY book.id`,
  );
  return rows.map(({ versesPerChapterJson, ...row }) => ({
    ...row,
    versesPerChapter: JSON.parse(String(versesPerChapterJson)),
  })) as BibleBook[];
}

const VERSE_SELECT = `
  SELECT verse.id AS id, verse.book_id AS bookId, book.name AS bookName,
         verse.chapter AS chapter, verse.verse AS verse, verse.text AS text,
         verse.verse_range_end AS verseRangeEnd
  FROM verse JOIN book ON book.id = verse.book_id
`;

async function getChapter(versionId: string, bookId: number, chapter: number): Promise<VerseRow[]> {
  const db = await ensureBibleDb(versionId);
  return db.selectObjects(
    `${VERSE_SELECT} WHERE verse.book_id = ? AND verse.chapter = ? ORDER BY verse.verse`,
    [bookId, chapter],
  ) as VerseRow[];
}

/**
 * A passage, possibly across chapters: from chapter:verse to
 * chapter:verse of one book (Sal 46:1-7, Jn 3:16-4:2). A missing
 * `verseEnd` reads to the end of the last chapter.
 */
async function getPassage(
  versionId: string,
  bookId: number,
  from: { chapter: number; verse: number },
  to: { chapter: number; verse?: number },
): Promise<VerseRow[]> {
  const db = await ensureBibleDb(versionId);
  const start = from.chapter * 1000 + from.verse;
  const end = to.chapter * 1000 + (to.verse ?? 999);
  return db.selectObjects(
    `${VERSE_SELECT} WHERE verse.book_id = ? AND verse.chapter * 1000 + verse.verse BETWEEN ? AND ?
     ORDER BY verse.chapter, verse.verse`,
    [bookId, start, end],
  ) as VerseRow[];
}

/** Full-text search (FTS5, accents ignored): the words in order, the last as a prefix. */
async function search(
  versionId: string,
  query: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<VerseRow[]> {
  const matchQuery = buildFtsMatchQuery(query);
  if (!matchQuery)
    return [];
  const db = await ensureBibleDb(versionId);
  return db.selectObjects(
    `SELECT verse.id AS id, verse.book_id AS bookId, book.name AS bookName,
            verse.chapter AS chapter, verse.verse AS verse, verse.text AS text,
            verse.verse_range_end AS verseRangeEnd
     FROM verse_fts
     JOIN verse ON verse.id = verse_fts.rowid
     JOIN book ON book.id = verse.book_id
     WHERE verse_fts MATCH ?
     ORDER BY rank
     LIMIT ? OFFSET ?`,
    [matchQuery, opts.limit ?? 50, opts.offset ?? 0],
  ) as VerseRow[];
}

/**
 * Understands a typed reference ("jn 3:16", "Sal 46:1-7") against a
 * version's book index (<id>.books.json, no SQLite: the version need not
 * be downloaded). Here and not on the main thread so Fuse.js, which ranks
 * the book names, stays in workers, as the hymnal search does.
 */
async function parseReference(versionId: string, input: string): Promise<ParsedBibleReference> {
  const matcher = await bookMatcher(versionId);
  return parseBibleReference(input, matcher.match, matcher.structure);
}

const api = {
  parseReference,
  getPoolStatus,
  listAvailableVersions,
  loadVersion: (versionId: string, onProgress?: (progress: DownloadProgress) => void) =>
    loadVersionDeduped(versionId, onProgress),
  removeVersion,
  getBookList,
  getChapter,
  getPassage,
  search,
};

export type BibleWorkerApi = typeof api;

Comlink.expose(api);
