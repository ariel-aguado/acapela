import type { BookAliasMatch, BookStructure } from "./parse-bible-reference";

import {
  extractReferenceTail,
  findAllValidChapterVerseSplits,
  findVerseEndCandidates,
  matchAnyGluedVerseGroupTail,
  matchLastNVersesTail,
  normalizeReferenceMarkers,
  resolveGluedVerseGroupVerses,
  resolveLastNVerses,
  resolveNumericReference,
} from "./parse-bible-reference";
import { formatVerseRanges } from "./verse-selection";

// SúperBiblia's predictive "Ir a" (utils/goToPredictor.ts there), as a flat
// list: while a reference is typed, EVERY reading of it that exists, not
// only the likeliest. "jn123" is Juan 1:23 and Juan 12:3; "jn" is Juan,
// Jonás, Joel…; "jn 3:16-2" offers 3:16-20…29. Each reading is checked
// against that book's real chapters and verses, so whatever is proposed is
// a valid passage. parseBibleReference keeps choosing the single one Enter
// would read; this is for choosing among them.

const MAX_SUGGESTIONS = 6;
/** Range ends offered for a half-typed "-N", per reading. */
const MAX_END_CANDIDATES = 3;

export type ReferenceSuggestion = {
  key: string;
  /** "Juan 1:23", "Juan 3:16-18", "Mateo 2:1-3,5"; just "Juan" for a book. */
  label: string;
  bookId: number;
  /** A book alone, still without a chapter. */
  isBook: boolean;
};

export function predictReferences(
  input: string,
  matchBook: (query: string) => BookAliasMatch[],
  getStructure: (bookId: number) => BookStructure | undefined,
): ReferenceSuggestion[] {
  const trimmed = input.trim();
  if (trimmed === "")
    return [];

  const out: ReferenceSuggestion[] = [];
  const seen = new Set<string>();
  function add(book: BookAliasMatch, chapter?: number, verses?: string) {
    const label = chapter == null
      ? book.name
      : verses
        ? `${book.name} ${chapter}:${verses}`
        : `${book.name} ${chapter}`;
    if (seen.has(label))
      return;
    seen.add(label);
    out.push({
      key: `${book.id}:${label}`,
      label,
      bookId: book.id,
      isBook: chapter == null,
    });
  }

  // A list of verses ("Mateo 2:1-3,5,8-13"): before normalizeReferenceMarkers,
  // which would turn its commas into ":" (same order as parseBibleReference).
  const glued = matchAnyGluedVerseGroupTail(trimmed);
  if (glued) {
    for (const book of matchBook(glued.bookPart)) {
      const resolved = resolveGluedVerseGroupVerses(glued, getStructure(book.id));
      if (resolved)
        add(book, resolved.chapter, formatVerseRanges(resolved.verses));
    }
    return out.slice(0, MAX_SUGGESTIONS);
  }

  // "últimos 5 versículos de Juan 3": needs each book's own verse count.
  const lastN = matchLastNVersesTail(trimmed);
  if (lastN) {
    for (const book of matchBook(lastN.bookPart)) {
      const resolved = resolveLastNVerses(lastN.count, lastN.chapterDigits, getStructure(book.id));
      if (resolved)
        add(book, resolved.chapter, `${resolved.verseStart}-${resolved.verseEnd}`);
    }
    return out.slice(0, MAX_SUGGESTIONS);
  }

  const normalized = normalizeReferenceMarkers(trimmed);
  const { bookPart, chapterDigits, verseStart: rawStart, verseEnd: rawEnd, verseEndDigits, gluedRangeDigits } = extractReferenceTail(normalized);
  const books = bookPart === ""
    ? []
    : matchBook(bookPart);
  const hasNumbers = chapterDigits != null || gluedRangeDigits != null;

  for (const book of books) {
    const structure = getStructure(book.id);
    if (!structure)
      continue;
    if (!hasNumbers) {
      add(book);
      continue;
    }

    // Every reading of the same digits in this book, by chapter then verse.
    const readings: { chapter: number; verses?: string; rank: number; order: number }[] = [];
    function reading(chapter: number, verseStart?: number, verseEnd?: number, rank = 0) {
      readings.push({
        chapter,
        rank,
        order: verseStart ?? 0,
        verses: verseStart == null
          ? undefined
          : verseEnd != null && verseEnd !== verseStart
            ? `${verseStart}-${verseEnd}`
            : String(verseStart),
      });
    }
    // The end of a range: as typed if it closes one, otherwise the verses it
    // could still become ("3:16-2" → 16-20, 16-21…), not "not found".
    function withEnd(chapter: number, verseStart: number) {
      const count = structure!.versesPerChapter[chapter - 1];
      if (count == null || verseStart < 1 || verseStart > count)
        return;
      if (rawEnd == null) {
        reading(chapter, verseStart);
        return;
      }
      if (rawEnd >= verseStart && rawEnd <= count) {
        reading(chapter, verseStart, rawEnd);
        return;
      }
      if (verseEndDigits != null) {
        for (const end of findVerseEndCandidates(verseEndDigits, verseStart, count).slice(0, MAX_END_CANDIDATES))
          reading(chapter, verseStart, end);
      }
    }

    if (gluedRangeDigits != null) {
      // "jn110-12": every chapter+verse cut of the digits before the dash.
      for (const split of findAllValidChapterVerseSplits(gluedRangeDigits, structure))
        withEnd(split.chapter, split.verseStart);
    }
    else if (rawStart != null && chapterDigits != null) {
      const chapter = Number(chapterDigits);
      if (chapter >= 1 && chapter <= structure.chapterCount)
        withEnd(chapter, rawStart);
    }
    else {
      const numeric = resolveNumericReference(chapterDigits, rawStart, rawEnd, structure);
      // The reading Enter would take ("sal23": Salmo 23) goes first.
      if (numeric.valid && numeric.chapter != null)
        reading(numeric.chapter, numeric.verseStart, numeric.verseEnd, -1);
      // Digits without a separator: the whole number as the chapter and
      // every chapter+verse cut ("jn123" → Juan 12:3 and Juan 1:23).
      if (chapterDigits != null && rawStart == null && chapterDigits.length >= 2) {
        for (const split of findAllValidChapterVerseSplits(chapterDigits, structure))
          reading(split.chapter, split.verseStart);
      }
    }

    readings.sort((a, b) => a.rank - b.rank || a.chapter - b.chapter || a.order - b.order);
    for (const r of readings)
      add(book, r.chapter, r.verses);
  }

  return out.slice(0, MAX_SUGGESTIONS);
}
