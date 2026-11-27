import type { Song, Songbook } from "~~/lib/types";

// When the chosen songbook has nothing for a query, the same query in the
// other songbooks of the site: a hymn may be printed in another one (a
// visitor, an old songbook). The other songbooks are read only once that
// happens, by the second worker of use-other-songbooks, and the choice in
// Ajustes is not touched.

export type ElsewhereHit = {
  songbook: Songbook;
  song: Song;
  /** The line to show: the first line for a title hit, else the matched one. */
  line: string;
  /** Block to open at, or -1 for a title hit. */
  blockIndex: number;
};

const PER_SONGBOOK = 3;

function matchSong(song: Song, needle: string): { line: string; blockIndex: number } | null {
  const sung = song.blocks.filter(b => b.kind !== "citation");
  if (normalizeLyric(song.title).includes(needle))
    return { line: sung[0]?.text[0] ?? "", blockIndex: -1 };
  const blockIndex = song.blocks.findIndex(b =>
    b.kind !== "citation" && normalizeLyric(b.text.join(" ")).includes(needle),
  );
  if (blockIndex < 0)
    return null;
  const block = song.blocks[blockIndex]!;
  // The line where the phrase starts (it may run onto the next one).
  const first = needle.split(" ")[0] ?? needle;
  const line = block.text.find(l => normalizeLyric(l).includes(needle))
    ?? block.text.find(l => normalizeLyric(l).includes(first))
    ?? block.text[0]
    ?? "";
  return { line, blockIndex };
}

export function useSearchElsewhere(query: Ref<string>, active: Ref<boolean>) {
  const songbookStore = useSongbookStore();
  const { manifest, currentId } = storeToRefs(songbookStore);

  const others = computed(() => manifest.value.filter(s => s.id !== currentId.value));

  const state = computed(() => {
    const needle = normalizeLyric(query.value);
    if (!active.value || !needle)
      return { hits: [] as ElsewhereHit[], loading: false };
    const hits: ElsewhereHit[] = [];
    let loading = false;
    for (const songbook of others.value) {
      // Starts loading the songbook the first time it is asked for.
      const songs = songsOf(songbook.id, songbook.file);
      if (songs === undefined) {
        loading = true;
        continue;
      }
      if (songs instanceof Error)
        continue;
      let found = 0;
      for (const song of songs) {
        const match = matchSong(song, needle);
        if (!match)
          continue;
        hits.push({
          songbook,
          song,
          line: lyricExcerpt(match.line),
          blockIndex: match.blockIndex,
        });
        if (++found >= PER_SONGBOOK)
          break;
      }
    }
    return { hits, loading };
  });

  return {
    hits: computed(() => state.value.hits),
    loading: computed(() => state.value.loading),
    /** Names of the songbooks that were searched, the chosen one first. */
    searchedNames: computed(() => [
      songbookStore.currentSongbook?.name,
      ...others.value.map(s => s.name),
    ].filter(Boolean) as string[]),
  };
}
