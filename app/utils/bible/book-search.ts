import type { BibleBook } from "~~/lib/bible";

import type { BookAliasMatch } from "./parse-bible-reference";

import { BOOK_ALIAS_OVERRIDES } from "./book-alias-overrides";
import { normalizeText } from "./normalize-text";
import { extractReferenceTail, normalizeReferenceMarkers, parseBibleReference } from "./parse-bible-reference";

/**
 * Buscador del explorador de libros (BookChapterPicker.vue, 2026-11-16):
 * filtra los libros en memoria — sin la base, funciona sin conexión — y
 * reconoce una cita completa («jn 3:16») para ofrecer «Ir a …».
 *
 * A diferencia de useBookAutocomplete (Fuse, tolera errores), acá el orden
 * tiene que ser predecible mientras se escribe letra por letra, así que se
 * usan prefijos: exacto, comienzo del nombre, abreviatura/alias, comienzo
 * de una palabra («corintios» → 1 y 2 Corintios) y, desde 3 letras, una
 * parte del nombre. Empates: orden canónico.
 */

export type BookSearchResult = {
  book: BibleBook;
  /** Menor = mejor (ver scoreBook). */
  score: number;
  /** Tramo del nombre (índices en `book.name`) que coincide, para resaltarlo; null si no aparece en el nombre (alias como «jn»). */
  span: [number, number] | null;
};

export type BookGoTo = {
  book: BibleBook;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  verses?: number[];
  label: string;
};

/** Lo que se escribió no existe: «Salmos tiene 150 capítulos», «Juan 3 tiene 36 versículos». */
export type BookOutOfRange
  = | { kind: "chapter"; book: BibleBook; count: number }
    | { kind: "verse"; book: BibleBook; chapter: number; count: number };

const compact = (value: string) => normalizeText(value).replace(/[\s.]+/g, "");

function scoreBook(book: BibleBook, query: string): number | null {
  const q = compact(query);
  if (q === "")
    return null;
  const name = compact(book.name);
  const short = [
    book.abbreviation,
    ...(BOOK_ALIAS_OVERRIDES[book.id] ?? []),
  ].map(compact);
  if (name === q || short.includes(q))
    return 0;
  if (name.startsWith(q))
    return 1;
  if (short.some(alias => alias.startsWith(q)))
    return 2;
  const words = normalizeText(book.name).split(/\s+/);
  const spaced = normalizeText(query).replace(/\s+/g, " ");
  if (words.some(word => word.startsWith(spaced)))
    return 3;
  if (q.length >= 3 && name.includes(q))
    return 4;
  return null;
}

/** Dónde cae `query` dentro de `name`, ignorando tildes, mayúsculas y espacios. */
export function matchSpan(name: string, query: string): [number, number] | null {
  const q = compact(query);
  if (q === "")
    return null;
  // Cada letra comparable apunta a su índice en el nombre original.
  const map: number[] = [];
  let flat = ""
  ;[...name].forEach((char, index) => {
    for (const letter of compact(char)) {
      flat += letter;
      map.push(index);
    }
  });
  let at = flat.startsWith(q)
    ? 0
    : -1;
  if (at < 0) {
    for (let i = 1; i < flat.length; i++) {
      if (name[map[i]! - 1] === " " && flat.startsWith(q, i)) {
        at = i;
        break;
      }
    }
  }
  if (at < 0)
    at = flat.indexOf(q);
  if (at < 0)
    return null;
  return [map[at]!, map[at + q.length - 1]! + 1];
}

export function searchBooks(books: BibleBook[], query: string): BookSearchResult[] {
  const results: BookSearchResult[] = [];
  books.forEach((book) => {
    const score = scoreBook(book, query);
    if (score == null)
      return;
    // El tramo sale del nombre aunque haya coincidido por alias: «gen» marca
    // «Gén»; «jn» no está en «Juan» y queda sin resaltar.
    results.push({
      book,
      score,
      span: matchSpan(book.name, query),
    });
  });
  // sort es estable: a igual puntaje queda el orden en que vienen (canónico o alfabético).
  return results.sort((a, b) => a.score - b.score);
}

/** La parte del texto que nombra al libro: «jn 3:16» → «jn»; sin números, todo. */
export function bookPartOf(query: string): string {
  return extractReferenceTail(normalizeReferenceMarkers(query.trim())).bookPart;
}

function toAliasMatch(result: BookSearchResult): BookAliasMatch {
  return {
    id: result.book.id,
    name: result.book.name,
    matchedAlias: result.book.name,
    score: result.score,
    isExactPrefix: true,
  };
}

/**
 * Una cita con capítulo («jn 3», «jn 3:16», «1 co 13 4-7»). Prueba los
 * libros candidatos en orden y se queda con el primero donde la cita existe:
 * «jn 3:16» no cabe en Jonás 3 (10 versículos) y cae en Juan.
 */
export function resolveBookGoTo(books: BibleBook[], query: string): BookGoTo | BookOutOfRange | null {
  const tail = extractReferenceTail(normalizeReferenceMarkers(query.trim()));
  if (tail.chapterDigits == null && tail.gluedRangeDigits == null)
    return null;
  const candidates = searchBooks(books, tail.bookPart);
  if (candidates.length === 0)
    return null;
  const byId = new Map(books.map(book => [book.id, book]));
  const getStructure = (id: number) => byId.get(id);
  // El parser acepta un versículo fuera del capítulo con separador explícito
  // («jonas 3:16»), así que el límite real se revisa acá.
  let firstMiss: BookOutOfRange | null = null;
  for (const candidate of candidates) {
    const parsed = parseBibleReference(
      query,
      part => searchBooks(books, part).filter(r => r.book.id === candidate.book.id).map(toAliasMatch),
      getStructure,
    );
    const book = candidate.book;
    const chapter = parsed.status === "invalid"
      ? Number(tail.chapterDigits)
      : parsed.chapter;
    if (chapter == null || Number.isNaN(chapter))
      continue;
    if (chapter < 1 || chapter > book.chapterCount) {
      firstMiss ??= { kind: "chapter", book, count: book.chapterCount };
      continue;
    }
    const count = book.versesPerChapter[chapter - 1] ?? 0;
    const asked = parsed.status === "invalid"
      ? [tail.verseStart, tail.verseEnd]
      : [
          parsed.verseStart,
          parsed.verseEnd,
          ...(parsed.verses ?? []),
        ];
    if (asked.some(verse => verse != null && (verse < 1 || verse > count))) {
      firstMiss ??= { kind: "verse", book, chapter, count };
      continue;
    }
    if (parsed.status === "invalid" || parsed.chapter == null)
      continue;
    return {
      book,
      chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
      verses: parsed.verses,
      label: parsed.canonicalLabel ?? `${book.name} ${chapter}`,
    };
  }
  return firstMiss;
}

export function isBookGoTo(value: BookGoTo | BookOutOfRange | null): value is BookGoTo {
  return value != null && !("kind" in value);
}
