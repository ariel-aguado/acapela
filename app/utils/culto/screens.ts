import type { Slide } from "~/utils/slides";
import type { VerseRow } from "~~/lib/bible";
import type { Look, ScreenLayout } from "~~/lib/culto";

import type { PageItem } from "./paginate";

/**
 * One projected screen: what travels to the projector window and what the
 * console shows. Already laid out (a page's body is the HTML that fitted),
 * so the projector only draws.
 */
export type Screen
  = | {
    type: "lyric";
    slide: Slide;
    number: number;
    title: string;
    scale: number;
    look?: Look;
  }
  | {
    type: "page";
    layout: ScreenLayout;
    eyebrow: string;
    title: string;
    reference: string;
    /** Body HTML of this screen (text layout). */
    html: string;
    /** Bottom left ("Reina-Valera 1960", the church's name). */
    footer: string;
    /** Bottom right ("2 / 4"), empty for a single screen. */
    counter: string;
    scale: number;
    /** The picture of the image and logo layouts. */
    mediaId?: string;
    look?: Look;
  }
  | {
    /** A slide brought from a PDF or an image, shown as it is. */
    type: "image";
    mediaId: string;
  };

/** Letter size of a page's body at scale 1, on the 1920×1080 stage. */
export const PAGE_BODY_PX = 62;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The markup of a page on the stage. The same string is used to draw it and
 * to measure it while paginating, so what was measured is what is shown.
 */
export function renderPage(screen: Extract<Screen, { type: "page" }>, body = screen.html): string {
  const parts = [`<div class="page page--${screen.layout}" style="--page-body:${Math.round(PAGE_BODY_PX * screen.scale)}px">`];
  if (screen.eyebrow)
    parts.push(`<p class="page-eyebrow">${escapeHtml(screen.eyebrow)}</p>`);
  parts.push(`<div class="page-main">`);
  if (screen.layout === "logo" && screen.mediaId)
    parts.push(`<img class="page-logo" data-media="${escapeHtml(screen.mediaId)}" alt="">`);
  if (screen.title)
    parts.push(`<h2 class="page-title">${escapeHtml(screen.title)}</h2>`);
  if (screen.reference)
    parts.push(`<p class="page-reference">${escapeHtml(screen.reference)}</p>`);
  if (screen.layout === "text")
    parts.push(`<div class="page-body">${body}</div>`);
  if (screen.layout === "image" && screen.mediaId)
    parts.push(`<img class="page-media" data-media="${escapeHtml(screen.mediaId)}" alt="">`);
  parts.push(`</div>`);
  if (screen.footer || screen.counter)
    parts.push(`<p class="page-footer"><span>${escapeHtml(screen.footer)}</span><span>${escapeHtml(screen.counter)}</span></p>`);
  parts.push(`</div>`);
  return parts.join("");
}

/** Sentences of a text, keeping their punctuation; a long sentence may still be one piece. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.;:!?»"”)])\s+(?=\S)/u)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Pieces for free text: one per paragraph (blank line), split by lines or sentences. */
export function textPieces(text: string, idPrefix: string): PageItem[] {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map((paragraph, i) => {
    const lines = paragraph.split("\n").map(l => l.trim()).filter(Boolean);
    // Several lines (a list, an agenda): the lines are the pieces and keep
    // their breaks. A single line: its sentences.
    const split = lines.length > 1
      ? lines.map((l, j) => escapeHtml(l) + (j < lines.length - 1
          ? "<br>"
          : ""))
      : splitSentences(paragraph).map(escapeHtml);
    const render = (inner: string, continued: boolean) => `<p${continued
      ? " class=\"cont\""
      : ""}>${inner}</p>`;
    return {
      id: `${idPrefix}${i}`,
      key: `${idPrefix}${i}`,
      html: render(split.join(" "), false),
      keepNext: false,
      breakBefore: false,
      split: split.length > 1
        ? split
        : null,
      part: 0,
      render,
    };
  });
}

/** Pieces for Bible verses: one per verse, split by sentences, the number only on its first part. */
export function versePieces(verses: VerseRow[], oneEach: boolean): PageItem[] {
  return verses
    .filter(v => v.text.trim())
    .map((v, i) => {
      const text = v.text.replace(/\s+/g, " ").trim();
      const split = splitSentences(text).map(escapeHtml);
      const number = v.verseRangeEnd
        ? `${v.verse}-${v.verseRangeEnd}`
        : String(v.verse);
      const render = (inner: string, continued: boolean) => continued
        ? `<p class="cont" data-v="${v.verse}">${inner}</p>`
        : `<p data-v="${v.verse}"><sup>${number}</sup>${inner}</p>`;
      return {
        id: `v${v.chapter}:${v.verse}`,
        key: `v${v.chapter}:${v.verse}`,
        html: render(split.join(" "), false),
        keepNext: false,
        breakBefore: oneEach && i > 0,
        split: split.length > 1
          ? split
          : null,
        part: 0,
        render,
      };
    });
}
