/**
 * Bible data contract, shared by the build script (scripts/build-bible-db.mjs),
 * the worker (app/workers/bible.worker.ts) and the UI. Same shapes as
 * SúperBiblia (shared/types/bible.ts there), so the databases and the
 * reference parser work unchanged; plain types instead of zod schemas
 * because the only producer is our own build script.
 */

export type BibleBook = {
  id: number;
  testamentId: number;
  name: string;
  abbreviation: string;
  chapterCount: number;
  /** versesPerChapter[i] = number of verses in chapter i + 1. */
  versesPerChapter: number[];
};

export type VerseRow = {
  id: number;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  /**
   * Set only on a verse that holds a merge from the source translation
   * (DHH joins Numbers 1:17-18 under 17; 18 has empty text): the last
   * verse number this row's text covers. null everywhere else.
   */
  verseRangeEnd: number | null;
};

export type BibleVersionMeta = {
  id: string;
  label: string;
  /** "<id>.<hash8>.sqlite": a new build is a new URL. */
  file: string;
  sizeBytes: number;
  sha256: string;
  schemaVersion: number;
  builtAt: string;
  features?: string[];
};

/** isReady: the database is already in this device's storage (OPFS). */
export type BibleVersionStatus = BibleVersionMeta & { isReady: boolean };

export type BibleManifest = { versions: BibleVersionMeta[] };

export type DownloadProgress = {
  loaded: number;
  total: number | null;
  phase: "fetch" | "writing-opfs" | "done";
};

export const BIBLE_DB_CACHE_NAME = "bible-db-cache-v1";
export const BIBLE_MANIFEST_CACHE_NAME = "bible-manifest-cache-v1";
