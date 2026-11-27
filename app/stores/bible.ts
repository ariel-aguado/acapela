import * as Comlink from "comlink";

import type { ParsedBibleReference } from "~/utils/bible/parse-bible-reference";
import type { BibleWorkerApi } from "~/workers/bible.worker";
import type { BibleVersionStatus, DownloadProgress, VerseRow } from "~~/lib/bible";

export type BiblePassage = {
  versionId: string;
  /** "Salmos 46:1-7" */
  label: string;
  reference: ParsedBibleReference;
  verses: VerseRow[];
};

function useBibleWorker(): BibleWorkerApi {
  return (useNuxtApp() as unknown as { $bibleWorker: BibleWorkerApi }).$bibleWorker;
}

/**
 * Bible versions on this device: which exist (/bibles/manifest.json), which
 * are downloaded, the one in use, and reading a passage from a reference
 * typed by hand. A version downloads the first time it is used (or ahead
 * of time from Ajustes) and works offline from then on.
 */
export const useBibleStore = defineStore("bible", () => {
  const versions = ref<BibleVersionStatus[]>([]);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  /** Download progress per version id, while downloading. */
  const progress = ref<Record<string, DownloadProgress>>({});
  const preferredId = useLocalStorage<string>("bibleVersion", "");

  const currentId = computed(() =>
    versions.value.some(v => v.id === preferredId.value)
      ? preferredId.value
      : versions.value[0]?.id ?? "",
  );

  async function refresh() {
    try {
      versions.value = await useBibleWorker().listAvailableVersions();
      error.value = null;
    }
    catch (err) {
      error.value = err instanceof Error
        ? err.message
        : String(err);
    }
    finally {
      loaded.value = true;
    }
  }

  /** Downloads (if needed) and opens a version. */
  async function download(versionId: string) {
    progress.value = {
      ...progress.value,
      [versionId]: { loaded: 0, total: null, phase: "fetch" },
    };
    try {
      const status = await useBibleWorker().loadVersion(
        versionId,
        Comlink.proxy((p: DownloadProgress) => {
          progress.value = { ...progress.value, [versionId]: p };
        }),
      );
      versions.value = versions.value.map(v => v.id === versionId
        ? status
        : v);
    }
    finally {
      const { [versionId]: _, ...rest } = progress.value;
      progress.value = rest;
    }
  }

  async function remove(versionId: string) {
    await useBibleWorker().removeVersion(versionId);
    versions.value = versions.value.map(v => v.id === versionId
      ? { ...v, isReady: false }
      : v);
  }

  function select(versionId: string) {
    preferredId.value = versionId;
  }

  /** Understands a typed reference ("jn 3:16", "Sal 46:1-7") against a version's books. */
  async function parse(input: string, versionId?: string): Promise<ParsedBibleReference> {
    const id = await resolveVersionId(versionId);
    return useBibleWorker().parseReference(id, input);
  }

  /** The given version, or the one in use once the list is known. */
  async function resolveVersionId(versionId?: string): Promise<string> {
    if (!loaded.value)
      await refresh();
    const id = versionId || currentId.value;
    if (!id)
      throw new Error("No hay versiones de la Biblia disponibles.");
    return id;
  }

  /**
   * The verses of a reference, downloading the version if it is not on this
   * device yet. null when the text is not a complete reference.
   */
  async function passage(input: string, requestedId?: string): Promise<BiblePassage | null> {
    const versionId = await resolveVersionId(requestedId);
    const reference = await parse(input, versionId);
    // "Ambiguous" ("jn" could be Juan, Jonás, Joel…) reads the active
    // candidate, the most likely one, as SúperBiblia's "Ir a" does.
    const book = reference.book
      ?? reference.bookCandidates?.[reference.activeCandidateIndex]
      ?? reference.bookCandidates?.[0];
    const chapter = reference.chapter;
    if ((reference.status !== "valid" && reference.status !== "ambiguous") || !book || !chapter)
      return null;

    if (!versions.value.find(v => v.id === versionId)?.isReady)
      await download(versionId);

    const worker = useBibleWorker();
    const bookId = book.id;
    let verses: VerseRow[];
    if (reference.verses?.length) {
      const rows = await worker.getChapter(versionId, bookId, chapter);
      const wanted = new Set(reference.verses);
      verses = rows.filter(r => wanted.has(r.verse));
    }
    else if (reference.verseStart) {
      verses = await worker.getPassage(versionId, bookId, { chapter, verse: reference.verseStart }, { chapter, verse: reference.verseEnd ?? reference.verseStart });
    }
    else {
      verses = await worker.getChapter(versionId, bookId, chapter);
    }
    return {
      versionId,
      label: reference.canonicalLabel ?? book.name,
      reference,
      verses,
    };
  }

  return {
    versions,
    loaded,
    error,
    progress,
    currentId,
    refresh,
    download,
    remove,
    select,
    parse,
    passage,
  };
});
