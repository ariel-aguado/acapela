import Fuse from "fuse.js";

import type { BibleBook } from "~~/lib/bible";

import { BIBLE_MANIFEST_CACHE_NAME } from "~~/lib/bible";

import type { BookAliasMatch, BookStructure } from "./parse-bible-reference";

import { BOOK_ALIAS_OVERRIDES } from "./book-alias-overrides";
import { bookPopularityRank } from "./book-popularity";
import { normalizeText } from "./normalize-text";

// The book index (<id>.books.json) is read on the main thread, without
// SQLite: it is enough to understand a reference ("jn 3:16", "Sal 46:1-7")
// before the version is even downloaded. Same as SúperBiblia's
// useBibleBooks + useBookAutocomplete, without the Vue reactivity.

const booksCache = new Map<string, Promise<BibleBook[]>>();

async function fetchBooksJson(url: string): Promise<BibleBook[]> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`no se pudo cargar ${url}: HTTP ${response.status}`);
  // Cached here too (same cache as the manifest, see app/sw.ts): on the
  // first load the service worker may not control the page yet.
  const text = await response.text();
  if ("caches" in globalThis) {
    caches.open(BIBLE_MANIFEST_CACHE_NAME)
      .then(cache => cache.put(url, new Response(text, { status: response.status, headers: response.headers })))
      .catch(() => {});
  }
  return JSON.parse(text);
}

export function fetchBooks(versionId: string): Promise<BibleBook[]> {
  let pending = booksCache.get(versionId);
  if (!pending) {
    pending = fetchBooksJson(`/bibles/${versionId}.books.json`);
    pending.catch(() => booksCache.delete(versionId));
    booksCache.set(versionId, pending);
  }
  return pending;
}

type IndexedBook = BibleBook & { aliases: string[] };

const FUSE_OPTIONS = {
  keys: [
    { name: "aliases", weight: 2 },
    { name: "name", weight: 1 },
    { name: "abbreviation", weight: 1 },
  ],
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  ignoreDiacritics: true,
  threshold: 0.25,
  minMatchCharLength: 1,
} satisfies ConstructorParameters<typeof Fuse<IndexedBook>>[1];

export type BookMatcher = {
  books: BibleBook[];
  /** Books a query could name, best first (exact prefixes, then popularity). */
  match: (query: string) => BookAliasMatch[];
  structure: (bookId: number) => BookStructure | undefined;
};

const matchers = new Map<string, Promise<BookMatcher>>();

export function bookMatcher(versionId: string): Promise<BookMatcher> {
  let pending = matchers.get(versionId);
  if (!pending) {
    pending = fetchBooks(versionId).then(createBookMatcher);
    pending.catch(() => matchers.delete(versionId));
    matchers.set(versionId, pending);
  }
  return pending;
}

function createBookMatcher(books: BibleBook[]): BookMatcher {
  const indexed: IndexedBook[] = books.map(book => ({
    ...book,
    aliases: BOOK_ALIAS_OVERRIDES[book.id] ?? [],
  }));
  const fuse = new Fuse(indexed, FUSE_OPTIONS);
  const byId = new Map(books.map(book => [book.id, book]));

  function isExactPrefix(book: IndexedBook, normalizedQuery: string): boolean {
    return [book.name, book.abbreviation, ...book.aliases]
      .some(candidate => normalizeText(candidate).startsWith(normalizedQuery));
  }

  function match(query: string): BookAliasMatch[] {
    const trimmed = query.trim();
    if (trimmed === "")
      return [];
    const normalizedQuery = normalizeText(trimmed);
    const results = fuse.search(trimmed);
    const exactIds = new Set(results
      .filter(r => [r.item.name, r.item.abbreviation, ...r.item.aliases].some(alias => normalizeText(alias) === normalizedQuery))
      .map(r => r.item.id));

    return results
      .map(result => ({
        id: result.item.id,
        name: result.item.name,
        matchedAlias: result.matches?.[0]?.value ?? result.item.name,
        score: result.score ?? 1,
        isExactPrefix: isExactPrefix(result.item, normalizedQuery),
      }))
      .sort((a, b) => {
        if (a.isExactPrefix !== b.isExactPrefix) {
          return a.isExactPrefix
            ? -1
            : 1;
        }
        if (exactIds.has(a.id) && exactIds.has(b.id))
          return bookPopularityRank(a.id) - bookPopularityRank(b.id);
        return a.score - b.score;
      });
  }

  function structure(bookId: number): BookStructure | undefined {
    const book = byId.get(bookId);
    return book && { chapterCount: book.chapterCount, versesPerChapter: book.versesPerChapter };
  }

  return { books, match, structure };
}
