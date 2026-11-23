/**
 * Represents a single line in a song's lyrics
 */
export type LyricLine = {
  line: string;
};

/**
 * Parsed lyric content with metadata
 */
export type ParsedLyric = {
  body: string;
  data: {
    title: string;
    description?: string;
    [key: string]: any;
  };
};

/**
 * One block of a hymn as it is sung: the Bible citation under the title, a
 * numbered stanza, or the chorus.
 */
export type LyricBlockSource = {
  kind: "citation" | "stanza" | "chorus";
  /** Stanza number as printed in the songbook ("1", "2"…); empty otherwise. */
  number: string;
  /** The block's own Markdown lines (some hymns use tables for voice parts). */
  markdown: string[];
};

/**
 * A block ready for the reading view: rendered HTML plus plain-text lines,
 * used to point a search hit at the stanza it belongs to.
 */
export type LyricBlock = {
  kind: LyricBlockSource["kind"];
  number: string;
  html: string;
  text: string[];
};

/**
 * Base song data structure
 */
export type SongData = {
  id: number;
  songId: number;
  title: string;
  lyric: string;
  createdAt: number;
};

/**
 * Extended song with parsed markdown and UI state
 */
export type Song = SongData & {
  lyricParsed: ParsedLyric;
  lyricLines: LyricLine[];
  blocks: LyricBlock[];
  favorite: boolean;
  scrollTitle: boolean;
};

/**
 * Filtered/simplified song for search results and lists
 */
export type FilteredSong = {
  songId: number;
  title: string;
  firstLine: string;
  favorite: boolean;
};

/**
 * Full-text search result item — includes the lines that matched.
 */
export type FullSearchResult = {
  songId: number;
  title: string;
  firstLine: string;
  favorite: boolean;
  matchedLines: Array<{ line: string }>;
};

/**
 * A lyric search hit resolved to the block it belongs to, so the result can
 * say "Estrofa 2" / "Coro" and open the hymn at that place.
 */
export type LyricMatch = {
  line: string;
  blockIndex: number;
  blockLabel: string;
};

/**
 * Search mode for the worker search API.
 *  - "byNumber" / "byTitle": match songs against title (title-only fuzzy search)
 *  - "full":                 match across title + lyric, return top results with matched lines
 */
export type SearchMode = "byNumber" | "byTitle" | "full";

/**
 * Options for worker.search()
 */
export type SearchOptions = {
  mode: SearchMode;
  favoritesOnly?: boolean;
  /** IDs of songs the user has favorited — used to set the `favorite` flag on results. */
  favoriteIds?: number[];
  limit?: number;
};

/**
 * Data for inserting a new song (omits auto-generated fields)
 */
export type InsertSong = {
  songId: number;
  title: string;
  lyric: string;
};

/**
 * One entry in the songbook manifest. The manifest is auto-generated at build
 * time from `public/songs/songbook*.txt` files (see scripts/generate-songbook-manifest.mjs).
 *
 * `id` and `name` are derived from the filename; `file` is the basename
 * served from `/songs/` (e.g. `songbook-montevideo.txt`).
 */
export type Songbook = {
  id: string;
  name: string;
  file: string;
  /** Number of hymns in the file (added by the manifest generator). */
  count?: number;
};
