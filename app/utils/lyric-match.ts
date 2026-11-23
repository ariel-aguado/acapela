import type { LyricBlock, Song } from "~~/lib/types";

/** Lowercase, no accents, no Markdown marks, single spaces. */
export function normalizeLyric(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[*|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Index of the block that contains a lyric line, or -1. */
export function findBlockIndex(song: Pick<Song, "blocks"> | undefined | null, line: string): number {
  if (!song?.blocks?.length)
    return -1;
  const needle = normalizeLyric(line);
  if (!needle)
    return -1;
  return song.blocks.findIndex(b => b.kind !== "citation" && normalizeLyric(b.text.join(" ")).includes(needle));
}

/** What a singer calls the block: "Coro", "Estrofa 2"… */
export function blockLabel(block: LyricBlock | undefined | null): string {
  if (!block)
    return "";
  if (block.kind === "chorus")
    return "Coro";
  if (block.kind === "stanza" && block.number)
    return `Estrofa ${block.number}`;
  return "";
}

/** First letter used to group titles A–Z ("¡Aleluya!" → "A", "Ángel" → "A"). */
export function titleInitial(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/^[^a-z0-9]+/i, "")
    .charAt(0)
    .toUpperCase();
}

/** Title without leading punctuation, for A–Z sorting. */
export function titleSortKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/^[^a-z0-9]+/i, "")
    .toLowerCase();
}

/** A lyric line as a one-line excerpt: no repeat marks ("//…//"), no emphasis. */
export function lyricExcerpt(line: string): string {
  return line.replace(/\*+/g, "").replace(/^\/+\s*/, "").replace(/\s*\/+$/, "").trim();
}
