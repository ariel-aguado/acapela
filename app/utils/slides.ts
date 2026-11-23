import type { LyricBlock, Song } from "~~/lib/types";

export type Slide = {
  kind: "stanza" | "chorus";
  /** "Estrofa 1", "Coro"… */
  label: string;
  html: string;
  /** Plain first line, for compact lists in the console. */
  preview: string;
};

function toSlide(block: LyricBlock): Slide {
  return {
    kind: block.kind === "chorus" ? "chorus" : "stanza",
    label: blockLabel(block) || (block.kind === "chorus" ? "Coro" : "Estrofa"),
    html: block.html,
    preview: lyricExcerpt(block.text[0] ?? ""),
  };
}

/**
 * The order a hymn is sung in. With a single chorus, it is repeated after
 * every stanza (stanza, chorus, stanza, chorus… chorus), as congregations
 * sing it; otherwise blocks follow the songbook order.
 */
export function buildSlides(song: Song | null | undefined): Slide[] {
  const blocks = (song?.blocks ?? []).filter(b => b.kind !== "citation");
  const choruses = blocks.filter(b => b.kind === "chorus");
  if (choruses.length !== 1)
    return blocks.map(toSlide);

  const chorus = toSlide(choruses[0]!);
  const stanzas = blocks.filter(b => b.kind !== "chorus").map(toSlide);
  if (stanzas.length === 0)
    return [chorus];
  return stanzas.flatMap(s => [s, chorus]);
}
