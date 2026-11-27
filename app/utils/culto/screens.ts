import type { Slide } from "~/utils/slides";
import type { VerseRow } from "~~/lib/bible";
import type { FieldStyle, Look, ScreenLayout, TextAlign, TextField } from "~~/lib/culto";

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
    /**
     * The lyric's size before `scale`, the same for all the hymn's screens
     * with as many lines (see useCultoScreens); none: fitted on its own.
     */
    size?: number;
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
    /** Chosen alignment of the text; none: the layout's own. */
    align?: TextAlign;
    /** A style of their own for some of the texts. */
    styles?: Partial<Record<TextField, FieldStyle>>;
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
const SELF: Record<TextAlign, string> = { start: "flex-start", center: "center", end: "flex-end" };

/** The inline style of a text with a style of its own (alignment, size). */
function fieldStyle(style: FieldStyle | undefined): string {
  if (!style)
    return "";
  const css: string[] = [];
  if (style.align)
    css.push(`text-align:${style.align}`, `align-self:${SELF[style.align]}`);
  if (style.scale && style.scale !== 1)
    css.push(`zoom:${style.scale}`);
  return css.length
    ? ` style="${css.join(";")}"`
    : "";
}

export function renderPage(screen: Extract<Screen, { type: "page" }>, body = screen.html): string {
  const align = screen.align
    ? ` page--align-${screen.align}`
    : "";
  const parts = [`<div class="page page--${screen.layout}${align}" style="--page-body:${Math.round(PAGE_BODY_PX * screen.scale)}px">`];
  if (screen.eyebrow)
    parts.push(`<p class="page-eyebrow"${fieldStyle(screen.styles?.eyebrow)}>${escapeHtml(screen.eyebrow)}</p>`);
  parts.push(`<div class="page-main">`);
  if (screen.layout === "logo" && screen.mediaId)
    parts.push(`<img class="page-logo" data-media="${escapeHtml(screen.mediaId)}" alt="">`);
  if (screen.title)
    parts.push(`<h2 class="page-title"${fieldStyle(screen.styles?.title)}>${escapeHtml(screen.title)}</h2>`);
  if (screen.reference)
    parts.push(`<p class="page-reference"${fieldStyle(screen.styles?.reference)}>${escapeHtml(screen.reference)}</p>`);
  if (screen.layout === "text")
    parts.push(`<div class="page-body"${fieldStyle(screen.styles?.body)}>${body}</div>`);
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

/**
 * Pieces for Bible verses: one per verse, kept whole on a screen (a verse is
 * not cut to fill the end of one). One too long for a whole screen is split
 * by sentences, and its continuation keeps the number ("¹⁶ …"), so no screen
 * starts with text whose verse cannot be told. `idPrefix` keeps them apart when one element has
 * several passages (a moment's).
 */
export function versePieces(verses: VerseRow[], oneEach: boolean, idPrefix = ""): PageItem[] {
  return verses
    .filter(v => v.text.trim())
    .map((v, i) => {
      const text = v.text.replace(/\s+/g, " ").trim();
      const split = splitSentences(text).map(escapeHtml);
      const number = v.verseRangeEnd
        ? `${v.verse}-${v.verseRangeEnd}`
        : String(v.verse);
      const render = (inner: string, continued: boolean) => continued
        ? `<p class="cont" data-v="${v.verse}"><sup>${number}</sup>…${inner}</p>`
        : `<p data-v="${v.verse}"><sup>${number}</sup>${inner}</p>`;
      return {
        id: `${idPrefix}v${v.chapter}:${v.verse}`,
        key: `${idPrefix}v${v.chapter}:${v.verse}`,
        html: render(split.join(" "), false),
        keepNext: false,
        keepWhole: true,
        breakBefore: oneEach && i > 0,
        split: split.length > 1
          ? split
          : null,
        part: 0,
        render,
      };
    });
}
