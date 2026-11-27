import * as Comlink from "comlink";

import type { SongbookWorkerApi } from "~/workers/songbook.worker";
import type { Song } from "~~/lib/types";

// Hymns from songbooks other than the one chosen in Ajustes, for services
// that mix them (a visiting choir, a hymn only in another songbook). A
// second songbook worker reads each one once, the same way the main one
// does; the choice in Ajustes is not touched.

let worker: Comlink.Remote<SongbookWorkerApi> | null = null;
const loading = new Map<string, Promise<void>>();
const loaded = shallowRef(new Map<string, Song[] | Error>());

function otherWorker(): Comlink.Remote<SongbookWorkerApi> {
  worker ??= Comlink.wrap<SongbookWorkerApi>(
    new Worker(new URL("~/workers/songbook.worker.ts", import.meta.url), { type: "module" }),
  );
  return worker;
}

/**
 * The songs of a songbook by id: undefined while it loads (and starts
 * loading it), an Error if it could not be read.
 */
export function songsOf(songbookId: string, file: string | undefined): Song[] | Error | undefined {
  const done = loaded.value.get(songbookId);
  if (done || !file) {
    return done ?? (file
      ? undefined
      : new Error("ese himnario no existe en este sitio"));
  }
  if (!loading.has(songbookId)) {
    // One songbook at a time: the worker keeps only the last one parsed.
    const previous = [
      ...loading.values(),
    ].at(-1) ?? Promise.resolve();
    loading.set(songbookId, previous.then(async () => {
      let result: Song[] | Error;
      try {
        result = await otherWorker().loadAndParse(`/songs/${file}`);
      }
      catch (err) {
        result = err instanceof Error
          ? err
          : new Error(String(err));
      }
      const next = new Map(loaded.value);
      next.set(songbookId, result);
      loaded.value = next;
    }));
  }
  return undefined;
}
