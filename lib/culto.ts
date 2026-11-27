/**
 * A worship service ("culto"): an ordered list of elements, each turned
 * into one or more projected screens. Only the source is stored (which
 * hymn, which passage, what text); the screens are computed from it at
 * projection size (app/composables/use-culto-screens.ts), so changing the
 * text, the letter size or inserting something re-flows everything after.
 */

type ItemBase = {
  id: string;
  /** For whoever leads the service; never projected. */
  notes?: string;
  /** Added from the live console during the service. */
  inserted?: boolean;
  /** Text size for this element, 1 = automatic (0.6–1.5). */
  scale?: number;
};

export type HymnItem = ItemBase & {
  kind: "hymn";
  /** Songbook the number belongs to (the same number is a different hymn in each one). */
  songbookId: string;
  songId: number;
};

/** A designed screen: welcome, Lord's supper, offering, prayer… */
export type ScreenLayout = "title" | "quote" | "text";
export type ScreenItem = ItemBase & {
  kind: "screen";
  layout: ScreenLayout;
  /** Small label on top ("SANTA CENA"). */
  eyebrow: string;
  title: string;
  /** More text: split across screens when it does not fit. */
  body: string;
  /** Under the title ("1 Corintios 11:24"). */
  reference: string;
};

export type ReadingMode = "fit" | "verse";
export type ReadingItem = ItemBase & {
  kind: "reading";
  /** As typed: "Sal 46:1-7", "jn 3:16". */
  reference: string;
  versionId: string;
  /** fit: as many verses as fit per screen; verse: one verse per screen. */
  mode: ReadingMode;
};

export type CultoItem = HymnItem | ScreenItem | ReadingItem;
export type CultoItemKind = CultoItem["kind"];

export type Culto = {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  items: CultoItem[];
  updatedAt: number;
};

export const SCREEN_LAYOUT_LABELS: Record<ScreenLayout, string> = {
  title: "Título",
  quote: "Cita",
  text: "Texto",
};

export const ITEM_KIND_LABELS: Record<CultoItemKind, string> = {
  hymn: "Himno",
  screen: "Pantalla",
  reading: "Lectura",
};
