import type { BibleBook } from "~~/lib/bible";

import { normalizeText } from "./normalize-text";
import { splitBookPart } from "./parse-bible-reference";

/**
 * The usual Spanish short names of the books (as in the Reina-Valera),
 * by book id (1–66, canonical order): for a reference where room is short
 * («Ap 3:2-5» instead of «Apocalipsis 3:2-5»). The versions' own
 * `abbreviation` is a three-letter English code («Rev»), not for reading.
 */
export const SHORT_BOOK_NAMES: Record<number, string> = {
  1: "Gn",
  2: "Éx",
  3: "Lv",
  4: "Nm",
  5: "Dt",
  6: "Jos",
  7: "Jue",
  8: "Rt",
  9: "1 S",
  10: "2 S",
  11: "1 R",
  12: "2 R",
  13: "1 Cr",
  14: "2 Cr",
  15: "Esd",
  16: "Neh",
  17: "Est",
  18: "Job",
  19: "Sal",
  20: "Pr",
  21: "Ec",
  22: "Cnt",
  23: "Is",
  24: "Jer",
  25: "Lm",
  26: "Ez",
  27: "Dn",
  28: "Os",
  29: "Jl",
  30: "Am",
  31: "Abd",
  32: "Jon",
  33: "Mi",
  34: "Nah",
  35: "Hab",
  36: "Sof",
  37: "Hag",
  38: "Zac",
  39: "Mal",
  40: "Mt",
  41: "Mr",
  42: "Lc",
  43: "Jn",
  44: "Hch",
  45: "Ro",
  46: "1 Co",
  47: "2 Co",
  48: "Gá",
  49: "Ef",
  50: "Fil",
  51: "Col",
  52: "1 Ts",
  53: "2 Ts",
  54: "1 Ti",
  55: "2 Ti",
  56: "Tit",
  57: "Flm",
  58: "He",
  59: "Stg",
  60: "1 P",
  61: "2 P",
  62: "1 Jn",
  63: "2 Jn",
  64: "3 Jn",
  65: "Jud",
  66: "Ap",
};

/**
 * A reference with its book's short name («Apocalipsis 3:2-5» → «Ap 3:2-5»),
 * the book recognized by its full name in `books`. A book not recognized
 * (still typed as an abbreviation, «jn 3:16») stays as it is.
 */
export function shortReference(reference: string, books: BibleBook[]): string {
  const { bookPart, tail } = splitBookPart(reference.trim());
  const key = normalizeText(bookPart);
  const book = books.find(b => normalizeText(b.name) === key);
  const short = book && SHORT_BOOK_NAMES[book.id];
  if (!short)
    return reference.trim();
  return tail
    ? `${short} ${tail}`
    : short;
}
